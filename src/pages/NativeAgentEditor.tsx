import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import { useAgentKnowledgeBases } from "@/hooks/useAgentKnowledgeBases";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bot, Wand2, Plus, X, Database, FileText, ExternalLink, MessageSquare, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DocumentManager } from "@/components/agents/DocumentManager";

export default function NativeAgentEditor() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const { data: knowledgeBases = [] } = useKnowledgeBases();
  const { data: agentKBs = [], linkKB, unlinkKB } = useAgentKnowledgeBases(agentId);

  const [tab, setTab] = useState("config");
  const [configTab, setConfigTab] = useState("geral");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creditCost, setCreditCost] = useState(1);
  const [category, setCategory] = useState("");
  const [icon, setIcon] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.5);
  const [promptMode, setPromptMode] = useState<"simple" | "advanced">("advanced");
  const [simplePrompt, setSimplePrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch the native agent
  const { data: agent, isLoading } = useQuery({
    queryKey: ["native-agent", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  // Conversations for this agent
  const { data: sessions = [] } = useQuery({
    queryKey: ["native-agent-sessions", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*, messages(content, role, created_at)")
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!agentId && !!user && isAdmin,
  });

  // Init from agent data
  useEffect(() => {
    if (agent && !initialized) {
      setName(agent.name);
      setDescription(agent.description);
      setCreditCost(agent.credit_cost);
      setCategory(agent.category);
      setIcon(agent.icon);
      setSystemPrompt((agent as any).system_prompt || "");
      setTemperature(Number((agent as any).temperature) || 0.5);
      setInitialized(true);
    }
  }, [agent, initialized]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("agents")
        .update(updates)
        .eq("id", agentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["native-agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const handleSaveGeneral = async () => {
    try {
      await updateMutation.mutateAsync({ name, description, credit_cost: creditCost, category, icon });
      toast.success("Salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleSavePrompt = async () => {
    try {
      await updateMutation.mutateAsync({ system_prompt: systemPrompt, temperature });
      toast.success("Prompt salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleGeneratePrompt = async () => {
    if (!simplePrompt.trim()) {
      toast.error("Descreva o que o agente deve fazer");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { agentId: "__generate_prompt__", input: simplePrompt },
      });
      if (error) throw error;
      setSystemPrompt(data.output || "");
      toast.success("Prompt gerado!");
    } catch {
      toast.error("Erro ao gerar prompt");
    } finally {
      setGenerating(false);
    }
  };

  // Redirect non-admins
  if (!isAdmin) {
    navigate("/agentes");
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(174,62%,47%)] border-t-transparent" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-12 text-center">
        <p className="text-white/50">Agente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/agentes")} className="text-white/60 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Editar Agente Nativo</h1>
          <p className="text-sm text-white/40">Acesso exclusivo do administrador</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 bg-white/5 border border-white/10">
          <TabsTrigger value="conversations" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Conversas</TabsTrigger>
          <TabsTrigger value="config" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Configurações</TabsTrigger>
        </TabsList>

        {/* CONVERSATIONS TAB */}
        <TabsContent value="conversations">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <MessageSquare className="mb-4 h-12 w-12" />
              <p>Nenhuma conversa registrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-white/80 truncate">
                    {s.messages?.[0]?.content || "Conversa vazia"}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CONFIG TAB */}
        <TabsContent value="config">
          <div className="flex gap-6">
            {/* Config sidebar */}
            <div className="w-48 shrink-0 space-y-1">
              {[
                { id: "geral", label: "Visão Geral", icon: Bot },
                { id: "documentos", label: "Documentos", icon: FileText },
                { id: "prompt", label: "Prompt", icon: Settings2 },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setConfigTab(item.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    configTab === item.id
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Config content */}
            <div className="flex-1 space-y-6">
              {configTab === "geral" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">Nome do Agente</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">Descrição</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="border-white/10 bg-white/[0.05] text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/70">Custo (créditos)</label>
                      <Input type="number" value={creditCost} onChange={(e) => setCreditCost(Number(e.target.value))} className="border-white/10 bg-white/[0.05] text-white" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-white/70">Ícone</label>
                      <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="border-white/10 bg-white/[0.05] text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">Categoria</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                        {["Prática Clínica e Farmácia", "EdTech e Professores 4.0", "Pesquisa Acadêmica e Dados", "Produção de Conteúdo e Nicho Tech"].map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                    Salvar
                  </Button>

                  {/* Knowledge Bases linked */}
                  <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-white mb-3">
                      <Database className="h-4 w-4 text-[hsl(174,62%,47%)]" />
                      Bases de Conhecimento Vinculadas
                    </h3>

                    {agentKBs.length === 0 ? (
                      <p className="text-sm text-white/40">Nenhuma base vinculada a este agente.</p>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {agentKBs.map((link) => {
                          const kb = knowledgeBases.find((k) => k.id === link.knowledge_base_id);
                          return (
                            <div key={link.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{kb?.name || "Base removida"}</p>
                                {kb?.description && <p className="text-xs text-white/40 truncate max-w-xs">{kb.description}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-white/50 hover:text-white hover:bg-white/10" onClick={() => navigate(`/conteudos/${link.knowledge_base_id}`)}>
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Gerenciar fontes
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-red-500/10" disabled={unlinkKB.isPending}
                                  onClick={async () => {
                                    try { await unlinkKB.mutateAsync(link.knowledge_base_id); toast.success("Base desvinculada!"); } catch { toast.error("Erro ao desvincular"); }
                                  }}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(() => {
                      const linkedIds = new Set(agentKBs.map((l) => l.knowledge_base_id));
                      const available = knowledgeBases.filter((kb) => !linkedIds.has(kb.id));
                      return available.length > 0 ? (
                        <Select key={agentKBs.length} onValueChange={async (v) => {
                          try { await linkKB.mutateAsync(v); toast.success("Base vinculada!"); } catch { toast.error("Erro ao vincular"); }
                        }}>
                          <SelectTrigger className="border-white/10 bg-white/[0.05] text-white mt-2">
                            <SelectValue placeholder="Adicionar base de conhecimento..." />
                          </SelectTrigger>
                          <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                            {available.map((kb) => (
                              <SelectItem key={kb.id} value={kb.id}>
                                <div className="flex items-center gap-2">
                                  <Plus className="h-3 w-3" />
                                  {kb.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null;
                    })()}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-white/40">ID: {agent.id} | Slug: {agent.slug}</p>
                  </div>
                </>
              )}

              {configTab === "documentos" && (
                <DocumentManager agentId={agentId!} />
              )}

              {configTab === "prompt" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">
                      Temperatura: {temperature}
                    </label>
                    <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={0} max={1} step={0.1} className="mt-2" />
                    <p className="mt-1 text-xs text-white/30">0 = direto e previsível, 1 = criativo e variado</p>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">System Prompt</label>
                    <p className="mb-2 text-xs text-white/30">
                      {systemPrompt ? "Prompt customizado ativo. Deixe vazio para usar o prompt padrão do sistema." : "Usando prompt padrão hardcoded. Edite aqui para sobrescrever."}
                    </p>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={25}
                      className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 font-mono text-xs"
                      placeholder="Deixe vazio para usar o prompt padrão do sistema..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={simplePrompt}
                      onChange={(e) => setSimplePrompt(e.target.value)}
                      placeholder="Descreva o que o agente deve fazer e geramos o prompt..."
                      className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                    />
                    <Button onClick={handleGeneratePrompt} disabled={generating} className="shrink-0 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white">
                      {generating ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Wand2 className="h-4 w-4" />}
                    </Button>
                  </div>

                  <Button onClick={handleSavePrompt} disabled={updateMutation.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}