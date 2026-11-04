// Lógica pura do escritório visual dos squads (sem canvas, sem React): planta das salas, rotas
// entre elas e a tradução dos eventos REAIS do motor (squad_events) em comandos de movimento.
// Regra de ouro: só eventos reais movem agentes. Nada aqui é sorteado ou simulado.

export type RoomId = "dir" | "ops" | "lib" | "copa" | "meet";
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** Coordenadas lógicas 320x320 (o canvas desenha em 2x). Mesma planta do protótipo aprovado. */
export const WORLD = 320;

export const ROOMS: Record<RoomId, Rect> = {
  dir: { x: 14, y: 14, w: 138, h: 114 },
  ops: { x: 168, y: 14, w: 135, h: 174 },
  lib: { x: 14, y: 130, w: 92, h: 62 },
  copa: { x: 14, y: 194, w: 92, h: 109 },
  meet: { x: 186, y: 190, w: 117, h: 113 },
};

/** Pontos dentro (i) e fora (o) de cada porta; todas as saídas se encontram no hub do corredor. */
export const DOORS: Record<RoomId, { i: Pt; o: Pt }> = {
  dir: { i: { x: 130, y: 118 }, o: { x: 130, y: 138 } },
  ops: { i: { x: 176, y: 162 }, o: { x: 158, y: 162 } },
  lib: { i: { x: 98, y: 161 }, o: { x: 116, y: 161 } },
  copa: { i: { x: 98, y: 241 }, o: { x: 116, y: 241 } },
  meet: { i: { x: 194, y: 241 }, o: { x: 176, y: 241 } },
};
export const HUB: Pt = { x: 146, y: 200 };

/** Mesas de trabalho por sala (pé do personagem). As cenas desenham os móveis nesses pontos. */
export const DESK_SPOTS: Record<RoomId, Pt[]> = {
  dir: [{ x: 90, y: 80 }],
  ops: [{ x: 193, y: 52 }, { x: 229, y: 52 }, { x: 233, y: 120 }, { x: 261, y: 120 }, { x: 247, y: 164 }],
  lib: [{ x: 58, y: 150 }, { x: 84, y: 150 }],
  copa: [{ x: 40, y: 226 }],
  meet: [{ x: 244, y: 280 }],
};
export const COPA_SPOTS: Pt[] = [{ x: 34, y: 226 }, { x: 66, y: 226 }, { x: 84, y: 246 }, { x: 52, y: 262 }, { x: 76, y: 270 }, { x: 40, y: 246 }, { x: 90, y: 228 }];

export const MEET_CENTER: Pt = { x: 244, y: 248 };

/** Assentos ao redor da mesa redonda, distribuídos igualmente conforme o número de agentes. */
export function meetSeats(n: number): Pt[] {
  const count = Math.max(1, n);
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: Math.round(MEET_CENTER.x + Math.cos(a) * 32), y: Math.round(MEET_CENTER.y + Math.sin(a) * 30) + 6 };
  });
}

export interface OfficeAgent {
  id: string;
  name: string;
  role: string;
  room: RoomId;
  sort_order: number;
  /** Identifica a função (ex.: "diretora", "revisora"); define o acessório do personagem. */
  slug?: string;
}

export type Place = "desk" | "meet" | "copa";
export interface Spot extends Pt { room: RoomId }

/** Cada agente ganha uma mesa fixa na sala de origem (na ordem do squad). */
export function assignDesks(agents: OfficeAgent[]): Record<string, Spot> {
  const byRoom = new Map<RoomId, OfficeAgent[]>();
  [...agents].sort((a, b) => a.sort_order - b.sort_order).forEach((a) => {
    byRoom.set(a.room, [...(byRoom.get(a.room) || []), a]);
  });
  const out: Record<string, Spot> = {};
  byRoom.forEach((list, room) => {
    list.forEach((a, i) => {
      const spots = DESK_SPOTS[room];
      out[a.id] = { ...spots[i % spots.length], room };
    });
  });
  return out;
}

