import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "srfernandesaraujo@gmail.com";
const FROM_EMAIL = "Agentes Posológicos <noreply@agentes-ai.posologia.app>";
const APP_URL = Deno.env.get("APP_URL") || "https://agentes-ai.posologia.app";

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  tecnico: "Técnico",
  cobranca: "Cobrança",
  bug: "Bug",
  sugestao: "Sugestão",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailShell(title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#ffffff; padding: 32px;">
      <h2 style="color:#1a1a2e; margin-bottom: 16px;">${title}</h2>
      ${bodyHtml}
      <div style="text-align:center; margin: 24px 0;">
        <a href="${ctaUrl}" style="display:inline-block; background: linear-gradient(135deg, #14b8a6, #0ea5e9); color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:10px; font-size:14px; font-weight:600;">${ctaLabel}</a>
      </div>
      <hr style="border:none; border-top:1px solid #eee; margin: 24px 0;" />
      <p style="color:#bbb; font-size:12px;">Agentes Posológicos — Suporte</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdminFlag } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = !!isAdminFlag;

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action || "create";
    const resend = resendKey ? new Resend(resendKey) : null;

    async function notifyUser(userId: string, title: string, message: string, link: string) {
      await admin.from("notifications").insert({ user_id: userId, type: "info", title, message, link });
    }

    if (action === "create") {
      const subject = String(body?.subject || "").trim();
      const category = String(body?.category || "geral");
      const message = String(body?.message || "").trim();
      if (!subject) return json({ error: "Assunto é obrigatório" }, 400);
      if (!message) return json({ error: "Mensagem é obrigatória" }, 400);
      if (subject.length > 200) return json({ error: "Assunto muito longo (máx 200 caracteres)" }, 400);
      if (message.length > 5000) return json({ error: "Mensagem muito longa (máx 5000 caracteres)" }, 400);
      if (!(category in CATEGORY_LABELS)) return json({ error: "Categoria inválida" }, 400);

      const { data: ticket, error: ticketErr } = await admin.from("support_tickets").insert({
        user_id: user.id, subject, category, status: "open", last_message_from: "user",
      }).select().single();
      if (ticketErr) return json({ error: ticketErr.message }, 500);

      const { error: msgErr } = await admin.from("support_ticket_messages").insert({
        ticket_id: ticket.id, sender_id: user.id, sender_role: "user", message,
      });
      if (msgErr) return json({ error: msgErr.message }, 500);

      if (resend) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: [ADMIN_EMAIL],
            reply_to: user.email,
            subject: `[Suporte] Novo chamado: ${subject}`,
            html: emailShell(
              "Novo chamado de suporte",
              `<p style="color:#555;font-size:14px;"><strong>De:</strong> ${escapeHtml(user.email || "")}</p>
               <p style="color:#555;font-size:14px;"><strong>Categoria:</strong> ${CATEGORY_LABELS[category]}</p>
               <p style="color:#333;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>`,
              `${APP_URL}/admin?tab=suporte&ticket=${ticket.id}`,
              "Ver chamado no painel",
            ),
          });
        } catch (e) {
          console.error("[support-ticket] email send failed:", e);
        }
      }

      return json({ ticket });
    }

    if (action === "reply") {
      const ticketId = String(body?.ticketId || "");
      const message = String(body?.message || "").trim();
      if (!ticketId || !message) return json({ error: "ticketId e message são obrigatórios" }, 400);
      if (message.length > 5000) return json({ error: "Mensagem muito longa (máx 5000 caracteres)" }, 400);

      const { data: ticket } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
      if (!ticket) return json({ error: "Chamado não encontrado" }, 404);
      if (!isAdmin && ticket.user_id !== user.id) return json({ error: "Sem permissão" }, 403);
      if (!isAdmin && ticket.status === "closed") return json({ error: "Este chamado está encerrado" }, 400);

      const senderRole = isAdmin ? "admin" : "user";
      const { error: msgErr } = await admin.from("support_ticket_messages").insert({
        ticket_id: ticketId, sender_id: user.id, sender_role: senderRole, message,
      });
      if (msgErr) return json({ error: msgErr.message }, 500);

      await admin.from("support_tickets").update({
        last_message_at: new Date().toISOString(),
        last_message_from: senderRole,
        status: senderRole === "admin" && ticket.status === "open" ? "in_progress" : ticket.status,
      }).eq("id", ticketId);

      if (senderRole === "admin") {
        await notifyUser(ticket.user_id, `Resposta no chamado: ${ticket.subject}`, message.slice(0, 200), "/suporte");
      } else if (resend) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: [ADMIN_EMAIL],
            reply_to: user.email,
            subject: `[Suporte] Nova resposta: ${ticket.subject}`,
            html: emailShell(
              "Nova resposta do cliente",
              `<p style="color:#555;font-size:14px;"><strong>De:</strong> ${escapeHtml(user.email || "")}</p>
               <p style="color:#333;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>`,
              `${APP_URL}/admin?tab=suporte&ticket=${ticketId}`,
              "Ver chamado no painel",
            ),
          });
        } catch (e) {
          console.error("[support-ticket] email send failed:", e);
        }
      }

      return json({ ok: true });
    }

    if (action === "update-status") {
      if (!isAdmin) return json({ error: "Sem permissão" }, 403);
      const ticketId = String(body?.ticketId || "");
      const status = String(body?.status || "");
      if (!["open", "in_progress", "closed"].includes(status)) return json({ error: "Status inválido" }, 400);

      const { data: ticket } = await admin.from("support_tickets").select("*").eq("id", ticketId).maybeSingle();
      if (!ticket) return json({ error: "Chamado não encontrado" }, 404);

      const { error } = await admin.from("support_tickets").update({ status }).eq("id", ticketId);
      if (error) return json({ error: error.message }, 500);

      if (status === "closed" && ticket.status !== "closed") {
        await notifyUser(ticket.user_id, "Chamado encerrado", `Seu chamado "${ticket.subject}" foi marcado como resolvido.`, "/suporte");
      }

      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e: any) {
    console.error("support-ticket error:", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});
