import { describe, expect, it } from "vitest";
import { sanitizeMarkdownTables } from "./markdownTables";

describe("sanitizeMarkdownTables", () => {
  it("separa cabeçalho, separador e linhas escritos na mesma linha", () => {
    const raw = "Estrutura\n| Tempo | Atividade | Objetivo | | :--- | :--- | :--- | | 0-10 min | Abertura | Contextualizar | 10-30 min | Caso 1 | Decidir |";
    const out = sanitizeMarkdownTables(raw).split("\n").filter((l) => l.startsWith("|"));
    expect(out[0]).toBe("| Tempo | Atividade | Objetivo |");
    expect(out[1]).toBe("| --- | --- | --- |");
    expect(out).toHaveLength(4);
    expect(out[2]).toBe("| 0-10 min | Abertura | Contextualizar |");
    expect(out[3]).toBe("| 10-30 min | Caso 1 | Decidir |");
  });

  it("não altera uma tabela já correta", () => {
    const ok = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(sanitizeMarkdownTables(ok).trim()).toBe(ok);
  });

  it("não mexe em texto comum com barras", () => {
    expect(sanitizeMarkdownTables("use a ou b | c")).toBe("use a ou b | c");
  });
});
