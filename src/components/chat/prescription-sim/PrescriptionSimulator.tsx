import { useState, useCallback } from "react";
import PharmacyCounter from "./PharmacyCounter";
import BasketItems from "./BasketItems";
import PrescriptionReview from "./PrescriptionReview";
import LabelReview from "./LabelReview";
import FinalizationModal from "./FinalizationModal";
import SimulationResults from "./SimulationResults";
import type { SimulationData, SimView, SelectedFault } from "./types";

interface Props {
  data: SimulationData;
}

export default function PrescriptionSimulator({ data }: Props) {
  const [view, setView] = useState<SimView>("counter");
  const [activeBasketId, setActiveBasketId] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"prescription" | "label">("prescription");
  const [completedBaskets, setCompletedBaskets] = useState<Set<number>>(new Set());
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());

  // Faults per basket
  const [allFaults, setAllFaults] = useState<Map<number, SelectedFault[]>>(new Map());
  const [currentFaults, setCurrentFaults] = useState<SelectedFault[]>([]);
  const [allNotes, setAllNotes] = useState<Map<number, string>>(new Map());
  const [currentNote, setCurrentNote] = useState("");

  const activeBasket = data.baskets.find(b => b.id === activeBasketId);
  const activeItem = activeBasket?.items.find(i =>
    activeType === "label" ? i.id + "-label" === activeItemId : i.id === activeItemId
  );

  const handleSelectBasket = (id: number) => {
    setActiveBasketId(id);
    setView("basket");
    // Load existing faults for this basket
    setCurrentFaults(allFaults.get(id) || []);
    setCurrentNote(allNotes.get(id) || "");
  };

  const handleReviewItem = (itemId: string, type: "prescription" | "label") => {
    setActiveItemId(itemId);
    setActiveType(type);
    setView("review");
  };

  const handleToggleFault = useCallback((fieldId: string, fieldLabel: string, fault: string) => {
    setCurrentFaults(prev => {
      const exists = prev.some(f => f.fieldId === fieldId && f.fault === fault);
      if (exists) {
        return prev.filter(f => !(f.fieldId === fieldId && f.fault === fault));
      }
      return [...prev, { fieldId, fieldLabel, fault }];
    });
  }, []);

  const handleRemoveFault = useCallback((fieldId: string, fault: string) => {
    setCurrentFaults(prev => prev.filter(f => !(f.fieldId === fieldId && f.fault === fault)));
  }, []);

  const handleDoneReview = () => {
    if (activeItemId) {
      setReviewedItems(prev => new Set(prev).add(activeItemId!));
    }
    // Save current faults to basket
    if (activeBasketId !== null) {
      setAllFaults(prev => new Map(prev).set(activeBasketId, [...currentFaults]));
    }
    setView("basket");
    setActiveItemId(null);
  };

  const handleFinalize = () => {
    if (activeBasketId !== null) {
      setAllFaults(prev => new Map(prev).set(activeBasketId, [...currentFaults]));
      setAllNotes(prev => new Map(prev).set(activeBasketId, currentNote));
      setCompletedBaskets(prev => new Set(prev).add(activeBasketId));
    }

    // Check if all baskets are complete
    const newCompleted = new Set(completedBaskets);
    if (activeBasketId !== null) newCompleted.add(activeBasketId);

    if (newCompleted.size >= data.baskets.length) {
      setView("results");
    } else {
      setView("counter");
    }
    setActiveBasketId(null);
    setActiveItemId(null);
  };

  // Get the label for the active item
  const activeLabelData = activeItem?.label;
  const isLabelReview = activeType === "label" && activeLabelData;

  return (
    <div className="rounded-xl border border-white/10 bg-[hsl(220,25%,9%)] p-4 md:p-6">
      {view === "counter" && (
        <PharmacyCounter
          baskets={data.baskets}
          completedBaskets={completedBaskets}
          onSelectBasket={handleSelectBasket}
        />
      )}

      {view === "basket" && activeBasket && (
        <BasketItems
          basket={activeBasket}
          onBack={() => { setView("counter"); setActiveBasketId(null); }}
          onReviewItem={handleReviewItem}
          reviewedItems={reviewedItems}
          onFinalize={() => setView("finalize")}
        />
      )}

      {view === "review" && activeItem && !isLabelReview && (
        <PrescriptionReview
          item={activeItem}
          faults={currentFaults}
          onToggleFault={handleToggleFault}
          onRemoveFault={handleRemoveFault}
          onBack={() => { handleDoneReview(); }}
          onDone={handleDoneReview}
        />
      )}

      {view === "review" && isLabelReview && activeLabelData && (
        <LabelReview
          label={activeLabelData}
          faults={currentFaults}
          onToggleFault={handleToggleFault}
          onRemoveFault={handleRemoveFault}
          onBack={() => { handleDoneReview(); }}
          onDone={handleDoneReview}
        />
      )}

      {view === "finalize" && activeBasketId !== null && (
        <FinalizationModal
          basketId={activeBasketId}
          faults={currentFaults}
          note={currentNote}
          onNoteChange={setCurrentNote}
          onFinalize={handleFinalize}
          onBack={() => setView("basket")}
        />
      )}

      {view === "results" && (
        <SimulationResults
          baskets={data.baskets}
          allFaults={allFaults}
          allNotes={allNotes}
        />
      )}
    </div>
  );
}