export function resolvePlace(place: Place, agent: OfficeAgent, agents: OfficeAgent[], desks: Record<string, Spot>): Spot {
  const ordered = [...agents].sort((a, b) => a.sort_order - b.sort_order);
  const idx = Math.max(0, ordered.findIndex((a) => a.id === agent.id));
  if (place === "meet") return { ...meetSeats(ordered.length)[idx], room: "meet" };
  if (place === "copa") return { ...COPA_SPOTS[idx % COPA_SPOTS.length], room: "copa" };
  return desks[agent.id];
}

/** Caminho passando pelas portas e pelo corredor. `from.room` = "hall" quando o agente já está fora das salas. */
export function routePoints(from: { room: RoomId | "hall"; x: number; y: number }, to: Spot): Pt[] {
  const p: Pt[] = [];
  if (from.room !== to.room) {
    if (from.room !== "hall") p.push(DOORS[from.room].i, DOORS[from.room].o);
    p.push(HUB, DOORS[to.room].o, DOORS[to.room].i);
  }
  p.push({ x: to.x, y: to.y });
  return p;
}

// ---------- Aparência determinística ----------

const SHIRTS = ["#8b5cf6", "#2f9e8f", "#3b82f6", "#e8754a", "#e5b83a", "#4a5568", "#d6475f", "#14b8a6", "#f97316"];
const HAIRS = ["#3a2a1f", "#1f1f1f", "#6b2f1d", "#8a4b1f", "#101010", "#2a1c12", "#d9d9e8"];
const SKINS = ["#f1c9a5", "#d9a67a", "#e8b88f", "#c68e65", "#b97c55"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function agentLook(name: string): { shirt: string; hair: string; skin: string } {
  const h = hash(name);
  return { shirt: SHIRTS[h % SHIRTS.length], hair: HAIRS[(h >> 4) % HAIRS.length], skin: SKINS[(h >> 8) % SKINS.length] };
}

export type Accessory = "blazer" | "glasses" | "headphones" | "beret" | "headset" | "none";
const ACCESSORIES: Record<string, Accessory> = {
  diretora: "blazer", revisora: "glasses", roteirista: "headphones", "diretor-arte": "beret", seo: "headset",
  casos: "glasses", avaliacao: "none", trilha: "headset", referencias: "glasses", corretor: "glasses", prazos: "headphones",
};
/** Cada função tem um traço visual próprio, para reconhecer quem é quem de relance. */
export function accessoryFor(slug?: string): Accessory {
  return (slug && ACCESSORIES[slug]) || "none";
}
/** 0 curto, 1 comprido, 2 coque, 3 franja. Estável para o mesmo nome. */
export function hairStyleFor(name: string): 0 | 1 | 2 | 3 {
  return ((hash(name + "-hair") >>> 5) % 4) as 0 | 1 | 2 | 3;
}

// ---------- Eventos reais → comandos ----------

export interface EventLite {
  id: number;
  type: string;
  agent_id: string | null;
  room: string | null;
  text: string | null;
}

export type Tone = "info" | "ok" | "warn" | "bad";
export type AfterArrive = "work" | "idle" | "meet" | "wait";

export type Command =
  | { kind: "reset" }
  | { kind: "goto"; agentId: string; place: Place; then: AfterArrive; bubble?: string; tone?: Tone }
  | { kind: "goto_all"; place: Place; then: AfterArrive; exceptId?: string }
  | { kind: "bubble"; agentId: string; text: string; ms: number; tone: Tone }
  | { kind: "paper"; fromAgentId: string }
  | { kind: "deliverable_count"; delta: number }
  | { kind: "celebrate" };

function director(agents: OfficeAgent[]): OfficeAgent | undefined {
  return agents.find((a) => a.room === "dir") ?? [...agents].sort((a, b) => a.sort_order - b.sort_order)[0];
}

const short = (s: string | null, n = 38) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

export function eventToCommands(ev: EventLite, agents: OfficeAgent[]): Command[] {
  const dir = director(agents);
  const agent = ev.agent_id ? agents.find((a) => a.id === ev.agent_id) : undefined;
  const dirBubble = (text: string, tone: Tone, ms = 4500): Command[] => (dir ? [{ kind: "bubble", agentId: dir.id, text, ms, tone }] : []);

  switch (ev.type) {
    case "mission_started":
      return [{ kind: "reset" }, ...dirBubble("Missão recebida", "info", 3500)];
    case "task_started":
      if (!agent) return [];
      // Reunião de revisão: a revisora trabalha na sala de reunião e o time inteiro se junta a ela.
      if (ev.room === "meet") {
        return [
          { kind: "goto_all", place: "meet", then: "meet", exceptId: agent.id },
          { kind: "goto", agentId: agent.id, place: "meet", then: "work", bubble: short(ev.text) },
        ];
      }
      return [{ kind: "goto", agentId: agent.id, place: "desk", then: "work", bubble: short(ev.text) }];
    case "task_done":
      if (!agent) return [];
      if (ev.room === "meet") return [{ kind: "goto_all", place: "desk", then: "idle" }];
      return [{ kind: "goto", agentId: agent.id, place: "desk", then: "idle" }];
    case "deliverable_created":
      if (!agent) return [];
      return [
        { kind: "paper", fromAgentId: agent.id },
        { kind: "deliverable_count", delta: 1 },
        { kind: "bubble", agentId: agent.id, text: `Entregou: ${short(ev.text, 30)}`, ms: 3500, tone: "ok" },
      ];
    case "question_asked":
      // O agente que perguntou espera na mesa com um balão de alerta até o dono responder.
      if (!agent) return [];
      return [{ kind: "goto", agentId: agent.id, place: "desk", then: "wait", bubble: `Preciso de você: ${short(ev.text, 26)}`, tone: "warn" }];
    case "question_answered":
      return [...(agent ? [{ kind: "goto", agentId: agent.id, place: "desk", then: "idle" } as Command] : []), ...dirBubble("Resposta recebida, seguindo", "ok", 3500)];
    case "budget_warning":
      return dirBubble("80% do teto de custo", "warn");
    case "budget_paused":
      return [{ kind: "goto_all", place: "desk", then: "idle" }, ...dirBubble("Pausado: teto atingido", "warn", 8000)];
    case "budget_raised":
      return dirBubble("Teto ajustado, vamos!", "ok", 3500);
    case "pii_masked":
      return dirBubble("Dados pessoais mascarados", "info", 4000);
    case "mission_ready":
      // O time espera na copa enquanto o dono decide; a diretora fica na mesa avisando.
      return [
        { kind: "goto_all", place: "copa", then: "wait", exceptId: dir?.id },
        ...(dir ? [{ kind: "goto", agentId: dir.id, place: "desk", then: "wait", bubble: "Entrega pronta! Aguardando você" } as Command] : []),
      ];
    case "changes_requested":
      return [{ kind: "goto_all", place: "desk", then: "idle" }, ...dirBubble("Ajustes pedidos, mãos à obra", "info")];
    case "mission_approved":
      return [{ kind: "goto_all", place: "desk", then: "idle" }, { kind: "celebrate" }, ...dirBubble("Aprovado! Obrigada", "ok", 6000)];
    case "task_failed":
      return agent ? [{ kind: "bubble", agentId: agent.id, text: "Algo deu errado", ms: 8000, tone: "bad" }] : [];
    case "mission_failed":
      return [{ kind: "goto_all", place: "desk", then: "idle" }, ...dirBubble("A missão falhou", "bad", 10000)];
    default:
      return [];
  }
}

/** Qual ambiente temático desenhar para o `environment` salvo no squad (cai no estúdio se desconhecido). */
export type SceneTheme = "studio" | "university" | "campus";
export function themeForEnvironment(env: string | null | undefined): SceneTheme {
  if (env === "faculdade") return "university";
  if (env === "campus") return "campus";
  return "studio";
}

export const ROOM_LABELS: Record<SceneTheme, Record<RoomId, string>> = {
  studio: { dir: "DIREÇÃO", ops: "ESTÚDIO E EDIÇÃO", lib: "ROTEIROS", copa: "COPA", meet: "REVISÃO" },
  university: { dir: "COORDENAÇÃO", ops: "SALA DE AULA E LAB", lib: "BIBLIOTECA", copa: "COPA", meet: "SALA DE TBL" },
  campus: { dir: "GABINETE", ops: "ORIENTANDOS", lib: "BIBLIOTECA", copa: "COPA", meet: "SALA DE BANCA" },
};
