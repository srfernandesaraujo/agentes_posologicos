import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const callerId = userData.user?.id;
    if (!callerId) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();
    if (!roleData) throw new Error("Not authorized - admin only");

    const { email } = await req.json();
    if (!email || typeof email !== "string") throw new Error("Email is required");

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already in unlimited_users
    const { data: existing } = await supabaseAdmin
      .from("unlimited_users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();
    if (existing) throw new Error("Este email já está cadastrado como usuário ilimitado.");

    // Use Supabase admin to invite user by email
    const origin = req.headers.get("origin") || "https://learn-lead-engine.lovable.app";
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: `${origin}/agentes`,
    });
    if (inviteError) {
      // User might already exist - that's ok, just add to unlimited_users
      if (!inviteError.message.includes("already been registered")) {
        throw inviteError;
      }
    }

    // Add to unlimited_users table
    const { error: insertError } = await supabaseAdmin
      .from("unlimited_users")
      .insert({ email: normalizedEmail, invited_by: callerId });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, email: normalizedEmail }), {
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
