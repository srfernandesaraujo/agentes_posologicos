// Deterministic (non-LLM) evidence-grade classification for PubMed citations,
// mapping NCBI publication types to a 5-tier evidence hierarchy. Pure logic,
// no Deno-only APIs, so it's importable from both the edge function and tests.

export type EvidenceTier = 1 | 2 | 3 | 4 | 5;

export interface EvidenceGrade {
  tier: EvidenceTier;
  label: string;
}

const TIER_RULES: Array<{ tier: EvidenceTier; label: string; test: RegExp }> = [
  { tier: 1, label: "Diretriz / revisão sistemática / meta-análise", test: /meta-analysis|systematic review|practice guideline|guideline/i },
  { tier: 2, label: "Ensaio clínico randomizado", test: /randomized controlled trial|controlled clinical trial|^clinical trial/i },
  { tier: 3, label: "Estudo observacional / comparativo", test: /observational study|comparative study|cohort|case-control|multicenter study/i },
  { tier: 4, label: "Relato de caso / revisão narrativa", test: /case reports?|^review$|editorial|comment|letter/i },
];

export function classifyEvidence(pubTypes: string[]): EvidenceGrade {
  const joined = (pubTypes || []).join(" | ");
  for (const rule of TIER_RULES) {
    if (rule.test.test(joined)) return { tier: rule.tier, label: rule.label };
  }
  return { tier: 5, label: "Não classificado" };
}
