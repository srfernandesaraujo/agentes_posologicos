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
      const original = messageRef.current;

      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.style.width = "800px";
      wrapper.style.padding = "0";
      wrapper.style.background = "#ffffff";
      document.body.appendChild(wrapper);

      // Header
      const header = document.createElement("div");
      header.style.cssText = "background:#ffffff;padding:28px 36px 18px;border-bottom:3px solid #e65138;";
      header.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:#111;font-size:22px;font-weight:bold;margin-bottom:6px;">RELATÓRIO</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:12px;">${agentName}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:12px;">${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:9px;margin-top:4px;">Gerado por FarmaChat AI</div>
      `;
      wrapper.appendChild(header);

      // Clone content and restyle for white background
      const contentClone = original.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = "padding:24px 36px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111;";

      // Restyle all text elements to black
      contentClone.querySelectorAll("*").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = "#111";
        // Remove dark backgrounds
        if (htmlEl.style.background) htmlEl.style.background = "transparent";
        if (htmlEl.style.backgroundColor) htmlEl.style.backgroundColor = "transparent";
      });

      // Restyle tables for PDF: solid black borders, white bg
      contentClone.querySelectorAll("table").forEach((table) => {
        table.style.cssText = "width:100%;border-collapse:collapse;border:2px solid #111;margin:12px 0;";
      });
      contentClone.querySelectorAll("th").forEach((th) => {
        th.style.cssText = "border:2px solid #111;padding:8px 12px;text-align:left;font-weight:bold;font-size:13px;color:#111;background:#f0f0f0;";
      });
      contentClone.querySelectorAll("td").forEach((td) => {
        td.style.cssText = "border:2px solid #111;padding:8px 12px;font-size:13px;color:#111;background:#ffffff;";
      });
      contentClone.querySelectorAll("thead").forEach((thead) => {
        thead.style.cssText = "background:#f0f0f0;";
      });

      // Restyle headings
      contentClone.querySelectorAll("h1,h2,h3,h4").forEach((h) => {
        (h as HTMLElement).style.color = "#111";
        (h as HTMLElement).style.borderColor = "#ddd";
      });

      // Restyle blockquotes
      contentClone.querySelectorAll("blockquote").forEach((bq) => {
        (bq as HTMLElement).style.borderLeftColor = "#e65138";
        (bq as HTMLElement).style.color = "#555";
      });

      // Fix SVG charts - set explicit dimensions and make text black
      const svgs = contentClone.querySelectorAll("svg");
      svgs.forEach((svg) => {
        const origSvg = original.querySelector(`svg`);
        if (origSvg) {
          const rect = origSvg.getBoundingClientRect();
          svg.setAttribute("width", String(rect.width || 600));
          svg.setAttribute("height", String(rect.height || 320));
        }
      });

      // Make chart container backgrounds white
      contentClone.querySelectorAll("[class*='chart'], [class*='Chart']").forEach((el) => {
        (el as HTMLElement).style.background = "#ffffff";
      });

      wrapper.appendChild(contentClone);

      // Footer
      const footer = document.createElement("div");
      footer.style.cssText = "background:#ffffff;padding:14px 36px;border-top:2px solid #e65138;";
      footer.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:9px;">Este relatório foi gerado automaticamente pela plataforma FarmaChat AI.</div>
      `;
      wrapper.appendChild(footer);

      await new Promise((r) => setTimeout(r, 300));

      const canvas = await html2canvas(wrapper, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width: 800,
        windowWidth: 800,
      });

      document.body.removeChild(wrapper);

      const imgData = canvas.toDataURL("image/png");
      const imgW = canvas.width;
      const imgH = canvas.height;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const margin = 10;
      const contentWidth = pageW - margin * 2;
      const contentHeight = (imgH * contentWidth) / imgW;

      if (contentHeight <= pageH - margin * 2) {
        doc.addImage(imgData, "PNG", margin, margin, contentWidth, contentHeight);
      } else {
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
