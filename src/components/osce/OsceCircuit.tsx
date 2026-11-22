import { Check } from "lucide-react";
import { Gauge } from "@/components/ds/Gauge";

interface Station { id: string; title: string; duration_minutes?: number | null }
interface Attempt { station_id: string; status: string }

interface Props {
  stations: Station[];
  currentIdx: number;
  elapsed: number;
  totalSec: number;
  status: string;
  attempts: Attempt[];
  participantsCount: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Circuito da prova: as estações em sequência, a atual com cronômetro em anel e o avanço de cada estação. */
export function OsceCircuit({ stations, currentIdx, elapsed, totalSec, status, attempts, participantsCount }: Props) {
  const running = status === "running";
  const finished = status === "finished" || status === "ended";
  const ratio = totalSec > 0 ? elapsed / totalSec : 0;
  const over = running && ratio > 1;
  const ringColor = over ? "hsl(var(--destructive-vivid))" : ratio > 0.8 ? "hsl(var(--warning))" : "hsl(var(--dom-ensino))";

  return (
    <div className="rounded-3xl border border-border bg-card p-5" role="region" aria-label="Circuito da prova">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Circuito</h2>
        <span className="font-mono text-xs text-muted-foreground">{stations.length} estações · {participantsCount} {participantsCount === 1 ? "aluno" : "alunos"}</span>
      </div>
      <ol className="flex items-start overflow-x-auto pb-2">
        {stations.map((st, i) => {
          const isCurrent = i === currentIdx && !finished;
          const passed = finished || (currentIdx >= 0 && i < currentIdx);
          const done = attempts.filter((a) => a.station_id === st.id && a.status === "completed").length;
          const frac = participantsCount > 0 ? Math.min(1, done / participantsCount) : 0;
          return (
            <li key={st.id} className="flex shrink-0 items-start">
              {i > 0 && <span className="mt-[34px] h-0.5 w-8 shrink-0 rounded-full sm:w-14" style={{ background: passed || isCurrent ? "hsl(var(--dom-ensino))" : "hsl(var(--border))" }} aria-hidden="true" />}
              <div className="flex w-[132px] flex-col items-center text-center">
                {isCurrent && running ? (
                  <Gauge value={Math.min(1, ratio)} size={84} stroke={7} color={ringColor} label={`Tempo da estação: ${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`}>
                    <span className={`font-display text-lg font-extrabold tabular-nums ${over ? "text-[hsl(var(--destructive-vivid))]" : "text-foreground"}`}>{pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}</span>
                  </Gauge>
                ) : (
                  <span className={`grid h-[68px] w-[68px] place-items-center rounded-full border-2 font-display text-xl font-extrabold ${passed ? "border-[hsl(var(--dom-ensino))] bg-[hsl(var(--dom-ensino)/0.16)] text-[hsl(var(--dom-ensino))]" : isCurrent ? "border-[hsl(var(--dom-ensino))] text-foreground" : "border-border text-muted-foreground"}`}>
                    {passed ? <Check className="h-6 w-6" /> : i + 1}
                  </span>
                )}
                <span className={`mt-2 line-clamp-2 min-h-[2.6em] text-xs leading-snug ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{st.title}</span>
                <span className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted" title={`${done} de ${participantsCount} concluíram`}>
                  <i className="block h-full rounded-full bg-[hsl(var(--dom-ensino))] transition-[width] duration-700" style={{ width: `${frac * 100}%` }} />
                </span>
                <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{done}/{participantsCount} concluídos</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
