import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM_EMAIL = "LearnLead <noreply@agentes-ai.posologia.app>";

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

    // Check if already in unlimited_users (allow resend)
    const { data: existing } = await supabaseAdmin
      .from("unlimited_users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();
    const isResend = !!existing;

    // Ensure user exists in auth - create if needed
    // Always use the published/custom domain to ensure redirect URL is allowed by Supabase
    const origin = "https://agentes-ai.posologia.app";
    
    // Try to create the user first (with a random password they'll reset)
    const tempPassword = crypto.randomUUID();
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });
    
    if (createError && !createError.message.includes("already been registered") && !createError.message.includes("already exists")) {
      throw createError;
    }

    // Now generate a recovery link so user can set their own password
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${origin}/redefinir-senha?invited=true` },
    });

    if (linkError) throw linkError;

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(resendKey);

    // Build the invite URL
    const signupUrl = linkData?.properties?.action_link || `${origin}/signup`;

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [normalizedEmail],
      subject: "Você foi convidado para o LearnLead! 🎉",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; padding: 40px 32px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 8px;">Bem-vindo ao LearnLead!</h1>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Você foi convidado para ter <strong>acesso ilimitado</strong> à nossa plataforma de agentes inteligentes para farmácia, ensino e pesquisa.
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Clique no botão abaixo para criar sua senha e começar a usar:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${signupUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #0ea5e9); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600;">
              Criar minha conta
            </a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">
            Se você não esperava este convite, pode ignorar este email com segurança.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 12px; text-align: center;">
            LearnLead — Agentes inteligentes para profissionais de saúde e educadores
          </p>
        </div>
      `,
    });

    if (emailError) throw new Error(`Erro ao enviar email: ${JSON.stringify(emailError)}`);

    // Add to unlimited_users table (skip if resend)
    if (!isResend) {
      const { error: insertError } = await supabaseAdmin
        .from("unlimited_users")
        .insert({ email: normalizedEmail, invited_by: callerId });
      if (insertError) throw insertError;
    }

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
