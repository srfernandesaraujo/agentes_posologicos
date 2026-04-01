import jsPDF from "jspdf";

interface FlowStepData {
  step_index: number;
  agent_name: string;
  chatHistory: Array<{ role: string; content: string }>;
  output: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTables(text: string): Array<{ type: "text"; content: string } | { type: "table"; table: TableData }> {
  const parts: Array<{ type: "text"; content: string } | { type: "table"; table: TableData }> = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Detect table: line with pipes, followed by separator line (|---|---|)
    if (
      i + 1 < lines.length &&
      lines[i].includes("|") &&
      /^\s*\|?\s*[-:]+[-|:\s]+\s*\|?\s*$/.test(lines[i + 1])
    ) {
      const headerLine = lines[i];
      const headers = headerLine.split("|").map(h => h.trim()).filter(Boolean);
      i += 2; // skip header + separator

      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
        const cells = lines[i].split("|").map(c => c.trim()).filter(Boolean);
        rows.push(cells);
        i++;
      }
      parts.push({ type: "table", table: { headers, rows } });
    } else {
      // Collect text lines until next table or end
      let textBlock = "";
      while (i < lines.length) {
        if (
          i + 1 < lines.length &&
          lines[i].includes("|") &&
          /^\s*\|?\s*[-:]+[-|:\s]+\s*\|?\s*$/.test(lines[i + 1])
        ) {
          break;
        }
        textBlock += lines[i] + "\n";
        i++;
      }
      const trimmed = textBlock.trim();
      if (trimmed) {
        parts.push({ type: "text", content: trimmed });
      }
    }
  }

  return parts;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s/gm, "• ")
    .replace(/[├└│]──\s*/g, "  → ")
    .replace(/[│]\s*/g, "  ");
}

