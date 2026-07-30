import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs px-4 py-1.5">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Sem conexão — a Calculadora de Dose continua funcionando. Outras funções precisam de internet.
    </div>
  );
}
