import { useEffect, useMemo, useRef, useState } from "react";
import { eventToCommands, themeForEnvironment, type OfficeAgent, type RoomId, type Tone } from "@/lib/squadOffice";
import { applyCommand, makeSim, step, type Sim, type SimAgent } from "@/lib/squadOfficeSim";
import { drawAnimated, getStaticLayer } from "./officeScenes";
import { drawAgentSprite } from "./officeSprites";
import type { SquadAgent, SquadEvent } from "@/hooks/useSquads";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  info: { bg: "#fffdf3", fg: "#1b2030" },
  ok: { bg: "#e6fbee", fg: "#14532d" },
  warn: { bg: "#fff1cf", fg: "#713f12" },
  bad: { bg: "#ffe1de", fg: "#7f1d1d" },
};

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
    () => agents.map((a) => ({ id: a.id, name: a.name, role: a.role, room: a.room as RoomId, sort_order: a.sort_order, slug: a.slug })),
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
        // luz de mesa acesa para quem está trabalhando
        order.forEach((a) => {
          if (a.state !== "work" || a.moving) return;
          const gx = Math.round(a.x) * 2, gy = Math.round(a.y) * 2 - 6;
          const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 44);
          g.addColorStop(0, "rgba(255,226,150,.26)"); g.addColorStop(1, "rgba(255,226,150,0)");
          ctx.fillStyle = g; ctx.fillRect(gx - 44, gy - 44, 88, 88);
        });
        order.forEach((a) => drawAgentSprite(ctx, a, t, theme === "university", nowS));
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
