import { cn } from "@/lib/utils";

export type PulseState = "working" | "waiting" | "idle" | "done";

interface Props {
  name: string;
  state?: PulseState;
  /** cor base, ex.: "var(--dom-equipes)" (sem hsl) */
  tone?: string;
  size?: number;
  className?: string;
}

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

/** Avatar de agente com estado visível: pulsa quando trabalha, contorno âmbar quando espera por você. */
export function PulseAvatar({ name, state = "idle", tone = "var(--dom-equipes)", size = 40, className }: Props) {
  const label = { working: "trabalhando", waiting: "aguardando você", idle: "parado", done: "concluiu" }[state];
  return (
    <span
      className={cn("pos-pulse-av", state === "working" && "is-working", state === "waiting" && "is-waiting", className)}
      style={{ width: size, height: size, fontSize: size * 0.36, ["--tone" as string]: tone }}
      role="img"
      aria-label={`${name}, ${label}`}
    >
      {initials(name)}
    </span>
  );
}
