import { useEffect, useMemo, useState } from "react";
import { Gauge } from "@/components/ds/Gauge";
import { PulseAvatar } from "@/components/ds/PulseAvatar";
import type { ChatMessage } from "@/hooks/useSquadChat";
import type { LiveMeeting } from "@/hooks/useSquadMeeting";
import type { SquadAgent } from "@/hooks/useSquads";

interface Props {
  meeting: LiveMeeting;
  agents: SquadAgent[];
  /** todas as mensagens do squad (a mesa filtra as desta reunião) */
  messages: ChatMessage[];
  spent: number;
}

const SPEAKING_WINDOW_MS = 25_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Mesa da Reunião Viva: os participantes em círculo, quem falou por último acende, e no centro o relógio e o teto de gasto. */
export function MeetingTable({ meeting, agents, messages, spent }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const seats = useMemo(() => {
    const picked = agents.filter((a) => meeting.participants.includes(a.id));
    return picked.length > 0 ? picked : agents;
  }, [agents, meeting.participants]);

  const { counts, lastId, lastAt } = useMemo(() => {
    const c = new Map<string, number>();
    let last: ChatMessage | null = null;
    for (const m of messages) {
      if (m.meta?.meeting?.id !== meeting.id || m.author !== "agent" || !m.agent_id) continue;
      c.set(m.agent_id, (c.get(m.agent_id) || 0) + 1);
      if (!last || m.created_at > last.created_at) last = m;
    }
    return { counts: c, lastId: last?.agent_id ?? null, lastAt: last ? new Date(last.created_at).getTime() : 0 };
  }, [messages, meeting.id]);

  const cap = Number(meeting.cap_usd);
  const pct = cap > 0 ? Math.min(1, spent / cap) : 1;
  const elapsed = Math.max(0, Math.floor((now - new Date(meeting.created_at).getTime()) / 1000));
  const clock = elapsed >= 3600 ? `${Math.floor(elapsed / 3600)}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}` : `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`;
  const total = meeting.agenda.length;
  const cur = meeting.current_item;
  const gaugeColor = pct >= 1 ? "hsl(var(--destructive-vivid))" : pct >= 0.8 ? "hsl(var(--warning))" : "hsl(var(--dom-equipes))";
  const speakerName = seats.find((a) => a.id === lastId)?.name;
  const speaking = lastId && now - lastAt < SPEAKING_WINDOW_MS;

  return (
    <div className="border-b border-white/10 px-4 py-4" role="region" aria-label="Mesa da reunião">
      <div className="relative mx-auto h-[250px] w-full max-w-[460px]">
        {/* mesa */}
        <div className="absolute inset-x-[14%] inset-y-[12%] rounded-[50%] border border-dashed border-[hsl(var(--dom-equipes)/0.35)] bg-[hsl(var(--dom-equipes)/0.05)]" aria-hidden="true" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Gauge value={pct} size={112} stroke={6} color={gaugeColor} label={`Gasto da reunião: ${Math.round(pct * 100)}% do teto`}>
            <div>
              <div className="font-brand text-xl font-extrabold tabular-nums text-foreground">{clock}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{cur < total ? `item ${cur + 1}/${total}` : "pauta feita"}</div>
            </div>
          </Gauge>
        </div>

        {seats.map((a, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / seats.length;
          const x = 50 + Math.cos(ang) * 40;
          const y = 50 + Math.sin(ang) * 40;
          const isSpeaking = !!speaking && a.id === lastId;
          const n = counts.get(a.id) || 0;
          return (
            <div key={a.id} className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center" style={{ left: `${x}%`, top: `${y}%` }}>
              <span className="relative">
                <PulseAvatar name={a.name} state={isSpeaking ? "working" : "idle"} size={isSpeaking ? 48 : 42} />
                {n > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-foreground px-1 font-mono text-[10px] font-bold text-background">{n}</span>}
              </span>
              <span className={`max-w-full truncate text-[11px] font-medium ${isSpeaking ? "text-foreground" : "text-muted-foreground"}`}>{a.name}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-center font-mono text-[11px] text-muted-foreground" aria-live="polite">
        {speaking && speakerName ? `${speakerName} está com a palavra` : "Mesa em silêncio. Faça uma pergunta ou chame alguém com @nome."}
      </p>
    </div>
  );
}
