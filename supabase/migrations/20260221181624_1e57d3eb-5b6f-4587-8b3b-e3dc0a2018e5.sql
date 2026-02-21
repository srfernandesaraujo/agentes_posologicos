
CREATE OR REPLACE FUNCTION public.grant_signup_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.credits_ledger (user_id, amount, type, description)
  VALUES (NEW.user_id, 15, 'bonus', 'Bônus de cadastro - Plano Gratuito (15 créditos)');
  RETURN NEW;
END;
$function$;
