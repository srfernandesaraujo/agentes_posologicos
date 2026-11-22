import { motion } from "framer-motion";
import { Play, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CountUp } from "@/components/ds/CountUp";
import { PulseAvatar } from "@/components/ds/PulseAvatar";
import { SPRING, useMotionOn } from "@/lib/motion";

interface Person { key: string; name: string; guest: boolean }

interface Props {
  pin: string;
  joinUrl: string;
  people: Person[];
  busy: boolean;
  onStart: () => void;
}

/** Sala de espera da prova: o código e o QR para entrar, os alunos aparecendo conforme chegam e o botão de começar. */
export function OsceWaitingRoom({ pin, joinUrl, people, busy, onStart }: Props) {
  const on = useMotionOn();
  const ready = people.length > 0;

  return (
    <section className="pos-elev overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[hsl(var(--dom-ensino)/0.12)] via-card to-card p-6 md:p-8" aria-label="Sala de espera">
      <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="mx-auto flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-3.5 shadow-[0_24px_60px_-28px_hsl(var(--dom-ensino))]">
            <QRCodeSVG value={joinUrl} size={168} level="M" />
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">escaneie para entrar</p>
        </div>

        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--dom-ensino))]">Alunos entram em /osce/entrar</p>
          <p className="mt-1 font-display text-[clamp(48px,9vw,92px)] font-extrabold leading-none tracking-[0.12em] text-foreground">{pin}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center">
              {people.slice(0, 10).map((p, i) => (
                <motion.span
                  key={p.key}
                  title={p.guest ? `${p.name} (convidado)` : p.name}
                  className="-ml-2 first:ml-0"
                  style={{ zIndex: 20 - i }}
                  initial={{ scale: on ? 0 : 1, opacity: on ? 0 : 1 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING}
                >
                  <PulseAvatar name={p.name} state="working" tone="var(--dom-ensino)" size={40} className="border-2 border-card" />
                </motion.span>
              ))}
              {people.length > 10 && <span className="ml-2 font-mono text-xs text-muted-foreground">+{people.length - 10}</span>}
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {ready ? <><CountUp value={people.length} duration={0.5} /> {people.length === 1 ? "aluno na sala" : "alunos na sala"}</> : "aguardando os primeiros alunos…"}
            </span>
          </div>

          <button
            onClick={onStart}
            disabled={!ready || busy}
            className={`mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold transition ${ready ? "bg-gradient-to-br from-[#FBBF24] to-[#F59E0B] text-[hsl(208_46%_6%)] shadow-[0_14px_34px_-14px_#FBBF24] hover:opacity-95" : "cursor-not-allowed bg-muted text-muted-foreground"}`}
          >
            <Play className="h-4 w-4" /> {ready ? `Iniciar prova para ${people.length} ${people.length === 1 ? "aluno" : "alunos"}` : "Iniciar prova"}
          </button>
          {!ready && <p className="mt-2 text-xs text-muted-foreground">O botão acende quando o primeiro aluno entrar.</p>}
        </div>
      </div>
    </section>
  );
}
