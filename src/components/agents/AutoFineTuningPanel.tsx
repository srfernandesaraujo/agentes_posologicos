import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, RotateCcw, Check, X, History } from "lucide-react";

interface Props {
  agentId: string;
  agentType: "native" | "custom";
}

interface VersionRow {
  id: string;
  version: number;
  status: string;
  origin: string;
  change_summary: string | null;
  system_prompt: string;
  feedback_positive: number | null;
  feedback_negative: number | null;
  created_at: string;
}

export function AutoFineTuningPanel({ agentId, agentType }: Props) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [minFeedbacks, setMinFeedbacks] = useState(10);
  const [negThreshold, setNegThreshold] = useState(20);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: settings }, { data: vers }] = await Promise.all([
      supabase.from("agent_optimization_settings" as any).select("*").eq("agent_id", agentId).eq("agent_type", agentType).maybeSingle(),
      supabase.from("agent_prompt_versions" as any).select("*").eq("agent_id", agentId).eq("agent_type", agentType).order("version", { ascending: false }).limit(20),
    ]);
    if (settings) {
      setEnabled(Boolean((settings as any).auto_optimize_enabled));
      setAutoApply(Boolean((settings as any).auto_apply));
      setMinFeedbacks(Number((settings as any).min_feedbacks ?? 10));
      setNegThreshold(Math.round(Number((settings as any).negative_threshold ?? 0.2) * 100));
    }
    setVersions((vers as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (agentId) load(); /* eslint-disable-next-line */ }, [agentId, agentType]);

  const saveSettings = async () => {
    const { error } = await supabase.from("agent_optimization_settings" as any).upsert({
      agent_id: agentId, agent_type: agentType,
      auto_optimize_enabled: enabled, auto_apply: autoApply,
      min_feedbacks: minFeedbacks, negative_threshold: negThreshold / 100,
    }, { onConflict: "agent_id,agent_type" });
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Configurações salvas");
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-prompt-optimizer", {
        body: { agentId, agentType, force: true, triggeredBy: "manual" },
      });
      if (error) throw error;
      if ((data as any)?.skipped) {
        toast.info("Nada a otimizar agora: " + ((data as any).reason || ""));
      } else if ((data as any)?.error) {
        toast.error((data as any).error);
      } else {
        toast.success(`Nova versão v${(data as any).version} criada (${(data as any).status})`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao otimizar");
    } finally {
      setRunning(false);
    }
  };

  const act = async (versionId: string, action: "activate" | "reject") => {
    const { error } = await supabase.functions.invoke("agent-prompt-rollback", {
      body: { versionId, action },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(action === "activate" ? "Versão ativada" : "Versão rejeitada");
    await load();
  };

  if (loading) return <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-orange-400" />
          <h3 className="font-semibold">Auto Fine-Tuning</h3>
        </div>
        <p className="text-sm text-white/60">
          O agente analisa periodicamente os feedbacks (👍/👎 e comentários) recebidos e propõe versões melhoradas do system prompt.
        </p>

        <div className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3">
          <div>
            <div className="text-sm text-white">Habilitar auto fine-tuning</div>
            <div className="text-xs text-white/50">Roda diariamente quando há massa crítica de feedbacks.</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white/[0.04] p-3">
          <div>
            <div className="text-sm text-white">Aplicar automaticamente</div>
            <div className="text-xs text-white/50">Ativa a nova versão sem revisão manual (sempre versionado e revertível).</div>
          </div>
          <Switch checked={autoApply} onCheckedChange={setAutoApply} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-white/80"><span>Mínimo de feedbacks</span><span className="text-white/60">{minFeedbacks}</span></div>
          <Slider value={[minFeedbacks]} min={3} max={50} step={1} onValueChange={(v) => setMinFeedbacks(v[0])} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-white/80"><span>Limite de negativos para acionar</span><span className="text-white/60">{negThreshold}%</span></div>
          <Slider value={[negThreshold]} min={5} max={80} step={5} onValueChange={(v) => setNegThreshold(v[0])} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={saveSettings} className="bg-white/10 hover:bg-white/20 text-white border border-white/10">Salvar configurações</Button>
          <Button onClick={runNow} disabled={running} className="bg-orange-500 hover:bg-orange-600 text-white">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Otimizar agora
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <History className="h-4 w-4 text-blue-400" />
          <h3 className="font-semibold">Histórico de versões</h3>
        </div>
        {versions.length === 0 && <p className="text-sm text-white/50">Nenhuma versão registrada ainda.</p>}
        {versions.map((v) => (
          <div key={v.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">v{v.version}</span>
                <Badge variant="outline" className={
                  v.status === "active" ? "bg-green-500/15 text-green-300 border-green-500/30" :
                  v.status === "pending" ? "bg-orange-500/15 text-orange-300 border-orange-500/30" :
                  v.status === "rejected" ? "bg-red-500/15 text-red-300 border-red-500/30" :
                  "bg-white/5 text-white/50 border-white/10"
                }>{v.status}</Badge>
                <Badge variant="outline" className="bg-white/5 text-white/60 border-white/10">{v.origin === "auto_feedback" ? "automático" : "manual"}</Badge>
                <span className="text-xs text-white/40">{new Date(v.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex gap-1">
                {v.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => act(v.id, "activate")} className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 h-8">
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" onClick={() => act(v.id, "reject")} className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 h-8">
                      <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                    </Button>
                  </>
                )}
                {(v.status === "archived" || v.status === "rejected") && (
                  <Button size="sm" onClick={() => act(v.id, "activate")} className="bg-white/10 hover:bg-white/20 text-white/80 border border-white/10 h-8">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverter para esta
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-8" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                  {expandedId === v.id ? "Ocultar" : "Ver prompt"}
                </Button>
              </div>
            </div>
            {v.change_summary && <p className="text-xs text-white/60 mt-2">{v.change_summary}</p>}
            <div className="mt-1 text-[11px] text-white/40">👍 {v.feedback_positive ?? 0} · 👎 {v.feedback_negative ?? 0}</div>
            {expandedId === v.id && (
              <pre className="mt-3 max-h-80 overflow-auto rounded bg-black/40 p-3 text-xs text-white/80 whitespace-pre-wrap">{v.system_prompt}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
