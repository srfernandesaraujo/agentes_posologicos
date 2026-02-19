import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Smartphone, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  agentId: string;
  agentName?: string;
  onBack: () => void;
}

export function WhatsAppConnect({ agentId, agentName, onBack }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [waLink, setWaLink] = useState("");
  const { t } = useLanguage();

  const handleGenerate = () => {
    if (!phoneNumber.trim()) return;
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá! Gostaria de conversar com o agente "${agentName || "IA"}". [ID: ${agentId}]`
    );
    const link = `https://wa.me/${cleanPhone}?text=${message}`;
    setWaLink(link);
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> {t("whatsapp.back")}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(142,70%,45%)]/20">
          <Smartphone className="h-6 w-6 text-[hsl(142,70%,45%)]" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{t("whatsapp.title")}</h3>
          <p className="text-sm text-white/50">{t("whatsapp.desc")}</p>
        </div>
      </div>

      {!waLink ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/70">
              {t("whatsapp.phoneLabel")}
            </label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={t("whatsapp.phonePlaceholder")}
              className="border-white/10 bg-white/[0.05] text-white font-mono text-lg"
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!phoneNumber.trim()}
            className="w-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white border-0 gap-2"
          >
            <Smartphone className="h-4 w-4" />
            {t("whatsapp.generate")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="rounded-2xl bg-white p-6">
            <QRCodeSVG value={waLink} size={220} level="H" />
          </div>
          <p className="text-sm text-white/50 text-center">{t("whatsapp.scanDesc")}</p>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <ExternalLink className="h-4 w-4" />
              {t("whatsapp.openLink")}
            </Button>
          </a>
          <Button variant="ghost" onClick={() => setWaLink("")} className="text-white/40 hover:text-white hover:bg-white/10">
            {t("whatsapp.back")}
          </Button>
        </div>
      )}
    </div>
  );
}
