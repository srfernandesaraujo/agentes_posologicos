import { useEffect, useMemo, useRef, useState } from "react";
import { BellOff, BookMarked, Check, FileText, Hash, Loader2, Pencil, Send, Settings2, Trash2, Info, Users, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useChatActions, useChatMessages, useChatOfficeEvents, useChatUsage, useCitableDeliverables, useOpenQuestions, TEAM_THREAD, type ChatMessage } from "@/hooks/useSquadChat";
import { agentLook } from "@/lib/squadOffice";
import { driveMission, useSquadActions, useSquadMemories, type MemoryKind, type Squad, type SquadAgent, type SquadMemory, type SquadMission } from "@/hooks/useSquads";
import { useLiveMeeting, useLiveMeetingActions, PROACTIVITY_OPTIONS, type LiveMeeting, type Proactivity } from "@/hooks/useSquadMeeting";
import { OfficeSection } from "./office/OfficeSection";
import { QuestionCard } from "./MissionPanel";

const MEETING_MAX = 4;

const MAX_CHARS = 2000;
const MEMORY_MAX = 300;
const KIND_LABEL: Record<MemoryKind, string> = { preference: "Preferência", correction: "Evitar", decision: "Decisão", fact: "Fato" };

/** Valores de conversa são centavos: mostra mais casas quando o número é pequeno. */
function usd(n: number): string {
  const digits = n > 0 && n < 0.1 ? 4 : 2;
  return `US$ ${n.toFixed(digits).replace(".", ",")}`;
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const look = agentLook(name);
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ width: size, height: size, background: look.shirt }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Cartão de sugestão de memória: o agente propõe, você confirma, edita ou descarta. */
function MemorySuggestion({ items, squadId, memories }: { items: { id: string; kind: MemoryKind; content: string }[]; squadId: string; memories: SquadMemory[] }) {
  const { updateMemoryItem } = useSquadActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const byId = useMemo(() => new Map(memories.map((m) => [m.id, m])), [memories]);

  const run = async (id: string, patch: { content?: string; status?: "active" | "archived" }, ok: string) => {
    try { await updateMemoryItem.mutateAsync({ squadId, memoryId: id, ...patch }); toast.success(ok); setEditing(null); }
    catch (e: any) { toast.error(e.message || "Não foi possível salvar"); }
  };

  return (
    <div className="mx-auto w-full max-w-[88%] space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300"><BookMarked className="h-3.5 w-3.5" /> Guardar na memória do time?</div>
      {items.map((it) => {
        const live = byId.get(it.id);
        const status = live?.status ?? "suggested";
        const text = live?.content ?? it.content;
        return (
          <div key={it.id} className="space-y-2 rounded-lg bg-black/20 p-2.5 text-sm">
            {editing === it.id ? (
              <div className="flex gap-2">
                <Input value={draft} maxLength={MEMORY_MAX} onChange={(e) => setDraft(e.target.value)} aria-label="Texto do item de memória" className="h-8 flex-1 bg-white/5 border-white/10" />
                <Button size="sm" className="h-8" disabled={draft.trim().length < 3 || updateMemoryItem.isPending} onClick={() => run(it.id, { content: draft, status: "active" }, "Guardado na memória")}>Salvar</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            ) : (
              <>
                <p className="break-words text-white/90"><span className="mr-1.5 rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/60">{KIND_LABEL[(live?.kind ?? it.kind) as MemoryKind] ?? "Preferência"}</span>{text}</p>
                {status === "suggested" ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-7 gap-1" disabled={updateMemoryItem.isPending} onClick={() => run(it.id, { status: "active" }, "Guardado na memória")}><Check className="h-3 w-3" /> Guardar</Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 border-white/20 bg-transparent" onClick={() => { setDraft(text); setEditing(it.id); }}><Pencil className="h-3 w-3" /> Editar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-white/50" disabled={updateMemoryItem.isPending} onClick={() => run(it.id, { status: "archived" }, "Sugestão descartada")}>Descartar</Button>
                  </div>
                ) : status === "active" ? (
                  <span className="text-xs text-teal-300">Guardada: vale para todos os agentes e para as próximas missões.</span>
                ) : (
                  <span className="text-xs text-white/40">Descartada.</span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Bubble({ m, agent, onMemory, onAdjust, children }: { m: ChatMessage; agent?: SquadAgent; onMemory: (text: string) => void; onAdjust: (text: string) => void; children?: React.ReactNode }) {
  if (m.author === "system") {
    if (m.meta?.memory) return <>{children}</>;
    const cls = m.meta?.error ? "border-red-400/40 text-red-300" : m.meta?.cap ? "border-amber-400/40 text-amber-300" : "border-white/15 text-white/50";
    return <div className="flex justify-center"><span className={`rounded-full border border-dashed px-3 py-1 text-center text-xs ${cls}`}>{m.content}</span></div>;
  }
  const action = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white/40 hover:bg-white/10 hover:text-white/80";
  if (m.author === "user") {
    const masked = (m.meta?.masked_pii?.length || m.meta?.masked_secrets?.length) as number | undefined;
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] space-y-1">
          {m.meta?.cited && <div className="flex justify-end"><span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60"><FileText className="h-3 w-3" /> {m.meta.cited.title} · v{m.meta.cited.version}</span></div>}
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-teal-600 px-3.5 py-2 text-sm text-white">{m.content}</div>
          {masked ? <div className="text-right text-[11px] text-amber-300/80">Dados pessoais ou segredos foram mascarados antes do envio ao modelo.</div> : null}
          <div className="flex justify-end"><button type="button" className={action} onClick={() => onMemory(m.content)}><BookMarked className="h-3 w-3" /> Guardar na memória</button></div>
        </div>
      </div>
    );
  }
  const meeting = m.meta?.meeting as { round?: number; summary?: boolean; minutes?: boolean; live?: boolean; why?: string; spontaneous?: boolean } | undefined;
  const highlighted = !!(meeting?.summary || meeting?.minutes);
  const meetingTag = meeting?.minutes ? "Ata da reunião" : meeting?.summary ? "Resumo da reunião" : meeting?.round ? `Reunião · rodada ${meeting.round}` : null;
  // Por que o agente entrou sem ser chamado: aparece para você entender e ajustar a proatividade.
  const why = meeting?.spontaneous && meeting?.why ? meeting.why : null;
  return (
    <div className="flex gap-2.5">
      <Avatar name={agent?.name || "?"} />
      <div className="min-w-0 max-w-[88%] space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-white/50">
          <span><span className="font-semibold text-white/80">{agent?.name || "Agente"}</span>{agent ? ` · ${agent.role}` : ""}</span>
          {meetingTag && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${highlighted ? "bg-teal-500/25 text-teal-200" : "bg-white/10 text-white/60"}`}>{meetingTag}</span>}
        </div>
        <div className={`whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-white/90 ${highlighted ? "border border-teal-400/40 bg-teal-500/10" : "bg-white/10"}`}>{m.content}</div>
        {why && <div className="font-mono text-[10px] text-amber-300/80">Entrou por conta própria: {why}</div>}
        {children}
        <div className="flex flex-wrap items-center gap-x-1 font-mono text-[10px] text-white/30">
          <span>{m.model ? `${m.model} · ` : ""}{usd(Number(m.cost_usd))}</span>
          <span className="mx-1 text-white/15">|</span>
          <button type="button" className={action} onClick={() => onMemory(m.content)}><BookMarked className="h-3 w-3" /> Guardar na memória</button>
          <button type="button" className={action} onClick={() => onAdjust(m.content)}><Wand2 className="h-3 w-3" /> Pedir ajuste</button>
        </div>
      </div>
    </div>
  );
}

/** Barra da reunião ao vivo: pauta, proatividade, silêncio, avanço de item, teto e encerramento (gera a ata). */
function LiveMeetingBar({ meeting, spent, busy, onControl, onEnd }: {
  meeting: LiveMeeting; spent: number; busy: boolean;
  onControl: (op: "set_proactivity" | "silence" | "unsilence" | "next_item" | "raise_cap", value?: unknown) => void; onEnd: () => void;
}) {
  const cap = Number(meeting.cap_usd);
  const silenced = !!meeting.silenced_until && new Date(meeting.silenced_until).getTime() > Date.now();
  const cur = meeting.current_item;
  const total = meeting.agenda.length;
  const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 100;
  const hint = PROACTIVITY_OPTIONS.find((o) => o.value === meeting.proactivity)?.hint;
  return (
    <div className="space-y-2.5 border-b border-teal-400/20 bg-teal-500/[0.06] px-4 py-3" role="region" aria-label="Reunião ao vivo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-teal-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" /> Reunião ao vivo</div>
          <div className="truncate font-semibold">{meeting.title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select value={meeting.proactivity} onValueChange={(v) => onControl("set_proactivity", v)}>
            <SelectTrigger className="h-8 w-36 border-white/15 bg-white/5 text-xs" aria-label="Nível de proatividade dos agentes"><SelectValue /></SelectTrigger>
            <SelectContent>{PROACTIVITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          {silenced ? (
            <Button size="sm" variant="outline" className="h-8 gap-1 border-amber-300/40 bg-transparent text-xs text-amber-200" disabled={busy} onClick={() => onControl("unsilence")}>
              <BellOff className="h-3.5 w-3.5" /> Em silêncio até {new Date(meeting.silenced_until!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · voltar
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 gap-1 border-white/20 bg-transparent text-xs" disabled={busy} onClick={() => onControl("silence", 10)}><BellOff className="h-3.5 w-3.5" /> Silêncio 10 min</Button>
          )}
          <Button size="sm" className="h-8 gap-1 text-xs" disabled={busy} onClick={onEnd}>Encerrar e gerar ata</Button>
        </div>
      </div>
      {hint && <p className="text-[11px] text-white/40">{hint}</p>}
      <ol className="flex flex-wrap gap-1.5" aria-label="Pauta">
        {meeting.agenda.map((it, i) => (
          <li key={i} title={it.decision ? `Decisão: ${it.decision}` : undefined}
            className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${it.done ? "border-teal-400/30 text-teal-200/80" : i === cur ? "border-teal-300 bg-teal-500/20 text-white" : "border-white/15 text-white/50"}`}>
            {it.done ? <Check className="h-3 w-3 shrink-0" /> : <span className="font-mono text-[10px]">{i + 1}</span>}
            <span className="truncate">{it.title}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-xs text-white/60">
          {cur < total ? <>Item {cur + 1} de {total}</> : <>Pauta concluída</>}
          {cur < total && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-white/60" disabled={busy} onClick={() => onControl("next_item")}>Seguir para o próximo</Button>}
        </div>
        <div className="flex min-w-[200px] flex-1 items-center justify-end gap-2 text-xs text-white/50">
          <span className="font-mono">{usd(spent)} de {usd(cap)}</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do teto da reunião">
            <div className={`h-full ${pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${Math.max(pct, spent ? 2 : 0)}%` }} />
          </div>
          {pct >= 80 && <Button size="sm" variant="outline" className="h-6 border-white/20 bg-transparent px-2 text-xs" disabled={busy} onClick={() => onControl("raise_cap", Math.round((cap + 0.5) * 100) / 100)}>+ US$ 0,50</Button>}
        </div>
      </div>
    </div>
  );
}

interface Props {
  squad: Squad;
  agents: SquadAgent[];
  /** Missão mais recente do squad: decide se "Pedir ajuste" vira ajuste na entrega final ou missão nova. */
  lastMission?: SquadMission | null;
  onOpenMission: (missionId: string) => void;
  onNewMission: (text: string) => void;
}

export function SquadChat({ squad, agents, lastMission, onOpenMission, onNewMission }: Props) {
  const [thread, setThread] = useState<string>(TEAM_THREAD);
  const [text, setText] = useState("");
  const [cited, setCited] = useState<{ id: string; title: string; version: number } | null>(null);
  const { data: all = [], isLoading } = useChatMessages(squad.id);
  const { data: usage } = useChatUsage(squad.id);
  const { data: citable = [] } = useCitableDeliverables(squad.id);
  const { data: memories = [] } = useSquadMemories(squad.id);
  const { data: chatEvents = [] } = useChatOfficeEvents(squad.id);
  const { data: openQuestions = [] } = useOpenQuestions(squad.id);
  const { send, setCap, clear, runMeeting } = useChatActions(squad.id);
  const { addMemory, decide, answerQuestion } = useSquadActions();
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingQuestion, setMeetingQuestion] = useState("");
  const [meetingPick, setMeetingPick] = useState<string[]>([]);
  const [meetingStage, setMeetingStage] = useState<string | null>(null);
  const [meetingAgenda, setMeetingAgenda] = useState("");
  const [meetingProactivity, setMeetingProactivity] = useState<Proactivity>("balanced");
  const { data: liveMeeting } = useLiveMeeting(squad.id);
  const live = useLiveMeetingActions(squad.id);
  const tickingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [capDraft, setCapDraft] = useState("");
  const [capOpen, setCapOpen] = useState(false);
  const [citeOpen, setCiteOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState<{ text: string; kind: MemoryKind } | null>(null);
  const [adjustDraft, setAdjustDraft] = useState<string | null>(null);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  // Mensagens ocultas (avaliação do turno, falas descartadas) só existem para contar custo.
  const messages = useMemo(() => all.filter((m) => m.thread === thread && !m.meta?.meeting?.hidden), [all, thread]);
  const inLive = !!liveMeeting && thread === TEAM_THREAD;
  const liveBusy = live.say.isPending || live.control.isPending || live.end.isPending || live.start.isPending;
  const liveSpent = useMemo(
    () => (liveMeeting ? all.reduce((s, m) => (m.meta?.meeting?.id === liveMeeting.id ? s + Number(m.cost_usd || 0) : s), 0) : 0),
    [all, liveMeeting],
  );
  // Proposta da diretora para seguir ao próximo item, ainda sem resposta (os botões só aparecem nela).
  const activeProposalId = useMemo(() => {
    if (!liveMeeting) return null;
    let found: string | null = null;
    for (const m of all) {
      const mt = m.meta?.meeting;
      if (mt?.id !== liveMeeting.id) continue;
      if (mt.propose_next === liveMeeting.current_item) found = m.id;
      if (mt.dismissed === liveMeeting.current_item) found = null;
    }
    return found;
  }, [all, liveMeeting]);
  const current = thread === TEAM_THREAD ? null : agentById.get(thread) || null;
  const exceeded = usage?.state === "exceeded";
  const awaitingApproval = lastMission?.status === "awaiting_approval";
  const meetingBusy = meetingStage !== null;

  // Reunião que parou no meio (página fechada, erro de rede): aberta mas sem o resumo. Dá para retomar de onde parou.
  const unfinishedMeeting = useMemo(() => {
    const started = new Map<string, number>();
    const summarized = new Set<string>();
    all.forEach((m, i) => {
      const mt = m.meta?.meeting as { id?: string; round?: number } | undefined;
      if (!mt?.id) return;
      if (mt.round === 0 && m.author === "system") started.set(mt.id, i);
      if (mt.round === 3 && m.author === "agent") summarized.add(mt.id);
    });
    const open = [...started.entries()].filter(([id]) => !summarized.has(id));
    return open.length ? open[open.length - 1][0] : null;
  }, [all]);

  const meetingCandidates = useMemo(() => agents.filter((a) => a.slug !== "diretora"), [agents]);
  const openMeeting = () => {
    setMeetingPick(meetingCandidates.slice(0, MEETING_MAX).map((a) => a.id));
    setMeetingQuestion("");
    setMeetingAgenda("");
    setMeetingProactivity("balanced");
    setMeetingOpen(true);
  };
  const togglePick = (id: string) => setMeetingPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MEETING_MAX ? p : [...p, id]));
  /** Abre a reunião ao vivo (pauta + proatividade). */
  const startLiveMeeting = async () => {
    if (!meetingQuestion.trim() || !meetingPick.length) return;
    setMeetingOpen(false);
    setThread(TEAM_THREAD);
    try {
      await live.start.mutateAsync({ title: meetingQuestion.trim(), agenda: meetingAgenda, participants: meetingPick, proactivity: meetingProactivity });
    } catch (e: any) {
      toast.error(e.message || "Não foi possível abrir a reunião");
    }
  };
  /** Só para reuniões antigas (3 etapas) que pararam no meio. */
  const resumeOldMeeting = async (resumeId: string) => {
    setThread(TEAM_THREAD);
    try {
      await runMeeting({ meetingId: resumeId }, setMeetingStage);
    } catch (e: any) {
      toast.error(e.message || "A reunião parou. Use Retomar reunião para continuar.");
    } finally {
      setMeetingStage(null);
    }
  };
  const liveControl = async (op: "set_proactivity" | "silence" | "unsilence" | "next_item" | "dismiss_proposal" | "raise_cap", value?: unknown) => {
    if (!liveMeeting) return;
    try { await live.control.mutateAsync({ meetingId: liveMeeting.id, op, value }); }
    catch (e: any) { toast.error(e.message || "Não foi possível aplicar"); }
  };
  const endLiveMeeting = async () => {
    if (!liveMeeting) return;
    try {
      const r = await live.end.mutateAsync({ meetingId: liveMeeting.id });
      toast.success(r.fallback ? "Reunião encerrada com a ata mínima (o modelo não respondeu)" : "Reunião encerrada. A ata está na conversa.");
    } catch (e: any) { toast.error(e.message || "Não foi possível encerrar"); }
  };

  // Batimento: enquanto a reunião está aberta e visível, a cada 45 s o servidor vê se a sala ficou parada e a diretora puxa a conversa.
  useEffect(() => {
    if (!liveMeeting) return;
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || tickingRef.current || liveBusy) return;
      tickingRef.current = true;
      try { await live.tick(liveMeeting.id); } finally { tickingRef.current = false; }
    }, 45_000);
    return () => window.clearInterval(id);
  }, [liveMeeting?.id, liveBusy]); // eslint-disable-line react-hooks/exhaustive-deps

  const answerFromChat = async (q: { id: string; mission_id: string }, answer: string) => {
    try {
      await answerQuestion.mutateAsync({ questionId: q.id, missionId: q.mission_id, squadId: squad.id, answer });
      toast.success("Resposta enviada, o squad vai continuar");
      // Quem leva a missão adiante é o painel da missão; como ele não está aberto aqui, retomamos em segundo plano.
      driveMission(q.mission_id).catch((e) => toast.error(e.message || "A missão parou. O agendador vai retomar em alguns minutos."));
    } catch (e: any) { toast.error(e.message || "Não foi possível responder"); }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, send.isPending, thread]);
  useEffect(() => { if (usage) setCapDraft(String(usage.capUsd)); }, [usage?.capUsd]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const t = text.trim();
    if (!t || send.isPending || liveBusy) return;
    const citing = cited;
    setText(""); setCited(null);
    try {
      // Com reunião aberta, o que você escreve no #time vai para a reunião (os agentes escolhem quem entra).
      if (inLive && liveMeeting) await live.say.mutateAsync({ meetingId: liveMeeting.id, text: t });
      else await send.mutateAsync({ thread, text: t, ...(citing ? { deliverableId: citing.id } : {}) });
    } catch (e: any) {
      setText(t); setCited(citing);
      toast.error(e.message || "Não foi possível enviar");
    }
  };

  const mention = (name: string) => setText((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}@${name} `);
  const saveCap = async () => {
    const n = Number(capDraft.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) { toast.error("Informe um valor maior que zero"); return; }
    try { await setCap.mutateAsync(n); toast.success("Teto da conversa atualizado"); setCapOpen(false); }
    catch (e: any) { toast.error(e.message || "Não foi possível salvar"); }
  };
  const wipe = async () => {
    try { await clear.mutateAsync(thread); toast.success("Conversa apagada"); }
    catch (e: any) { toast.error(e.message || "Não foi possível apagar"); }
  };

  const openMemory = (t: string) => setMemoryDraft({ text: t.replace(/\s+/g, " ").trim().slice(0, MEMORY_MAX), kind: "preference" });
  const saveMemory = async () => {
    if (!memoryDraft) return;
    try {
      await addMemory.mutateAsync({ squadId: squad.id, content: memoryDraft.text, kind: memoryDraft.kind });
      toast.success("Guardado na memória do time");
      setMemoryDraft(null);
    } catch (e: any) { toast.error(e.message || "Não foi possível guardar"); }
  };

  const sendAdjust = async () => {
    if (adjustDraft === null || !lastMission) return;
    try {
      await decide.mutateAsync({ missionId: lastMission.id, squadId: squad.id, decision: "changes", comment: adjustDraft });
      toast.success("Pedido de ajustes enviado ao squad");
      setAdjustDraft(null);
      onOpenMission(lastMission.id);
    } catch (e: any) { toast.error(e.message || "Não foi possível pedir o ajuste"); }
  };
  const toNewMission = () => {
    if (adjustDraft === null) return;
    onNewMission(adjustDraft);
    setAdjustDraft(null);
  };

  return (
    <div className="space-y-4">
      <OfficeSection agents={agents} events={chatEvents} environment={squad.environment} />

      {openQuestions.length > 0 && (
        <div className="space-y-3" role="region" aria-label="Perguntas do squad para você">
          {openQuestions.map((q) => (
            <QuestionCard key={q.id} q={q} agentName={agentById.get(q.agent_id || "")?.name || "O squad"} busy={answerQuestion.isPending} onAnswer={(a) => answerFromChat(q, a)} />
          ))}
        </div>
      )}

      <div className="grid overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] md:grid-cols-[210px_minmax(0,1fr)]">
        {/* conversas */}
        <nav aria-label="Conversas do squad" className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
          <button type="button" onClick={() => setThread(TEAM_THREAD)} aria-pressed={thread === TEAM_THREAD}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${thread === TEAM_THREAD ? "bg-teal-500/20" : "hover:bg-white/5"}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-black"><Hash className="h-4 w-4" /></span>
            <span><span className="block font-semibold leading-tight">time</span><span className="hidden text-xs text-white/50 md:block">todos os agentes</span></span>
          </button>
          <div className="hidden px-2.5 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-white/40 md:block">Mensagem direta</div>
          {agents.map((a) => (
            <button key={a.id} type="button" onClick={() => setThread(a.id)} aria-pressed={thread === a.id}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${thread === a.id ? "bg-teal-500/20" : "hover:bg-white/5"}`}>
              <Avatar name={a.name} />
              <span><span className="block font-semibold leading-tight">{a.name}</span><span className="hidden text-xs text-white/50 md:block">{a.role}</span></span>
            </button>
          ))}
        </nav>

        {/* conversa */}
        <div className="flex min-h-[460px] min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
            <div>
              <div className="font-semibold">{current ? current.name : "#time"}</div>
              <div className="text-xs text-white/50">
                {current ? `${current.role} · mensagem direta` : "Escreva sem @ e o roteador escolhe quem responde; use @Nome para chamar alguém"}
              </div>
            </div>
            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="gap-1.5 text-white/40 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /> Apagar conversa</Button></AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60">As mensagens {current ? `com ${current.name}` : "do #time"} serão apagadas. O que está na memória do time não muda. Não dá para desfazer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/20 bg-transparent">Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={wipe}>Apagar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {inLive && liveMeeting && (
            <LiveMeetingBar meeting={liveMeeting} spent={liveSpent} busy={liveBusy} onControl={liveControl} onEnd={endLiveMeeting} />
          )}

          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4" style={{ maxHeight: "58vh" }} aria-live="polite">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-md space-y-2 py-10 text-center text-sm text-white/50">
                <p>{current ? `Pergunte, discorde ou peça uma opinião a ${current.name}.` : "Converse com o time sem abrir uma missão."}</p>
                <p className="text-xs text-white/35">Os agentes conhecem a memória do time e o resultado da última missão. Eles só conversam: para mudar uma entrega, use "Pedir ajuste" ou abra uma missão nova. Diga "use sempre…" e eles sugerem guardar na memória.</p>
              </div>
            ) : (
              messages.map((m) => (
                <Bubble key={m.id} m={m} agent={m.agent_id ? agentById.get(m.agent_id) : undefined} onMemory={openMemory} onAdjust={(t) => setAdjustDraft(t.slice(0, 4000))}>
                  {m.meta?.memory?.items?.length ? <MemorySuggestion items={m.meta.memory.items} squadId={squad.id} memories={memories} /> : null}
                  {m.id === activeProposalId && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <Button size="sm" className="h-7 gap-1 text-xs" disabled={liveBusy} onClick={() => liveControl("next_item")}><Check className="h-3 w-3" /> Seguir para o próximo item</Button>
                      <Button size="sm" variant="outline" className="h-7 border-white/20 bg-transparent text-xs" disabled={liveBusy} onClick={() => liveControl("dismiss_proposal")}>Ainda não</Button>
                    </div>
                  )}
                </Bubble>
              ))
            )}
            {(send.isPending || live.say.isPending) && (
              <div className="flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {current ? `${current.name} está escrevendo…` : inLive ? "O time está ouvindo…" : "O time está pensando…"}</div>
            )}
            {live.end.isPending && (
              <div className="flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Escrevendo a ata…</div>
            )}
            <div ref={endRef} />
          </div>

          <div className="space-y-2 border-t border-white/10 p-3">
            {meetingBusy && (
              <div className="flex items-center gap-2 rounded-lg border border-teal-400/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-100"><Loader2 className="h-4 w-4 animate-spin" /> Reunião em andamento: {meetingStage}. Pode levar um minuto.</div>
            )}
            {!meetingBusy && !liveMeeting && unfinishedMeeting && thread === TEAM_THREAD && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                <span>Há uma reunião que parou no meio.</span>
                <Button size="sm" variant="outline" className="h-7 border-amber-300/40 bg-transparent" onClick={() => resumeOldMeeting(unfinishedMeeting)}>Retomar reunião</Button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {thread === TEAM_THREAD && agents.map((a) => (
                <button key={a.id} type="button" onClick={() => mention(a.name)} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/70 hover:border-teal-400/60">@{a.name}</button>
              ))}
              {thread === TEAM_THREAD && (
                <button type="button" onClick={openMeeting} disabled={meetingBusy || !!liveMeeting || exceeded || send.isPending || liveBusy || agents.length < 2}
                  title={liveMeeting ? "Já há uma reunião aberta. Encerre-a para abrir outra." : undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-teal-400/40 bg-teal-500/10 px-2.5 py-0.5 text-xs text-teal-100 hover:border-teal-300 disabled:opacity-50"><Users className="h-3 w-3" /> {liveMeeting ? "Reunião aberta" : "Reunião"}</button>
              )}
              <Popover open={citeOpen} onOpenChange={setCiteOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/70 hover:border-teal-400/60"><FileText className="h-3 w-3" /> Citar entrega</button>
                </PopoverTrigger>
                <PopoverContent className="max-h-72 w-80 space-y-1 overflow-y-auto border-white/10 bg-[hsl(220,25%,10%)] p-2 text-white">
                  {citable.length === 0 ? (
                    <p className="p-2 text-sm text-white/50">Nenhuma entrega ainda. Rode uma missão primeiro.</p>
                  ) : citable.map((d) => (
                    <button key={d.id} type="button" onClick={() => { setCited({ id: d.id, title: d.title, version: d.version }); setCiteOpen(false); }}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/10">
                      <span className="block font-medium">{d.title}</span>
                      <span className="block text-xs text-white/40">{d.kind} · versão {d.version} · {new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {cited && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 px-2.5 py-0.5 text-xs text-teal-200">
                  Citando: {cited.title} · v{cited.version}
                  <button type="button" aria-label="Remover entrega citada" onClick={() => setCited(null)} className="rounded-full p-0.5 hover:bg-white/10"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
            {exceeded ? (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">O teto mensal da conversa foi atingido. Aumente o teto abaixo para continuar.</p>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea value={text} maxLength={MAX_CHARS} rows={2}
                  placeholder={current ? `Escreva para ${current.name}…` : inLive ? "Fale na reunião… use @ para chamar alguém" : "Escreva para o time… use @ para chamar alguém"}
                  aria-label="Mensagem" disabled={meetingBusy} className="min-h-[44px] flex-1 resize-none bg-white/5 border-white/10"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
                <Button onClick={submit} disabled={!text.trim() || send.isPending || liveBusy || meetingBusy} className="h-[44px] gap-1.5" aria-label="Enviar mensagem">
                  {send.isPending || live.say.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* custo e teto */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white/60">Conversa deste mês</span>
            <span className="font-mono text-xs text-white/70">{usage ? `${usd(usage.spentUsd)} de ${usd(usage.capUsd)}` : "…"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={usage?.pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do teto mensal da conversa">
            <div className={`h-full ${usage?.state === "exceeded" ? "bg-red-400" : usage?.state === "warn" ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${Math.max(usage?.pct ?? 0, usage?.spentUsd ? 2 : 0)}%` }} />
          </div>
        </div>
        <Popover open={capOpen} onOpenChange={setCapOpen}>
          <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-1.5 border-white/20 bg-transparent"><Settings2 className="h-4 w-4" /> Ajustar teto</Button></PopoverTrigger>
          <PopoverContent className="w-72 space-y-3 border-white/10 bg-[hsl(220,25%,10%)] text-white">
            <p className="text-sm text-white/70">Teto mensal da conversa deste squad, em dólares. Fica separado do teto das missões.</p>
            <Input value={capDraft} inputMode="decimal" aria-label="Teto mensal em dólares" onChange={(e) => setCapDraft(e.target.value)} className="bg-white/5 border-white/10" />
            <Button size="sm" onClick={saveCap} disabled={setCap.isPending} className="w-full">Salvar teto</Button>
          </PopoverContent>
        </Popover>
        <p className="flex w-full items-start gap-1.5 text-xs text-white/40"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Cada resposta mostra o modelo e o custo. Aos 80% do teto aparece um aviso e aos 100% a conversa pausa até você aumentar o teto. A conversa usa as suas chaves de IA.</p>
      </div>

      {/* reunião */}
      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <DialogHeader>
            <DialogTitle>Reunião do time</DialogTitle>
            <DialogDescription className="text-white/60">
              Uma reunião ao vivo com pauta: você conversa, os agentes escutam e entram quando têm algo útil a dizer. A coordenação conduz a pauta e gera a ata no fim. Eles só opinam: a decisão é sua.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={meetingQuestion} maxLength={160} aria-label="Tema da reunião" className="bg-white/5 border-white/10"
              placeholder="Tema da reunião (ex.: escolher o tema do próximo livro)" onChange={(e) => setMeetingQuestion(e.target.value)} />
            <Textarea value={meetingAgenda} maxLength={800} rows={4} aria-label="Pauta da reunião" className="bg-white/5 border-white/10"
              placeholder={"Pauta, um item por linha (opcional, até 8):\nVendas dos últimos 12 meses\nCandidatos a tema\nDecisão e próximos passos"} onChange={(e) => setMeetingAgenda(e.target.value)} />
            <div className="space-y-1">
              <Select value={meetingProactivity} onValueChange={(v) => setMeetingProactivity(v as Proactivity)}>
                <SelectTrigger className="bg-white/5 border-white/10" aria-label="Nível de proatividade"><SelectValue /></SelectTrigger>
                <SelectContent>{PROACTIVITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-white/45">{PROACTIVITY_OPTIONS.find((o) => o.value === meetingProactivity)?.hint} Dá para mudar durante a reunião.</p>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-xs text-white/60">Quem participa (até {MEETING_MAX})</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {meetingCandidates.map((a) => {
                  const on = meetingPick.includes(a.id);
                  const full = !on && meetingPick.length >= MEETING_MAX;
                  return (
                    <label key={a.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${on ? "border-teal-400/60 bg-teal-500/15" : "border-white/10 bg-white/5"} ${full ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={on} disabled={full} onChange={() => togglePick(a.id)} className="accent-teal-500" />
                      <Avatar name={a.name} size={22} />
                      <span><span className="font-medium">{a.name}</span> <span className="text-xs text-white/50">{a.role}</span></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="text-xs text-white/45">
              Cada mensagem sua gasta uma avaliação barata e as falas dos agentes. A reunião tem teto próprio de US$ 1,00 (aviso aos 80%, pausa aos 100%, dá para aumentar) e conta no teto mensal da conversa. Ainda não medi o custo médio com modelo real.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMeetingOpen(false)}>Cancelar</Button>
            <Button onClick={startLiveMeeting} disabled={meetingQuestion.trim().length < 3 || !meetingPick.length || live.start.isPending} className="gap-1.5">
              {live.start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Iniciar reunião</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* guardar na memória */}
      <Dialog open={!!memoryDraft} onOpenChange={(o) => { if (!o) setMemoryDraft(null); }}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <DialogHeader>
            <DialogTitle>Guardar na memória do time</DialogTitle>
            <DialogDescription className="text-white/60">Escreva o item como uma regra curta e clara. Todos os agentes e as próximas missões vão usar.</DialogDescription>
          </DialogHeader>
          {memoryDraft && (
            <div className="space-y-3">
              <Textarea value={memoryDraft.text} maxLength={MEMORY_MAX} rows={3} aria-label="Texto do item de memória" className="bg-white/5 border-white/10"
                onChange={(e) => setMemoryDraft({ ...memoryDraft, text: e.target.value })} />
              <div className="flex items-center justify-between gap-3">
                <Select value={memoryDraft.kind} onValueChange={(v) => setMemoryDraft({ ...memoryDraft, kind: v as MemoryKind })}>
                  <SelectTrigger className="w-44 bg-white/5 border-white/10" aria-label="Tipo do item"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(KIND_LABEL) as MemoryKind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
                <span className="font-mono text-xs text-white/40">{memoryDraft.text.length}/{MEMORY_MAX}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMemoryDraft(null)}>Cancelar</Button>
            <Button onClick={saveMemory} disabled={addMemory.isPending || (memoryDraft?.text.trim().length ?? 0) < 3} className="gap-1.5">
              {addMemory.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* pedir ajuste */}
      <Dialog open={adjustDraft !== null} onOpenChange={(o) => { if (!o) setAdjustDraft(null); }}>
        <DialogContent className="border-white/10 bg-[hsl(220,25%,10%)] text-white">
          <DialogHeader>
            <DialogTitle>{awaitingApproval ? "Pedir ajuste na entrega final" : "Levar para uma missão nova"}</DialogTitle>
            <DialogDescription className="text-white/60">
              {awaitingApproval
                ? "A última missão está esperando a sua decisão. O texto abaixo vai como pedido de ajuste e o squad reescreve a entrega final."
                : lastMission
                  ? "A última missão já foi encerrada, então não dá para ajustá-la. O texto abaixo vai para o formulário de uma missão nova, onde você revisa antes de iniciar."
                  : "Ainda não há missão neste squad. O texto abaixo vai para o formulário da primeira missão, onde você revisa antes de iniciar."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={adjustDraft ?? ""} maxLength={4000} rows={6} aria-label="Texto do pedido" className="bg-white/5 border-white/10" onChange={(e) => setAdjustDraft(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustDraft(null)}>Cancelar</Button>
            {awaitingApproval ? (
              <Button onClick={sendAdjust} disabled={decide.isPending || !(adjustDraft ?? "").trim()} className="gap-1.5">
                {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar pedido de ajuste
              </Button>
            ) : (
              <Button onClick={toNewMission} disabled={!(adjustDraft ?? "").trim()}>Abrir missão nova com este texto</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
