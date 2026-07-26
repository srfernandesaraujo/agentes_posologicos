import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback, logAiUsage } from "../_shared/llmProvider.ts";

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

async function evaluateAttempt(admin: any, attemptId: string) {
  const { data: attempt } = await admin
    .from("osce_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.status === "completed") return;

  const { data: station } = await admin
    .from("osce_stations").select("*").eq("id", attempt.station_id).maybeSingle();
  if (!station) return;

  // Guests never pay credits; registered users use existing logic
  let isFree = true;
  if (attempt.user_id) {
    const { data: u2 } = await admin.auth.admin.getUserById(attempt.user_id);
    const email = u2?.user?.email || "";
    const isAdmin = ADMIN_EMAILS.includes(email);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", attempt.user_id).eq("role", "admin").maybeSingle();
    isFree = isAdmin || !!roleRow;
  }
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
    const orderedKeys = await getOrderedKeysWithAdminFallback(admin, attempt.user_id || null);
    const result = await callWithFallback(admin, orderedKeys, {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      mode: "json",
    });
    if (result?.ok && result.output) {
      try { parsed = JSON.parse(result.output); } catch { /* ignore */ }
      if (attempt.user_id) {
        await logAiUsage(admin, {
          userId: attempt.user_id,
          provider: result.provider!,
          model: result.model!,
          tokensInput: result.tokensInput,
          tokensOutput: result.tokensOutput,
          promptType: "osce-evaluate",
        });
      }
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

  if (!isFree && cost > 0 && attempt.user_id) {
    try {
      await admin.rpc("spend_credits", {
        p_user_id: attempt.user_id,
        p_amount: cost,
        p_description: `OSCE (sessão ao vivo): ${station.title}`,
      });
    } catch (e: any) {
      // Insufficient balance (or other error): don't block the live exam for other
      // participants — just don't take this one negative. Reflect the real amount
      // charged (0) instead of the nominal station cost.
      console.warn(`OSCE live charge skipped for user ${attempt.user_id}: ${e?.message || e}`);
      await admin.from("osce_attempts").update({ credits_charged: 0 }).eq("id", attemptId);
    }
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
    .from("osce_session_participants")
    .select("user_id, guest_token, guest_email, guest_name")
    .eq("session_id", sessionId);

  const now = new Date().toISOString();
  for (const p of participants || []) {
    const { data: att } = await admin.from("osce_attempts").insert({
      user_id: p.user_id || null,
      guest_token: p.guest_token || null,
      guest_email: p.guest_email || null,
      guest_name: p.guest_name || null,
      station_id: stationId, exam_id: session.exam_id,
      session_id: sessionId, status: "in_progress", transcript: [], started_at: now,
    }).select("id").single();
    const filter = admin.from("osce_session_participants")
      .update({ current_attempt_id: att.id })
      .eq("session_id", sessionId);
    if (p.user_id) await filter.eq("user_id", p.user_id);
    else await filter.eq("guest_token", p.guest_token);
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

    // Lazy auth: only fetch the user if a token is present (guests have none)
    let user: any = null;
    if (authHeader && authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: u } = await userClient.auth.getUser();
      user = u?.user || null;
    }

    // ========= Public actions (no auth required) =========
    if (action === "join") {
      const pin = String(body.pin || "").trim();
      const guestName = String(body.guestName || "").trim();
      const guestEmail = String(body.guestEmail || "").trim().toLowerCase();
      if (!pin) return json({ error: "PIN obrigatório" }, 400);
      const { data: session } = await admin.from("osce_exam_sessions")
        .select("*").eq("pin", pin).neq("status", "finished").maybeSingle();
      if (!session) return json({ error: "Sessão não encontrada ou finalizada" }, 404);

      let participantUserId: string | null = null;
      let guestToken: string | null = null;
      if (user) {
        participantUserId = user.id;
        await admin.from("osce_session_participants").upsert({
          session_id: session.id, user_id: user.id,
          display_name: user.email,
        }, { onConflict: "session_id,user_id" });
      } else {
        if (!guestName || !guestEmail) return json({ error: "Nome e e-mail obrigatórios" }, 400);
        // Reuse existing guest_token if same email already joined (no upsert: partial unique index breaks PostgREST ON CONFLICT)
        const { data: existing } = await admin.from("osce_session_participants")
          .select("id, guest_token").eq("session_id", session.id).eq("guest_email", guestEmail).maybeSingle();
        if (existing) {
          guestToken = existing.guest_token;
          const { error: updErr } = await admin.from("osce_session_participants")
            .update({ guest_name: guestName, display_name: guestName })
            .eq("id", existing.id);
          if (updErr) return json({ error: `Falha ao atualizar participante: ${updErr.message}` }, 500);
        } else {
          guestToken = crypto.randomUUID();
          const { error: insErr } = await admin.from("osce_session_participants").insert({
            session_id: session.id, user_id: null,
            guest_token: guestToken, guest_email: guestEmail, guest_name: guestName,
            display_name: guestName,
          });
          if (insErr) return json({ error: `Falha ao registrar participante: ${insErr.message}` }, 500);
        }
      }

      // If session running, ensure attempt for current station
      if (session.status === "running" && session.current_station_index >= 0) {
        const { data: exStations } = await admin.from("osce_exam_stations")
          .select("station_id, order_index").eq("exam_id", session.exam_id)
          .order("order_index", { ascending: true });
        const currentStationId = exStations?.[session.current_station_index]?.station_id;
        if (currentStationId) {
          const q = admin.from("osce_attempts").select("id")
            .eq("session_id", session.id).eq("station_id", currentStationId);
          const { data: latest } = participantUserId
            ? await q.eq("user_id", participantUserId).maybeSingle()
            : await q.eq("guest_token", guestToken!).maybeSingle();
          if (!latest) {
            const { data: att } = await admin.from("osce_attempts").insert({
              user_id: participantUserId, guest_token: guestToken,
              guest_email: guestEmail || null, guest_name: guestName || null,
              station_id: currentStationId, exam_id: session.exam_id,
              session_id: session.id, status: "in_progress", transcript: [],
              started_at: session.current_station_started_at || new Date().toISOString(),
            }).select("id").single();
            const upd = admin.from("osce_session_participants")
              .update({ current_attempt_id: att.id })
              .eq("session_id", session.id);
            if (participantUserId) await upd.eq("user_id", participantUserId);
            else await upd.eq("guest_token", guestToken!);
          }
        }
      }
      return json({ sessionId: session.id, guestToken });
    }

    if (action === "state") {
      const sessionId = String(body.sessionId || "");
      const guestToken = body.guestToken ? String(body.guestToken) : null;
      const { data: session } = await admin.from("osce_exam_sessions")
        .select("id, exam_id, pin, status, current_station_index, current_station_started_at, started_at, finished_at")
        .eq("id", sessionId).maybeSingle();
      if (!session) return json({ error: "Sessão não encontrada" }, 404);
      const attemptsQ = admin.from("osce_attempts")
        .select("id, station_id, status, score, max_score, feedback, started_at, ended_at, osce_stations(title, duration_minutes)")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      const { data: attempts } = guestToken
        ? await attemptsQ.eq("guest_token", guestToken)
        : user
          ? await attemptsQ.eq("user_id", user.id)
          : { data: [] as any[] };
      const { data: exStations } = await admin.from("osce_exam_stations")
        .select("order_index, osce_stations(title, duration_minutes)")
        .eq("exam_id", session.exam_id).order("order_index", { ascending: true });
      const stations = (exStations || []).map((r: any) => r.osce_stations).filter(Boolean);
      return json({ session, attempts: attempts || [], stations });
    }

    if (action === "attempt") {
      const attemptId = String(body.attemptId || "");
      const guestToken = body.guestToken ? String(body.guestToken) : null;
      const { data: attempt } = await admin.from("osce_attempts")
        .select("*").eq("id", attemptId).maybeSingle();
      if (!attempt) return json({ error: "Tentativa não encontrada" }, 404);
      const okUser = user && attempt.user_id === user.id;
      const okGuest = guestToken && attempt.guest_token === guestToken;
      if (!okUser && !okGuest) return json({ error: "Sem permissão" }, 403);
      const { data: station } = await admin.from("osce_stations")
        .select("*").eq("id", attempt.station_id).maybeSingle();
      return json({ attempt, station });
    }

    if (action === "save-transcript") {
      const attemptId = String(body.attemptId || "");
      const guestToken = body.guestToken ? String(body.guestToken) : null;
      const transcript = Array.isArray(body.transcript) ? body.transcript : [];
      const { data: attempt } = await admin.from("osce_attempts")
        .select("id, user_id, guest_token").eq("id", attemptId).maybeSingle();
      if (!attempt) return json({ error: "Tentativa não encontrada" }, 404);
      const okUser = user && attempt.user_id === user.id;
      const okGuest = guestToken && attempt.guest_token === guestToken;
      if (!okUser && !okGuest) return json({ error: "Sem permissão" }, 403);
      await admin.from("osce_attempts").update({ transcript }).eq("id", attemptId);
      return json({ ok: true });
    }

    // ========= Authenticated actions below =========
    if (!user) return json({ error: "Não autenticado" }, 401);

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
      await Promise.all((attempts || []).map((a: any) => evaluateAttempt(admin, a.id)));

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