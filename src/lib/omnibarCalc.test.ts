import { describe, expect, it } from "vitest";
import { parseOmnibarCalc } from "./omnibarCalc";

describe("parseOmnibarCalc", () => {
  it("dose por peso", () => {
    const r = parseOmnibarCalc("70 kg 5 mg/kg");
    expect(r).toMatchObject({ kind: "dose-kg", value: "350", unit: "mg" });
  });

  it("dose por peso com vírgula e teto", () => {
    const r = parseOmnibarCalc("dose 15 mg/kg paciente 80 kg máximo 1000 mg");
    expect(r).toMatchObject({ kind: "dose-kg", value: "1.000" });
    expect((r as any).details.join(" ")).toMatch(/máxima/);
  });

  it("clearance de creatinina (Cockcroft-Gault)", () => {
    const r = parseOmnibarCalc("clearance 60 anos 70 kg creatinina 1,0 masculino");
    expect(r).toMatchObject({ kind: "crcl", value: "77,8", unit: "mL/min" });
  });

  it("clearance sem todos os dados devolve dica", () => {
    const r = parseOmnibarCalc("clearance 70 kg");
    expect(r).toMatchObject({ kind: "hint" });
    expect((r as any).message).toMatch(/idade/);
  });

  it("superfície corporal por peso e altura", () => {
    const r = parseOmnibarCalc("70 kg 170 cm");
    expect(r).toMatchObject({ kind: "bsa", value: "1,82", unit: "m²" });
  });

  it("dose por m²", () => {
    const r = parseOmnibarCalc("100 mg/m² 70 kg 170 cm");
    expect(r).toMatchObject({ kind: "dose-m2", value: "182" });
  });

  it("altura em metros", () => {
    const r = parseOmnibarCalc("asc 70 kg altura 1,70");
    expect(r).toMatchObject({ kind: "bsa", value: "1,82" });
  });

  it("texto comum não vira cálculo", () => {
    expect(parseOmnibarCalc("abrir reunião")).toBeNull();
    expect(parseOmnibarCalc("squad")).toBeNull();
  });
});
