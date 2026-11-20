import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";

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
    mutationFn: (p: { thread: string; text: string }) => call<{ messages: ChatMessage[]; usage: ChatUsage }>({ action: "send", squadId, ...p }),
    onSuccess: (r) => {
      qc.setQueryData(["squad-chat-usage", squadId], r.usage);
      // Junta o que a função devolveu com o que já está na tela, sem repetir mensagens que o Realtime já trouxe.
      qc.setQueryData<ChatMessage[]>(["squad-chat", squadId], (old = []) => {
        const seen = new Set(old.map((m) => m.id));
        return [...old, ...r.messages.filter((m) => !seen.has(m.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    },
    onError: refresh,
  });

  const setCap = useMutation({
    mutationFn: (capUsd: number) => call<{ usage: ChatUsage }>({ action: "set_cap", squadId, capUsd }),
    onSuccess: (r) => { qc.setQueryData(["squad-chat-usage", squadId], r.usage); qc.invalidateQueries({ queryKey: ["squad", squadId] }); },
  });

  const clear = useMutation({
    mutationFn: (thread?: string) => call<{ ok: boolean }>({ action: "clear", squadId, ...(thread ? { thread } : {}) }),
    onSuccess: refresh,
  });

  return { send, setCap, clear };
}
