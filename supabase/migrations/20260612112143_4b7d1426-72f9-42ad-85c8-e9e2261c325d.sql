DROP FUNCTION IF EXISTS public.get_room_by_pin(text);
CREATE FUNCTION public.get_room_by_pin(p_pin text)
 RETURNS TABLE(id uuid, name text, description text, pin text, is_active boolean, agent_id uuid, user_id uuid, room_expires_at timestamp with time zone, agent_expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, live_mode boolean, current_broadcast_prompt text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, description, pin, is_active, agent_id, user_id,
         room_expires_at, agent_expires_at, created_at, updated_at,
         live_mode, current_broadcast_prompt
  FROM public.virtual_rooms
  WHERE pin = p_pin AND is_active = true
  LIMIT 1;
$function$;