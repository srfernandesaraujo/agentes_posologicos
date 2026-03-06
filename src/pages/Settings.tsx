import { useState } from "react";
import { useApiKeys, LLM_PROVIDERS } from "@/hooks/useApiKeys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, Trash2, Key } from "lucide-react";
import { toast } from "sonner";
import { ResearchInterestsManager } from "@/components/pubmed/ResearchInterestsManager";

export default function Settings() {
  const { data: keys = [], upsertKey, deleteKey } = useApiKeys();
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSave = async (provider: string) => {
    if (!inputValue.trim()) return;
    try {
      await upsertKey.mutateAsync({ provider, apiKey: inputValue.trim() });
      toast.success("Chave API salva com sucesso!");
      setEditing(null);
      setInputValue("");
    } catch {
      toast.error("Erro ao salvar chave API");
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      await deleteKey.mutateAsync(provider);
      toast.success("Chave API removida");
    } catch {
      toast.error("Erro ao remover chave API");
    }
  };

  const getExistingKey = (provider: string) =>
    keys.find((k) => k.provider === provider);

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas chaves de API e preferências</p>
      </div>

      {/* API Keys Section */}
      <div className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-foreground">API Keys externas</h2>
        <p className="text-sm text-muted-foreground">
          Configure as API Keys das suas LLMs favoritas. Elas serão usadas tanto nos seus agentes personalizados quanto nos agentes nativos da plataforma.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Se nenhuma chave estiver configurada, os agentes nativos usarão o modelo padrão da plataforma. Se a chamada com sua chave falhar, o sistema fará fallback automático.
        </p>
      </div>

      <div className="space-y-4 mb-10">
        {LLM_PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          const isEditing = editing === provider.id;

          return (
            <div
              key={provider.id}
              className="rounded-xl border border-border bg-card/50 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${existing ? 'bg-emerald-500/15' : 'bg-muted/50'}`}>
                    <Key className={`h-4 w-4 ${existing ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{provider.name}</h3>
                    {existing && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        Configurada
                      </span>
                    )}
                  </div>
                </div>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Adquira sua chave de API
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Cole aqui sua API Key"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground"
                    type="password"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSave(provider.id)}
                    disabled={upsertKey.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(null); setInputValue(""); }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : existing ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground font-mono">
                    ••••••••••••••••
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(provider.id); setInputValue(""); }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(provider.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    Cole aqui sua API Key
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(provider.id); setInputValue(""); }}
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Research Interests Section */}
      <ResearchInterestsManager />
    </div>
  );
}
