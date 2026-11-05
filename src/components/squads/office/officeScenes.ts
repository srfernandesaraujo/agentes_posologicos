// Desenho do escritório em pixel art, 100% por código (sem imagens): kit base compartilhado
// (piso, paredes, portas, móveis) + um tema por ambiente (estúdio, faculdade, campus, editora, escritório executivo).
// Coordenadas lógicas 320x320, desenhadas em 2x num canvas de 640x640 (pixel art nítida).
// Trocar por tiles desenhados à mão no futuro só exige mudar este arquivo.
import { ROOMS, ROOM_LABELS, type RoomId, type SceneTheme } from "@/lib/squadOffice";

type G = CanvasRenderingContext2D;
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

interface Palette {
  hall: [string, string];
  floors: Record<RoomId, { base: string; alt: string; mode: "wood" | "tile" }>;
  desk: string;
  deskEdge: string;
  accent: string;
}

const PALETTES: Record<SceneTheme, Palette> = {
  studio: {
    hall: ["#3b3e49", "#434652"],
    floors: {
      dir: { base: "#4a3f58", alt: "#42384f", mode: "wood" },
      ops: { base: "#6f7886", alt: "#7a8393", mode: "tile" },
      lib: { base: "#a1784f", alt: "#946c46", mode: "wood" },
      copa: { base: "#d19a5e", alt: "#c28d54", mode: "wood" },
      meet: { base: "#2f3b52", alt: "#2a3549", mode: "wood" },
    },
    desk: "#c99a62", deskEdge: "#9b7444", accent: "#e8754a",
  },
  university: {
    hall: ["#4a5360", "#525b69"],
    floors: {
      dir: { base: "#6a5a45", alt: "#5f503d", mode: "wood" },
      ops: { base: "#b9c4c9", alt: "#c6d0d4", mode: "tile" },
      lib: { base: "#b08a5a", alt: "#a37e50", mode: "wood" },
      copa: { base: "#d3a56a", alt: "#c4965c", mode: "wood" },
      meet: { base: "#8fb3c4", alt: "#83a7b8", mode: "tile" },
    },
    desk: "#d8c9a8", deskEdge: "#a8996f", accent: "#2f9e8f",
  },
  campus: {
    hall: ["#4b4a58", "#53525f"],
    floors: {
      dir: { base: "#5b4637", alt: "#4f3c2f", mode: "wood" },
      ops: { base: "#8d9a8a", alt: "#99a696", mode: "tile" },
      lib: { base: "#d3a56a", alt: "#c4965c", mode: "wood" },
      copa: { base: "#d19a5e", alt: "#c28d54", mode: "wood" },
      meet: { base: "#6b4a3a", alt: "#5f4032", mode: "wood" },
    },
    desk: "#c99a62", deskEdge: "#9b7444", accent: "#8b5cf6",
  },
  editora: {
    hall: ["#3d3a42", "#45424b"],
    floors: {
      dir: { base: "#35503f", alt: "#2d4536", mode: "tile" },
      ops: { base: "#c9b79a", alt: "#bda98a", mode: "wood" },
      lib: { base: "#8a6540", alt: "#7d5a39", mode: "wood" },
      copa: { base: "#d8b78a", alt: "#caa97c", mode: "wood" },
      meet: { base: "#4a2f3a", alt: "#412933", mode: "wood" },
    },
    desk: "#e6d6b3", deskEdge: "#b39e72", accent: "#b4532a",
  },
  executivo: {
    hall: ["#43474f", "#4b4f58"],
    floors: {
      dir: { base: "#5c4332", alt: "#523b2c", mode: "wood" },
      ops: { base: "#6b7a8c", alt: "#76869a", mode: "tile" },
      lib: { base: "#b9a583", alt: "#ad9a79", mode: "wood" },
      copa: { base: "#cfc6b4", alt: "#c3baa8", mode: "tile" },
      meet: { base: "#2c3e5c", alt: "#263752", mode: "wood" },
    },
    desk: "#d7cdb8", deskEdge: "#a39879", accent: "#2b6cb0",
  },
};

