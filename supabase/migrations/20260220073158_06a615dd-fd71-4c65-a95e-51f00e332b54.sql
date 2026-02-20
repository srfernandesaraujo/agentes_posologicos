
-- Change credits_ledger.amount from integer to numeric to support fractional credits (0.5)
ALTER TABLE public.credits_ledger ALTER COLUMN amount TYPE numeric USING amount::numeric;

-- Add expiration fields to virtual_rooms
ALTER TABLE public.virtual_rooms 
  ADD COLUMN agent_expires_at timestamp with time zone,
  ADD COLUMN room_expires_at timestamp with time zone;
