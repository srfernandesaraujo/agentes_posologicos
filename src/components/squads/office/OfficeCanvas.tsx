import { useEffect, useMemo, useRef, useState } from "react";
import { eventToCommands, themeForEnvironment, type OfficeAgent, type RoomId, type Tone } from "@/lib/squadOffice";
import { applyCommand, makeSim, step, type Sim, type SimAgent } from "@/lib/squadOfficeSim";
import { drawAnimated, getStaticLayer } from "./officeScenes";
import type { SquadAgent, SquadEvent } from "@/hooks/useSquads";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: "#fffdf3", fg: "#1b2030" },
  ok: { bg: "#e6fbee", fg: "#14532d" },
  warn: { bg: "#fff1cf", fg: "#713f12" },
  bad: { bg: "#ffe1de", fg: "#7f1d1d" },
};

function drawAgent(ctx: CanvasRenderingContext2D, a: SimAgent, t: number, coat: boolean) {
  const px = Math.round(a.x) * 2;
  let py = Math.round(a.y) * 2;
  if (now() < a.hopUntil) py -= Math.abs(Math.sin(t * 9)) * 8;
  py = Math.round(py);
  const walking = a.moving;
  const sw = walking ? Math.floor(t * 8) % 2 : 0;
  const bob = walking ? (Math.floor(t * 8) % 2) * 2 : a.state === "work" ? Math.floor(t * 3) % 2 : 0;
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  rect(px - 9, Math.round(a.y) * 2 - 2, 18, 4, "rgba(0,0,0,.3)");
  rect(px - 6, py - 10 + (sw ? 0 : 2), 4, 10 - (sw ? 0 : 2), "#252a3d");
  rect(px + 2, py - 10 + (sw ? 2 : 0), 4, 10 - (sw ? 2 : 0), "#252a3d");
  rect(px - 8, py - 24 - bob, 16, 14, a.look.shirt);
  rect(px - 10, py - 22 - bob, 3, 9, a.look.shirt); rect(px + 7, py - 22 - bob, 3, 9, a.look.shirt);
  if (coat) {
    rect(px - 8, py - 24 - bob, 6, 14, "#f4f6f8"); rect(px + 2, py - 24 - bob, 6, 14, "#f4f6f8");
    rect(px - 10, py - 22 - bob, 3, 9, "#f4f6f8"); rect(px + 7, py - 22 - bob, 3, 9, "#f4f6f8");
  }
  rect(px - 8, py - 24 - bob, 16, 3, "rgba(255,255,255,.22)");
  rect(px - 6, py - 36 - bob, 12, 12, a.look.skin);
  rect(px - 7, py - 38 - bob, 14, 6, a.look.hair); rect(px - 7, py - 34 - bob, 2, 6, a.look.hair);
  rect(a.dir > 0 ? px + 1 : px - 4, py - 31 - bob, 3, 3, "#1b1b24");
  const sc = a.state === "work" || a.state === "meet" ? "#6ee7b7" : a.state === "walk" ? "#ffd166" : a.state === "wait" ? "#93c5fd" : "#8b93a8";
  rect(px - 3, py - 46 - bob, 6, 6, sc);
}

const now = () => performance.now() / 1000;

function drawBubble(ctx: CanvasRenderingContext2D, a: SimAgent) {
  if (!a.bubble) return;
  const tone = TONES[a.bubble.tone];
  ctx.font = "600 11px ui-monospace, Consolas, monospace";
  ctx.textBaseline = "middle";
  const w = Math.ceil(ctx.measureText(a.bubble.text).width) + 14, h = 20, cx = Math.round(a.x) * 2;
  const bx = Math.max(6, Math.min(640 - w - 6, cx - w / 2));
  const by = Math.max(6, Math.round(a.y) * 2 - 72);
  ctx.fillStyle = "#1b2030"; ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
  ctx.fillStyle = tone.bg; ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = "#1b2030"; ctx.fillRect(cx - 3, by + h + 2, 6, 4);
  ctx.fillStyle = tone.bg; ctx.fillRect(cx - 2, by + h, 4, 3);
  ctx.fillStyle = tone.fg; ctx.fillText(a.bubble.text, bx + 7, by + h / 2 + 1);
}

