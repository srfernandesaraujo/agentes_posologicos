import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const db = supabase as any;

export interface SquadOverview {
  /** missões iniciadas neste mês, por squad */
  missionsMonth: Record<string, number>;
  /** custo (US$) deste mês, por squad */
  costMonth: Record<string, number>;
  /** última missão (ISO), por squad */
  lastMission: Record<string, string>;
  totalMissionsMonth: number;
  totalCostMonth: number;
}

/** Resumo das missões de todos os squads do usuário (RLS: só as do próprio dono). */
export function useSquadsOverview() {
  const { user } = useAuth();
  return useQuery<SquadOverview>({
    queryKey: ["squads-overview", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await db
        .from("squad_missions")
        .select("squad_id, cost_usd, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const out: SquadOverview = { missionsMonth: {}, costMonth: {}, lastMission: {}, totalMissionsMonth: 0, totalCostMonth: 0 };
      for (const m of (data || []) as { squad_id: string; cost_usd: number | string; created_at: string }[]) {
        if (!out.lastMission[m.squad_id]) out.lastMission[m.squad_id] = m.created_at;
        if (new Date(m.created_at) >= monthStart) {
          const c = Number(m.cost_usd) || 0;
          out.missionsMonth[m.squad_id] = (out.missionsMonth[m.squad_id] || 0) + 1;
          out.costMonth[m.squad_id] = (out.costMonth[m.squad_id] || 0) + c;
          out.totalMissionsMonth += 1;
          out.totalCostMonth += c;
        }
      }
      return out;
    },
  });
}
