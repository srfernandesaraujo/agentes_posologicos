import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Plus, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Knowledge() {
  const navigate = useNavigate();
  const { data: bases = [], isLoading, createKB, deleteKB } = useKnowledgeBases();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    try {
      const kb = await createKB.mutateAsync({ name, description, is_public: isPublic });
      toast.success("Conteúdo criado!");
      setCreating(false);
      setName("");
      setDescription("");
      setIsPublic(false);
      navigate(`/conteudos/${kb.id}`);
    } catch {
      toast.error("Erro ao criar");
    }
  };

  if (creating) {
    return (
      <div className="container max-w-2xl py-8">
        <button onClick={() => setCreating(false)} className="text-sm text-white/50 hover:text-white mb-2">Cancelar</button>
        <h1 className="font-display text-2xl font-bold text-white mb-8">Novo Conteúdo</h1>
        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Nome do Conteúdo</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Artigos mais recentes sobre Fusão Nuclear" className="border-white/10 bg-white/[0.05] text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escreva aqui a descrição do Conteúdo" rows={4} className="border-white/10 bg-white/[0.05] text-white" />
          </div>
          <div className="flex items-start gap-3">
            <Checkbox checked={isPublic} onCheckedChange={(v) => setIsPublic(v as boolean)} id="public" />
            <div>
              <label htmlFor="public" className="text-sm font-medium text-white/80">Público</label>
              <p className="text-xs text-white/40">Quando ativado, seu armazenamento de dados estará disponível na internet.</p>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={createKB.isPending} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
            Enviar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-white">Conteúdos</h1>
        <p className="text-sm text-white/40">Organize e acesse o seu banco de dados</p>
      </div>

      <button
        onClick={() => setCreating(true)}
        className="mb-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors w-full max-w-md"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(14,90%,58%)]/20">
          <Database className="h-5 w-5 text-[hsl(14,90%,58%)]" />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-white">Novo Conhecimento</span>
        <Plus className="h-5 w-5 text-white/40" />
      </button>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : bases.length === 0 ? (
        <p className="py-20 text-center text-white/30">Você ainda não criou nenhum Conteúdo</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bases.map((kb) => (
            <button
              key={kb.id}
              onClick={() => navigate(`/conteudos/${kb.id}`)}
              className="text-left rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-5 w-5 text-[hsl(14,90%,58%)]" />
                <h3 className="text-sm font-semibold text-white truncate">{kb.name}</h3>
              </div>
              <p className="text-xs text-white/40 line-clamp-2">{kb.description || "Sem descrição"}</p>
              <p className="mt-2 text-xs text-white/20">{new Date(kb.created_at).toLocaleDateString("pt-BR")}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
