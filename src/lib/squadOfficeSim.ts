// Simulação do escritório (sem canvas): posições, caminhos, estados e balões dos agentes.
// Fica separada do componente para poder ser testada: dado um evento real, o agente chega onde deveria.
import {
  agentLook, assignDesks, resolvePlace, routePoints,
  type AfterArrive, type Command, type OfficeAgent, type Pt, type RoomId, type Spot, type Tone,
} from "./squadOffice";

export type AgentState = "idle" | "walk" | "work" | "meet" | "wait";

export interface SimAgent {
  info: OfficeAgent;
  look: { shirt: string; hair: string; skin: string };
  x: number; y: number;
  room: RoomId | "hall";
  path: Pt[];
  moving: boolean;
  destRoom: RoomId;
  after: AfterArrive;
  state: AgentState;
  dir: 1 | -1;
  bubble: { text: string; until: number; tone: Tone } | null;
  hopUntil: number;
}

export interface Paper { from: Pt; to: Pt; start: number; dur: number }

export interface Sim {
  agents: SimAgent[];
  desks: Record<string, Spot>;
  papers: Paper[];
  deliverables: number;
  lastId: number;
  initialized: boolean;
}

export const SPEED = 42; // pixels lógicos por segundo

export function makeSim(agents: OfficeAgent[]): Sim {
  const desks = assignDesks(agents);
  return {
    desks, papers: [], deliverables: 0, lastId: 0, initialized: false,
    agents: agents.map((a) => ({
      info: a, look: agentLook(a.name), x: desks[a.id].x, y: desks[a.id].y, room: desks[a.id].room, path: [], moving: false,
      destRoom: desks[a.id].room, after: "idle", state: "idle", dir: 1, bubble: null, hopUntil: 0,
    })),
  };
}

export function moveTo(sim: Sim, a: SimAgent, place: "desk" | "meet" | "copa", then: AfterArrive, instant: boolean) {
  const spot = resolvePlace(place, a.info, sim.agents.map((s) => s.info), sim.desks);
  a.after = then;
  a.destRoom = spot.room;
  if (instant) {
    a.x = spot.x; a.y = spot.y; a.room = spot.room; a.path = []; a.moving = false; a.state = then;
    return;
  }
  const from = { room: a.moving ? ("hall" as const) : a.room, x: a.x, y: a.y };
  const path = routePoints(from, spot);
  if (path.length === 1 && Math.hypot(path[0].x - a.x, path[0].y - a.y) < 1.5) {
    a.path = []; a.moving = false; a.room = spot.room; a.state = then;
    return;
  }
  a.path = path; a.moving = true; a.state = "walk";
  if (from.room !== spot.room) a.room = "hall";
}

export const DIRECTOR_DESK: Pt = { x: 100, y: 62 };

export function applyCommand(sim: Sim, cmd: Command, now: number, instant: boolean) {
  const byId = (id: string) => sim.agents.find((a) => a.info.id === id);
  switch (cmd.kind) {
    case "reset":
      sim.papers = []; sim.deliverables = 0;
      sim.agents.forEach((a) => { moveTo(sim, a, "desk", "idle", true); a.bubble = null; });
      break;
    case "goto": {
      const a = byId(cmd.agentId);
      if (!a) break;
      moveTo(sim, a, cmd.place, cmd.then, instant);
      if (cmd.then === "idle") a.bubble = null;
      else if (cmd.bubble) a.bubble = { text: cmd.bubble, until: Infinity, tone: cmd.tone ?? "info" };
      break;
    }
    case "goto_all":
      sim.agents.forEach((a) => {
        if (a.info.id === cmd.exceptId) return;
        moveTo(sim, a, cmd.place, cmd.then, instant);
        a.bubble = null;
      });
      break;
    case "bubble": {
      if (instant) break;
      const a = byId(cmd.agentId);
      if (a) a.bubble = { text: cmd.text, until: now + cmd.ms, tone: cmd.tone };
      break;
    }
    case "paper": {
      if (instant) break;
      const a = byId(cmd.fromAgentId);
      if (a) sim.papers.push({ from: { x: a.x, y: a.y - 12 }, to: DIRECTOR_DESK, start: now, dur: 1.1 });
      break;
    }
    case "deliverable_count":
      sim.deliverables += cmd.delta;
      break;
    case "celebrate":
      if (!instant) sim.agents.forEach((a) => { a.hopUntil = now + 2600; });
      break;
  }
}

export function step(sim: Sim, dt: number, now: number) {
  sim.agents.forEach((a) => {
    if (a.moving && a.path.length) {
      let budget = SPEED * dt;
      // Pode cruzar vários pontos do caminho no mesmo quadro (quadros longos não "pulam" portas).
      while (budget > 0 && a.path.length) {
        const p = a.path[0];
        const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
        if (d <= budget) { a.x = p.x; a.y = p.y; a.path.shift(); budget -= d; }
        else { a.x += (dx / d) * budget; a.y += (dy / d) * budget; if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1; budget = 0; }
      }
      if (!a.path.length) { a.moving = false; a.room = a.destRoom; a.state = a.after; }
    }
    if (a.bubble && now > a.bubble.until) a.bubble = null;
  });
  sim.papers = sim.papers.filter((p) => now - p.start < p.dur);
}
