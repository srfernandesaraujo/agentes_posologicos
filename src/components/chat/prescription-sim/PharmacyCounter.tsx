import { Package, CheckCircle, Clock } from "lucide-react";
import type { Basket } from "./types";

interface Props {
  baskets: Basket[];
  completedBaskets: Set<number>;
  onSelectBasket: (id: number) => void;
}

export default function PharmacyCounter({ baskets, completedBaskets, onSelectBasket }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <Package className="h-6 w-6 text-accent" />
          Bancada da Farmácia
        </h2>
        <p className="text-sm text-white/60">
          Selecione uma cestinha para iniciar a validação da prescrição
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {baskets.map((basket) => {
          const done = completedBaskets.has(basket.id);
          return (
            <button
              key={basket.id}
              onClick={() => onSelectBasket(basket.id)}
              className={`relative group rounded-xl border-2 p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer flex flex-col items-center gap-3 min-h-[160px] ${
                done
                  ? "border-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                  : "border-white/20 bg-white/5 hover:border-accent hover:bg-accent/10"
              }`}
            >
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl ${
                done
                  ? "bg-[hsl(var(--success))]/20"
                  : "bg-accent/20 group-hover:bg-accent/30"
              }`}>
                {done ? (
                  <CheckCircle className="h-8 w-8 text-[hsl(var(--success))]" />
                ) : (
                  <Package className="h-8 w-8 text-accent" />
                )}
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-white">
                  Cestinha {basket.id}
                </p>
                <p className="text-xs text-white/50 mt-1 line-clamp-1">
                  {basket.patient}
                </p>
              </div>

              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                done
                  ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                  : "bg-white/10 text-white/50"
              }`}>
                {done ? "Validada ✓" : "Pendente"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-white/40 pt-2">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> Pendente: {baskets.length - completedBaskets.size}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-[hsl(var(--success))]" /> Validadas: {completedBaskets.size}
        </span>
      </div>
    </div>
  );
}
