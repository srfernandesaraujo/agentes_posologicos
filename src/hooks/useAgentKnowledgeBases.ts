import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AgentKnowledgeBase {
  id: string;
  agent_id: string;
  knowledge_base_id: string;
  user_id: string;
  created_at: string;
}

export function useAgentKnowledgeBases(agentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-knowledge-bases", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_knowledge_bases" as any)
        .select("*")
        .eq("agent_id", agentId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AgentKnowledgeBase[];
    },
    enabled: !!agentId && !!user,
  });

  const linkKB = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      const { data, error } = await supabase
        .from("agent_knowledge_bases" as any)
        .insert({
          agent_id: agentId!,
          knowledge_base_id: knowledgeBaseId,
          user_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AgentKnowledgeBase;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-knowledge-bases", agentId] }),
  });

  const unlinkKB = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      const { error } = await supabase
        .from("agent_knowledge_bases" as any)
        .delete()
        .eq("agent_id", agentId!)
        .eq("knowledge_base_id", knowledgeBaseId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-knowledge-bases", agentId] }),
  });

  return { ...query, linkKB, unlinkKB };
}
