import { describe, expect, it } from "vitest";
import {
  aggregate, buildPlanPrompt, cleanHeaders, correlation, describeTable, findColumn, forecast, inferColumns, parseDateCell, parseNumber, parsePlan, runPlan, toTable,
  SHEET_MAX_COLS, type Cell,
} from "../../supabase/functions/_shared/sheetAnalysis";

describe("parseNumber", () => {
  it("lê formatos brasileiro e americano", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("R$ 1.200,50")).toBe(1200.5);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1.234")).toBe(1234);
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("12%")).toBe(12);
    expect(parseNumber("(5)")).toBe(-5);
    expect(parseNumber("-7,5")).toBe(-7.5);
    expect(parseNumber(42)).toBe(42);
  });
  it("texto e vazio não são número", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber("12abc")).toBeNull();
  });
});

describe("parseDateCell", () => {
  it("entende os formatos comuns", () => {
    expect(parseDateCell("2025-03-15")).toBe("2025-03-15");
    expect(parseDateCell("15/03/2025")).toBe("2025-03-15");
    expect(parseDateCell("03/2025")).toBe("2025-03-01");
    expect(parseDateCell("jan/2025")).toBe("2025-01-01");
    expect(parseDateCell("Março de 2025")).toBe("2025-03-01");
    expect(parseDateCell("2025-03-15T10:00:00Z")).toBe("2025-03-15");
  });
  it("recusa datas impossíveis e texto", () => {
    expect(parseDateCell("31/02/2025")).toBeNull();
    expect(parseDateCell("Anticoagulantes")).toBeNull();
    expect(parseDateCell("")).toBeNull();
  });
});

describe("tabela", () => {
  it("cabeçalhos vazios e repetidos ganham nome único", () => {
    expect(cleanHeaders(["Vendas", "", "vendas", null])).toEqual(["Vendas", "Coluna 2", "vendas (2)", "Coluna 4"]);
  });
  it("pula linhas vazias do topo e usa a primeira linha cheia como cabeçalho", () => {
    const t = toTable([[null, null], ["Relatório"], ["Mês", "Vendas"], ["jan/2025", 10], [null, null], ["fev/2025", 12]]);
    expect(t.headers).toEqual(["Mês", "Vendas"]);
    expect(t.rows).toHaveLength(2);
  });
  it("limita colunas", () => {
    const wide = [Array.from({ length: 50 }, (_, i) => `c${i}`), Array.from({ length: 50 }, (_, i) => i)];
    expect(toTable(wide).headers).toHaveLength(SHEET_MAX_COLS);
  });
});

const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const sales: Cell[][] = [["Mês", "Canal", "Vendas"]];
months.forEach((m, i) => { sales.push([`${m}/2025`, "Loja", 100 + i * 10]); sales.push([`${m}/2025`, "Site", 50 + i * 5]); });
const salesTable = toTable(sales);
const salesCols = inferColumns(salesTable);

describe("inferColumns e descrição", () => {
  it("detecta data, texto e número com estatísticas", () => {
    expect(salesCols.map((c) => c.type)).toEqual(["date", "text", "number"]);
    const v = salesCols[2];
    expect(v.sum).toBe(100 * 12 + 10 * 66 + 50 * 12 + 5 * 66);
    expect(v.min).toBe(50);
    expect(v.max).toBe(210);
    expect(salesCols[1].top?.[0]).toEqual({ value: "Loja", count: 12 });
    expect(salesCols[0].dateMin).toBe("2025-01-01");
    expect(salesCols[0].dateMax).toBe("2025-12-01");
  });
  it("a descrição traz tamanho, colunas e amostra", () => {
    const d = describeTable("vendas.xlsx", salesTable, salesCols, 3);
    expect(d).toContain('Arquivo "vendas.xlsx": 24 linhas e 3 colunas.');
    expect(d).toContain("- Vendas (número)");
    expect(d).toContain("- Mês (data)");
    expect(d.split("\n").filter((l) => l.startsWith("jan/2025")).length).toBe(2);
  });
  it("findColumn aceita acento, caixa e prefixo", () => {
    expect(findColumn(salesCols, "mes")?.name).toBe("Mês");
    expect(findColumn(salesCols, "VENDAS")?.name).toBe("Vendas");
    expect(findColumn(salesCols, "inexistente")).toBeNull();
  });
});

