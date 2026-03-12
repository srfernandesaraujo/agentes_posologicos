import jsPDF from "jspdf";

interface FlowStepData {
  step_index: number;
  agent_name: string;
  chatHistory: Array<{ role: string; content: string }>;
  output: string;
}

export function exportFlowPdf(
  flowName: string,
  steps: FlowStepData[]
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNum = 1;

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.text("Gerado por Agentes Posológicos", margin, pageHeight - 10);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
  };

  const checkPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      addFooter();
      doc.addPage();
      pageNum++;
      y = margin;
    }
  };

  const cleanMarkdown = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*]\s/gm, "• ")
      .replace(/[├└│]──\s*/g, "  → ")
      .replace(/[│]\s*/g, "  ");

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`Fluxo: ${flowName}`, margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Exportado em ${dateStr}`, margin, 22);
  doc.text(`${steps.length} etapas`, pageWidth - margin, 22, { align: "right" });

  // Pipeline summary
  doc.setFontSize(8);
  doc.setTextColor(45, 212, 191);
  const pipelineText = steps.map((s, i) => `${i + 1}. ${s.agent_name}`).join("  →  ");
  doc.text(pipelineText, margin, 29, { maxWidth: contentWidth });

  y = 40;

  // Accent line
  doc.setDrawColor(45, 212, 191);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Steps
  steps.forEach((step) => {
    // Step header
    checkPage(20);
    doc.setFillColor(45, 212, 191);
    doc.roundedRect(margin, y, 50, 7, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`Etapa ${step.step_index + 1}`, margin + 3, y + 5);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(step.agent_name, margin + 54, y + 5);
    y += 12;

    // Chat messages
    const messages = step.chatHistory.length > 0 ? step.chatHistory : [{ role: "assistant", content: step.output }];

    messages.forEach((msg) => {
      const isUser = msg.role === "user";
      const label = isUser ? "👤 Você" : `🤖 ${step.agent_name}`;
      const cleaned = cleanMarkdown(msg.content);
      const lines = doc.splitTextToSize(cleaned, contentWidth - 10);
      const blockHeight = lines.length * 4.2 + 14;

      checkPage(blockHeight);

      if (isUser) {
        doc.setFillColor(240, 253, 250);
      } else {
        doc.setFillColor(248, 250, 252);
      }
      doc.roundedRect(margin - 1, y - 1, contentWidth + 2, blockHeight, 2, 2, "F");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isUser ? 20 : 51, isUser ? 184 : 65, isUser ? 166 : 85);
      doc.text(label, margin + 2, y + 4);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(lines, margin + 2, y + 10);

      y += blockHeight + 3;
    });

    y += 5;

    // Separator
    checkPage(4);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, y, pageWidth - margin - 10, y);
    y += 8;
  });

  addFooter();
  doc.save(`Fluxo_${flowName.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
}
