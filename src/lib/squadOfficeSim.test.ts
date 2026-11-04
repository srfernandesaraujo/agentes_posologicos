import { describe, it, expect } from "vitest";
import { makeSim, applyCommand, step, type Sim } from "./squadOfficeSim";
import { eventToCommands, ROOMS, routePoints, resolvePlace, assignDesks, type OfficeAgent, type EventLite, type Pt } from "./squadOffice";

const team: OfficeAgent[] = [
  { id: "h", name: "Helena", role: "Diretora", room: "dir", sort_order: 0 },
  { id: "b", name: "Bia", role: "Roteirista", room: "ops", sort_order: 1 },
  { id: "c", name: "Caio", role: "Arte", room: "ops", sort_order: 2 },
  { id: "n", name: "Nina", role: "Revisora", room: "meet", sort_order: 3 },
];
const ev = (id: number, type: string, agent_id: string | null, room: string | null = null, text: string | null = null): EventLite =>
  ({ id, type, agent_id, room, text });

function feed(sim: Sim, e: EventLite, now: number, instant = false) {
  eventToCommands(e, team).forEach((c) => applyCommand(sim, c, now, instant));
}
function run(sim: Sim, seconds: number, now0 = 0) {
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) step(sim, dt, now0 + t);
}
const get = (sim: Sim, id: string) => sim.agents.find((a) => a.info.id === id)!;

// Áreas por onde alguém pode andar: salas, corredor e as aberturas das portas.
const HALL = [{ x: 106, y: 128, w: 62, h: 62 }, { x: 106, y: 190, w: 80, h: 113 }, { x: 152, y: 14, w: 16, h: 114 }];
const walkable = (p: Pt) =>
  [...Object.values(ROOMS), ...HALL].some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);

describe("rotas não atravessam paredes", () => {
  it("todo trajeto entre quaisquer duas mesas/assentos/copa só passa por salas, corredor e portas", () => {
    const desks = assignDesks(team);
    const places = ["desk", "meet", "copa"] as const;
    for (const a of team) for (const b of team) for (const pa of places) for (const pb of places) {
      const from = resolvePlace(pa, a, team, desks), to = resolvePlace(pb, b, team, desks);
      const pts = [{ x: from.x, y: from.y }, ...routePoints(from, to)];
      for (let i = 0; i < pts.length - 1; i++) {
        const n = Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) / 2);
        for (let k = 0; k <= n; k++) {
          const p = { x: pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / Math.max(1, n), y: pts[i].y + ((pts[i + 1].y - pts[i].y) * k) / Math.max(1, n) };
          expect(walkable(p), `${a.name}/${pa} -> ${b.name}/${pb} em (${p.x.toFixed(0)},${p.y.toFixed(0)})`).toBe(true);
        }
      }
    }
  });
});

describe("simulação a partir de eventos reais", () => {
  it("começa com todos na mesa, parados", () => {
    const sim = makeSim(team);
    sim.agents.forEach((a) => { expect(a.state).toBe("idle"); expect(a.room).toBe(a.info.room); });
  });

  it("task_started: o agente trabalha na mesa com o texto da tarefa no balão", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "task_started", "b", "ops", "Roteiro do vídeo"), 0);
    run(sim, 2);
    const bia = get(sim, "b");
    expect(bia.state).toBe("work");
    expect(bia.bubble?.text).toBe("Roteiro do vídeo");
  });

  it("reunião de revisão: o time inteiro caminha até a sala de reunião e a revisora trabalha", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "task_started", "n", "meet", "Parecer de revisão"), 0);
    expect(get(sim, "h").state).toBe("walk");
    run(sim, 15);
    for (const a of sim.agents) expect(a.room, a.info.name).toBe("meet");
    expect(get(sim, "n").state).toBe("work");
    expect(get(sim, "h").state).toBe("meet");
    // fim da reunião: todos voltam às mesas
    feed(sim, ev(2, "task_done", "n", "meet"), 20);
    run(sim, 20, 20);
    expect(get(sim, "h").room).toBe("dir");
    expect(get(sim, "b").room).toBe("ops");
    sim.agents.forEach((a) => expect(a.state).toBe("idle"));
  });

  it("mission_ready: o time espera na copa e a diretora avisa na mesa", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "mission_ready", null), 0);
    run(sim, 20);
    expect(get(sim, "b").room).toBe("copa");
    expect(get(sim, "b").state).toBe("wait");
    expect(get(sim, "h").room).toBe("dir");
    expect(get(sim, "h").bubble?.text).toContain("Aguardando você");
  });

  it("entrega: papel voa até a mesa da diretora e o contador sobe", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "deliverable_created", "b", "ops", "Roteiro"), 5);
    expect(sim.deliverables).toBe(1);
    expect(sim.papers).toHaveLength(1);
    run(sim, 2, 5);
    expect(sim.papers).toHaveLength(0);
  });

  it("histórico é aplicado de forma instantânea e só mostra o estado final", () => {
    const sim = makeSim(team);
    const history = [
      ev(1, "mission_started", null), ev(2, "task_started", "h", "dir", "Plano"), ev(3, "task_done", "h", "dir"),
      ev(4, "deliverable_created", "h", "dir", "Plano"), ev(5, "task_started", "b", "ops", "Roteiro do vídeo"),
    ];
    history.forEach((e) => feed(sim, e, 0, true));
    expect(sim.papers).toHaveLength(0);
    expect(get(sim, "b").state).toBe("work");
    expect(get(sim, "b").bubble?.text).toBe("Roteiro do vídeo");
    expect(get(sim, "h").state).toBe("idle");
  });

  it("uma tarefa nova interrompe a caminhada anterior e parte do corredor (sem teletransporte)", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "mission_ready", null), 0);
    run(sim, 1); // Bia a caminho da copa
    const before = { x: get(sim, "b").x, y: get(sim, "b").y };
    feed(sim, ev(2, "changes_requested", null), 1);
    expect(Math.hypot(get(sim, "b").x - before.x, get(sim, "b").y - before.y)).toBeLessThan(0.01);
    run(sim, 25, 1);
    expect(get(sim, "b").room).toBe("ops");
  });

  it("quadro muito longo não faz o agente pular a porta", () => {
    const sim = makeSim(team);
    feed(sim, ev(1, "task_started", "n", "meet", "x"), 0);
    step(sim, 0.1, 0); // dt máximo do laço
    sim.agents.forEach((a) => expect(walkable({ x: a.x, y: a.y })).toBe(true));
  });
});
