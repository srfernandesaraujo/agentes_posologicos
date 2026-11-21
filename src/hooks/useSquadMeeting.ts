import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import type { ChatMessage, ChatUsage } from "@/hooks/useSquadChat";

// Reunião Viva. O estado (pauta, item atual, proatividade, silêncio, teto) fica em `squad_meetings`; as mensagens continuam em
// `squad_chat_messages` com `meta.meeting.id`. Escritas passam pela função `squad-meeting`; aqui só se lê (com Realtime) e se chama.
export type Proactivity = "calm" | "balanced" | "active";
export interface AgendaItem { title: string; done: boolean; decision?: string }
export interface LiveMeeting {
  id: string;
  squad_id: string;
  title: string;
  agenda: AgendaItem[];
  current_item: number;
  proactivity: Proactivity;
  participants: string[];
  status: "open" | "ended";
  cap_usd: number | string;
  silenced_until: string | null;
  minutes: string | null;
  /** Ata atualizada pelo servidor durante a conversa (o dono pode editar). */
  minutes_live: string | null;
  minutes_live_version: number;
  created_at: string;
}

export const PROACTIVITY_OPTIONS: { value: Proactivity; label: string; hint: string }[] = [
  { value: "calm", label: "Calmo", hint: "Só falam quando chamados com @nome. A pauta continua." },
  { value: "balanced", label: "Equilibrado", hint: "Entram quando há problema claro, dúvida sem resposta ou item travado. No máximo uma fala espontânea por minuto." },
  { value: "active", label: "Ativo", hint: "Comentam mais e antecipam. Custa mais e pode cansar." },
];

const db = supabase as any;
const call = <T = any>(body: Record<string, unknown>) => invokeFunction<T>("squad-meeting", body);

/** A reunião aberta do squad (no máximo uma), atualizada em tempo real. */
export function useLiveMeeting(squadId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squad-live-meeting", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_meetings").select("*").eq("squad_id", squadId).eq("status", "open")
        .order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      return ((data || [])[0] || null) as LiveMeeting | null;
    },
  });
  useEffect(() => {
    if (!squadId) return;
    const channel = supabase
      .channel(`squad-live-meeting-${squadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_meetings", filter: `squad_id=eq.${squadId}` },
        () => qc.invalidateQueries({ queryKey: ["squad-live-meeting", squadId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squadId, qc]);
  return query;
}

export interface MeetingFile {
  id: string;
  name: string;
  kind: "sheet" | "doc";
  rows: number | null;
  cols: number | null;
  pages: number | null;
  size_bytes: number;
  truncated: boolean;
  masked: { type: string; count: number }[];
  created_at: string;
}

export const FILE_ACCEPT = ".csv,.tsv,.txt,.md,.xlsx,.xls,.xlsm,.ods,.docx,.pdf";
export const FILE_MAX_BYTES = 4 * 1024 * 1024;
export const MEETING_MAX_FILES = 5;

/** Arquivos anexados à reunião (só a lista; o conteúdo lido fica no servidor). */
export function useMeetingFiles(meetingId?: string) {
  return useQuery({
    queryKey: ["squad-meeting-files", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_meeting_files").select("id, name, kind, rows, cols, pages, size_bytes, truncated, masked, created_at")
        .eq("meeting_id", meetingId).order("created_at");
      if (error) throw error;
      return (data || []) as MeetingFile[];
    },
  });
}

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(new Error("Não consegui ler o arquivo"));
  r.readAsDataURL(file);
});

type MessagesResult = { messages: ChatMessage[]; usage?: ChatUsage };

export function useLiveMeetingActions(squadId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["squad-chat", squadId] });
    qc.invalidateQueries({ queryKey: ["squad-chat-usage", squadId] });
    qc.invalidateQueries({ queryKey: ["squad-live-meeting", squadId] });
  };
  // Junta o que a função devolveu com o que o Realtime já trouxe, sem repetir mensagens.
  const merge = (r: Partial<MessagesResult>) => {
    if (r.usage) qc.setQueryData(["squad-chat-usage", squadId], r.usage);
    if (r.messages?.length) {
      qc.setQueryData<ChatMessage[]>(["squad-chat", squadId], (old = []) => {
        const seen = new Set(old.map((m) => m.id));
        return [...old, ...r.messages!.filter((m) => !seen.has(m.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
  };

  const start = useMutation({
    mutationFn: (p: { title: string; agenda: string; participants: string[]; proactivity: Proactivity }) =>
      call<MessagesResult & { meeting: LiveMeeting }>({ action: "start", squadId, ...p }),
    onSuccess: (r) => { qc.setQueryData(["squad-live-meeting", squadId], r.meeting); merge(r); },
    onError: refresh,
  });
  const say = useMutation({
    mutationFn: (p: { meetingId: string; text: string }) => call<MessagesResult>({ action: "say", ...p }),
    onSuccess: (r) => merge(r),
    onSettled: refresh,
  });
  const control = useMutation({
    mutationFn: (p: { meetingId: string; op: "set_proactivity" | "silence" | "unsilence" | "next_item" | "dismiss_proposal" | "raise_cap" | "edit_minutes"; value?: unknown }) =>
      call<MessagesResult>({ action: "control", ...p }),
    onSuccess: (r) => merge(r),
    onSettled: refresh,
  });
  const end = useMutation({
    mutationFn: (p: { meetingId: string }) => call<MessagesResult & { fallback?: boolean }>({ action: "end", ...p }),
    onSuccess: (r) => merge(r),
    onSettled: refresh,
  });
  const uploadFile = useMutation({
    mutationFn: async (p: { meetingId: string; file: File; confirmedAnonymous?: boolean }) => {
      if (p.file.size > FILE_MAX_BYTES) throw new Error("O arquivo passa de 4 MB. Envie uma versão menor.");
      const base64 = await fileToBase64(p.file);
      return call<MessagesResult & { file: MeetingFile }>({ action: "upload_file", meetingId: p.meetingId, fileName: p.file.name, base64, confirmedAnonymous: !!p.confirmedAnonymous });
    },
    onSuccess: (r, v) => { merge(r); qc.invalidateQueries({ queryKey: ["squad-meeting-files", v.meetingId] }); },
  });
  const deleteFile = useMutation({
    mutationFn: (p: { meetingId: string; fileId: string }) => call<MessagesResult>({ action: "delete_file", ...p }),
    onSuccess: (r, v) => { merge(r); qc.invalidateQueries({ queryKey: ["squad-meeting-files", v.meetingId] }); },
  });
  /** Batimento: a diretora pode puxar a conversa se a sala ficou parada. Silencioso: erros não incomodam. */
  const tick = async (meetingId: string) => {
    try {
      const r = await call<MessagesResult & { idle?: boolean }>({ action: "tick", meetingId });
      if (!r.idle) { merge(r); qc.invalidateQueries({ queryKey: ["squad-chat-usage", squadId] }); }
    } catch { /* o próximo batimento tenta de novo */ }
  };

  return { start, say, control, end, tick, uploadFile, deleteFile };
}
