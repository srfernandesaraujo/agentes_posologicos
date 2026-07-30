import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "LearnLead <noreply@agentes-ai.posologia.app>";
const VALID_ROLES = ["teacher", "student"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const callerId = userData.user?.id;
    if (!callerId) throw new Error("Not authenticated");

    const { institutionId, email, role } = await req.json();
    if (!institutionId || typeof institutionId !== "string") throw new Error("institutionId é obrigatório");
    if (!VALID_ROLES.includes(role)) throw new Error("role deve ser 'teacher' ou 'student'");
    if (!email || typeof email !== "string") throw new Error("Email é obrigatório");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim()) || email.trim().length > 254) throw new Error("Formato de email inválido");
    const normalizedEmail = email.trim().toLowerCase();

    // Only an institution_admin of this specific institution (or a global app admin) may invite.
    const { data: isInstAdmin } = await supabaseAdmin.rpc("has_institution_role", {
      _user_id: callerId, _institution_id: institutionId, _role: "institution_admin",
    });
    const { data: isGlobalAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isInstAdmin && !isGlobalAdmin) throw new Error("Not authorized — apenas administradores da instituição");

    // Ensure the user exists in auth (create with a throwaway password if needed).
    const tempPassword = crypto.randomUUID();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
    });
    let targetUserId = created?.user?.id;
    if (createError) {
      if (!createError.message.includes("already been registered") && !createError.message.includes("already exists")) {
        throw createError;
      }
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      targetUserId = list.users.find((u) => u.email?.toLowerCase() === normalizedEmail)?.id;
    }
    if (!targetUserId) throw new Error("Não foi possível localizar/criar o usuário");

    const { error: memberError } = await supabaseAdmin
      .from("institution_members")
      .upsert({ institution_id: institutionId, user_id: targetUserId, role }, { onConflict: "institution_id,user_id" });
    if (memberError) throw memberError;

    // Recovery link doubles as an invite/sign-in link for both new and existing accounts.
    const origin = "https://agentes-ai.posologia.app";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${origin}/redefinir-senha?invited=true` },
    });
    if (linkError) throw linkError;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      const roleLabel = role === "teacher" ? "professor(a)" : "aluno(a)";
      const signupUrl = linkData?.properties?.action_link || `${origin}/signup`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [normalizedEmail],
        subject: "Você foi convidado para uma instituição no LearnLead! 🎓",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; padding: 40px 32px;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 8px;">Você foi convidado!</h1>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">
              Você foi convidado como <strong>${roleLabel}</strong> em uma instituição no LearnLead.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signupUrl}"
                 style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #0ea5e9); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600;">
                Acessar minha conta
              </a>
            </div>
            <p style="color: #999; font-size: 13px; line-height: 1.5;">
              Se você não esperava este convite, pode ignorar este email com segurança.
            </p>
          </div>
        `,
      });
    }

    return new Response(JSON.stringify({ success: true, userId: targetUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
