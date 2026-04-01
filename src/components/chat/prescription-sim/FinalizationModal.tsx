import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SelectedFault } from "./types";

interface Props {
  basketId: number;
  faults: SelectedFault[];
  note: string;
  onNoteChange: (note: string) => void;
  onFinalize: () => void;
  onBack: () => void;
}

export default function FinalizationModal({ basketId, faults, note, onNoteChange, onFinalize, onBack }: Props) {
  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">Finalizar Validação — Cestinha {basketId}</h3>
        <p className="text-xs text-white/50">Revise as falhas encontradas e adicione observações</p>
      </div>

      {/* Faults summary */}
      <div className="rounded-lg border border-white/15 bg-white/5 p-4 space-y-2">
        <h4 className="text-sm font-semibold text-white">
          Falhas identificadas ({faults.length})
        </h4>
        {faults.length === 0 ? (
          <p className="text-xs text-white/40 italic">Nenhuma falha identificada</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {faults.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs bg-destructive/10 rounded px-2 py-1.5">
                <span className="text-white/60 font-medium shrink-0">{f.fieldLabel}:</span>
                <span className="text-destructive">{f.fault}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Observações (opcional)</label>
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Adicione notas ou justificativas para a validação..."
          className="bg-white/5 border-white/15 text-white placeholder:text-white/30 min-h-[80px]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button onClick={onFinalize} className="flex-1 bg-accent hover:bg-accent/90 text-white">
          <CheckCircle className="h-4 w-4 mr-1" />
          Finalizar Validação
        </Button>
      </div>
    </div>
  );
}
