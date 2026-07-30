import { describe, it, expect } from "vitest";
import {
  findInteractionMentions,
  extractBoxedWarningFact,
  extractPregnancyFact,
  deriveClinicalFacts,
  type LabelSections,
} from "../../supabase/functions/_shared/drugLabelFacts";

function section(overrides: Partial<LabelSections>): LabelSections {
  return {
    drug: "warfarin",
    contraindications: "",
    drugInteractions: "",
    warnings: "",
    boxedWarning: "",
    pregnancy: "",
    ...overrides,
  };
}

describe("findInteractionMentions", () => {
  it("flags a contraindication mention as red", () => {
    const facts = findInteractionMentions(
      section({ contraindications: "Concomitant use of warfarin with aspirin is contraindicated." }),
      ["aspirin"],
    );
    expect(facts).toHaveLength(1);
    expect(facts[0].level).toBe("red");
    expect(facts[0].category).toBe("interacao");
  });

  it("flags a drug_interactions mention as yellow when not contraindicated", () => {
    const facts = findInteractionMentions(
      section({ drugInteractions: "Ibuprofen may increase the anticoagulant effect of warfarin." }),
      ["ibuprofen"],
    );
    expect(facts).toHaveLength(1);
    expect(facts[0].level).toBe("yellow");
  });

  it("prefers the contraindication over a duplicate warning mention", () => {
    const facts = findInteractionMentions(
      section({
        contraindications: "Contraindicated with aspirin.",
        warnings: "Caution with aspirin use.",
      }),
      ["aspirin"],
    );
    expect(facts).toHaveLength(1);
    expect(facts[0].level).toBe("red");
  });

  it("returns no facts when the other drug isn't mentioned", () => {
    const facts = findInteractionMentions(
      section({ contraindications: "Contraindicated in patients with renal failure." }),
      ["acetaminophen"],
    );
    expect(facts).toHaveLength(0);
  });

  it("excludes the drug itself from the other-drug list", () => {
    const facts = findInteractionMentions(
      section({ drug: "aspirin", contraindications: "Aspirin is contraindicated in aspirin-sensitive asthma." }),
      ["aspirin"],
    );
    expect(facts).toHaveLength(0);
  });
});

describe("extractBoxedWarningFact", () => {
  it("returns null when there's no boxed warning", () => {
    expect(extractBoxedWarningFact(section({}))).toBeNull();
  });

  it("categorizes a renal boxed warning", () => {
    const fact = extractBoxedWarningFact(section({ boxedWarning: "May cause acute kidney injury and renal failure." }));
    expect(fact?.level).toBe("red");
    expect(fact?.category).toBe("renal");
  });

  it("categorizes a hepatic boxed warning", () => {
    const fact = extractBoxedWarningFact(section({ boxedWarning: "Risk of severe hepatic injury and liver failure." }));
    expect(fact?.category).toBe("hepatico");
  });

  it("falls back to 'outro' for an unrecognized boxed warning", () => {
    const fact = extractBoxedWarningFact(section({ boxedWarning: "Increased risk of serious bleeding events." }));
    expect(fact?.category).toBe("outro");
  });
});

describe("extractPregnancyFact", () => {
  it("returns null when the section is empty", () => {
    expect(extractPregnancyFact(section({}))).toBeNull();
  });

  it("flags high-risk pregnancy language as red", () => {
    const fact = extractPregnancyFact(section({ pregnancy: "Contraindicated in pregnancy due to fetal harm." }));
    expect(fact?.level).toBe("red");
    expect(fact?.category).toBe("gestacao");
  });

  it("flags cautionary pregnancy language as yellow", () => {
    const fact = extractPregnancyFact(section({ pregnancy: "Use in pregnancy only if benefit outweighs risk." }));
    expect(fact?.level).toBe("yellow");
  });

  it("returns null for purely informational pregnancy text", () => {
    const fact = extractPregnancyFact(section({ pregnancy: "Risk Summary: available data are limited." }));
    expect(fact).toBeNull();
  });
});

describe("deriveClinicalFacts", () => {
  it("aggregates interaction, boxed warning, and pregnancy facts across drugs", () => {
    const facts = deriveClinicalFacts([
      section({
        drug: "warfarin",
        contraindications: "Contraindicated with aspirin.",
        boxedWarning: "Can cause major or fatal bleeding.",
      }),
      section({ drug: "aspirin", pregnancy: "Avoid use in pregnancy; may cause fetal harm." }),
    ]);
    expect(facts.some((f) => f.category === "interacao" && f.level === "red")).toBe(true);
    expect(facts.some((f) => f.label.includes("tarja preta"))).toBe(true);
    expect(facts.some((f) => f.category === "gestacao")).toBe(true);
  });
});
