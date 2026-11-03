import { describe, it, expect } from "vitest";
import {
  planTasks, pickNextTask, budgetState, clampCap, maskPii, screenInput, buildTaskUserMessage,
  type SquadTemplate, type TaskLite,
} from "../../supabase/functions/_shared/squadCore";
import { TEMPLATE_CONTEUDO_YOUTUBE, getTemplate } from "../../supabase/functions/_shared/squadTemplates";

describe("planTasks", () => {
  it("gera um pipeline sequencial a partir do template de Conteúdo", () => {
    const tasks = planTasks(TEMPLATE_CONTEUDO_YOUTUBE);
    expect(tasks).toHaveLength(6);
    expect(tasks[0].dependsOnPosition).toBeNull();
    expect(tasks.slice(1).every((t, i) => t.dependsOnPosition === i)).toBe(true);
    expect(tasks.filter((t) => t.deliverable?.final)).toHaveLength(1);
    expect(tasks[tasks.length - 1].deliverable?.final).toBe(true);
  });

  it("rejeita etapa com agente inexistente", () => {
    const bad: SquadTemplate = { ...TEMPLATE_CONTEUDO_YOUTUBE, steps: [{ agent: "fantasma", title: "x", instructions: "y" }] };
    expect(() => planTasks(bad)).toThrow(/fantasma/);
  });

  it("todo template registrado tem agentes e etapas consistentes", () => {
    const t = getTemplate("conteudo-youtube")!;
    expect(() => planTasks(t)).not.toThrow();
    expect(t.maxCapUsd).toBeGreaterThanOrEqual(t.defaultCapUsd);
    expect(getTemplate("nao-existe")).toBeNull();
  });
});

describe("pickNextTask", () => {
  const t = (position: number, status: TaskLite["status"]): TaskLite => ({
    id: `t${position}`, position, status, depends_on_position: position === 0 ? null : position - 1,
  });
  it("começa pela primeira tarefa pendente", () => {
    const r = pickNextTask([t(0, "pending"), t(1, "pending")]);
    expect(r).toEqual({ kind: "task", task: expect.objectContaining({ id: "t0" }) });
  });
  it("só libera a tarefa cuja dependência terminou", () => {
    const r = pickNextTask([t(0, "done"), t(1, "pending"), t(2, "pending")]);
    expect(r).toEqual({ kind: "task", task: expect.objectContaining({ id: "t1" }) });
  });
  it("não inicia outra enquanto uma está rodando", () => {
    expect(pickNextTask([t(0, "done"), t(1, "running"), t(2, "pending")]).kind).toBe("busy");
  });
  it("sinaliza falha e conclusão", () => {
    expect(pickNextTask([t(0, "done"), t(1, "failed")]).kind).toBe("failed");
    expect(pickNextTask([t(0, "done"), t(1, "done")]).kind).toBe("finished");
  });
});

describe("teto de custo", () => {
  it("classifica ok, aviso (80%) e estourado", () => {
    expect(budgetState(1, 4)).toBe("ok");
    expect(budgetState(3.2, 4)).toBe("warn");
    expect(budgetState(4, 4)).toBe("exceeded");
    expect(budgetState(0, 0)).toBe("exceeded");
  });
  it("clampCap usa padrão para valor inválido e respeita o máximo", () => {
    const tpl = { defaultCapUsd: 4, maxCapUsd: 20 };
    expect(clampCap(undefined, tpl)).toBe(4);
    expect(clampCap("abc", tpl)).toBe(4);
    expect(clampCap(-3, tpl)).toBe(4);
    expect(clampCap(7.5, tpl)).toBe(7.5);
    expect(clampCap(999, tpl)).toBe(20);
  });
});

describe("filtro de dados pessoais", () => {
  it("mascara CPF, e-mail, telefone, nascimento e prontuário", () => {
    const { text, findings } = maskPii(
      "Paciente CPF 123.456.789-09, email joao@exemplo.com, tel (84) 99876-5432, nascimento: 12/03/1980, prontuário nº 4455.12",
    );
    expect(text).not.toMatch(/123\.456\.789-09/);
    expect(text).not.toMatch(/joao@exemplo\.com/);
    expect(text).not.toMatch(/99876-5432/);
    expect(text).not.toMatch(/12\/03\/1980/);
    expect(text).not.toMatch(/4455\.12/);
    expect(text).toMatch(/nascimento: \[data removida\]/);
    expect(findings.map((f) => f.type).sort()).toEqual(["cpf", "email", "nascimento", "prontuario", "telefone"]);
  });
  it("não altera texto sem identificadores nem mexe em números comuns", () => {
    const s = "Dose de 500 mg a cada 8 horas por 7 dias, creatinina 1,2 em 2024.";
    expect(maskPii(s)).toEqual({ text: s, findings: [] });
  });
  it("só filtra em squads de dados de saúde", () => {
    const s = "contato maria@x.com";
    expect(screenInput(s, "normal").text).toBe(s);
    expect(screenInput(s, "dados_pessoais").text).toBe(s);
    expect(screenInput(s, "dados_saude").text).not.toMatch(/maria@x\.com/);
  });
});

describe("buildTaskUserMessage", () => {
  it("inclui missão, formulário, trabalho anterior e a tarefa atual", () => {
    const msg = buildTaskUserMessage({
      briefing: "Vídeo sobre varfarina",
      formData: { publico: "Pacientes", vazio: "" },
      step: { title: "Roteiro", instructions: "Escreva." },
      previous: [{ agentName: "Helena", title: "Plano", output: "plano aqui" }],
    });
    expect(msg).toContain("Vídeo sobre varfarina");
    expect(msg).toContain("publico: Pacientes");
    expect(msg).not.toContain("vazio");
    expect(msg).toContain("Plano (por Helena)");
    expect(msg.trim().endsWith("Escreva.")).toBe(true);
  });
  it("corta saídas anteriores muito longas", () => {
    const msg = buildTaskUserMessage({
      briefing: "x", formData: {}, step: { title: "t", instructions: "i" },
      previous: [{ agentName: "A", title: "T", output: "a".repeat(20000) }],
    });
    expect(msg.length).toBeLessThan(8000);
    expect(msg).toContain("trecho cortado");
  });
});
