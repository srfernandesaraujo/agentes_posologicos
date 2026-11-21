import { describe, expect, it } from "vitest";
import { colIndex, excelSerialToIso, isDateFormat, parseDateStyles, parseSharedStrings, parseSheetXml, parseWorkbook } from "../../supabase/functions/_shared/xlsxXml";

describe("série de data do Excel", () => {
  it("converte datas conhecidas", () => {
    expect(excelSerialToIso(45658)).toBe("2025-01-01");
    expect(excelSerialToIso(45672.75)).toBe("2025-01-15");
    expect(excelSerialToIso(1)).toBe("1900-01-01");
    expect(excelSerialToIso(61)).toBe("1900-03-01");
    expect(excelSerialToIso(36526)).toBe("2000-01-01");
  });
  it("recusa valores impossíveis", () => {
    expect(excelSerialToIso(0)).toBeNull();
    expect(excelSerialToIso(-5)).toBeNull();
    expect(excelSerialToIso(NaN)).toBeNull();
  });
  it("letras de coluna viram índice", () => {
    expect([colIndex("A"), colIndex("Z"), colIndex("AA"), colIndex("AB")]).toEqual([0, 25, 26, 27]);
  });
});

describe("formatos de data", () => {
  it("separa formatos de data dos de número", () => {
    expect(isDateFormat("dd/mm/yyyy")).toBe(true);
    expect(isDateFormat("mmm-yy")).toBe(true);
    expect(isDateFormat("h:mm:ss")).toBe(true);
    expect(isDateFormat('0.00 "dias"')).toBe(false);
    expect(isDateFormat("General")).toBe(false);
    expect(isDateFormat("#,##0.00")).toBe(false);
    expect(isDateFormat("[Red]0.0")).toBe(false);
  });
  it("acha os estilos de data em styles.xml (embutidos e personalizados)", () => {
    const xml = '<styleSheet><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>' +
      '<cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>';
    expect([...parseDateStyles(xml)]).toEqual([1, 2]);
  });
});

describe("textos compartilhados e planilha", () => {
  it("junta trechos de texto formatado e decodifica entidades", () => {
    const xml = '<sst><si><t>Loja &amp; Cia</t></si><si><r><t>Ana</t></r><r><t xml:space="preserve"> Souza</t></r></si><si><t/></si></sst>';
    expect(parseSharedStrings(xml)).toEqual(["Loja & Cia", "Ana Souza", ""]);
  });
  it("lê células de vários tipos, pula colunas vazias e converte datas por estilo", () => {
    const sheet = '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>texto</t></is></c></row>' +
      '<row r="3"><c r="A3" s="1"><v>45658</v></c><c r="B3"><v>12.5</v></c><c r="C3" t="b"><v>1</v></c><c r="D3" t="str"><v>fórmula</v></c><c r="E3" t="e"><v>#DIV/0!</v></c><c r="F3" t="d"><v>2025-03-02T00:00:00.000Z</v></c></row>' +
      '</sheetData></worksheet>';
    const grid = parseSheetXml(sheet, ["Mês"], new Set([1]));
    expect(grid[0]).toEqual(["Mês", null, "texto"]);
    expect(grid[1]).toEqual([]);
    expect(grid[2]).toEqual(["2025-01-01", 12.5, "VERDADEIRO", "fórmula", null, "2025-03-02"]);
  });
  it("nomes das planilhas e caminhos, relativos e absolutos", () => {
    const wb = '<workbook><sheets><sheet name="Vendas &amp; Custos" sheetId="1" r:id="rId1"/><sheet name="Resumo" sheetId="2" r:id="rId2"/></sheets></workbook>';
    const rels = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>';
    expect(parseWorkbook(wb, rels)).toEqual([{ name: "Vendas & Custos", path: "xl/worksheets/sheet1.xml" }, { name: "Resumo", path: "xl/worksheets/sheet2.xml" }]);
  });
});
