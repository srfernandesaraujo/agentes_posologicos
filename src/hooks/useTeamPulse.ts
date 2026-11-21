import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const db = supabase as any;

export interface PulseMission { id: string; squad_id: string; briefing: string; status: "running" | "awaiting_approval" | "paused" }
export interface PulseAction { id: string; squad_id: string; meeting_id: string; type: "email" | "evento" | "aviso_convite"; payload: Record<string, any> }
export interface PulseQuestion { id: string; squad_id: string; question: string }
export interface PulseMeeting { id: string; squad_id: string; title: string }

export interface TeamPulse {
  missions: PulseMission[];
  actions: PulseAction[];
  questions: PulseQuestion[];
  meetings: PulseMeeting[];
}

export const ACTION_LABEL: Record<PulseAction["type"], string> = {
  email: "Enviar e-mail",
  evento: "Criar evento na agenda",
  aviso_convite: "Avisar convidados",
};

/** O que as equipes (squads) estão fazendo e o que espera aprovação do dono. Tudo protegido por RLS do próprio usuário. */
export function useTeamPulse() {
  const { user } = useAuth();
  return useQuery<TeamPulse>({
    queryKey: ["team-pulse", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [missions, actions, questions, meetings] = await Promise.all([
        db.from("squad_missions").select("id, squad_id, briefing, status").in("status", ["running", "awaiting_approval", "paused"]).order("created_at", { ascending: false }).limit(20),
        db.from("squad_meeting_actions").select("id, squad_id, meeting_id, type, payload").eq("status", "proposed").order("created_at", { ascending: false }).limit(20),
        db.from("squad_questions").select("id, squad_id, question").eq("status", "open").order("created_at", { ascending: false }).limit(20),
        db.from("squad_meetings").select("id, squad_id, title").eq("status", "open").order("created_at", { ascending: false }).limit(10),
      ]);
      // Uma consulta que falha (ex.: tabela ainda sem acesso) não derruba as outras.
      return {
        missions: (missions.data || []) as PulseMission[],
        actions: (actions.data || []) as PulseAction[],
        questions: (questions.data || []) as PulseQuestion[],
        meetings: (meetings.data || []) as PulseMeeting[],
      };
    },
  });
}

/** Itens que dependem de uma decisão do usuário. */
export function awaitingCount(p?: TeamPulse): number {
  if (!p) return 0;
  return p.actions.length + p.questions.length + p.missions.filter((m) => m.status === "awaiting_approval").length;
}
