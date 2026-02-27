import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  knowledge_base_id: string;
  user_id: string;
  name: string;
  type: string;
  content: string;
  url: string | null;
  file_path: string | null;
  status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useKnowledgeBases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["knowledge-bases", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_bases" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as KnowledgeBase[];
    },
    enabled: !!user,
  });

  const createKB = useMutation({
    mutationFn: async (kb: { name: string; description: string; is_public?: boolean }) => {
      const { data, error } = await supabase
        .from("knowledge_bases" as any)
        .insert({ user_id: user!.id, name: kb.name, description: kb.description, is_public: kb.is_public || false })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KnowledgeBase;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] }),
  });

  const updateKB = useMutation({
    mutationFn: async ({ id, name, description, is_public }: { id: string; name: string; description: string; is_public?: boolean }) => {
      const { data, error } = await supabase
        .from("knowledge_bases" as any)
        .update({ name, description, is_public: is_public ?? false })
        .eq("id", id)
        .eq("user_id", user!.id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KnowledgeBase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base"] });
    },
  });

  const deleteKB = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_bases" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["agent-knowledge-bases"] });
    },
  });

  return { ...query, createKB, updateKB, deleteKB };
}

export function useKnowledgeBase(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["knowledge-base", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_bases" as any)
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as unknown as KnowledgeBase;
    },
    enabled: !!id && !!user,
  });
}

export function useKnowledgeSources(kbId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["knowledge-sources", kbId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_sources" as any)
        .select("*")
        .eq("knowledge_base_id", kbId!)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as KnowledgeSource[];
    },
    enabled: !!kbId && !!user,
  });

  const createSource = useMutation({
    mutationFn: async (source: {
      knowledge_base_id: string;
      name: string;
      type: string;
      content?: string;
      url?: string;
      file_path?: string;
    }) => {
      const { data, error } = await supabase
        .from("knowledge_sources" as any)
        .insert({
          ...source,
          user_id: user!.id,
          status: "ready",
          content: source.content || "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as KnowledgeSource;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] }),
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_sources" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] }),
  });

  return { ...query, createSource, deleteSource };
}
