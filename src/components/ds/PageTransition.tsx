import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

/** Entrada suave de cada página ao trocar de rota (sem animação de saída, para não atrasar a navegação). */
export function PageTransition({ children }: { children: ReactNode }) {
  const on = useMotionOn();
  const { pathname } = useLocation();
  // mudar de item dentro da mesma tela (ex.: /chat/:id) não reinicia a animação
  const key = "/" + (pathname.split("/")[1] ?? "");
  if (!on) return <>{children}</>;
  return (
    <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }}>
      {children}
    </motion.div>
  );
}
