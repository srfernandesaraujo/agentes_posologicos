import { useState } from "react";
import { FileDown, Copy, Check } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface MessageActionsProps {
  content: string;
  agentName: string;
  messageRef: React.RefObject<HTMLDivElement>;
}

export function MessageActions({ content, agentName, messageRef }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCopy = async () => {
    const plain = content
      .replace(/```chart\s*\n[\s\S]*?```/g, "[Gráfico]")
      .replace(/\*\*/g, "")
      .replace(/^#+\s/gm, "");
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copiado!");
  };

  const handleExportPDF = async () => {
    if (!messageRef.current) {
      toast.error("Não foi possível capturar o conteúdo.");
      return;
    }
    setExporting(true);
    try {
      // Clone the message element to style it for PDF capture
      const original = messageRef.current;

      // Create a wrapper for html2canvas with white background for better PDF
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.style.width = "800px";
      wrapper.style.padding = "0";
      wrapper.style.background = "#0f1219";
      document.body.appendChild(wrapper);

      // Build PDF header
      const header = document.createElement("div");
      header.style.cssText = "background:#0f1219;padding:24px 32px 16px;border-bottom:3px solid #e65138;";
      header.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:#fff;font-size:20px;font-weight:bold;margin-bottom:6px;">RELATÓRIO</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-family:Helvetica,Arial,sans-serif;color:rgba(255,255,255,0.6);font-size:12px;">${agentName}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;color:rgba(255,255,255,0.6);font-size:12px;">${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;color:rgba(255,255,255,0.35);font-size:9px;margin-top:4px;">Gerado por FarmaChat AI</div>
      `;
      wrapper.appendChild(header);

      // Clone content
      const contentClone = original.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = "padding:24px 32px;background:#0f1219;font-family:Helvetica,Arial,sans-serif;";

      // Fix any SVG rendering issues in charts by ensuring they are visible
      const svgs = contentClone.querySelectorAll("svg");
      svgs.forEach((svg) => {
        svg.setAttribute("width", svg.getBoundingClientRect().width.toString() || "600");
        svg.setAttribute("height", svg.getBoundingClientRect().height.toString() || "320");
      });

      wrapper.appendChild(contentClone);

      // Footer
      const footer = document.createElement("div");
      footer.style.cssText = "background:#0f1219;padding:12px 32px;border-top:2px solid #e65138;";
      footer.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:rgba(255,255,255,0.35);font-size:9px;">Este relatório foi gerado automaticamente pela plataforma FarmaChat AI.</div>
      `;
      wrapper.appendChild(footer);

      // Wait a tick for rendering
      await new Promise((r) => setTimeout(r, 200));

      // Capture with html2canvas
      const canvas = await html2canvas(wrapper, {
        backgroundColor: "#0f1219",
        scale: 2,
        useCORS: true,
        logging: false,
        width: 800,
        windowWidth: 800,
      });

      document.body.removeChild(wrapper);

      // Generate PDF from canvas
      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageW = 210;
      const pageH = 297;
      const margin = 10;
      const contentWidth = pageW - margin * 2;
      const contentHeight = (imgH * contentWidth) / imgW;

      // If content fits in one page
      if (contentHeight <= pageH - margin * 2) {
        doc.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);
      } else {
        // Multi-page: slice the canvas
        const pxPerPage = (imgW * (pageH - margin * 2)) / contentWidth;
        let yOffset = 0;
        let pageNum = 0;

        while (yOffset < imgH) {
          if (pageNum > 0) doc.addPage();

          const sliceH = Math.min(pxPerPage, imgH - yOffset);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgW;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -yOffset);

          const sliceImg = sliceCanvas.toDataURL("image/png");
          const sliceMMH = (sliceH * contentWidth) / imgW;
          doc.addImage(sliceImg, "PNG", margin, margin, contentWidth, sliceMMH);

          yOffset += pxPerPage;
          pageNum++;
        }
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