function floor(g: G, room: RoomId, p: Palette) {
  const rm = ROOMS[room];
  const f = p.floors[room];
  R(g, rm.x, rm.y, rm.w, rm.h, f.base);
  if (f.mode === "wood") {
    for (let y = rm.y; y < rm.y + rm.h; y += 4) {
      R(g, rm.x, y, rm.w, 1, f.alt);
      // emendas das tábuas, deslocadas a cada fileira
      for (let x = rm.x + ((y * 7) % 31); x < rm.x + rm.w; x += 31) R(g, x, y + 1, 1, 3, f.alt);
    }
  } else {
    for (let y = rm.y; y < rm.y + rm.h; y += 8) {
      for (let x = rm.x + (((y - rm.y) / 8) % 2 ? 0 : 8); x < rm.x + rm.w; x += 16) {
        // não deixa o azulejo vazar para fora da sala quando a largura não é múltipla de 8
        R(g, x, y, Math.min(8, rm.x + rm.w - x), Math.min(8, rm.y + rm.h - y), f.alt);
      }
    }
  }
}

/** Textura sutil e estável (mesma em todo quadro): pontinhos claros e escuros espalhados pelo piso. */
function grain(g: G, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const n = Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 24;
      if (n < 9) R(g, x, y, 1, 1, "rgba(255,255,255,.07)");
      else if (n > 246) R(g, x, y, 1, 1, "rgba(0,0,0,.09)");
    }
  }
}

/** Sombra interna junto às paredes (dá profundidade) e rodapé. */
function wallShade(g: G, rm: { x: number; y: number; w: number; h: number }) {
  R(g, rm.x + 2, rm.y + 2, rm.w - 4, 4, "rgba(0,0,0,.22)");
  R(g, rm.x + 2, rm.y + 6, rm.w - 4, 2, "rgba(0,0,0,.10)");
  R(g, rm.x + 2, rm.y + 2, 3, rm.h - 4, "rgba(0,0,0,.12)");
  R(g, rm.x + rm.w - 5, rm.y + 2, 3, rm.h - 4, "rgba(0,0,0,.12)");
  R(g, rm.x + 2, rm.y + rm.h - 5, rm.w - 4, 3, "rgba(0,0,0,.14)");
}

function walls(g: G, rm: { x: number; y: number; w: number; h: number }) {
  R(g, rm.x - 1, rm.y - 1, rm.w + 2, 1, "#2a2c36"); R(g, rm.x - 1, rm.y + rm.h, rm.w + 2, 1, "#2a2c36");
  R(g, rm.x - 1, rm.y - 1, 1, rm.h + 2, "#2a2c36"); R(g, rm.x + rm.w, rm.y - 1, 1, rm.h + 2, "#2a2c36");
  R(g, rm.x, rm.y, rm.w, 2, "#e9e5da"); R(g, rm.x, rm.y + rm.h - 2, rm.w, 2, "#e9e5da");
  R(g, rm.x, rm.y, 2, rm.h, "#e9e5da"); R(g, rm.x + rm.w - 2, rm.y, 2, rm.h, "#e9e5da");
}

const plant = (g: G, x: number, y: number) => { R(g, x, y + 5, 6, 4, "#8a5a3a"); R(g, x + 1, y, 4, 6, "#3f9a55"); R(g, x, y + 2, 6, 2, "#2f7c43"); };
const chair = (g: G, x: number, y: number, c = "#23283a") => { R(g, x, y, 6, 6, c); R(g, x + 1, y - 3, 4, 3, c); };
const monitor = (g: G, x: number, y: number, c = "#4db3ff") => { R(g, x, y, 8, 6, "#1c2030"); R(g, x + 1, y + 1, 6, 4, c); R(g, x + 3, y + 6, 2, 2, "#1c2030"); };

