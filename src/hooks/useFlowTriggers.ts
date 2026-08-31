import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FlowTriggerType = "cron" | "webhook";
export type FlowTriggerFrequency = "hourly" | "daily" | "weekly";

export interface AgentFlowTrigger {
  id: string;
  flow_id: string;
  trigger_type: FlowTriggerType;
  enabled: boolean;
  default_input: string;
  frequency: FlowTriggerFrequency | null;
  run_hour: number | null;
  run_day_of_week: number | null;
  last_run_at: string | null;
  webhook_token: string | null;
  room_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useFlowTriggers(flowId: string | undefined) {
  return useQuery({
    queryKey: ["flow-triggers", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_flow_triggers")
        .select("*")
        .eq("flow_id", flowId!);
      if (error) throw error;
      return data as AgentFlowTrigger[];
    },
    enabled: !!flowId,
  });
}

export function useUpsertFlowTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      flow_id: string;
      trigger_type: FlowTriggerType;
      enabled: boolean;
      default_input?: string;
      frequency?: FlowTriggerFrequency | null;
      run_hour?: number | null;
      run_day_of_week?: number | null;
      room_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("agent_flow_triggers")
        .upsert(params, { onConflict: "flow_id,trigger_type" })
        .select()
        .single();
      if (error) throw error;
      return data as AgentFlowTrigger;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-triggers", vars.flow_id] }),
  });
}

export function useRegenerateWebhookToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { trigger_id: string; flow_id: string }) => {
      const { data, error } = await supabase.rpc("regenerate_flow_webhook_token", {
        p_trigger_id: params.trigger_id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["flow-triggers", vars.flow_id] }),
  });
}