function drawNames(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.font = "700 9px ui-monospace, Consolas, monospace";
  ctx.textBaseline = "top"; ctx.textAlign = "center";
  sim.agents.forEach((a) => {
    const x = Math.round(a.x) * 2, y = Math.round(a.y) * 2 + 4, w = ctx.measureText(a.info.name).width + 8;
    ctx.fillStyle = "rgba(20,22,32,.78)"; ctx.fillRect(x - w / 2, y, w, 13);
    ctx.fillStyle = "#f3f0e6"; ctx.fillText(a.info.name, x, y + 2);
  });
  ctx.textAlign = "left";
}

interface Props {
  agents: SquadAgent[];
  events: SquadEvent[];
  environment: string;
}

/**
 * Escritório em pixel art. Cada movimento vem de um evento real gravado pelo motor (squad_events):
 * o histórico é aplicado de uma vez ao abrir; eventos novos (tempo real) animam os agentes.
 */
export function OfficeCanvas({ agents, events, environment }: Props) {
  const theme = themeForEnvironment(environment);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const [activity, setActivity] = useState<string>("");

  const officeAgents = useMemo<OfficeAgent[]>(
    () => agents.map((a) => ({ id: a.id, name: a.name, role: a.role, room: a.room as RoomId, sort_order: a.sort_order })),
    [agents],
  );
  const reduced = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  // Recria a simulação se o time mudar
  useEffect(() => { simRef.current = makeSim(officeAgents); }, [officeAgents]);

  // Aplica eventos reais: histórico instantâneo na primeira vez, depois animado
  useEffect(() => {
    if (!simRef.current) simRef.current = makeSim(officeAgents);
    const sim = simRef.current;
    const sorted = [...events].sort((a, b) => a.id - b.id);
    const fresh = sorted.filter((e) => e.id > sim.lastId);
    if (!fresh.length) return;
    const instant = !sim.initialized || reduced;
    const t = now();
    fresh.forEach((e) => {
      eventToCommands(e, officeAgents).forEach((c) => applyCommand(sim, c, t, instant));
      sim.lastId = e.id;
    });
    sim.initialized = true;
    const working = sim.agents.filter((a) => (a.state === "work" || (a.moving && a.after === "work")) && a.bubble);
    setActivity(working.map((a) => `${a.info.name}: ${a.bubble!.text}`).join(" · "));
  }, [events, officeAgents, reduced]);

  // Laço de animação
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now();
    const frame = (ts: number) => {
      const sim = simRef.current;
      const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
      const t = ts / 1000;
      if (sim) {
        step(sim, dt, now());
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, 640, 640);
        ctx.drawImage(getStaticLayer(theme), 0, 0);
        const occupied = new Set<RoomId>(sim.agents.map((a) => (a.room === "hall" ? a.destRoom : a.room)));
        const working = new Set<RoomId>(sim.agents.filter((a) => a.state === "work" || a.state === "meet").map((a) => a.room as RoomId));
        drawAnimated(ctx, theme, { t, occupied, working, deliverables: sim.deliverables });
        // papéis voando até a mesa da diretora
        const nowS = now();
        sim.papers.forEach((p) => {
          const k = Math.min(1, (nowS - p.start) / p.dur);
          const x = (p.from.x + (p.to.x - p.from.x) * k) * 2, y = (p.from.y + (p.to.y - p.from.y) * k - Math.sin(k * Math.PI) * 14) * 2;
          ctx.fillStyle = "#1b2030"; ctx.fillRect(x - 5, y - 4, 10, 8);
          ctx.fillStyle = "#fffdf3"; ctx.fillRect(x - 4, y - 3, 8, 6);
          ctx.fillStyle = "#9ca3af"; ctx.fillRect(x - 3, y - 1, 6, 1);
        });
        const order = [...sim.agents].sort((a, b) => a.y - b.y);
        order.forEach((a) => drawAgent(ctx, a, t, theme === "university"));
        drawNames(ctx, sim);
        order.forEach((a) => drawBubble(ctx, a));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [theme]);

  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded border-[3px] border-[#b79a5f] bg-[#1f2230] leading-[0] shadow-lg">
        <canvas
          ref={canvasRef} width={640} height={640} role="img"
          aria-label="Escritório do squad: agentes trabalhando nas salas conforme as tarefas reais da missão"
          className="block h-auto w-full max-w-[640px]" style={{ imageRendering: "pixelated", aspectRatio: "1 / 1" }}
        />
      </div>
      <figcaption className="min-h-[1.25rem] text-xs text-white/50" aria-live="polite">
        {activity ? <>Trabalhando agora: <span className="text-white/80">{activity}</span></> : "Ninguém trabalhando neste momento."}
      </figcaption>
    </figure>
  );
}
