import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentFlows, useCreateFlow, useDeleteFlow } from "@/hooks/useAgentFlows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Trash2, Sparkles, Loader2, ArrowLeft, ArrowRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  ready: { label: "Pronto", variant: "default" },
  running: { label: "Executando", variant: "outline" },
  completed: { label: "Concluído", variant: "default" },
  error: { label: "Erro", variant: "destructive" },
};

type AiStep = "prompt" | "preflight" | "creating";

interface PreflightState {
  questions: string[];
  answers: Record<string, string>;
  planPreview: {
    flow_name: string;
    execution_mode: string;
    node_count: number;
    node_names: string[];
  } | null;
}

export default function Flows() {
  const navigate = useNavigate();
  const { data: flows = [], isLoading } = useAgentFlows();
  const createFlow = useCreateFlow();
  const deleteFlow = useDeleteFlow();
  const { user } = useAuth();

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStep, setAiStep] = useState<AiStep>("prompt");
  const [preflight, setPreflight] = useState<PreflightState>({
    questions: [],
    answers: {},
    planPreview: null,
  });

  const resetAiDialog = () => {
    setAiStep("prompt");
    setAiPrompt("");
    setAiLoading(false);
    setPreflight({ questions: [], answers: {}, planPreview: null });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const flow = await createFlow.mutateAsync({ name: newName, description: newDesc });
      setNewOpen(false);
      setNewName("");
      setNewDesc("");
      navigate(`/fluxos/${flow.id}`);
    } catch {
      toast.error("Erro ao criar fluxo");
    }
  };

  const handleAiCreate = async (preflightAnswers?: Record<string, string>) => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-flow-plan", {
        body: {
          description: aiPrompt,
          user_id: user?.id,
          ...(preflightAnswers ? { preflight_answers: preflightAnswers } : {}),
        },
      });
      if (error) throw error;

      // Check if the planner needs preflight questions
      if (data?.needs_preflight && data?.preflight_questions?.length > 0) {
        setPreflight({
          questions: data.preflight_questions,
          answers: Object.fromEntries(data.preflight_questions.map((q: string) => [q, ""])),
          planPreview: data.plan_preview || null,
        });
        setAiStep("preflight");
        setAiLoading(false);
        return;
      }

      if (data?.flow_id) {
        const modeLabel = data.execution_mode === "parallel" ? "paralelo" : "sequencial";
        toast.success(`Fluxo ${modeLabel} criado com IA!`);
        navigate(`/fluxos/${data.flow_id}`);
        setAiOpen(false);
        resetAiDialog();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar fluxo com IA");
    } finally {
      setAiLoading(false);
    }
  };

  const handlePreflightSubmit = () => {
    const unanswered = preflight.questions.filter((q) => !preflight.answers[q]?.trim());
    if (unanswered.length > 0) {
      toast.error("Por favor, responda todas as perguntas antes de continuar.");
      return;
    }
    setAiStep("creating");
    handleAiCreate(preflight.answers);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este fluxo?")) return;
    try {
      await deleteFlow.mutateAsync(id);
      toast.success("Fluxo excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Fluxos de Agentes</h1>
          <p className="text-white/60 mt-1">Monte pipelines conectando agentes em sequência ou paralelo</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={aiOpen} onOpenChange={(open) => { setAiOpen(open); if (!open) resetAiDialog(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10">
                <Sparkles className="h-4 w-4" />
                Criar com IA
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
                  {aiStep === "prompt" && "Criar Fluxo Premium com IA"}
                  {aiStep === "preflight" && "Informações Adicionais"}
                  {aiStep === "creating" && "Criando Fluxo..."}
                </DialogTitle>
              </DialogHeader>

              {/* Step 1: Describe the flow */}
              {aiStep === "prompt" && (
                <>
                  <p className="text-sm text-white/60">
                    Descreva o que você quer alcançar. A IA vai criar agentes com prompts premium, detectar automaticamente o melhor modo (sequencial ou paralelo) e montar o fluxo.
                  </p>
                  <Textarea
                    placeholder="Ex: Quero um fluxo que receba um tema, pesquise artigos científicos, redija um artigo acadêmico completo e depois faça uma revisão rigorosa com verificação de fatos."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="min-h-[140px] bg-white/5 border-white/10"
                  />
                  <Button onClick={() => handleAiCreate()} disabled={aiLoading || !aiPrompt.trim()} className="gap-2">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {aiLoading ? "Analisando..." : "Gerar Fluxo Premium"}
                  </Button>
                </>
              )}

              {/* Step 2: Preflight questions */}
              {aiStep === "preflight" && (
                <>
                  {preflight.planPreview && (
                    <div className="rounded-lg bg-white/5 border border-white/10 p-3 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {preflight.planPreview.execution_mode === "parallel" ? "⚡ Paralelo" : "➡️ Sequencial"}
                        </Badge>
                        <span className="text-sm font-medium">{preflight.planPreview.flow_name}</span>
                      </div>
                      <p className="text-xs text-white/40">
                        {preflight.planPreview.node_count} agentes: {preflight.planPreview.node_names.join(" → ")}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-white/60">
                    <MessageSquare className="h-4 w-4 inline mr-1" />
                    A IA precisa de algumas informações para gerar o fluxo com a máxima qualidade:
                  </p>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {preflight.questions.map((question, idx) => (
                      <div key={idx}>
                        <label className="text-sm font-medium text-white/80 block mb-1">
                          {idx + 1}. {question}
                        </label>
                        <Input
                          value={preflight.answers[question] || ""}
                          onChange={(e) =>
                            setPreflight((prev) => ({
                              ...prev,
                              answers: { ...prev.answers, [question]: e.target.value },
                            }))
                          }
                          className="bg-white/5 border-white/10"
                          placeholder="Sua resposta..."
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setAiStep("prompt")} className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Voltar
                    </Button>
                    <Button onClick={handlePreflightSubmit} className="gap-2 flex-1">
                      <Sparkles className="h-4 w-4" /> Criar Fluxo
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Creating */}
              {aiStep === "creating" && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--accent))]" />
                  <p className="text-white/60 text-center">
                    Criando fluxo premium com agentes especializados...
                  </p>
                  <p className="text-xs text-white/30 text-center">
                    Isso pode levar alguns segundos — estamos gerando prompts detalhados para cada agente.
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary">
                <Plus className="h-4 w-4" />
                Novo Fluxo
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
              <DialogHeader>
                <DialogTitle>Novo Fluxo</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Nome do fluxo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="bg-white/5 border-white/10"
              />
              <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Workflow className="h-16 w-16 text-white/20 mb-4" />
          <h2 className="text-xl font-semibold text-white/60">Nenhum fluxo criado</h2>
          <p className="text-white/40 mt-2 max-w-md">
            Crie um fluxo para conectar agentes em sequência ou paralelo. A IA detecta automaticamente o melhor modo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => {
            const st = STATUS_LABELS[flow.status] || STATUS_LABELS.draft;
            return (
              <Card
                key={flow.id}
                className="cursor-pointer border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                onClick={() => navigate(`/fluxos/${flow.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-[hsl(var(--accent))]" />
                    <CardTitle className="text-base text-white">{flow.name}</CardTitle>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </CardHeader>
                <CardContent>
                  {flow.description && (
                    <p className="text-sm text-white/50 mb-3 line-clamp-2">{flow.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/30">
                      {new Date(flow.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/30 hover:text-red-400"
                      onClick={(e) => handleDelete(flow.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
