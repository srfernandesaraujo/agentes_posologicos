// Deterministic (non-LLM) clinical-fact derivation from official FDA drug label text
// (openFDA / DailyMed), so clinical-validator's alerts are grounded in the real label
// instead of an LLM inventing them. Pure logic, no Deno-only APIs, importable from both
// the edge function and vitest tests — same split as evidenceGrade.ts.

export type FactLevel = "green" | "yellow" | "red";
export type FactCategory = "interacao" | "dose" | "renal" | "hepatico" | "alergia" | "gestacao" | "outro";

export interface ClinicalFact {
  level: FactLevel;
  category: FactCategory;
  label: string;
  detail: string;
  source: string;
}

export interface LabelSections {
  drug: string;
  contraindications: string;
  drugInteractions: string;
  warnings: string;
  boxedWarning: string;
  pregnancy: string;
  setId?: string;
}

function sourceFor(section: LabelSections): string {
  const url = section.setId
    ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${section.setId}`
    : `https://open.fda.gov/apis/drug/label/`;
  return `FDA Label (DailyMed)|${url}`;
}

// Returns a ~160-char window of `text` around the first case-insensitive match of `needle`.
function excerptAround(text: string, needle: string, window = 160): string {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return text.slice(0, window).trim();
  const start = Math.max(0, idx - window / 2);
  const end = Math.min(text.length, idx + needle.length + window / 2);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function containsDrugName(haystack: string, drugName: string): boolean {
  if (!haystack || !drugName) return false;
  const escaped = drugName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

// Cross-references one drug's label sections against the other extracted drug names,
// checking contraindications (red) before drug_interactions/warnings (yellow) so a drug
// pair reported in both only produces the higher-severity fact.
export function findInteractionMentions(section: LabelSections, otherDrugNames: string[]): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const others = otherDrugNames.filter((d) => d.toLowerCase() !== section.drug.toLowerCase());

  for (const other of others) {
    if (containsDrugName(section.contraindications, other)) {
      facts.push({
        level: "red",
        category: "interacao",
        label: `${section.drug} + ${other}: contraindicação descrita na bula`,
        detail: excerptAround(section.contraindications, other),
        source: sourceFor(section),
      });
      continue;
    }
    const interactionText = section.drugInteractions || section.warnings;
    if (containsDrugName(interactionText, other)) {
      facts.push({
        level: "yellow",
        category: "interacao",
        label: `${section.drug} + ${other}: interação descrita na bula`,
        detail: excerptAround(interactionText, other),
        source: sourceFor(section),
      });
    }
  }
  return facts;
}

const RENAL_RE = /\brenal\b|\bkidney\b|nephro/i;
const HEPATIC_RE = /\bhepatic\b|\bliver\b|hepato/i;

export function extractBoxedWarningFact(section: LabelSections): ClinicalFact | null {
  const text = (section.boxedWarning || "").trim();
  if (!text) return null;
  const category: FactCategory = RENAL_RE.test(text) ? "renal" : HEPATIC_RE.test(text) ? "hepatico" : "outro";
  return {
    level: "red",
    category,
    label: `${section.drug}: alerta de tarja preta (boxed warning)`,
    detail: excerptAround(text, section.drug, 200),
    source: sourceFor(section),
  };
}

const PREGNANCY_HIGH_RISK_RE = /contraindicat|do not use.*pregnan|avoid.*pregnan|teratogenic|fetal (harm|toxicity|death)|category x/i;
const PREGNANCY_CAUTION_RE = /category d|risk cannot be ruled out|use.*only if.*benefit|caution.*pregnan/i;

export function extractPregnancyFact(section: LabelSections): ClinicalFact | null {
  const text = (section.pregnancy || "").trim();
  if (!text) return null;
  if (PREGNANCY_HIGH_RISK_RE.test(text)) {
    return {
      level: "red",
      category: "gestacao",
      label: `${section.drug}: risco descrito na gestação`,
      detail: excerptAround(text, "pregnan", 200),
      source: sourceFor(section),
    };
  }
  if (PREGNANCY_CAUTION_RE.test(text)) {
    return {
      level: "yellow",
      category: "gestacao",
      label: `${section.drug}: atenção na gestação`,
      detail: excerptAround(text, "pregnan", 200),
      source: sourceFor(section),
    };
  }
  return null;
}

// Runs all deterministic checks for a set of extracted drug label sections.
export function deriveClinicalFacts(sections: LabelSections[]): ClinicalFact[] {
  const allNames = sections.map((s) => s.drug);
  const facts: ClinicalFact[] = [];
  for (const section of sections) {
    facts.push(...findInteractionMentions(section, allNames));
    const boxed = extractBoxedWarningFact(section);
    if (boxed) facts.push(boxed);
    const pregnancy = extractPregnancyFact(section);
    if (pregnancy) facts.push(pregnancy);
  }
  return facts;
}
