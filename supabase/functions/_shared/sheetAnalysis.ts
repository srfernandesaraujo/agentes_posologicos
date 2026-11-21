// Análise de planilhas da Reunião Viva, toda feita por código: tipos das colunas, estatísticas, agrupamentos, correlação e previsão
// simples (regressão linear). O modelo só recebe os números prontos e os interpreta; nunca calcula. Sem rede e sem bibliotecas:
// testado em src/lib/sheetAnalysis.test.ts.
import { normName } from "./squadChatCore.ts";

export type Cell = string | number | null;
export interface Table { headers: string[]; rows: Cell[][] }
export type ColType = "number" | "date" | "text";
export interface ColumnInfo {
  name: string;
  type: ColType;
  nonEmpty: number;
  distinct: number;
  min?: number; max?: number; mean?: number; sum?: number; median?: number;
  dateMin?: string; dateMax?: string;
  top?: { value: string; count: number }[];
}

export const SHEET_MAX_ROWS = 4000;
export const SHEET_MAX_COLS = 30;
const MONTHS: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const isEmpty = (v: Cell): boolean => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Número em formato brasileiro ou americano, com moeda, porcentagem e negativo entre parênteses. */
export function parseNumber(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/^(r\$|us\$|\$|€|£)\s*/i, "").replace(/\s*%$/, "").replace(/\s/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  let norm: string;
  if (lastComma >= 0 && lastDot >= 0) {
    norm = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    norm = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    norm = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  } else norm = s;
  const n = Number(norm);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** Data em formatos comuns (dd/mm/aaaa, aaaa-mm-dd, mm/aaaa, "jan/2024", "janeiro de 2024"). Devolve ISO aaaa-mm-dd (UTC) ou null. */
export function parseDateCell(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = normName(String(v));
  if (!s) return null;
  const iso = (y: number, m: number, d: number): string | null => {
    if (y < 1900 || y > 2200 || m < 0 || m > 11 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m, d));
    return dt.getUTCMonth() === m ? dt.toISOString().slice(0, 10) : null;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ].*)?$/);
  if (m) return iso(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return iso(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) return iso(Number(m[2]), Number(m[1]) - 1, 1);
  m = s.match(/^([a-z]{3})[a-z]*(?:\s*(?:de|\/|-|\.)?\s*)(\d{2,4})$/);
  if (m && m[1] in MONTHS) {
    const y = Number(m[2]) < 100 ? 2000 + Number(m[2]) : Number(m[2]);
    return iso(y, MONTHS[m[1]], 1);
  }
  return null;
}

/** Cabeçalhos limpos: vazios viram "Coluna N" e repetidos ganham sufixo. */
export function cleanHeaders(raw: Cell[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = isEmpty(h) ? `Coluna ${i + 1}` : String(h).replace(/\s+/g, " ").trim().slice(0, 60);
    const k = name.toLowerCase();
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n > 1) name = `${name} (${n})`;
    return name;
  });
}

/** Primeira linha com pelo menos 2 células preenchidas vira o cabeçalho; linhas totalmente vazias saem; limites de linhas e colunas. */
export function toTable(grid: Cell[][]): Table {
  const rows = grid.filter((r) => r.some((c) => !isEmpty(c)));
  const headerIdx = Math.max(0, rows.findIndex((r) => r.filter((c) => !isEmpty(c)).length >= 2));
  const width = Math.min(SHEET_MAX_COLS, Math.max(0, ...rows.slice(headerIdx).map((r) => r.length)));
  const headers = cleanHeaders(Array.from({ length: width }, (_, i) => rows[headerIdx]?.[i] ?? null));
  const body = rows.slice(headerIdx + 1, headerIdx + 1 + SHEET_MAX_ROWS).map((r) => Array.from({ length: width }, (_, i) => (isEmpty(r[i] ?? null) ? null : (r[i] as Cell))));
  return { headers, rows: body };
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function inferColumns(t: Table): ColumnInfo[] {
  return t.headers.map((name, ci) => {
    const vals = t.rows.map((r) => r[ci]).filter((v) => !isEmpty(v ?? null)) as Cell[];
    const nums = vals.map(parseNumber);
    const dates = vals.map(parseDateCell);
    const numCount = nums.filter((n) => n !== null).length;
    const dateCount = dates.filter((d) => d !== null).length;
    const info: ColumnInfo = { name, type: "text", nonEmpty: vals.length, distinct: new Set(vals.map((v) => String(v))).size };
    if (vals.length && dateCount / vals.length >= 0.8 && numCount / vals.length < 0.8) {
      const ds = dates.filter((d): d is string => d !== null).sort();
      info.type = "date"; info.dateMin = ds[0]; info.dateMax = ds[ds.length - 1];
    } else if (vals.length && numCount / vals.length >= 0.8) {
      const ns = nums.filter((n): n is number => n !== null);
      info.type = "number";
      info.min = Math.min(...ns); info.max = Math.max(...ns);
      info.sum = ns.reduce((a, b) => a + b, 0); info.mean = info.sum / ns.length; info.median = median(ns);
    } else {
      const counts = new Map<string, number>();
      for (const v of vals) counts.set(String(v).trim(), (counts.get(String(v).trim()) ?? 0) + 1);
      info.top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value: value.slice(0, 60), count }));
    }
    return info;
  });
}

