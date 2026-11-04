import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/invokeFunction";
import { useAuth } from "@/contexts/AuthContext";

// Tipos locais: as colunas da Fase 1 (memory, context, trigger, squad_schedules) só entram em
// types.ts quando ele for regerado depois da migração, então as consultas passam por `any`.
export interface FormField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  isBriefing?: boolean;
}

export interface SquadTemplateInfo {
  slug: string;
  name: string;
  kind: "mission" | "continuous";
  sensitivity: "normal" | "dados_pessoais" | "dados_saude";
  environment: string;
  defaultCapUsd: number;
  maxCapUsd: number;
  estimatedCostUsd: { min: number; max: number };
  formFields: FormField[];
  agents: { slug: string; name: string; role: string; room: string }[];
}

export interface Squad {
  id: string;
  owner_id: string;
  template_slug: string;
  name: string;
  kind: "mission" | "continuous";
  sensitivity: "normal" | "dados_pessoais" | "dados_saude";
  environment: string;
  default_cost_cap_usd: number;
  memory: string;
  created_at: string;
}

export interface SquadAgent {
  id: string;
  squad_id: string;
  slug: string;
  name: string;
  role: string;
  room: string;
  sort_order: number;
}

export type MissionStatus = "running" | "paused" | "awaiting_approval" | "completed" | "failed" | "cancelled";

