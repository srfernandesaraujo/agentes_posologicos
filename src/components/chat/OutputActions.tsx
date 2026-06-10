import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Heart,
  Stethoscope,
  GraduationCap,
  ListChecks,
  MessageCircle,
  Loader2,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface OutputActionsProps {
  content: string;
}

const ACTIONS = [
  { key: "patient", label: "Material p/ paciente", icon: Heart, cost: 1, color: "text-pink-400" },
  { key: "clinical_case", label: "Caso clínico", icon: Stethoscope, cost: 2, color: "text-emerald-400" },
  { key: "lesson_plan", label: "Plano de aula", icon: GraduationCap, cost: 2, color: "text-cyan-400" },
  { key: "quiz", label: "Quiz (10 questões)", icon: ListChecks, cost: 2, color: "text-amber-400" },
  { key: "whatsapp", label: "Resumo WhatsApp", icon: MessageCircle, cost: 1, color: "text-green-400" },
] as const;

export function OutputActions({ content }: OutputActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ label: string; output: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (key: string, label: string) => {
    if (!content?.trim()) return;
    setLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke("agent-transform", {
        body: { transform: key, content },
      });
      if (error) throw error;
      if (data?.error === "insufficient_credits") {
        toast.error(`Créditos insuficientes (precisa de ${data.required}).`);
        return;
      }
      if (data?.error) throw new Error(data.error);
      setResult({ label, output: data.output });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao transformar conteúdo");
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-3">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/30">
          <Sparkles className="h-3 w-3" />
          Transformar em
        </span>
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const isLoading = loading === a.key;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => run(a.key, a.label)}
              disabled={loading !== null}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={`${a.label} — ${a.cost} crédito${a.cost > 1 ? "s" : ""}`}
            >
              {isLoading ? (
                <Loader2 className={`h-3 w-3 animate-spin ${a.color}`} />
              ) : (
                <Icon className={`h-3 w-3 ${a.color}`} />
              )}
              <span>{a.label}</span>
              <span className="ml-0.5 text-[9px] text-white/30">{a.cost}c</span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-[hsl(220,25%,8%)] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-orange-400" />
              {result?.label}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Conteúdo gerado a partir da resposta original.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-4">
            {result && (
              <div className="prose prose-invert max-w-none prose-sm prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-strong:text-white prose-table:text-white/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.output}</ReactMarkdown>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResult(null)} className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}