/** Coluna pelo nome (exato, sem acento e caixa, ou começando igual). */
export function findColumn(cols: ColumnInfo[], wanted: unknown): ColumnInfo | null {
  const w = normName(String(wanted ?? ""));
  if (!w) return null;
  return cols.find((c) => normName(c.name) === w) ?? cols.find((c) => normName(c.name).startsWith(w) || w.startsWith(normName(c.name))) ?? null;
}

export const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return "n/d";
  const abs = Math.abs(n);
  const d = abs >= 1000 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: d });
};

/** Descrição do arquivo para o agente: tamanho, colunas com tipo e estatísticas, e as primeiras linhas. */
export function describeTable(name: string, t: Table, cols: ColumnInfo[], sampleRows = 8): string {
  const colLines = cols.map((c) => {
    if (c.type === "number") return `- ${c.name} (número): ${c.nonEmpty} valores; mín ${fmtNum(c.min!)}, máx ${fmtNum(c.max!)}, média ${fmtNum(c.mean!)}, mediana ${fmtNum(c.median!)}, soma ${fmtNum(c.sum!)}`;
    if (c.type === "date") return `- ${c.name} (data): ${c.nonEmpty} valores, de ${c.dateMin} a ${c.dateMax}`;
    return `- ${c.name} (texto): ${c.nonEmpty} valores, ${c.distinct} distintos${c.top?.length ? `; mais frequentes: ${c.top.map((x) => `${x.value} (${x.count})`).join(", ")}` : ""}`;
  });
  const sample = t.rows.slice(0, sampleRows).map((r) => r.map((v) => (v === null ? "" : String(v).slice(0, 40))).join(" | "));
  return `Arquivo "${name}": ${t.rows.length} linhas e ${t.headers.length} colunas.\nColunas:\n${colLines.join("\n")}\n\nPrimeiras linhas (${t.headers.join(" | ")}):\n${sample.join("\n")}`;
}

// ---------- cálculos ----------

export type AggOp = "sum" | "mean" | "count" | "min" | "max";
export interface AggResult { rows: { group: string; value: number; count: number }[]; text: string }

export function aggregate(t: Table, cols: ColumnInfo[], p: { groupBy: string; valueColumn?: string; op: AggOp }): AggResult | null {
  const g = findColumn(cols, p.groupBy);
  if (!g) return null;
  const v = p.op === "count" ? null : findColumn(cols, p.valueColumn);
  if (p.op !== "count" && (!v || v.type !== "number")) return null;
  const gi = t.headers.indexOf(g.name), vi = v ? t.headers.indexOf(v.name) : -1;
  const acc = new Map<string, number[]>();
  for (const r of t.rows) {
    const key = isEmpty(r[gi]) ? "(vazio)" : g.type === "date" ? (parseDateCell(r[gi]) ?? String(r[gi])) : String(r[gi]).trim();
    const n = vi >= 0 ? parseNumber(r[vi]) : 1;
    if (n === null) continue;
    (acc.get(key) ?? acc.set(key, []).get(key)!).push(n);
  }
  const rows = [...acc.entries()].map(([group, ns]) => {
    const value = p.op === "sum" ? ns.reduce((a, b) => a + b, 0) : p.op === "mean" ? ns.reduce((a, b) => a + b, 0) / ns.length : p.op === "count" ? ns.length : p.op === "min" ? Math.min(...ns) : Math.max(...ns);
    return { group, value, count: ns.length };
  }).sort((a, b) => b.value - a.value).slice(0, 20);
  const label = p.op === "count" ? "contagem de linhas" : `${{ sum: "soma", mean: "média", min: "mínimo", max: "máximo" }[p.op]} de ${v!.name}`;
  const text = `Cálculo feito por código: ${label} por ${g.name} (${acc.size} grupos${acc.size > rows.length ? `, mostrando os ${rows.length} maiores` : ""}):\n` +
    rows.map((r) => `- ${r.group}: ${fmtNum(r.value)} (${r.count} linhas)`).join("\n");
  return { rows, text };
}

