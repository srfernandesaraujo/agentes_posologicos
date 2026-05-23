import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  tags: string[];
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectItemType =
  | "conversation"
  | "flow"
  | "knowledge_base"
  | "meeting"
  | "certificate";

export type ProjectItemRow = {
  id: string;
  project_id: string;
  item_type: ProjectItemType;
  item_id: string;
  added_by: string;
  added_at: string;
};

export type CollaboratorRow = {
  id: string;
  project_id: string;
  user_email: string;
  role: "viewer" | "editor";
  invited_by: string;
  created_at: string;
};

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectRow[];
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects" as any)
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProjectRow | null;
    },
  });
}

export function useProjectItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-items", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_items" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectItemRow[];
    },
  });
}

export function useProjectCollaborators(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-collaborators", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CollaboratorRow[];
    },
  });
}

export function useCreateProject() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; color?: string; icon?: string; tags?: string[] }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("projects" as any)
        .insert({
          user_id: user.id,
          name: payload.name,
          description: payload.description || "",
          color: payload.color || "#14b8a6",
          icon: payload.icon || "FolderKanban",
          tags: payload.tags || [],
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar projeto"),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProjectRow> }) => {
      const { error } = await supabase.from("projects" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto excluído");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });
}

export function useAddProjectItem() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { projectId: string; itemType: ProjectItemType; itemId: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("project_items" as any).insert({
        project_id: payload.projectId,
        item_type: payload.itemType,
        item_id: payload.itemId,
        added_by: user.id,
      } as any);
      if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-items", vars.projectId] });
      toast.success("Adicionado ao projeto");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });
}

export function useRemoveProjectItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_items" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-items"] });
    },
  });
}

export function useAddCollaborator() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { projectId: string; email: string; role: "viewer" | "editor" }) => {
      if (!user) throw new Error("Não autenticado");
      const email = payload.email.trim().toLowerCase();
      const { error } = await supabase.from("project_collaborators" as any).insert({
        project_id: payload.projectId,
        user_email: email,
        role: payload.role,
        invited_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["project-collaborators", vars.projectId] });
      toast.success("Colaborador adicionado. Ele verá o projeto ao acessar a conta.");
    },
    onError: (e: any) => {
      if (e.message?.toLowerCase().includes("duplicate")) {
        toast.error("Este email já é colaborador");
      } else {
        toast.error(e.message || "Erro ao adicionar colaborador");
      }
    },
  });
}

export function useRemoveCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_collaborators" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-collaborators"] });
      toast.success("Colaborador removido");
    },
  });
}