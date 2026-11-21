import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Chave do "novo visual" (redesenho em ondas). LIGADO por padrão desde 2026-11-21.
 * Quem quiser voltar ao visual antigo usa ?novo-visual=0 (guardado em localStorage);
 * ?novo-visual=1 volta a ligar.
 * e reflete em <html data-ui="v2">, que ativa os tokens do novo sistema visual.
 */
const KEY = "pos-novo-visual";

function readInitial(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("novo-visual");
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.setItem(KEY, "0");
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

interface Ctx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}
const NewUIContext = createContext<Ctx>({ enabled: true, setEnabled: () => {} });

export function NewUIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute("data-ui", "v2");
    else root.removeAttribute("data-ui");
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* storage bloqueado */
    }
    setEnabledState(v);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <NewUIContext.Provider value={value}>{children}</NewUIContext.Provider>;
}

export const useNewUI = () => useContext(NewUIContext);
