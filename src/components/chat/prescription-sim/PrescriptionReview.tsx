import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FaultSelector from "./FaultSelector";
import FaultsSidebar from "./FaultsSidebar";
import type { PrescriptionItem, SelectedFault } from "./types";

const FIELD_LABELS: Record<string, string> = {
  medicationName: "Nome do Medicamento",
  dose: "Dose",
  prescriber: "Prescritor",
  directions: "Posologia",
  quantity: "Quantidade",
  date: "Data",
  route: "Via de Administração",
  frequency: "Frequência",
  pharmacy: "Farmácia",
  repeats: "Repetições",
};

interface Props {
  item: PrescriptionItem;
  faults: SelectedFault[];
  onToggleFault: (fieldId: string, fieldLabel: string, fault: string) => void;
  onRemoveFault: (fieldId: string, fault: string) => void;
  onBack: () => void;
  onDone: () => void;
}

export default function PrescriptionReview({ item, faults, onToggleFault, onRemoveFault, onBack, onDone }: Props) {
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
        {/* Prescription document */}
        <div className="rounded-xl border border-white/15 bg-[hsl(40,30%,96%)] p-5 space-y-4 shadow-lg">
          {/* Header */}
          <div className="text-center border-b border-gray-300 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Prescrição Médica</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{item.medication}</p>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            {Object.entries(item.fields).map(([fieldId, field]) => {
              const label = FIELD_LABELS[fieldId] || fieldId;
              return (
                <div key={fieldId}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">{label}</p>
                  <FaultSelector
                    fieldId={fieldId}
                    fieldLabel={label}
                    field={field}
                    selectedFaults={selectedByField(fieldId)}
                    onToggleFault={onToggleFault}
                  >
                    <p className={`text-sm ${
                      selectedByField(fieldId).length > 0
                        ? "text-red-700 font-medium"
                        : "text-gray-700"
                    }`}>
                      {field.value}
                    </p>
                  </FaultSelector>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 text-center">
            <p className="text-[10px] text-gray-400">
              Clique nos campos acima para identificar possíveis falhas
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-xs text-accent font-medium">📝 Instruções</p>
            <p className="text-xs text-white/60 mt-1">
              Revise cada campo da prescrição. Clique nos campos que considerar incorretos e selecione o tipo de falha identificada.
            </p>
          </div>
          <FaultsSidebar faults={faults} onRemoveFault={onRemoveFault} />
        </div>
      </div>
    </div>
  );
}
