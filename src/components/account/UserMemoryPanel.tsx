import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Brain, Loader2, Save, Trash2, Eye, EyeOff } from "lucide-react";

interface Ctx {
  area_atuacao: string;
  public_target: string;
  tone_preference: string;
  institution: string;
  research_lines: string;
  restrictions: string;
  memory_enabled: boolean;
  auto_extract_enabled: boolean;
}

interface Fact {
  id: string;
  fact: string;
  active: boolean;
  confidence: number;
  created_at: string;
}

const DEFAULT_CTX: Ctx = {
  area_atuacao: "",
  public_target: "",
  tone_preference: "",
  institution: "",
  research_lines: "",
  restrictions: "",
  memory_enabled: true,
  auto_extract_enabled: true,
};

export function UserMemoryPanel() {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<Ctx>(DEFAULT_CTX);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from("user_profile_context" as any).select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_memory_facts" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (c) setCtx({ ...DEFAULT_CTX, ...(c as any) });
    setFacts((f as any) || []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { user_id: user.id, ...ctx };
    const { error } = await supabase
      .from("user_profile_context" as any)
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Memória atualizada");
  };

  const toggleFact = async (f: Fact) => {
    const { error } = await supabase.from("user_memory_facts" as any).update({ active: !f.active }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    setFacts(prev => prev.map(x => x.id === f.id ? { ...x, active: !x.active } : x));
  };

  const deleteFact = async (id: string) => {
    const { error } = await supabase.from("user_memory_facts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFacts(prev => prev.filter(x => x.id !== id));
  };

  const clearAll = async () => {
    if (!user) return;
    if (!confirm("Apagar TODOS os fatos memorizados? Esta ação é irreversível.")) return;
    const { error } = await supabase.from("user_memory_facts" as any).delete().eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setFacts([]);
    toast.success("Memória apagada");
  };

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-[hsl(180,80%,50%)]" />
        <h2 className="font-display text-xl font-semibold text-white">Memória do Usuário</h2>
      </div>
      <p className="mb-6 text-sm text-white/60">
        Os agentes usarão estas informações como contexto silencioso para personalizar as respostas — sem repeti-las de volta para você. Tudo é privado e pode ser desligado a qualquer momento.
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <Label htmlFor="mem-en" className="text-sm text-white/80">Usar memória nas conversas</Label>
              <Switch id="mem-en" checked={ctx.memory_enabled} onCheckedChange={v => setCtx({ ...ctx, memory_enabled: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <Label htmlFor="auto-en" className="text-sm text-white/80">Extrair fatos automaticamente</Label>
              <Switch id="auto-en" checked={ctx.auto_extract_enabled} onCheckedChange={v => setCtx({ ...ctx, auto_extract_enabled: v })} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Área de atuação" placeholder="Ex.: Farmácia clínica hospitalar" value={ctx.area_atuacao} onChange={v => setCtx({ ...ctx, area_atuacao: v })} />
            <Field label="Público que você atende" placeholder="Ex.: Estudantes do 5º período de Farmácia" value={ctx.public_target} onChange={v => setCtx({ ...ctx, public_target: v })} />
            <Field label="Tom preferido" placeholder="Ex.: Didático, com analogias simples" value={ctx.tone_preference} onChange={v => setCtx({ ...ctx, tone_preference: v })} />
            <Field label="Instituição" placeholder="Ex.: UFXX / Hospital ABC" value={ctx.institution} onChange={v => setCtx({ ...ctx, institution: v })} />
          </div>
          <div className="mt-3 grid gap-3">
            <AreaField label="Linhas de pesquisa / interesse" placeholder="Ex.: Antibioticoterapia em UTI, uso racional de antimicrobianos" value={ctx.research_lines} onChange={v => setCtx({ ...ctx, research_lines: v })} />
            <AreaField label="Restrições éticas / contextuais" placeholder="Ex.: Não citar marcas comerciais. Considerar diretrizes do SUS." value={ctx.restrictions} onChange={v => setCtx({ ...ctx, restrictions: v })} />
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar perfil
            </Button>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">Fatos memorizados ({facts.filter(f => f.active).length} ativos / {facts.length} totais)</h3>
              {facts.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAll} className="text-white/50 hover:text-red-400">
                  <Trash2 className="mr-1 h-3 w-3" /> Apagar tudo
                </Button>
              )}
            </div>
            {facts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">
                Nenhum fato extraído ainda. Conforme você conversa com os agentes, fatos relevantes sobre você aparecerão aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {facts.map(f => (
                  <div key={f.id} className={`flex items-center gap-3 rounded-xl border p-3 ${f.active ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-50"}`}>
                    <p className="flex-1 text-sm text-white/80">{f.fact}</p>
                    <Button size="icon" variant="ghost" onClick={() => toggleFact(f)} title={f.active ? "Desativar" : "Reativar"}>
                      {f.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteFact(f.id)} className="text-white/40 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-white/60">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="border-white/10 bg-white/5 text-white placeholder:text-white/30" />
    </div>
  );
}

function AreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-white/60">{label}</Label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className="border-white/10 bg-white/5 text-white placeholder:text-white/30" />
    </div>
  );
}