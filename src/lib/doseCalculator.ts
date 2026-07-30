/**
 * Cálculos posológicos determinísticos (sem LLM).
 * Fórmulas padrão da literatura farmacológica — cada função documenta a
 * referência usada. Nada aqui substitui o julgamento clínico.
 */

export type CalcOk<T> = { ok: true; value: T; formula: string };
export type CalcErr = { ok: false; error: string };
export type CalcResult<T> = CalcOk<T> | CalcErr;

/**
 * Type guard for `CalcResult`. Needed because this project compiles with
 * `strictNullChecks: false` (tsconfig.app.json), under which plain
 * `result.ok ? ... : ...` / `if (result.ok)` checks do not narrow the union —
 * use this instead of relying on inferred discriminant narrowing.
 */
export function isCalcErr<T>(result: CalcResult<T>): result is CalcErr {
  return result.ok === false;
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

// ---------------------------------------------------------------------------
// 1) Dose por peso (mg/kg)
// ---------------------------------------------------------------------------

export interface WeightDoseInput {
  weightKg: number;
  doseMgPerKg: number;
  maxDoseMg?: number;
}

export interface WeightDoseValue {
  totalDoseMg: number;
  cappedAtMax: boolean;
}

export function calcWeightBasedDose(input: WeightDoseInput): CalcResult<WeightDoseValue> {
  const { weightKg, doseMgPerKg, maxDoseMg } = input;
  if (!isPositive(weightKg)) return { ok: false, error: "Peso deve ser um número positivo." };
  if (!isPositive(doseMgPerKg)) return { ok: false, error: "Dose por kg deve ser um número positivo." };
  if (maxDoseMg !== undefined && !isPositive(maxDoseMg)) {
    return { ok: false, error: "Dose máxima deve ser um número positivo." };
  }

  const raw = weightKg * doseMgPerKg;
  const cappedAtMax = maxDoseMg !== undefined && raw > maxDoseMg;
  const totalDoseMg = cappedAtMax ? (maxDoseMg as number) : raw;

  return {
    ok: true,
    value: { totalDoseMg, cappedAtMax },
    formula: "dose total (mg) = peso (kg) × dose (mg/kg)" + (maxDoseMg !== undefined ? ", limitada à dose máxima informada" : ""),
  };
}

// ---------------------------------------------------------------------------
// 2) Superfície corporal (BSA) e dose por m²
// ---------------------------------------------------------------------------

export type BsaFormula = "mosteller" | "dubois";

export interface BsaInput {
  heightCm: number;
  weightKg: number;
  formula?: BsaFormula;
}

export function calcBodySurfaceArea(input: BsaInput): CalcResult<number> {
  const { heightCm, weightKg } = input;
  const formula = input.formula ?? "mosteller";
  if (!isPositive(heightCm)) return { ok: false, error: "Altura deve ser um número positivo (cm)." };
  if (!isPositive(weightKg)) return { ok: false, error: "Peso deve ser um número positivo (kg)." };

  if (formula === "mosteller") {
    const bsa = Math.sqrt((heightCm * weightKg) / 3600);
    return { ok: true, value: Number(bsa.toFixed(2)), formula: "Mosteller: BSA (m²) = √[(altura(cm) × peso(kg)) / 3600]" };
  }

  // Du Bois & Du Bois
  const bsa = 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
  return { ok: true, value: Number(bsa.toFixed(2)), formula: "Du Bois: BSA (m²) = 0,007184 × altura(cm)^0,725 × peso(kg)^0,425" };
}

export interface BsaDoseInput {
  bsaM2: number;
  doseMgPerM2: number;
  maxDoseMg?: number;
}

export function calcDoseByBsa(input: BsaDoseInput): CalcResult<WeightDoseValue> {
  const { bsaM2, doseMgPerM2, maxDoseMg } = input;
  if (!isPositive(bsaM2)) return { ok: false, error: "Superfície corporal deve ser um número positivo (m²)." };
  if (!isPositive(doseMgPerM2)) return { ok: false, error: "Dose por m² deve ser um número positivo." };
  if (maxDoseMg !== undefined && !isPositive(maxDoseMg)) {
    return { ok: false, error: "Dose máxima deve ser um número positivo." };
  }

  const raw = bsaM2 * doseMgPerM2;
  const cappedAtMax = maxDoseMg !== undefined && raw > maxDoseMg;
  const totalDoseMg = cappedAtMax ? (maxDoseMg as number) : raw;

  return {
    ok: true,
    value: { totalDoseMg, cappedAtMax },
    formula: "dose total (mg) = superfície corporal (m²) × dose (mg/m²)" + (maxDoseMg !== undefined ? ", limitada à dose máxima informada" : ""),
  };
}

// ---------------------------------------------------------------------------
// 3) Clearance de creatinina (Cockcroft-Gault) e estadiamento renal
// ---------------------------------------------------------------------------

export type BiologicalSex = "F" | "M";

export interface CreatinineClearanceInput {
  ageYears: number;
  weightKg: number;
  sex: BiologicalSex;
  serumCreatinineMgDl: number;
}

export function calcCreatinineClearance(input: CreatinineClearanceInput): CalcResult<number> {
  const { ageYears, weightKg, sex, serumCreatinineMgDl } = input;
  if (!isPositive(ageYears) || ageYears > 130) return { ok: false, error: "Idade inválida." };
  if (!isPositive(weightKg)) return { ok: false, error: "Peso deve ser um número positivo (kg)." };
  if (!isPositive(serumCreatinineMgDl)) return { ok: false, error: "Creatinina sérica deve ser um número positivo (mg/dL)." };

  const sexFactor = sex === "F" ? 0.85 : 1;
  const crcl = ((140 - ageYears) * weightKg * sexFactor) / (72 * serumCreatinineMgDl);

  return {
    ok: true,
    value: Number(crcl.toFixed(1)),
    formula: "Cockcroft-Gault: CrCl (mL/min) = [(140 − idade) × peso(kg) × (0,85 se sexo feminino)] / (72 × creatinina sérica(mg/dL))",
  };
}

export type RenalStage = "normal" | "leve" | "moderada" | "grave" | "falencia";

export const RENAL_STAGE_LABEL: Record<RenalStage, string> = {
  normal: "Função renal normal (CrCl ≥ 90 mL/min)",
  leve: "Insuficiência renal leve (CrCl 60–89 mL/min)",
  moderada: "Insuficiência renal moderada (CrCl 30–59 mL/min)",
  grave: "Insuficiência renal grave (CrCl 15–29 mL/min)",
  falencia: "Falência renal (CrCl < 15 mL/min)",
};

export function classifyRenalFunction(crclMlMin: number): RenalStage {
  if (crclMlMin >= 90) return "normal";
  if (crclMlMin >= 60) return "leve";
  if (crclMlMin >= 30) return "moderada";
  if (crclMlMin >= 15) return "grave";
  return "falencia";
}

// ---------------------------------------------------------------------------
// 4) Estimativa de peso pediátrico (quando peso real é desconhecido)
// ---------------------------------------------------------------------------

/**
 * Estimativa de emergência (APLS) para peso em crianças de 1–10 anos
 * quando o peso real não está disponível. Usar o peso real sempre que possível.
 */
export function estimatePediatricWeightKg(ageYears: number): CalcResult<number> {
  if (!isPositive(ageYears) || ageYears > 10) {
    return { ok: false, error: "Estimativa válida apenas para 1–10 anos; para outras faixas, use o peso real." };
  }
  const weight = (ageYears + 4) * 2;
  return { ok: true, value: weight, formula: "APLS: peso estimado (kg) = (idade(anos) + 4) × 2 — válido para 1–10 anos" };
}