/** Móveis comuns: ficam nos pontos de DESK_SPOTS e dos assentos, iguais em todos os temas (mudam só as cores). */
function furniture(g: G, p: Palette) {
  // Sombras projetadas no chão (desenhadas antes dos móveis)
  R(g, 178, 40, 76, 3, "rgba(0,0,0,.22)"); R(g, 226, 110, 60, 3, "rgba(0,0,0,.22)"); R(g, 226, 154, 60, 3, "rgba(0,0,0,.22)");
  R(g, 66, 74, 44, 3, "rgba(0,0,0,.22)"); R(g, 40, 178, 40, 3, "rgba(0,0,0,.2)"); R(g, 24, 214, 70, 3, "rgba(0,0,0,.22)");
  R(g, 20, 296, 70, 3, "rgba(0,0,0,.18)");
  // Direção
  R(g, 40, 48, 76, 52, "#2b3a5e"); R(g, 43, 51, 70, 46, "#34476f");
  R(g, 64, 58, 44, 16, "#6b4a2e"); R(g, 66, 60, 40, 12, "#2f6b4a"); R(g, 84, 62, 4, 4, "#e9c46a");
  chair(g, 82, 78, "#2a2d3a"); R(g, 36, 64, 12, 16, "#2a2d38"); R(g, 36, 86, 12, 12, "#2a2d38");
  plant(g, 18, 34); plant(g, 138, 100);
  // Operações e open space
  R(g, 176, 28, 76, 10, p.desk); R(g, 176, 38, 76, 2, p.deskEdge);
  monitor(g, 186, 26, "#4db3ff"); monitor(g, 198, 26, "#6ee7b7"); monitor(g, 222, 26, "#4db3ff"); monitor(g, 234, 26, "#e9c46a");
  chair(g, 190, 46, "#2a3350"); chair(g, 226, 46, "#2a3350");
  R(g, 170, 64, 132, 1, "#6f7c78");
  R(g, 224, 96, 60, 12, p.desk); R(g, 224, 108, 60, 2, p.deskEdge);
  monitor(g, 230, 90, "#4db3ff"); monitor(g, 262, 90, "#e9c46a");
  R(g, 224, 140, 60, 12, p.desk); R(g, 224, 152, 60, 2, p.deskEdge);
  monitor(g, 236, 134, "#6ee7b7"); monitor(g, 264, 134, "#4db3ff");
  chair(g, 230, 114, "#1f3a8a"); chair(g, 258, 114, "#1f3a8a"); chair(g, 244, 158, "#1f3a8a");
  plant(g, 172, 168); plant(g, 290, 170); plant(g, 290, 70);
  // Biblioteca
  R(g, 38, 154, 40, 24, "#b6c2d6"); R(g, 42, 158, 32, 16, "#c9d3e4");
  R(g, 46, 160, 10, 8, "#27408b"); R(g, 60, 160, 10, 8, "#27408b");
  R(g, 18, 134, 6, 6, "#8b5cf6"); R(g, 92, 134, 6, 6, "#8b5cf6");
  // Copa
  R(g, 22, 200, 70, 12, "#8d6a46"); R(g, 22, 212, 70, 3, "#6b4a2e"); R(g, 28, 200, 8, 5, "#2a2d38"); R(g, 44, 201, 5, 4, "#e9e5da"); R(g, 58, 201, 5, 4, "#e9e5da");
  R(g, 36, 232, 34, 22, "#6a7a96"); R(g, 40, 236, 26, 14, "#7d8eac");
  R(g, 26, 258, 26, 8, "#9a7a5a"); R(g, 70, 258, 28, 8, "#9a7a5a");
  R(g, 18, 282, 70, 12, "#a47a56"); R(g, 18, 278, 70, 5, "#b78d66");
  plant(g, 18, 208); plant(g, 94, 286);
  // Reunião: mesa redonda
  R(g, 282, 262, 6, 12, "#7fbfe3"); R(g, 282, 258, 6, 5, "#e9e5da");
  plant(g, 190, 290); plant(g, 292, 290);
  g.fillStyle = "#1d2a4a"; g.beginPath(); g.ellipse(244, 248, 22, 19, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2b3b66"; g.beginPath(); g.ellipse(244, 247, 19, 16, 0, 0, Math.PI * 2); g.fill();
  R(g, 238, 243, 12, 8, "#6a7fb5");
}

/** Pequenos objetos que fazem a mesa parecer usada: teclados, canecas, papéis, tapete com padrão, relógio. */
function details(g: G, p: Palette) {
  // teclados e canecas nas mesas de operações
  [[184, 33], [220, 33], [228, 100], [260, 100], [234, 144], [262, 144]].forEach(([x, y]) => {
    R(g, x, y, 12, 3, "#2a2d38"); R(g, x + 1, y, 10, 1, "#4b5563");
  });
  [[246, 31], [276, 99], [276, 143]].forEach(([x, y]) => { R(g, x, y, 3, 3, "#f3f0e6"); R(g, x + 3, y + 1, 1, 1, "#f3f0e6"); });
  [[206, 32], [248, 100], [250, 144]].forEach(([x, y]) => { R(g, x, y, 6, 4, "#fffdf3"); R(g, x + 1, y + 1, 4, 1, "#9ca3af"); });
  // direção: luminária e tapete com padrão
  R(g, 70, 59, 2, 6, "#2a2d38"); R(g, 68, 58, 6, 2, p.accent);
  for (let i = 0; i < 70; i += 6) { R(g, 43 + i, 51, 3, 1, "#4c5f8a"); R(g, 43 + i, 96, 3, 1, "#4c5f8a"); }
  // relógio de parede na direção (os ponteiros são animados na camada dinâmica)
  R(g, 134, 17, 12, 12, "#2a2d38"); R(g, 135, 18, 10, 10, "#f3f0e6");
  // biblioteca: tapete com franjas
  for (let i = 0; i < 40; i += 4) { R(g, 38 + i, 153, 2, 1, "#e9e5da"); R(g, 38 + i, 178, 2, 1, "#e9e5da"); }
  // copa: frutas na mesa
  R(g, 44, 238, 4, 4, "#ef4444"); R(g, 52, 238, 4, 4, "#f59e0b"); R(g, 58, 239, 4, 3, "#84cc16");
}

// ---------- Decoração temática ----------

function decorStudio(g: G) {
  // Direção: moodboard e janela
  R(g, 22, 18, 40, 8, "#2c2c3a");
  ["#e8754a", "#e5b83a", "#3b82f6", "#2f9e8f", "#d6475f"].forEach((c, i) => R(g, 24 + i * 7, 20, 5, 4, c));
  R(g, 70, 16, 30, 10, "#e3a65b"); R(g, 74, 18, 22, 6, "#f2c27a");
  // Estúdio: tela verde, tripé e luz de anel
  R(g, 282, 40, 16, 44, "#2fa36b"); R(g, 282, 40, 16, 2, "#1d7a4d");
  R(g, 288, 100, 2, 14, "#2a2d38"); R(g, 283, 112, 12, 2, "#2a2d38");
  R(g, 283, 96, 12, 7, "#1c2030"); R(g, 295, 98, 3, 3, "#4b5563");
  g.strokeStyle = "#f3f0e6"; g.lineWidth = 2; g.beginPath(); g.arc(289, 88, 6, 0, Math.PI * 2); g.stroke();
  // Roteiros: mural de cartões
  R(g, 36, 134, 40, 12, "#8a6a4a"); R(g, 37, 135, 38, 10, "#c9a66b");
  ["#fef3c7", "#bfdbfe", "#fbcfe8", "#bbf7d0", "#fef3c7"].forEach((c, i) => R(g, 39 + i * 7, 137 + (i % 2) * 3, 5, 4, c));
  // Revisão: tela com linha do tempo
  R(g, 214, 196, 60, 18, "#1c2030"); R(g, 216, 198, 56, 14, "#2b3a5e");
  R(g, 220, 201, 20, 3, "#e8754a"); R(g, 242, 201, 14, 3, "#3b82f6"); R(g, 258, 201, 10, 3, "#6ee7b7");
  R(g, 220, 207, 12, 3, "#e5b83a"); R(g, 234, 207, 24, 3, "#d6475f");
}

function decorUniversity(g: G) {
  // Coordenação: diplomas e estante
  [22, 36, 50].forEach((x) => { R(g, x, 18, 10, 8, "#6b4a2e"); R(g, x + 1, 19, 8, 6, "#f4f1e6"); R(g, x + 3, 21, 4, 1, "#b45309"); });
  R(g, 106, 16, 30, 12, "#6b4a2e"); [0, 1, 2].forEach((i) => R(g, 108, 18 + i * 3, 26, 2, ["#d6475f", "#3b82f6", "#e5b83a"][i]));
  // Sala de aula e laboratório: lousa e frascos
  R(g, 176, 18, 92, 9, "#6b7280"); R(g, 177, 19, 90, 7, "#f4f6f8");
  R(g, 182, 21, 28, 1, "#3b82f6"); R(g, 182, 23, 40, 1, "#3b82f6"); R(g, 232, 21, 24, 1, "#d6475f");
  ["#6ee7b7", "#fca5a5", "#93c5fd"].forEach((c, i) => R(g, 216 + i * 5, 24, 3, 5, c));
  // Biblioteca: estante cheia
  R(g, 22, 134, 76, 10, "#6b4a2e");
  for (let i = 0; i < 18; i++) R(g, 24 + i * 4, 136, 3, 6, ["#d6475f", "#3b82f6", "#e5b83a", "#2f9e8f", "#8b5cf6"][i % 5]);
  // Sala de TBL: lousa
  R(g, 214, 196, 60, 18, "#6b7280"); R(g, 216, 198, 56, 14, "#f4f6f8");
  R(g, 220, 201, 30, 1, "#3b82f6"); R(g, 220, 204, 22, 1, "#3b82f6"); R(g, 220, 207, 36, 1, "#d6475f");
}

function decorCampus(g: G) {
  // Gabinete: diplomas e globo
  [22, 36].forEach((x) => { R(g, x, 18, 10, 8, "#6b4a2e"); R(g, x + 1, 19, 8, 6, "#f4f1e6"); });
  R(g, 100, 60, 10, 10, "#3b82f6"); R(g, 102, 62, 4, 6, "#3f9a55"); R(g, 104, 70, 2, 4, "#2a2d38");
  R(g, 106, 16, 30, 12, "#6b4a2e"); [0, 1, 2].forEach((i) => R(g, 108, 18 + i * 3, 26, 2, ["#8b5cf6", "#e5b83a", "#2f9e8f"][i]));
  // Orientandos: calendário com prazos marcados
  R(g, 176, 18, 44, 18, "#6b7280"); R(g, 177, 19, 42, 16, "#f4f6f8");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) R(g, 179 + c * 7, 22 + r * 3.5, 5, 2, "#d1d5db");
  R(g, 186, 22, 5, 2, "#d6475f"); R(g, 200, 29, 5, 2, "#d6475f"); R(g, 214, 22, 5, 2, "#e5b83a");
  // Biblioteca: estante
  R(g, 22, 134, 76, 10, "#6b4a2e");
  for (let i = 0; i < 18; i++) R(g, 24 + i * 4, 136, 3, 6, ["#8b5cf6", "#e8754a", "#e5b83a", "#2f9e8f", "#3b82f6"][i % 5]);
  // Sala de banca: tela de projeção e bandeira
  R(g, 214, 196, 60, 18, "#2a2d38"); R(g, 216, 198, 56, 14, "#f4f6f8");
  R(g, 222, 201, 30, 2, "#1c2030"); R(g, 222, 206, 22, 1, "#9ca3af");
  R(g, 190, 196, 4, 16, "#8a5a3a"); R(g, 194, 196, 10, 7, "#3f9a55");
}

