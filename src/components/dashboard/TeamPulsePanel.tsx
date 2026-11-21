import { useNavigate } from "react-router-dom";
import { ArrowRight, CircleHelp, ClipboardCheck, Mail, Video } from "lucide-react";
import { useSquads } from "@/hooks/useSquads";
import { ACTION_LABEL, awaitingCount, useTeamPulse } from "@/hooks/useTeamPulse";

/** "Aguardando você" e "Pulso das equipes": só aparece quando há algo a decidir ou algo em andamento. */
export function TeamPulsePanel() {
  const navigate = useNavigate();
  const { data: pulse } = useTeamPulse();
  const { data: squads = [] } = useSquads();
  if (!pulse) return null;

  const name = (id: string) => squads.find((s) => s.id === id)?.name ?? "Squad";
  const go = (squadId: string, tab?: string) => navigate(`/squads/${squadId}${tab ? `?aba=${tab}` : ""}`);

  const waiting = [
    ...pulse.actions.map((a) => ({ key: `a${a.id}`, icon: Mail, title: ACTION_LABEL[a.type], sub: a.payload?.subject || a.payload?.title || name(a.squad_id), squad: a.squad_id, tab: "conversa" })),
    ...pulse.questions.map((q) => ({ key: `q${q.id}`, icon: CircleHelp, title: "Pergunta do squad", sub: q.question, squad: q.squad_id, tab: "conversa" })),
    ...pulse.missions.filter((m) => m.status === "awaiting_approval").map((m) => ({ key: `m${m.id}`, icon: ClipboardCheck, title: "Entrega para aprovar", sub: m.briefing, squad: m.squad_id, tab: "missoes" })),
  ];
  const running = pulse.missions.filter((m) => m.status === "running");
  if (waiting.length === 0 && running.length === 0 && pulse.meetings.length === 0) return null;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {waiting.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.07)] p-5">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--warning))]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Aguardando você · {awaitingCount(pulse)}
          </h2>
          <ul className="space-y-2">
            {waiting.slice(0, 4).map((w) => (
              <li key={w.key}>
                <button onClick={() => go(w.squad, w.tab)} className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-pos-base px-3 py-2.5 text-left transition hover:border-[hsl(var(--warning))]">
                  <w.icon className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{w.title}</span>
                    <span className="block truncate text-xs text-white/50">{w.sub}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </button>
              </li>
            ))}
          </ul>
          {waiting.length > 4 && <p className="mt-2 text-xs text-white/40">e mais {waiting.length - 4}</p>}
        </div>
      )}

      {(running.length > 0 || pulse.meetings.length > 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Pulso das equipes</h2>
          <ul className="space-y-2">
            {pulse.meetings.slice(0, 2).map((m) => (
              <li key={m.id}>
                <button onClick={() => go(m.squad_id, "conversa")} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-pos-base px-3 py-2.5 text-left hover:border-[hsl(var(--dom-equipes))]">
                  <Video className="h-4 w-4 shrink-0 text-[hsl(var(--dom-equipes))]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{m.title}</span><span className="block text-xs text-white/45">Reunião aberta · {name(m.squad_id)}</span></span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--success))]" />
                </button>
              </li>
            ))}
            {running.slice(0, 3).map((m) => (
              <li key={m.id}>
                <button onClick={() => go(m.squad_id, "missoes")} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-pos-base px-3 py-2.5 text-left hover:border-[hsl(var(--dom-equipes))]">
                  <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => <i key={i} className="w-[3px] animate-pulse rounded-sm bg-[hsl(var(--dom-equipes))]" style={{ height: 4 + ((i * 5) % 11), animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{m.briefing}</span><span className="block text-xs text-white/45">Em andamento · {name(m.squad_id)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
