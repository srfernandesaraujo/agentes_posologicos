import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map product IDs to monthly credits
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  "prod_U1QUUwFaiMvahz": 30,   // Básico
  "prod_U1QUeqz6YtFUib": 100,  // Pro
  "prod_U1QUXJ141hfnYw": 300,  // Institucional
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
      event = JSON.parse(body);
    }

    console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Only process one-time payment credit packs (mode=payment)
      if (session.mode === "payment") {
        const userId = session.metadata?.user_id;
        const credits = parseInt(session.metadata?.credits || "0", 10);

        if (!userId || !credits) {
          console.error("[STRIPE-WEBHOOK] Missing metadata", { userId, credits });
          return new Response(JSON.stringify({ error: "Missing metadata" }), { status: 400 });
        }

        console.log(`[STRIPE-WEBHOOK] Adding ${credits} credits to user ${userId}`);

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
      }
      // For subscription checkouts, credits are granted via invoice.paid
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const subscriptionId = invoice.subscription as string;

      if (!subscriptionId) {
        console.log("[STRIPE-WEBHOOK] invoice.paid without subscription, skipping");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Get subscription to find product
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0]?.price?.product as string;
      const credits = SUBSCRIPTION_CREDITS[productId];

      if (!credits) {
        console.error("[STRIPE-WEBHOOK] Unknown product", { productId });
        return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
      }

      // Get customer email to find user
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return new Response(JSON.stringify({ error: "Customer deleted" }), { status: 400 });
      }

      const email = (customer as Stripe.Customer).email;
      if (!email) {
        console.error("[STRIPE-WEBHOOK] Customer has no email");
        return new Response(JSON.stringify({ error: "No email" }), { status: 400 });
      }

      // Find user by email
      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email === email);
      
      if (!user) {
        console.error("[STRIPE-WEBHOOK] User not found for email", { email });
        return new Response(JSON.stringify({ error: "User not found" }), { status: 400 });
      }

      console.log(`[STRIPE-WEBHOOK] Granting ${credits} subscription credits to ${user.id}`);

      const { error } = await supabase.from("credits_ledger").insert({
        user_id: user.id,
        amount: credits,
        type: "subscription",
        description: `Créditos mensais do plano (${credits} créditos)`,
        reference_id: invoice.id,
      });

      if (error) {
        console.error("[STRIPE-WEBHOOK] DB error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      console.log("[STRIPE-WEBHOOK] Subscription credits granted successfully");
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
