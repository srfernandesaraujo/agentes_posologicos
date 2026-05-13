import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Loader2, Network, Plus, Trash2, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AgentSpec {
  name: string;
  role: string;
  receives_from: string;
  produces: string;
  is_router: boolean;
  branches: string[]; // declared by this router
  branch: string; // belongs to which branch
  is_synthesizer: boolean;
}

const emptyAgent = (): AgentSpec => ({
  name: "",
  role: "",
  receives_from: "",
  produces: "",
  is_router: false,
  branches: [],
  branch: "main",
  is_synthesizer: false,
});

type Step = "overview" | "agents" | "review" | "preflight" | "creating";

export function ComplexFlowWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("overview");
  const [flowName, setFlowName] = useState("");
  const [flowObjective, setFlowObjective] = useState("");
  const [inputType, setInputType] = useState<string>("text");
  const [agents, setAgents] = useState<AgentSpec[]>([emptyAgent(), emptyAgent()]);
  const [loading, setLoading] = useState(false);
  const [preflightQs, setPreflightQs] = useState<string[]>([]);
  const [preflightAns, setPreflightAns] = useState<Record<string, string>>({});

  const reset = () => {
    setStep("overview");
    setFlowName("");
    setFlowObjective("");
    setInputType("text");
    setAgents([emptyAgent(), emptyAgent()]);
    setLoading(false);
    setPreflightQs([]);
    setPreflightAns({});
  };

  const availableBranchesAt = (idx: number): string[] => {
    const set = new Set<string>(["main"]);
    for (let i = 0; i < idx; i++) {
      if (agents[i].is_router) for (const b of agents[i].branches) if (b.trim()) set.add(b.trim());
    }
    return Array.from(set);
  };

  const updateAgent = (i: number, patch: Partial<AgentSpec>) => {
    setAgents((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const moveAgent = (i: number, dir: -1 | 1) => {
    setAgents((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addAgent = () => setAgents((p) => (p.length >= 12 ? p : [...p, emptyAgent()]));
  const removeAgent = (i: number) => setAgents((p) => (p.length <= 2 ? p : p.filter((_, idx) => idx !== i)));

  const validateAgents = (): string | null => {
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a.name.trim()) return `Agente ${i + 1}: nome obrigatório.`;
      if (!a.role.trim()) return `Agente ${i + 1}: descrição obrigatória.`;
      if (a.is_router && a.branches.filter((b) => b.trim()).length < 2) {
        return `Agente ${i + 1} (roteador): declare ao menos 2 esteiras.`;
      }
      const allowed = availableBranchesAt(i);
      if (!allowed.includes(a.branch)) {
        return `Agente ${i + 1}: a esteira "${a.branch}" não foi declarada por nenhum roteador anterior.`;
      }
    }
    return null;
  };

  const submit = async (answers?: Record<string, string>) => {
    setLoading(true);
    try {
      const payload = {
        user_id: user?.id,
        flow_name: flowName,
        flow_objective: flowObjective,
        input_type: inputType,
        agents: agents.map((a) => ({
          name: a.name,
          role: a.role,
          receives_from: a.receives_from || undefined,
          produces: a.produces || undefined,
          is_router: a.is_router,
          branches: a.is_router ? a.branches.map((b) => b.trim()).filter(Boolean) : undefined,
          branch: a.branch,
          is_synthesizer: a.is_synthesizer,
        })),
        ...(answers ? { preflight_answers: answers } : {}),
      };
      const { data, error } = await supabase.functions.invoke("agent-flow-plan-complex", { body: payload });
      if (error) throw error;
      if (data?.needs_preflight && data?.preflight_questions?.length > 0) {
        setPreflightQs(data.preflight_questions);
        setPreflightAns(Object.fromEntries(data.preflight_questions.map((q: string) => [q, ""])));
        setStep("preflight");
        setLoading(false);
        return;
      }
      if (data?.flow_id) {
        toast.success("Fluxo complexo criado!");
        onOpenChange(false);
        reset();
        navigate(`/fluxos/${data.flow_id}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar fluxo complexo");
    } finally {
      setLoading(false);
    }
  };

  const diagram = useMemo(() => {
    return agents
      .map((a, i) => {
        const tag = a.is_router ? " [ROTEADOR]" : a.is_synthesizer ? " [CONSOLIDADOR]" : "";
        return `${i + 1}. (${a.branch}) ${a.name || "—"}${tag}`;
      })
      .join("\n");
  }, [agents]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-[hsl(var(--accent))]" />
            {step === "overview" && "Fluxo complexo — Visão geral"}
            {step === "agents" && "Fluxo complexo — Defina os agentes"}
            {step === "review" && "Fluxo complexo — Revisão"}
            {step === "preflight" && "Informações adicionais"}
            {step === "creating" && "Gerando fluxo complexo..."}
          </DialogTitle>
        </DialogHeader>

        {step === "overview" && (
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              Crie pipelines com roteamento condicional: enriquecimento → roteador → esteiras paralelas → consolidador.
            </p>
            <div>
              <Label className="text-white/90">Nome do fluxo</Label>
              <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} placeholder="Ex: Compras hospitalares — RP/Inex/Pregão" className="bg-white/5 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div>
              <Label className="text-white/90">Objetivo final</Label>
              <Textarea value={flowObjective} onChange={(e) => setFlowObjective(e.target.value)} placeholder="Ex: A partir da planilha de estoque, produzir os documentos de aquisição (RP, Inexigibilidade ou Pregão) prontos para o gestor." className="min-h-[100px] bg-white/5 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div>
              <Label className="text-white/90">Tipo de input inicial</Label>
              <Select value={inputType} onValueChange={setInputType}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto livre</SelectItem>
                  <SelectItem value="spreadsheet">Planilha (Excel/CSV)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep("agents")} disabled={!flowName.trim() || !flowObjective.trim()} className="gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "agents" && (
          <div className="space-y-4">
            <p className="text-sm text-white/80">Descreva cada agente do pipeline. Para criar esteiras paralelas, marque um agente como <span className="text-[hsl(var(--accent))] font-medium">Roteador</span> e declare os rótulos das esteiras.</p>
            {agents.map((a, i) => {
              const allowedBranches = availableBranchesAt(i);
              return (
                <Card key={i} className="bg-white/5 border-white/10 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-white/30 text-white">Agente {i + 1}</Badge>
                      <Badge variant="secondary" className="text-xs bg-white/10 text-white">esteira: {a.branch}</Badge>
                      {a.is_router && <Badge className="bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] text-xs">Roteador</Badge>}
                      {a.is_synthesizer && <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Consolidador</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveAgent(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => moveAgent(i, 1)} disabled={i === agents.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeAgent(i)} disabled={agents.length <= 2}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-white/90">Nome</Label>
                      <Input value={a.name} onChange={(e) => updateAgent(i, { name: e.target.value })} className="bg-white/5 border-white/20 text-white placeholder:text-white/40" placeholder="Ex: Analista de Estoque" />
                    </div>
                    <div>
                      <Label className="text-xs text-white/90">Esteira</Label>
                      <Select value={a.branch} onValueChange={(v) => updateAgent(i, { branch: v })}>
                        <SelectTrigger className="bg-white/5 border-white/20 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allowedBranches.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-white/90">O que faz</Label>
                    <Textarea value={a.role} onChange={(e) => updateAgent(i, { role: e.target.value })} placeholder="Ex: Lê a planilha, consulta consumo médio mensal e adiciona coluna GAP de aquisição." className="min-h-[60px] bg-white/5 border-white/20 text-white placeholder:text-white/40" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-white/90">Recebe de (opcional)</Label>
                      <Input value={a.receives_from} onChange={(e) => updateAgent(i, { receives_from: e.target.value })} className="bg-white/5 border-white/20 text-white placeholder:text-white/40" placeholder={i === 0 ? "input do usuário" : agents[i - 1]?.name || "etapa anterior"} />
                    </div>
                    <div>
                      <Label className="text-xs text-white/90">Produz</Label>
                      <Input value={a.produces} onChange={(e) => updateAgent(i, { produces: e.target.value })} className="bg-white/5 border-white/20 text-white placeholder:text-white/40" placeholder="Ex: Documento DFD, Justificativa, ETP, TR" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={a.is_router} onCheckedChange={(v) => updateAgent(i, { is_router: v, is_synthesizer: v ? false : a.is_synthesizer })} />
                      <Label className="text-xs text-white/90">Roteador (cria esteiras)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={a.is_synthesizer} onCheckedChange={(v) => updateAgent(i, { is_synthesizer: v, is_router: v ? false : a.is_router })} />
                      <Label className="text-xs text-white/90">Consolidador final</Label>
                    </div>
                  </div>
                  {a.is_router && (
                    <div>
                      <Label className="text-xs text-white/90">Esteiras criadas (uma por linha, ex: rp, inexigibilidade, pregao)</Label>
                      <Textarea
                        value={a.branches.join("\n")}
                        onChange={(e) => updateAgent(i, { branches: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                        placeholder={"rp\ninexigibilidade\npregao"}
                        className="min-h-[70px] bg-white/5 border-white/20 text-white placeholder:text-white/40 font-mono text-xs"
                      />
                    </div>
                  )}
                </Card>
              );
            })}
            <Button variant="outline" onClick={addAgent} disabled={agents.length >= 12} className="gap-2 w-full border-white/20 text-white hover:bg-white/10">
              <Plus className="h-4 w-4" /> Adicionar agente ({agents.length}/12)
            </Button>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("overview")} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={() => {
                const err = validateAgents();
                if (err) { toast.error(err); return; }
                setStep("review");
              }} className="gap-2">Próximo <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <Card className="bg-white/5 border-white/10 p-3">
              <p className="text-sm font-medium text-white">{flowName}</p>
              <p className="text-xs text-white/80 mt-1">{flowObjective}</p>
              <p className="text-xs text-white/70 mt-2">Input: {inputType} • Agentes: {agents.length} • Esteiras: {Array.from(new Set(agents.flatMap((a) => [a.branch, ...(a.is_router ? a.branches : [])]))).join(", ")}</p>
            </Card>
            <pre className="text-xs text-white/90 bg-black/40 border border-white/15 rounded p-3 whitespace-pre-wrap">{diagram}</pre>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("agents")} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={() => { setStep("creating"); submit(); }} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar fluxo complexo
              </Button>
            </div>
          </div>
        )}

        {step === "preflight" && (
          <div className="space-y-3">
            <p className="text-sm text-white/60">A IA precisa de algumas informações adicionais:</p>
            {preflightQs.map((q) => (
              <div key={q}>
                <Label className="text-xs">{q}</Label>
                <Textarea
                  value={preflightAns[q] || ""}
                  onChange={(e) => setPreflightAns((p) => ({ ...p, [q]: e.target.value }))}
                  className="min-h-[60px] bg-white/5 border-white/10"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <Button onClick={() => {
                const missing = preflightQs.filter((q) => !preflightAns[q]?.trim());
                if (missing.length) { toast.error("Responda todas as perguntas."); return; }
                setStep("creating");
                submit(preflightAns);
              }} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar fluxo
              </Button>
            </div>
          </div>
        )}

        {step === "creating" && (
          <div className="flex flex-col items-center gap-3 py-10 text-white/70">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
            <p className="text-sm">Construindo agentes premium e conectando esteiras...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}