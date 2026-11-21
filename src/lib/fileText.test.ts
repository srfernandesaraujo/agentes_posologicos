import { describe, expect, it } from "vitest";
import { detectDelimiter, docxXmlToText, parseCsv, pickDocExcerpts, tidyPdfText } from "../../supabase/functions/_shared/fileText";

describe("CSV", () => {
  it("detecta o separador", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter('"a,b";c\n"1,2";3')).toBe(";");
  });
  it("lê aspas, aspas duplas, quebra de linha dentro de campo e BOM", () => {
    const rows = parseCsv('﻿nome;obs\n"Silva, A";"disse ""oi"""\n"Costa";"linha 1\nlinha 2"\n');
    expect(rows).toEqual([["nome", "obs"], ["Silva, A", 'disse "oi"'], ["Costa", "linha 1\nlinha 2"]]);
  });
  it("campos vazios viram nulo e CRLF funciona", () => {
    expect(parseCsv("a,b,c\r\n1,,3\r\n")).toEqual([["a", "b", "c"], ["1", null, "3"]]);
  });
  it("não cria linha fantasma no fim", () => {
    expect(parseCsv("a,b\n1,2\n")).toHaveLength(2);
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
  });
});

describe("Word", () => {
  it("parágrafos viram linhas, tabelas ficam com separador e entidades são decodificadas", () => {
    const xml = "<w:body><w:p><w:r><w:t>Título &amp; resumo</w:t></w:r></w:p><w:p><w:r><w:t>Segunda</w:t></w:r><w:br/><w:r><w:t>linha</w:t></w:r></w:p>" +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body>";
    expect(docxXmlToText(xml)).toBe("Título & resumo\nSegunda\nlinha\nA | B |");
  });
});

describe("PDF", () => {
  it("limpa espaços repetidos e linhas em branco demais", () => {
    expect(tidyPdfText("a   b\r\n\n\n\nc")).toBe("a b\n\nc");
  });
});

describe("trechos de documento", () => {
  const paras = Array.from({ length: 60 }, (_, i) => `Parágrafo ${i} sobre assunto genérico número ${i} com algum texto de enchimento para ocupar espaço.`);
  paras[40] = "A carga horária prática das disciplinas clínicas deve ser cadastrada com subturmas e laboratório.";
  paras[55] = "O estágio exige seguro, documentação dos estudantes e articulação com os serviços de saúde.";
  const doc = paras.join("\n");
  it("documento curto vai inteiro", () => {
    expect(pickDocExcerpts("texto curto", "qualquer coisa")).toEqual({ text: "texto curto", partial: false });
  });
  it("documento longo traz o começo e os parágrafos mais parecidos com o pedido, na ordem", () => {
    const r = pickDocExcerpts(doc, "como fica a carga horária prática e as subturmas?", 2500);
    expect(r.partial).toBe(true);
    expect(r.text.startsWith("Parágrafo 0 ")).toBe(true);
    expect(r.text).toContain("carga horária prática das disciplinas clínicas");
    expect(r.text.length).toBeLessThanOrEqual(2600);
    const r2 = pickDocExcerpts(doc, "seguro dos estudantes no estágio", 2500);
    expect(r2.text).toContain("O estágio exige seguro");
    expect(r2.text.indexOf("Parágrafo 0")).toBeLessThan(r2.text.indexOf("O estágio exige seguro"));
  });
  it("sem palavras em comum, devolve só o começo", () => {
    const r = pickDocExcerpts(doc, "zzzzz yyyyy", 2500);
    expect(r.partial).toBe(true);
    expect(r.text).not.toContain("trechos do documento mais parecidos");
  });
});
