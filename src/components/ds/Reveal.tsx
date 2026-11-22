import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { EASE, useMotionOn } from "@/lib/motion";

const container = (stagger: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});
const item: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
};

/** Grupo cujos filhos (RevealItem) entram em cascata, de cima para baixo. */
export function Reveal({ children, className, stagger = 0.07 }: { children: ReactNode; className?: string; stagger?: number }) {
  const on = useMotionOn();
  if (!on) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={container(stagger)} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const on = useMotionOn();
  if (!on) return <div className={className}>{children}</div>;
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}
