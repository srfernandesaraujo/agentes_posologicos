import {
  calcBodySurfaceArea,
  calcCreatinineClearance,
  calcDoseByBsa,
  calcWeightBasedDose,
  classifyRenalFunction,
  isCalcErr,
  RENAL_STAGE_LABEL,
  type BiologicalSex,
} from "@/lib/doseCalculator";

/**
 * Interpreta frases curtas da omnibar ("70 kg 5 mg/kg", "clearance 65 anos 72 kg creatinina 1,2 feminino")
 * e resolve com as mesmas funções determinísticas da Calculadora de Dose. Sem LLM, funciona offline.
 */
export interface OmnibarCalc {
  kind: "dose-kg" | "dose-m2" | "bsa" | "crcl";
  title: string;
  /** valor principal já formatado, ex.: "350" */
  value: string;
  unit: string;
  details: string[];
  formula: string;
}

export interface OmnibarCalcHint {
  kind: "hint";
  message: string;
}

const NUM = "(\\d+(?:[.,]\\d+)?)";
const toNum = (s: string) => parseFloat(s.replace(",", "."));
const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function take(text: string, re: RegExp): { value: number | null; rest: string } {
  const m = text.match(re);
  if (!m) return { value: null, rest: text };
  return { value: toNum(m[1]), rest: text.replace(m[0], " ") };
}

export function parseOmnibarCalc(input: string): OmnibarCalc | OmnibarCalcHint | null {
  let t = strip(input).replace(/m²/g, "m2");
  if (t.trim().length < 4) return null;

  // unidades compostas primeiro, para "kg" de "mg/kg" não ser lido como peso
  const mgKg = take(t, new RegExp(`${NUM}\\s*mg\\s*/\\s*kg`));
  t = mgKg.rest;
  const mgM2 = take(t, new RegExp(`${NUM}\\s*mg\\s*/\\s*m2`));
  t = mgM2.rest;
  const maxDose = take(t, new RegExp(`(?:max(?:imo|ima)?|limite|teto)\\s*(?:de\\s*)?${NUM}\\s*mg`));
  t = maxDose.rest;
  const weight = take(t, new RegExp(`${NUM}\\s*kg\\b`));
  t = weight.rest;
  const heightCm = take(t, new RegExp(`${NUM}\\s*cm\\b`));
  t = heightCm.rest;
  const heightM = heightCm.value === null ? take(t, new RegExp(`(?:altura|alt)\\s*(?:de\\s*)?${NUM}\\s*m?\\b`)) : { value: null, rest: t };
  t = heightM.rest;
  const age = take(t, new RegExp(`${NUM}\\s*anos?\\b`));
  t = age.rest;
  const creat =
    take(t, new RegExp(`(?:creatinina|creat|scr)\\s*(?:serica\\s*)?(?:=|:|de)?\\s*${NUM}`)).value !== null
      ? take(t, new RegExp(`(?:creatinina|creat|scr)\\s*(?:serica\\s*)?(?:=|:|de)?\\s*${NUM}`))
      : take(t, new RegExp(`${NUM}\\s*mg\\s*/\\s*dl`));
  t = creat.rest;

  let sex: BiologicalSex | null = null;
  if (/\b(feminino|mulher|fem|sexo f)\b/.test(t)) sex = "F";
  else if (/\b(masculino|homem|masc|sexo m)\b/.test(t)) sex = "M";

  let height: number | null = heightCm.value;
  if (height === null && heightM.value !== null) height = heightM.value < 3 ? heightM.value * 100 : heightM.value;

  const wantsCrcl = /clearance|clcr|crcl|cockcroft|depuracao/.test(t);
  const wantsBsa = /\basc\b|\bbsa\b|superficie/.test(t);

  // 1) Cockcroft-Gault
  if (wantsCrcl || (age.value !== null && creat.value !== null && weight.value !== null)) {
    const missing: string[] = [];
    if (age.value === null) missing.push("idade (ex.: 65 anos)");
    if (weight.value === null) missing.push("peso (ex.: 72 kg)");
    if (creat.value === null) missing.push("creatinina (ex.: creatinina 1,2)");
    if (sex === null) missing.push("sexo (masculino ou feminino)");
    if (missing.length) return { kind: "hint", message: `Para o clearance de creatinina, falta: ${missing.join(", ")}.` };
    const r = calcCreatinineClearance({ ageYears: age.value!, weightKg: weight.value!, sex: sex!, serumCreatinineMgDl: creat.value! });
    if (isCalcErr(r)) return { kind: "hint", message: r.error };
    return {
      kind: "crcl",
      title: "Clearance de creatinina",
      value: fmt(r.value),
      unit: "mL/min",
      details: [RENAL_STAGE_LABEL[classifyRenalFunction(r.value)]],
      formula: r.formula,
    };
  }

  // 2) dose por m²
  if (mgM2.value !== null) {
    if (weight.value === null || height === null) return { kind: "hint", message: "Para dose por m², informe peso e altura (ex.: 70 kg 170 cm)." };
    const bsa = calcBodySurfaceArea({ heightCm: height, weightKg: weight.value });
    if (isCalcErr(bsa)) return { kind: "hint", message: bsa.error };
    const d = calcDoseByBsa({ bsaM2: bsa.value, doseMgPerM2: mgM2.value, maxDoseMg: maxDose.value ?? undefined });
    if (isCalcErr(d)) return { kind: "hint", message: d.error };
    return {
      kind: "dose-m2",
      title: "Dose por superfície corporal",
      value: fmt(d.value.totalDoseMg),
      unit: "mg",
      details: [`Superfície corporal ${fmt(bsa.value, 2)} m² × ${fmt(mgM2.value, 2)} mg/m²`, ...(d.value.cappedAtMax ? ["Limitada à dose máxima informada"] : [])],
      formula: d.formula,
    };
  }

  // 3) dose por kg
  if (mgKg.value !== null) {
    if (weight.value === null) return { kind: "hint", message: "Para dose por kg, informe o peso (ex.: 70 kg)." };
    const d = calcWeightBasedDose({ weightKg: weight.value, doseMgPerKg: mgKg.value, maxDoseMg: maxDose.value ?? undefined });
    if (isCalcErr(d)) return { kind: "hint", message: d.error };
    return {
      kind: "dose-kg",
      title: "Dose por peso",
      value: fmt(d.value.totalDoseMg),
      unit: "mg",
      details: [`${fmt(weight.value)} kg × ${fmt(mgKg.value, 2)} mg/kg`, ...(d.value.cappedAtMax ? ["Limitada à dose máxima informada"] : [])],
      formula: d.formula,
    };
  }

  // 4) superfície corporal
  if (wantsBsa || (weight.value !== null && height !== null)) {
    if (weight.value === null || height === null) return { kind: "hint", message: "Para a superfície corporal, informe peso e altura (ex.: 70 kg 170 cm)." };
    const r = calcBodySurfaceArea({ heightCm: height, weightKg: weight.value });
    if (isCalcErr(r)) return { kind: "hint", message: r.error };
    return { kind: "bsa", title: "Superfície corporal", value: fmt(r.value, 2), unit: "m²", details: [`${fmt(weight.value)} kg · ${fmt(height, 0)} cm`], formula: r.formula };
  }

  return null;
}

export const OMNIBAR_CALC_DISCLAIMER = "Cálculo determinístico de apoio. Não substitui o julgamento clínico.";
