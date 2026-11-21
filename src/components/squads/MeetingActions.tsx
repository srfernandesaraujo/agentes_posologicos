import { useState } from "react";
import { Calendar, Check, ExternalLink, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  connectGoogleForActions, neededScope, useActionDecisions, useGoogleScopes, useMeetingActions, type MeetingAction,
} from "@/hooks/useMeetingActions";

const TYPE_LABEL = { email: "E-mail", evento: "Evento na agenda", aviso_convite: "Convite por e-mail" } as const;
const TYPE_ICON = { email: Mail, evento: Calendar, aviso_convite: UserPlus } as const;
const APPROVE_LABEL = { email: "Aprovar e enviar", evento: "Aprovar e criar o evento", aviso_convite: "Aprovar e enviar o convite" } as const;
const field = "bg-white/5 border-white/10 text-sm";

const asText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));
function initialDraft(a: MeetingAction): Record<string, string> {
  const p = a.payload;
  if (a.type === "email") return { to: asText(p.to), subject: asText(p.subject), body: asText(p.body) };
  if (a.type === "evento") return { title: asText(p.title), start: asText(p.start), durationMin: asText(p.durationMin), attendees: asText(p.attendees), description: asText(p.description) };
  return { to: asText(p.to), role: asText(p.role) || "observer", note: asText(p.note) };
}

/** Resumo de uma linha de uma ação já feita. */
function doneLine(a: MeetingAction): string {
  const p = a.payload;
  if (a.type === "email") return `E-mail "${p.subject}" enviado para ${asText(p.to)}`;
  if (a.type === "evento") return `Evento "${p.title}" criado para ${String(p.start || "").replace("T", " às ")}`;
  return `Convite enviado para ${asText(p.to)}`;
}

function ActionCard({ a, agentName, squadId, scopesOk, scopesKnown, busy, onApprove, onDiscard }: {
  a: MeetingAction; agentName: string; squadId: string; scopesOk: boolean; scopesKnown: boolean; busy: boolean;
  onApprove: (edits: Record<string, string>) => void; onDiscard: () => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(a));
  const [connecting, setConnecting] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const Icon = TYPE_ICON[a.type];
  const masked = a.masked.reduce((s, m) => s + m.count, 0);
  const reconnect = async () => {
    setConnecting(true);
    try { await connectGoogleForActions(squadId); }
    catch (e: any) { toast.error(e.message || "Não foi possível conectar o Google"); setConnecting(false); }
  };

  if (a.status === "done") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-400/20 bg-teal-500/[0.06] px-3 py-2 text-xs text-teal-100">
        <Check className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 break-words">{doneLine(a)}</span>
        {a.result?.link && <a href={a.result.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink className="h-3 w-3" /> Abrir</a>}
      </div>
    );
  }
  if (a.status === "executing") {
    const stale = a.decided_at && Date.now() - new Date(a.decided_at).getTime() > 2 * 60_000;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {TYPE_LABEL[a.type]}: executando...
        {stale && <span className="text-amber-300">Sem confirmação há mais de 2 minutos. Confira o Gmail ou a Agenda antes de repetir.</span>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.05] p-3 text-sm" aria-label={`Ação proposta: ${TYPE_LABEL[a.type]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300"><Icon className="h-3.5 w-3.5" /> {TYPE_LABEL[a.type]} proposto por {agentName}</div>
        <span className="text-[11px] text-white/45">Nada sai sem a sua aprovação</span>
      </div>

      {a.type === "email" && (<>
        <Input value={draft.to} onChange={set("to")} aria-label="Para" placeholder="Para (até 5 e-mails, separados por vírgula)" className={field} />
        <Input value={draft.subject} onChange={set("subject")} aria-label="Assunto" placeholder="Assunto" maxLength={150} className={field} />
        <Textarea value={draft.body} onChange={set("body")} aria-label="Texto do e-mail" rows={6} maxLength={5000} className={field} />
        <p className="text-[11px] text-white/40">O e-mail sai da sua conta Google e termina com "Enviado por você com apoio de IA".</p>
      </>)}
      {a.type === "evento" && (<>
        <Input value={draft.title} onChange={set("title")} aria-label="Título do evento" maxLength={120} className={field} />
        <div className="flex flex-wrap gap-2">
          <Input type="datetime-local" value={draft.start} onChange={set("start")} aria-label="Início (horário de Brasília)" className={`${field} w-56`} />
          <Input type="number" min={15} max={480} step={15} value={draft.durationMin} onChange={set("durationMin")} aria-label="Duração em minutos" className={`${field} w-28`} />
          <span className="self-center text-xs text-white/50">minutos · horário de Brasília</span>
        </div>
        <Input value={draft.attendees} onChange={set("attendees")} aria-label="Convidados" placeholder="Convidados (e-mails, opcional; eles recebem o convite do Google)" className={field} />
        <Textarea value={draft.description} onChange={set("description")} aria-label="Descrição" rows={3} maxLength={1500} className={field} />
      </>)}
      {a.type === "aviso_convite" && (<>
        <Input value={draft.to} onChange={set("to")} aria-label="Para" placeholder="E-mail de quem vai receber o convite" className={field} />
        <div className="flex items-center gap-2">
          <Select value={draft.role} onValueChange={(v) => setDraft((d) => ({ ...d, role: v }))}>
            <SelectTrigger className="h-9 w-44 border-white/15 bg-white/5 text-xs" aria-label="Papel do convidado"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="participant">Participante</SelectItem><SelectItem value="observer">Observador</SelectItem></SelectContent>
          </Select>
          <span className="text-[11px] text-white/45">O sistema cria um link novo (vale 7 dias) e envia por e-mail.</span>
        </div>
        <Textarea value={draft.note} onChange={set("note")} aria-label="Recado no convite" rows={2} maxLength={500} placeholder="Recado (opcional)" className={field} />
      </>)}

      {masked > 0 && <p className="text-[11px] text-amber-300/80">{masked} dado(s) pessoal(is) ou segredo(s) foram mascarados na proposta. Confira o texto antes de aprovar.</p>}
      {a.status === "failed" && a.error && <p role="alert" className="text-xs text-red-300">{a.error}</p>}

      {scopesKnown && !scopesOk ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-amber-200">Falta a permissão do Google para {a.type === "evento" ? "criar eventos na Agenda" : "enviar e-mails pelo Gmail"}.</p>
          <Button size="sm" className="h-8 text-xs" disabled={connecting} onClick={reconnect}>{connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Reconectar o Google</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={() => onApprove(draft)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {a.status === "failed" ? "Tentar de novo" : APPROVE_LABEL[a.type]}
          </Button>
        </div>
      )}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-white/55" disabled={busy} onClick={onDiscard}>Descartar</Button>
    </div>
  );
}

