import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AgentSkill {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  category: string;
  prompt_snippet: string;
  icon: string;
  is_global: boolean;
  created_at: string;
}

export interface AgentActiveSkill {
  id: string;
  agent_id: string;
  skill_id: string;
  user_id: string;
  sort_order: number;
  created_at: string;
}

export function useAgentSkills() {
  return useQuery({
    queryKey: ["agent-skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_skills" as any)
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return data as unknown as AgentSkill[];
    },
  });
}

export function useAgentActiveSkills(agentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-active-skills", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_active_skills" as any)
        .select("*")
        .eq("agent_id", agentId!)
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as AgentActiveSkill[];
    },
    enabled: !!agentId && !!user,
  });

  const toggleSkill = useMutation({
    mutationFn: async ({ skillId, active }: { skillId: string; active: boolean }) => {
      if (active) {
        // Activate
        const { error } = await supabase
          .from("agent_active_skills" as any)
          .insert({
            agent_id: agentId!,
            skill_id: skillId,
            user_id: user!.id,
            sort_order: (query.data?.length || 0),
          });
        if (error) throw error;
      } else {
        // Deactivate
        const { error } = await supabase
          .from("agent_active_skills" as any)
          .delete()
          .eq("agent_id", agentId!)
          .eq("skill_id", skillId)
          .eq("user_id", user!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-active-skills", agentId] }),
  });

  return { ...query, toggleSkill };
}
