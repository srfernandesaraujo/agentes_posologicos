import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Chave do "novo visual" (redesenho em ondas). Enquanto desligada, nada muda.
 * Liga/desliga por ?novo-visual=1 / ?novo-visual=0 na URL (guardado em localStorage)
 * e reflete em <html data-ui="v2">, que ativa os tokens do novo sistema visual.
 */
const KEY = "pos-novo-visual";

function readInitial(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("novo-visual");
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

interface Ctx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}
const NewUIContext = createContext<Ctx>({ enabled: false, setEnabled: () => {} });

export function NewUIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute("data-ui", "v2");
    else root.removeAttribute("data-ui");
  }, [enabled]);

  const setEnabled = useCallback((v: boolean) => {
    try {
      if (v) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch {
      /* storage bloqueado */
    }
    setEnabledState(v);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
  return <NewUIContext.Provider value={value}>{children}</NewUIContext.Provider>;
}

export const useNewUI = () => useContext(NewUIContext);
