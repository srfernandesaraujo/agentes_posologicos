import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Coins, ExternalLink, FileSearch, ListTree } from "lucide-react";
import { CountUp } from "@/components/ds/CountUp";
import { Gauge } from "@/components/ds/Gauge";
import { extractPubmedIds, usePubmedEvidenceGrades, type EvidenceGrade } from "@/components/chat/EvidenceCitation";
import { cn } from "@/lib/utils";

interface Msg { id: string; role: "user" | "assistant"; content: string }

interface Props {
  messages: Msg[];
  costPerUse: number;
  balance: number;
  unlimited: boolean;
  onJump: (id: string) => void;
}

const TIER_TONE: Record<EvidenceGrade["tier"], string> = {
  1: "var(--dom-acervo)",
  2: "var(--dom-inicio)",
  3: "var(--dom-ensino)",
  4: "var(--muted-foreground)",
  5: "var(--muted-foreground)",
};

const short = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

/** Painel de contexto do Chat: o que esta conversa já gastou, de onde vêm as fontes e um mapa para navegar nela. */
export function ChatContextPanel({ messages, costPerUse, balance, unlimited, onJump }: Props) {
  const navigate = useNavigate();
  const questions = useMemo(() => messages.filter((m) => m.role === "user"), [messages]);
  const pmids = useMemo(() => extractPubmedIds(messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n")), [messages]);
  const { data: grades } = usePubmedEvidenceGrades(pmids);
  const sorted = useMemo(() => [...pmids].sort((a, b) => (grades?.[a]?.tier ?? 9) - (grades?.[b]?.tier ?? 9)), [pmids, grades]);

  const spent = questions.length * costPerUse;
  const answersLeft = unlimited || costPerUse <= 0 ? null : Math.floor(balance / costPerUse);

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-[hsl(var(--pos-base))]/60 p-4 xl:flex" aria-label="Contexto da conversa">
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"><Coins className="h-3 w-3" /> Esta conversa</h2>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <Gauge value={unlimited || answersLeft === null ? 1 : Math.min(1, answersLeft / 50)} size={64} stroke={6} color="hsl(var(--dom-ensino))" label="Saldo em relação a 50 respostas">
            <Coins className="h-4 w-4 text-[hsl(var(--dom-ensino))]" />
          </Gauge>
          <dl className="min-w-0">
            <dd className="font-display text-2xl font-extrabold leading-none text-foreground">
              {unlimited ? "ilimitado" : <><CountUp value={spent} decimals={spent % 1 ? 1 : 0} /> <span className="text-sm font-medium text-muted-foreground">usados</span></>}
            </dd>
            <dt className="mt-1 text-xs text-muted-foreground">
              {unlimited ? "acesso sem custo por uso" : answersLeft !== null ? `saldo para ~${answersLeft} ${answersLeft === 1 ? "resposta" : "respostas"}` : ""}
            </dt>
          </dl>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{questions.length} {questions.length === 1 ? "pergunta" : "perguntas"} · {messages.length} mensagens</p>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"><FileSearch className="h-3 w-3" /> Fontes citadas · {sorted.length}</h2>
        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Quando o agente citar artigos do PubMed, eles aparecem aqui com o grau de evidência.</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((id) => {
              const g = grades?.[id];
              return (
                <li key={id}>
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/${id}/`} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs transition hover:border-[hsl(var(--dom-clinica))]">
                    <span className="font-mono text-foreground">PMID {id}</span>
                    {g && (
                      <span className="ml-auto rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide" style={{ color: `hsl(${TIER_TONE[g.tier]})`, borderColor: `hsl(${TIER_TONE[g.tier]} / 0.45)` }}>{g.label}</span>
                    )}
                    <ExternalLink className={cn("h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100", !g && "ml-auto")} />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {questions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"><ListTree className="h-3 w-3" /> Mapa da conversa</h2>
          <ol className="relative space-y-1 border-l border-border pl-3">
            {questions.map((q, i) => (
              <li key={q.id}>
                <button onClick={() => onJump(q.id)} className="group relative block w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  <span className="absolute -left-[17px] top-3 h-2 w-2 rounded-full border border-border bg-background transition group-hover:border-[hsl(var(--dom-clinica))] group-hover:bg-[hsl(var(--dom-clinica))]" />
                  <span className="mr-1 font-mono text-[10px] opacity-60">{i + 1}.</span>{short(q.content)}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-auto">
        <button onClick={() => navigate("/calculadora")} className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition hover:border-[hsl(var(--dom-clinica))]">
          <Calculator className="h-4 w-4 text-[hsl(var(--dom-clinica))]" /> Abrir a calculadora de dose
        </button>
      </section>
    </aside>
  );
}
