import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const [{ data: existingUpdates }, { data: agents }, { data: userKeys }] = await Promise.all([
      supabase
        .from("system_updates")
        .select("title, description, status, category")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("agents").select("name, category").eq("active", true),
      supabase.from("user_api_keys").select("provider, api_key_encrypted").eq("user_id", userId),
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

    const decryptedKeys: Record<string, string> = {};
    for (const key of userKeys || []) {
      try {
        const { data: decrypted } = await supabase.rpc("decrypt_api_key", { p_encrypted: key.api_key_encrypted });
        if (decrypted) decryptedKeys[key.provider] = decrypted;
      } catch {
        // ignore invalid/decryption failures
      }
    }

    let content = "";

    if (decryptedKeys.openai) {
      try {
        console.log("Trying OpenAI user key...");
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptedKeys.openai}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          content = data.choices?.[0]?.message?.content || "";
          console.log("OpenAI user key succeeded");
        } else {
          console.log("OpenAI user key failed:", response.status, await response.text());
        }
      } catch (error) {
        console.log("OpenAI user key error:", error);
      }
    }

    if (!content && decryptedKeys.groq) {
      try {
        console.log("Trying Groq user key...");
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${decryptedKeys.groq}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.8,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          content = data.choices?.[0]?.message?.content || "";
          console.log("Groq user key succeeded");
        } else {
          console.log("Groq user key failed:", response.status, await response.text());
        }
      } catch (error) {
        console.log("Groq user key error:", error);
      }
    }

    if (!content && decryptedKeys.google) {
      try {
        console.log("Trying Google user key...");
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${decryptedKeys.google}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8 },
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          console.log("Google user key succeeded");
        } else {
          console.log("Google user key failed:", response.status, await response.text());
        }
      } catch (error) {
        console.log("Google user key error:", error);
      }
    }

    if (!content) {
      if (!LOVABLE_API_KEY) throw new Error("Nenhuma API externa disponível e LOVABLE_API_KEY não configurada");

      console.log("Falling back to Lovable AI Gateway...");
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lovable Gateway error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || "";
      console.log("Lovable AI Gateway succeeded");
    }

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