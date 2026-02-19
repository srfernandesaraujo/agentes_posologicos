import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CustomAgent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  provider: string;
  restrict_content: boolean;
  markdown_response: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useCustomAgents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["custom-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_agents" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CustomAgent[];
    },
    enabled: !!user,
  });

  const createAgent = useMutation({
    mutationFn: async (agent: { name: string; description: string }) => {
      const { data, error } = await supabase
        .from("custom_agents" as any)
        .insert({ user_id: user!.id, name: agent.name, description: agent.description })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CustomAgent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-agents"] }),
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomAgent> & { id: string }) => {
      const { error } = await supabase
        .from("custom_agents" as any)
        .update(updates)
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-agents"] }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("custom_agents" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-agents"] }),
  });

  return { ...query, createAgent, updateAgent, deleteAgent };
}

export function useCustomAgent(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["custom-agent", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_agents" as any)
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as unknown as CustomAgent;
    },
    enabled: !!id && !!user,
  });
}
