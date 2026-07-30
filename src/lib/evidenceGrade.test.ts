import { describe, it, expect } from "vitest";
import { classifyEvidence } from "../../supabase/functions/_shared/evidenceGrade";

describe("classifyEvidence", () => {
  it("ranks meta-analyses and systematic reviews as tier 1", () => {
    expect(classifyEvidence(["Meta-Analysis"]).tier).toBe(1);
    expect(classifyEvidence(["Journal Article", "Systematic Review"]).tier).toBe(1);
    expect(classifyEvidence(["Practice Guideline"]).tier).toBe(1);
  });

  it("ranks randomized controlled trials as tier 2", () => {
    expect(classifyEvidence(["Randomized Controlled Trial"]).tier).toBe(2);
  });

  it("ranks observational/cohort studies as tier 3", () => {
    expect(classifyEvidence(["Observational Study"]).tier).toBe(3);
    expect(classifyEvidence(["Journal Article", "Multicenter Study"]).tier).toBe(3);
  });

  it("ranks case reports and narrative reviews as tier 4", () => {
    expect(classifyEvidence(["Case Reports"]).tier).toBe(4);
    expect(classifyEvidence(["Review"]).tier).toBe(4);
  });

  it("prioritizes the highest tier when multiple pub types are present", () => {
    // A Case Reports article that is also a Meta-Analysis should rank as tier 1.
    expect(classifyEvidence(["Case Reports", "Meta-Analysis"]).tier).toBe(1);
  });

  it("falls back to tier 5 for unrecognized or missing publication types", () => {
    expect(classifyEvidence(["Journal Article"]).tier).toBe(5);
    expect(classifyEvidence([]).tier).toBe(5);
  });
});
