import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { DIRECTOR_DESK, makeSim, moveTo, step, type Sim } from "@/lib/squadOfficeSim";
import type { OfficeAgent, RoomId, SceneTheme } from "@/lib/squadOffice";
import { drawAnimated, getStaticLayer } from "@/components/squads/office/officeScenes";
import { drawAgentSprite } from "@/components/squads/office/officeSprites";
import "./LandingSquad.css";

const agents: OfficeAgent[] = [
  { id: "helena", name: "Helena", role: "direção", room: "dir", sort_order: 0, slug: "diretora" },
  { id: "bia", name: "Bia", role: "pesquisa", room: "ops", sort_order: 1 },
  { id: "caio", name: "Caio", role: "roteiro", room: "lib", sort_order: 2 },
  { id: "iris", name: "Íris", role: "edição", room: "ops", sort_order: 3 },
  { id: "nina", name: "Nina", role: "revisão", room: "meet", sort_order: 4, slug: "revisora" },
];

interface MissionPreset {
  id: string;
  scene: SceneTheme;
  coat: boolean;
  label: string;
  task: string;
  deliverable: string;
  bubbles: string[];
}

const words: Record<
  "pt" | "en" | "es",
  {
    kicker: string;
    title: string;
    desc: string;
    missionLabel: string;
    chooseMission: string;
    names: string[];
    roles: string[];
    phases: string[];
    note: string;
    readyLabel: string;
    missions: MissionPreset[];
  }
