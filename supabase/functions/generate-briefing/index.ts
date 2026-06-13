import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "LearnLead <noreply@agentes-ai.posologia.app>";
const APP_URL = Deno.env.get("APP_URL") || "https://agentes-ai.posologia.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const forceUserId: string | undefined = body?.userId;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authVal = req.headers.get("Authorization") || "";
    const isCron = body?.cron === true && (
      (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      (!!anonKey && authVal === `Bearer ${anonKey}`)
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendKey);

    // Authorize: cron, manual run by the user themselves, or test trigger with explicit userId
    let targetUserIds: string[] = [];
    if (isCron) {
      const { data } = await supabase
        .from("briefing_settings")
        .select("user_id, frequency, last_sent_at")
        .eq("enabled", true);
      const now = Date.now();
      targetUserIds = (data || []).filter((s: any) => {
        if (!s.last_sent_at) return true;
        const elapsed = now - new Date(s.last_sent_at).getTime();
        const minHours = s.frequency === "weekly" ? 24 * 6 : 20;
        return elapsed > minHours * 60 * 60 * 1000;
      }).map((s: any) => s.user_id);
    } else if (forceUserId) {
      // Verify the caller is that user
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user || user.id !== forceUserId) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      targetUserIds = [forceUserId];
    } else {
      return new Response(JSON.stringify({ error: "missing userId or cron secret" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];

    for (const userId of targetUserIds) {
      try {
        // Gather user signals
        const [{ data: interests }, { data: updates }, { data: recentSessions }] = await Promise.all([
          supabase.from("user_research_interests").select("terms").eq("user_id", userId).eq("is_active", true).limit(5),
          supabase.from("system_updates").select("title, summary").order("created_at", { ascending: false }).limit(3),
          supabase.from("chat_sessions").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        ]);

        // Fetch recent PubMed for each interest (last 7d)
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        const articles: { title: string; pmid: string; interest: string }[] = [];
        for (const it of interests || []) {
          try {
            const q = encodeURIComponent(it.terms);
            const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${q}&retmode=json&retmax=3&sort=date&datetype=pdat&mindate=${fmt(weekAgo)}&maxdate=${fmt(now)}`);
            const j = await r.json();
            const pmids: string[] = j?.esearchresult?.idlist || [];
            if (pmids.length === 0) continue;
            const sumR = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`);
            const sj = await sumR.json();
            for (const pmid of pmids) {
              const t = sj?.result?.[pmid]?.title;
              if (t) articles.push({ title: t, pmid, interest: it.terms });
            }
          } catch (_) { /* ignore individual interest failures */ }
        }

        // Build briefing transcript via LLM
        const inputContext = JSON.stringify({
          interests: (interests || []).map((i: any) => i.terms),
          articles,
          systemUpdates: updates || [],
          recentSessions: recentSessions || [],
          dateLabel: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        });

        const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é o apresentador do briefing matinal Agentes Posológicos. Fale em português do Brasil, tom profissional e caloroso, ritmo natural para narração em voz, de 3 a 5 minutos quando lido (cerca de 500-800 palavras). Estruture: saudação curta com a data; novidades em pesquisa (PubMed); atualizações de protocolos/sistema; resumo de conversas pendentes do usuário; fechamento com uma sugestão prática. Não use markdown, sem títulos com #, sem listas com hífen — texto corrido em parágrafos pois será lido em voz alta. Se faltar dado em alguma seção, mencione brevemente e siga adiante." },
              { role: "user", content: `Gere o briefing com base nestes dados:\n${inputContext}` },
            ],
          }),
        });
        if (!llmResp.ok) {
          console.error("LLM error", userId, await llmResp.text());
          continue;
        }
        const llmJson = await llmResp.json();
        const transcript: string = llmJson?.choices?.[0]?.message?.content?.trim() || "";
        if (!transcript) continue;

        const title = `Briefing ${new Date().toLocaleDateString("pt-BR")}`;
        const sections = [
          { label: "Novos artigos PubMed", count: articles.length },
          { label: "Atualizações da plataforma", count: (updates || []).length },
          { label: "Conversas recentes", count: (recentSessions || []).length },
        ];

        const { data: briefing, error: insErr } = await supabase
          .from("briefings")
          .insert({ user_id: userId, title, transcript, sections, summary: transcript.slice(0, 220) })
          .select("id")
          .single();
        if (insErr) { console.error("insert err", insErr); continue; }

        // Get email
        const { data: { user: u } } = await supabase.auth.admin.getUserById(userId);
        const playerUrl = `${APP_URL}/briefing/${briefing!.id}`;
        let emailed = false;
        if (u?.email) {
          try {
            // Render the FULL transcript as HTML paragraphs (no truncation)
            const escaped = transcript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const paragraphsHtml = escaped
              .split(/\n{2,}|\r\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => `<p style="color:#333; font-size:14px; line-height:1.75; margin:0 0 14px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
              .join("");

            await resend.emails.send({
              from: FROM_EMAIL,
              to: [u.email],
              subject: `${title} — Agentes Posológicos`,
              html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background:#ffffff; padding: 40px 32px;">
                  <h1 style="color:#1a1a2e; font-size: 22px; margin-bottom: 6px;">${title}</h1>
                  <p style="color:#555; font-size: 14px; line-height: 1.6;">Seu briefing está pronto. Ouça em qualquer dispositivo com voz natural ou leia a transcrição completa abaixo.</p>
                  <div style="text-align:center; margin: 24px 0;">
                    <a href="${playerUrl}" style="display:inline-block; background: linear-gradient(135deg, #14b8a6, #0ea5e9); color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:15px; font-weight:600;">Ouvir o briefing</a>
                  </div>
                  <h3 style="color:#1a1a2e; font-size: 15px; margin: 24px 0 12px;">Transcrição completa</h3>
                  ${paragraphsHtml}
                  <p style="color:#999; font-size:11px; margin-top: 32px; border-top:1px solid #eee; padding-top:16px;">Você está recebendo este e-mail porque ativou o briefing em Minha Conta.</p>
                </div>
              `,
            });
            emailed = true;
            await supabase.from("briefings").update({ delivered_email: true }).eq("id", briefing!.id);
          } catch (e) {
            console.error("email send error", e);
          }
        }

        await supabase.from("briefing_settings").update({ last_sent_at: new Date().toISOString() }).eq("user_id", userId);

        results.push({ userId, briefingId: briefing!.id, emailed });
      } catch (e) {
        console.error("user loop error", userId, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-briefing fatal:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});