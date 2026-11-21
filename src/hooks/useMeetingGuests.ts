import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeFunction } from "@/lib/invokeFunction";
import type { AgendaItem, Proactivity } from "@/hooks/useSquadMeeting";

// Reunião Viva (Fase 3): convidados. O convidado não lê tabelas: tudo vem da ação `view` da função `squad-meeting`, que devolve só
// campos seguros. O anfitrião cria e revoga links de convite e remove convidados pela mesma função.
const call = <T = any>(body: Record<string, unknown>) => invokeFunction<T>("squad-meeting", body);

export type GuestRole = "participant" | "observer";
export const ROLE_LABEL: Record<string, string> = { host: "Anfitrião", participant: "Participante", observer: "Observador" };

export interface GuestMessage {
  id: string;
  author: "user" | "agent" | "system";
  agent_id: string | null;
  content: string;
  created_at: string;
  meta: {
    minutes_doc?: any;
    sources?: { pmid: string; title: string; journal: string; year: string; url: string }[];
    calc?: Record<string, any>[];
    meeting?: { tool?: { name: string; query: string; count: number; error?: string }; minutes?: boolean; author_name?: string; author_role?: string; mine?: boolean };
  };
}
export interface GuestView {
  role: "host" | "participant" | "observer";
  meeting: {
    id: string; title: string; agenda: AgendaItem[]; current_item: number; proactivity: Proactivity; status: "open" | "ended";
    silenced_until: string | null; minutes_live: string | null; minutes_live_version: number; created_at: string;
  };
  agents: { id: string; name: string; role: string }[];
  messages: GuestMessage[];
  files: { id: string; name: string; kind: "sheet" | "doc"; rows: number | null; cols: number | null; pages: number | null }[];
  people: { name: string; role: string }[];
}

/** Entra na reunião com o token do link. */
export function useJoinMeeting() {
  return useMutation({ mutationFn: (token: string) => call<{ meetingId: string; role: string; title: string }>({ action: "join", token }) });
}

/** A reunião vista pelo convidado. Consulta a cada poucos segundos enquanto a aba está aberta e a reunião não acabou. */
export function useGuestView(meetingId?: string) {
  return useQuery({
    queryKey: ["meeting-guest-view", meetingId],
    enabled: !!meetingId,
    refetchInterval: (q) => ((q.state.data as GuestView | undefined)?.meeting.status === "ended" ? false : 4000),
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: () => call<GuestView>({ action: "view", meetingId }),
  });
}

export function useGuestActions(meetingId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["meeting-guest-view", meetingId] });
  const say = useMutation({ mutationFn: (text: string) => call({ action: "say", meetingId, text }), onSettled: refresh });
  const leave = useMutation({ mutationFn: () => call({ action: "leave", meetingId }) });
  return { say, leave };
}

export interface MeetingMember { user_id: string; display_name: string; role: GuestRole; joined_at: string }
export interface MeetingInvite { id: string; role: GuestRole; expires_at: string; created_at: string }

/** Convidados e links ativos (só o anfitrião). */
export function useMeetingPeople(meetingId?: string, enabled = true) {
  return useQuery({
    queryKey: ["meeting-people", meetingId],
    enabled: !!meetingId && enabled,
    refetchInterval: enabled ? 10_000 : false,
    queryFn: () => call<{ members: MeetingMember[]; invites: MeetingInvite[] }>({ action: "list_members", meetingId }),
  });
}

export function useInviteActions(meetingId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["meeting-people", meetingId] });
  const create = useMutation({
    mutationFn: (role: GuestRole) => call<{ invite: { id: string; token: string; role: GuestRole; expires_at: string } }>({ action: "create_invite", meetingId, role }),
    onSuccess: refresh,
  });
  const revoke = useMutation({ mutationFn: (inviteId: string) => call({ action: "revoke_invite", meetingId, inviteId }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (userId: string) => call({ action: "remove_member", meetingId, userId }), onSuccess: refresh });
  return { create, revoke, remove };
}

export const inviteUrl = (token: string) => `${window.location.origin}/reuniao-viva/convite/${token}`;
