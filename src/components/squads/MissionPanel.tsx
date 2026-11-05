import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle, HelpCircle, Loader2, PauseCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  driveMission, useMissionDetail, useMissionRealtime, useSquadActions,
  type MissionStatus, type SquadAgent, type SquadDeliverable, type SquadEvent, type SquadQuestion, type SquadTemplateInfo,
} from "@/hooks/useSquads";
import { CostCapField, fmtUsd } from "./CostCapField";
import { OfficeSection } from "./office/OfficeSection";

export const MISSION_STATUS: Record<MissionStatus, { label: string; className: string }> = {
  running: { label: "Trabalhando", className: "border-sky-400/40 text-sky-300" },
  paused: { label: "Pausada (teto de custo)", className: "border-amber-400/40 text-amber-300" },
  awaiting_owner: { label: "Pergunta para você", className: "border-amber-400/60 text-amber-300" },
  awaiting_approval: { label: "Aguardando você", className: "border-[hsl(var(--accent))] text-[hsl(var(--accent))]" },
  completed: { label: "Concluída", className: "border-emerald-400/40 text-emerald-300" },
  failed: { label: "Falhou", className: "border-red-400/40 text-red-300" },
  cancelled: { label: "Cancelada", className: "border-white/20 text-white/50" },
};

const DELIVERABLE_STATUS: Record<SquadDeliverable["status"], { label: string; className: string }> = {
  done: { label: "Concluído", className: "border-white/20 text-white/60" },
  in_review: { label: "Aguardando você", className: "border-[hsl(var(--accent))] text-[hsl(var(--accent))]" },
  approved: { label: "Aprovado", className: "border-emerald-400/40 text-emerald-300" },
  changes_requested: { label: "Ajustes pedidos", className: "border-amber-400/40 text-amber-300" },
};

const EVENT_LABEL: Record<string, string> = {
  mission_started: "Missão iniciada",
  task_started: "Começou",
  task_done: "Terminou",
  task_failed: "Falhou",
  deliverable_created: "Entregou",
  budget_warning: "Aviso de custo",
  budget_paused: "Pausada por custo",
  budget_raised: "Teto ajustado",
  mission_ready: "Entrega pronta",
  mission_approved: "Aprovada",
  changes_requested: "Ajustes pedidos",
  mission_failed: "Missão falhou",
  pii_masked: "Dados mascarados",
  secrets_masked: "Segredos mascarados",
  question_asked: "Perguntou a você",
  question_answered: "Resposta recebida",
  task_skipped: "Etapa dispensada",
  memory_suggested: "Memória: sugestões novas",
  memory_saved: "Anotado na memória",
};

const SAFE_ANSWER = "Decida você: siga a opção mais segura e deixe a suposição registrada na entrega para eu conferir.";

