import jsPDF from "jspdf";

interface Message {
  role: string;
  content: string;
  created_at: string;
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
    if (
      i + 1 < lines.length &&
      lines[i].includes("|") &&
      /^\s*\|?\s*[-:]+[-|:\s]+\s*\|?\s*$/.test(lines[i + 1])
    ) {
      const headers = lines[i].split("|").map(h => h.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
        i++;
      }
      parts.push({ type: "table", table: { headers, rows } });
    } else {
      let textBlock = "";
      while (i < lines.length) {
        if (
          i + 1 < lines.length &&
          lines[i].includes("|") &&
          /^\s*\|?\s*[-:]+[-|:\s]+\s*\|?\s*$/.test(lines[i + 1])
        ) break;
        textBlock += lines[i] + "\n";
        i++;
      }
      const trimmed = textBlock.trim();
      if (trimmed) parts.push({ type: "text", content: trimmed });
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
    .replace(/^\s*\d+\.\s/gm, (m) => m.trim() + " ");
}

export function exportConversationPdf(agentName: string, messages: Message[]) {
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
    if (y + needed > bottomLimit) newPage();
  };

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(agentName, margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Exportado em ${dateStr}`, margin, 22);
  doc.text(`${messages.length} mensagens`, pageWidth - margin, 22, { align: "right" });

  y = 34;
  doc.setDrawColor(45, 212, 191);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Messages
  messages.forEach((msg, idx) => {
    const isUser = msg.role === "user";
    const label = isUser ? "Voce" : agentName;
    const time = new Date(msg.created_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit",
    });

    const parts = parseMarkdownTables(msg.content);

    // Label + time
    ensureSpace(8);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(isUser ? 20 : 51, isUser ? 184 : 65, isUser ? 166 : 85);
    doc.text(label, margin + 2, y + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(7);
    doc.text(time, pageWidth - margin - 2, y + 3.5, { align: "right" });
    y += 6;

    // Render parts
    parts.forEach((part) => {
      if (part.type === "text") {
        renderTextBlock(doc, cleanMarkdown(part.content), margin, contentWidth, () => y, (v) => { y = v; }, bottomLimit, newPage);
      } else {
        renderTable(doc, part.table, margin, contentWidth, () => y, (v) => { y = v; }, bottomLimit, newPage);
      }
    });

    y += 3;

    if (idx < messages.length - 1) {
      ensureSpace(4);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, y, pageWidth - margin - 8, y);
      y += 4;
    }
  });

  addFooter();
  doc.save(`${agentName.replace(/\s+/g, "_")}_conversa_${Date.now()}.pdf`);
}

function renderTextBlock(
  doc: jsPDF, text: string, margin: number, contentWidth: number,
  getY: () => number, setY: (v: number) => void, bottomLimit: number, newPage: () => void
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  const allLines = doc.splitTextToSize(text, contentWidth - 6);
  const lineHeight = 3.8;
  let y = getY();
  for (const line of allLines) {
    if (y + lineHeight > bottomLimit) { newPage(); y = margin; }
    doc.text(line, margin + 3, y);
    y += lineHeight;
  }
  setY(y + 1);
}

function renderTable(
  doc: jsPDF, table: { headers: string[]; rows: string[][] },
  margin: number, contentWidth: number,
  getY: () => number, setY: (v: number) => void, bottomLimit: number, newPage: () => void
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
  const colWidths = calculateColumnWidths(doc, headers, rows, tableWidth, fontSize);

  let y = getY();

  const drawHeader = () => {
    const hh = calcRowH(doc, headers, colWidths, cellPadding, lineHeight);
    doc.setFillColor(30, 41, 59);
    doc.rect(tableMargin, y, tableWidth, hh, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    let x = tableMargin;
    for (let c = 0; c < colCount; c++) {
      const cl = doc.splitTextToSize(headers[c] || "", colWidths[c] - cellPadding * 2);
      doc.text(cl, x + cellPadding, y + cellPadding + 2.5);
      x += colWidths[c];
    }
    y += hh;
    doc.setFont("helvetica", "normal");
  };

  const headerHeight = calcRowH(doc, headers, colWidths, cellPadding, lineHeight);
  if (y + headerHeight > bottomLimit) { newPage(); y = margin; }
  drawHeader();

  rows.forEach((row, ri) => {
    const rh = calcRowH(doc, row, colWidths, cellPadding, lineHeight);
    if (y + rh > bottomLimit) { newPage(); y = margin; drawHeader(); }

    doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 250 : 255, ri % 2 === 0 ? 252 : 255);
    doc.rect(tableMargin, y, tableWidth, rh, "F");
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.15);
    doc.line(tableMargin, y + rh, tableMargin + tableWidth, y + rh);

    doc.setTextColor(30, 41, 59);
    let rx = tableMargin;
    for (let c = 0; c < colCount; c++) {
      const ct = (c < row.length ? row[c] : "") || "";
      const cl = doc.splitTextToSize(ct, colWidths[c] - cellPadding * 2);
      doc.text(cl, rx + cellPadding, y + cellPadding + 2.5);
      if (c > 0) doc.line(rx, y, rx, y + rh);
      rx += colWidths[c];
    }
    y += rh;
  });

  setY(y + 3);
}

function calculateColumnWidths(doc: jsPDF, headers: string[], rows: string[][], tableWidth: number, fontSize: number): number[] {
  doc.setFontSize(fontSize);
  const n = headers.length;
  const maxW = headers.map(h => doc.getTextWidth(h || ""));
  rows.forEach(row => {
    for (let c = 0; c < n; c++) {
      const w = doc.getTextWidth((c < row.length ? row[c] : "") || "");
      if (w > (maxW[c] || 0)) maxW[c] = w;
    }
  });
  const total = maxW.reduce((a, b) => a + b, 0) || 1;
  const minW = tableWidth / n * 0.4;
  let widths = maxW.map(w => Math.max(minW, (w / total) * tableWidth));
  const sum = widths.reduce((a, b) => a + b, 0);
  return widths.map(w => (w / sum) * tableWidth);
}

function calcRowH(doc: jsPDF, cells: string[], colWidths: number[], cellPadding: number, lineHeight: number): number {
  let maxL = 1;
  for (let c = 0; c < colWidths.length; c++) {
    const t = (c < cells.length ? cells[c] : "") || "";
    const l = doc.splitTextToSize(t, colWidths[c] - cellPadding * 2);
    if (l.length > maxL) maxL = l.length;
  }
  return maxL * lineHeight + cellPadding * 2 + 1;
}
