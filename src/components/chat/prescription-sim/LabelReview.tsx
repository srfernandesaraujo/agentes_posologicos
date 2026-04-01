import { ArrowLeft, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FaultSelector from "./FaultSelector";
import FaultsSidebar from "./FaultsSidebar";
import type { PrescriptionLabel, SelectedFault } from "./types";

const LABEL_FIELD_LABELS: Record<string, string> = {
  medication: "Medicamento",
  dose: "Dose",
  directions: "Posologia",
  dispensedBy: "Dispensado por",
  date: "Data",
  warnings: "Avisos",
  patientName: "Nome do Paciente",
  expiryDate: "Validade",
};

interface Props {
  label: PrescriptionLabel;
  faults: SelectedFault[];
  onToggleFault: (fieldId: string, fieldLabel: string, fault: string) => void;
  onRemoveFault: (fieldId: string, fault: string) => void;
  onBack: () => void;
  onDone: () => void;
}

export default function LabelReview({ label, faults, onToggleFault, onRemoveFault, onBack, onDone }: Props) {
  const selectedByField = (fieldId: string) =>
    faults.filter(f => f.fieldId === fieldId).map(f => f.fault);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <Button size="sm" onClick={onDone} className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
          <CheckCircle className="h-3 w-3 mr-1" /> Concluir Revisão
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Label document */}
        <div className="rounded-xl border-2 border-gray-300 bg-white p-5 space-y-3 shadow-lg max-w-md mx-auto w-full">
          {/* Pharmacy header */}
          <div className="text-center border-b-2 border-gray-800 pb-2">
            <p className="text-sm font-bold text-gray-900 uppercase">Etiqueta de Dispensação</p>
          </div>

          {/* Label fields */}
          <div className="space-y-2">
            {Object.entries(label.fields).map(([fieldId, field]) => {
              const fieldLabel = LABEL_FIELD_LABELS[fieldId] || fieldId;
              return (
                <div key={fieldId}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">{fieldLabel}</p>
                  <FaultSelector
                    fieldId={`label-${fieldId}`}
                    fieldLabel={fieldLabel}
                    field={field}
                    selectedFaults={selectedByField(`label-${fieldId}`)}
                    onToggleFault={onToggleFault}
                  >
                    <p className={`text-sm ${
                      selectedByField(`label-${fieldId}`).length > 0
                        ? "text-red-700 font-medium"
                        : "text-gray-800"
                    }`}>
                      {field.value}
                    </p>
                  </FaultSelector>
                </div>
              );
            })}
          </div>

          {/* Warnings */}
          {label.warnings && label.warnings.length > 0 && (
            <div className="border-t border-gray-200 pt-2">
              <div className="flex items-center gap-1 text-red-600 text-xs font-bold mb-1">
                <AlertTriangle className="h-3 w-3" /> AVISOS
              </div>
              {label.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-red-600">{w}</p>
              ))}
            </div>
          )}

          <div className="border-t border-gray-200 pt-2 text-center">
            <p className="text-[10px] text-gray-400">
              Clique nos campos para identificar falhas na etiqueta
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs text-warning font-medium">🏷️ Revisão de Etiqueta</p>
            <p className="text-xs text-white/60 mt-1">
              Verifique se os dados da etiqueta estão corretos e correspondem à prescrição.
            </p>
          </div>
          <FaultsSidebar faults={faults} onRemoveFault={onRemoveFault} />
        </div>
      </div>
    </div>
  );
}
