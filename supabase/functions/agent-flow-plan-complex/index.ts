import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrderedKeysForUser, callWithFallback, logAiUsage } from "../_shared/llmProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AgentSpec {
  name: string;
  role: string;
  receives_from?: string;
  produces?: string;
  is_router?: boolean;
  branches?: string[]; // labels declared by router
  branch?: string; // which branch this agent belongs to ('main' or label declared above)
  is_synthesizer?: boolean;
}

async function authenticateUser(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await tempClient.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const user_id = await authenticateUser(req, supabaseUrl, supabaseAnonKey);
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      flow_name,
      flow_objective,
      input_type,
      agents,
      preflight_answers,
    }: {
      flow_name: string;
      flow_objective: string;
      input_type?: string;
      agents: AgentSpec[];
      preflight_answers?: Record<string, string>;
    } = body;

    if (!flow_name || !flow_objective || !Array.isArray(agents) || agents.length < 2) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: flow_name, flow_objective e ao menos 2 agentes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (agents.length > 12) {
      return new Response(JSON.stringify({ error: "Máximo de 12 agentes por fluxo complexo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate branches
    const declaredBranches = new Set<string>(["main"]);
    for (const a of agents) {
      if (a.is_router && Array.isArray(a.branches)) {
        for (const b of a.branches) declaredBranches.add(b);
      }
    }
    if (declaredBranches.size > 6) {
      return new Response(JSON.stringify({ error: "Máximo de 5 esteiras (branches) além da principal." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const a of agents) {
      const b = a.branch || "main";
      if (!declaredBranches.has(b)) {
        return new Response(
          JSON.stringify({ error: `Agente "${a.name}" pertence à esteira "${b}" mas nenhum roteador anterior declara essa esteira.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Catalog
    const [nativeRes, customRes] = await Promise.all([
      supabase.from("agents").select("id, name, slug, description, category").eq("active", true),
      supabase.from("custom_agents").select("id, name, description").eq("user_id", user_id),
    ]);
    const nativeAgents = (nativeRes.data || []).map((a: any) => `- [NATIVO] ${a.name} (slug: ${a.slug}): ${a.description}`);
    const customAgentsList = (customRes.data || []).map((a: any) => `- [CUSTOM] ${a.name} (id: ${a.id}): ${a.description}`);
    const catalogText = [...nativeAgents, ...customAgentsList].join("\n");

    const userAgentsBlock = agents.map((a, i) => {
      const lines = [
        `### Agente ${i + 1}: ${a.name}`,
        `- Papel: ${a.role}`,
        `- Recebe de: ${a.receives_from || (i === 0 ? "input do usuário" : agents[i - 1]?.name || "etapa anterior")}`,
        `- Produz: ${a.produces || "(não especificado)"}`,
        `- Esteira: ${a.branch || "main"}`,
      ];
      if (a.is_router) lines.push(`- ROTEADOR: classifica em → ${(a.branches || []).join(", ")}`);
      if (a.is_synthesizer) lines.push(`- SINTETIZADOR FINAL: consolida saídas das esteiras`);
      return lines.join("\n");
    }).join("\n\n");

    const systemPrompt = `Você é um ARQUITETO PREMIUM de fluxos complexos de agentes de IA com roteamento condicional (esteiras paralelas).

CATÁLOGO DE AGENTES DISPONÍVEIS:
${catalogText || "(nenhum agente no catálogo — crie todos como novos)"}

## TAREFA

O usuário descreveu, agente por agente, um pipeline complexo. Para cada agente, decida:
1. Reaproveitar um agente existente (native/custom) ou criar um novo (agent_type="new").
2. Gerar um system prompt PREMIUM (500-1000 palavras) com as seções <OBJETIVO>, <INSTRUCOES>, <FORMATO_SAIDA>, <REGRAS>, <LIMITACOES>.
3. Preservar exatamente o branch_key informado pelo usuário e o flag is_router/is_synthesizer.
4. Para agentes ROTEADORES, o prompt DEVE instruir o agente a, ao final, devolver UM ÚNICO bloco JSON no formato:
   \`\`\`json
   { "branch": "<um dos rótulos declarados>" }
   \`\`\`
   Quando houver múltiplos itens (ex.: linhas de planilha), o agente deve devolver:
   \`\`\`json
   { "branches": [{ "item": "...", "branch": "..." }] }
   \`\`\`
5. Para agentes em esteira (branch != "main"), o prompt deve assumir que recebe os itens roteados para AQUELA esteira específica.
6. Para o sintetizador final, o prompt deve consolidar as saídas de TODAS as esteiras em um único entregável para o gestor.

## PREFLIGHT QUESTIONS
Se faltar info crítica para gerar prompts excelentes, retorne em "preflight_questions". Caso contrário, retorne array vazio.

## REGRAS
- Idioma de resposta dos agentes: pt-BR.
- Use Markdown tables para dados estruturados (NUNCA dentro de \`\`\`).
- Não faça perguntas durante a execução; produza conteúdo completo e definitivo.
- A ORDEM dos nós retornados DEVE ser idêntica à ordem dos agentes informados pelo usuário.

RESPONDA APENAS com a tool call create_complex_flow_plan.`;

    const userMessage = `OBJETIVO DO FLUXO: ${flow_objective}\nTIPO DE INPUT: ${input_type || "texto"}\n\nAGENTES (em ordem):\n\n${userAgentsBlock}${
      preflight_answers
        ? `\n\n--- INFORMAÇÕES ADICIONAIS DO USUÁRIO ---\n${Object.entries(preflight_answers).map(([q, a]) => `Pergunta: ${q}\nResposta: ${a}`).join("\n\n")}`
        : ""
    }`;

    const orderedKeys = await getOrderedKeysForUser(supabase, user_id);
    const aiResult = await callWithFallback(supabase, orderedKeys, {
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      mode: "tools",
      tools: [{
        type: "function",
        function: {
          name: "create_complex_flow_plan",
          description: "Plano de fluxo complexo com roteamento condicional",
          parameters: {
            type: "object",
            properties: {
              preflight_questions: { type: "array", items: { type: "string" } },
              nodes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    agent_id: { type: "string", description: "id/slug existente ou 'CREATE_NEW'" },
                    agent_type: { type: "string", enum: ["native", "custom", "new"] },
                    input_prompt: { type: "string", description: "Instrução curta de contexto neste nó" },
                    new_agent_name: { type: "string" },
                    new_agent_description: { type: "string" },
                    new_agent_prompt: { type: "string", description: "Prompt PREMIUM 500-1000 palavras" },
                    branch_key: { type: "string", description: "Rótulo da esteira ('main' ou um dos branches do roteador)" },
                    is_router: { type: "boolean" },
                    router_branches: { type: "array", items: { type: "string" } },
                    is_synthesizer: { type: "boolean" },
                  },
                  required: ["agent_type", "input_prompt", "new_agent_prompt", "branch_key", "is_router", "is_synthesizer"],
                  additionalProperties: false,
                },
              },
            },
            required: ["preflight_questions", "nodes"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "create_complex_flow_plan" } },
    });

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada ou todas falharam. Configure uma chave em Configurações." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await logAiUsage(supabase, {
      userId: user_id,
      provider: aiResult.provider!,
      model: aiResult.model!,
      tokensInput: aiResult.tokensInput,
      tokensOutput: aiResult.tokensOutput,
      promptType: "agent-flow-plan-complex",
    });

    const plan = aiResult.toolCallArgs;
    if (!plan) throw new Error("IA não retornou plano estruturado");

    if (plan.preflight_questions?.length > 0 && !preflight_answers) {
      return new Response(JSON.stringify({
        needs_preflight: true,
        preflight_questions: plan.preflight_questions,
        plan_preview: {
          flow_name,
          execution_mode: "complex",
          node_count: plan.nodes.length,
          node_names: plan.nodes.map((n: any, i: number) => n.new_agent_name || agents[i]?.name || n.agent_id),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create the flow
    const { data: flow, error: flowErr } = await supabase
      .from("agent_flows")
      .insert({
        user_id,
        name: flow_name,
        description: flow_objective,
        execution_mode: "complex",
        input_type: input_type || null,
      })
      .select()
      .single();
    if (flowErr) throw flowErr;

    const allNative = nativeRes.data || [];
    const planNodes = plan.nodes as any[];

    // Compute layout: x by branch column, y by row inside branch
    const branchOrder: string[] = [];
    const rowByBranch: Record<string, number> = {};
    const createdNodeIds: string[] = [];

    for (let i = 0; i < planNodes.length; i++) {
      const pn = planNodes[i];
      const userSpec = agents[i] || {};
      const branchKey = pn.branch_key || userSpec.branch || "main";
      if (!branchOrder.includes(branchKey)) branchOrder.push(branchKey);
      const col = branchOrder.indexOf(branchKey);
      const row = (rowByBranch[branchKey] = (rowByBranch[branchKey] ?? -1) + 1);
      const x = 100 + col * 280;
      const y = 80 + row * 140;

      let agentId: string;
      let agentType = pn.agent_type as string;
      if (agentType === "new") {
        const { data: newAgent, error: newErr } = await supabase
          .from("custom_agents")
          .insert({
            user_id,
            name: pn.new_agent_name || userSpec.name || `Agente ${i + 1}`,
            description: pn.new_agent_description || userSpec.role || "",
            system_prompt: pn.new_agent_prompt || pn.input_prompt || "",
            status: "active",
          })
          .select()
          .single();
        if (newErr) throw newErr;
        agentId = newAgent.id;
        agentType = "custom";
      } else if (agentType === "native") {
        const found = allNative.find((a: any) => a.slug === pn.agent_id || a.id === pn.agent_id);
        agentId = found?.id || pn.agent_id;
      } else {
        agentId = pn.agent_id;
      }

      const { data: createdNode, error: nodeErr } = await supabase
        .from("agent_flow_nodes")
        .insert({
          flow_id: flow.id,
          agent_id: agentId,
          agent_type: agentType,
          position_x: x,
          position_y: y,
          sort_order: i,
          input_prompt: pn.input_prompt || "",
          is_synthesizer: pn.is_synthesizer === true,
          is_router: pn.is_router === true,
          branch_key: branchKey,
          router_branches: pn.is_router ? (pn.router_branches || userSpec.branches || []) : [],
        })
        .select()
        .single();
      if (nodeErr) throw nodeErr;
      createdNodeIds.push(createdNode.id);
    }

    // Edges:
    // - within each branch, connect node[i] -> node[i+1] (same branch)
    // - from each router, connect to FIRST node of each declared branch (edge.branch_key = label)
    // - last node of each non-main branch -> first downstream main-branch node after that branch (synthesizer)
    const nodesMeta = planNodes.map((pn, i) => ({
      id: createdNodeIds[i],
      branch: pn.branch_key || agents[i]?.branch || "main",
      is_router: pn.is_router === true,
      router_branches: (pn.router_branches || agents[i]?.branches || []) as string[],
      is_synthesizer: pn.is_synthesizer === true,
      index: i,
    }));

    // Sequential within same branch
    for (let i = 0; i < nodesMeta.length; i++) {
      const cur = nodesMeta[i];
      // find next node in same branch
      const next = nodesMeta.slice(i + 1).find((n) => n.branch === cur.branch);
      if (next && !cur.is_router) {
        await supabase.from("agent_flow_edges").insert({
          flow_id: flow.id,
          source_node_id: cur.id,
          target_node_id: next.id,
          branch_key: null,
        });
      }
    }

    // Router fan-out: connect router to first node of each branch it declares (those that come AFTER it)
    for (const router of nodesMeta.filter((n) => n.is_router)) {
      for (const label of router.router_branches) {
        const firstInBranch = nodesMeta.slice(router.index + 1).find((n) => n.branch === label);
        if (firstInBranch) {
          await supabase.from("agent_flow_edges").insert({
            flow_id: flow.id,
            source_node_id: router.id,
            target_node_id: firstInBranch.id,
            branch_key: label,
          });
        }
      }
    }

    // Branch convergence: last node of each non-main branch -> next main-branch node downstream
    const nonMainBranches = Array.from(new Set(nodesMeta.filter((n) => n.branch !== "main").map((n) => n.branch)));
    for (const b of nonMainBranches) {
      const nodesInBranch = nodesMeta.filter((n) => n.branch === b);
      const last = nodesInBranch[nodesInBranch.length - 1];
      const downstreamMain = nodesMeta.slice(last.index + 1).find((n) => n.branch === "main");
      if (downstreamMain) {
        await supabase.from("agent_flow_edges").insert({
          flow_id: flow.id,
          source_node_id: last.id,
          target_node_id: downstreamMain.id,
          branch_key: null,
        });
      }
    }

    return new Response(
      JSON.stringify({ flow_id: flow.id, execution_mode: "complex", node_count: nodesMeta.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("Complex flow plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});