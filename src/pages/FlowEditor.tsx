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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Play, Trash2, X, Loader2, GripVertical, Settings2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import * as LucideIcons from "lucide-react";

function getIcon(iconName: string) {
  const Icon = (LucideIcons as any)[iconName] || LucideIcons.Bot;
  return Icon;
}

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
}: {
  node: AgentFlowNode;
  agentName: string;
  agentIcon: string;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onConnect: () => void;
  connectMode: boolean;
}) {
  const Icon = getIcon(agentIcon);
  return (
    <div
      className={`absolute flex flex-col items-center gap-1 cursor-grab select-none group ${connectMode ? "cursor-crosshair" : ""}`}
      style={{ left: node.position_x, top: node.position_y }}
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
          isSelected
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
      {node.input_prompt && (
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

  // Execution
  const [execOpen, setExecOpen] = useState(false);
  const [execInput, setExecInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResults, setExecResults] = useState<any[]>([]);
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
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    dragRef.current = {
      nodeId,
      offsetX: e.clientX - node.position_x,
      offsetY: e.clientY - node.position_y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left - dragRef.current.offsetX + canvasRef.current.scrollLeft);
      const y = Math.max(0, e.clientY - rect.top - dragRef.current.offsetY + canvasRef.current.scrollTop);
      // Update visually via DOM for performance
      const el = canvasRef.current.querySelector(`[data-node-id="${dragRef.current.nodeId}"]`);
      if (el) {
        (el as HTMLElement).style.left = `${x}px`;
        (el as HTMLElement).style.top = `${y}px`;
      }
      dragRef.current = { ...dragRef.current, offsetX: e.clientX - x, offsetY: e.clientY - y };
    };

    const handleMouseUp = async () => {
      if (!dragRef.current || !canvasRef.current) return;
      const nodeId = dragRef.current.nodeId;
      const el = canvasRef.current.querySelector(`[data-node-id="${nodeId}"]`);
      if (el) {
        const x = parseFloat((el as HTMLElement).style.left);
        const y = parseFloat((el as HTMLElement).style.top);
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
    const x = 100 + (nextOrder % 3) * 250;
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
    } catch {
      toast.error("Erro ao adicionar agente");
    }
  };

  // Connect nodes
  const handleNodeConnect = (nodeId: string) => {
    if (!connectSource) {
      setConnectSource(nodeId);
      toast.info("Agora clique no nó de destino");
    } else {
      if (connectSource === nodeId) {
        setConnectSource(null);
        setConnectMode(false);
        return;
      }
      addEdge.mutateAsync({ flow_id: flowId!, source_node_id: connectSource, target_node_id: nodeId });
      setConnectSource(null);
      setConnectMode(false);
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

  // Execute flow
  const handleExecute = async () => {
    if (!flowId || !execInput.trim()) return;
    setExecuting(true);
    setExecResults([]);
    setExecFinal("");
    try {
      const { data, error } = await supabase.functions.invoke("agent-flow-execute", {
        body: { flow_id: flowId, initial_input: execInput, user_id: user?.id },
      });
      if (error) throw error;
      setExecResults(data?.node_results || []);
      setExecFinal(data?.final_output || "");
      toast.success("Fluxo executado com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro na execução");
    } finally {
      setExecuting(false);
    }
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
            className={`gap-1 ${connectMode ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]" : "border-white/20 text-white/60"}`}
            onClick={() => {
              setConnectMode(!connectMode);
              setConnectSource(null);
            }}
          >
            {connectMode ? "Cancelar Conexão" : "Conectar Nós"}
          </Button>
          {selectedNodeId && (
            <>
              <Button variant="outline" size="sm" className="gap-1 border-white/20 text-white/60" onClick={openConfig}>
                <Settings2 className="h-4 w-4" />
                Configurar
              </Button>
              <Button variant="outline" size="sm" className="gap-1 border-red-500/40 text-red-400" onClick={handleDeleteNode}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button className="gap-2 gradient-primary" onClick={() => setExecOpen(true)}>
            <Play className="h-4 w-4" />
            Executar
          </Button>
        </div>
      </div>

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
                return (
                  <button
                    key={agent.id}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 transition-colors"
                    onClick={() => handleAddAgent(agent.id, agent.agent_type)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--accent))]" />
                    <span className="truncate">{agent.name}</span>
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
                  node={node}
                  agentName={info.name}
                  agentIcon={info.icon}
                  isSelected={selectedNodeId === node.id}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onDragStart={(e) => handleDragStart(node.id, e)}
                  onConnect={() => handleNodeConnect(node.id)}
                  connectMode={connectMode}
                />
              </div>
            );
          })}
          {nodes.length === 0 && !nodesLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/20">
              <div className="text-center">
                <Plus className="h-12 w-12 mx-auto mb-2" />
                <p>Adicione agentes da barra lateral</p>
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
      <Dialog open={execOpen} onOpenChange={setExecOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Executar Fluxo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Entrada inicial</label>
              <Textarea
                placeholder="Digite o texto inicial que será processado pelo primeiro agente..."
                value={execInput}
                onChange={(e) => setExecInput(e.target.value)}
                className="min-h-[80px] bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={handleExecute} disabled={executing || !execInput.trim()} className="gap-2 gradient-primary w-full">
              {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {executing ? "Executando..." : "Iniciar Execução"}
            </Button>

            {execResults.length > 0 && (
              <div className="space-y-3 mt-4">
                <h3 className="text-sm font-semibold text-white/80">Resultados por Etapa</h3>
                {execResults.map((r: any, i: number) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={r.status === "completed" ? "default" : "destructive"} className="text-xs">
                        Etapa {i + 1}
                      </Badge>
                      <span className="text-xs text-white/40">{r.agent_name || "Agente"}</span>
                    </div>
                    {r.output_text && (
                      <pre className="text-xs text-white/70 whitespace-pre-wrap max-h-40 overflow-auto">{r.output_text}</pre>
                    )}
                    {r.status === "error" && (
                      <p className="text-xs text-red-400 mt-1">Erro na execução deste nó</p>
                    )}
                  </div>
                ))}
                {execFinal && (
                  <div className="rounded-lg border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 p-4">
                    <h4 className="text-sm font-semibold text-[hsl(var(--accent))] mb-2">Resultado Final</h4>
                    <pre className="text-sm text-white/80 whitespace-pre-wrap">{execFinal}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
