import { useState, useRef } from "react";
import { FileDown, Copy, Check, MoreHorizontal } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface MessageActionsProps {
  content: string;
  agentName: string;
  messageRef: React.RefObject<HTMLDivElement>;
}

function stripChartBlocks(text: string): string {
  return text.replace(/```chart\s*\n[\s\S]*?```/g, "[Gráfico gerado — ver versão digital]");
}

function markdownToPlainLines(md: string): { text: string; style: "h1" | "h2" | "h3" | "bold" | "bullet" | "normal" }[] {
  const lines: { text: string; style: "h1" | "h2" | "h3" | "bold" | "bullet" | "normal" }[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      lines.push({ text: line.replace(/^### /, "").replace(/\*\*/g, ""), style: "h3" });
    } else if (/^## /.test(line)) {
      lines.push({ text: line.replace(/^## /, "").replace(/\*\*/g, ""), style: "h2" });
    } else if (/^# /.test(line)) {
      lines.push({ text: line.replace(/^# /, "").replace(/\*\*/g, ""), style: "h1" });
    } else if (/^[-*•]\s/.test(line)) {
      lines.push({ text: line.replace(/^[-*•]\s/, "").replace(/\*\*/g, ""), style: "bullet" });
    } else if (/^\d+\.\s/.test(line)) {
      lines.push({ text: line.replace(/\*\*/g, ""), style: "bullet" });
    } else if (/^\*\*.*\*\*$/.test(line.trim())) {
      lines.push({ text: line.replace(/\*\*/g, ""), style: "bold" });
    } else {
      lines.push({ text: line.replace(/\*\*/g, ""), style: "normal" });
    }
  }
  return lines;
}

export function MessageActions({ content, agentName, messageRef }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCopy = async () => {
    const plain = stripChartBlocks(content).replace(/\*\*/g, "").replace(/^#+\s/gm, "");
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const marginL = 20;
      const marginR = 20;
      const marginTop = 35;
      const marginBottom = 25;
      const contentW = pageW - marginL - marginR;
      let y = 0;

      const primaryColor: [number, number, number] = [230, 81, 56]; // hsl(14,90%,58%) approx
      const darkBg: [number, number, number] = [18, 22, 30];
      const white: [number, number, number] = [255, 255, 255];
      const gray: [number, number, number] = [180, 185, 195];
      const lightGray: [number, number, number] = [120, 128, 140];

      // --- Header band ---
      const drawHeader = () => {
        doc.setFillColor(...darkBg);
        doc.rect(0, 0, pageW, 28, "F");
        // accent line
        doc.setFillColor(...primaryColor);
        doc.rect(0, 28, pageW, 1.2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...white);
        doc.text("RELATÓRIO", marginL, 12);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...gray);
        doc.text(agentName, marginL, 19);

        const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        doc.text(dateStr, pageW - marginR, 19, { align: "right" });

        doc.setFontSize(7);
        doc.setTextColor(...lightGray);
        doc.text("Gerado por FarmaChat AI", marginL, 24.5);
      };

      // --- Footer ---
      const drawFooter = (pageNum: number) => {
        doc.setFillColor(...darkBg);
        doc.rect(0, pageH - 15, pageW, 15, "F");
        doc.setFillColor(...primaryColor);
        doc.rect(0, pageH - 15, pageW, 0.6, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...lightGray);
        doc.text("Este relatório foi gerado automaticamente pela plataforma FarmaChat AI.", marginL, pageH - 7);
        doc.text(`Página ${pageNum}`, pageW - marginR, pageH - 7, { align: "right" });
      };

      let pageNum = 1;
      drawHeader();
      drawFooter(pageNum);
      y = marginTop;

      const addPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader();
        drawFooter(pageNum);
        y = marginTop;
      };

      const checkSpace = (needed: number) => {
        if (y + needed > pageH - marginBottom) {
          addPage();
        }
      };

      const cleaned = stripChartBlocks(content);
      const parsed = markdownToPlainLines(cleaned);

      for (const line of parsed) {
        if (line.text.trim() === "" && line.style === "normal") {
          y += 3;
          continue;
        }

        let fontSize = 10;
        let fontStyle: "normal" | "bold" = "normal";
        let color: [number, number, number] = [50, 55, 65];
        let extraSpaceBefore = 0;
        let extraSpaceAfter = 0;
        let indent = 0;
        let drawAccent = false;

        switch (line.style) {
          case "h1":
            fontSize = 16;
            fontStyle = "bold";
            color = [30, 33, 40];
            extraSpaceBefore = 6;
            extraSpaceAfter = 3;
            drawAccent = true;
            break;
          case "h2":
            fontSize = 13;
            fontStyle = "bold";
            color = primaryColor;
            extraSpaceBefore = 5;
            extraSpaceAfter = 2;
            break;
          case "h3":
            fontSize = 11;
            fontStyle = "bold";
            color = [50, 55, 65];
            extraSpaceBefore = 4;
            extraSpaceAfter = 1.5;
            break;
          case "bold":
            fontSize = 10;
            fontStyle = "bold";
            color = [40, 44, 52];
            extraSpaceBefore = 2;
            break;
          case "bullet":
            fontSize = 10;
            indent = 5;
            extraSpaceBefore = 1;
            break;
          default:
            fontSize = 10;
        }

        y += extraSpaceBefore;
        doc.setFont("helvetica", fontStyle);
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);

        const maxW = contentW - indent;
        const splitLines = doc.splitTextToSize(line.text, maxW) as string[];
        const lineH = fontSize * 0.45;

        checkSpace(splitLines.length * lineH + extraSpaceAfter);

        if (drawAccent) {
          doc.setFillColor(...primaryColor);
          doc.rect(marginL, y - 1, 3, splitLines.length * lineH + 2, "F");
        }

        if (line.style === "bullet") {
          doc.setFillColor(...primaryColor);
          doc.circle(marginL + indent - 2.5, y + lineH * 0.35, 0.8, "F");
        }

        for (const sl of splitLines) {
          doc.text(sl, marginL + indent + (drawAccent ? 5 : 0), y + lineH * 0.8);
          y += lineH;
        }
        y += extraSpaceAfter;
      }

      doc.save(`relatorio-${agentName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="absolute -top-8 right-2 flex items-center gap-1 rounded-lg border border-white/10 bg-[hsl(220,25%,12%)] px-1 py-0.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Copiar texto"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={handleExportPDF}
        disabled={exporting}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
        title="Exportar como PDF"
      >
        {exporting ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
