import { useNewUI } from "@/contexts/NewUIContext";
import type { DomainId } from "@/components/layout/navConfig";

const NAMES: Record<DomainId, string> = {
  inicio: "Início", clinica: "Clínica", equipes: "Equipes", ensino: "Ensino", acervo: "Acervo", ajuda: "Conta e ajuda",
};

/** Linha pequena acima do título que diz em qual domínio você está, na cor dele. Só aparece no novo visual. */
export function DomainEyebrow({ domain, section }: { domain: DomainId; section?: string }) {
  const { enabled } = useNewUI();
  if (!enabled) return null;
  return (
    <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: `hsl(var(--dom-${domain}))` }}>
      {NAMES[domain]}{section ? ` · ${section}` : ""}
    </p>
  );
}
