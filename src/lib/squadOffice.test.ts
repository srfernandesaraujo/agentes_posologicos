import { describe, it, expect } from "vitest";
import {
  assignDesks, meetSeats, routePoints, eventToCommands, agentLook, themeForEnvironment, resolvePlace, accessoryFor, hairStyleFor,
  ROOMS, DOORS, DESK_SPOTS, type OfficeAgent, type EventLite,
} from "./squadOffice";
import { listTemplates } from "../../supabase/functions/_shared/squadTemplates";

const team: OfficeAgent[] = [
  { id: "h", name: "Helena", role: "Diretora", room: "dir", sort_order: 0 },
  { id: "b", name: "Bia", role: "Roteirista", room: "ops", sort_order: 1 },
  { id: "c", name: "Caio", role: "Arte", room: "ops", sort_order: 2 },
  { id: "i", name: "Íris", role: "SEO", room: "ops", sort_order: 3 },
  { id: "n", name: "Nina", role: "Revisora", room: "meet", sort_order: 4 },
];
const ev = (type: string, agent_id: string | null, room: string | null = null, text: string | null = null, id = 1): EventLite =>
  ({ id, type, agent_id, room, text });

const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

describe("planta do escritório", () => {
  it("todas as mesas e portas ficam dentro da sala certa", () => {
    (Object.keys(DESK_SPOTS) as (keyof typeof ROOMS)[]).forEach((room) => {
      DESK_SPOTS[room].forEach((p) => expect(inside(p, ROOMS[room])).toBe(true));
      expect(inside(DOORS[room].i, ROOMS[room])).toBe(true);
    });
  });
  it("os assentos da reunião ficam dentro da sala de reunião", () => {
    meetSeats(7).forEach((p) => expect(inside(p, ROOMS.meet)).toBe(true));
    expect(meetSeats(5)).toHaveLength(5);
  });
});

describe("mesas dos agentes", () => {
  it("cada agente tem mesa na sua sala, sem dois na mesma mesa", () => {
    const desks = assignDesks(team);
    expect(Object.keys(desks)).toHaveLength(5);
    expect(desks.h.room).toBe("dir");
    expect(desks.n.room).toBe("meet");
    const opsSpots = ["b", "c", "i"].map((id) => `${desks[id].x},${desks[id].y}`);
    expect(new Set(opsSpots).size).toBe(3);
  });
  it("todo template cabe no escritório (agentes por sala <= mesas)", () => {
    for (const t of listTemplates()) {
      const per: Record<string, number> = {};
      t.agents.forEach((a) => { per[a.room] = (per[a.room] || 0) + 1; });
      Object.entries(per).forEach(([room, n]) => {
        expect(DESK_SPOTS[room as keyof typeof DESK_SPOTS].length, `${t.slug}/${room}`).toBeGreaterThanOrEqual(room === "meet" ? 1 : n);
      });
    }
  });
});

describe("rotas", () => {
  it("na mesma sala vai direto", () => {
    const r = routePoints({ room: "ops", x: 193, y: 52 }, { room: "ops", x: 229, y: 52 });
    expect(r).toEqual([{ x: 229, y: 52 }]);
  });
  it("entre salas passa pela porta de saída, corredor e porta de entrada", () => {
    const r = routePoints({ room: "dir", x: 90, y: 80 }, { room: "meet", x: 244, y: 280 });
    expect(r[0]).toEqual(DOORS.dir.i);
    expect(r[1]).toEqual(DOORS.dir.o);
    expect(r[r.length - 3]).toEqual(DOORS.meet.o);
    expect(r[r.length - 2]).toEqual(DOORS.meet.i);
    expect(r[r.length - 1]).toEqual({ x: 244, y: 280 });
  });
  it("saindo do corredor não repete a porta de origem", () => {
    const r = routePoints({ room: "hall", x: 140, y: 190 }, { room: "lib", x: 58, y: 150 });
    expect(r[0]).toEqual({ x: 146, y: 200 });
  });
});

