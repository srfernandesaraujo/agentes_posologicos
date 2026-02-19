import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCustomAgent, useCustomAgents } from "@/hooks/useCustomAgents";
import { useApiKeys, LLM_PROVIDERS } from "@/hooks/useApiKeys";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bot, Trash2, MessageSquare, Wand2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function AgentEditor() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: agent, isLoading } = useCustomAgent(agentId);
  const { updateAgent, deleteAgent } = useCustomAgents();
  const { data: apiKeys = [] } = useApiKeys();

  // Local state for editing
  const [tab, setTab] = useState("config");
  const [configTab, setConfigTab] = useState("geral");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.5);
  const [provider, setProvider] = useState("");
  const [restrictContent, setRestrictContent] = useState(false);
  const [markdownResponse, setMarkdownResponse] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptMode, setPromptMode] = useState<"simple" | "advanced">("simple");
  const [simplePrompt, setSimplePrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Prompt simple fields
  const [whoIs, setWhoIs] = useState("");
  const [whatDoes, setWhatDoes] = useState("");
  const [objective, setObjective] = useState("");
  const [howRespond, setHowRespond] = useState("");
  const [instructions, setInstructions] = useState("");
  const [avoidTopics, setAvoidTopics] = useState("");
  const [avoidWords, setAvoidWords] = useState("");
  const [customRules, setCustomRules] = useState("");

  // Init from agent data
  const [initialized, setInitialized] = useState(false);
  if (agent && !initialized) {
    setName(agent.name);
    setDescription(agent.description);
    setModel(agent.model);
    setTemperature(Number(agent.temperature));
    setProvider(agent.provider);
    setRestrictContent(agent.restrict_content);
    setMarkdownResponse(agent.markdown_response);
    setSystemPrompt(agent.system_prompt);
    setInitialized(true);
  }

  // Conversations for this custom agent
  const { data: sessions = [] } = useQuery({
    queryKey: ["custom-agent-sessions", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*, messages(content, role, created_at)")
        .eq("user_id", user!.id)
        .eq("agent_id", agentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!agentId && !!user,
  });

  const handleSaveGeneral = async () => {
    if (!agentId) return;
    try {
      await updateAgent.mutateAsync({ id: agentId, name, description });
      toast.success("Salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleSaveModel = async () => {
    if (!agentId) return;
    try {
      await updateAgent.mutateAsync({ id: agentId, model, temperature, provider, restrict_content: restrictContent, markdown_response: markdownResponse });
      toast.success("Modelo salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleSavePrompt = async () => {
    if (!agentId) return;
    try {
      await updateAgent.mutateAsync({ id: agentId, system_prompt: systemPrompt });
      toast.success("Prompt salvo!");
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handlePublish = async () => {
    if (!agentId) return;
    try {
      await updateAgent.mutateAsync({ id: agentId, status: "published" });
      toast.success("Agente publicado!");
    } catch {
      toast.error("Erro ao publicar");
    }
  };

  const handleDelete = async () => {
    if (!agentId) return;
    if (!confirm("Essa é uma ação irreversível. Tem certeza que deseja excluir este agente?")) return;
    try {
      await deleteAgent.mutateAsync(agentId);
      toast.success("Agente excluído");
      navigate("/meus-agentes");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleGeneratePrompt = async () => {
    if (!simplePrompt.trim()) {
      toast.error("Descreva o que seu agente deve fazer");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          agentId: "__generate_prompt__",
          input: simplePrompt,
        },
      });
      if (error) throw error;
      setSystemPrompt(data.output || "");
      setPromptMode("advanced");
      toast.success("Prompt gerado! Revise e ajuste como desejar.");
    } catch {
      toast.error("Erro ao gerar prompt");
    } finally {
      setGenerating(false);
    }
  };

  const handleImportTemplate = async () => {
    const desc = [
      whoIs && `Quem é: ${whoIs}`,
      whatDoes && `O que faz: ${whatDoes}`,
      objective && `Objetivo: ${objective}`,
      howRespond && `Como responder: ${howRespond}`,
      instructions && `Instruções: ${instructions}`,
      avoidTopics && `Evitar temas: ${avoidTopics}`,
      avoidWords && `Evitar palavras: ${avoidWords}`,
      customRules && `Regras: ${customRules}`,
    ].filter(Boolean).join("\n");

    if (!desc) {
      toast.error("Preencha pelo menos um campo");
      return;
    }

    setSimplePrompt(desc);
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { agentId: "__generate_prompt__", input: desc },
      });
      if (error) throw error;
      setSystemPrompt(data.output || "");
      toast.success("Prompt gerado a partir do template!");
    } catch {
      toast.error("Erro ao gerar prompt");
    } finally {
      setGenerating(false);
    }
  };

  const availableModels = (() => {
    const p = LLM_PROVIDERS.find((pp) => pp.id === provider);
    return p ? [...p.models] : [];
  })();

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
        <Button variant="ghost" size="icon" onClick={() => navigate("/meus-agentes")} className="text-white/60 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Agente</h1>
          <p className="text-sm text-white/40">Edite e personalize o seu Agente</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 bg-white/5 border border-white/10">
          <TabsTrigger value="conversations" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Conversas</TabsTrigger>
          <TabsTrigger value="config" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Configurações</TabsTrigger>
          <TabsTrigger value="publish" className="text-white/60 data-[state=active]:text-white data-[state=active]:bg-white/10">Publicar</TabsTrigger>
        </TabsList>

        {/* CONVERSATIONS TAB */}
        <TabsContent value="conversations">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <MessageSquare className="mb-4 h-12 w-12" />
              <p>Nenhuma conversa iniciada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/chat/${agentId}`)}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
                >
                  <p className="text-sm text-white/80 truncate">
                    {s.messages?.[0]?.content || "Conversa vazia"}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    {new Date(s.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </button>
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
                { id: "modelo", label: "Modelo", icon: Bot },
                { id: "prompt", label: "Prompt", icon: Bot },
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
                  <Button onClick={handleSaveGeneral} disabled={updateAgent.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                    Salvar
                  </Button>

                  <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-white/40">ID do Agente: {agent.id}</p>
                  </div>

                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                    <h3 className="text-lg font-semibold text-red-400">Excluir Agente</h3>
                    <p className="mt-1 text-sm text-white/50">
                      Essa é uma ação irreversível. Uma vez excluído, o Agente não poderá ser recuperado.
                    </p>
                    <Button onClick={handleDelete} variant="destructive" className="mt-3" disabled={deleteAgent.isPending}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Agente
                    </Button>
                  </div>
                </>
              )}

              {configTab === "modelo" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">Provedor</label>
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                        {apiKeys.map((k) => {
                          const p = LLM_PROVIDERS.find((pp) => pp.id === k.provider);
                          return (
                            <SelectItem key={k.provider} value={k.provider}>
                              {p?.name || k.provider}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">Modelo</label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                        {availableModels.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-white/70">
                      Temperatura: {temperature}
                    </label>
                    <Slider
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v)}
                      min={0}
                      max={1}
                      step={0.1}
                      className="mt-2"
                    />
                    <p className="mt-1 text-xs text-white/30">
                      Com temperatura 0, respostas diretas e previsíveis. Com temperatura 1, mais criativas e variadas.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-white">Comportamento</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/80">Restrição de conteúdo</p>
                        <p className="text-xs text-white/40">Limite o conteúdo do agente</p>
                      </div>
                      <Switch checked={restrictContent} onCheckedChange={setRestrictContent} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white/80">Responder em formato Markdown</p>
                        <p className="text-xs text-white/40">Forçar formatação Markdown nas respostas</p>
                      </div>
                      <Switch checked={markdownResponse} onCheckedChange={setMarkdownResponse} />
                    </div>
                  </div>

                  <Button onClick={handleSaveModel} disabled={updateAgent.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                    Salvar
                  </Button>
                </>
              )}

              {configTab === "prompt" && (
                <>
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPromptMode("simple")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        promptMode === "simple" ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
                      }`}
                    >
                      Simplificada
                    </button>
                    <button
                      onClick={() => setPromptMode("advanced")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        promptMode === "advanced" ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5"
                      }`}
                    >
                      Avançada
                    </button>
                    <button
                      onClick={handleImportTemplate}
                      disabled={generating}
                      className="ml-auto flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-[hsl(174,62%,47%)] hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <Wand2 className="h-4 w-4" />
                      Importar template
                    </button>
                  </div>

                  {promptMode === "simple" ? (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Informações Essenciais</h3>
                      {[
                        { label: "Quem é o seu Agente?", value: whoIs, set: setWhoIs, placeholder: "Você é um assistente de..." },
                        { label: "O que seu Agente faz?", value: whatDoes, set: setWhatDoes, placeholder: "Sua principal missão é..." },
                        { label: "Qual o objetivo do seu Agente?", value: objective, set: setObjective, placeholder: "Seu objetivo é..." },
                        { label: "Como seu Agente deve responder?", value: howRespond, set: setHowRespond, placeholder: "Seu tom de comunicação deve ser..." },
                      ].map((field) => (
                        <div key={field.label}>
                          <label className="mb-1.5 block text-sm font-medium text-white/70">{field.label}</label>
                          <Textarea
                            value={field.value}
                            onChange={(e) => field.set(e.target.value)}
                            placeholder={field.placeholder}
                            rows={3}
                            className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                          />
                        </div>
                      ))}

                      <h3 className="text-lg font-semibold text-white pt-4">Regras Gerais</h3>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/70">Instruções para o Agente</label>
                        <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Suas principais responsabilidades incluem..." rows={4} className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/70">Quais temas ele deve evitar?</label>
                        <Input value={avoidTopics} onChange={(e) => setAvoidTopics(e.target.value)} className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/70">Quais palavras ele deve evitar?</label>
                        <Input value={avoidWords} onChange={(e) => setAvoidWords(e.target.value)} className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/70">Regras personalizadas</label>
                        <Textarea value={customRules} onChange={(e) => setCustomRules(e.target.value)} placeholder="Sempre verifique se..." rows={3} className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30" />
                      </div>

                      <div className="pt-2">
                        <Button
                          onClick={handleImportTemplate}
                          disabled={generating}
                          className="w-full bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white"
                        >
                          {generating ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                          ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                          )}
                          Gerar Prompt do Sistema
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-white/70">Prompt Avançado (System Prompt)</label>
                        <Textarea
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          rows={20}
                          className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 font-mono text-xs"
                          placeholder="Cole ou edite o system prompt completo do seu agente aqui..."
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          value={simplePrompt}
                          onChange={(e) => setSimplePrompt(e.target.value)}
                          placeholder="Descreva o que seu agente deve fazer e geramos o prompt..."
                          className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                        />
                        <Button
                          onClick={handleGeneratePrompt}
                          disabled={generating}
                          className="shrink-0 bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white"
                        >
                          {generating ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSavePrompt} disabled={updateAgent.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* PUBLISH TAB */}
        <TabsContent value="publish">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Publicar Agente</h3>
            <p className="text-sm text-white/50">
              Ao publicar, o agente ficará disponível na sua área de agentes personalizados para uso.
            </p>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                agent.status === "published"
                  ? "bg-[hsl(152,60%,42%)]/20 text-[hsl(152,60%,42%)]"
                  : "bg-white/10 text-white/50"
              }`}>
                {agent.status === "published" ? "✅ Publicado" : "Rascunho"}
              </span>
            </div>
            {agent.status !== "published" ? (
              <Button onClick={handlePublish} disabled={updateAgent.isPending} className="bg-[hsl(152,60%,42%)] hover:bg-[hsl(152,60%,36%)] text-white">
                Publicar Agente
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  await updateAgent.mutateAsync({ id: agentId!, status: "draft" });
                  toast.success("Agente despublicado");
                }}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Despublicar
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
