import { useState } from "react";
import { useApiKeys, LLM_PROVIDERS } from "@/hooks/useApiKeys";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye, EyeOff, Check, Trash2, Key } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { data: keys = [], upsertKey, deleteKey } = useApiKeys();
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showKey, setShowKey] = useState<string | null>(null);

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

  const maskKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Configurações</h1>
        <p className="text-white/50">Gerencie suas chaves de API</p>
      </div>

      <div className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-white">API Keys externas</h2>
        <p className="text-sm text-white/40">
          Configure as API Keys das suas LLMs favoritas para criar agentes personalizados.
        </p>
      </div>

      <div className="space-y-4">
        {LLM_PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          const isEditing = editing === provider.id;

          return (
            <div
              key={provider.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                    <Key className="h-4 w-4 text-white/60" />
                  </div>
                  <h3 className="font-semibold text-white">{provider.name}</h3>
                </div>
                <a
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[hsl(174,62%,47%)] hover:underline"
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
                    className="border-white/10 bg-white/[0.05] text-white placeholder:text-white/30"
                    type="password"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSave(provider.id)}
                    disabled={upsertKey.isPending}
                    className="bg-[hsl(174,62%,47%)] hover:bg-[hsl(174,62%,40%)] text-white"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(null); setInputValue(""); }}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : existing ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/50 font-mono">
                    {showKey === provider.id
                      ? existing.api_key_encrypted
                      : maskKey(existing.api_key_encrypted)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowKey(showKey === provider.id ? null : provider.id)}
                    className="text-white/40 hover:text-white hover:bg-white/10"
                  >
                    {showKey === provider.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(provider.id); setInputValue(existing.api_key_encrypted); }}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(provider.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/30">
                    Cole aqui sua API Key
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(provider.id); setInputValue(""); }}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
