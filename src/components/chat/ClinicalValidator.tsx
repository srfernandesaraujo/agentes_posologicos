import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, AlertOctagon, Loader2, ChevronRight, X } from "lucide-react";

interface ValidationItem {
  level: "green" | "yellow" | "red";
  category: string;
  label: string;
  detail: string;
  source: string;
}

interface Props {
  text: string;
  enabled: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  interacao: "Interação", dose: "Dose", renal: "Renal",
  hepatico: "Hepático", alergia: "Alergia", gestacao: "Gestação", outro: "Alerta",
};

export function ClinicalValidator({ text, enabled }: Props) {
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || text.trim().length < 15) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("clinical-validator", { body: { text } });
        if (!error && data?.items) setItems(data.items);
      } catch (e) {
        console.warn("validator error", e);
      } finally {
        setLoading(false);
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [text, enabled]);

  if (!enabled) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-4 top-24 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(174,62%,47%)]/20 border border-[hsl(174,62%,47%)]/40 text-[hsl(174,62%,67%)] hover:bg-[hsl(174,62%,47%)]/30 transition-colors shadow-lg"
        title="Abrir Validador Clínico"
      >
        <ShieldCheck className="h-5 w-5" />
        {items.some(i => i.level === "red") && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-[hsl(220,25%,5%)]" />
        )}
      </button>
    );
  }

  const counts = {
    red: items.filter(i => i.level === "red").length,
    yellow: items.filter(i => i.level === "yellow").length,
    green: items.filter(i => i.level === "green").length,
  };

  return (
    <aside className="fixed right-4 top-20 bottom-4 z-40 w-80 rounded-xl border border-white/10 bg-[hsl(220,25%,8%)]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[hsl(174,62%,67%)]" />
          <span className="text-sm font-semibold text-white">Validador Clínico</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white hover:bg-white/10" onClick={() => setCollapsed(true)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex gap-2 px-3 py-2 border-b border-white/10 text-[11px]">
        {counts.red > 0 && <span className="flex items-center gap-1 text-red-400"><AlertOctagon className="h-3 w-3" />{counts.red}</span>}
        {counts.yellow > 0 && <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="h-3 w-3" />{counts.yellow}</span>}
        {counts.green > 0 && <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="h-3 w-3" />{counts.green}</span>}
        {items.length === 0 && !loading && (
          <span className="text-white/40">Digite uma prescrição/conduta para análise automática</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map((item, i) => {
          const isOpen = expandedItem === i;
          const color = item.level === "red"
            ? "border-red-500/40 bg-red-500/[0.08]"
            : item.level === "yellow"
            ? "border-amber-500/40 bg-amber-500/[0.08]"
            : "border-emerald-500/40 bg-emerald-500/[0.08]";
          const Icon = item.level === "red" ? AlertOctagon : item.level === "yellow" ? AlertTriangle : ShieldCheck;
          const iconColor = item.level === "red" ? "text-red-400" : item.level === "yellow" ? "text-amber-400" : "text-emerald-400";
          const [sourceName, sourceUrl] = item.source.split("|");
          return (
            <div key={i} className={`rounded-lg border ${color}`}>
              <button
                onClick={() => setExpandedItem(isOpen ? null : i)}
                className="w-full p-2 flex items-start gap-2 text-left"
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-white/20 text-white/60 uppercase tracking-wide">
                      {CATEGORY_LABEL[item.category] || item.category}
                    </Badge>
                  </div>
                  <div className="text-xs text-white/90 leading-snug">{item.label}</div>
                </div>
                <ChevronRight className={`h-3 w-3 text-white/40 mt-1 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-2 pb-2 pt-0 text-[11px] text-white/70 space-y-1.5">
                  <p>{item.detail}</p>
                  <div className="text-white/40">
                    Fonte: {sourceUrl ? (
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[hsl(174,62%,67%)] hover:underline">
                        {sourceName}
                      </a>
                    ) : sourceName}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-white/10 text-[10px] text-white/30">
        ⚠️ Apoio à decisão — não substitui o julgamento clínico
      </div>
    </aside>
  );
}