import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Smartphone, Copy, Check, Save, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  agentId: string;
  agentName?: string;
  onBack: () => void;
}

export function WhatsAppConnect({ agentId, agentName, onBack }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "kmpwowdvljizswkhwhtq";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`;

  // Load existing connection
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_connections" as any)
        .select("id, instance_name, evolution_api_url, status")
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .eq("service_type", "evolution")
        .maybeSingle();

      if (data) {
        const d = data as any;
        setConnectionId(d.id);
        setInstanceName(d.instance_name || "");
        setEvolutionApiUrl(d.evolution_api_url || "");
        if (d.instance_name && d.evolution_api_url && d.status === "active") {
          setIsConfigured(true);
        }
      }
    })();
  }, [user, agentId]);

  const handleSave = async () => {
    if (!user) return;
    if (!instanceName.trim() || !evolutionApiUrl.trim() || !evolutionApiKey.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      // Encrypt the API key
      const { data: encrypted, error: encErr } = await supabase.rpc("encrypt_api_key", {
        p_key: evolutionApiKey,
      });

      if (encErr) throw encErr;

      if (connectionId) {
        await supabase
          .from("whatsapp_connections" as any)
          .update({
            instance_name: instanceName.trim(),
            evolution_api_url: evolutionApiUrl.trim().replace(/\/$/, ""),
            evolution_api_key_encrypted: encrypted,
            webhook_url: webhookUrl,
            service_type: "evolution",
            status: "active",
          } as any)
          .eq("id", connectionId);
      } else {
        const { data: newConn } = await supabase
          .from("whatsapp_connections" as any)
          .insert({
            user_id: user.id,
            agent_id: agentId,
            instance_name: instanceName.trim(),
            evolution_api_url: evolutionApiUrl.trim().replace(/\/$/, ""),
            evolution_api_key_encrypted: encrypted,
            webhook_url: webhookUrl,
            service_type: "evolution",
            status: "active",
          } as any)
          .select("id")
          .single();

        if (newConn) setConnectionId((newConn as any).id);
      }

      setIsConfigured(true);
      setEvolutionApiKey(""); // Clear key from state after saving
      toast.success("Configuração salva com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(142,70%,45%)]/20">
          <Smartphone className="h-6 w-6 text-[hsl(142,70%,45%)]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">WhatsApp via Evolution API</h3>
          <p className="text-sm text-white/50">
            Conecte o agente <strong className="text-white">{agentName || "IA"}</strong> ao WhatsApp
          </p>
        </div>
      </div>

      {/* Step 1: Configure Evolution API */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-bold">1</span>
          Configurar Evolution API
        </h4>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">URL da Evolution API *</label>
            <Input
              placeholder="https://sua-evolution-api.com"
              value={evolutionApiUrl}
              onChange={(e) => setEvolutionApiUrl(e.target.value)}
              className="border-white/10 bg-white/[0.05] text-white text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">Nome da Instância *</label>
            <Input
              placeholder="minha-instancia"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className="border-white/10 bg-white/[0.05] text-white text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/60">
              API Key da Evolution API * {isConfigured && <span className="text-[hsl(142,70%,45%)]">(já salva — preencha apenas para alterar)</span>}
            </label>
            <Input
              type="password"
              placeholder={isConfigured ? "••••••••••" : "Sua API Key"}
              value={evolutionApiKey}
              onChange={(e) => setEvolutionApiKey(e.target.value)}
              className="border-white/10 bg-white/[0.05] text-white text-sm"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || (!evolutionApiKey.trim() && !isConfigured)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isConfigured ? "Atualizar Configuração" : "Salvar Configuração"}
          </Button>
        </div>
      </div>

      {/* Step 2: Webhook URL */}
      <div className={`rounded-xl border p-5 space-y-3 ${isConfigured ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-50"}`}>
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-bold">2</span>
          Configurar Webhook na Evolution API
        </h4>

        {isConfigured && (
          <div className="space-y-3">
            <p className="text-xs text-white/50">
              Copie a URL abaixo e cole no campo de <strong>Webhook URL</strong> da sua instância na Evolution API.
              Marque o evento <code className="bg-white/10 px-1 rounded text-[hsl(142,70%,45%)]">MESSAGES_UPSERT</code>.
            </p>

            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="border-white/10 bg-white/[0.05] text-white font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleCopy(webhookUrl, "webhook")}
                className="shrink-0 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {copied === "webhook" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Instructions */}
      <div className={`rounded-xl border p-5 space-y-3 ${isConfigured ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-50"}`}>
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs text-primary font-bold">3</span>
          Como funciona
        </h4>

        {isConfigured && (
          <ol className="list-decimal list-inside space-y-2 text-sm text-white/60">
            <li>Cole a URL do webhook na configuração da sua instância <strong className="text-white">{instanceName}</strong></li>
            <li>Marque apenas o evento <code className="bg-white/10 px-1 rounded">MESSAGES_UPSERT</code></li>
            <li>Quando um aluno enviar uma mensagem no WhatsApp, o agente responderá automaticamente</li>
            <li>O histórico das últimas 20 mensagens é mantido para contexto</li>
          </ol>
        )}
      </div>

      {/* Status badge */}
      {isConfigured && (
        <div className="rounded-xl border border-[hsl(142,70%,45%)]/30 bg-[hsl(142,70%,45%)]/5 p-4 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[hsl(142,70%,45%)] animate-pulse" />
          <div>
            <p className="text-sm font-medium text-[hsl(142,70%,45%)]">Integração Ativa</p>
            <p className="text-xs text-white/50">
              Instância: <strong className="text-white">{instanceName}</strong> • Agente: <strong className="text-white">{agentName || "IA"}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