export interface SquadMission {
  id: string;
  squad_id: string;
  briefing: string;
  form_data: Record<string, string>;
  status: MissionStatus;
  cost_cap_usd: number;
  cost_usd: number;
  tokens_input: number;
  tokens_output: number;
  trigger: "manual" | "schedule";
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SquadTask {
  id: string;
  mission_id: string;
  agent_id: string;
  position: number;
  title: string;
  status: "pending" | "running" | "done" | "failed";
}

export interface SquadEvent {
  id: number;
  mission_id: string;
  agent_id: string | null;
  type: string;
  text: string | null;
  room: string | null;
  payload: Record<string, any>;
  created_at: string;
}

export interface SquadDeliverable {
  id: string;
  mission_id: string;
  agent_id: string | null;
  title: string;
  kind: string;
  version: number;
  status: "done" | "in_review" | "approved" | "changes_requested";
  content: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export interface SquadSchedule {
  id: string;
  squad_id: string;
  enabled: boolean;
  frequency: "daily" | "weekly";
  run_hour: number;
  run_day_of_week: number | null;
  form_data: Record<string, string>;
  cost_cap_usd: number;
  monthly_cap_usd: number;
  last_run_at: string | null;
}

const db = supabase as any;
const call = <T = any>(body: Record<string, unknown>) => invokeFunction<T>("squad-engine", body);

export function useSquadTemplates() {
  return useQuery({
    queryKey: ["squad-templates"],
    queryFn: async () => (await call<{ templates: SquadTemplateInfo[] }>({ action: "list_templates" })).templates,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSquads() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["squads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from("squads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Squad[];
    },
  });
}

export function useSquad(squadId?: string) {
  return useQuery({
    queryKey: ["squad", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const [{ data: squad, error }, { data: agents }] = await Promise.all([
        db.from("squads").select("*").eq("id", squadId).maybeSingle(),
        db.from("squad_agents").select("*").eq("squad_id", squadId).order("sort_order"),
      ]);
      if (error) throw error;
      return { squad: squad as Squad | null, agents: (agents || []) as SquadAgent[] };
    },
  });
}

export function useSquadMissions(squadId?: string) {
  return useQuery({
    queryKey: ["squad-missions", squadId],
    enabled: !!squadId,
    queryFn: async () => {
      const { data, error } = await db.from("squad_missions").select("*").eq("squad_id", squadId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as SquadMission[];
    },
  });
}

export function useSquadSchedule(squadId?: string, enabled = true) {
  return useQuery({
    queryKey: ["squad-schedule", squadId],
    enabled: !!squadId && enabled,
    queryFn: async () => {
      const { data, error } = await db.from("squad_schedules").select("*").eq("squad_id", squadId).maybeSingle();
      if (error) throw error;
      return (data || null) as SquadSchedule | null;
    },
  });
}

export function useMissionDetail(missionId?: string) {
  return useQuery({
    queryKey: ["squad-mission", missionId],
    enabled: !!missionId,
    queryFn: async () => {
      const [m, t, d, e] = await Promise.all([
        db.from("squad_missions").select("*").eq("id", missionId).maybeSingle(),
        db.from("squad_tasks").select("id, mission_id, agent_id, position, title, status").eq("mission_id", missionId).order("position"),
        db.from("squad_deliverables").select("*").eq("mission_id", missionId).order("created_at"),
        db.from("squad_events").select("*").eq("mission_id", missionId).order("id", { ascending: false }).limit(300),
      ]);
      if (m.error) throw m.error;
      return {
        mission: m.data as SquadMission | null,
        tasks: (t.data || []) as SquadTask[],
        deliverables: (d.data || []) as SquadDeliverable[],
        events: (e.data || []) as SquadEvent[],
      };
    },
  });
}

/** Atualiza a tela em tempo real quando o motor grava eventos, entregas ou muda o status da missão. */
export function useMissionRealtime(missionId?: string, squadId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!missionId) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["squad-mission", missionId] });
      if (squadId) qc.invalidateQueries({ queryKey: ["squad-missions", squadId] });
    };
    const channel = supabase
      .channel(`squad-mission-${missionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_events", filter: `mission_id=eq.${missionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_deliverables", filter: `mission_id=eq.${missionId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_missions", filter: `id=eq.${missionId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [missionId, squadId, qc]);
}

/**
 * Faz a missão andar enquanto a página está aberta: chama run_all até não haver mais tarefas.
 * Se a página fechar no meio, o agendador (squad-cron-tick) retoma a missão depois.
 */
export async function driveMission(missionId: string): Promise<{ state: string }> {
  let last: { state: string; hasMore?: boolean } = { state: "task_done", hasMore: true };
  for (let i = 0; i < 12 && last.hasMore; i++) {
    last = await call({ action: "run_all", missionId });
  }
  return last;
}

export function useSquadActions() {
  const qc = useQueryClient();
  const invalidate = (squadId?: string) => {
    qc.invalidateQueries({ queryKey: ["squads"] });
    if (squadId) {
      qc.invalidateQueries({ queryKey: ["squad", squadId] });
      qc.invalidateQueries({ queryKey: ["squad-missions", squadId] });
      qc.invalidateQueries({ queryKey: ["squad-schedule", squadId] });
    }
  };

  return {
    createSquad: useMutation({
      mutationFn: (v: { templateSlug: string; name?: string }) => call<{ squad: Squad }>({ action: "create_squad", ...v }),
      onSuccess: () => invalidate(),
    }),
    startMission: useMutation({
      mutationFn: (v: { squadId: string; formData: Record<string, string>; costCapUsd: number }) =>
        call<{ mission: SquadMission; piiFindings: { type: string; count: number }[] }>({ action: "start_mission", ...v }),
      onSuccess: (_d, v) => invalidate(v.squadId),
    }),
    decide: useMutation({
      mutationFn: (v: { missionId: string; squadId: string; decision: "approve" | "changes"; comment?: string }) =>
        call<{ status: string }>({ action: "decide", missionId: v.missionId, decision: v.decision, comment: v.comment }),
      onSuccess: (_d, v) => { invalidate(v.squadId); qc.invalidateQueries({ queryKey: ["squad-mission", v.missionId] }); },
    }),
    raiseCap: useMutation({
      mutationFn: (v: { missionId: string; squadId: string; costCapUsd: number }) =>
        call({ action: "raise_cap", missionId: v.missionId, costCapUsd: v.costCapUsd }),
      onSuccess: (_d, v) => { invalidate(v.squadId); qc.invalidateQueries({ queryKey: ["squad-mission", v.missionId] }); },
    }),
    updateMemory: useMutation({
      mutationFn: (v: { squadId: string; memory: string }) => call({ action: "update_memory", ...v }),
      onSuccess: (_d, v) => invalidate(v.squadId),
    }),
    setSchedule: useMutation({
      mutationFn: (v: {
        squadId: string; enabled: boolean; frequency: "daily" | "weekly"; runHour: number; runDayOfWeek: number | null;
        formData: Record<string, string>; costCapUsd: number; monthlyCapUsd: number;
      }) => call({ action: "set_schedule", ...v }),
      onSuccess: (_d, v) => invalidate(v.squadId),
    }),
    deleteSquad: useMutation({
      mutationFn: async (squadId: string) => {
        const { error } = await db.from("squads").delete().eq("id", squadId);
        if (error) throw error;
      },
      onSuccess: () => invalidate(),
    }),
  };
}