function decorEditora(g: G) {
  // Direção editorial: estante de livros e três capas emolduradas
  R(g, 22, 28, 44, 9, "#5a3d27");
  for (let i = 0; i < 11; i++) R(g, 24 + i * 4, 29, 3, 7, ["#b4532a", "#1f3a5f", "#e0c36a", "#2f6b4a", "#7a2e3a"][i % 5]);
  ["#b4532a", "#1f3a5f", "#e0c36a"].forEach((c, i) => { R(g, 72 + i * 11, 16, 9, 12, "#2a2d38"); R(g, 73 + i * 11, 17, 7, 10, c); R(g, 75 + i * 11, 20, 3, 1, "#f3f0e6"); });
  // Redação e capa: quadro de capítulos (A fazer, escrevendo, pronto); os cartões prontos são animados
  R(g, 280, 34, 20, 34, "#6b4a2e"); R(g, 282, 36, 16, 30, "#d9c9a8");
  R(g, 282, 36, 16, 3, "#a8996f");
  [284, 289, 294].forEach((x) => R(g, x, 36, 1, 30, "#bfae88"));
  R(g, 284, 41, 4, 3, "#fef3c7"); R(g, 284, 46, 4, 3, "#bfdbfe"); R(g, 284, 51, 4, 3, "#fbcfe8"); R(g, 289, 41, 4, 3, "#bbf7d0");
  // Mesa de capa: pranchetas de capas
  R(g, 258, 166, 26, 14, "#2a2d38"); R(g, 260, 168, 22, 10, "#f4f1e6");
  R(g, 262, 170, 7, 8, "#b4532a"); R(g, 271, 170, 7, 8, "#1f3a5f");
  // Acervo: fichários e pilhas de originais
  R(g, 22, 134, 76, 10, "#5a3d27");
  for (let i = 0; i < 16; i++) R(g, 24 + i * 4.5, 136, 3.5, 6, ["#e8e0c8", "#1f3a5f", "#b4532a", "#2f6b4a", "#8a6a4a"][i % 5]);
  R(g, 22, 176, 14, 8, "#f4f1e6"); R(g, 22, 174, 14, 2, "#e0d8c0"); R(g, 22, 172, 14, 2, "#f4f1e6");
  // Revisão: tela com prova de capa e caneta vermelha na mesa
  R(g, 214, 196, 60, 18, "#1c2030"); R(g, 216, 198, 56, 14, "#f4f1e6");
  R(g, 220, 200, 12, 10, "#b4532a"); R(g, 222, 202, 8, 2, "#f3f0e6");
  R(g, 236, 201, 30, 1, "#9ca3af"); R(g, 236, 204, 26, 1, "#9ca3af"); R(g, 236, 207, 30, 1, "#d6475f");
}

