import { Moon, Sun } from "lucide-react";
import { useNewUI } from "@/contexts/NewUIContext";

/** Alterna entre tema escuro e claro do novo visual. Guardado em localStorage (pos-tema). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { enabled, theme, setTheme } = useNewUI();
  if (!enabled) return null;
  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(light ? "dark" : "light")}
      className={`rounded-lg p-2 text-white/60 transition hover:bg-white/5 hover:text-white ${className}`}
      aria-label={light ? "Mudar para tema escuro" : "Mudar para tema claro"}
      title={light ? "Tema escuro" : "Tema claro"}
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
