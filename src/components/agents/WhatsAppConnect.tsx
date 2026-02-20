import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Smartphone, Copy, Check } from "lucide-react";
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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "kmpwowdvljizswkhwhtq";
  const generatedWebhookUrl = `https://${projectId}.supabase.co/functions/v1/agent-chat`;

  const handleGenerateWebhook = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Save/update the whatsapp connection with webhook info
      const { data: existing } = await supabase
        .from("whatsapp_connections" as any)
        .select("id")
        .eq("agent_id", agentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_connections" as any)
          .update({
            webhook_url: generatedWebhookUrl,
            service_type: "evolution",
            status: "active",
          } as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("whatsapp_connections" as any)
          .insert({
            user_id: user.id,
            agent_id: agentId,
            webhook_url: generatedWebhookUrl,
            service_type: "evolution",
            status: "active",
          } as any);
      }

      setWebhookUrl(generatedWebhookUrl);
      toast.success("Webhook gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar webhook");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const payloadExample = JSON.stringify(
    {
      agentId: agentId,
      input: "mensagem do usuário",
      isCustomAgent: true,
      isVirtualRoom: false,
    },
    null,
    2
  );

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
          <p className="text-sm text-white/50">Configure o webhook no seu Evolution API para conectar este agente</p>
        </div>
      </div>

      {!webhookUrl ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <h4 className="text-sm font-semibold text-white">Como funciona:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-white/60">
              <li>Clique em "Gerar Webhook" para criar a URL do endpoint</li>
              <li>No painel do Evolution API, configure esta URL como webhook da instância</li>
              <li>As mensagens recebidas no WhatsApp serão encaminhadas para o agente <strong className="text-white">{agentName || "IA"}</strong></li>
              <li>O agente processará e responderá automaticamente</li>
            </ol>
          </div>
          <Button
            onClick={handleGenerateWebhook}
            disabled={loading}
            className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white border-0 gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            Gerar Webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">URL do Webhook</label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="border-white/10 bg-white/[0.05] text-white font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleCopy(webhookUrl)}
                className="shrink-0 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Payload example */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Payload de exemplo (POST JSON)</label>
            <div className="relative">
              <pre className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-white/70 font-mono overflow-x-auto">
                {payloadExample}
              </pre>
              <button
                onClick={() => handleCopy(payloadExample)}
                className="absolute top-2 right-2 text-white/30 hover:text-white transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300/80">
              <strong>Dica:</strong> No Evolution API, configure este webhook como endpoint de mensagens recebidas. 
              O campo <code className="bg-white/10 px-1 rounded">input</code> deve conter o texto da mensagem do usuário.
            </p>
          </div>

          <Button variant="ghost" onClick={() => setWebhookUrl("")} className="text-white/40 hover:text-white hover:bg-white/10">
            Gerar novo webhook
          </Button>
        </div>
      )}
    </div>
  );
}
