import jsPDF from "jspdf";

interface Message {
  role: string;
  content: string;
  created_at: string;
}

export function exportConversationPdf(
  agentName: string,
  messages: Message[]
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

  // Header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(agentName, margin, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Exportado em ${dateStr}`, margin, 22);
  doc.text(`${messages.length} mensagens`, pageWidth - margin, 22, { align: "right" });

  y = 36;

  // Accent line
  doc.setDrawColor(45, 212, 191); // teal
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Messages
  messages.forEach((msg, idx) => {
    const isUser = msg.role === "user";
    const label = isUser ? "👤 Você" : `🤖 ${agentName}`;
    const time = new Date(msg.created_at).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Clean markdown for PDF
    const cleanContent = msg.content
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, "").trim())
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^\s*[-*]\s/gm, "• ")
      .replace(/^\s*\d+\.\s/gm, (m) => m.trim() + " ");

    const lines = doc.splitTextToSize(cleanContent, contentWidth - 10);
    const blockHeight = lines.length * 4.5 + 16;

    checkPage(blockHeight);

    // Message bubble background
    if (!isUser) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin - 2, y - 2, contentWidth + 4, blockHeight, 3, 3, "F");
    } else {
      doc.setFillColor(240, 253, 250); // teal-50
      doc.roundedRect(margin - 2, y - 2, contentWidth + 4, blockHeight, 3, 3, "F");
    }

    // Label & time
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    if (isUser) {
      doc.setTextColor(20, 184, 166);
    } else {
      doc.setTextColor(51, 65, 85);
    }
    doc.text(label, margin + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.setFontSize(7);
    doc.text(time, pageWidth - margin - 2, y + 4, { align: "right" });

    // Content
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont("helvetica", "normal");
    doc.text(lines, margin + 3, y + 12);

    y += blockHeight + 4;

    // Separator between messages
    if (idx < messages.length - 1) {
      checkPage(4);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      doc.line(margin + 10, y, pageWidth - margin - 10, y);
      y += 4;
    }
  });

  addFooter();
  doc.save(`${agentName.replace(/\s+/g, "_")}_conversa_${Date.now()}.pdf`);
}