/** Valores pequenos (frações de centavo) precisam de mais casas para não aparecerem como zero. */
function fmtUsdSmall(n: number): string {
  return n > 0 && n < 0.01 ? `US$ ${n.toFixed(4).replace(".", ",")}` : fmtUsd(n);
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

function QuestionCard({ q, agentName, busy, onAnswer }: { q: SquadQuestion; agentName: string; busy: boolean; onAnswer: (answer: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-4">
      <div className="flex items-center gap-2 text-amber-200"><HelpCircle className="h-4 w-4" /> {agentName} precisa de uma decisão sua para continuar</div>
      <p className="text-sm font-medium">{q.question}</p>
      {q.why && <p className="text-xs text-white/50">Por que isso importa: {q.why}</p>}
      {q.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <Button key={o} variant="outline" disabled={busy} onClick={() => onAnswer(o)} className="h-auto whitespace-normal border-white/20 bg-transparent py-2 text-left">{o}</Button>
          ))}
        </div>
      )}
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Ou escreva a sua resposta" aria-label="Sua resposta" className="min-h-[70px] bg-white/5 border-white/10" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !text.trim()} onClick={() => onAnswer(text)} className="gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar resposta
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onAnswer(SAFE_ANSWER)} className="text-white/60">Decida você (opção mais segura)</Button>
      </div>
    </div>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-sm prose-headings:text-white prose-p:text-white/80 prose-li:text-white/80 prose-strong:text-white prose-table:text-white/80">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function MissionPanel({
  missionId, squadId, agents, template, environment,
}: { missionId: string; squadId: string; agents: SquadAgent[]; template: SquadTemplateInfo; environment: string }) {
  const { data, isLoading } = useMissionDetail(missionId);
  useMissionRealtime(missionId, squadId);
  const { decide, raiseCap, answerQuestion } = useSquadActions();
  const [changeText, setChangeText] = useState("");
  const [asking, setAsking] = useState(false);
  const [newCap, setNewCap] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const mission = data?.mission;
  const driving = useRef<string | null>(null);

  // Mantém a missão andando enquanto a página está aberta. Se fechar, o agendador retoma depois.
  useEffect(() => {
    if (!mission || mission.status !== "running" || driving.current === mission.id) return;
    driving.current = mission.id;
    driveMission(mission.id)
      .catch((e) => toast.error(e.message || "A missão parou. O agendador vai retomar em alguns minutos."))
      .finally(() => { driving.current = null; });
  }, [mission?.id, mission?.status]);

  useEffect(() => { if (mission) setNewCap(Math.min(template.maxCapUsd, Math.max(Number(mission.cost_cap_usd) + 2, 1))); }, [mission?.id, mission?.cost_cap_usd, template.maxCapUsd]);

  if (isLoading || !mission) return <Loader2 className="h-6 w-6 animate-spin text-white/40" />;

  const agentById = new Map(agents.map((a) => [a.id, a]));
  const cost = Number(mission.cost_usd);
  const cap = Number(mission.cost_cap_usd);
  const pct = cap > 0 ? Math.min(100, (cost / cap) * 100) : 100;
  const status = MISSION_STATUS[mission.status];
  const finalDeliv = data!.deliverables.filter((d) => d.status === "in_review").slice(-1)[0];
  const doneCount = data!.tasks.filter((t) => t.status === "done").length;

  const onApprove = async () => {
    try { await decide.mutateAsync({ missionId, squadId, decision: "approve" }); toast.success("Entrega aprovada"); }
    catch (e: any) { toast.error(e.message); }
  };
  const onChanges = async () => {
    try {
      await decide.mutateAsync({ missionId, squadId, decision: "changes", comment: changeText });
      setChangeText(""); setAsking(false);
      toast.success("Pedido de ajustes enviado ao squad");
    } catch (e: any) { toast.error(e.message); }
  };
  const onAnswer = async (questionId: string, answer: string) => {
    try { await answerQuestion.mutateAsync({ questionId, missionId, squadId, answer }); toast.success("Resposta enviada, o squad vai continuar"); }
    catch (e: any) { toast.error(e.message); }
  };
  const openQuestions = data!.questions.filter((q) => q.status === "open");
  const answeredQuestions = data!.questions.filter((q) => q.status === "answered");
  const onRaise = async () => {
    try { await raiseCap.mutateAsync({ missionId, squadId, costCapUsd: newCap }); toast.success("Teto aumentado, o squad vai continuar"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <OfficeSection agents={agents} events={[...data!.events].reverse()} environment={environment} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={status.className}>{status.label}</Badge>
          {mission.trigger === "schedule" && <Badge variant="outline" className="border-white/20 text-white/60">Agendada</Badge>}
          <span className="text-sm text-white/50">{doneCount} de {data!.tasks.length} etapas</span>
        </div>
        <h3 className="text-lg font-semibold">{mission.briefing}</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/50">
            <span>Custo estimado {fmtUsdSmall(cost)} · {(Number(mission.tokens_input) + Number(mission.tokens_output)).toLocaleString("pt-BR")} tokens</span><span>Teto {fmtUsd(cap)}</span>
          </div>
          <Progress
            value={pct}
            aria-label="Custo usado do teto"
            className={`h-2 bg-white/10 ${pct >= 80 ? "[&>div]:bg-amber-400" : "[&>div]:bg-sky-400"}`}
          />
        </div>
        {mission.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {mission.error}
          </div>
        )}
      </div>

      {mission.status === "paused" && (
        <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="flex items-center gap-2 text-amber-200"><PauseCircle className="h-4 w-4" /> O squad parou ao atingir o teto de custo.</div>
          <CostCapField value={newCap} onChange={setNewCap} max={template.maxCapUsd} estimate={template.estimatedCostUsd} label="Novo teto" />
          <Button onClick={onRaise} disabled={raiseCap.isPending || newCap <= cost} className="gap-2">
            {raiseCap.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Aumentar teto e continuar
          </Button>
        </div>
      )}

      {mission.status === "awaiting_owner" && openQuestions.map((q) => (
        <QuestionCard key={q.id} q={q} agentName={agentById.get(q.agent_id || "")?.name || "O squad"} busy={answerQuestion.isPending} onAnswer={(a) => onAnswer(q.id, a)} />
      ))}

      {mission.status === "awaiting_approval" && finalDeliv && (
        <div className="space-y-3 rounded-lg border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 p-4">
          <p className="text-sm font-medium">A entrega final está pronta: “{finalDeliv.title}”. Leia abaixo e decida.</p>
          {!asking ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={onApprove} disabled={decide.isPending} className="gap-2">
                {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprovar
              </Button>
              <Button variant="outline" onClick={() => { setAsking(true); setOpenId(finalDeliv.id); }} className="border-white/20 bg-transparent">Pedir ajustes</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea value={changeText} onChange={(e) => setChangeText(e.target.value)} autoFocus
                placeholder="O que precisa mudar? Seja específico." className="min-h-[90px] bg-white/5 border-white/10" />
              <div className="flex gap-2">
                <Button onClick={onChanges} disabled={decide.isPending || !changeText.trim()} className="gap-2">
                  {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar ajustes
                </Button>
                <Button variant="ghost" onClick={() => setAsking(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-white/70">Equipe</h4>
        <ul className="space-y-1.5">
          {data!.tasks.map((t) => {
            const a = agentById.get(t.agent_id);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                {t.status === "done" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  : t.status === "running" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-300" />
                  : t.status === "failed" ? <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />
                  : <Circle className="h-4 w-4 shrink-0 text-white/20" />}
                <span className="font-medium">{a?.name || "Agente"}</span>
                <span className="text-white/40">{a?.role}</span>
                <span className="text-white/60">· {t.title}</span>
                {t.status === "done" && Number(t.cost_usd) > 0 && (
                  <span className="ml-auto font-mono text-xs text-white/40" title={`${t.tokens_input} tokens de entrada, ${t.tokens_output} de saída`}>
                    {t.model || "modelo"} · {fmtUsdSmall(Number(t.cost_usd))}{t.duration_ms ? ` · ${fmtDuration(t.duration_ms)}` : ""}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {answeredQuestions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-white/70">Perguntas e respostas</h4>
          <ul className="space-y-2 text-sm">
            {answeredQuestions.map((q) => (
              <li key={q.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-white/70">{agentById.get(q.agent_id || "")?.name || "Squad"}: {q.question}</div>
                <div className="mt-1 text-white">Você: {q.answer}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-white/70">Entregas ({data!.deliverables.length})</h4>
        {data!.deliverables.length === 0 ? (
          <p className="text-sm text-white/40">As entregas aparecem aqui assim que um agente terminar.</p>
        ) : (
          <div className="space-y-2">
            {[...data!.deliverables].reverse().map((d) => {
              const ds = DELIVERABLE_STATUS[d.status];
              const open = openId === d.id;
              return (
                <div key={d.id} className="rounded-lg border border-white/10 bg-white/5">
                  <button type="button" onClick={() => setOpenId(open ? null : d.id)}
                    className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title}{d.version > 1 && <span className="text-white/40"> · v{d.version}</span>}</div>
                      <div className="text-xs text-white/40">{agentById.get(d.agent_id || "")?.name || "Agente"} · {d.kind}{d.model ? ` · ${d.model}` : ""}</div>
                    </div>
                    <Badge variant="outline" className={ds.className}>{ds.label}</Badge>
                  </button>
                  {open && <div className="border-t border-white/10 p-4"><Markdown>{d.content}</Markdown></div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-white/70">Atividade</h4>
        <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-white/50">
          {data!.events.map((ev: SquadEvent) => (
            <li key={ev.id}>
              <span className="text-white/30">{new Date(ev.created_at).toLocaleTimeString("pt-BR")}</span>{" "}
              <span className="text-white/70">{agentById.get(ev.agent_id || "")?.name || "Sistema"}</span>{" "}
              {EVENT_LABEL[ev.type] || ev.type}{ev.text ? `: ${ev.text}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
