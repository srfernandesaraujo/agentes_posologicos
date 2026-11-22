import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AreaTrend } from "@/components/ds/AreaTrend";
import { CountUp } from "@/components/ds/CountUp";
import { PulseAvatar } from "@/components/ds/PulseAvatar";

interface Row { room_id: string; sender_name: string | null; created_at: string; role: string }
const HOUR = 3_600_000;

/** Atividade recente (últimos 7 dias) de várias salas, numa única consulta. */
export function useRoomActivity(roomIds: string[]) {
  const key = [...roomIds].sort();
  return useQuery({
    queryKey: ["room-activity", key],
    enabled: key.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
      const { data } = await supabase
        .from("room_messages")
        .select("room_id, sender_name, created_at, role")
        .in("room_id", key)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000);
      const byRoom = new Map<string, Row[]>();
      ((data || []) as Row[]).forEach((r) => byRoom.set(r.room_id, [...(byRoom.get(r.room_id) || []), r]));
      return byRoom;
    },
  });
}

/** Cabeçalho do cartão da sala: código grande, estado ao vivo, quem participa e o ritmo das últimas 24 horas. */
export function RoomActivityStrip({ pin, live, active, rows }: { pin: string | null; live: boolean; active: boolean; rows: Row[] | undefined }) {
  const { series, people, total24, latestAt } = useMemo(() => {
    const now = Date.now();
    const s = new Array(24).fill(0);
    const people = new Map<string, number>(); // nome -> última fala
    let total = 0;
    (rows || []).forEach((r) => {
      const t = new Date(r.created_at).getTime();
      const idx = 23 - Math.floor((now - t) / HOUR);
      if (idx >= 0 && idx < 24) { s[idx] += 1; total += 1; }
      if (r.role === "user" && r.sender_name) people.set(r.sender_name, Math.max(people.get(r.sender_name) || 0, t));
    });
    return { series: s, people: [...people.entries()].sort((a, b) => b[1] - a[1]), total24: total, latestAt: rows?.[0] ? new Date(rows[0].created_at).getTime() : 0 };
  }, [rows]);
  const now = Date.now();

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-[hsl(var(--dom-ensino)/0.06)] px-5 py-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">código</div>
        <div className="font-display text-4xl font-extrabold leading-none tracking-wider text-[hsl(var(--dom-ensino))]">{pin || "—"}</div>
      </div>

      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${live ? "border-[hsl(var(--destructive-vivid)/0.6)] text-[hsl(var(--destructive-vivid))]" : active ? "border-[hsl(var(--dom-acervo)/0.5)] text-[hsl(var(--dom-acervo))]" : "border-border text-muted-foreground"}`}>
        {live ? <Radio className="h-3 w-3 animate-pulse" /> : <i className={`h-1.5 w-1.5 rounded-full ${active ? "bg-current" : "bg-muted-foreground"}`} />}
        {live ? "aula ao vivo" : active ? "aberta" : "fechada"}
      </span>

      <div className="flex items-center">
        {people.slice(0, 5).map(([name, last], i) => (
          <span key={name} title={name} className="-ml-2 first:ml-0" style={{ zIndex: 10 - i }}>
            <PulseAvatar name={name} state={now - last < 10 * 60_000 ? "working" : "idle"} tone="var(--dom-ensino)" size={30} className="border-2 border-card" />
          </span>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">
          {people.length === 0 ? "ninguém participou ainda" : <><CountUp value={people.length} duration={0.6} /> {people.length === 1 ? "participante" : "participantes"}</>}
        </span>
      </div>

      <div className="ml-auto flex min-w-[160px] flex-1 items-center gap-3 sm:max-w-[260px]">
        <div className="min-w-0 flex-1">
          <AreaTrend values={series} color="hsl(var(--dom-ensino))" height={36} className="w-full" label="Mensagens por hora, últimas 24 horas" />
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">24 h · {total24} mensagens{latestAt ? "" : ""}</div>
        </div>
      </div>
    </div>
  );
}
