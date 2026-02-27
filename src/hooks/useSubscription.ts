import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const SUBSCRIPTION_TIERS = {
  basico: {
    name: "Básico",
    price_id: "price_1T5EkLHVhK7c22vOUtf1MJYO",
    product_id: "prod_U3LR5lqvuJhqxF",
    credits: 30,
    price: "R$ 29,90",
  },
  pro: {
    name: "Pro",
    price_id: "price_1T5EjCHVhK7c22vOExlpcHoq",
    product_id: "prod_U3LQJwX1iyo4FH",
    credits: 100,
    price: "R$ 59,90",
  },
  institucional: {
    name: "Institucional",
    price_id: "price_1T5EktHVhK7c22vOcS5KZyuR",
    product_id: "prod_U3LRmBcPJe3JYb",
    credits: 300,
    price: "R$ 149,90",
  },
} as const;

export type TierKey = keyof typeof SUBSCRIPTION_TIERS;

export function getTierByProductId(productId: string | null): TierKey | null {
  if (!productId) return null;
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.product_id === productId) return key as TierKey;
  }
  return null;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data as {
        subscribed: boolean;
        product_id: string | null;
        price_id: string | null;
        subscription_end: string | null;
      };
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const tier = getTierByProductId(data?.product_id ?? null);

  return {
    subscribed: data?.subscribed ?? false,
    tier,
    tierInfo: tier ? SUBSCRIPTION_TIERS[tier] : null,
    subscriptionEnd: data?.subscription_end ?? null,
    refetch,
    isLoading,
  };
}