export function correlation(t: Table, cols: ColumnInfo[], a: string, b: string): { r: number; n: number; text: string } | null {
  const ca = findColumn(cols, a), cb = findColumn(cols, b);
  if (!ca || !cb || ca.type !== "number" || cb.type !== "number" || ca.name === cb.name) return null;
  const ia = t.headers.indexOf(ca.name), ib = t.headers.indexOf(cb.name);
  const xs: number[] = [], ys: number[] = [];
  for (const r of t.rows) {
    const x = parseNumber(r[ia]), y = parseNumber(r[ib]);
    if (x !== null && y !== null) { xs.push(x); ys.push(y); }
  }
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const strength = Math.abs(r) >= 0.7 ? "forte" : Math.abs(r) >= 0.4 ? "moderada" : "fraca";
  return { r, n, text: `Cálculo feito por código: correlação de Pearson entre ${ca.name} e ${cb.name}: r = ${r.toFixed(2).replace(".", ",")} (${strength}), com ${n} pares. Correlação não prova causa.` };
}

export interface ForecastResult {
  n: number; slope: number; intercept: number; r2: number;
  predictions: { label: string; value: number }[];
  warnings: string[]; text: string;
}

function nextLabels(lastIso: string | null, step: "month" | "year" | "day" | null, periods: number): string[] {
  if (!lastIso || !step) return Array.from({ length: periods }, (_, i) => `período +${i + 1}`);
  const d = new Date(`${lastIso}T00:00:00Z`);
  return Array.from({ length: periods }, (_, i) => {
    const x = new Date(d);
    if (step === "month") x.setUTCMonth(x.getUTCMonth() + i + 1);
    else if (step === "year") x.setUTCFullYear(x.getUTCFullYear() + i + 1);
    else x.setUTCDate(x.getUTCDate() + i + 1);
    return step === "year" ? String(x.getUTCFullYear()) : step === "month" ? `${MONTH_LABEL[x.getUTCMonth()]}/${x.getUTCFullYear()}` : x.toISOString().slice(0, 10);
  });
}

/**
 * Projeção linear simples (mínimos quadrados) da coluna de valor. Com coluna de data, ordena por data e soma os valores do mesmo dia.
 * É uma tendência, não um modelo estatístico: o texto devolvido traz o método, o número de pontos e os avisos.
 */
export function forecast(t: Table, cols: ColumnInfo[], p: { valueColumn: string; dateColumn?: string; periods?: number }): ForecastResult | null {
  const vc = findColumn(cols, p.valueColumn);
  if (!vc || vc.type !== "number") return null;
  const dc = p.dateColumn ? findColumn(cols, p.dateColumn) : cols.find((c) => c.type === "date") ?? null;
  const vi = t.headers.indexOf(vc.name);
  const di = dc && dc.type === "date" ? t.headers.indexOf(dc.name) : -1;
  const periods = Math.min(12, Math.max(1, Math.round(p.periods ?? 3)));

  let points: { x: string | null; y: number }[] = [];
  if (di >= 0) {
    const byDate = new Map<string, number>();
    for (const r of t.rows) {
      const d = parseDateCell(r[di]), y = parseNumber(r[vi]);
      if (d && y !== null) byDate.set(d, (byDate.get(d) ?? 0) + y);
    }
    points = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
  } else {
    points = t.rows.map((r) => parseNumber(r[vi])).filter((y): y is number => y !== null).map((y) => ({ x: null, y }));
  }
  const n = points.length;
  if (n < 3) return null;
  const xs = points.map((_, i) => i), ys = points.map((q) => q.y);
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

  // Passo entre datas (mensal, anual ou diário) para nomear os períodos futuros.
  let step: "month" | "year" | "day" | null = null;
  if (di >= 0 && n >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < n; i++) gaps.push((Date.parse(points[i].x!) - Date.parse(points[i - 1].x!)) / 86_400_000);
    const g = median(gaps);
    step = g >= 27 && g <= 32 ? "month" : g >= 360 && g <= 370 ? "year" : g >= 0.9 && g <= 1.1 ? "day" : null;
  }
  const labels = nextLabels(points[n - 1].x, step, periods);
  const predictions = labels.map((label, i) => ({ label, value: intercept + slope * (n + i) }));

  const warnings: string[] = [];
  if (n < 12) warnings.push(`só ${n} pontos: a projeção é pouco confiável`);
  if (r2 < 0.3) warnings.push(`ajuste fraco (R² = ${r2.toFixed(2).replace(".", ",")}): a tendência linear explica pouco da variação`);
  if (step === null && di >= 0) warnings.push("o intervalo entre as datas não é regular; os períodos futuros são aproximados");
  if (ys.some((y) => y < 0) === false && predictions.some((q) => q.value < 0)) warnings.push("a projeção chega a valores negativos, o que provavelmente não faz sentido para este dado");

  const trend = slope > 0 ? "alta" : slope < 0 ? "queda" : "estável";
  const text =
    `Cálculo feito por código: projeção linear (mínimos quadrados) de ${vc.name}${dc && di >= 0 ? ` por ${dc.name}` : " pela ordem das linhas"}, com ${n} pontos` +
    `${points[0].x ? ` (de ${points[0].x} a ${points[n - 1].x})` : ""}.\n` +
    `Tendência: ${trend}, ${fmtNum(slope)} por período; R² = ${r2.toFixed(2).replace(".", ",")}.\n` +
    `Projeção: ${predictions.map((q) => `${q.label}: ${fmtNum(q.value)}`).join("; ")}.\n` +
    (warnings.length ? `Avisos: ${warnings.join("; ")}.\n` : "") +
    `Isto é uma extrapolação de tendência, não considera sazonalidade nem fatores externos.`;
  return { n, slope, intercept, r2, predictions, warnings, text };
}

