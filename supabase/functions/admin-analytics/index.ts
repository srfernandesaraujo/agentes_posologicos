import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    // Get Stripe data
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Active subscriptions
    const activeSubscriptions = await stripe.subscriptions.list({ status: "active", limit: 100 });
    const canceledSubscriptions = await stripe.subscriptions.list({ status: "canceled", limit: 100 });

    // Count by product
    const subsByProduct: Record<string, number> = {};
    for (const sub of activeSubscriptions.data) {
      const productId = sub.items.data[0]?.price?.product as string;
      subsByProduct[productId] = (subsByProduct[productId] || 0) + 1;
    }

    // MRR calculation
    let mrrCents = 0;
    for (const sub of activeSubscriptions.data) {
      const price = sub.items.data[0]?.price;
      if (price?.recurring?.interval === "month") {
        mrrCents += price.unit_amount || 0;
      }
    }

    // Recent charges for revenue
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const recentCharges = await stripe.charges.list({ created: { gte: thirtyDaysAgo }, limit: 100 });
    let revenueThisMonth = 0;
    for (const charge of recentCharges.data) {
      if (charge.paid && !charge.refunded) {
        revenueThisMonth += charge.amount;
      }
    }

    // DB analytics
    // Total users
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });

    // Users last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newUsersWeek } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // Total credits consumed (usage type, negative amounts)
    const { data: usageData } = await supabase
      .from("credits_ledger")
      .select("amount, description, created_at")
      .eq("type", "usage");

    const totalCreditsUsed = (usageData || []).reduce((sum, r) => sum + Math.abs(r.amount), 0);

    // Agent usage breakdown
    const agentUsage: Record<string, number> = {};
    for (const row of usageData || []) {
      const match = row.description?.match(/Uso: (.+?)( \(|$)/);
      const agentName = match ? match[1] : "Desconhecido";
      agentUsage[agentName] = (agentUsage[agentName] || 0) + 1;
    }

    // Usage last 30 days by day
    const usageLast30: Record<string, number> = {};
    for (const row of usageData || []) {
      const date = row.created_at.slice(0, 10);
      if (new Date(date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        usageLast30[date] = (usageLast30[date] || 0) + 1;
      }
    }

    // Credits purchased
    const { data: purchaseData } = await supabase
      .from("credits_ledger")
      .select("amount")
      .in("type", ["purchase", "subscription"]);
    const totalCreditsPurchased = (purchaseData || []).reduce((sum, r) => sum + r.amount, 0);

    // Chat sessions count
    const { count: totalSessions } = await supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true });

    // Custom agents count
    const { count: totalCustomAgents } = await supabase
      .from("custom_agents")
      .select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      stripe: {
        activeSubscriptions: activeSubscriptions.data.length,
        canceledSubscriptions: canceledSubscriptions.data.length,
        subscriptionsByProduct: subsByProduct,
        mrrCents,
        revenueThisMonthCents: revenueThisMonth,
      },
      users: {
        total: totalUsers || 0,
        newThisWeek: newUsersWeek || 0,
      },
      usage: {
        totalCreditsUsed,
        totalCreditsPurchased,
        totalSessions: totalSessions || 0,
        totalCustomAgents: totalCustomAgents || 0,
        agentUsage,
        dailyUsage: usageLast30,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-ANALYTICS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