function decorExecutivo(g: G) {
  // Gabinete: moldura da janela (o céu é animado), estante de pastas e diploma
  R(g, 68, 14, 34, 14, "#2a2d38");
  R(g, 22, 28, 44, 9, "#3a2a1f");
  for (let i = 0; i < 11; i++) R(g, 24 + i * 4, 29, 3, 7, ["#1f3a5f", "#e8e0c8", "#2b6cb0", "#6b7280", "#8a6a4a"][i % 5]);
  R(g, 108, 36, 12, 9, "#6b4a2e"); R(g, 109, 37, 10, 7, "#f4f1e6"); R(g, 111, 40, 6, 1, "#b45309");
  // Recepção: caixas de correspondência por urgência (vermelho = alta, âmbar = média, verde = baixa)
  R(g, 240, 15, 58, 10, "#2a2d38");
  for (let i = 0; i < 8; i++) {
    const urg = i < 2 ? "#d6475f" : i < 5 ? "#e5b83a" : "#4ca36b";
    R(g, 242 + i * 7, 17, 6, 7, "#3c4150"); R(g, 243 + i * 7, 18, 4, 5, urg);
    if (i % 3 !== 1) R(g, 243 + i * 7, 18, 4, 2, "#f4f1e6");
  }
  // Impressora de atas (a folha sai na camada animada)
  R(g, 278, 40, 20, 14, "#9aa3b2"); R(g, 280, 42, 16, 6, "#6b7280"); R(g, 282, 52, 12, 3, "#2a2d38");
  R(g, 292, 44, 3, 2, "#4ca36b");
  // Clipping: mural de recortes e um mapa
  R(g, 22, 134, 76, 10, "#6b4a2e"); R(g, 23, 135, 74, 8, "#caa56a");
  ["#f4f1e6", "#e0e7f1", "#fef3c7", "#f4f1e6", "#fce7e7", "#e0e7f1"].forEach((c, i) => { R(g, 26 + i * 12, 137 + (i % 2), 9, 5, c); R(g, 28 + i * 12, 139 + (i % 2), 5, 1, "#9ca3af"); R(g, 29 + i * 12, 136, 1, 1, "#d6475f"); });
  // Reunião: pauta na tela e calendário
  R(g, 214, 196, 60, 18, "#1c2030"); R(g, 216, 198, 56, 14, "#f4f6f8");
  [200, 204, 208].forEach((y, i) => { R(g, 220, y, 3, 2, i === 0 ? "#4ca36b" : "#d1d5db"); R(g, 226, y, 26 - i * 4, 1, "#6b7280"); });
  R(g, 256, 200, 12, 9, "#ffffff"); R(g, 256, 200, 12, 2, "#2b6cb0"); R(g, 259, 204, 2, 2, "#d6475f");
}

