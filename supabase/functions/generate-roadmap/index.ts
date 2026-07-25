import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysWithAdminFallback, callWithFallback, logAiUsage } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const parseSuggestions = (content: string) => {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found");
  return JSON.parse(jsonMatch[0]);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) throw new Error("Não autorizado");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Acesso negado: apenas administradores");

    const { data: recentItems } = await supabase
      .from("system_updates")
      .select("created_at")
      .neq("status", "released")
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentItems && recentItems.length > 0) {
      const lastCreated = new Date(recentItems[0].created_at);
      const daysSince = (Date.now() - lastCreated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        return new Response(
          JSON.stringify({
            message: `Roadmap gerado há ${Math.floor(daysSince)} dias. Próxima geração em ${Math.ceil(30 - daysSince)} dias.`,
            count: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const [{ data: existingUpdates }, { data: agents }] = await Promise.all([
      supabase
        .from("system_updates")
        .select("title, description, status, category")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("agents").select("name, category").eq("active", true),
    ]);

    const existingContext = (existingUpdates || [])
      .map((u: any) => `- [${u.status}] ${u.title}: ${u.description}`)
      .join("\n");

    const agentsContext = (agents || [])
      .map((a: any) => `- ${a.name} (${a.category})`)
      .join("\n");

    const prompt = `Você é um product manager especializado em plataformas de IA para saúde, educação e pesquisa acadêmica.

Contexto do sistema: Uma plataforma SaaS que oferece agentes de IA especializados para profissionais de saúde, professores e pesquisadores. Funcionalidades existentes incluem: chat com agentes IA, marketplace de agentes, salas virtuais, bases de conhecimento, fluxos de agentes, integração WhatsApp, transcrição de reuniões (Google Meet), sistema de créditos e assinaturas.

Agentes disponíveis:
${agentsContext}

Atualizações já existentes/implementadas:
${existingContext}

Gere exatamente 8 sugestões de novas funcionalidades ou melhorias que seriam ALTAMENTE relevantes e impactantes para esta plataforma. Cada sugestão deve ser inovadora e NÃO repetir funcionalidades já existentes.

Para cada sugestão, retorne um JSON array com objetos contendo:
- "title": título conciso (máx 50 chars)
- "description": descrição clara da funcionalidade (1-2 frases)
- "category": um de "feature", "improvement", "infrastructure"
- "priority": um de "high", "medium", "low"

Retorne APENAS o JSON array, sem markdown ou texto adicional.`;

    const orderedKeys = await getOrderedKeysWithAdminFallback(supabase, userId);
    const aiResult = await callWithFallback(supabase, orderedKeys, {
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      mode: "text",
    });
    if (!aiResult) throw new Error("Nenhuma chave de IA configurada ou todas falharam");
    await logAiUsage(supabase, {
      userId,
      provider: aiResult.provider!,
      model: aiResult.model!,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      promptType: "generate-roadmap",
    });
    const content = aiResult.output || "";

    let suggestions: any[];
    try {
      suggestions = parseSuggestions(content);
    } catch {
      throw new Error("Falha ao parsear resposta da IA: " + content.slice(0, 200));
    }

    const now = new Date().toISOString();
    const inserts = suggestions.slice(0, 8).map((s: any) => ({
      title: String(s.title || "").slice(0, 100),
      description: String(s.description || ""),
      category: ["feature", "improvement", "infrastructure", "bugfix"].includes(s.category) ? s.category : "feature",
      status: "planned",
      priority: ["high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
      release_date: null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await supabase.from("system_updates").insert(inserts);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ message: "Roadmap gerado com sucesso!", count: inserts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("generate-roadmap error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});