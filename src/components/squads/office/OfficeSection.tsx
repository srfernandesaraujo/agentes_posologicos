import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SquadAgent, SquadEvent } from "@/hooks/useSquads";
import { OfficeCanvas } from "./OfficeCanvas";

const KEY = "squad-office-hidden";

function readHidden(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Escritório visual com botão para ocultar (a escolha fica salva neste navegador). */
export function OfficeSection({ agents, events, environment }: { agents: SquadAgent[]; events: SquadEvent[]; environment: string }) {
  const [hidden, setHidden] = useState(readHidden);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* sem armazenamento: só não lembra */ }
  };
  return (
    <section aria-label="Escritório do squad" className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white/70">Escritório ao vivo</h4>
        <Button variant="ghost" size="sm" onClick={toggle} className="gap-1 text-white/50" aria-expanded={!hidden}>
          {hidden ? <><ChevronDown className="h-4 w-4" /> Mostrar</> : <><ChevronUp className="h-4 w-4" /> Ocultar</>}
        </Button>
      </div>
      {!hidden && <div className="mx-auto max-w-[640px]"><OfficeCanvas agents={agents} events={events} environment={environment} /></div>}
    </section>
  );
}
