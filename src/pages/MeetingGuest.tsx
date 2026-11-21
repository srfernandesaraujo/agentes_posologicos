import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ExternalLink, Eye, FileSpreadsheet, FileText, Loader2, LogOut, Send, Users } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MinutesCard } from "@/components/squads/SquadChat";
import { agentLook } from "@/lib/squadOffice";
import { ROLE_LABEL, useGuestActions, useGuestView, type GuestMessage } from "@/hooks/useMeetingGuests";

const MAX_CHARS = 2000;

function Avatar({ name }: { name: string }) {
  const look = agentLook(name);
  return <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: look.shirt }}>{name.slice(0, 1).toUpperCase()}</span>;
}

function Message({ m, agentName, agentRole }: { m: GuestMessage; agentName?: string; agentRole?: string }) {
  if (m.author === "system") {
    return <div className="flex justify-center"><span className="rounded-full border border-dashed border-white/15 px-3 py-1 text-center text-xs text-white/50">{m.content}</span></div>;
  }
  const mt = m.meta?.meeting;
  if (m.author === "user") {
    const mine = !!mt?.mine;
    const who = mt?.author_name || "Anfitrião";
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[88%] space-y-1">
          <div className={`text-xs text-white/50 ${mine ? "text-right" : ""}`}>{mine ? "Você" : who}{mt?.author_role === "participant" ? "" : !mt?.author_name ? " · anfitrião" : ""}</div>
          <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm text-white ${mine ? "rounded-tr-sm bg-teal-600" : "rounded-tl-sm bg-sky-700/70"}`}>{m.content}</div>
        </div>
      </div>
    );
  }
  const sources = m.meta?.sources || [];
  const tool = mt?.tool;
  return (
    <div className="flex gap-2.5">
      <Avatar name={agentName || "?"} />
      <div className="min-w-0 max-w-[88%] space-y-1">
        <div className="text-xs text-white/50"><span className="font-semibold text-white/80">{agentName || "Agente"}</span>{agentRole ? ` · ${agentRole}` : ""}</div>
        {m.meta?.minutes_doc ? <MinutesCard doc={m.meta.minutes_doc} markdown={m.content} /> : (
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white/10 px-3.5 py-2 text-sm text-white/90">{m.content}</div>
        )}
        {tool && tool.name === "pubmed" && sources.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs" aria-label="Fontes da busca no PubMed">
            {sources.map((a) => (
              <li key={a.pmid}>
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-white/80 hover:text-teal-200"><ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /><span className="break-words">{a.title}</span></a>
                <div className="font-mono text-[10px] text-white/40">PMID {a.pmid} · {a.journal}{a.year ? `, ${a.year}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A reunião vista por um convidado: lê tudo, escreve se for participante. Sem controles do anfitrião. */
export default function MeetingGuest() {
  const { meetingId = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useGuestView(meetingId);
  const { say, leave } = useGuestActions(meetingId);
  const [text, setText] = useState("");
  const [minutesOpen, setMinutesOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const agentById = useMemo(() => new Map((data?.agents || []).map((a) => [a.id, a])), [data?.agents]);
  const messages = data?.messages || [];
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  if (isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" /></div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <p role="alert" className="text-sm text-muted-foreground">{(error as Error | null)?.message || "Não foi possível abrir esta reunião."}</p>
        <Button asChild variant="outline"><Link to="/agentes">Ir para o início</Link></Button>
      </div>
    );
  }

  const { meeting, role } = data;
  const open = meeting.status === "open";
  const canWrite = open && role === "participant";
  const submit = async () => {
    const t = text.trim();
    if (!t || say.isPending) return;
    try { await say.mutateAsync(t); setText(""); }
    catch (e: any) { toast.error(e.message || "Não foi possível enviar"); }
  };
  const doLeave = async () => {
    try { await leave.mutateAsync(); navigate("/agentes", { replace: true }); }
    catch (e: any) { toast.error(e.message || "Não foi possível sair"); }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1f1d] text-white">
      <div className="space-y-2.5 border-b border-teal-400/20 bg-teal-500/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-teal-300">
              {open && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-300" />} {open ? "Reunião ao vivo" : "Reunião encerrada"} · {ROLE_LABEL[role]}
            </div>
            <h1 className="truncate font-semibold">{meeting.title}</h1>
          </div>
          {role !== "host" && (
            <Button size="sm" variant="outline" className="h-8 gap-1 border-white/20 bg-transparent text-xs" disabled={leave.isPending} onClick={doLeave}><LogOut className="h-3.5 w-3.5" /> Sair da reunião</Button>
          )}
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label="Pauta">
          {meeting.agenda.map((it, i) => (
            <li key={i} title={it.decision ? `Decisão: ${it.decision}` : undefined}
              className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${it.done ? "border-teal-400/30 text-teal-200/80" : i === meeting.current_item && open ? "border-teal-300 bg-teal-500/20 text-white" : "border-white/15 text-white/50"}`}>
              {it.done ? <Check className="h-3 w-3 shrink-0" /> : <span className="font-mono text-[10px]">{i + 1}</span>}
              <span className="truncate">{it.title}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {data.people.map((p) => `${p.name} (${ROLE_LABEL[p.role]?.toLowerCase()})`).join(", ")}</span>
          {data.files.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {data.files.map((f) => <span key={f.id} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5">{f.kind === "sheet" ? <FileSpreadsheet className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{f.name}</span>)}
            </span>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20">
          <button type="button" onClick={() => setMinutesOpen((o) => !o)} aria-expanded={minutesOpen} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-white/70 hover:text-white">
            <span>Ata ao vivo {meeting.minutes_live_version > 0 ? <span className="font-mono text-white/40">· versão {meeting.minutes_live_version}</span> : null}</span>
            <span className="text-white/40">{minutesOpen ? "Esconder" : "Ver"}</span>
          </button>
          {minutesOpen && (
            <div className="border-t border-white/10 px-3 py-2.5">
              {meeting.minutes_live ? (
                <div className="prose prose-invert prose-sm max-w-none prose-headings:mb-1 prose-headings:mt-3 prose-p:my-1 prose-li:my-0"><ReactMarkdown remarkPlugins={[remarkGfm]}>{meeting.minutes_live}</ReactMarkdown></div>
              ) : <p className="text-xs text-white/45">A ata aparece aqui conforme a conversa avança.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversa da reunião">
        {messages.map((m) => {
          const a = m.agent_id ? agentById.get(m.agent_id) : undefined;
          return <Message key={m.id} m={m} agentName={a?.name} agentRole={a?.role} />;
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 p-3">
        {canWrite ? (
          <div className="flex items-end gap-2">
            <Textarea value={text} maxLength={MAX_CHARS} rows={2} placeholder="Escreva para a reunião. Use @nome para chamar um agente."
              aria-label="Mensagem" className="min-h-[44px] flex-1 resize-none bg-white/5 border-white/10" disabled={say.isPending}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
            <Button onClick={submit} disabled={!text.trim() || say.isPending} className="h-[44px] gap-1.5" aria-label="Enviar mensagem">
              {say.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/50">
            <Eye className="h-3.5 w-3.5" /> {!open ? "Esta reunião foi encerrada. Você pode reler a conversa e a ata." : "Você está como observador: pode acompanhar, mas não escrever."}
          </p>
        )}
        <p className="mt-1.5 text-center text-[10px] text-white/30">Os agentes são IA e podem errar. Não envie dados identificáveis de pacientes.</p>
      </div>
    </div>
  );
}
