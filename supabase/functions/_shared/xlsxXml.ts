// Leitura de .xlsx sem biblioteca de planilha: um .xlsx é um zip com XML. Aqui ficam as partes puras (XML → células);
// o zip é aberto em fileParsers.ts. Testado em src/lib/xlsxXml.test.ts e, com arquivos reais gerados por outra ferramenta, no deploy.
import type { Cell } from "./sheetAnalysis.ts";

const decode = (s: string): string =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
};

/** Textos compartilhados (xl/sharedStrings.xml): cada <si> pode ter vários trechos <t> (texto formatado). */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const parts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1]));
    out.push(parts.join(""));
  }
  return out;
}

const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Formato de número de data? Ignora textos entre aspas, escapes e cores/condições entre colchetes. */
export function isDateFormat(code: string): boolean {
  const c = code.replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/\[[^\]]*\]/g, "").toLowerCase();
  if (c === "general" || c === "") return false;
  return /[dy]/.test(c) || (/h/.test(c) && /[ms]/.test(c));
}

/** Índices de estilo (atributo s das células) cujo formato é de data, a partir de xl/styles.xml. */
export function parseDateStyles(xml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = attr(m[0], "numFmtId"), code = attr(m[0], "formatCode");
    if (id !== null && code !== null) custom.set(Number(id), code);
  }
  const block = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const dates = new Set<number>();
  let i = 0;
  for (const m of block.matchAll(/<xf\b[^>]*?(?:\/>|>)/g)) {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    if (BUILTIN_DATE_IDS.has(id) || (custom.has(id) && isDateFormat(custom.get(id)!))) dates.add(i);
    i++;
  }
  return dates;
}

/** Número de série do Excel (sistema 1900) → aaaa-mm-dd. Corrige o ano bissexto inexistente de 1900. */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const days = Math.floor(serial);
  const ms = Date.UTC(1899, 11, 30) + (days >= 60 ? days : days + 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** "AB" → 27 (coluna zero-based). */
export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const XLSX_MAX_PARSE_ROWS = 6000;
export const XLSX_MAX_PARSE_COLS = 60;

/** Células de uma planilha (xl/worksheets/sheetN.xml) como grade de linhas × colunas. */
export function parseSheetXml(xml: string, shared: string[], dateStyles: Set<number>): Cell[][] {
  const grid: Cell[][] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let autoRow = 0;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rAttr = attr(rm[1], "r");
    const rowIdx = rAttr ? Number(rAttr) - 1 : autoRow;
    autoRow = rowIdx + 1;
    if (rowIdx >= XLSX_MAX_PARSE_ROWS) break;
    const body = rm[2] ?? "";
    const row: Cell[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let autoCol = 0;
    while ((cm = cellRe.exec(body)) !== null) {
      const ref = attr(cm[1], "r");
      const col = ref ? colIndex(ref.replace(/\d+/g, "")) : autoCol;
      autoCol = col + 1;
      if (col >= XLSX_MAX_PARSE_COLS) continue;
      const t = attr(cm[1], "t");
      const s = attr(cm[1], "s");
      const inner = cm[2] ?? "";
      const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
      let value: Cell = null;
      if (t === "inlineStr") value = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decode(x[1])).join("") || null;
      else if (v !== undefined) {
        if (t === "s") value = shared[Number(v)] ?? null;
        else if (t === "str") value = decode(v) || null;
        else if (t === "b") value = v === "1" ? "VERDADEIRO" : "FALSO";
        else if (t === "e") value = null;
        else if (t === "d") value = /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
        else {
          const n = Number(v);
          if (Number.isFinite(n)) value = s !== null && dateStyles.has(Number(s)) ? (excelSerialToIso(n) ?? n) : n;
        }
      }
      while (row.length < col) row.push(null);
      row[col] = value;
    }
    while (grid.length < rowIdx) grid.push([]);
    grid[rowIdx] = row;
  }
  return grid;
}

/** Nomes das planilhas e o arquivo de cada uma (workbook.xml + relações). */
export function parseWorkbook(workbookXml: string, relsXml: string): { name: string; path: string }[] {
  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id"), target = attr(m[0], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
  }
  const out: { name: string; path: string }[] = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name"), rid = attr(m[0], "r:id");
    const path = rid ? targets.get(rid) : null;
    if (name && path) out.push({ name, path });
  }
  return out;
}
