import { X, AlertTriangle } from "lucide-react";
import type { SelectedFault } from "./types";

interface Props {
  faults: SelectedFault[];
  onRemoveFault: (fieldId: string, fault: string) => void;
}

export default function FaultsSidebar({ faults, onRemoveFault }: Props) {
  if (faults.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Falhas Encontradas
        </h4>
        <p className="text-xs text-white/40 italic">
          Clique nos campos da prescrição que considerar incorretos para identificar as falhas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Falhas Encontradas ({faults.length})
      </h4>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {faults.map((f, i) => (
          <div
            key={`${f.fieldId}-${f.fault}-${i}`}
            className="flex items-start gap-2 bg-destructive/10 rounded-md px-3 py-2 border border-destructive/20"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/80">{f.fieldLabel}</p>
              <p className="text-xs text-destructive">{f.fault}</p>
            </div>
            <button
              onClick={() => onRemoveFault(f.fieldId, f.fault)}
              className="p-0.5 text-white/30 hover:text-white transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
