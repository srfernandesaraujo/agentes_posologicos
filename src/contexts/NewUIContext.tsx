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

/** Tema do novo visual. Escuro por padrão; ?tema=claro / ?tema=escuro troca e fica guardado. */
export type UITheme = "dark" | "light";
const THEME_KEY = "pos-tema";

function readTheme(): UITheme {
  try {
    const q = new URLSearchParams(window.location.search).get("tema");
    if (q === "claro") localStorage.setItem(THEME_KEY, "light");
    if (q === "escuro") localStorage.setItem(THEME_KEY, "dark");
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

interface Ctx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  theme: UITheme;
  setTheme: (t: UITheme) => void;
}
const NewUIContext = createContext<Ctx>({ enabled: true, setEnabled: () => {}, theme: "dark", setTheme: () => {} });

export function NewUIProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(readInitial);
  const [theme, setThemeState] = useState<UITheme>(readTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-ui", "v2");
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-ui");
      root.removeAttribute("data-theme");
    }
  }, [enabled, theme]);

  const setTheme = useCallback((t: UITheme) => {
    try { localStorage.setItem(THEME_KEY, t); } catch { /* storage bloqueado */ }
    setThemeState(t);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* storage bloqueado */
    }
    setEnabledState(v);
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled, theme, setTheme }), [enabled, setEnabled, theme, setTheme]);
  return <NewUIContext.Provider value={value}>{children}</NewUIContext.Provider>;
}

export const useNewUI = () => useContext(NewUIContext);

/** Páginas feitas só no escuro (landing, convites): fixam data-theme="dark" enquanto estão montadas. */
export function useForceDark() {
  const { enabled, theme } = useNewUI();
  useEffect(() => {
    if (!enabled || theme !== "light") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", "dark");
    return () => root.setAttribute("data-theme", "light");
  }, [enabled, theme]);
}