> = {
  pt: {
    kicker: "Escritório vivo de squads",
    title: "Um objetivo clínico. Um time inteiro em ação.",
    desc: "Escolha uma missão real e observe o squad se organizar: cada agente assume uma etapa especializada e a direção consolida a entrega final.",
    missionLabel: "Missão ativa",
    chooseMission: "Disparar missão:",
    names: ["Helena", "Bia", "Caio", "Íris", "Nina"],
    roles: [
      "Coordena a missão e consolida",
      "Busca evidências no PubMed",
      "Estrutura caso, doses e roteiro",
      "Monta material e rubrica",
      "Valida segurança e referências",
    ],
    phases: [
      "Agentes executando etapas paralelas",
      "Contribuições enviadas à reunião",
      "Revisão clínica em conjunto",
      "Entrega final consolidada",
    ],
    note: "Simulação baseada no motor real do Escritório de Squads da plataforma.",
    readyLabel: "Entrega consolidada",
    missions: [
      {
        id: "clinical",
        scene: "university",
        coat: true,
        label: "Protocolo Clínico",
        task: "Revisar protocolo de sepse com ajuste renal e interações",
        deliverable: "Protocolo PDF + Tabela ClCr + 6 PMIDs",
        bubbles: ["Coordenando...", "PubMed ok!", "ClCr 38 mL/min", "Formatando...", "CYP450 ok!"],
      },
      {
        id: "osce",
        scene: "campus",
        coat: false,
        label: "Estação OSCE",
        task: "Criar estação OSCE de dor torácica com paciente virtual e rubrica",
        deliverable: "Briefing + Paciente IA + Rubrica 100 pts",
        bubbles: ["Alinhando...", "Diretriz SBC", "Roteiro paciente", "Rubrica pronta", "Validado!"],
      },
      {
        id: "lesson",
        scene: "studio",
        coat: false,
        label: "Aula & Evidências",
        task: "Estruturar aula ativa sobre interações medicamentosas",
        deliverable: "Plano PBL + 3 Casos + Quiz de Sala",
        bubbles: ["Objetivo PBL", "Buscando artigos", "3 casos prontos", "Slides e guia", "Revisão ok!"],
      },
    ],
  },
  en: {
    kicker: "Live multi-agent squad studio",
    title: "One clinical goal. A whole team in action.",
    desc: "Trigger a real mission and watch the squad collaborate: each agent executes a specialized stage while the director assembles the final deliverable.",
    missionLabel: "Active mission",
    chooseMission: "Trigger mission:",
    names: ["Helena", "Bia", "Caio", "Íris", "Nina"],
    roles: [
      "Coordinates & assembles output",
      "Queries PubMed evidence",
      "Structures case, dosing & script",
      "Builds materials & rubric",
      "Validates safety & citations",
    ],
    phases: [
      "Agents working in parallel",
      "Deliverables sent to briefing",
      "Joint clinical review",
      "Final deliverable ready",
    ],
    note: "Live simulation powered by the platform's real Squad Office engine.",
    readyLabel: "Deliverable ready",
    missions: [
      {
        id: "clinical",
        scene: "university",
        coat: true,
        label: "Clinical Protocol",
        task: "Review sepsis protocol with renal dosing and interaction checks",
        deliverable: "Protocol PDF + CrCl Table + 6 PMIDs",
        bubbles: ["Directing...", "PubMed ready!", "CrCl 38 mL/min", "Formatting...", "CYP450 ok!"],
      },
      {
        id: "osce",
        scene: "campus",
        coat: false,
        label: "OSCE Station",
        task: "Design chest pain OSCE station with virtual patient & rubric",
        deliverable: "Briefing + AI Patient + 100pt Rubric",
        bubbles: ["Aligning...", "Guidelines ok", "Patient script", "Rubric ready", "Validated!"],
      },
      {
        id: "lesson",
        scene: "studio",
        coat: false,
        label: "Lesson & Evidence",
        task: "Structure an active-learning lesson on drug interactions",
        deliverable: "PBL Plan + 3 Cases + Live Quiz",
        bubbles: ["PBL goals", "Pulling papers", "3 cases built", "Slides & guide", "Review ok!"],
      },
    ],
  },
  es: {
    kicker: "Oficina viva de squads",
    title: "Un objetivo clínico. Todo un equipo en acción.",
    desc: "Elige una misión real y observa al squad colaborar: cada agente ejecuta una etapa especializada y la dirección consolida la entrega.",
    missionLabel: "Misión activa",
    chooseMission: "Lanzar misión:",
    names: ["Helena", "Bia", "Caio", "Íris", "Nina"],
    roles: [
      "Coordina y consolida entrega",
      "Busca evidencia en PubMed",
      "Estructura caso, dosis y guion",
      "Prepara materiales y rúbrica",
      "Valida seguridad y referencias",
    ],
    phases: [
      "Agentes ejecutando en paralelo",
      "Aportes enviados a reunión",
      "Revisión clínica conjunta",
      "Entrega final consolidada",
    ],
    note: "Simulación impulsada por el motor real de la Oficina de Squads.",
    readyLabel: "Entrega consolidada",
    missions: [
      {
        id: "clinical",
        scene: "university",
        coat: true,
        label: "Protocolo Clínico",
        task: "Revisar protocolo de sepsis con ajuste renal e interacciones",
        deliverable: "Protocolo PDF + Tabla ClCr + 6 PMIDs",
        bubbles: ["Coordinando...", "¡PubMed listo!", "ClCr 38 mL/min", "Editando...", "¡CYP450 ok!"],
      },
      {
        id: "osce",
        scene: "campus",
        coat: false,
        label: "Estación OSCE",
        task: "Crear estación OSCE de dolor torácico con paciente virtual y rúbrica",
        deliverable: "Briefing + Paciente IA + Rúbrica 100 pts",
        bubbles: ["Alineando...", "Guía clínica", "Guion paciente", "Rúbrica lista", "¡Validado!"],
      },
      {
        id: "lesson",
        scene: "studio",
        coat: false,
        label: "Clase y Evidencia",
        task: "Estructurar clase activa sobre interacciones medicamentosas",
        deliverable: "Plan PBL + 3 Casos + Quiz en Vivo",
        bubbles: ["Meta PBL", "Buscando PMIDs", "3 casos listos", "Guía y slides", "¡Revisión ok!"],
      },
    ],
  },
};

