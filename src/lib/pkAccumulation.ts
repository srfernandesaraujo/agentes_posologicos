/**
 * Simulação didática de acúmulo de doses repetidas (modelo de 1 compartimento, absorção de 1ª ordem).
 * É uma ilustração: não usa parâmetros de nenhum fármaco específico e não substitui monitorização.
 * A concentração é relativa ao pico de uma dose única (= 1).
 */

export const LN2 = Math.LN2;

/** Constante de eliminação (1/h) a partir da meia-vida (h). */
export const keFromHalfLife = (halfLifeH: number) => LN2 / halfLifeH;

/** Constante de absorção usada na ilustração: nunca igual à de eliminação (evita singularidade). */
export const kaFor = (ke: number) => Math.max(1.4, ke * 3);

/** Fator de acúmulo no equilíbrio: R = 1 / (1 − e^(−ke·τ)). */
export function accumulationFactor(tauH: number, halfLifeH: number): number {
  return 1 / (1 - Math.exp(-keFromHalfLife(halfLifeH) * tauH));
}

/** Tempo aproximado para chegar ao equilíbrio (≈ 4,5 meias-vidas, cerca de 95%). */
export const timeToSteadyStateH = (halfLifeH: number) => 4.5 * halfLifeH;

/** Concentração relativa no instante t após a 1ª de `doses` doses dadas a cada `tauH` horas. */
export function relativeConcentration(t: number, tauH: number, halfLifeH: number, doses: number): number {
  const ke = keFromHalfLife(halfLifeH);
  const ka = kaFor(ke);
  const k = ka / (ka - ke);
  // pico de dose única, para normalizar
  const tmax = Math.log(ka / ke) / (ka - ke);
  const single = k * (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
  let sum = 0;
  for (let i = 0; i < doses; i++) {
    const x = t - i * tauH;
    if (x > 0) sum += k * (Math.exp(-ke * x) - Math.exp(-ka * x));
  }
  return sum / single;
}

export interface PkSeries {
  /** pontos (horas, concentração relativa) */
  points: [number, number][];
  doses: number;
  totalH: number;
  /** pico e vale no último intervalo entre doses (equilíbrio, se atingido) */
  peak: number;
  trough: number;
  max: number;
}

/** Série completa até o equilíbrio e um pouco além. */
export function simulate(tauH: number, halfLifeH: number): PkSeries {
  const doses = Math.min(40, Math.max(4, Math.ceil(timeToSteadyStateH(halfLifeH) / tauH) + 2));
  const totalH = doses * tauH;
  const step = totalH / 400;
  const points: [number, number][] = [];
  let max = 0, peak = 0, trough = Infinity;
  for (let t = 0; t <= totalH + 1e-9; t += step) {
    const c = relativeConcentration(t, tauH, halfLifeH, doses);
    points.push([t, c]);
    max = Math.max(max, c);
    if (t >= totalH - tauH) {
      peak = Math.max(peak, c);
      trough = Math.min(trough, c);
    }
  }
  return { points, doses, totalH, peak, trough: Number.isFinite(trough) ? trough : 0, max };
}
