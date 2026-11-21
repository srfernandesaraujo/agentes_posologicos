import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import { awaitingCount, useTeamPulse } from "@/hooks/useTeamPulse";

/** Contagens exibidas nos itens do menu (mesmas consultas do menu antigo, mesmas chaves de cache). */
export function useNavCounts(): Record<"agents" | "conversations" | "knowledge" | "tickets" | "awaiting", number> {
  const { user } = useAuth();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: knowledgeBases = [] } = useKnowledgeBases();
  const { data: pulse } = useTeamPulse();

  const { data: conversations = 0 } = useQuery({
    queryKey: ["conversation-count", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, messages(id)")
        .eq("user_id", user!.id);
      const legacy = error ? 0 : (data || []).filter((s: any) => s.messages && s.messages.length > 0).length;
      // conversas novas vivem em salas pessoais (chat_sessions está congelado)
      const { count } = await supabase
        .from("virtual_rooms")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("room_type", "personal");
      return legacy + (count || 0);
    },
    enabled: !!user,
  });

  const { data: tickets = 0 } = useQuery({
    queryKey: ["support-tickets-pending", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("support_tickets" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("last_message_from", "admin")
        .neq("status", "closed");
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  return { agents: customAgents.length, conversations, knowledge: knowledgeBases.length, tickets, awaiting: awaitingCount(pulse) };
}