export function exportFlowPdf(flowName: string, steps: FlowStepData[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNum = 1;
  const bottomLimit = pageHeight - 18;

  const addFooter = () => {
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    doc.text("Gerado por Agentes Posológicos", margin, pageHeight - 8);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
  };

  const newPage = () => {
    addFooter();
    doc.addPage();
    pageNum++;
    y = margin;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      newPage();
    }
  };

  // ──── Header ────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(`Fluxo: ${flowName}`, contentWidth - 40);
  doc.text(titleLines, margin, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Exportado em ${dateStr}`, margin, 22);
  doc.text(`${steps.length} etapas`, pageWidth - margin, 22, { align: "right" });

  // Pipeline summary
  doc.setFontSize(7);
  doc.setTextColor(45, 212, 191);
  const pipelineText = steps.map((s, i) => `${i + 1}. ${s.agent_name}`).join("  →  ");
  const pipelineLines = doc.splitTextToSize(pipelineText, contentWidth);
  doc.text(pipelineLines, margin, 27);

  y = 34;

  // Accent line
  doc.setDrawColor(45, 212, 191);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ──── Steps ────
  steps.forEach((step) => {
    // Step header badge
    ensureSpace(14);
    doc.setFillColor(45, 212, 191);
    doc.roundedRect(margin, y, 40, 6, 1.5, 1.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`Etapa ${step.step_index + 1}`, margin + 2, y + 4.2);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(step.agent_name, margin + 43, y + 4.2);
    y += 10;

    // Messages
    const messages = step.chatHistory.length > 0
      ? step.chatHistory
      : [{ role: "assistant", content: step.output }];

    messages.forEach((msg) => {
      const isUser = msg.role === "user";
      const label = isUser ? "Voce" : step.agent_name;

      // Parse content into text blocks and tables
      const parts = parseMarkdownTables(msg.content);

      // Label
      ensureSpace(8);
      if (isUser) {
        doc.setFillColor(240, 253, 250);
      } else {
        doc.setFillColor(245, 247, 250);
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isUser ? 20 : 51, isUser ? 184 : 65, isUser ? 166 : 85);
      doc.text(label, margin + 2, y + 3.5);
      y += 6;

      // Render each part
      parts.forEach((part) => {
        if (part.type === "text") {
          renderTextBlock(doc, cleanMarkdown(part.content), margin, contentWidth, () => {
            ensureSpace(0);
            return y;
          }, (newY: number) => { y = newY; }, bottomLimit, newPage);
        } else {
          renderTable(doc, part.table, margin, contentWidth, () => {
            ensureSpace(0);
            return y;
          }, (newY: number) => { y = newY; }, bottomLimit, newPage);
        }
      });

      y += 3;
    });

    // Separator between steps
    ensureSpace(6);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin + 8, y, pageWidth - margin - 8, y);
    y += 6;
  });

  addFooter();
  doc.save(`Fluxo_${flowName.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}

function renderTextBlock(
  doc: jsPDF,
  text: string,
  margin: number,
  contentWidth: number,
  getY: () => number,
  setY: (v: number) => void,
  bottomLimit: number,
  newPage: () => void
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);

  const allLines = doc.splitTextToSize(text, contentWidth - 6);
  const lineHeight = 3.8;

  let y = getY();
  for (const line of allLines) {
    if (y + lineHeight > bottomLimit) {
      newPage();
      y = margin;
    }
    doc.text(line, margin + 3, y);
    y += lineHeight;
  }
  setY(y + 1);
}

function renderTable(
  doc: jsPDF,
  table: TableData,
  margin: number,
  contentWidth: number,
  getY: () => number,
  setY: (v: number) => void,
  bottomLimit: number,
  newPage: () => void
) {
  const { headers, rows } = table;
  const colCount = headers.length;
  if (colCount === 0) return;

  const tableMargin = margin + 2;
  const tableWidth = contentWidth - 4;
  const cellPadding = 1.5;
  const fontSize = 7;
  const lineHeight = 3.4;

  doc.setFontSize(fontSize);

  // Calculate column widths based on content
  const colWidths = calculateColumnWidths(doc, headers, rows, tableWidth, fontSize);

  let y = getY();

  // Render header
  const headerRowHeight = calculateRowHeight(doc, headers, colWidths, cellPadding, lineHeight);
  if (y + headerRowHeight > bottomLimit) {
    newPage();
    y = margin;
  }

  // Header background
  doc.setFillColor(30, 41, 59);
  doc.rect(tableMargin, y, tableWidth, headerRowHeight, "F");

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  let xPos = tableMargin;
  for (let c = 0; c < colCount; c++) {
    const cellLines = doc.splitTextToSize(headers[c] || "", colWidths[c] - cellPadding * 2);
    doc.text(cellLines, xPos + cellPadding, y + cellPadding + 2.5);
    xPos += colWidths[c];
  }
  y += headerRowHeight;

  // Render rows
  doc.setFont("helvetica", "normal");
  rows.forEach((row, rowIdx) => {
    const rowHeight = calculateRowHeight(doc, row, colWidths, cellPadding, lineHeight);

    if (y + rowHeight > bottomLimit) {
      newPage();
      y = margin;
      // Re-draw header on new page
      doc.setFillColor(30, 41, 59);
      doc.rect(tableMargin, y, tableWidth, headerRowHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      let hx = tableMargin;
      for (let c = 0; c < colCount; c++) {
        const cellLines = doc.splitTextToSize(headers[c] || "", colWidths[c] - cellPadding * 2);
        doc.text(cellLines, hx + cellPadding, y + cellPadding + 2.5);
        hx += colWidths[c];
      }
      y += headerRowHeight;
      doc.setFont("helvetica", "normal");
    }

    // Alternating row bg
    if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(tableMargin, y, tableWidth, rowHeight, "F");

    // Row borders
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.15);
    doc.line(tableMargin, y + rowHeight, tableMargin + tableWidth, y + rowHeight);

    // Cell text
    doc.setTextColor(30, 41, 59);
    let rx = tableMargin;
    for (let c = 0; c < colCount; c++) {
      const cellText = (c < row.length ? row[c] : "") || "";
      const cellLines = doc.splitTextToSize(cellText, colWidths[c] - cellPadding * 2);
      doc.text(cellLines, rx + cellPadding, y + cellPadding + 2.5);
      // Vertical divider
      if (c > 0) {
        doc.line(rx, y, rx, y + rowHeight);
      }
      rx += colWidths[c];
    }

    y += rowHeight;
  });

  // Table border
  doc.setDrawColor(200, 205, 210);
  doc.setLineWidth(0.2);
  const totalHeaderAndRows = headerRowHeight + rows.reduce((sum, row) => sum + calculateRowHeight(doc, row, colWidths, cellPadding, lineHeight), 0);
  // We already drew inline, just add bottom space
  setY(y + 3);
}

function calculateColumnWidths(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  tableWidth: number,
  fontSize: number
): number[] {
  doc.setFontSize(fontSize);
  const colCount = headers.length;

  // Measure max text width per column
  const maxWidths = headers.map((h) => doc.getTextWidth(h || ""));
  rows.forEach((row) => {
    for (let c = 0; c < colCount; c++) {
      const w = doc.getTextWidth((c < row.length ? row[c] : "") || "");
      if (w > (maxWidths[c] || 0)) {
        maxWidths[c] = w;
      }
    }
  });

  // Distribute proportionally
  const total = maxWidths.reduce((a, b) => a + b, 0) || 1;
  const minColWidth = tableWidth / colCount * 0.4;
  let widths = maxWidths.map((w) => Math.max(minColWidth, (w / total) * tableWidth));

  // Normalize to fit exactly
  const widthSum = widths.reduce((a, b) => a + b, 0);
  widths = widths.map((w) => (w / widthSum) * tableWidth);

  return widths;
}

function calculateRowHeight(
  doc: jsPDF,
  cells: string[],
  colWidths: number[],
  cellPadding: number,
  lineHeight: number
): number {
  let maxLines = 1;
  for (let c = 0; c < colWidths.length; c++) {
    const cellText = (c < cells.length ? cells[c] : "") || "";
    const lines = doc.splitTextToSize(cellText, colWidths[c] - cellPadding * 2);
    if (lines.length > maxLines) maxLines = lines.length;
  }
  return maxLines * lineHeight + cellPadding * 2 + 1;
}
