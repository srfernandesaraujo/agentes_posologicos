import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ResearchInterest {
  id: string;
  user_id: string;
  terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useResearchInterests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["research-interests", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_research_interests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ResearchInterest[];
    },
    enabled: !!user,
  });

  const addInterest = useMutation({
    mutationFn: async (terms: string) => {
      const { error } = await (supabase as any)
        .from("user_research_interests")
        .insert({ user_id: user!.id, terms: terms.trim() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-interests"] }),
  });

  const toggleInterest = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("user_research_interests")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-interests"] }),
  });

  const deleteInterest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("user_research_interests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-interests"] }),
  });

  return { ...query, addInterest, toggleInterest, deleteInterest };
}
