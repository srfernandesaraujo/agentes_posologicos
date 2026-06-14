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

function genPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function evaluateAttempt(admin: any, apiKey: string, attemptId: string) {
  const { data: attempt } = await admin
    .from("osce_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.status === "completed") return;

  const { data: station } = await admin
    .from("osce_stations").select("*").eq("id", attempt.station_id).maybeSingle();
  if (!station) return;

  // check if free user
  const { data: u2 } = await admin.auth.admin.getUserById(attempt.user_id);
  const email = u2?.user?.email || "";
  const isAdmin = ADMIN_EMAILS.includes(email);
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", attempt.user_id).eq("role", "admin").maybeSingle();
  const isFree = isAdmin || !!roleRow;
  const cost = difficultyCost(station.difficulty);

  const transcript = Array.isArray(attempt.transcript) ? attempt.transcript : [];
  const transcriptText = transcript
    .map((m: any) => `${m.role === "patient" ? "PACIENTE" : "ALUNO"}: ${m.content}`)
    .join("\n");

  const prompt = `Você é um EXAMINADOR OSCE silencioso e rigoroso. Avalie o desempenho do ALUNO.
Responda EXCLUSIVAMENTE com JSON: {"items":[{"criterion":string,"max_score":number,"score":number,"evidence":string}],"score":number,"max_score":number,"strengths":[string],"improvements":[string],"feedback":string}
REGRAS: use a rubrica; feedback em pt-BR (300-500 chars); sem markdown.
## Estação\nTítulo: ${station.title}\nCenário: ${station.scenario_brief}
## Perguntas-chave\n${JSON.stringify(station.expected_questions || [])}
## Condutas\n${JSON.stringify(station.expected_conducts || [])}
## Rubrica\n${JSON.stringify(station.rubric || [])}
## Transcrição\n${transcriptText || "(aluno não interagiu)"}`;

  let parsed: any = {};
  try {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || "{}"); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const maxScore = Number(parsed.max_score) || items.reduce((s: number, i: any) => s + (Number(i.max_score) || 0), 0) || 10;
  const score = Number(parsed.score) || items.reduce((s: number, i: any) => s + (Number(i.score) || 0), 0);
  const feedback = String(parsed.feedback || "Atendimento encerrado pelo professor.");
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

  if (!isFree && cost > 0) {
    await admin.from("credits_ledger").insert({
      user_id: attempt.user_id, amount: -cost, type: "usage",
      description: `OSCE (sessão ao vivo): ${station.title}`,
    });
  }
}

async function startStation(admin: any, sessionId: string, stationIndex: number) {
  // Fetch ordered stations
  const { data: session } = await admin.from("osce_exam_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return { error: "Sessão não encontrada" };
  const { data: exStations } = await admin
    .from("osce_exam_stations").select("station_id, order_index")
    .eq("exam_id", session.exam_id).order("order_index", { ascending: true });
  if (!exStations?.length) return { error: "Prova sem estações" };

  if (stationIndex >= exStations.length) {
    await admin.from("osce_exam_sessions").update({
      status: "finished", finished_at: new Date().toISOString(),
      current_station_index: exStations.length,
    }).eq("id", sessionId);
    return { finished: true };
  }

  const stationId = exStations[stationIndex].station_id;
  const { data: participants } = await admin
    .from("osce_session_participants").select("user_id").eq("session_id", sessionId);

  const now = new Date().toISOString();
  for (const p of participants || []) {
    const { data: att } = await admin.from("osce_attempts").insert({
      user_id: p.user_id, station_id: stationId, exam_id: session.exam_id,
      session_id: sessionId, status: "in_progress", transcript: [], started_at: now,
    }).select("id").single();
    await admin.from("osce_session_participants")
      .update({ current_attempt_id: att.id })
      .eq("session_id", sessionId).eq("user_id", p.user_id);
  }

  await admin.from("osce_exam_sessions").update({
    status: "running", current_station_index: stationIndex, current_station_started_at: now,
    started_at: session.started_at || now,
  }).eq("id", sessionId);

  return { ok: true, stationIndex };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action as string;
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    if (action === "create") {
      const examId = body.examId as string;
      const { data: exam } = await admin.from("osce_exams").select("*").eq("id", examId).maybeSingle();
      if (!exam || exam.user_id !== user.id) return json({ error: "Prova não encontrada" }, 404);
      // Generate unique pin
      let pin = "";
      for (let i = 0; i < 5; i++) {
        const candidate = genPin();
        const { data: existing } = await admin.from("osce_exam_sessions").select("id").eq("pin", candidate).maybeSingle();
        if (!existing) { pin = candidate; break; }
      }
      if (!pin) return json({ error: "Falha ao gerar PIN" }, 500);
      const { data: session, error } = await admin.from("osce_exam_sessions").insert({
        exam_id: examId, owner_id: user.id, pin, status: "waiting", current_station_index: -1,
      }).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ session });
    }

    if (action === "join") {
      const pin = String(body.pin || "").trim();
      const displayName = body.displayName || null;
      const { data: session } = await admin.from("osce_exam_sessions")
        .select("*").eq("pin", pin).neq("status", "finished").maybeSingle();
      if (!session) return json({ error: "Sessão não encontrada ou finalizada" }, 404);
      await admin.from("osce_session_participants").upsert({
        session_id: session.id, user_id: user.id, display_name: displayName,
      }, { onConflict: "session_id,user_id" });
      // If session is already running, ensure user has an attempt for the current station
      if (session.status === "running" && session.current_station_index >= 0) {
        const { data: existing } = await admin.from("osce_attempts")
          .select("id").eq("session_id", session.id).eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const { data: exStations } = await admin.from("osce_exam_stations")
          .select("station_id, order_index").eq("exam_id", session.exam_id)
          .order("order_index", { ascending: true });
        const currentStationId = exStations?.[session.current_station_index]?.station_id;
        // If no attempt for current station, create one
        const { data: latest } = await admin.from("osce_attempts")
          .select("id, station_id").eq("session_id", session.id).eq("user_id", user.id)
          .eq("station_id", currentStationId).maybeSingle();
        if (!latest && currentStationId) {
          const { data: att } = await admin.from("osce_attempts").insert({
            user_id: user.id, station_id: currentStationId, exam_id: session.exam_id,
            session_id: session.id, status: "in_progress", transcript: [],
            started_at: session.current_station_started_at || new Date().toISOString(),
          }).select("id").single();
          await admin.from("osce_session_participants")
            .update({ current_attempt_id: att.id })
            .eq("session_id", session.id).eq("user_id", user.id);
        }
      }
      return json({ sessionId: session.id });
    }

    // Owner-only actions below
    const sessionId = body.sessionId as string;
    const { data: session } = await admin.from("osce_exam_sessions")
      .select("*").eq("id", sessionId).maybeSingle();
    if (!session || session.owner_id !== user.id) return json({ error: "Sem permissão" }, 403);

    if (action === "start") {
      const r = await startStation(admin, sessionId, 0);
      return json(r);
    }

    if (action === "next" || action === "finish") {
      // Evaluate all in-progress attempts for current station
      const { data: attempts } = await admin.from("osce_attempts")
        .select("id").eq("session_id", sessionId).eq("status", "in_progress");
      await Promise.all((attempts || []).map((a: any) => evaluateAttempt(admin, apiKey, a.id)));

      if (action === "finish") {
        await admin.from("osce_exam_sessions").update({
          status: "finished", finished_at: new Date().toISOString(),
        }).eq("id", sessionId);
        return json({ ok: true, finished: true });
      }
      const r = await startStation(admin, sessionId, (session.current_station_index ?? -1) + 1);
      return json(r);
    }

    if (action === "pause") {
      await admin.from("osce_exam_sessions").update({ status: "paused" }).eq("id", sessionId);
      return json({ ok: true });
    }
    if (action === "resume") {
      await admin.from("osce_exam_sessions").update({ status: "running" }).eq("id", sessionId);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});