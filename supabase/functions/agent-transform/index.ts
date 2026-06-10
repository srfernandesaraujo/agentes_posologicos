import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRANSFORMS: Record<string, { label: string; prompt: string; cost: number }> = {
  patient: {
    label: "Material para paciente",
    cost: 1,
    prompt:
      "Reescreva o conteúdo abaixo como material educativo para o PACIENTE, em pt-BR. Use linguagem simples, analogias do cotidiano, evite jargão técnico. Estruture em: (1) O que é, (2) Como tomar (com cronograma claro em tabela), (3) Cuidados importantes, (4) Quando procurar o profissional. Tom acolhedor e direto.",
  },
  clinical_case: {
    label: "Caso clínico para estudo",
    cost: 2,
    prompt:
      "Transforme o conteúdo abaixo em um CASO CLÍNICO realista em pt-BR para treinamento de alunos. Inclua: (1) Apresentação do paciente (dados demográficos, queixa, história), (2) Exame físico e laboratoriais relevantes, (3) 3-5 perguntas de discussão, (4) Respostas/condutas esperadas em formato de gabarito ao final.",
  },
  lesson_plan: {
    label: "Plano de aula",
    cost: 2,
    prompt:
      "Transforme o conteúdo abaixo em um PLANO DE AULA em pt-BR com metodologia ativa. Inclua: (1) Objetivos de aprendizagem (verbos de Bloom), (2) Pré-aula (leitura/vídeo), (3) Atividade em sala (PBL/sala invertida, 50 min), (4) Avaliação formativa, (5) Materiais. Use tabela para o cronograma.",
  },
  quiz: {
    label: "Quiz (10 questões)",
    cost: 2,
    prompt:
      "Crie um QUIZ de 10 questões de múltipla escolha (5 alternativas, A-E) em pt-BR a partir do conteúdo abaixo. Cada questão deve ter 1 resposta correta. Ao final, apresente o GABARITO com justificativa breve de cada alternativa correta. Use níveis variados (memorização, aplicação, análise).",
  },
  whatsapp: {
    label: "Resumo para WhatsApp",
    cost: 1,
    prompt:
      "Resuma o conteúdo abaixo em um texto CURTO para envio via WhatsApp em pt-BR. Máximo 600 caracteres. Use *negrito* (WhatsApp), emojis didáticos com moderação (💊 ⚠️ ✅), quebras de linha curtas. Foque no que o destinatário precisa fazer.",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const transformKey = String(body?.transform || "");
    const content = String(body?.content || "").slice(0, 60000);
    const transform = TRANSFORMS[transformKey];
    if (!transform || !content.trim()) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check credits (unless admin/unlimited)
    const [{ data: roleRow }, { data: unlimited }] = await Promise.all([
      service.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      service.from("unlimited_users").select("user_id").eq("user_id", userId).maybeSingle(),
    ]);
    const hasFreeAccess = !!roleRow || !!unlimited;

    if (!hasFreeAccess) {
      const { data: ledger } = await service
        .from("credits_ledger")
        .select("amount")
        .eq("user_id", userId);
      const balance = (ledger || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      if (balance < transform.cost) {
        return new Response(
          JSON.stringify({ error: "insufficient_credits", required: transform.cost, balance }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente especialista em transformar conteúdo técnico de saúde/educação em outros formatos. Responda SEMPRE em pt-BR. Use Markdown. Tabelas devem ser Markdown puro (nunca dentro de blocos de código).",
          },
          {
            role: "user",
            content: `${transform.prompt}\n\n---\nCONTEÚDO ORIGINAL:\n${content}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const output = data?.choices?.[0]?.message?.content || "";

    // Debit credits
    if (!hasFreeAccess && output) {
      await service.from("credits_ledger").insert({
        user_id: userId,
        amount: -transform.cost,
        type: "usage",
        description: `Output Action: ${transform.label}`,
      });
    }

    return new Response(
      JSON.stringify({ output, cost: hasFreeAccess ? 0 : transform.cost, label: transform.label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("agent-transform error", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});