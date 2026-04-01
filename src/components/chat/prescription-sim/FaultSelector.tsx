import { Plus, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PrescriptionField } from "./types";

interface Props {
  fieldId: string;
  fieldLabel: string;
  field: PrescriptionField;
  selectedFaults: string[];
  onToggleFault: (fieldId: string, fieldLabel: string, fault: string) => void;
  children: React.ReactNode;
}

export default function FaultSelector({ fieldId, fieldLabel, field, selectedFaults, onToggleFault, children }: Props) {
  const hasFaults = selectedFaults.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={`cursor-pointer rounded border-2 border-dashed px-3 py-2 transition-all hover:border-accent hover:bg-accent/5 ${
            hasFaults
              ? "border-destructive/60 bg-destructive/10"
              : "border-white/20 bg-transparent"
          }`}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 bg-[hsl(220,25%,12%)] border-white/15" side="right" align="start">
        <div className="p-3 border-b border-white/10">
          <p className="text-sm font-semibold text-white">{fieldLabel}</p>
          <p className="text-xs text-white/50 mt-0.5">Valor: {field.value}</p>
        </div>
        <div className="p-1 max-h-60 overflow-y-auto">
          {field.faults.map((fault) => {
            const isSelected = selectedFaults.includes(fault);
            return (
              <button
                key={fault}
                onClick={() => onToggleFault(fieldId, fieldLabel, fault)}
                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center justify-between gap-2 transition-colors ${
                  isSelected
                    ? "bg-destructive/20 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex-1">{fault}</span>
                {isSelected ? (
                  <Check className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 text-white/30 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