const DECOR: Record<SceneTheme, (g: G) => void> = { studio: decorStudio, university: decorUniversity, campus: decorCampus, editora: decorEditora, executivo: decorExecutivo };

const layerCache = new Map<SceneTheme, HTMLCanvasElement>();

/** Camada estática (piso, paredes, móveis, decoração, rótulos): desenhada uma vez por tema e reaproveitada. */
export function getStaticLayer(theme: SceneTheme): HTMLCanvasElement {
  const cached = layerCache.get(theme);
  if (cached) return cached;
  const p = PALETTES[theme];
  const c = document.createElement("canvas");
  c.width = 640; c.height = 640;
  const g = c.getContext("2d")!;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  R(g, 0, 0, 320, 320, "#1f2230");
  // Corredor central
  ([[106, 128, 62, 62], [106, 190, 80, 113], [152, 14, 16, 114]] as const).forEach(([x, y, w, h]) => {
    for (let yy = y; yy < y + h; yy += 8) for (let xx = x; xx < x + w; xx += 8) R(g, xx, yy, 8, 8, ((xx + yy) / 8) % 2 ? p.hall[0] : p.hall[1]);
  });
  (Object.keys(ROOMS) as RoomId[]).forEach((r) => { floor(g, r, p); grain(g, ROOMS[r].x, ROOMS[r].y, ROOMS[r].w, ROOMS[r].h); wallShade(g, ROOMS[r]); });
  // brilho do mármore no corredor
  ([[106, 128, 62, 62], [106, 190, 80, 113]] as const).forEach(([x, y, w, h]) => {
    grain(g, x, y, w, h);
    for (let i = 0; i < w + h; i += 24) R(g, x + ((i * 3) % w), y + ((i * 5) % h), 10, 1, "rgba(255,255,255,.04)");
  });
  furniture(g, p);
  details(g, p);
  DECOR[theme](g);
  (Object.keys(ROOMS) as RoomId[]).forEach((r) => walls(g, ROOMS[r]));
  // Portas
  R(g, 118, 126, 24, 4, p.hall[0]); R(g, 166, 150, 4, 24, p.hall[1]); R(g, 104, 150, 4, 22, p.hall[0]);
  R(g, 104, 230, 4, 22, p.hall[0]); R(g, 184, 230, 4, 22, p.hall[1]);
  // Moldura
  R(g, 0, 0, 320, 3, "#b79a5f"); R(g, 0, 317, 320, 3, "#b79a5f"); R(g, 0, 0, 3, 320, "#b79a5f"); R(g, 317, 0, 3, 320, "#b79a5f");
  // Rótulos das salas (em coordenadas de tela)
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = "700 9px ui-monospace, Consolas, monospace";
  g.textBaseline = "top";
  (Object.keys(ROOMS) as RoomId[]).forEach((r) => {
    const label = ROOM_LABELS[theme][r];
    const x = ROOMS[r].x * 2 + 8, y = ROOMS[r].y * 2 + 8, w = g.measureText(label).width + 10;
    g.fillStyle = "rgba(20,22,32,.72)"; g.fillRect(x - 4, y - 3, w, 15);
    g.fillStyle = "#f3e9cf"; g.fillText(label, x + 1, y);
  });
  layerCache.set(theme, c);
  return c;
}

