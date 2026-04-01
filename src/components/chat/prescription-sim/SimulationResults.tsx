import { Trophy, CheckCircle, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Basket, SelectedFault } from "./types";

interface Props {
  baskets: Basket[];
  allFaults: Map<number, SelectedFault[]>;
  allNotes: Map<number, string>;
}

export default function SimulationResults({ baskets, allFaults, allNotes }: Props) {
  // Calculate scores
  let totalExpected = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let totalMissed = 0;

  const basketResults = baskets.map(basket => {
    const userFaults = allFaults.get(basket.id) || [];
    const userFaultStrings = new Set(userFaults.map(f => f.fault.toLowerCase()));

    const expectedFaults: string[] = [];
    basket.items.forEach(item => {
      expectedFaults.push(...item.expectedFaults);
      if (item.label) {
        expectedFaults.push(...item.label.expectedFaults);
      }
    });

    const expectedSet = new Set(expectedFaults.map(f => f.toLowerCase()));

    const correct = [...userFaultStrings].filter(f => expectedSet.has(f));
    const incorrect = [...userFaultStrings].filter(f => !expectedSet.has(f));
    const missed = [...expectedSet].filter(f => !userFaultStrings.has(f));

    totalExpected += expectedSet.size;
    totalCorrect += correct.length;
    totalIncorrect += incorrect.length;
    totalMissed += missed.length;

    return {
      basket,
      correct,
      incorrect,
      missed: missed.map(m => expectedFaults.find(ef => ef.toLowerCase() === m) || m),
      note: allNotes.get(basket.id) || "",
    };
  });

  const score = totalExpected > 0
    ? Math.round((totalCorrect / (totalExpected + totalIncorrect)) * 100)
    : 100;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Score header */}
      <div className="text-center space-y-3">
        <Trophy className={`h-12 w-12 mx-auto ${score >= 70 ? "text-[hsl(var(--success))]" : score >= 40 ? "text-warning" : "text-destructive"}`} />
        <h2 className="text-2xl font-bold text-white">Resultado da Simulação</h2>
        <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-lg font-bold ${
          score >= 70
            ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
            : score >= 40
            ? "bg-warning/15 text-warning"
            : "bg-destructive/15 text-destructive"
        }`}>
          Score: {score}/100
        </div>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-3 text-center">
          <CheckCircle className="h-5 w-5 text-[hsl(var(--success))] mx-auto mb-1" />
          <p className="text-lg font-bold text-[hsl(var(--success))]">{totalCorrect}</p>
          <p className="text-xs text-white/50">Corretas</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
          <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
          <p className="text-lg font-bold text-destructive">{totalIncorrect}</p>
          <p className="text-xs text-white/50">Incorretas</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-center">
          <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-lg font-bold text-warning">{totalMissed}</p>
          <p className="text-xs text-white/50">Não encontradas</p>
        </div>
      </div>

      {/* Per-basket breakdown */}
      {basketResults.map(({ basket, correct, incorrect, missed, note }) => (
        <div key={basket.id} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <h4 className="text-sm font-bold text-white">Cestinha {basket.id} — {basket.patient}</h4>

          {correct.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[hsl(var(--success))]">✅ Falhas corretamente identificadas:</p>
              {correct.map((f, i) => (
                <p key={i} className="text-xs text-white/60 ml-4">• {f}</p>
              ))}
            </div>
          )}

          {incorrect.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">❌ Falhas incorretas (falso positivo):</p>
              {incorrect.map((f, i) => (
                <p key={i} className="text-xs text-white/60 ml-4">• {f}</p>
              ))}
            </div>
          )}

          {missed.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-warning">⚠️ Falhas não encontradas:</p>
              {missed.map((f, i) => (
                <p key={i} className="text-xs text-white/60 ml-4">• {f}</p>
              ))}
            </div>
          )}

          {correct.length === 0 && incorrect.length === 0 && missed.length === 0 && (
            <p className="text-xs text-white/40 italic">Nenhuma falha esperada ou encontrada.</p>
          )}

          {note && (
            <div className="bg-white/5 rounded p-2 mt-2">
              <p className="text-xs text-white/40">Sua nota: <span className="text-white/60">{note}</span></p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
