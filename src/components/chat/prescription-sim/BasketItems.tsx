import { ArrowLeft, FileText, Tag, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Basket } from "./types";

interface Props {
  basket: Basket;
  onBack: () => void;
  onReviewItem: (itemId: string, type: "prescription" | "label") => void;
  reviewedItems: Set<string>;
  onFinalize: () => void;
}

export default function BasketItems({ basket, onBack, onReviewItem, reviewedItems, onFinalize }: Props) {
  const allReviewed = basket.items.every(item => {
    const keys = [item.id];
    if (item.label) keys.push(item.id + "-label");
    return keys.every(k => reviewedItems.has(k));
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={!allReviewed}
          className="bg-accent hover:bg-accent/90 text-white"
        >
          Finalizar Cestinha
        </Button>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">Cestinha {basket.id} — {basket.patient}</h3>
        <p className="text-xs text-white/50">Prescritor: {basket.prescriber.name} ({basket.prescriber.crm})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {basket.items.map((item) => {
          const prescReviewed = reviewedItems.has(item.id);
          const labelReviewed = !item.label || reviewedItems.has(item.id + "-label");

          return (
            <div key={item.id} className="space-y-3">
              {/* Prescription card */}
              <div className={`rounded-lg border p-4 space-y-3 transition-all ${
                prescReviewed ? "border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/5" : "border-white/15 bg-white/5"
              }`}>
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">📋 Prescrição</p>
                    <p className="text-xs text-white/60 mt-1">{item.medication}</p>
                    <p className="text-xs text-white/40">{item.dose} — Qtd: {item.qty}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={prescReviewed ? "outline" : "default"}
                  className="w-full"
                  onClick={() => onReviewItem(item.id, "prescription")}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {prescReviewed ? "Revisada ✓" : "Revisar"}
                </Button>
              </div>

              {/* Label card */}
              {item.label && (
                <div className={`rounded-lg border p-4 space-y-3 transition-all ${
                  labelReviewed ? "border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/5" : "border-white/15 bg-white/5"
                }`}>
                  <div className="flex items-start gap-3">
                    <Tag className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">🏷️ Etiqueta</p>
                      <p className="text-xs text-white/60 mt-1">{item.label.medication}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={labelReviewed ? "outline" : "default"}
                    className="w-full"
                    onClick={() => onReviewItem(item.id + "-label", "label")}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    {labelReviewed ? "Revisada ✓" : "Revisar"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
