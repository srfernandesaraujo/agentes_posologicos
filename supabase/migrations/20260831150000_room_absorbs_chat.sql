-- Salas Virtuais como centro do sistema: adiciona room_type ('pin' | 'personal'),
-- permite pin nulo (salas pessoais não usam PIN), prepara room_messages para o
-- feed de automação de Flow, e permite que um gatilho de Flow aponte para uma sala.
-- Puramente aditivo: room_type default 'pin' cobre todas as linhas existentes,
-- nenhuma policy de RLS muda.

ALTER TABLE public.virtual_rooms
  ADD COLUMN room_type text NOT NULL DEFAULT 'pin' CHECK (room_type IN ('pin', 'personal'));

ALTER TABLE public.virtual_rooms ALTER COLUMN pin DROP NOT NULL;

-- Não há restrição de unicidade (user_id, agent_id): o padrão é uma sala
-- contínua por agente (a mais recente é escolhida automaticamente como
-- padrão pelo cliente), mas o usuário pode criar uma segunda sala nomeada
-- manualmente com o mesmo agente para "recomeçar do zero" — mesmo
-- comportamento que chat_sessions sempre permitiu (múltiplas conversas por
-- agente).
CREATE INDEX idx_virtual_rooms_user_type
  ON public.virtual_rooms (user_id, room_type);

-- Defesa em profundidade: PIN só pode encontrar salas do tipo 'pin' (já é
-- estruturalmente verdade hoje, já que salas pessoais têm pin IS NULL, mas
-- fica explícito em vez de depender de uma comparação implícita com NULL).
CREATE OR REPLACE FUNCTION public.get_room_by_pin(p_pin text)
 RETURNS TABLE(
   id uuid, name text, description text, pin text, is_active boolean,
   agent_id uuid, user_id uuid, room_expires_at timestamptz, agent_expires_at timestamptz,
   created_at timestamptz, updated_at timestamptz, live_mode boolean, current_broadcast_prompt text
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, name, description, pin, is_active, agent_id, user_id,
         room_expires_at, agent_expires_at, created_at, updated_at,
         live_mode, current_broadcast_prompt
  FROM public.virtual_rooms
  WHERE pin = p_pin AND is_active = true AND room_type = 'pin'
  LIMIT 1;
$function$;

-- Feed de automação: mensagens postadas por um gatilho de Flow (cron/webhook)
-- em vez de por uma pessoa digitando.
ALTER TABLE public.room_messages
  ADD COLUMN source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'flow_automation')),
  ADD COLUMN flow_execution_id uuid REFERENCES public.agent_flow_executions(id) ON DELETE SET NULL;

CREATE INDEX idx_room_messages_flow_execution
  ON public.room_messages (flow_execution_id)
  WHERE flow_execution_id IS NOT NULL;

-- Um gatilho de Flow pode opcionalmente ter uma sala-alvo para postar o resultado.
ALTER TABLE public.agent_flow_triggers
  ADD COLUMN room_id uuid REFERENCES public.virtual_rooms(id) ON DELETE SET NULL;
