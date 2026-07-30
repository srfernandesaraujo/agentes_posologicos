import { describe, it, expect } from "vitest";
import {
  calcWeightBasedDose,
  calcBodySurfaceArea,
  calcDoseByBsa,
  calcCreatinineClearance,
  classifyRenalFunction,
  estimatePediatricWeightKg,
} from "./doseCalculator";

describe("calcWeightBasedDose", () => {
  it("multiplies weight by dose per kg", () => {
    const r = calcWeightBasedDose({ weightKg: 10, doseMgPerKg: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalDoseMg).toBe(50);
      expect(r.value.cappedAtMax).toBe(false);
    }
  });

  it("caps at maxDoseMg and flags it", () => {
    const r = calcWeightBasedDose({ weightKg: 10, doseMgPerKg: 5, maxDoseMg: 40 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalDoseMg).toBe(40);
      expect(r.value.cappedAtMax).toBe(true);
    }
  });

  it("rejects non-positive inputs", () => {
    expect(calcWeightBasedDose({ weightKg: 0, doseMgPerKg: 5 }).ok).toBe(false);
    expect(calcWeightBasedDose({ weightKg: 10, doseMgPerKg: -1 }).ok).toBe(false);
    expect(calcWeightBasedDose({ weightKg: 10, doseMgPerKg: 5, maxDoseMg: 0 }).ok).toBe(false);
  });
});

describe("calcBodySurfaceArea", () => {
  it("computes Mosteller BSA correctly", () => {
    const r = calcBodySurfaceArea({ heightCm: 170, weightKg: 70, formula: "mosteller" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(1.82, 2);
  });

  it("computes Du Bois BSA in a plausible range close to Mosteller", () => {
    const r = calcBodySurfaceArea({ heightCm: 170, weightKg: 70, formula: "dubois" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeGreaterThan(1.6);
    if (r.ok) expect(r.value).toBeLessThan(2.0);
  });

  it("rejects non-positive inputs", () => {
    expect(calcBodySurfaceArea({ heightCm: 0, weightKg: 70 }).ok).toBe(false);
    expect(calcBodySurfaceArea({ heightCm: 170, weightKg: -5 }).ok).toBe(false);
  });
});

describe("calcDoseByBsa", () => {
  it("multiplies BSA by dose per m2", () => {
    const r = calcDoseByBsa({ bsaM2: 1.5, doseMgPerM2: 100 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.totalDoseMg).toBe(150);
  });

  it("caps at maxDoseMg", () => {
    const r = calcDoseByBsa({ bsaM2: 1.5, doseMgPerM2: 100, maxDoseMg: 120 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalDoseMg).toBe(120);
      expect(r.value.cappedAtMax).toBe(true);
    }
  });
});

describe("calcCreatinineClearance", () => {
  it("computes Cockcroft-Gault for a male patient", () => {
    const r = calcCreatinineClearance({ ageYears: 60, weightKg: 70, sex: "M", serumCreatinineMgDl: 1.0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(77.8, 1);
  });

  it("applies the 0.85 female correction factor", () => {
    const r = calcCreatinineClearance({ ageYears: 60, weightKg: 70, sex: "F", serumCreatinineMgDl: 1.0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(66.1, 1);
  });

  it("rejects invalid age", () => {
    expect(calcCreatinineClearance({ ageYears: 200, weightKg: 70, sex: "M", serumCreatinineMgDl: 1.0 }).ok).toBe(false);
  });
});

describe("classifyRenalFunction", () => {
  it("classifies each CKD stage boundary correctly", () => {
    expect(classifyRenalFunction(95)).toBe("normal");
    expect(classifyRenalFunction(77.8)).toBe("leve");
    expect(classifyRenalFunction(45)).toBe("moderada");
    expect(classifyRenalFunction(20)).toBe("grave");
    expect(classifyRenalFunction(10)).toBe("falencia");
  });
});

describe("estimatePediatricWeightKg", () => {
  it("applies the APLS formula for 1-10 years", () => {
    const r = estimatePediatricWeightKg(6);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(20);
  });

  it("rejects ages outside the 1-10 range", () => {
    expect(estimatePediatricWeightKg(11).ok).toBe(false);
    expect(estimatePediatricWeightKg(0).ok).toBe(false);
  });
});
