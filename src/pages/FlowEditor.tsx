import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useAgentFlow,
  useFlowNodes,
  useFlowEdges,
  useAddFlowNode,
  useUpdateFlowNode,
  useDeleteFlowNode,
  useAddFlowEdge,
  useDeleteFlowEdge,
  AgentFlowNode,
  AgentFlowEdge,
} from "@/hooks/useAgentFlows";
import { useAgents } from "@/hooks/useAgents";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Play, Trash2, Loader2, Settings2, Search, Link2, MousePointerClick, Zap, ChevronRight, Send, SkipForward, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as LucideIcons from "lucide-react";

interface FlowStep {
  index: number;
  node_id: string;
  agent_id: string;
  agent_type: string;
  agent_name: string;
  input_prompt: string;
}

interface StepResult {
  step_index: number;
  agent_name: string;
  output: string;
  status: "completed" | "error" | "waiting_input" | "running";
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

function getIcon(iconName: string) {
  const Icon = (LucideIcons as any)[iconName] || LucideIcons.Bot;
  return Icon;
}

// Guided steps configuration
const GUIDE_STEPS = [
  {
    step: 1,
    title: "Adicione agentes",
    description: "Clique nos agentes na barra lateral esquerda para adicioná-los ao canvas.",
    icon: Plus,
    condition: (nodes: AgentFlowNode[]) => nodes.length === 0,
  },
  {
    step: 2,
    title: "Adicione mais agentes",
    description: "Adicione pelo menos 2 agentes para criar um fluxo sequencial.",
    icon: Plus,
    condition: (nodes: AgentFlowNode[], edges: AgentFlowEdge[]) => nodes.length === 1,
  },
  {
    step: 3,
    title: "Conecte os agentes",
    description: "Clique em \"Conectar Nós\" no topo, depois clique no agente de origem e no de destino.",
    icon: Link2,
    condition: (nodes: AgentFlowNode[], edges: AgentFlowEdge[]) => nodes.length >= 2 && edges.length === 0,
  },
  {
    step: 4,
    title: "Configure instruções (opcional)",
    description: "Selecione um nó e clique \"Configurar\" para adicionar instruções extras de processamento.",
    icon: Settings2,
    condition: (nodes: AgentFlowNode[], edges: AgentFlowEdge[]) => nodes.length >= 2 && edges.length > 0 && nodes.every(n => !n.input_prompt),
  },
  {
    step: 5,
    title: "Execute o fluxo!",
    description: "Tudo pronto! Clique em \"Executar\" para rodar o fluxo com sua entrada inicial.",
    icon: Zap,
    condition: (nodes: AgentFlowNode[], edges: AgentFlowEdge[]) => nodes.length >= 2 && edges.length > 0,
  },
];

// Flow Canvas Node Component
function FlowNode({
  node,
  agentName,
  agentIcon,
  isSelected,
  onSelect,
  onDragStart,
  onConnect,
  connectMode,
  isConnectSource,
}: {
  node: AgentFlowNode;
  agentName: string;
  agentIcon: string;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onConnect: () => void;
  connectMode: boolean;
  isConnectSource: boolean;
}) {
  const Icon = getIcon(agentIcon);
  return (
    <div
      className={`flex flex-col items-center gap-1 select-none group ${connectMode ? "cursor-crosshair" : "cursor-grab"}`}
      onMouseDown={(e) => {
        if (connectMode) {
          onConnect();
        } else {
          onDragStart(e);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!connectMode) onSelect();
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg transition-all ${
          isConnectSource
            ? "border-amber-400 bg-amber-400/20 shadow-amber-400/20 ring-2 ring-amber-400/40"
            : isSelected
            ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/20 shadow-[hsl(var(--accent))]/20"
            : "border-white/20 bg-[hsl(220,25%,12%)] hover:border-white/40"
        }`}
      >
        <Icon className="h-5 w-5 text-[hsl(var(--accent))]" />
        <span className="text-sm font-medium text-white max-w-[140px] truncate">{agentName}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/50">
          {node.sort_order + 1}
        </Badge>
      </div>
      {connectMode && (
        <span className="text-[10px] text-amber-300/80 font-medium">
          {isConnectSource ? "Origem selecionada" : "Clique para conectar"}
        </span>
      )}
      {node.input_prompt && !connectMode && (
        <span className="text-[10px] text-white/30 max-w-[180px] truncate">{node.input_prompt}</span>
      )}
    </div>
  );
}

// SVG Edge lines
function EdgeLines({ nodes, edges }: { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(174,62%,47%)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const src = nodeMap.get(edge.source_node_id);
        const tgt = nodeMap.get(edge.target_node_id);
        if (!src || !tgt) return null;
        const sx = src.position_x + 100;
        const sy = src.position_y + 25;
        const tx = tgt.position_x + 100;
        const ty = tgt.position_y + 25;
        const mx = (sx + tx) / 2;
        return (
          <path
            key={edge.id}
            d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
            stroke="hsl(174,62%,47%)"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

// Guide Banner Component
function GuideBanner({ nodes, edges }: { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] }) {
  const currentStep = GUIDE_STEPS.find((s) => s.condition(nodes, edges));
  if (!currentStep) return null;

  const StepIcon = currentStep.icon;
  const progress = Math.min(((currentStep.step - 1) / (GUIDE_STEPS.length - 1)) * 100, 100);

  return (
    <div className="mx-4 mt-3 mb-1">
      <div className="flex items-center gap-3 rounded-xl border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent))]/20">
          <StepIcon className="h-4 w-4 text-[hsl(var(--accent))]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[hsl(var(--accent))]">Passo {currentStep.step}/{GUIDE_STEPS.length}</span>
            <div className="flex-1 h-1 rounded-full bg-white/10 max-w-[120px]">
              <div className="h-1 rounded-full bg-[hsl(var(--accent))] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="text-sm text-white/80 mt-0.5">
            <span className="font-medium text-white">{currentStep.title}:</span> {currentStep.description}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
      </div>
    </div>
  );
}

export default function FlowEditor() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: flow } = useAgentFlow(flowId);
  const { data: nodes = [], isLoading: nodesLoading } = useFlowNodes(flowId);
  const { data: edges = [] } = useFlowEdges(flowId);
  const { data: nativeAgents = [] } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();

  const addNode = useAddFlowNode();
  const updateNode = useUpdateFlowNode();
  const deleteNode = useDeleteFlowNode();
  const addEdge = useAddFlowEdge();
  const deleteEdge = useDeleteFlowEdge();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [configMode, setConfigMode] = useState(false);

  // Execution - phased mode
  const [execOpen, setExecOpen] = useState(false);
  const [execInput, setExecInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [stepChatInput, setStepChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [execFinal, setExecFinal] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  const allAgents = [
    ...nativeAgents.map((a) => ({ ...a, agent_type: "native" as const })),
    ...customAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: "Bot",
      category: "Meus Agentes",
      agent_type: "custom" as const,
    })),
  ];

  const filteredAgents = allAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(agentSearch.toLowerCase())
  );

  const getAgentInfo = (node: AgentFlowNode) => {
    const agent = allAgents.find((a) => a.id === node.agent_id);
    return { name: agent?.name || "Agente", icon: agent?.icon || "Bot" };
  };

  // Drag handling
  const handleDragStart = (nodeId: string, e: React.MouseEvent) => {
    if (connectMode) return;
    const el = canvasRef.current?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!el || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      nodeId,
      offsetX: e.clientX - rect.left - el.offsetLeft + canvasRef.current.scrollLeft,
      offsetY: e.clientY - rect.top - el.offsetTop + canvasRef.current.scrollTop,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.max(0, e.clientX - rect.left - dragRef.current.offsetX + canvasRef.current.scrollLeft);
      const newY = Math.max(0, e.clientY - rect.top - dragRef.current.offsetY + canvasRef.current.scrollTop);
      const el = canvasRef.current.querySelector(`[data-node-id="${dragRef.current.nodeId}"]`) as HTMLElement | null;
      if (el) {
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = async () => {
      if (!dragRef.current || !canvasRef.current) return;
      const nodeId = dragRef.current.nodeId;
      const el = canvasRef.current.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
      if (el) {
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        await updateNode.mutateAsync({ id: nodeId, flow_id: flowId!, position_x: x, position_y: y });
      }
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [flowId, updateNode]);

  // Add agent to canvas
  const handleAddAgent = async (agentId: string, agentType: string) => {
    if (!flowId) return;
    const nextOrder = nodes.length;
    const x = 100 + (nextOrder % 3) * 280;
    const y = 80 + Math.floor(nextOrder / 3) * 140;
    try {
      await addNode.mutateAsync({
        flow_id: flowId,
        agent_id: agentId,
        agent_type: agentType,
        position_x: x,
        position_y: y,
        sort_order: nextOrder,
      });
      if (nextOrder === 0) {
        toast.success("Agente adicionado! Adicione mais para criar o fluxo.");
      } else if (nextOrder === 1 && edges.length === 0) {
        toast.success("Ótimo! Agora conecte os agentes clicando em \"Conectar Nós\".");
      }
    } catch {
      toast.error("Erro ao adicionar agente");
    }
  };

  // Connect nodes
  const handleNodeConnect = (nodeId: string) => {
    if (!connectSource) {
      setConnectSource(nodeId);
      toast.info("Agora clique no nó de destino para criar a conexão");
    } else {
      if (connectSource === nodeId) {
        setConnectSource(null);
        toast.info("Seleção cancelada. Clique em outro nó.");
        return;
      }
      // Check for existing edge
      const exists = edges.some(e => e.source_node_id === connectSource && e.target_node_id === nodeId);
      if (exists) {
        toast.warning("Esses nós já estão conectados!");
        setConnectSource(null);
        setConnectMode(false);
        return;
      }
      addEdge.mutateAsync({ flow_id: flowId!, source_node_id: connectSource, target_node_id: nodeId });
      toast.success("Conexão criada! Você pode adicionar mais conexões ou clicar \"Cancelar Conexão\".");
      setConnectSource(null);
      // Stay in connect mode for easy chaining
    }
  };

  // Delete selected node
  const handleDeleteNode = async () => {
    if (!selectedNodeId || !flowId) return;
    await deleteNode.mutateAsync({ id: selectedNodeId, flow_id: flowId });
    setSelectedNodeId(null);
    setConfigOpen(false);
  };

  // Node config
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const openConfig = () => {
    if (!selectedNode) return;
    setEditPrompt(selectedNode.input_prompt || "");
    setConfigOpen(true);
  };

  const saveConfig = async () => {
    if (!selectedNode || !flowId) return;
    await updateNode.mutateAsync({ id: selectedNode.id, flow_id: flowId, input_prompt: editPrompt });
    setConfigOpen(false);
  };

  // Phased execution: init → step-by-step with chat
  const handleExecute = async () => {
    if (!flowId || !execInput.trim()) return;
    setExecuting(true);
    setStepResults([]);
    setFlowSteps([]);
    setCurrentStepIndex(-1);
    setExecFinal("");
    setExecutionId(null);

    try {
      // Step 1: Init execution - get ordered steps
      const { data, error } = await supabase.functions.invoke("agent-flow-execute", {
        body: { mode: "init", flow_id: flowId, initial_input: execInput },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setExecutionId(data.execution_id);
      setFlowSteps(data.steps);

      // Start executing first step
      await executeStep(0, data.steps, data.execution_id, execInput);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar execução");
      setExecuting(false);
    }
  };

  const executeStep = async (
    stepIndex: number,
    steps: FlowStep[],
    execId: string,
    inputText: string,
    history: Array<{ role: "user" | "assistant"; content: string }> = []
  ) => {
    if (stepIndex >= steps.length) {
      // All steps done
      const lastResult = stepResults[stepResults.length - 1] || null;
      const finalOutput = lastResult?.output || inputText;
      setExecFinal(finalOutput);
      setExecuting(false);
      setCurrentStepIndex(-1);

      // Mark execution complete
      await supabase.functions.invoke("agent-flow-execute", {
        body: { mode: "complete", execution_id: execId, final_output: finalOutput, flow_id: flowId },
      });
      toast.success("Fluxo concluído com sucesso!");
      return;
    }

    const step = steps[stepIndex];
    setCurrentStepIndex(stepIndex);

    // Build input with input_prompt if present
    let contextMessage = inputText;
    if (step.input_prompt) {
      contextMessage = `${step.input_prompt}\n\n---\n\nConteúdo de entrada:\n${inputText}`;
    }

    // Get previous stage output for context chaining
    const prevResult = stepIndex > 0 ? stepResults.find(r => r.step_index === stepIndex - 1) : null;
    const previousStageOutput = prevResult?.output || "";

    // Add running placeholder
    setStepResults((prev) => [
      ...prev.filter((r) => r.step_index !== stepIndex),
      {
        step_index: stepIndex,
        agent_name: step.agent_name,
        output: "",
        status: "running",
        chatHistory: history,
      },
    ]);

    try {
      const { data, error } = await supabase.functions.invoke("agent-flow-execute", {
        body: {
          mode: "step",
          execution_id: execId,
          node_id: step.node_id,
          agent_id: step.agent_id,
          input_text: contextMessage,
          conversation_history: history,
          previous_stage_output: previousStageOutput,
          stage_number: stepIndex + 1,
          total_stages: steps.length,
        },
      });

      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error || data.output);

      const output = data.output;

      setStepResults((prev) =>
        prev.map((r) =>
          r.step_index === stepIndex
            ? {
                ...r,
                output,
                status: "completed",
                chatHistory: [...history, { role: "assistant" as const, content: output }],
              }
            : r
        )
      );

      // Always auto-continue to next step (no question detection in flow mode)
      await executeStep(stepIndex + 1, steps, execId, output, []);
    } catch (e: any) {
      setStepResults((prev) =>
        prev.map((r) =>
          r.step_index === stepIndex
            ? { ...r, output: e.message, status: "error", chatHistory: history }
            : r
        )
      );
      setExecuting(false);
      toast.error(`Erro na etapa ${stepIndex + 1}: ${e.message}`);
    }
  };

  // Handle user reply within a step
  const handleStepChatReply = async (stepIndex: number) => {
    if (!stepChatInput.trim() || !executionId || !flowSteps[stepIndex]) return;
    const step = flowSteps[stepIndex];
    const currentResult = stepResults.find((r) => r.step_index === stepIndex);
    if (!currentResult) return;

    setSendingChat(true);
    const userMessage = stepChatInput.trim();
    setStepChatInput("");

    const priorHistory = currentResult.chatHistory;
    const optimisticHistory = [
      ...priorHistory,
      { role: "user" as const, content: userMessage },
    ];

    setStepResults((prev) =>
      prev.map((r) =>
        r.step_index === stepIndex
          ? { ...r, chatHistory: optimisticHistory, status: "running" }
          : r
      )
    );

    try {
      const currentResult = stepResults.find((r) => r.step_index === stepIndex);
      const previousStageOutput = stepIndex > 0 ? stepResults.find(r => r.step_index === stepIndex - 1)?.output || "" : "";

      const { data, error } = await supabase.functions.invoke("agent-flow-execute", {
        body: {
          mode: "step",
          execution_id: executionId,
          node_id: step.node_id,
          agent_id: step.agent_id,
          input_text: userMessage,
          conversation_history: priorHistory,
          previous_stage_output: previousStageOutput,
          stage_number: stepIndex + 1,
          total_stages: flowSteps.length,
        },
      });

      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error || data.output);

      const output = data.output;
      const newHistory = [...optimisticHistory, { role: "assistant" as const, content: output }];

      setStepResults((prev) =>
        prev.map((r) =>
          r.step_index === stepIndex
            ? { ...r, output, status: "completed", chatHistory: newHistory }
            : r
        )
      );

      // Auto-advance to next step
      setExecuting(true);
      await executeStep(stepIndex + 1, flowSteps, executionId, output, []);
    } catch (e: any) {
      setStepResults((prev) =>
        prev.map((r) =>
          r.step_index === stepIndex
            ? { ...r, status: "waiting_input" }
            : r
        )
      );
      toast.error(e.message || "Erro ao enviar resposta");
    } finally {
      setSendingChat(false);
    }
  };

  // Continue to next step after chat
  const handleContinueToNextStep = async (stepIndex: number) => {
    const currentResult = stepResults.find((r) => r.step_index === stepIndex);
    if (!currentResult || !executionId) return;

    // Mark current step as completed
    setStepResults((prev) =>
      prev.map((r) =>
        r.step_index === stepIndex ? { ...r, status: "completed" } : r
      )
    );

    setExecuting(true);
    // Use last assistant output as input for next step
    await executeStep(stepIndex + 1, flowSteps, executionId, currentResult.output, []);
  };

  if (!flow) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-white/40" /></div>;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fluxos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">{flow.name}</h1>
            {flow.description && <p className="text-xs text-white/40">{flow.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1 ${
              connectMode
                ? "border-amber-400 bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 hover:text-amber-200"
                : "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            }`}
            onClick={() => {
              setConnectMode(!connectMode);
              setConnectSource(null);
              if (!connectMode) {
                toast.info("Modo conexão ativado! Clique no nó de origem primeiro.");
              }
            }}
          >
            <Link2 className="h-4 w-4" />
            {connectMode ? "Cancelar Conexão" : "Conectar Nós"}
          </Button>
          {nodes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={`gap-1 ${configMode ? "border-amber-400/50 bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 hover:text-amber-200" : "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}`}
              onClick={() => {
                if (selectedNodeId) {
                  openConfig();
                } else {
                  setConfigMode(!configMode);
                  setConnectMode(false);
                  if (!configMode) {
                    toast.info("Agora clique em um nó no canvas para configurá-lo.");
                  }
                }
              }}
            >
              <Settings2 className="h-4 w-4" />
              {configMode ? "Cancelar Config" : "Configurar"}
            </Button>
          )}
          {selectedNodeId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              onClick={handleDeleteNode}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button className="gap-2 gradient-primary" onClick={() => setExecOpen(true)} disabled={nodes.length < 2 || edges.length === 0}>
            <Play className="h-4 w-4" />
            Executar
          </Button>
        </div>
      </div>

      {/* Guide Banner */}
      <GuideBanner nodes={nodes} edges={edges} />

      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar */}
        <div className="w-60 shrink-0 border-r border-white/10 flex flex-col">
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-white/30" />
              <Input
                placeholder="Buscar agente..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-8 bg-white/5 border-white/10 h-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {filteredAgents.map((agent) => {
                const Icon = getIcon(agent.icon || "Bot");
                const alreadyAdded = nodes.some(n => n.agent_id === agent.id);
                return (
                  <button
                    key={agent.id}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      alreadyAdded
                        ? "text-white/40 bg-white/5"
                        : "text-white/70 hover:bg-white/10"
                    }`}
                    onClick={() => handleAddAgent(agent.id, agent.agent_type)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--accent))]" />
                    <span className="truncate flex-1">{agent.name}</span>
                    {alreadyAdded && <span className="text-[10px] text-white/30">✓</span>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-[hsl(220,25%,7%)]"
          style={{ backgroundImage: "radial-gradient(circle, hsl(220,25%,15%) 1px, transparent 1px)", backgroundSize: "30px 30px" }}
          onClick={() => {
            if (!connectMode) setSelectedNodeId(null);
          }}
        >
          <EdgeLines nodes={nodes} edges={edges} />
          {nodes.map((node) => {
            const info = getAgentInfo(node);
            return (
              <div key={node.id} data-node-id={node.id} className="absolute" style={{ left: node.position_x, top: node.position_y, zIndex: 1 }}>
                <FlowNode
                  node={{ ...node, position_x: 0, position_y: 0 }}
                  agentName={info.name}
                  agentIcon={info.icon}
                  isSelected={selectedNodeId === node.id}
                  onSelect={() => {
                    setSelectedNodeId(node.id);
                    if (configMode) {
                      const n = nodes.find(nd => nd.id === node.id);
                      if (n) {
                        setEditPrompt(n.input_prompt || "");
                        setConfigOpen(true);
                        setConfigMode(false);
                      }
                    }
                  }}
                  onDragStart={(e) => handleDragStart(node.id, e)}
                  onConnect={() => handleNodeConnect(node.id)}
                  connectMode={connectMode}
                  isConnectSource={connectSource === node.id}
                />
              </div>
            );
          })}
          {nodes.length === 0 && !nodesLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              <div className="text-center space-y-3">
                <MousePointerClick className="h-16 w-16 mx-auto text-[hsl(var(--accent))]/30" />
                <p className="text-lg font-medium">Comece adicionando agentes</p>
                <p className="text-sm text-white/20 max-w-xs">
                  Clique nos agentes na barra lateral esquerda para adicioná-los ao canvas e montar seu fluxo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <DialogHeader>
            <DialogTitle>Configurar Nó</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Instrução extra para este nó</label>
              <Textarea
                placeholder="Ex: Resuma o resultado anterior em tópicos antes de processar..."
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="min-h-[100px] bg-white/5 border-white/10"
              />
              <p className="text-xs text-white/30 mt-1">Esta instrução será adicionada ao contexto do agente durante a execução</p>
            </div>
            <Button onClick={saveConfig}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Execution Dialog */}
      <Dialog open={execOpen} onOpenChange={(open) => {
        if (!open && !executing) {
          setExecOpen(false);
        }
      }}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Executar Fluxo
              {currentStepIndex >= 0 && flowSteps.length > 0 && (
                <Badge variant="outline" className="text-xs border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))]">
                  Etapa {currentStepIndex + 1}/{flowSteps.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-4 pr-2">
            {/* Flow summary */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-white/40 mb-2">Pipeline de execução (faseado):</p>
              <div className="flex flex-wrap items-center gap-1">
                {(flowSteps.length > 0 ? flowSteps : nodes.sort((a, b) => a.sort_order - b.sort_order).map((n, i) => ({
                  index: i,
                  node_id: n.id,
                  agent_id: n.agent_id,
                  agent_type: n.agent_type,
                  agent_name: getAgentInfo(n).name,
                  input_prompt: n.input_prompt || "",
                }))).map((step, i) => {
                  const stepResult = stepResults.find(r => r.step_index === i);
                  const isActive = currentStepIndex === i;
                  const isDone = stepResult?.status === "completed";
                  const isWaiting = stepResult?.status === "waiting_input";
                  return (
                    <div key={step.node_id} className="flex items-center gap-1">
                      <div className={`flex items-center gap-1 rounded-md px-2 py-1 transition-all ${
                        isActive ? "bg-[hsl(var(--accent))]/20 ring-1 ring-[hsl(var(--accent))]/40" :
                        isDone ? "bg-green-500/10" :
                        isWaiting ? "bg-amber-500/10 ring-1 ring-amber-400/30" :
                        "bg-white/10"
                      }`}>
                        {stepResult?.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--accent))]" />}
                        {isWaiting && <MessageCircle className="h-3 w-3 text-amber-400" />}
                        <span className={`text-xs ${isDone ? "text-green-400" : isWaiting ? "text-amber-300" : "text-white/70"}`}>
                          {step.agent_name}
                        </span>
                      </div>
                      {i < (flowSteps.length || nodes.length) - 1 && <ChevronRight className="h-3 w-3 text-white/20" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Initial input */}
            {stepResults.length === 0 && (
              <>
                <div>
                  <label className="text-sm text-white/60 mb-1 block">Entrada inicial</label>
                  <Textarea
                    placeholder="Digite o texto inicial que será processado pelo primeiro agente..."
                    value={execInput}
                    onChange={(e) => setExecInput(e.target.value)}
                    className="min-h-[80px] bg-white/5 border-white/10"
                    disabled={executing}
                  />
                </div>
                <Button onClick={handleExecute} disabled={executing || !execInput.trim()} className="gap-2 gradient-primary w-full">
                  {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {executing ? "Iniciando..." : "Iniciar Execução Faseada"}
                </Button>
              </>
            )}

            {/* Step results with inline chat */}
            {stepResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80">Resultados por Etapa</h3>
                {stepResults.map((result) => (
                  <div key={result.step_index} className={`rounded-lg border p-3 ${
                    result.status === "waiting_input" ? "border-amber-400/30 bg-amber-500/5" :
                    result.status === "error" ? "border-red-500/30 bg-red-500/5" :
                    result.status === "running" ? "border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5" :
                    "border-white/10 bg-white/5"
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={
                        result.status === "completed" ? "default" :
                        result.status === "waiting_input" ? "outline" :
                        result.status === "running" ? "secondary" :
                        "destructive"
                      } className={`text-xs ${result.status === "waiting_input" ? "border-amber-400/50 text-amber-300" : ""}`}>
                        {result.status === "running" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {result.status === "waiting_input" && <MessageCircle className="h-3 w-3 mr-1" />}
                        Etapa {result.step_index + 1}
                      </Badge>
                      <span className="text-xs text-white/40">{result.agent_name}</span>
                      {result.status === "waiting_input" && (
                        <span className="text-xs text-amber-300/70 ml-auto">Aguardando resposta</span>
                      )}
                    </div>

                    {/* Chat history for this step */}
                    {result.chatHistory.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {result.chatHistory.map((msg, msgIdx) => (
                          <div key={msgIdx} className={`rounded-lg p-2 text-sm ${
                            msg.role === "assistant"
                              ? "bg-white/5 border border-white/5"
                              : "bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/10 ml-8"
                          }`}>
                            <span className="text-[10px] font-medium mb-1 block text-white/30">
                              {msg.role === "assistant" ? result.agent_name : "Você"}
                            </span>
                            <div className="text-sm text-white/70 prose prose-invert prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white/80 [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-white/60">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Show last output if no chat history */}
                    {result.chatHistory.length === 0 && result.output && (
                      <div className="text-sm text-white/70 prose prose-invert prose-sm max-w-none max-h-60 overflow-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white/80 [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-white/60">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.output}</ReactMarkdown>
                      </div>
                    )}

                    {/* Error display */}
                    {result.status === "error" && (
                      <div className="mt-2 rounded bg-red-500/10 border border-red-500/20 p-2">
                        <p className="text-xs text-red-400 font-medium">❌ Erro nesta etapa</p>
                        <p className="text-xs text-red-300/70 mt-1">{result.output?.slice(0, 300)}</p>
                      </div>
                    )}

                    {/* Continue button for completed steps that were chatted */}
                    {result.status === "completed" && result.chatHistory.length > 1 &&
                      result.step_index === Math.max(...stepResults.map(r => r.step_index)) &&
                      !execFinal && !executing && result.step_index < flowSteps.length - 1 && (
                      <div className="mt-3">
                        <Button
                          className="w-full gap-2 gradient-primary"
                          onClick={() => handleContinueToNextStep(result.step_index)}
                        >
                          <ChevronRight className="h-4 w-4" />
                          Continuar para Etapa {result.step_index + 2}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Final result */}
                {execFinal && (
                  <div className="rounded-lg border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 p-4">
                    <h4 className="text-sm font-semibold text-[hsl(var(--accent))] mb-2">✅ Resultado Final</h4>
                    <div className="text-sm text-white/80 prose prose-invert prose-sm max-w-none [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white/80 [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-white/60">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{execFinal}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
