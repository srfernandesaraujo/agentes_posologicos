import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TO_EMAIL = "sergio.araujo@ufrn.br";
const FROM_EMAIL = "LearnLead <noreply@agentes-ai.posologia.app>";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Not authenticated");

    const userEmail = userData.user.email;
    const { subject, message } = await req.json();

    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      throw new Error("Assunto é obrigatório");
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new Error("Mensagem é obrigatória");
    }
    if (subject.length > 200) throw new Error("Assunto muito longo (máx 200 caracteres)");
    if (message.length > 5000) throw new Error("Mensagem muito longa (máx 5000 caracteres)");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(resendKey);

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: userEmail,
      subject: `[Contato LearnLead] ${subject.trim()}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px;">
          <h2 style="color: #1a1a2e; margin-bottom: 16px;">Nova mensagem de contato</h2>
          <p style="color: #555; font-size: 14px;"><strong>De:</strong> ${escapeHtml(userEmail || '')}</p>
          <p style="color: #555; font-size: 14px;"><strong>Assunto:</strong> ${escapeHtml(subject.trim())}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="color: #333; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(message.trim())}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 12px;">Enviado via formulário de contato do LearnLead</p>
        </div>
      `,
    });

    if (emailError) throw new Error(`Erro ao enviar: ${JSON.stringify(emailError)}`);

    return new Response(JSON.stringify({ success: true }), {
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