describe("eventos reais → comandos", () => {
  it("task_started leva o agente à mesa para trabalhar com a tarefa no balão", () => {
    expect(eventToCommands(ev("task_started", "b", "ops", "Roteiro do vídeo"), team)).toEqual([
      { kind: "goto", agentId: "b", place: "desk", then: "work", bubble: "Roteiro do vídeo" },
    ]);
  });
  it("tarefa da sala de reunião junta o time todo na mesa redonda", () => {
    const cmds = eventToCommands(ev("task_started", "n", "meet", "Parecer de revisão"), team);
    expect(cmds[0]).toEqual({ kind: "goto_all", place: "meet", then: "meet", exceptId: "n" });
    expect(cmds[1]).toMatchObject({ kind: "goto", agentId: "n", place: "meet", then: "work" });
  });
  it("fim da reunião devolve todos às mesas", () => {
    expect(eventToCommands(ev("task_done", "n", "meet"), team)).toEqual([{ kind: "goto_all", place: "desk", then: "idle" }]);
  });
  it("entrega gera papel voando, contador e balão", () => {
    const cmds = eventToCommands(ev("deliverable_created", "b", "ops", "Roteiro do vídeo"), team);
    expect(cmds.map((c) => c.kind)).toEqual(["paper", "deliverable_count", "bubble"]);
  });
  it("entrega final pronta manda o time para a copa e a diretora avisa na mesa", () => {
    const cmds = eventToCommands(ev("mission_ready", null), team);
    expect(cmds[0]).toEqual({ kind: "goto_all", place: "copa", then: "wait", exceptId: "h" });
    expect(cmds[1]).toMatchObject({ kind: "goto", agentId: "h", place: "desk", then: "wait" });
  });
  it("ajustes pedidos trazem o time de volta; aprovação comemora", () => {
    expect(eventToCommands(ev("changes_requested", null), team)[0]).toEqual({ kind: "goto_all", place: "desk", then: "idle" });
    expect(eventToCommands(ev("mission_approved", null), team).some((c) => c.kind === "celebrate")).toBe(true);
  });
  it("pausa por teto e falhas mostram balão de alerta na diretora", () => {
    const paused = eventToCommands(ev("budget_paused", null), team);
    expect(paused.find((c) => c.kind === "bubble")).toMatchObject({ agentId: "h", tone: "warn" });
    expect(eventToCommands(ev("mission_failed", null), team).find((c) => c.kind === "bubble")).toMatchObject({ tone: "bad" });
  });
  it("eventos desconhecidos ou sem agente não geram nada (só eventos reais movem)", () => {
    expect(eventToCommands(ev("task_skipped", "b"), team)).toEqual([]);
    expect(eventToCommands(ev("qualquer_coisa", null), team)).toEqual([]);
    expect(eventToCommands(ev("task_started", "fantasma", "ops"), team)).toEqual([]);
  });
  it("corta textos longos no balão", () => {
    const [c] = eventToCommands(ev("task_started", "b", "ops", "x".repeat(100)), team);
    expect(c.kind === "goto" && (c.bubble || "").length).toBeLessThanOrEqual(38);
  });
});

describe("lugares e aparência", () => {
  it("resolvePlace devolve mesa, assento e copa", () => {
    const desks = assignDesks(team);
    const bia = team[1];
    expect(resolvePlace("desk", bia, team, desks).room).toBe("ops");
    expect(resolvePlace("meet", bia, team, desks).room).toBe("meet");
    expect(resolvePlace("copa", bia, team, desks).room).toBe("copa");
  });
  it("a aparência é estável para o mesmo nome", () => {
    expect(agentLook("Helena")).toEqual(agentLook("Helena"));
    expect(agentLook("Helena").shirt).toMatch(/^#/);
  });
  it("mapeia ambiente do squad para tema, com estúdio como padrão", () => {
    expect(themeForEnvironment("faculdade")).toBe("university");
    expect(themeForEnvironment("campus")).toBe("campus");
    expect(themeForEnvironment("editora")).toBe("editora");
    expect(themeForEnvironment("escritorio-executivo")).toBe("executivo");
    expect(themeForEnvironment("estudio-video")).toBe("studio");
    expect(themeForEnvironment("hospital-futuro")).toBe("studio");
    expect(themeForEnvironment(null)).toBe("studio");
  });
});

describe("perguntas ao dono no escritório", () => {
  it("quem perguntou espera na mesa com balão de alerta", () => {
    const cmds = eventToCommands(ev("question_asked", "b", "ops", "Qual orientação vale: manter constante ou evitar?"), team);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: "goto", agentId: "b", place: "desk", then: "wait", tone: "warn" });
  });
  it("memória confirmada faz a diretora anotar com um balão", () => {
    const cmds = eventToCommands(ev("memory_saved", null, null, "Anotado na memória"), team);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: "bubble", text: "Anotei na memória", tone: "ok" });
  });
  it("ao responder, o agente volta ao normal e a diretora avisa", () => {
    const cmds = eventToCommands(ev("question_answered", "b", null, "Manter constante"), team);
    expect(cmds[0]).toMatchObject({ kind: "goto", agentId: "b", then: "idle" });
    expect(cmds[1]).toMatchObject({ kind: "bubble", agentId: "h", tone: "ok" });
  });
});

describe("aparência por função", () => {
  it("cada função de template tem acessório definido ou nenhum, nunca erro", () => {
    for (const t of listTemplates()) {
      for (const a of t.agents) expect(["blazer", "glasses", "headphones", "beret", "headset", "none"]).toContain(accessoryFor(a.slug));
    }
    expect(accessoryFor("diretora")).toBe("blazer");
    expect(accessoryFor("revisora")).toBe("glasses");
    expect(accessoryFor(undefined)).toBe("none");
  });
  it("o penteado é estável e fica entre 0 e 3", () => {
    expect(hairStyleFor("Bia")).toBe(hairStyleFor("Bia"));
    ["Helena", "Bia", "Caio", "Íris", "Nina", "Theo"].forEach((n) => expect([0, 1, 2, 3]).toContain(hairStyleFor(n)));
  });
});
