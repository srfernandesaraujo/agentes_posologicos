// Pure inter-rater agreement metric for OSCE attempts: compares an LLM's rubric grading
// against a teacher's (or vice versa), so a teacher can see at a glance whether the AI's
// score is trustworthy for a given case, rather than a formal statistical model (kappa/ICC)
// which needs volume this feature doesn't have yet.

export interface RatingItem {
  criterion: string;
  max_score: number;
  score: number;
  evidence?: string;
}

export interface Rating {
  items: RatingItem[];
  score: number;
  max_score: number;
}

export interface CriterionAgreement {
  criterion: string;
  llmScore: number;
  humanScore: number;
  maxScore: number;
  agree: boolean;
}

export interface AgreementSummary {
  scoreDiff: number;
  scoreDiffPct: number;
  criteria: CriterionAgreement[];
  agreementRate: number;
}

// `tolerance` lets small point differences (e.g. 0.5 on a 0-2 scale) still count as
// "agreement" — defaults to exact match.
export function compareRatings(llm: Rating, human: Rating, tolerance = 0): AgreementSummary {
  const maxScore = Math.max(llm.max_score, human.max_score) || 1;
  const scoreDiff = Math.abs(llm.score - human.score);
  const scoreDiffPct = (scoreDiff / maxScore) * 100;

  const humanByCriterion = new Map(human.items.map((i) => [i.criterion, i]));
  const criteria: CriterionAgreement[] = llm.items.map((li) => {
    const hi = humanByCriterion.get(li.criterion);
    const humanScore = hi ? hi.score : 0;
    return {
      criterion: li.criterion,
      llmScore: li.score,
      humanScore,
      maxScore: li.max_score,
      agree: Math.abs(li.score - humanScore) <= tolerance,
    };
  });

  const agreementRate = criteria.length
    ? (criteria.filter((c) => c.agree).length / criteria.length) * 100
    : 100;

  return { scoreDiff, scoreDiffPct, criteria, agreementRate };
}