export interface AnimInfo {
  t: number;
  /** Salas com pelo menos um agente (as vazias ficam mais escuras). */
  occupied: Set<RoomId>;
  /** Salas onde alguém está trabalhando agora (telas piscando). */
  working: Set<RoomId>;
  deliverables: number;
}

/** Camada animada: salas vazias escurecidas, telas piscando, luz REC, pilha de entregas na mesa da diretora. */
export function drawAnimated(ctx: G, theme: SceneTheme, info: AnimInfo) {
  const d0 = new Date();
  ctx.save();
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.imageSmoothingEnabled = false;

  (Object.keys(ROOMS) as RoomId[]).forEach((r) => {
    if (!info.occupied.has(r)) {
      const rm = ROOMS[r];
      R(ctx, rm.x, rm.y, rm.w, rm.h, "rgba(10,12,22,.38)");
    }
  });

  // Telas das mesas de operações piscam quando há trabalho lá
  if (info.working.has("ops")) {
    const f = Math.floor(info.t * 3) % 3;
    const cols = ["#4db3ff", "#6ee7b7", "#e9c46a"];
    [[186, 26], [198, 26], [222, 26], [234, 26], [230, 90], [262, 90], [236, 134], [264, 134]].forEach(([x, y], i) => {
      R(ctx, x + 1, y + 1, 6, 4, cols[(i + f) % 3]);
      R(ctx, x + 1, y + 1 + ((f + i) % 3), 6, 1, "rgba(255,255,255,.55)");
    });
  }
  // Luz REC do estúdio
  if (theme === "studio" && info.working.has("ops") && Math.floor(info.t * 2) % 2 === 0) R(ctx, 296, 94, 3, 3, "#ff3b3b");
  // Relógio-sinal da sala de reunião quando o time está reunido
  if (info.working.has("meet")) R(ctx, 276, 196, 3, 3, Math.floor(info.t * 2) % 2 ? "#6ee7b7" : "#14532d");

  // Editora: o quadro de capítulos ganha um cartão verde para cada entrega (até 6)
  if (theme === "editora") {
    const done = Math.min(info.deliverables, 6);
    for (let i = 0; i < done; i++) R(ctx, 295, 41 + i * 4, 3, 3, i % 2 ? "#86efac" : "#bbf7d0");
  }

  // Escritório executivo: céu da janela pelo horário real e folha saindo da impressora quando há trabalho na recepção
  if (theme === "executivo") {
    const h = d0.getHours() + d0.getMinutes() / 60;
    const sky = h < 6 || h >= 19.5 ? "#16203d" : h < 8 || h >= 17.5 ? "#e0955a" : "#9ec5e8";
    R(ctx, 70, 16, 30, 10, sky);
    R(ctx, 70, 19, 30, 1, "rgba(42,45,56,.55)"); R(ctx, 70, 22, 30, 1, "rgba(42,45,56,.55)");
    if (h < 6 || h >= 19.5) { R(ctx, 76, 18, 1, 1, "#f4f1e6"); R(ctx, 90, 20, 1, 1, "#f4f1e6"); R(ctx, 96, 17, 1, 1, "#f4f1e6"); }
    if (info.working.has("ops")) {
      const k = (info.t * 0.8) % 1;
      R(ctx, 281, 54, 10, Math.round(2 + k * 7), "#fffdf3");
    }
  }

  // Pilha de entregas na mesa da diretora
  const n = Math.min(info.deliverables, 8);
  for (let i = 0; i < n; i++) R(ctx, 98, 69 - i * 2, 9, 2, i % 2 ? "#f8f6ee" : "#fef3c7");

  // Relógio da parede da direção, com a hora real do navegador
  const d = new Date();
  const mAng = ((d.getMinutes() + d.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
  const hAng = (((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = "#1b2030"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(140, 23); ctx.lineTo(140 + Math.cos(mAng) * 4, 23 + Math.sin(mAng) * 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(140, 23); ctx.lineTo(140 + Math.cos(hAng) * 2.5, 23 + Math.sin(hAng) * 2.5); ctx.stroke();

  // Feixe de luz da janela da direção, com leve oscilação
  const sway = Math.sin(info.t * 0.4) * 0.015;
  ctx.fillStyle = `rgba(255,240,190,${0.07 + sway})`;
  ctx.beginPath(); ctx.moveTo(70, 26); ctx.lineTo(100, 26); ctx.lineTo(84, 78); ctx.lineTo(44, 78); ctx.closePath(); ctx.fill();

  // Vapor da cafeteira na copa
  for (let i = 0; i < 3; i++) {
    const k = ((info.t * 0.9 + i * 0.33) % 1);
    R(ctx, 30 + i * 2 + Math.round(Math.sin((info.t + i) * 2)), 198 - Math.round(k * 9), 1, 2, `rgba(255,255,255,${0.5 * (1 - k)})`);
  }

  // Hora do dia: noite azulada, entardecer quente
  const hour = d.getHours() + d.getMinutes() / 60;
  if (hour < 6 || hour >= 20) R(ctx, 0, 0, 320, 320, "rgba(20,30,80,.13)");
  else if (hour < 8 || hour >= 17) R(ctx, 0, 0, 320, 320, "rgba(255,160,70,.07)");

  // Vinheta: escurece as bordas para concentrar o olhar no meio
  const vg = ctx.createRadialGradient(160, 160, 100, 160, 160, 235);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.32)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, 320, 320);
  ctx.restore();
}
