import jsPDF from "jspdf";
import { parseMarkdownTables, renderTextBlock, renderTable } from "./exportConversationPdf";

interface MeetingPdfData {
  title: string;
  summary: string;
  meetingDate: string;
  meetLink?: string | null;
}

// Ata de reunião com layout de carta profissional (letterhead), pensada para ser
// enviada a todos os participantes — diferente de exportConversationPdf (transcrição
// de chat simples), aqui reaproveitamos só o renderizador de markdown/tabela.
export function exportMeetingMinutesPdf({ title, summary, meetingDate, meetLink }: MeetingPdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;
  let pageNum = 1;

  const meetingDateStr = meetingDate
    ? new Date(meetingDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const generatedStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const addFooter = () => {
    doc.setDrawColor(222, 226, 233);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 128, 140);
    doc.text("Documento gerado automaticamente por Agentes Posológicos", margin, pageHeight - 8);
    doc.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  };

  let y = margin;
  const newPage = () => {
    addFooter();
    doc.addPage();
    pageNum++;
    y = margin;
  };

  // ---- Letterhead ----
  const titleFontSize = 19;
  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  const titleLines: string[] = doc.splitTextToSize(title || "Reunião", contentWidth);
  const titleLineHeight = 8;
  const bandTop = 12;
  const bandHeight = bandTop + titleLines.length * titleLineHeight + 12;

  doc.setFillColor(13, 20, 35);
  doc.rect(0, 0, pageWidth, bandHeight, "F");
  doc.setFillColor(45, 212, 191);
  doc.rect(0, bandHeight, pageWidth * 0.62, 1.4, "F");
  doc.setFillColor(230, 81, 56);
  doc.rect(pageWidth * 0.62, bandHeight, pageWidth * 0.38, 1.4, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(94, 234, 212);
  doc.text("ATA DE REUNIÃO", margin, 9);

  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  let ty = bandTop + 7;
  titleLines.forEach((line) => {
    doc.text(line, margin, ty);
    ty += titleLineHeight;
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 187, 199);
  if (meetingDateStr) doc.text(meetingDateStr, margin, ty + 3);
  doc.text("Agentes Posológicos", pageWidth - margin, ty + 3, { align: "right" });

  y = bandHeight + 12;

  // Meta strip — transparência de que o conteúdo é gerado por IA + link da reunião
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 128, 140);
  doc.text(`Ata gerada por IA a partir da transcrição da reunião · exportado em ${generatedStr}`, margin, y);
  y += 5.5;
  if (meetLink) {
    doc.setFont("helvetica", "normal");
    doc.text(meetLink, margin, y);
    y += 5.5;
  }
  y += 3;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // ---- Body ----
  const parts = parseMarkdownTables(summary || "Nenhuma ata disponível.");
  parts.forEach((part) => {
    if (part.type === "text") {
      renderTextBlock(doc, part.content, margin, contentWidth, () => y, (v) => { y = v; }, bottomLimit, newPage);
    } else {
      renderTable(doc, part.table, margin, contentWidth, () => y, (v) => { y = v; }, bottomLimit, newPage);
    }
  });

  addFooter();

  const safeTitle = (title || "ata")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  doc.save(`Ata_${safeTitle}_${Date.now()}.pdf`);
}
