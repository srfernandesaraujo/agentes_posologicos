import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentFlows, useCreateFlow, useDeleteFlow } from "@/hooks/useAgentFlows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Trash2, Play, Sparkles, Loader2 } from "lucide-react";
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

  const handleAiCreate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-flow-plan", {
        body: { description: aiPrompt, user_id: user?.id },
      });
      if (error) throw error;
      if (data?.flow_id) {
        toast.success("Fluxo criado com IA!");
        navigate(`/fluxos/${data.flow_id}`);
      }
      setAiOpen(false);
      setAiPrompt("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar fluxo com IA");
    } finally {
      setAiLoading(false);
    }
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
          <p className="text-white/60 mt-1">Monte pipelines conectando agentes em sequência</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10">
                <Sparkles className="h-4 w-4" />
                Criar com IA
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
              <DialogHeader>
                <DialogTitle>Criar Fluxo com IA</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-white/60">Descreva o que você quer alcançar. A IA vai sugerir quais agentes usar e montará o fluxo automaticamente.</p>
              <Textarea
                placeholder="Ex: Quero um fluxo que receba um tema de aula, crie um plano com metodologias ativas, depois gere um caso clínico baseado no plano, e por fim crie um material educativo para os alunos."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="min-h-[120px] bg-white/5 border-white/10"
              />
              <Button onClick={handleAiCreate} disabled={aiLoading || !aiPrompt.trim()} className="gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiLoading ? "Gerando..." : "Gerar Fluxo"}
              </Button>
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
            Crie um fluxo para conectar agentes em sequência. A saída de um alimenta a entrada do próximo.
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
