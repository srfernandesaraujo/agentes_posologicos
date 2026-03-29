import { useState } from "react";
import { FileDown, Copy, Check, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { useContentCertificate } from "@/hooks/useContentCertificate";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MessageActionsProps {
  content: string;
  agentName: string;
  messageRef: React.RefObject<HTMLDivElement>;
  sessionId?: string;
  messageId?: string;
}

export function MessageActions({ content, agentName, messageRef, sessionId, messageId }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const { generateCertificate, generating, certificate } = useContentCertificate();

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

  const handleCertify = async () => {
    const cert = await generateCertificate({ content, agentName, sessionId, messageId });
    if (cert) setShowCert(true);
  };

  const handleCopyCode = async () => {
    if (certificate) {
      await navigator.clipboard.writeText(certificate.verification_code);
      toast.success("Código copiado!");
    }
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

      const header = document.createElement("div");
      header.style.cssText = "background:#ffffff;padding:28px 36px 18px;border-bottom:3px solid #e65138;";
      header.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:#111;font-size:22px;font-weight:bold;margin-bottom:6px;">RELATÓRIO</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:12px;">${agentName}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;color:#555;font-size:12px;">${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
        <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:9px;margin-top:4px;">Gerado por Agentes Posológicos</div>
      `;
      wrapper.appendChild(header);

      const contentClone = original.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = "padding:24px 36px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111;";
      contentClone.querySelectorAll("*").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = "#111";
        if (htmlEl.style.background) htmlEl.style.background = "transparent";
        if (htmlEl.style.backgroundColor) htmlEl.style.backgroundColor = "transparent";
      });
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
      contentClone.querySelectorAll("h1,h2,h3,h4").forEach((h) => {
        (h as HTMLElement).style.color = "#111";
        (h as HTMLElement).style.borderColor = "#ddd";
      });
      contentClone.querySelectorAll("blockquote").forEach((bq) => {
        (bq as HTMLElement).style.borderLeftColor = "#e65138";
        (bq as HTMLElement).style.color = "#555";
      });
      const svgs = contentClone.querySelectorAll("svg");
      svgs.forEach((svg) => {
        const origSvg = original.querySelector(`svg`);
        if (origSvg) {
          const rect = origSvg.getBoundingClientRect();
          svg.setAttribute("width", String(rect.width || 600));
          svg.setAttribute("height", String(rect.height || 320));
        }
      });
      contentClone.querySelectorAll("[class*='chart'], [class*='Chart']").forEach((el) => {
        (el as HTMLElement).style.background = "#ffffff";
      });
      wrapper.appendChild(contentClone);

      const footer = document.createElement("div");
      footer.style.cssText = "background:#ffffff;padding:14px 36px;border-top:2px solid #e65138;";
      footer.innerHTML = `
        <div style="font-family:Helvetica,Arial,sans-serif;color:#999;font-size:9px;">Este relatório foi gerado automaticamente pela plataforma Agentes Posológicos.</div>
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
    <>
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
        <button
          onClick={handleCertify}
          disabled={generating}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 hover:text-emerald-400 hover:bg-white/10 transition-colors disabled:opacity-40"
          title="Certificar autenticidade"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Certificate Dialog */}
      <Dialog open={showCert} onOpenChange={setShowCert}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
              Certificado de Autenticidade
            </DialogTitle>
          </DialogHeader>
          {certificate && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-white/50 mb-1">Código de verificação</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-emerald-300">
                  {certificate.verification_code}
                </p>
              </div>

              <div className="text-xs text-white/50 space-y-1">
                <div className="flex justify-between">
                  <span>Agente</span>
                  <span className="text-white/70">{agentName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data</span>
                  <span className="text-white/70">
                    {new Date(certificate.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>
                  <span className="block mb-0.5">Hash SHA-256</span>
                  <code className="text-[9px] text-white/30 break-all">{certificate.content_hash}</code>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCopyCode} variant="outline" className="flex-1 border-white/30 text-white bg-white/10 hover:bg-white/20">
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copiar código
                </Button>
                <Button
                  onClick={() => window.open(`/verificar?code=${certificate.verification_code}`, "_blank")}
                  variant="outline"
                  className="flex-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Verificar
                </Button>
              </div>

              <p className="text-[10px] text-white/30 text-center">
                Qualquer pessoa pode verificar este certificado em{" "}
                <span className="text-emerald-400/50">/verificar</span>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
