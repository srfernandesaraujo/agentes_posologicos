import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { PulseAvatar } from "@/components/ds/PulseAvatar";
import type { SquadAgent, SquadTask } from "@/hooks/useSquads";
import { fmtUsd } from "./CostCapField";

const dur = (ms: number | null) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

/** Linha de produção da missão: as etapas em ordem, quem faz cada uma e o que já foi entregue. */
export function MissionPipeline({ tasks, agents }: { tasks: SquadTask[]; agents: SquadAgent[] }) {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const ordered = [...tasks].sort((a, b) => a.position - b.position);
  const done = ordered.filter((t) => t.status === "done").length;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Linha de produção</h4>
        <span className="font-mono text-xs text-muted-foreground">{done} de {ordered.length} etapas</span>
      </div>
      <ol className="flex gap-0 overflow-x-auto pb-2" aria-label="Etapas da missão">
        {ordered.map((t, i) => {
          const a = byId.get(t.agent_id);
          const running = t.status === "running";
          const failed = t.status === "failed";
          const finished = t.status === "done";
          const prevDone = i > 0 && ordered[i - 1].status === "done";
          return (
            <li key={t.id} className="flex shrink-0 items-start">
              {i > 0 && (
                <span className="mt-[26px] h-0.5 w-6 shrink-0 rounded-full sm:w-10" style={{ background: prevDone ? "hsl(var(--dom-equipes))" : "hsl(var(--border))" }} aria-hidden="true" />
              )}
              <div className={`w-[150px] rounded-2xl border p-3 transition ${running ? "border-[hsl(var(--dom-equipes))] bg-[hsl(var(--dom-equipes)/0.08)]" : failed ? "border-[hsl(var(--destructive-vivid)/0.5)]" : "border-border bg-card"}`}>
                <div className="relative mb-2 w-fit">
                  <PulseAvatar name={a?.name || "Agente"} state={running ? "working" : "idle"} size={40} />
                  <span className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-card" style={{ background: finished ? "hsl(var(--dom-acervo))" : failed ? "hsl(var(--destructive-vivid))" : running ? "hsl(var(--dom-equipes))" : "hsl(var(--muted-foreground) / 0.5)" }}>
                    {finished ? <Check className="h-2.5 w-2.5 text-[hsl(208_46%_6%)]" /> : failed ? <AlertTriangle className="h-2.5 w-2.5 text-[hsl(208_46%_6%)]" /> : running ? <Loader2 className="h-2.5 w-2.5 animate-spin text-[hsl(208_46%_6%)]" /> : null}
                  </span>
                </div>
                <div className="truncate text-sm font-semibold text-foreground">{a?.name || "Agente"}</div>
                <div className="truncate text-[11px] text-muted-foreground">{a?.role}</div>
                <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-xs leading-snug text-foreground/80">{t.title}</p>
                <div className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
                  {finished ? `${fmtUsd(Number(t.cost_usd))}${t.duration_ms ? ` · ${dur(t.duration_ms)}` : ""}` : running ? "trabalhando…" : failed ? "falhou" : "na fila"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
