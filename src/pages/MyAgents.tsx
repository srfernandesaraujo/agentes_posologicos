import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useCredits } from "@/hooks/useCredits";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Bot, Plus, AlertCircle, Settings, Coins, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AGENT_CREATION_COST = 5;

export default function MyAgents() {
  const navigate = useNavigate();
  const { data: agents = [], createAgent } = useCustomAgents();
  const { hasAnyKey } = useApiKeys();
  const { balance, refetch: refetchCredits } = useCredits();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"manual" | "ai">("manual");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    if (!isAdmin && balance < AGENT_CREATION_COST) {
      toast.error(`Créditos insuficientes. Criar um agente custa ${AGENT_CREATION_COST} créditos.`, {
        action: { label: "Comprar", onClick: () => navigate("/creditos") },
      });
      return;
    }

    try {
      const agent = await createAgent.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });

      if (!isAdmin && user) {
        await supabase.from("credits_ledger").insert({
          user_id: user.id,
          amount: -AGENT_CREATION_COST,
          type: "usage",
          description: "Criação de agente personalizado",
        });
        refetchCredits();
      }

      toast.success("Agente criado com sucesso!");
      setShowCreate(false);
      setName("");
      setDescription("");
      setAiPrompt("");
      navigate(`/meus-agentes/${agent.id}`);
    } catch {
      toast.error("Erro ao criar agente");
    }
  };

  const handleCreateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Descreva o que seu agente deve fazer");
      return;
    }

    if (!isAdmin && balance < AGENT_CREATION_COST) {
      toast.error(`Créditos insuficientes. Criar um agente custa ${AGENT_CREATION_COST} créditos.`, {
        action: { label: "Comprar", onClick: () => navigate("/creditos") },
      });
      return;
    }

    setGenerating(true);
    try {
      // Generate system prompt via AI
      const { data: promptData, error: promptError } = await supabase.functions.invoke("agent-chat", {
        body: { agentId: "__generate_prompt__", input: aiPrompt },
      });
      if (promptError) throw promptError;

      const generatedPrompt = promptData?.output || "";

      // Create agent with AI-generated content
      const agent = await createAgent.mutateAsync({
        name: aiPrompt.slice(0, 60).trim(),
        description: aiPrompt.trim(),
      });

      // Update with generated system prompt
      await supabase
        .from("custom_agents" as any)
        .update({ system_prompt: generatedPrompt })
        .eq("id", agent.id)
        .eq("user_id", user!.id);

      if (!isAdmin && user) {
        await supabase.from("credits_ledger").insert({
          user_id: user.id,
          amount: -AGENT_CREATION_COST,
          type: "usage",
          description: "Criação de agente personalizado (IA)",
        });
        refetchCredits();
      }

      toast.success("Agente criado com IA! Revise o prompt gerado.");
      setShowCreate(false);
      setAiPrompt("");
      navigate(`/meus-agentes/${agent.id}`);
    } catch {
      toast.error("Erro ao criar agente com IA");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Meus Agentes</h1>
        <p className="text-white/50">
          Gerencie seus agentes personalizados
        </p>
      </div>

      {/* New agent button */}
      <button
        onClick={() => {
          if (!hasAnyKey) {
            toast.error("Configure pelo menos uma chave API antes de criar agentes.", {
              action: { label: "Configurar", onClick: () => navigate("/configuracoes") },
            });
            return;
          }
          setShowCreate(true);
        }}
        className="mb-6 flex w-full max-w-sm items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-4 transition-colors hover:border-[hsl(14,90%,58%)]/50 hover:bg-white/[0.05]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(14,90%,58%)]/20">
          <Bot className="h-5 w-5 text-[hsl(14,90%,58%)]" />
        </div>
        <div className="text-left">
          <span className="text-sm font-medium text-white">Novo agente</span>
          <span className="block text-xs text-white/40 flex items-center gap-1">
            <Coins className="h-3 w-3" /> {AGENT_CREATION_COST} créditos
          </span>
        </div>
        <Plus className="ml-auto h-4 w-4 text-white/40" />
      </button>

      {/* Warning if no API keys */}
      {!hasAnyKey && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-300">Nenhuma LLM configurada</p>
            <p className="text-xs text-red-300/70">
              Você ainda não configurou nenhuma chave API. A criação de agentes só é liberada após inserir alguma chave.
            </p>
            <Link to="/configuracoes">
              <Button size="sm" variant="ghost" className="mt-2 gap-1 text-red-300 hover:text-red-200 hover:bg-red-500/10">
                <Settings className="h-3.5 w-3.5" />
                Configurar
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Agents list */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <Bot className="mb-4 h-12 w-12" />
          <p>Você ainda não criou nenhum Agente</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => navigate(`/meus-agentes/${agent.id}`)}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:border-white/20 hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg gradient-primary">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white truncate">{agent.name}</h3>
                <p className="text-xs text-white/40 line-clamp-2">{agent.description || "Sem descrição"}</p>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  agent.status === "published"
                    ? "bg-[hsl(152,60%,42%)]/20 text-[hsl(152,60%,42%)]"
                    : "bg-white/10 text-white/40"
                }`}>
                  {agent.status === "published" ? "Publicado" : "Rascunho"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) { setCreateMode("manual"); setAiPrompt(""); } }}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">Novo agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-amber-300">
                Criar um agente custa {AGENT_CREATION_COST} créditos. Seu saldo: {isAdmin ? "∞" : balance}
              </span>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setCreateMode("manual")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  createMode === "manual" ? "bg-white/10 text-white border border-white/20" : "text-white/50 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Bot className="h-4 w-4" />
                Manual
              </button>
              <button
                onClick={() => setCreateMode("ai")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  createMode === "ai" ? "bg-accent/20 text-accent border border-accent/30" : "text-white/50 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Criar com IA
              </button>
            </div>

            {createMode === "manual" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Nome</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Escreva aqui o nome do agente"
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Descrição</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Escreva aqui a descrição do agente"
                    rows={4}
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!name.trim() || createAgent.isPending || (!isAdmin && balance < AGENT_CREATION_COST)}
                  className="w-full bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white"
                >
                  {createAgent.isPending ? "Criando..." : `Criar o Agente (${AGENT_CREATION_COST} créditos)`}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">Descreva o que seu agente deve fazer</label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ex: Um assistente que analisa bulas de medicamentos e resume as informações principais para o paciente..."
                    rows={5}
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                  />
                  <p className="mt-1 text-xs text-white/30">A IA vai gerar automaticamente o nome, descrição e prompt de sistema do seu agente.</p>
                </div>
                <Button
                  onClick={handleCreateWithAI}
                  disabled={!aiPrompt.trim() || generating || (!isAdmin && balance < AGENT_CREATION_COST)}
                  className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Gerando com IA...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Criar com IA ({AGENT_CREATION_COST} créditos)
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
