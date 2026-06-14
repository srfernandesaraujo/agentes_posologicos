import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["srfernandesaraujo@gmail.com"];

function difficultyCost(d: string | null | undefined): number {
  if (d === "facil") return 10;
  if (d === "dificil") return 20;
  return 15;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { attemptId, guestToken } = await req.json();
    if (!attemptId) {
      return new Response(JSON.stringify({ error: "attemptId obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let user: any = null;
    if (authHeader && authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: u } = await userClient.auth.getUser();
      user = u?.user || null;
    }
    if (!user && !guestToken) {
      return new Response(JSON.stringify({ error: "Sem autenticação nem token de convidado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: attempt } = await admin
      .from("osce_attempts")
      .select("id,user_id,guest_token,station_id,transcript,started_at,credits_charged,status")
      .eq("id", attemptId)
      .maybeSingle();
    const okUser = user && attempt?.user_id === user.id;
    const okGuest = guestToken && attempt?.guest_token === guestToken;
    if (!attempt || (!okUser && !okGuest)) {
      return new Response(JSON.stringify({ error: "Tentativa inválida" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (attempt.status === "completed" && attempt.credits_charged > 0) {
      const { data: existing } = await admin.from("osce_attempts").select("*").eq("id", attemptId).maybeSingle();
      return new Response(JSON.stringify({ attempt: existing }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: station } = await admin
      .from("osce_stations")
      .select("*")
      .eq("id", attempt.station_id)
      .maybeSingle();
    if (!station) {
      return new Response(JSON.stringify({ error: "Estação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica créditos
    let isFree = true;
    if (user) {
      const { data: { user: u2 } } = await admin.auth.admin.getUserById(user.id);
      const email = u2?.email || "";
      const isAdmin = ADMIN_EMAILS.includes(email);
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      isFree = isAdmin || !!roleRow;
    }
    const cost = difficultyCost(station.difficulty);

    if (!isFree && user) {
      const { data: ledger } = await admin
        .from("credits_ledger").select("amount").eq("user_id", user.id);
      const balance = (ledger || []).reduce((s: number, r: any) => s + r.amount, 0);
      if (balance < cost) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes", required: cost, balance }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const rubric = Array.isArray(station.rubric) ? station.rubric : [];
    const transcriptText = (attempt.transcript as any[] || [])
      .map((m) => `${m.role === "patient" ? "PACIENTE" : "ALUNO"}: ${m.content}`)
      .join("\n");

    const evalPrompt = `Você é um EXAMINADOR OSCE silencioso e rigoroso. Avalie o desempenho do ALUNO na simulação abaixo.

Responda EXCLUSIVAMENTE com JSON válido seguindo o schema:
{
  "items": [{"criterion": string, "max_score": number, "score": number, "evidence": string}],
  "score": number,
  "max_score": number,
  "strengths": [string],
  "improvements": [string],
  "feedback": string
}

REGRAS:
- Use a rubrica fornecida. Para cada critério, atribua score entre 0 e max_score, e cite uma evidência curta da transcrição.
- "feedback" deve ser um parágrafo construtivo em pt-BR (300-500 chars).
- Considere empatia, perguntas-chave feitas/omitidas, condutas corretas, segurança do paciente.
- Sem markdown. Apenas JSON.

## Estação
Título: ${station.title}
Cenário: ${station.scenario_brief}

## Perguntas-chave esperadas
${JSON.stringify(station.expected_questions || [])}

## Condutas esperadas
${JSON.stringify(station.expected_conducts || [])}

## Rubrica (use os mesmos critérios)
${JSON.stringify(rubric)}

## Transcrição da consulta
${transcriptText}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: evalPrompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "Falha na avaliação", detail: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await aiRes.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}"); } catch { parsed = {}; }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const maxScore = Number(parsed.max_score) || items.reduce((s: number, i: any) => s + (Number(i.max_score) || 0), 0) || 10;
    const score = Number(parsed.score) || items.reduce((s: number, i: any) => s + (Number(i.score) || 0), 0);
    const feedback = String(parsed.feedback || "");

    const durationSec = Math.max(0, Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000));

    await admin.from("osce_attempts").update({
      status: "completed",
      ended_at: new Date().toISOString(),
      duration_seconds: durationSec,
      rubric_result: parsed,
      score,
      max_score: maxScore,
      feedback,
      credits_charged: isFree ? 0 : cost,
    }).eq("id", attemptId);

    if (!isFree && user) {
      await admin.from("credits_ledger").insert({
        user_id: user.id,
        amount: -cost,
        type: "usage",
        description: `OSCE: ${station.title}`,
      });
    }

    const { data: updated } = await admin.from("osce_attempts").select("*").eq("id", attemptId).maybeSingle();
    return new Response(JSON.stringify({ attempt: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});