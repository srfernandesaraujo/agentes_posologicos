import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MarketplaceAgent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  created_at: string;
  avg_rating: number;
  review_count: number;
  creator_name?: string;
  category?: string;
}

export interface AgentReview {
  id: string;
  agent_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string;
}

export function useMarketplaceAgents() {
  return useQuery({
    queryKey: ["marketplace-agents"],
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from("custom_agents" as any)
        .select("id, user_id, name, description, model, provider, created_at")
        .eq("published_to_marketplace", true)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const agentIds = (agents as any[]).map((a: any) => a.id);
      
      let reviewStats: Record<string, { avg: number; count: number }> = {};
      if (agentIds.length > 0) {
        const { data: reviews } = await supabase
          .from("agent_reviews" as any)
          .select("agent_id, rating")
          .in("agent_id", agentIds);
        
        if (reviews) {
          for (const r of reviews as any[]) {
            if (!reviewStats[r.agent_id]) reviewStats[r.agent_id] = { avg: 0, count: 0 };
            reviewStats[r.agent_id].count++;
            reviewStats[r.agent_id].avg += r.rating;
          }
          for (const key of Object.keys(reviewStats)) {
            reviewStats[key].avg = reviewStats[key].avg / reviewStats[key].count;
          }
        }
      }

      const userIds = [...new Set((agents as any[]).map((a: any) => a.user_id))];
      let creatorNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            creatorNames[p.user_id] = p.display_name || "Usuário";
          }
        }
      }

      return (agents as any[]).map((a: any) => ({
        ...a,
        avg_rating: reviewStats[a.id]?.avg || 0,
        review_count: reviewStats[a.id]?.count || 0,
        creator_name: creatorNames[a.user_id] || "Usuário",
      })) as MarketplaceAgent[];
    },
  });
}

export function useAgentReviews(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-reviews", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_reviews" as any)
        .select("*")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((r: any) => r.user_id))];
      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            names[p.user_id] = p.display_name || "Usuário";
          }
        }
      }

      return (data as any[]).map((r: any) => ({
        ...r,
        reviewer_name: names[r.user_id] || "Usuário",
      })) as AgentReview[];
    },
    enabled: !!agentId,
  });
}

export function useSubmitReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, rating, comment }: { agentId: string; rating: number; comment?: string }) => {
      const { error } = await supabase
        .from("agent_reviews" as any)
        .upsert(
          { agent_id: agentId, user_id: user!.id, rating, comment },
          { onConflict: "agent_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["agent-reviews", vars.agentId] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-agents"] });
    },
  });
}

export function usePurchasedAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["purchased-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchased_agents" as any)
        .select("agent_id")
        .eq("buyer_id", user!.id);
      if (error) throw error;
      return new Set((data as any[]).map((d: any) => d.agent_id));
    },
    enabled: !!user,
  });
}

export function usePurchaseAgent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agent }: { agent: MarketplaceAgent }) => {
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase.functions.invoke("purchase-agent", {
        body: { agentId: agent.id },
      });

      if (error) throw new Error(error.message || "Erro ao adquirir agente");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchased-agents"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
