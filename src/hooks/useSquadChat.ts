import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import type { SquadEvent, SquadQuestion } from "@/hooks/useSquads";

// Conversa com o Time (Fase A). As mensagens são gravadas pela função `squad-chat`; aqui só se lê (com Realtime) e se envia.
// A tabela é nova e só entra em types.ts quando ele for regerado depois da migração: as consultas passam por `any`.
export interface ChatMessage {
  id: string;
  squad_id: string;
  thread: string; // "team" ou o id do agente
  author: "user" | "agent" | "system";
  agent_id: string | null;
  content: string;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  provider: string | null;
  model: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface ChatUsage {
  spentUsd: number;
  capUsd: number;
  state: "ok" | "warn" | "exceeded";
  remainingUsd: number;
  pct: number;
}

export const TEAM_THREAD = "team";
const db = supabase as any;
const call = <T = any>(body: Record<string, unknown>) => invokeFunction<T>("squad-chat", body);
const MAX_LOADED = 600;

export function useChatMessages(squadId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squad-chat", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_chat_messages").select("*").eq("squad_id", squadId)
        .order("created_at", { ascending: false }).limit(MAX_LOADED);
      if (error) throw error;
      return ((data || []) as ChatMessage[]).reverse();
    },
  });

  // Mensagens novas (suas, dos agentes e avisos do sistema) chegam em tempo real.
  useEffect(() => {
    if (!squadId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ["squad-chat", squadId] });
    const channel = supabase
      .channel(`squad-chat-${squadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_chat_messages", filter: `squad_id=eq.${squadId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squadId, qc]);

  return query;
}

export interface CitableDeliverable {
  id: string;
  mission_id: string;
  agent_id: string | null;
  title: string;
  kind: string;
  version: number;
  created_at: string;
}

/** Entregas recentes do squad, para citar no chat (a mais nova de cada título). */
export function useCitableDeliverables(squadId?: string) {
  return useQuery({
    queryKey: ["squad-chat-deliverables", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_deliverables").select("id, mission_id, agent_id, title, kind, version, created_at")
        .eq("squad_id", squadId).order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      const seen = new Set<string>();
      const out: CitableDeliverable[] = [];
      for (const d of (data || []) as CitableDeliverable[]) {
        if (seen.has(d.title)) continue;
        seen.add(d.title);
        out.push(d);
      }
      return out.slice(0, 20);
    },
  });
}

/** Eventos do escritório que não pertencem a uma missão (quem está pensando, respondeu, reunião). Mais antigo primeiro. */
export function useChatOfficeEvents(squadId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["squad-chat-events", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_events").select("*").eq("squad_id", squadId).is("mission_id", null)
        .order("id", { ascending: false }).limit(80);
      if (error) throw error;
      return ((data || []) as SquadEvent[]).reverse();
    },
  });
  useEffect(() => {
    if (!squadId) return;
    const channel = supabase
      .channel(`squad-chat-events-${squadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_events", filter: `squad_id=eq.${squadId}` },
        () => qc.invalidateQueries({ queryKey: ["squad-chat-events", squadId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [squadId, qc]);
  return query;
}

/** Perguntas abertas do squad (de qualquer missão): aparecem também no chat. Confere de tempos em tempos. */
export function useOpenQuestions(squadId?: string) {
  return useQuery({
    queryKey: ["squad-open-questions", squadId],
    enabled: !!squadId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await db.from("squad_questions").select("*").eq("squad_id", squadId).eq("status", "open").order("created_at");
      if (error) throw error;
      return (data || []) as SquadQuestion[];
    },
  });
}

export function useChatUsage(squadId?: string) {
  return useQuery({
    queryKey: ["squad-chat-usage", squadId],
    enabled: !!squadId,
    queryFn: async () => (await call<{ usage: ChatUsage }>({ action: "usage", squadId })).usage,
  });
}

export function useChatActions(squadId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["squad-chat", squadId] });
    qc.invalidateQueries({ queryKey: ["squad-chat-usage", squadId] });
  };

  const send = useMutation({
    mutationFn: (p: { thread: string; text: string; deliverableId?: string }) => call<{ messages: ChatMessage[]; usage: ChatUsage }>({ action: "send", squadId, ...p }),
    onSuccess: (r) => {
      // Se o servidor sugeriu itens de memória, a aba Memória e os cartões do chat precisam da lista nova.
      if (r.messages.some((m) => m.meta?.memory?.items?.length)) qc.invalidateQueries({ queryKey: ["squad-memories", squadId] });
      qc.setQueryData(["squad-chat-usage", squadId], r.usage);
      // Junta o que a função devolveu com o que já está na tela, sem repetir mensagens que o Realtime já trouxe.
      qc.setQueryData<ChatMessage[]>(["squad-chat", squadId], (old = []) => {
        const seen = new Set(old.map((m) => m.id));
        return [...old, ...r.messages.filter((m) => !seen.has(m.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    },
    onError: refresh,
  });

  // Junta mensagens novas (do servidor) com as que já estão na tela e atualiza o medidor do teto.
  const merge = (r: { messages: ChatMessage[]; usage: ChatUsage }) => {
    qc.setQueryData(["squad-chat-usage", squadId], r.usage);
    qc.setQueryData<ChatMessage[]>(["squad-chat", squadId], (old = []) => {
      const seen = new Set(old.map((m) => m.id));
      return [...old, ...r.messages.filter((m) => !seen.has(m.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  };

  /**
   * Reunião: cada etapa é uma chamada (rodada 1, rodada 2, resumo), para nenhuma passar do tempo da função.
   * Com `meetingId` retoma uma reunião que parou no meio. `onStage` recebe o nome da etapa que está rodando.
   */
  const runMeeting = async (p: { question?: string; participants?: string[]; meetingId?: string }, onStage?: (label: string) => void) => {
    type R = { meetingId: string; stage: 1 | 2 | 3 | null; done: boolean; messages: ChatMessage[]; usage: ChatUsage };
    let meetingId = p.meetingId;
    try {
      if (!meetingId) {
        onStage?.("Rodada 1: posições");
        const r = await call<R>({ action: "meeting_start", squadId, question: p.question, participants: p.participants });
        merge(r);
        meetingId = r.meetingId;
        if (r.done) return;
      }
      for (let i = 0; i < 4; i++) {
        onStage?.(i === 0 && p.meetingId ? "Retomando a reunião" : i === 0 ? "Rodada 2: reações" : "Resumo da coordenação");
        const r = await call<R>({ action: "meeting_next", squadId, meetingId });
        merge(r);
        if (r.done || !r.stage) return;
      }
    } finally {
      refresh();
    }
  };

  const setCap = useMutation({
    mutationFn: (capUsd: number) => call<{ usage: ChatUsage }>({ action: "set_cap", squadId, capUsd }),
    onSuccess: (r) => { qc.setQueryData(["squad-chat-usage", squadId], r.usage); qc.invalidateQueries({ queryKey: ["squad", squadId] }); },
  });

  const clear = useMutation({
    mutationFn: (thread?: string) => call<{ ok: boolean }>({ action: "clear", squadId, ...(thread ? { thread } : {}) }),
    onSuccess: refresh,
  });

  return { send, setCap, clear, runMeeting };
}
