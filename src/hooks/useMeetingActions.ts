import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { setReturnTo } from "@/lib/returnTo";

// Reunião Viva (Fase 4): ações propostas pelos agentes. O dono lê os cartões da tabela (RLS só dele, com Realtime); aprovar e
// descartar passam pela função `squad-meeting`, que valida, executa no Gmail ou na Agenda e registra o resultado.
export type ActionType = "email" | "evento" | "aviso_convite";
export type ActionStatus = "proposed" | "executing" | "done" | "failed" | "discarded";

export interface MeetingAction {
  id: string;
  meeting_id: string;
  agent_id: string | null;
  type: ActionType;
  payload: Record<string, any>;
  status: ActionStatus;
  masked: { type: string; count: number }[];
  result: { id?: string | null; link?: string | null } | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
}

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const neededScope = (t: ActionType) => (t === "evento" ? CALENDAR_SCOPE : GMAIL_SEND_SCOPE);

const db = supabase as any;
const call = <T = any>(body: Record<string, unknown>) => invokeFunction<T>("squad-meeting", body);

export function useMeetingActions(meetingId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["meeting-actions", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_meeting_actions").select("*").eq("meeting_id", meetingId).order("created_at");
      if (error) throw error;
      return (data || []) as MeetingAction[];
    },
  });
  useEffect(() => {
    if (!meetingId) return;
    const channel = supabase
      .channel(`meeting-actions-${meetingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_meeting_actions", filter: `meeting_id=eq.${meetingId}` },
        () => qc.invalidateQueries({ queryKey: ["meeting-actions", meetingId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meetingId, qc]);
  return query;
}

export function useActionDecisions(meetingId: string, squadId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["meeting-actions", meetingId] });
    qc.invalidateQueries({ queryKey: ["squad-chat", squadId] });
  };
  const approve = useMutation({
    mutationFn: (p: { actionId: string; edits?: Record<string, unknown> }) => call({ action: "approve_action", meetingId, ...p }),
    onSettled: refresh,
  });
  const discard = useMutation({
    mutationFn: (actionId: string) => call({ action: "discard_action", meetingId, actionId }),
    onSettled: refresh,
  });
  return { approve, discard };
}

/** Permissões do Google já concedidas (vem da função de status da conexão). */
export function useGoogleScopes() {
  return useQuery({
    queryKey: ["google-scopes"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meeting-google-status", { body: {} });
      if (error) throw error;
      return { connected: !!data?.connected, scopes: String(data?.scopes || "") };
    },
  });
}

/** Leva o dono ao Google para conceder Gmail e Agenda e traz de volta ao squad. */
export async function connectGoogleForActions(squadId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("meeting-google-oauth-start", { body: { withActions: true } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  setReturnTo(`/squads/${squadId}`);
  window.location.href = data.authUrl;
}
