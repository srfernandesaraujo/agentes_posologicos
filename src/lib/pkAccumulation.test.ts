import { describe, expect, it } from "vitest";
import { accumulationFactor, relativeConcentration, simulate, timeToSteadyStateH } from "./pkAccumulation";

describe("pkAccumulation", () => {
  it("fator de acúmulo é 2 quando o intervalo é igual à meia-vida", () => {
    expect(accumulationFactor(8, 8)).toBeCloseTo(2, 5);
  });

  it("fator de acúmulo tende a 1 quando o intervalo é muito maior que a meia-vida", () => {
    expect(accumulationFactor(100, 4)).toBeCloseTo(1, 3);
  });

  it("tempo até o equilíbrio é cerca de 4,5 meias-vidas", () => {
    expect(timeToSteadyStateH(10)).toBe(45);
  });

  it("o pico de dose única vale 1 (normalização)", () => {
    const peak = Math.max(...Array.from({ length: 200 }, (_, i) => relativeConcentration(i * 0.1, 100, 6, 1)));
    expect(peak).toBeCloseTo(1, 2);
  });

  it("doses repetidas acumulam: o pico no equilíbrio supera o de dose única", () => {
    const s = simulate(6, 12);
    expect(s.peak).toBeGreaterThan(1.2);
    expect(s.trough).toBeGreaterThan(0);
    expect(s.peak).toBeGreaterThan(s.trough);
  });

  it("não quebra com meia-vida muito curta (ka próxima de ke)", () => {
    const s = simulate(4, 0.5);
    expect(Number.isFinite(s.peak)).toBe(true);
    expect(s.points.every(([, c]) => Number.isFinite(c))).toBe(true);
  });
});
