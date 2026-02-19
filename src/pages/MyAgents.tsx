import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { useApiKeys } from "@/hooks/useApiKeys";
import { Bot, Plus, AlertCircle, Settings } from "lucide-react";
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

export default function MyAgents() {
  const navigate = useNavigate();
  const { data: agents = [], createAgent } = useCustomAgents();
  const { hasAnyKey } = useApiKeys();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const agent = await createAgent.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });
      toast.success("Agente criado com sucesso!");
      setShowCreate(false);
      setName("");
      setDescription("");
      navigate(`/meus-agentes/${agent.id}`);
    } catch {
      toast.error("Erro ao criar agente");
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
              action: {
                label: "Configurar",
                onClick: () => navigate("/configuracoes"),
              },
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
        <span className="text-sm font-medium text-white">Novo agente</span>
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

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,8%)] text-white">
          <DialogHeader>
            <DialogTitle className="font-display">Novo agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
              disabled={!name.trim() || createAgent.isPending}
              className="w-full bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white"
            >
              {createAgent.isPending ? "Criando..." : "Criar o Agente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