// ---------- plano do pedido (o modelo só escolhe o cálculo; o código executa) ----------

export type Plan =
  | { action: "summary" }
  | { action: "aggregate"; groupBy: string; valueColumn?: string; op: AggOp }
  | { action: "forecast"; valueColumn: string; dateColumn?: string; periods: number }
  | { action: "correlation"; a: string; b: string };

export function buildPlanPrompt(request: string, cols: ColumnInfo[]): { system: string; user: string } {
  const list = cols.map((c) => `- ${c.name} (${c.type === "number" ? "número" : c.type === "date" ? "data" : "texto"})`).join("\n");
  const system =
    `Você escolhe o cálculo a fazer numa planilha para atender o pedido do dono. Os cálculos são feitos por um programa; você só escolhe qual e com quais colunas (use os nomes exatos). ` +
    `Ações: "summary" (visão geral, quando o pedido é genérico), "aggregate" (agrupar: groupBy, valueColumn numérica, op em sum|mean|count|min|max), ` +
    `"forecast" (previsão ou projeção de uma coluna numérica no tempo: valueColumn, dateColumn se houver, periods de 1 a 12), "correlation" (relação entre duas colunas numéricas: a, b). ` +
    `Responda SOMENTE com JSON, por exemplo {"action":"forecast","valueColumn":"Vendas","dateColumn":"Mês","periods":3}.`;
  return { system, user: `Pedido:\n${request}\n\nColunas:\n${list}` };
}

export function parsePlan(text: string, cols: ColumnInfo[]): Plan {
  const m = text.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  if (!m) return { action: "summary" };
  let raw: any;
  try { raw = JSON.parse(m[0]); } catch { return { action: "summary" }; }
  const num = (c: unknown) => { const x = findColumn(cols, c); return x && x.type === "number" ? x.name : null; };
  if (raw?.action === "forecast") {
    const v = num(raw.valueColumn);
    const d = findColumn(cols, raw.dateColumn);
    if (v) return { action: "forecast", valueColumn: v, dateColumn: d && d.type === "date" ? d.name : undefined, periods: Math.min(12, Math.max(1, Math.round(Number(raw.periods) || 3))) };
  }
  if (raw?.action === "aggregate") {
    const g = findColumn(cols, raw.groupBy);
    const op: AggOp = ["sum", "mean", "count", "min", "max"].includes(raw.op) ? raw.op : "sum";
    const v = num(raw.valueColumn);
    if (g && (op === "count" || v)) return { action: "aggregate", groupBy: g.name, valueColumn: v ?? undefined, op };
  }
  if (raw?.action === "correlation") {
    const a = num(raw.a), b = num(raw.b);
    if (a && b && a !== b) return { action: "correlation", a, b };
  }
  return { action: "summary" };
}

/** Executa o plano. Sem resultado possível (coluna errada, poucos pontos), devolve só um aviso para o agente repassar. */
export function runPlan(t: Table, cols: ColumnInfo[], plan: Plan): { text: string; calc: Record<string, unknown> | null } {
  if (plan.action === "forecast") {
    const f = forecast(t, cols, plan);
    return f ? { text: f.text, calc: { action: "forecast", n: f.n, r2: f.r2, slope: f.slope, predictions: f.predictions, warnings: f.warnings } }
      : { text: "Cálculo feito por código: não foi possível projetar (a coluna precisa ser numérica e ter pelo menos 3 valores).", calc: null };
  }
  if (plan.action === "aggregate") {
    const a = aggregate(t, cols, plan);
    return a ? { text: a.text, calc: { action: "aggregate", rows: a.rows.slice(0, 12) } }
      : { text: "Cálculo feito por código: não foi possível agrupar com essas colunas.", calc: null };
  }
  if (plan.action === "correlation") {
    const c = correlation(t, cols, plan.a, plan.b);
    return c ? { text: c.text, calc: { action: "correlation", r: c.r, n: c.n } }
      : { text: "Cálculo feito por código: não foi possível calcular a correlação (precisa de duas colunas numéricas com pelo menos 3 pares).", calc: null };
  }
  return { text: "", calc: null };
}
