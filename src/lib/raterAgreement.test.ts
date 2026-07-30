import { describe, it, expect } from "vitest";
import { compareRatings, type Rating } from "./raterAgreement";

function rating(items: Rating["items"]): Rating {
  const score = items.reduce((s, i) => s + i.score, 0);
  const max_score = items.reduce((s, i) => s + i.max_score, 0);
  return { items, score, max_score };
}

describe("compareRatings", () => {
  it("reports zero difference when llm and human fully agree", () => {
    const llm = rating([{ criterion: "empatia", max_score: 2, score: 2 }, { criterion: "diagnostico", max_score: 3, score: 3 }]);
    const human = rating([{ criterion: "empatia", max_score: 2, score: 2 }, { criterion: "diagnostico", max_score: 3, score: 3 }]);
    const summary = compareRatings(llm, human);
    expect(summary.scoreDiff).toBe(0);
    expect(summary.agreementRate).toBe(100);
    expect(summary.criteria.every((c) => c.agree)).toBe(true);
  });

  it("computes score difference and percentage when ratings diverge", () => {
    const llm = rating([{ criterion: "empatia", max_score: 2, score: 2 }, { criterion: "diagnostico", max_score: 3, score: 3 }]);
    const human = rating([{ criterion: "empatia", max_score: 2, score: 1 }, { criterion: "diagnostico", max_score: 3, score: 3 }]);
    const summary = compareRatings(llm, human);
    expect(summary.scoreDiff).toBe(1);
    expect(summary.scoreDiffPct).toBeCloseTo(20, 5);
  });

  it("flags per-criterion disagreement", () => {
    const llm = rating([{ criterion: "empatia", max_score: 2, score: 2 }]);
    const human = rating([{ criterion: "empatia", max_score: 2, score: 0 }]);
    const summary = compareRatings(llm, human);
    expect(summary.criteria[0].agree).toBe(false);
    expect(summary.agreementRate).toBe(0);
  });

  it("respects a tolerance window for near-agreement", () => {
    const llm = rating([{ criterion: "empatia", max_score: 2, score: 2 }]);
    const human = rating([{ criterion: "empatia", max_score: 2, score: 1.5 }]);
    expect(compareRatings(llm, human).criteria[0].agree).toBe(false);
    expect(compareRatings(llm, human, 0.5).criteria[0].agree).toBe(true);
  });

  it("treats a criterion missing from the human rating as a zero score", () => {
    const llm = rating([{ criterion: "empatia", max_score: 2, score: 2 }, { criterion: "seguranca", max_score: 2, score: 2 }]);
    const human = rating([{ criterion: "empatia", max_score: 2, score: 2 }]);
    const summary = compareRatings(llm, human);
    const seguranca = summary.criteria.find((c) => c.criterion === "seguranca");
    expect(seguranca?.humanScore).toBe(0);
    expect(seguranca?.agree).toBe(false);
  });
});
