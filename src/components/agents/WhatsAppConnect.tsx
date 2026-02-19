import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check } from "lucide-react";

const SERVICE_TYPES = [
  { id: "official", name: "API Oficial do WhatsApp", needsToken: true, needsPhoneId: true },
  { id: "evolution", name: "Evolution API", needsToken: false, needsPhoneId: false },
  { id: "zapi", name: "Z-API", needsToken: false, needsPhoneId: false },
];

interface Props {
  agentId: string;
  onBack: () => void;
}

export function WhatsAppConnect({ agentId, onBack }: Props) {
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState("official");
  const [token, setToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [step, setStep] = useState<"select" | "webhook">("select");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedService = SERVICE_TYPES.find((s) => s.id === serviceType)!;

  const handleGenerateWebhook = async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat?agentId=${agentId}&source=whatsapp`;

      const { error } = await supabase
        .from("whatsapp_connections" as any)
        .upsert({
          user_id: user!.id,
          agent_id: agentId,
          service_type: serviceType,
          token: token || null,
          phone_number_id: phoneNumberId || null,
          webhook_url: url,
          status: "active",
        } as any, { onConflict: "agent_id" as any });

      if (error) throw error;

      setWebhookUrl(url);
      setStep("webhook");
      toast.success("Webhook gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar webhook");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (selectedService.needsToken && !token) {
      toast.error("Preencha o Token do Usuário do Sistema");
      return;
    }
    if (selectedService.needsPhoneId && !phoneNumberId) {
      toast.error("Preencha o ID do Número de Telefone");
      return;
    }
    await handleGenerateWebhook();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Webhook copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = async () => {
    toast.success("Configuração do WhatsApp finalizada!");
    onBack();
  };

  const serviceMessages: Record<string, string> = {
    official: "",
    evolution: 'Para a Evolution API, você só precisa gerar o webhook. Clique em "Gerar Webhook" para continuar.',
    zapi: 'Para a Z-API, você só precisa gerar o webhook. Clique em "Gerar Webhook" para continuar.',
  };

  const webhookInstructions: Record<string, string> = {
    official: "Configure este webhook nas configurações do seu App no Meta for Developers e ative o recebimento de mensagens.",
    evolution: "Configure este webhook na sua instância da Evolution API e ative os eventos base64 para receber mensagens.",
    zapi: "Configure este webhook no painel da Z-API para receber mensagens do WhatsApp.",
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h3 className="text-xl font-bold text-white">Conectar WhatsApp</h3>

      {step === "select" && (
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">Tipo de Serviço</label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="border-white/10 bg-white/[0.05] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedService.needsToken && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">Token do Usuário do Sistema</label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="border-white/10 bg-white/[0.05] text-white"
                placeholder="Cole seu token aqui..."
              />
            </div>
          )}

          {selectedService.needsPhoneId && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/70">ID do Número de Telefone</label>
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="border-white/10 bg-white/[0.05] text-white"
                placeholder="Ex: 123456789..."
              />
            </div>
          )}

          {serviceMessages[serviceType] && (
            <p className="text-sm text-white/50">{serviceMessages[serviceType]}</p>
          )}

          <div className="flex justify-end">
            {selectedService.needsToken ? (
              <Button onClick={handleVerify} disabled={loading} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                {loading ? "Verificando..." : "Verificar"}
              </Button>
            ) : (
              <Button onClick={handleGenerateWebhook} disabled={loading} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
                {loading ? "Gerando..." : "Gerar Webhook"}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === "webhook" && (
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              Webhook para configurar na {selectedService.name}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] p-3">
              <span className="flex-1 text-sm text-white/80 truncate">{webhookUrl}</span>
              <button onClick={handleCopy} className="shrink-0 text-white/50 hover:text-white transition-colors">
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-sm text-white/50">{webhookInstructions[serviceType]}</p>

          <div className="flex justify-end">
            <Button onClick={handleFinish} className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white">
              Finalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
