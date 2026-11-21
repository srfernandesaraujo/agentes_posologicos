// Partes puras da leitura de arquivos da Reunião Viva (CSV, XML do Word, escolha de trechos de documento). Sem bibliotecas e sem rede:
// testado em src/lib/fileText.test.ts. A leitura de XLSX, DOCX e PDF (que usa bibliotecas) fica em fileParsers.ts.
import { normName } from "./squadChatCore.ts";
import type { Cell } from "./sheetAnalysis.ts";

/** Separador mais provável (vírgula, ponto e vírgula, tab) pelas primeiras linhas, ignorando o que está entre aspas. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  let best = ",", bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => {
      let inQ = false, n = 0;
      for (const ch of l) { if (ch === '"') inQ = !inQ; else if (ch === d && !inQ) n++; }
      return n;
    });
    if (!counts.length || counts[0] === 0) continue;
    const consistent = counts.every((c) => c === counts[0]);
    const score = counts[0] * (consistent ? 10 : 1);
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

/** CSV com aspas e quebras de linha dentro de campo. Números ficam como texto: quem analisa decide o formato (1.234,56 ou 1,234.56). */
export function parseCsv(text: string, delimiter?: string): Cell[][] {
  const src = text.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(src);
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let inQ = false;
  const pushField = () => { row.push(field === "" ? null : field); field = ""; };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) pushField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      pushField(); rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { pushField(); rows.push(row); }
  return rows;
}

const decodeEntities = (s: string): string =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

/** Texto do word/document.xml de um .docx: parágrafos viram linhas e células de tabela ficam separadas por " | ". */
export function docxXmlToText(xml: string): string {
  return decodeEntities(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>\s*<\/w:tc>/g, " | ")
      .replace(/<\/w:tc>/g, " | ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/[ \t]+\n/g, "\n").replace(/ \| \n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function tidyPdfText(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const STOP = new Set(["para", "como", "qual", "quais", "esse", "essa", "este", "esta", "isso", "voce", "voces", "sobre", "onde", "porque", "quando", "pode", "poderia", "fazer", "deste", "desta", "muito", "mais", "menos", "ainda", "entre", "arquivo", "documento", "anexo", "texto", "leia", "veja", "resuma", "resumo"]);
const kw = (s: string): string[] => normName(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

/**
 * Trechos do documento para o agente. Documento curto vai inteiro; longo, o começo mais os parágrafos que mais se parecem com o pedido
 * (por palavras em comum), na ordem original, dentro do limite de caracteres.
 */
export function pickDocExcerpts(text: string, request: string, maxChars = 12000): { text: string; partial: boolean } {
  if (text.length <= maxChars) return { text, partial: false };
  const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const words = new Set(kw(request));
  const head = text.slice(0, 1500);
  let budget = maxChars - head.length - 60;
  const scored = paras.map((p, i) => ({ p, i, s: kw(p).filter((w) => words.has(w)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  const chosen: { p: string; i: number }[] = [];
  for (const x of scored) {
    if (budget <= 0) break;
    if (head.includes(x.p.slice(0, 80))) continue;
    const piece = x.p.slice(0, 1200);
    chosen.push({ p: piece, i: x.i });
    budget -= piece.length + 2;
  }
  chosen.sort((a, b) => a.i - b.i);
  const body = chosen.length ? `\n\n[... trechos do documento mais parecidos com o pedido ...]\n${chosen.map((c) => c.p).join("\n\n")}` : "";
  return { text: head + body, partial: true };
}
