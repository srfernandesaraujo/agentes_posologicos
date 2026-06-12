import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Workflow, ChevronDown, Coins, AlertCircle, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { exportConversationPdf } from "@/lib/exportConversationPdf";

interface SubResult {
  title: string;
  agent_slug: string;
  agent_name?: string;
  agent_category?: string;
  reason: string;
  prompt: string;
  output?: string;
  error?: string;
}
interface OrchestratorResult {
  rationale: string;
  results: SubResult[];
  dossier: string;
  cost: number;
}

const COST = 12;
const EXAMPLES = [
  "Preparar atendimento de paciente com DM2 + HAS + dislipidemia recém diagnosticado",
  "Montar uma aula de 90min sobre antibioticoterapia hospitalar para residentes",
  "Estruturar projeto de pesquisa sobre adesão a anticoagulantes em idosos",
];

export default function Orchestrator() {
  const { balance, refetch } = useCredits();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestratorResult | null>(null);

  const handleRun = async () => {
    if (goal.trim().length < 10) {
      toast.error("Descreva o objetivo com mais detalhes.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("agent-orchestrator", { body: { goal } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      refetch();
      toast.success("Dossiê pronto!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar orquestrador");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const fullMd = `# Dossiê: ${goal}\n\n## Roteamento\n${result.rationale}\n\n${result.results.map((r, i) =>
      `## Etapa ${i + 1}: ${r.title}\n*Agente: ${r.agent_name}*\n\n${r.output || `Erro: ${r.error}`}`
    ).join("\n\n")}\n\n---\n\n## Dossiê Consolidado\n${result.dossier}`;
    exportConversationPdf({
      agentName: "Agente Orquestrador",
      messages: [
        { role: "user", content: goal, created_at: new Date().toISOString() },
        { role: "assistant", content: fullMd, created_at: new Date().toISOString() },
      ],
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[hsl(220,25%,5%)] p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(174,62%,47%)] to-[hsl(220,80%,55%)]">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Agente Orquestrador</h1>
              <p className="text-sm text-white/60">Um único objetivo, múltiplos especialistas trabalhando em conjunto</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Coins className="h-3 w-3" /> Custo: {COST} créditos · Saldo: {balance}
          </div>
        </header>

        <Card className="border-white/10 bg-white/[0.03] p-4 mb-4">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Descreva seu objetivo em linguagem natural. Ex: preparar atendimento de paciente com DM2 + HAS..."
            className="min-h-[100px] border-white/10 bg-white/[0.04] text-white placeholder:text-white/30"
            disabled={loading}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setGoal(ex)}
                disabled={loading}
                className="text-xs px-2 py-1 rounded-md bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <Button
              onClick={handleRun}
              disabled={loading || goal.trim().length < 10}
              className="bg-[hsl(14,90%,58%)] hover:bg-[hsl(14,90%,52%)] text-white border-0 gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Orquestrando..." : `Executar (${COST} créditos)`}
            </Button>
          </div>
        </Card>

        {loading && (
          <Card className="border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white mb-3" />
            Decompondo o objetivo, roteando para especialistas e consolidando o dossiê...
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="border-[hsl(174,62%,47%)]/30 bg-[hsl(174,62%,47%)]/[0.05] p-4">
              <h2 className="text-sm font-semibold text-[hsl(174,62%,67%)] mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Raciocínio de roteamento
              </h2>
              <p className="text-sm text-white/80">{result.rationale}</p>
            </Card>

            <div>
              <h2 className="text-sm font-semibold text-white/80 mb-2">Etapas executadas ({result.results.length})</h2>
              <div className="space-y-2">
                {result.results.map((r, i) => (
                  <Collapsible key={i}>
                    <Card className="border-white/10 bg-white/[0.03] overflow-hidden">
                      <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(14,90%,58%)]/20 text-xs font-bold text-[hsl(14,90%,68%)]">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{r.title}</div>
                          <div className="text-xs text-white/50 truncate">{r.agent_name} · {r.reason}</div>
                        </div>
                        {r.error ? (
                          <Badge variant="destructive" className="shrink-0"><AlertCircle className="h-3 w-3 mr-1" />erro</Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 border-white/20 text-white/70">ok</Badge>
                        )}
                        <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-1 border-t border-white/5">
                          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Prompt enviado ao especialista</div>
                          <div className="text-xs text-white/60 italic mb-3 line-clamp-3">{r.prompt}</div>
                          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Resposta</div>
                          <div className="prose prose-sm prose-invert max-w-none text-white/85">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.output || `Erro: ${r.error}`}</ReactMarkdown>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </div>

            <Card className="border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white">📋 Dossiê Consolidado</h2>
                <Button
                  size="sm"
                  onClick={handleExport}
                  className="bg-white/[0.04] text-white hover:bg-white/10 hover:text-white gap-2"
                >
                  <Download className="h-3 w-3" /> Exportar PDF
                </Button>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-white/85">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.dossier}</ReactMarkdown>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}