export interface PrescriptionField {
  value: string;
  faults: string[];
}

export interface PrescriptionLabel {
  medication: string;
  dose: string;
  directions: string;
  dispensedBy: string;
  date: string;
  warnings: string[];
  fields: Record<string, PrescriptionField>;
  expectedFaults: string[];
}

export interface PrescriptionItem {
  id: string;
  type: "prescription" | "label";
  medication: string;
  dose: string;
  qty: number;
  repeats: number;
  directions: string;
  fields: Record<string, PrescriptionField>;
  expectedFaults: string[];
  label?: PrescriptionLabel;
}

export interface Basket {
  id: number;
  patient: string;
  prescriber: {
    name: string;
    crm: string;
    address: string;
  };
  items: PrescriptionItem[];
}

export interface SimulationData {
  baskets: Basket[];
}

export type SimView = "counter" | "basket" | "review" | "finalize" | "results";

export interface SelectedFault {
  fieldId: string;
  fieldLabel: string;
  fault: string;
}
