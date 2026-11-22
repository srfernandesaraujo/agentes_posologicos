/** Quando o modelo escreve o cabeçalho e a linha de separadores na MESMA linha (| A | B | | --- | --- | linhas...),
 * separa em cabeçalho, separador e linhas, para o reconhecedor de tabelas funcionar. */
function splitInlineTable(line: string): string[] | null {
  if (!line.includes("|")) return null;
  const parts = line.split("|").map((c) => c.trim());
  const isSep = (c: string) => /^:?-{2,}:?$/.test(c);
  const sepIdx = parts.findIndex(isSep);
  if (sepIdx <= 0) return null;
  const header = parts.slice(0, sepIdx).filter(Boolean);
  if (header.length < 2) return null;
  let k = sepIdx;
  while (k < parts.length && (parts[k] === "" || isSep(parts[k]))) k++;
  const cells = parts.slice(k).filter(Boolean);
  const out = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (let c = 0; c < cells.length; c += header.length) {
    const chunk = cells.slice(c, c + header.length);
    while (chunk.length < header.length) chunk.push("");
    out.push(`| ${chunk.join(" | ")} |`);
  }
  return out;
}

// Sanitize malformed markdown tables — handles concatenated rows, inline separators, missing spacing
export function sanitizeMarkdownTables(content: string): string {
  const lines = content.split("\n").flatMap((l) => splitInlineTable(l) ?? [l]);
  const out: string[] = [];

  const splitCells = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 && !/^:?-{2,}:?$/.test(c));

  const isTableHeader = (line: string) => line.includes("|") && splitCells(line).length >= 2;
  const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim());

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1] ?? "";

    // Detect table start (header + separator)
    if (isTableHeader(current) && isTableSeparator(next)) {
      const headerCells = splitCells(current);
      const colCount = Math.max(2, headerCells.length);

      // Ensure blank line before table
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");

      out.push(`| ${headerCells.slice(0, colCount).join(" | ")} |`);
      out.push(`| ${Array(colCount).fill("---").join(" | ")} |`);

      i += 2;

      // Consume data rows while lines still look like table-ish content
      for (; i < lines.length; i++) {
        const rowLine = lines[i];
        const trimmed = rowLine.trim();

        if (!trimmed) break;
        if (!trimmed.includes("|")) {
          i -= 1;
          break;
        }

        // Handle concatenated rows with double pipes: ... | ... || ... | ...
        const normalized = rowLine.replace(/\|\s*\|+/g, "||");
        const rowSegments = normalized.includes("||")
          ? normalized
              .split("||")
              .map((s) => s.trim())
              .filter(Boolean)
          : [normalized.trim()];

        let wroteAny = false;

        for (const segment of rowSegments) {
          const cells = splitCells(segment);
          if (cells.length === 0) continue;

          // If still too many cells, chunk by header column count
          for (let c = 0; c < cells.length; c += colCount) {
            const chunk = cells.slice(c, c + colCount);
            while (chunk.length < colCount) chunk.push("");
            if (chunk.some((v) => v !== "")) {
              out.push(`| ${chunk.join(" | ")} |`);
              wroteAny = true;
            }
          }
        }

        if (!wroteAny) {
          i -= 1;
          break;
        }
      }

      // Ensure blank line after table
      if (out[out.length - 1]?.trim() !== "") out.push("");
      continue;
    }

    out.push(current);
  }

  return out.join("\n");
}
