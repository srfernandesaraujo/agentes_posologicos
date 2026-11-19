import { useEffect, useRef, useState } from "react";
import { makeSim, moveTo, step, type Sim } from "@/lib/squadOfficeSim";
import type { OfficeAgent, RoomId } from "@/lib/squadOffice";
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

const words = {
 pt: { label: "Demonstração ilustrativa", title: "Um objetivo. Um time inteiro em ação.", desc: "Veja um squad dividir uma missão: cada agente contribui com uma etapa e a direção reúne o trabalho em uma entrega.", mission: "Missão de exemplo", task: "Criar uma aula sobre interações medicamentosas", names: ["Helena", "Bia", "Caio", "Íris", "Nina"], roles: ["Coordena a missão", "Organiza a pesquisa", "Estrutura o roteiro", "Prepara os materiais", "Revisa a entrega"], phases: ["Equipe trabalhando", "Contribuições reunidas", "Revisão em conjunto", "Entrega organizada"], note: "Animação ilustrativa baseada no escritório de squads da plataforma.", ready: "Entrega organizada" },
 en: { label: "Illustrative demonstration", title: "One goal. A whole team in action.", desc: "See a squad divide a mission: each agent contributes a step and the director brings the work together into a deliverable.", mission: "Example mission", task: "Create a lesson on drug interactions", names: ["Helena", "Bia", "Caio", "Íris", "Nina"], roles: ["Coordinates the mission", "Organizes research", "Structures the outline", "Prepares materials", "Reviews the deliverable"], phases: ["Team working", "Contributions gathered", "Reviewing together", "Deliverable organized"], note: "Illustrative animation based on the platform's squad office.", ready: "Deliverable organized" },
 es: { label: "Demostración ilustrativa", title: "Un objetivo. Todo un equipo en acción.", desc: "Mira cómo un squad divide una misión: cada agente aporta una etapa y la dirección reúne el trabajo en una entrega.", mission: "Misión de ejemplo", task: "Crear una clase sobre interacciones medicamentosas", names: ["Helena", "Bia", "Caio", "Íris", "Nina"], roles: ["Coordina la misión", "Organiza la investigación", "Estructura el guion", "Prepara los materiales", "Revisa la entrega"], phases: ["Equipo trabajando", "Aportes reunidos", "Revisión en conjunto", "Entrega organizada"], note: "Animación ilustrativa basada en la oficina de squads de la plataforma.", ready: "Entrega organizada" },
};

export function LandingSquad({ locale }: { locale: "pt" | "en" | "es" }) {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const [phase, setPhase] = useState(0);
 const c = words[locale] || words.pt;
 useEffect(() => {
  const canvas = canvasRef.current; if (!canvas) return;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let sim: Sim = makeSim(agents);
  let frame = 0, active = false, previous = 0, elapsed = 0, stage = -1;
  const setStage = (next: number) => {
   if (next === stage) return;
   stage = next; setPhase(next);
   if (next === 0) {
    sim = makeSim(agents);
    sim.agents.forEach(a => { a.state = "work"; a.after = "work"; });
   } else if (next === 1) {
    sim.agents.filter(a => a.info.id !== "helena").forEach(a => moveTo(sim, a, "meet", "meet", false));
    sim.deliverables = 1;
   } else if (next === 2) {
    moveTo(sim, sim.agents[0], "meet", "meet", false);
    sim.deliverables = 2;
   } else {
    sim.agents.forEach(a => moveTo(sim, a, "desk", "work", false));
    sim.deliverables = 3;
   }
  };
  const render = (seconds: number) => {
   ctx.imageSmoothingEnabled = false;
   ctx.clearRect(0, 0, 640, 640);
   ctx.drawImage(getStaticLayer("studio"), 0, 0);
   const occupied = new Set<RoomId>(sim.agents.map(a => a.room === "hall" ? a.destRoom : a.room));
   const working = new Set<RoomId>(sim.agents.filter(a => a.state === "work" || a.state === "meet").map(a => a.room as RoomId));
   drawAnimated(ctx, "studio", { t: seconds, occupied, working, deliverables: sim.deliverables });
   const ordered = [...sim.agents].sort((a, b) => a.y - b.y);
   ordered.forEach(a => drawAgentSprite(ctx, a, seconds, false, seconds));
   ctx.font = "700 9px ui-monospace, Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
   ordered.forEach(a => { const x = Math.round(a.x)*2, y = Math.round(a.y)*2+4, w = ctx.measureText(a.info.name).width+8; ctx.fillStyle = "rgba(20,22,32,.88)"; ctx.fillRect(x-w/2,y,w,13); ctx.fillStyle = "#f3f0e6"; ctx.fillText(a.info.name,x,y+2); });
   ctx.textAlign = "left";
  };
  const tick = (ts: number) => {
   if (!active) return;
   const dt = previous ? Math.min((ts-previous)/1000, .1) : 0; previous = ts; elapsed += dt;
   if (elapsed >= 30) { elapsed = 0; stage = -1; }
   setStage(elapsed < 9 ? 0 : elapsed < 16 ? 1 : elapsed < 23 ? 2 : 3);
   step(sim, dt, elapsed); render(elapsed);
   frame = requestAnimationFrame(tick);
  };
  setStage(0); render(0);
  if (!reduced) {
   const observer = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) { previous = 0; frame = requestAnimationFrame(tick); } else { cancelAnimationFrame(frame); previous = 0; }
   }, { threshold: .05 });
   observer.observe(canvas);
   return () => { active = false; observer.disconnect(); cancelAnimationFrame(frame); };
  }
 }, []);
 return <div className="squad-demo">
  <div className="squad-demo-copy"><p className="landing-kicker">{c.label}</p><h3>{c.title}</h3><p>{c.desc}</p>
   <div className="squad-mission"><span>{c.mission}</span><strong>{c.task}</strong><div className="squad-status"><span/>{c.phases[phase]}</div></div>
   <div className="squad-roster">{c.names.map((name,i)=><div key={name}><span className={"squad-roster-dot squad-dot-"+i}/><strong>{name}</strong><span>{c.roles[i]}</span></div>)}</div>
  </div>
  <figure className="squad-office"><div className="squad-office-bar"><span><i/> SQUAD / {c.label}</span><span>● ● ●</span></div><canvas ref={canvasRef} width={640} height={640} role="img" aria-label={c.note}/><figcaption>{c.note}</figcaption></figure>
 </div>;
}
