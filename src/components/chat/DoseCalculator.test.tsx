import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DoseCalculator } from "./DoseCalculator";

describe("DoseCalculator", () => {
  it("renders nothing when disabled", () => {
    const { container } = render(<DoseCalculator enabled={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on toggle and computes a weight-based dose live", () => {
    render(<DoseCalculator enabled={true} />);

    fireEvent.click(screen.getByTitle("Abrir Calculadora de Dose"));
    expect(screen.getByText("Calculadora de Dose")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Dose (mg/kg)"), { target: { value: "5" } });

    expect(screen.getByText("50 mg")).toBeInTheDocument();
  });

  it("flags when a weight-based dose is capped at the informed maximum", () => {
    render(<DoseCalculator enabled={true} />);
    fireEvent.click(screen.getByTitle("Abrir Calculadora de Dose"));

    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Dose (mg/kg)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Dose máxima (mg) — opcional"), { target: { value: "40" } });

    expect(screen.getByText("40 mg")).toBeInTheDocument();
    expect(screen.getByText("Limitado pela dose máxima informada.")).toBeInTheDocument();
  });

  it("shows a friendly error box instead of crashing on invalid input", () => {
    render(<DoseCalculator enabled={true} />);
    fireEvent.click(screen.getByTitle("Abrir Calculadora de Dose"));

    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("Dose (mg/kg)"), { target: { value: "5" } });

    expect(screen.getByText("Peso deve ser um número positivo.")).toBeInTheDocument();
  });

  it("computes creatinine clearance and renal stage on the Renal tab", () => {
    render(<DoseCalculator enabled={true} />);
    fireEvent.click(screen.getByTitle("Abrir Calculadora de Dose"));
    // Radix Tabs activates on focus (its default "automatic" activation mode),
    // and jsdom's fireEvent.click doesn't move focus the way a real click does.
    fireEvent.click(screen.getByRole("tab", { name: "Renal" }));
    fireEvent.focus(screen.getByRole("tab", { name: "Renal" }));

    fireEvent.change(screen.getByLabelText("Idade (anos)"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "70" } });
    fireEvent.change(screen.getByLabelText("Creatinina sérica (mg/dL)"), { target: { value: "1.0" } });

    expect(screen.getByText("77.8 mL/min")).toBeInTheDocument();
    expect(screen.getByText(/Insuficiência renal leve/)).toBeInTheDocument();
  });
});
