import Stripe from "https://esm.sh/stripe@18.5.0";

export type PlanTier = "none" | "basico" | "pro" | "institucional";

// Single source of truth for Stripe product -> plan tier. Mirrors the maps in
// stripe-webhook/index.ts (SUBSCRIPTION_CREDITS) and src/hooks/useSubscription.ts
// (SUBSCRIPTION_TIERS) — keep all three in sync if prices are ever rotated.
export const PRODUCT_TIER: Record<string, PlanTier> = {
  prod_U1QUUwFaiMvahz: "basico",
  prod_U1QUeqz6YtFUib: "pro",
  prod_U1QUXJ141hfnYw: "institucional",
};

const TIER_RANK: Record<PlanTier, number> = { none: 0, basico: 1, pro: 2, institucional: 3 };

export function tierAtLeast(tier: PlanTier, min: PlanTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

// Looks up the caller's active Stripe subscription (by email) and returns their plan tier.
// Live-checked against Stripe on every call — no cached/stale "current plan" column involved.
export async function getActivePlanTier(stripe: Stripe, email: string): Promise<PlanTier> {
  if (!email) return "none";
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) return "none";
  const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
  if (subs.data.length === 0) return "none";
  const productId = subs.data[0].items.data[0]?.price?.product as string | undefined;
  return (productId && PRODUCT_TIER[productId]) || "none";
}
