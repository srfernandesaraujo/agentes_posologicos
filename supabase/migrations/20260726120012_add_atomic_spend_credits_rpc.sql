-- Atomic credit debit primitive.
--
-- Why: every consumer of credits_ledger up to now read the balance in application
-- code (SELECT SUM(amount)), compared it to a cost, then did a *separate* INSERT of
-- a negative row. That check-then-act pattern has two problems:
--   1) Concurrent requests can both pass the balance check before either INSERT
--      lands, letting a user spend more than their balance (race condition).
--   2) After migration 20260513115341 removed the "Users can insert own credits"
--      RLS policy (closing a privilege-escalation hole), several client-side call
--      sites that still tried to INSERT directly now fail RLS silently (the error
--      was never checked), so those actions became free of charge.
--
-- This function replaces both patterns with a single atomic, race-safe primitive:
-- an advisory lock serializes concurrent spends per user, the balance check and
-- the debit happen in the same transaction, and it's SECURITY DEFINER so it can
-- be granted directly to `authenticated` (closing the RLS gap) while still only
-- ever letting an authenticated caller spend their OWN credits — auth.uid() is
-- taken as the target whenever it is present, never the p_user_id argument.
-- Service-role callers (edge functions) have no auth.uid(), so they may pass an
-- explicit p_user_id (needed e.g. to charge a live-exam participant who isn't the
-- caller).
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_type text DEFAULT 'usage',
  p_reference_id text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_target := auth.uid();
  ELSE
    v_target := p_user_id;
  END IF;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'NO_TARGET_USER';
  END IF;

  -- Serialize concurrent spends for the same user for the rest of this transaction.
  -- Must happen BEFORE the idempotency check below: two concurrent calls with the
  -- same reference_id (e.g. a network retry racing itself) would otherwise both
  -- observe "not yet charged" and both insert, defeating the idempotency guard.
  -- With the lock first, the second caller only proceeds after the first commits,
  -- so it then sees the row and returns early instead of double-charging.
  PERFORM pg_advisory_xact_lock(hashtext(v_target::text));

  -- Idempotency: if this exact reference was already charged, return the
  -- current balance without charging again (safe to retry).
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credits_ledger WHERE reference_id = p_reference_id
  ) THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM public.credits_ledger WHERE user_id = v_target;
    RETURN v_balance;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.credits_ledger WHERE user_id = v_target;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  INSERT INTO public.credits_ledger (user_id, amount, type, description, reference_id)
  VALUES (v_target, -p_amount, COALESCE(p_type, 'usage'), p_description, p_reference_id);

  RETURN v_balance - p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_credits(uuid, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, numeric, text, text, text) TO authenticated, service_role;
