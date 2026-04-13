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
    const activeSubscriptions = await stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.customer"] });
    const canceledSubscriptions = await stripe.subscriptions.list({ status: "canceled", limit: 100 });

    // Count by product + gather subscriber details
    const subsByProduct: Record<string, number> = {};
    const subscriberEmails: string[] = [];
    const subscribers: Array<{ email: string; product_id: string; status: string; current_period_end: string }> = [];
    for (const sub of activeSubscriptions.data) {
      const productId = sub.items.data[0]?.price?.product as string;
      subsByProduct[productId] = (subsByProduct[productId] || 0) + 1;
      const customer = sub.customer as any;
      const email = customer?.email || customer?.id || "desconhecido";
      subscriberEmails.push(email.toLowerCase());
      let periodEnd = "";
      try {
        const ts = sub.current_period_end;
        if (ts && typeof ts === "number") {
          periodEnd = new Date(ts * 1000).toISOString();
        } else if (ts && typeof ts === "string") {
          periodEnd = ts;
        }
      } catch { /* ignore */ }
      subscribers.push({
        email,
        product_id: productId,
        status: "active",
        current_period_end: periodEnd,
      });
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
    const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newUsersWeek } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo);

    // All credits ledger for usage
    const { data: allLedger } = await supabase
      .from("credits_ledger")
      .select("user_id, amount, type, description, created_at");

    const usageData = (allLedger || []).filter(r => r.type === "usage");
    const totalCreditsUsed = usageData.reduce((sum, r) => sum + Math.abs(r.amount), 0);

    // Agent usage breakdown
    const agentUsage: Record<string, number> = {};
    for (const row of usageData) {
      const match = row.description?.match(/Uso: (.+?)( \(|$)/);
      const agentName = match ? match[1] : "Desconhecido";
      agentUsage[agentName] = (agentUsage[agentName] || 0) + 1;
    }

    // Usage last 30 days by day
    const usageLast30: Record<string, number> = {};
    for (const row of usageData) {
      const date = row.created_at.slice(0, 10);
      if (new Date(date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        usageLast30[date] = (usageLast30[date] || 0) + 1;
      }
    }

    // Credits purchased
    const purchaseData = (allLedger || []).filter(r => ["purchase", "subscription"].includes(r.type));
    const totalCreditsPurchased = purchaseData.reduce((sum, r) => sum + r.amount, 0);

    const { count: totalSessions } = await supabase
      .from("chat_sessions")
      .select("*", { count: "exact", head: true });

    const { count: totalCustomAgents } = await supabase
      .from("custom_agents")
      .select("*", { count: "exact", head: true });

    // ---- PER-USER METRICS for subscribers ----
    // Get all profiles to map email -> user_id
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, created_at");

    // Get auth users to map email -> user_id
    const { data: authUsersData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const authUsers = authUsersData?.users || [];

    // Build email -> user_id map
    const emailToUserId: Record<string, string> = {};
    for (const u of authUsers) {
      if (u.email) {
        emailToUserId[u.email.toLowerCase()] = u.id;
      }
    }

    // Build per-user credit balances and usage from ledger
    const userCreditsUsed: Record<string, number> = {};
    const userCreditsBalance: Record<string, number> = {};
    const userAgentUsage: Record<string, Record<string, number>> = {};
    const userSessionCount: Record<string, number> = {};

    for (const row of allLedger || []) {
      const uid = row.user_id;
      // Balance
      userCreditsBalance[uid] = (userCreditsBalance[uid] || 0) + row.amount;
      // Usage
      if (row.type === "usage") {
        userCreditsUsed[uid] = (userCreditsUsed[uid] || 0) + Math.abs(row.amount);
        // Agent breakdown per user
        const match = row.description?.match(/Uso: (.+?)( \(|$)/);
        const agentName = match ? match[1] : "Desconhecido";
        if (!userAgentUsage[uid]) userAgentUsage[uid] = {};
        userAgentUsage[uid][agentName] = (userAgentUsage[uid][agentName] || 0) + 1;
      }
    }

    // Get session counts per user
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("user_id");
    for (const s of sessionData || []) {
      userSessionCount[s.user_id] = (userSessionCount[s.user_id] || 0) + 1;
    }

    // Build subscriber details
    const subscriberDetails: Array<{
      email: string;
      product_id: string;
      current_period_end: string;
      user_id: string | null;
      credits_used: number;
      credits_balance: number;
      sessions_count: number;
      agents_used: Record<string, number>;
      member_since: string | null;
      last_sign_in: string | null;
    }> = [];

    for (const sub of subscribers) {
      const uid = emailToUserId[sub.email.toLowerCase()] || null;
      const authUser = authUsers.find(u => u.email?.toLowerCase() === sub.email.toLowerCase());
      const profile = uid ? (allProfiles || []).find(p => p.user_id === uid) : null;

      subscriberDetails.push({
        email: sub.email,
        product_id: sub.product_id,
        current_period_end: sub.current_period_end,
        user_id: uid,
        credits_used: uid ? (userCreditsUsed[uid] || 0) : 0,
        credits_balance: uid ? (userCreditsBalance[uid] || 0) : 0,
        sessions_count: uid ? (userSessionCount[uid] || 0) : 0,
        agents_used: uid ? (userAgentUsage[uid] || {}) : {},
        member_since: profile?.created_at || authUser?.created_at || null,
        last_sign_in: authUser?.last_sign_in_at || null,
      });
    }

    return new Response(JSON.stringify({
      stripe: {
        activeSubscriptions: activeSubscriptions.data.length,
        canceledSubscriptions: canceledSubscriptions.data.length,
        subscriptionsByProduct: subsByProduct,
        mrrCents,
        revenueThisMonthCents: revenueThisMonth,
        subscribers,
        subscriberDetails,
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