export function LandingSquad({ locale }: { locale: "pt" | "en" | "es" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [missionIdx, setMissionIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const c = words[locale] || words.pt;
  const mission = c.missions[missionIdx] || c.missions[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sim: Sim = makeSim(agents);
    let frame = 0;
    let active = false;
    let previous = 0;
    let elapsed = 0;
    let stage = -1;

    const setStage = (next: number) => {
      if (next === stage) return;
      stage = next;
      setPhase(next);

      if (next === 0) {
        sim = makeSim(agents);
        sim.agents.forEach((a, idx) => {
          a.state = "work";
          a.after = "work";
          a.bubble = {
            text: mission.bubbles[idx] || "...",
            until: elapsed + 7.5,
            tone: idx === 1 ? "ok" : "info",
          };
        });
      } else if (next === 1) {
        sim.agents
          .filter((a) => a.info.id !== "helena")
          .forEach((a, i) => {
            sim.papers.push({
              from: { x: a.x, y: a.y - 12 },
              to: DIRECTOR_DESK,
              start: elapsed + i * 0.22,
              dur: 1.05,
            });
            moveTo(sim, a, "meet", "meet", false);
          });
        sim.deliverables = 1;
      } else if (next === 2) {
        moveTo(sim, sim.agents[0], "meet", "meet", false);
        sim.agents[0].bubble = {
          text: mission.bubbles[0],
          until: elapsed + 5.5,
          tone: "info",
        };
        sim.agents[4].bubble = {
          text: mission.bubbles[4],
          until: elapsed + 5.5,
          tone: "ok",
        };
        sim.deliverables = 2;
      } else {
        sim.agents.forEach((a) => {
          moveTo(sim, a, "desk", "work", false);
          a.hopUntil = elapsed + 2.2;
        });
        sim.deliverables = 3;
      }
    };

    const drawBubble = (x: number, y: number, text: string, tone: string) => {
      ctx.font = "700 10px ui-monospace, SFMono-Regular, Consolas, monospace";
      const padX = 7;
      const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
      const h = 18;
      const bx = Math.max(8, Math.min(632 - w, Math.round(x - w / 2)));
      const by = Math.max(8, Math.round(y - 76));

      ctx.fillStyle = tone === "ok" ? "rgba(10, 44, 38, 0.94)" : "rgba(14, 24, 36, 0.94)";
      ctx.fillRect(bx, by, w, h);
      ctx.strokeStyle = tone === "ok" ? "#5eead4" : "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);

      ctx.fillStyle = tone === "ok" ? "#ccfbf1" : "#e0f2fe";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + w / 2, by + h / 2 + 0.5);
    };

    const drawPapers = (seconds: number) => {
      sim.papers = sim.papers.filter((p) => seconds <= p.start + p.dur + 0.1);
      for (const p of sim.papers) {
        if (seconds < p.start) continue;
        const u = Math.min(1, (seconds - p.start) / p.dur);
        const ease = 1 - Math.pow(1 - u, 3);
        const px = (p.from.x + (p.to.x - p.from.x) * ease) * 2;
        const py =
          (p.from.y + (p.to.y - p.from.y) * ease - Math.sin(u * Math.PI) * 26) * 2;
        ctx.fillStyle = "#eefef9";
        ctx.fillRect(Math.round(px - 5), Math.round(py - 6), 10, 12);
        ctx.fillStyle = "#5eead4";
        ctx.fillRect(Math.round(px - 3), Math.round(py - 3), 6, 2);
        ctx.fillRect(Math.round(px - 3), Math.round(py + 1), 4, 2);
      }
    };

    const render = (seconds: number) => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 640, 640);
      ctx.drawImage(getStaticLayer(mission.scene), 0, 0);

      const occupied = new Set<RoomId>(
        sim.agents.map((a) => (a.room === "hall" ? a.destRoom : a.room))
      );
      const working = new Set<RoomId>(
        sim.agents
          .filter((a) => a.state === "work" || a.state === "meet")
          .map((a) => a.room as RoomId)
      );

      drawAnimated(ctx, mission.scene, {
        t: seconds,
        occupied,
        working,
        deliverables: sim.deliverables,
      });

      const ordered = [...sim.agents].sort((a, b) => a.y - b.y);
      ordered.forEach((a) => drawAgentSprite(ctx, a, seconds, mission.coat, seconds));

      // Name pills
      ctx.font = "700 9px ui-monospace, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ordered.forEach((a) => {
        const x = Math.round(a.x) * 2;
        const y = Math.round(a.y) * 2 + 4;
        const w = ctx.measureText(a.info.name).width + 8;
        ctx.fillStyle = "rgba(10, 18, 26, 0.88)";
        ctx.fillRect(x - w / 2, y, w, 13);
        ctx.fillStyle = "#eefef9";
        ctx.fillText(a.info.name, x, y + 2);
      });

      // Flying papers + active pixel speech bubbles
      drawPapers(seconds);
      ordered.forEach((a) => {
        if (a.bubble && seconds <= a.bubble.until) {
          drawBubble(Math.round(a.x) * 2, Math.round(a.y) * 2, a.bubble.text, a.bubble.tone);
        }
      });

      ctx.textAlign = "left";
    };

    const tick = (ts: number) => {
      if (!active) return;
      const dt = previous ? Math.min((ts - previous) / 1000, 0.1) : 0;
      previous = ts;
      elapsed += dt;
      if (elapsed >= 26) {
        elapsed = 0;
        stage = -1;
      }
      setStage(elapsed < 7.5 ? 0 : elapsed < 14 ? 1 : elapsed < 20.5 ? 2 : 3);
      step(sim, dt, elapsed);
      render(elapsed);
      frame = requestAnimationFrame(tick);
    };

    setStage(0);
    render(0);

    if (!reduced) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          active = entry.isIntersecting;
          if (active) {
            previous = 0;
            frame = requestAnimationFrame(tick);
          } else {
            cancelAnimationFrame(frame);
            previous = 0;
          }
        },
        { threshold: 0.08 }
      );
      observer.observe(canvas);
      return () => {
        active = false;
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    }
  }, [mission]);

  return (
    <div className="squad-demo" id="squads">
      <div className="squad-demo-copy">
        <p className="lp-kicker">{c.kicker}</p>
        <h3>{c.title}</h3>
        <p>{c.desc}</p>

        <div className="squad-mission-switcher">
          <span className="squad-switch-label">
            <Sparkles size={13} />
            {c.chooseMission}
          </span>
          <div className="squad-mission-pills" role="tablist" aria-label={c.chooseMission}>
            {c.missions.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={missionIdx === i}
                className={missionIdx === i ? "is-active" : ""}
                onClick={() => setMissionIdx(i)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="squad-mission">
          <span>{c.missionLabel}</span>
          <strong>{mission.task}</strong>
          <div className="squad-status">
            <span />
            {c.phases[phase]}
          </div>
        </div>

        <div className="squad-roster">
          {c.names.map((name, i) => (
            <div key={name}>
              <span className={"squad-roster-dot squad-dot-" + i} />
              <strong>{name}</strong>
              <span>{c.roles[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <figure className="squad-office">
        <div className="squad-office-bar">
          <span>
            <i /> SQUAD STUDIO / {mission.label.toUpperCase()}
          </span>
          <span className="squad-phase-chip">
            {phase + 1}/4
          </span>
        </div>

        <div className="squad-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={640}
            height={640}
            role="img"
            aria-label={c.note}
          />
          <div className={`squad-deliverable-toast ${phase === 3 ? "is-visible" : ""}`}>
            <CheckCircle2 size={15} />
            <div>
              <small>{c.readyLabel}</small>
              <strong>
                <FileText size={13} /> {mission.deliverable}
              </strong>
            </div>
          </div>
        </div>

        <figcaption>{c.note}</figcaption>
      </figure>
    </div>
  );
}
