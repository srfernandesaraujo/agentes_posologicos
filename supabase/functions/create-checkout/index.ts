import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CREDIT_PACKS: Record<string, { priceId: string; credits: number }> = {
  "10": { priceId: "price_1T5ElfHVhK7c22vOK419Q270", credits: 10 },
  "30": { priceId: "price_1T5EmGHVhK7c22vO43jrwsCZ", credits: 30 },
  "100": { priceId: "price_1T5EmmHVhK7c22vOXIm9mNNy", credits: 100 },
};

const SUBSCRIPTION_PRICES: Record<string, string> = {
  "basico": "price_1T5EkLHVhK7c22vOUtf1MJYO",
  "pro": "price_1T5EjCHVhK7c22vOExlpcHoq",
  "institucional": "price_1T5EktHVhK7c22vOcS5KZyuR",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { packKey, planKey } = await req.json();
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://learn-lead-engine.lovable.app";

    // Handle subscription checkout
    if (planKey) {
      const priceId = SUBSCRIPTION_PRICES[planKey];
      if (!priceId) throw new Error("Invalid plan");

      // Check if already subscribed
      if (customerId) {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subs.data.length > 0) {
          throw new Error("Você já possui uma assinatura ativa. Gerencie-a pelo portal do cliente.");
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${origin}/creditos?subscription=true`,
        cancel_url: `${origin}/creditos?canceled=true`,
        metadata: { user_id: user.id },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle credit pack checkout
    const pack = CREDIT_PACKS[packKey];
    if (!pack) throw new Error("Invalid pack");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/creditos?success=true&credits=${pack.credits}`,
      cancel_url: `${origin}/creditos?canceled=true`,
      metadata: {
        user_id: user.id,
        credits: String(pack.credits),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
