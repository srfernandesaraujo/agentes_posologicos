// Personagens em pixel art: contorno escuro, sombreamento, penteados, acessório por função,
// braços balançando ao andar e digitação ao trabalhar. Desenhado em coordenadas de tela (2x).
import { accessoryFor, hairStyleFor } from "@/lib/squadOffice";
import type { SimAgent } from "@/lib/squadOfficeSim";

const OUT = "#161923";

export function drawAgentSprite(ctx: CanvasRenderingContext2D, a: SimAgent, t: number, coat: boolean, nowS: number) {
  const px = Math.round(a.x) * 2;
  const baseY = Math.round(a.y) * 2;
  let py = baseY;
  if (nowS < a.hopUntil) py -= Math.round(Math.abs(Math.sin(t * 9)) * 8);

  const walking = a.moving;
  const sw = walking ? Math.floor(t * 8) % 2 : 0;
  const working = a.state === "work" && !walking;
  const bob = walking ? sw * 2 : working ? Math.floor(t * 3) % 2 : 0;
  const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const { shirt, hair, skin } = a.look;
  const acc = accessoryFor(a.info.slug);
  const style = hairStyleFor(a.info.name);

  const legL = { x: px - 6, y: py - 10 + (sw ? 0 : 2), w: 4, h: 10 - (sw ? 0 : 2) };
  const legR = { x: px + 2, y: py - 10 + (sw ? 2 : 0), w: 4, h: 10 - (sw ? 2 : 0) };
  const torso = { x: px - 8, y: py - 24 - bob, w: 16, h: 14 };
  const swing = walking ? (sw ? 2 : -2) : 0;
  const armL = { x: px - 10, y: py - 22 - bob + swing, w: 3, h: 9 };
  const armR = { x: px + 7, y: py - 22 - bob - swing, w: 3, h: 9 };
  const head = { x: px - 6, y: py - 36 - bob, w: 12, h: 12 };

  // sombra no chão
  R(px - 10, baseY - 2, 20, 4, "rgba(0,0,0,.32)");

  // contorno
  [legL, legR, torso, armL, armR, head].forEach((p) => R(p.x - 2, p.y - 2, p.w + 4, p.h + 4, OUT));
  R(px - 9, py - 40 - bob, 18, 8, OUT);
  if (style === 1) R(px - 10, py - 36 - bob, 4, 14, OUT);
  if (style === 1) R(px + 6, py - 36 - bob, 4, 14, OUT);
  if (style === 2) R(px - 5, py - 46 - bob, 10, 8, OUT);

  // pernas e sapatos
  R(legL.x, legL.y, legL.w, legL.h, "#252a3d"); R(legR.x, legR.y, legR.w, legR.h, "#252a3d");
  R(legL.x, legL.y + legL.h - 2, 4, 2, "#0f1118"); R(legR.x, legR.y + legR.h - 2, 4, 2, "#0f1118");

  // tronco e braços
  R(torso.x, torso.y, torso.w, torso.h, shirt);
  R(torso.x, torso.y + 11, torso.w, 3, "rgba(0,0,0,.2)");
  R(torso.x, torso.y, torso.w, 3, "rgba(255,255,255,.22)");
  R(armL.x, armL.y, armL.w, armL.h, shirt); R(armR.x, armR.y, armR.w, armR.h, shirt);
  R(armL.x, armL.y + 6, 3, 3, skin); R(armR.x, armR.y + 6, 3, 3, skin);
  if (coat) {
    [torso.x, torso.x + 10].forEach((x) => R(x, torso.y, 6, torso.h, "#f4f6f8"));
    R(armL.x, armL.y, 3, 6, "#f4f6f8"); R(armR.x, armR.y, 3, 6, "#f4f6f8");
    R(px - 1, torso.y + 2, 2, 10, "rgba(0,0,0,.12)");
  }
  if (acc === "blazer") {
    R(torso.x, torso.y, torso.w, torso.h, "#1f2937"); R(torso.x, torso.y, torso.w, 3, "rgba(255,255,255,.14)");
    R(px - 3, torso.y, 6, 9, "#e5e7eb"); R(px - 1, torso.y + 1, 2, 7, shirt);
    R(armL.x, armL.y, 3, 6, "#1f2937"); R(armR.x, armR.y, 3, 6, "#1f2937");
  }
  // crachá
  if (acc !== "blazer") R(px + 3, torso.y + 5, 3, 4, "#e9e5da");

  // digitando: mãos à frente, alternando
  if (working) {
    const f = Math.floor(t * 6) % 2;
    R(px - 5, py - 12 - bob + (f ? 0 : 2), 3, 2, skin);
    R(px + 2, py - 12 - bob + (f ? 2 : 0), 3, 2, skin);
  }

  // cabeça, cabelo, olhos
  R(head.x, head.y, head.w, head.h, skin);
  R(head.x, head.y + 9, head.w, 3, "rgba(0,0,0,.08)");
  R(px - 7, py - 38 - bob, 14, style === 3 ? 8 : 6, hair);
  R(px - 7, py - 34 - bob, 2, 6, hair);
  if (style === 1) { R(px - 8, py - 34 - bob, 2, 12, hair); R(px + 6, py - 34 - bob, 2, 12, hair); }
  if (style === 2) { R(px - 4, py - 45 - bob, 8, 6, hair); R(px - 4, py - 45 - bob, 8, 1, "rgba(255,255,255,.2)"); }
  R(px - 7, py - 38 - bob, 14, 1, "rgba(255,255,255,.18)");
  const eyeY = py - 31 - bob;
  const blink = Math.floor(t * 1.5 + a.info.sort_order * 3.1) % 9 === 0;
  const ex = a.dir > 0 ? 1 : -1;
  R(px - 4 + ex, eyeY + (blink ? 1 : 0), 2, blink ? 1 : 3, "#1b1b24");
  R(px + 1 + ex, eyeY + (blink ? 1 : 0), 2, blink ? 1 : 3, "#1b1b24");

  // acessórios
  if (acc === "glasses") {
    R(px - 5 + ex, eyeY - 1, 4, 5, "#1f2937"); R(px + 0 + ex, eyeY - 1, 4, 5, "#1f2937");
    R(px - 4 + ex, eyeY, 2, 3, "#bfdbfe"); R(px + 1 + ex, eyeY, 2, 3, "#bfdbfe"); R(px - 1 + ex, eyeY, 2, 1, "#1f2937");
  }
  if (acc === "headphones") {
    R(px - 7, py - 40 - bob, 14, 2, "#111827"); R(px - 9, py - 35 - bob, 3, 7, "#ef4444"); R(px + 6, py - 35 - bob, 3, 7, "#ef4444");
  }
  if (acc === "beret") {
    R(px - 8, py - 42 - bob, 16, 4, "#7c3aed"); R(px - 6, py - 44 - bob, 12, 2, "#7c3aed"); R(px - 1, py - 46 - bob, 2, 2, "#4c1d95");
  }
  if (acc === "headset") {
    R(px - 7, py - 40 - bob, 14, 2, "#111827"); R(px - 9, py - 35 - bob, 3, 6, "#111827");
    R(px - 8, py - 29 - bob, 1, 5, "#111827"); R(px - 8, py - 25 - bob, 5, 1, "#111827");
  }

  // indicador de estado
  const sc = a.state === "work" || a.state === "meet" ? "#6ee7b7" : a.state === "walk" ? "#ffd166" : a.state === "wait" ? "#93c5fd" : "#8b93a8";
  R(px - 4, py - 54 - bob - (style === 2 ? 2 : 0), 8, 6, OUT); R(px - 3, py - 53 - bob - (style === 2 ? 2 : 0), 6, 4, sc);
}
