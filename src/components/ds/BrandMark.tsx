import { cn } from "@/lib/utils";

/** Marca nova: curva de concentração × tempo dentro de um quadrado arredondado. */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid place-items-center rounded-[28%] text-[#04141a]", className)}
      style={{ width: size, height: size, background: "linear-gradient(140deg,#2DD4BF,#38BDF8)" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 24C8 24 9 7 15 7s7 14 14 14" />
      </svg>
    </span>
  );
}
