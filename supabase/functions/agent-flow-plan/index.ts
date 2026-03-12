import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, user_id } = await req.json();
    if (!description || !user_id) {
      return new Response(JSON.stringify({ error: "description e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load available agents
    const [nativeRes, customRes] = await Promise.all([
      supabase.from("agents").select("id, name, slug, description, category").eq("active", true),
      supabase.from("custom_agents").select("id, name, description").eq("user_id", user_id),
    ]);

    const nativeAgents = (nativeRes.data || []).map((a: any) => `- [NATIVO] ${a.name} (slug: ${a.slug}): ${a.description}`);
    const customAgentsList = (customRes.data || []).map((a: any) => `- [CUSTOM] ${a.name} (id: ${a.id}): ${a.description}`);

    const catalogText = [...nativeAgents, ...customAgentsList].join("\n");

    const systemPrompt = `Você é um planejador de fluxos de agentes de IA. O usuário vai descrever um objetivo e você deve criar um plano de fluxo com agentes em sequência.

CATÁLOGO DE AGENTES DISPONÍVEIS:
${catalogText}

REGRAS:
1. Analise o objetivo do usuário e selecione os agentes mais adequados do catálogo.
2. Se nenhum agente existente atende a uma etapa, sugira a criação de um novo agente personalizado.
3. Retorne APENAS um JSON válido usando a tool call fornecida.
4. Ordene os agentes na sequência lógica de execução.
5. Para cada nó, inclua uma instrução extra (input_prompt) que diga ao agente como processar a entrada do nó anterior.`;

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: description },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_flow_plan",
              description: "Cria um plano de fluxo de agentes",
              parameters: {
                type: "object",
                properties: {
                  flow_name: { type: "string", description: "Nome do fluxo" },
                  flow_description: { type: "string", description: "Descrição breve do fluxo" },
                  nodes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        agent_id: { type: "string", description: "ID ou slug do agente existente, ou 'CREATE_NEW' se precisa criar" },
                        agent_type: { type: "string", enum: ["native", "custom", "new"] },
                        input_prompt: { type: "string", description: "Instrução extra para o nó" },
                        new_agent_name: { type: "string", description: "Nome do novo agente (se agent_type=new)" },
                        new_agent_description: { type: "string", description: "Descrição do novo agente (se agent_type=new)" },
                        new_agent_prompt: { type: "string", description: "Prompt de sistema do novo agente (se agent_type=new)" },
                      },
                      required: ["agent_id", "agent_type", "input_prompt"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["flow_name", "flow_description", "nodes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_flow_plan" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no gateway de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao gerar plano com IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou plano estruturado");

    const plan = JSON.parse(toolCall.function.arguments);

    // Create the flow
    const { data: flow, error: flowErr } = await supabase
      .from("agent_flows")
      .insert({ user_id, name: plan.flow_name, description: plan.flow_description })
      .select()
      .single();

    if (flowErr) throw flowErr;

    // Resolve agents and create nodes
    const allNative = nativeRes.data || [];
    const allCustom = customRes.data || [];

    for (let i = 0; i < plan.nodes.length; i++) {
      const planNode = plan.nodes[i];
      let agentId: string;
      let agentType = planNode.agent_type;

      if (agentType === "new") {
        // Create a new custom agent
        const { data: newAgent, error: newErr } = await supabase
          .from("custom_agents")
          .insert({
            user_id,
            name: planNode.new_agent_name || `Agente ${i + 1}`,
            description: planNode.new_agent_description || "",
            system_prompt: planNode.new_agent_prompt || "",
            status: "active",
          })
          .select()
          .single();

        if (newErr) throw newErr;
        agentId = newAgent.id;
        agentType = "custom";
      } else if (agentType === "native") {
        // Find by slug or id
        const found = allNative.find((a: any) => a.slug === planNode.agent_id || a.id === planNode.agent_id);
        agentId = found?.id || planNode.agent_id;
      } else {
        agentId = planNode.agent_id;
      }

      const x = 100 + (i % 3) * 250;
      const y = 80 + Math.floor(i / 3) * 140;

      const { data: createdNode } = await supabase
        .from("agent_flow_nodes")
        .insert({
          flow_id: flow.id,
          agent_id: agentId,
          agent_type: agentType,
          position_x: x,
          position_y: y,
          sort_order: i,
          input_prompt: planNode.input_prompt || "",
        })
        .select()
        .single();
    }

    // Create edges between sequential nodes
    const { data: createdNodes } = await supabase
      .from("agent_flow_nodes")
      .select("id")
      .eq("flow_id", flow.id)
      .order("sort_order");

    if (createdNodes && createdNodes.length > 1) {
      for (let i = 0; i < createdNodes.length - 1; i++) {
        await supabase.from("agent_flow_edges").insert({
          flow_id: flow.id,
          source_node_id: createdNodes[i].id,
          target_node_id: createdNodes[i + 1].id,
        });
      }
    }

    return new Response(
      JSON.stringify({ flow_id: flow.id, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Flow plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
