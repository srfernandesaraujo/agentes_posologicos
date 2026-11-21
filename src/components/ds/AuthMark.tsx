import { Pill } from "lucide-react";
import { useNewUI } from "@/contexts/NewUIContext";
import { BrandMark } from "./BrandMark";
import { PkCurve } from "./PkCurve";

/** Marca das telas de entrada: no novo visual vira a curva farmacocinética; senão mantém o ícone antigo. */
export function AuthMark({ big = false }: { big?: boolean }) {
  const { enabled } = useNewUI();
  const box = big ? "h-20 w-20 rounded-2xl" : "h-9 w-9 rounded-lg";
  const icon = big ? "h-10 w-10" : "h-5 w-5";
  if (enabled) return <BrandMark size={big ? 80 : 36} />;
  return (
    <div className={`flex ${box} items-center justify-center gradient-primary`}>
      <Pill className={`${icon} text-white`} />
    </div>
  );
}

/** Curva decorativa sob o texto do painel de marca (só no novo visual). */
export function AuthCurve() {
  const { enabled } = useNewUI();
  if (!enabled) return null;
  return <PkCurve className="mt-10 w-full opacity-80" height={110} />;
}
