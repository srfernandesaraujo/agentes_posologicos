import { useReducedMotion } from "framer-motion";

/** Curvas e molas do sistema de movimento. Use estas em vez de valores soltos. */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 140, damping: 22 } as const;

const KEY = "pos-movimento";

/** ?movimento=0 desliga todas as animações do novo visual neste navegador; ?movimento=1 volta ao normal. */
function readPref(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("movimento");
    if (q === "0") localStorage.setItem(KEY, "0");
    if (q === "1") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
const PREF = typeof window === "undefined" ? true : readPref();

/** Verdadeiro quando as animações devem rodar: respeita "reduzir movimento" do sistema e o interruptor ?movimento=0. */
export function useMotionOn(): boolean {
  const reduced = useReducedMotion();
  return PREF && !reduced;
}