/** Cartões de ação da reunião ao vivo (só o anfitrião vê): o agente propõe, você edita e aprova, o sistema executa. */
export function MeetingActions({ meetingId, squadId, agentNames }: { meetingId: string; squadId: string; agentNames: Map<string, string> }) {
  const { data: actions = [] } = useMeetingActions(meetingId);
  const { data: google } = useGoogleScopes();
  const { approve, discard } = useActionDecisions(meetingId, squadId);
  const [working, setWorking] = useState<string | null>(null);
  const visible = actions.filter((a) => a.status !== "discarded");
  if (!visible.length) return null;

  const run = async (id: string, fn: () => Promise<unknown>, ok?: string) => {
    setWorking(id);
    try { await fn(); if (ok) toast.success(ok); }
    catch (e: any) { toast.error(e.message || "Não foi possível concluir"); }
    finally { setWorking(null); }
  };

  return (
    <div className="space-y-2 border-b border-amber-400/15 bg-black/10 px-4 py-3" role="region" aria-label="Ações propostas pelos agentes">
      {visible.map((a) => {
        const scopesKnown = !!google;
        const scopesOk = !google || (google.connected && google.scopes.split(/\s+/).includes(neededScope(a.type)));
        return (
          <ActionCard key={a.id + a.status} a={a} agentName={(a.agent_id && agentNames.get(a.agent_id)) || "um agente"} squadId={squadId}
            scopesOk={scopesOk} scopesKnown={scopesKnown} busy={working === a.id}
            onApprove={(edits) => run(a.id, () => approve.mutateAsync({ actionId: a.id, edits }), "Feito")}
            onDiscard={() => run(a.id, () => discard.mutateAsync(a.id), "Proposta descartada")} />
        );
      })}
    </div>
  );
}