describe("cálculos", () => {
  it("agrupa e ordena do maior para o menor", () => {
    const a = aggregate(salesTable, salesCols, { groupBy: "Canal", valueColumn: "Vendas", op: "sum" })!;
    expect(a.rows.map((r) => r.group)).toEqual(["Loja", "Site"]);
    expect(a.rows[0].value).toBe(100 * 12 + 660);
    expect(a.text).toContain("soma de Vendas por Canal");
    expect(aggregate(salesTable, salesCols, { groupBy: "Canal", op: "count" })!.rows[0].value).toBe(12);
    expect(aggregate(salesTable, salesCols, { groupBy: "Canal", valueColumn: "Canal", op: "sum" })).toBeNull();
  });
  it("correlação de Pearson", () => {
    const t = toTable([["a", "b"], [1, 2], [2, 4], [3, 6], [4, 8]]);
    const c = correlation(t, inferColumns(t), "a", "b")!;
    expect(c.r).toBeCloseTo(1, 5);
    expect(c.text).toContain("forte");
    expect(correlation(toTable([["a", "b"], [1, 1], [2, 1], [3, 1]]), inferColumns(toTable([["a", "b"], [1, 1], [2, 1], [3, 1]])), "a", "b")).toBeNull();
  });
  it("projeta uma série mensal somando os canais do mesmo mês", () => {
    const f = forecast(salesTable, salesCols, { valueColumn: "Vendas", periods: 3 })!;
    expect(f.n).toBe(12);
    // por mês: 150 + 15*i  → inclinação 15, projeção do 13º mês = 150 + 15*12
    expect(f.slope).toBeCloseTo(15, 5);
    expect(f.r2).toBeCloseTo(1, 5);
    expect(f.predictions[0]).toEqual({ label: "jan/2026", value: expect.closeTo(330, 5) });
    expect(f.predictions.map((p) => p.label)).toEqual(["jan/2026", "fev/2026", "mar/2026"]);
    expect(f.warnings).toEqual([]);
    expect(f.text).toContain("Cálculo feito por código");
    expect(f.text).toContain("não considera sazonalidade");
  });
  it("avisa quando há poucos pontos ou ajuste fraco", () => {
    const t = toTable([["Mês", "V"], ["jan/2025", 10], ["fev/2025", 50], ["mar/2025", 12], ["abr/2025", 48]]);
    const f = forecast(t, inferColumns(t), { valueColumn: "V" })!;
    expect(f.warnings.join(" ")).toContain("só 4 pontos");
    expect(f.warnings.join(" ")).toContain("ajuste fraco");
  });
  it("sem coluna de data usa a ordem das linhas; sem pontos suficientes devolve null", () => {
    const t = toTable([["V"], [1], [2], [3], [4]]);
    const f = forecast(t, inferColumns(t), { valueColumn: "V", periods: 2 })!;
    expect(f.predictions.map((p) => p.label)).toEqual(["período +1", "período +2"]);
    expect(f.predictions[0].value).toBeCloseTo(5, 5);
    expect(forecast(toTable([["V"], [1], [2]]), inferColumns(toTable([["V"], [1], [2]])), { valueColumn: "V" })).toBeNull();
    expect(forecast(salesTable, salesCols, { valueColumn: "Canal" })).toBeNull();
  });
});

describe("plano do pedido", () => {
  it("o prompt lista as colunas com o tipo", () => {
    const p = buildPlanPrompt("previsão de vendas", salesCols);
    expect(p.user).toContain("- Vendas (número)");
    expect(p.system).toContain("Responda SOMENTE com JSON");
  });
  it("valida o plano contra as colunas reais e limita períodos", () => {
    expect(parsePlan('{"action":"forecast","valueColumn":"vendas","dateColumn":"mes","periods":99}', salesCols)).toEqual({ action: "forecast", valueColumn: "Vendas", dateColumn: "Mês", periods: 12 });
    expect(parsePlan('```json\n{"action":"aggregate","groupBy":"canal","valueColumn":"vendas","op":"mean"}\n```', salesCols)).toEqual({ action: "aggregate", groupBy: "Canal", valueColumn: "Vendas", op: "mean" });
    expect(parsePlan('{"action":"forecast","valueColumn":"coluna que não existe"}', salesCols)).toEqual({ action: "summary" });
    expect(parsePlan("sem json", salesCols)).toEqual({ action: "summary" });
    expect(parsePlan('{"action":"correlation","a":"Vendas","b":"Vendas"}', salesCols)).toEqual({ action: "summary" });
  });
  it("executa o plano e avisa quando não dá", () => {
    expect(runPlan(salesTable, salesCols, { action: "forecast", valueColumn: "Vendas", periods: 2 }).text).toContain("projeção linear");
    expect(runPlan(salesTable, salesCols, { action: "forecast", valueColumn: "Canal", periods: 2 }).calc).toBeNull();
    expect(runPlan(salesTable, salesCols, { action: "summary" })).toEqual({ text: "", calc: null });
  });
});
