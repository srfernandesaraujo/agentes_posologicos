// Leitura de arquivos enviados à Reunião Viva: planilhas (CSV, XLSX), documentos de texto (TXT, MD), Word (DOCX) e PDF.
// Usa bibliotecas que só existem no ambiente Deno das funções; as partes puras ficam em fileText.ts e sheetAnalysis.ts (testadas).
import { unzipSync, strFromU8 } from "https://esm.sh/fflate@0.8.2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { docxXmlToText, parseCsv, tidyPdfText } from "./fileText.ts";
import { parseDateStyles, parseSharedStrings, parseSheetXml, parseWorkbook } from "./xlsxXml.ts";
import { toTable, type Table } from "./sheetAnalysis.ts";

export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const DOC_MAX_CHARS = 80_000;

export type ParsedUpload =
  | { kind: "sheet"; sheetName: string; sheetCount: number; table: Table }
  | { kind: "doc"; text: string; pages: number | null; truncated: boolean };

export const SUPPORTED_EXT = ["csv", "tsv", "txt", "md", "xlsx", "xlsm", "docx", "pdf"];

/** UTF-8; se vier com caracteres de substituição (arquivo do Excel em Windows-1252), tenta de novo em Windows-1252. */
function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(bytes);
}

const clipDoc = (text: string) => ({ text: text.slice(0, DOC_MAX_CHARS), truncated: text.length > DOC_MAX_CHARS });

export async function parseUpload(fileName: string, bytes: Uint8Array): Promise<ParsedUpload> {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "xls" || ext === "ods") throw new Error(`Arquivos .${ext} não são lidos. Abra no Excel ou no LibreOffice e salve como .xlsx ou .csv.`);
  if (!SUPPORTED_EXT.includes(ext)) throw new Error(`Formato .${ext || "?"} não suportado. Use CSV, XLSX, TXT, MD, DOCX ou PDF.`);
  if (!bytes.length) throw new Error("O arquivo está vazio.");
  if (bytes.length > UPLOAD_MAX_BYTES) throw new Error("O arquivo passa de 4 MB. Envie uma versão menor.");

  if (ext === "csv" || ext === "tsv") {
    const table = toTable(parseCsv(decodeText(bytes), ext === "tsv" ? "\t" : undefined));
    if (!table.rows.length) throw new Error("Não encontrei linhas de dados nesse arquivo.");
    return { kind: "sheet", sheetName: "CSV", sheetCount: 1, table };
  }

  if (ext === "xlsx" || ext === "xlsm") {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes, { filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name === "xl/sharedStrings.xml" || f.name === "xl/styles.xml" || f.name.startsWith("xl/worksheets/") && f.name.endsWith(".xml") && !f.name.slice(14).includes("/") });
    } catch {
      throw new Error("Não consegui ler essa planilha. Confira se o arquivo não está corrompido ou protegido por senha.");
    }
    const text = (name: string) => (files[name] ? strFromU8(files[name]) : "");
    if (!files["xl/workbook.xml"]) throw new Error("Não consegui ler essa planilha. Salve como .xlsx ou .csv e tente de novo.");
    const sheets = parseWorkbook(text("xl/workbook.xml"), text("xl/_rels/workbook.xml.rels"));
    const shared = parseSharedStrings(text("xl/sharedStrings.xml"));
    const dateStyles = parseDateStyles(text("xl/styles.xml"));
    // A planilha com mais células preenchidas é a principal; as outras só entram na contagem.
    let best: { name: string; table: Table } | null = null;
    for (const sh of sheets) {
      if (!files[sh.path]) continue;
      const table = toTable(parseSheetXml(text(sh.path), shared, dateStyles));
      if (!best || table.rows.length * table.headers.length > best.table.rows.length * best.table.headers.length) best = { name: sh.name, table };
    }
    if (!best || !best.table.rows.length) throw new Error("Não encontrei linhas de dados nessa planilha.");
    return { kind: "sheet", sheetName: best.name, sheetCount: sheets.length, table: best.table };
  }

  if (ext === "docx") {
    const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
    const xml = files["word/document.xml"];
    if (!xml) throw new Error("Não consegui ler esse arquivo do Word.");
    const { text, truncated } = clipDoc(docxXmlToText(strFromU8(xml)));
    if (!text.trim()) throw new Error("O documento não tem texto.");
    return { kind: "doc", text, pages: null, truncated };
  }

  if (ext === "pdf") {
    let totalPages = 0;
    let text: unknown = "";
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      ({ totalPages, text } = await extractText(pdf, { mergePages: true }));
    } catch {
      throw new Error("Não consegui ler esse PDF. Confira se o arquivo não está corrompido ou protegido por senha.");
    }
    const { text: clipped, truncated } = clipDoc(tidyPdfText(String(text)));
    if (clipped.trim().length < 20) throw new Error("Esse PDF não tem texto selecionável (talvez seja um escaneado). Envie uma versão com texto.");
    return { kind: "doc", text: clipped, pages: totalPages, truncated };
  }

  const { text, truncated } = clipDoc(decodeText(bytes).replace(/\r/g, ""));
  if (!text.trim()) throw new Error("O documento não tem texto.");
  return { kind: "doc", text, pages: null, truncated };
}
