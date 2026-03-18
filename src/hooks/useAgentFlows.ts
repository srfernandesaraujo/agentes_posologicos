import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AgentFlow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: string;
  execution_mode: string;
  created_at: string;
  updated_at: string;
}

export interface AgentFlowNode {
  id: string;
  flow_id: string;
  agent_id: string;
  agent_type: string;
  position_x: number;
  position_y: number;
  sort_order: number;
  input_prompt: string;
  is_synthesizer: boolean;
  created_at: string;
  // joined
  agent_name?: string;
  agent_icon?: string;
}

export interface AgentFlowEdge {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
}

export function useAgentFlows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agent-flows", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_flows")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as AgentFlow[];
    },
    enabled: !!user,
  });
}

export function useAgentFlow(flowId: string | undefined) {
  return useQuery({
    queryKey: ["agent-flow", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_flows")
        .select("*")
        .eq("id", flowId!)
        .single();
      if (error) throw error;
      return data as AgentFlow;
    },
    enabled: !!flowId,
  });
}

export function useFlowNodes(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow-nodes", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_flow_nodes")
        .select("*")
        .eq("flow_id", flowId!)
        .order("sort_order");
      if (error) throw error;
      return data as AgentFlowNode[];
    },
    enabled: !!flowId,
  });
}

export function useFlowEdges(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow-edges", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_flow_edges")
        .select("*")
        .eq("flow_id", flowId!);
      if (error) throw error;
      return data as AgentFlowEdge[];
    },
    enabled: !!flowId,
  });
}

export function useCreateFlow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("agent_flows")
        .insert({ user_id: user!.id, name: params.name, description: params.description || "" })
        .select()
        .single();
      if (error) throw error;
      return data as AgentFlow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-flows"] }),
  });
}

export function useDeleteFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (flowId: string) => {
      const { error } = await supabase.from("agent_flows").delete().eq("id", flowId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-flows"] }),
  });
}

export function useAddFlowNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      flow_id: string;
      agent_id: string;
      agent_type: string;
      position_x: number;
      position_y: number;
      sort_order: number;
      input_prompt?: string;
    }) => {
      const { data, error } = await supabase
        .from("agent_flow_nodes")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data as AgentFlowNode;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-nodes", vars.flow_id] }),
  });
}

export function useUpdateFlowNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; flow_id: string; position_x?: number; position_y?: number; sort_order?: number; input_prompt?: string }) => {
      const { id, flow_id, ...updates } = params;
      const { error } = await supabase.from("agent_flow_nodes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-nodes", vars.flow_id] }),
  });
}

export function useDeleteFlowNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; flow_id: string }) => {
      const { error } = await supabase.from("agent_flow_nodes").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["flow-nodes", vars.flow_id] });
      qc.invalidateQueries({ queryKey: ["flow-edges", vars.flow_id] });
    },
  });
}

export function useAddFlowEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { flow_id: string; source_node_id: string; target_node_id: string }) => {
      const { data, error } = await supabase.from("agent_flow_edges").insert(params).select().single();
      if (error) throw error;
      return data as AgentFlowEdge;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-edges", vars.flow_id] }),
  });
}

export function useDeleteFlowEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; flow_id: string }) => {
      const { error } = await supabase.from("agent_flow_edges").delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-edges", vars.flow_id] }),
  });
}
