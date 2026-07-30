import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function topologicalSort(nodes: any[], edges: any[]): any[] {
  let executionOrder = [...nodes];
  if (edges && edges.length > 0) {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    nodes.forEach((n: any) => {
      inDegree.set(n.id, 0);
      adjList.set(n.id, []);
    });
    edges.forEach((e: any) => {
      inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
      adjList.get(e.source_node_id)?.push(e.target_node_id);
    });
    const queue: string[] = [];
    inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
    const sorted: string[] = [];
    while (queue.length) {
      const curr = queue.shift()!;
      sorted.push(curr);
      for (const next of adjList.get(curr) || []) {
        inDegree.set(next, (inDegree.get(next) || 0) - 1);
        if (inDegree.get(next) === 0) queue.push(next);
      }
    }
    if (sorted.length === nodes.length) {
      const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
      executionOrder = sorted.map((id) => nodeMap.get(id)!);
    }
  }
  return executionOrder;
}

export interface FlowRunResult {
  execution_id: string;
  node_results: any[];
  final_output: string;
  error?: string;
}

// Headless, single-shot execution of a flow's full sequential pipeline.
// Runs entirely server-side (no client round-trips) — used both by agent-flow-execute's
// legacy "full" mode and by the cron/webhook triggers, always on behalf of a `userId`
// resolved from the flow's own `user_id` column, never from the caller.
export async function runFlowHeadless(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceKey: string,
  flowId: string,
  userId: string,
  initialInput: string,
): Promise<FlowRunResult> {
  const [{ data: nodes, error: nodesErr }, { data: edges }] = await Promise.all([
    supabase.from("agent_flow_nodes").select("*").eq("flow_id", flowId).order("sort_order"),
    supabase.from("agent_flow_edges").select("*").eq("flow_id", flowId),
  ]);

  if (nodesErr || !nodes?.length) {
    throw new Error("Fluxo sem nós configurados");
  }

  const executionOrder = topologicalSort(nodes, edges || []);

  const nativeIds = executionOrder.filter((n: any) => n.agent_type === "native").map((n: any) => n.agent_id);
  const customIds = executionOrder.filter((n: any) => n.agent_type === "custom").map((n: any) => n.agent_id);
  const [nativeRes, customRes] = await Promise.all([
    nativeIds.length ? supabase.from("agents").select("id, name, slug").in("id", nativeIds) : { data: [] },
    customIds.length ? supabase.from("custom_agents").select("id, name").in("id", customIds) : { data: [] },
  ]);

  const agentMap = new Map<string, any>();
  (nativeRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "native" }));
  (customRes.data || []).forEach((a: any) => agentMap.set(a.id, { ...a, type: "custom" }));

  for (const node of executionOrder) {
    if (!agentMap.has(node.agent_id)) {
      throw new Error(`Agente não encontrado (agent_id: ${node.agent_id})`);
    }
  }

  const { data: execution, error: execErr } = await supabase
    .from("agent_flow_executions")
    .insert({ flow_id: flowId, user_id: userId, status: "running", initial_input: initialInput })
    .select().single();
  if (execErr) throw execErr;

  let currentInput = initialInput;
  const nodeResults: any[] = [];

  for (const node of executionOrder) {
    const agent = agentMap.get(node.agent_id);
    const agentName = agent?.name || "Agente";

    const { data: nodeResult } = await supabase
      .from("agent_flow_node_results")
      .insert({ execution_id: execution.id, node_id: node.id, input_text: currentInput, status: "running", started_at: new Date().toISOString() })
      .select().single();

    try {
      let contextMessage = currentInput;
      if (node.input_prompt) {
        contextMessage = `${node.input_prompt}\n\n---\n\nConteúdo de entrada:\n${currentInput}`;
      }

      const chatResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ agentId: node.agent_id, input: contextMessage, userId, conversationHistory: [] }),
      });

      const responseText = await chatResponse.text();
      if (!chatResponse.ok) throw new Error(`Erro do agente "${agentName}": ${responseText}`);

      let fullOutput = "";
      try { const json = JSON.parse(responseText); fullOutput = json.output || json.response || responseText; } catch { fullOutput = responseText; }
      if (!fullOutput || fullOutput.trim().length === 0) throw new Error(`Agente "${agentName}" retornou resposta vazia`);

      await supabase.from("agent_flow_node_results").update({ output_text: fullOutput, status: "completed", completed_at: new Date().toISOString() }).eq("id", nodeResult!.id);
      nodeResults.push({ node_id: node.id, agent_name: agentName, agent_id: node.agent_id, agent_type: node.agent_type, input_text: currentInput, output_text: fullOutput, status: "completed" });
      currentInput = fullOutput;
    } catch (e: any) {
      await supabase.from("agent_flow_node_results").update({ status: "error", output_text: e.message, completed_at: new Date().toISOString() }).eq("id", nodeResult!.id);
      nodeResults.push({ node_id: node.id, agent_name: agentName, agent_id: node.agent_id, agent_type: node.agent_type, input_text: currentInput, output_text: e.message, status: "error" });
      await supabase.from("agent_flow_executions").update({ status: "error", final_output: `Erro no nó "${agentName}": ${e.message}`, completed_at: new Date().toISOString() }).eq("id", execution.id);
      return { execution_id: execution.id, node_results: nodeResults, final_output: "", error: e.message };
    }
  }

  await supabase.from("agent_flow_executions").update({ status: "completed", final_output: currentInput, completed_at: new Date().toISOString() }).eq("id", execution.id);
  await supabase.from("agent_flows").update({ status: "completed" }).eq("id", flowId);

  return { execution_id: execution.id, node_results: nodeResults, final_output: currentInput };
}
