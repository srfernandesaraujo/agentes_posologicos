import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  try {
    const body = await req.text();
    let event: Stripe.Event;

    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature")!;
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } else {
      // Fallback: parse without verification (dev mode)
      event = JSON.parse(body);
    }

    console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);

      if (!userId || !credits) {
        console.error("[STRIPE-WEBHOOK] Missing metadata", { userId, credits });
        return new Response(JSON.stringify({ error: "Missing metadata" }), { status: 400 });
      }

      console.log(`[STRIPE-WEBHOOK] Adding ${credits} credits to user ${userId}`);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error } = await supabase.from("credits_ledger").insert({
        user_id: userId,
        amount: credits,
        type: "purchase",
        description: `Compra de ${credits} créditos via Stripe`,
        reference_id: session.id,
      });

      if (error) {
        console.error("[STRIPE-WEBHOOK] DB error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      console.log(`[STRIPE-WEBHOOK] Credits added successfully`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[STRIPE-WEBHOOK] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
});
