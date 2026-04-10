import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useApiKeys, LLM_PROVIDERS } from "@/hooks/useApiKeys";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, Trash2, Key, AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { data: keys = [], upsertKey, deleteKey } = useApiKeys();
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});

  const handleSave = async (provider: string) => {
    if (!inputValue.trim()) return;
    const providerDef = LLM_PROVIDERS.find((p) => p.id === provider);
    const expiresInDays = providerDef && "expiresInDays" in providerDef ? providerDef.expiresInDays : undefined;
    try {
      await upsertKey.mutateAsync({ provider, apiKey: inputValue.trim(), expiresInDays });
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

  const isExpired = (key: { key_expires_at: string | null }) => {
    if (!key.key_expires_at) return false;
    return new Date(key.key_expires_at) < new Date();
  };

  const daysUntilExpiry = (key: { key_expires_at: string | null }) => {
    if (!key.key_expires_at) return null;
    const diff = new Date(key.key_expires_at).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (adminLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/agentes" replace />;
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold text-white">Configurações</h1>
        <p className="text-white/50">Gerencie suas chaves de API</p>
      </div>

      <div className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-white">API Keys externas</h2>
        <p className="text-sm text-white/40">
          Configure as API Keys das suas LLMs favoritas. Elas serão usadas tanto nos seus agentes personalizados quanto nos agentes nativos da plataforma.
        </p>
        <p className="mt-1 text-xs text-white/30">
          Se nenhuma chave estiver configurada, os agentes nativos usarão o modelo padrão da plataforma. Se a chamada com sua chave falhar, o sistema fará fallback automático.
        </p>
      </div>

      <div className="space-y-4">
        {LLM_PROVIDERS.map((provider) => {
          const existing = getExistingKey(provider.id);
          const isEditing = editing === provider.id;
          const expired = existing ? isExpired(existing) : false;
          const daysLeft = existing ? daysUntilExpiry(existing) : null;

          return (
            <div
              key={provider.id}
              className={`rounded-xl border p-5 ${expired ? 'border-red-500/30 bg-red-500/[0.03]' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${expired ? 'bg-red-500/15' : existing ? 'bg-emerald-500/15' : 'bg-white/5'}`}>
                    {expired ? (
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Key className={`h-4 w-4 ${existing ? 'text-emerald-400' : 'text-white/60'}`} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white">{provider.name}</h3>
                    {existing && expired && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        Expirada
                      </span>
                    )}
                    {existing && !expired && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        Configurada
                      </span>
                    )}
                    {existing && daysLeft !== null && daysLeft > 0 && daysLeft <= 7 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                        Expira em {daysLeft}d
                      </span>
                    )}
                  </div>
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
                    ••••••••••••••••
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(provider.id); setInputValue(""); }}
                    className="text-white/60 hover:text-white hover:bg-white/10"
                  >
                    {expired ? "Renovar" : "Editar"}
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
