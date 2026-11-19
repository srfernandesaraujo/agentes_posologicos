import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, GraduationCap, MessageCircle, Pill, Stethoscope, Workflow } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { FloatingAuth } from "@/components/auth/FloatingAuth";
import { SalesAgentWidget } from "@/components/sales/SalesAgentWidget";
import { SEO } from "@/components/seo/SEO";
import { LandingSquad } from "./LandingSquad";
import "./Landing.css";

const text = {
 pt: {
  eyebrow:"IA para saúde, educação e pesquisa", title:"Conhecimento em movimento.", intro:"Agentes especializados para explorar questões, preparar aulas e desenvolver ideias com mais clareza.", start:"Criar conta gratuita", explore:"Explorar agentes", access:"Entrar em atividade", scroll:"Role para descobrir",
  sceneLabel:"Uma conversa, novas possibilidades", sceneTitle:"Da pergunta ao próximo passo.", sceneText:"Escolha um agente, compartilhe seu contexto e organize a conversa em torno do que importa para você.", example:"Exemplo ilustrativo", question:"Como posso estruturar uma aula sobre interações medicamentosas?", answerTitle:"Uma estrutura para começar", answer:"Defina os objetivos de aprendizagem, apresente um caso e proponha perguntas para discussão. Finalize com uma atividade de revisão.", note:"Revise as respostas e confira as fontes de acordo com seu contexto profissional.",
  areasLabel:"Feito para o seu contexto", areasTitle:"Uma plataforma, diferentes caminhos.", areasText:"Explore possibilidades para sua prática, seu ensino e sua pesquisa.", demoLabel:"Experimente uma ideia", demoTitle:"Veja por onde começar.", demoText:"Selecione um contexto para conhecer uma possibilidade de uso. Os exemplos são ilustrativos.", prompt:"Uma pergunta possível", result:"Um caminho para explorar",
  educationLabel:"Aprender juntos", educationTitle:"A sala de aula também pode ir além.", educationText:"Professores podem organizar atividades com agentes. Estudantes acessam salas virtuais ou provas OSCE com as informações fornecidas pelo professor.", room:"Sala virtual", roomText:"Entre em uma aula com o PIN recebido.", pin:"PIN da sala", pinGo:"Acessar sala", osceText:"Acesse uma prova com as informações recebidas do professor.", osce:"Entrar no OSCE",
  toolsLabel:"Construa seu caminho", toolsTitle:"Seu conhecimento pode fazer parte da conversa.", toolsText:"Crie agentes personalizados, utilize bases de conhecimento e conecte etapas em fluxos de agentes.", toolsLink:"Conhecer a documentação", ctaTitle:"Comece com uma pergunta.", ctaText:"Encontre um agente para seu próximo desafio ou crie sua conta para explorar a plataforma.", pricing:"Planos e créditos", docs:"Documentação", contact:"Contato", privacy:"Privacidade", terms:"Termos", cookies:"Cookies", agents:"Agentes", flows:"Fluxos",
  areas:[{title:"Saúde",desc:"Explore questões da prática clínica e farmacêutica com agentes especializados.",question:"Como organizar uma discussão sobre interações medicamentosas?",answer:"Estruture o contexto, identifique pontos de atenção e prepare perguntas para revisão."},{title:"Educação",desc:"Prepare atividades, planos de aula e experiências de aprendizagem.",question:"Como planejar uma atividade baseada em um caso clínico?",answer:"Comece pelos objetivos, desenvolva o caso e proponha uma discussão em grupo."},{title:"Pesquisa",desc:"Organize ideias e explore etapas do trabalho acadêmico.",question:"Como estruturar as próximas etapas de um projeto de pesquisa?",answer:"Organize a pergunta, os objetivos e os pontos que precisam de investigação."}]
 },
 en: {
  eyebrow:"AI for health, education and research", title:"Knowledge in motion.", intro:"Specialized agents to explore questions, prepare lessons and develop ideas with greater clarity.", start:"Create a free account", explore:"Explore agents", access:"Join an activity", scroll:"Scroll to discover",
  sceneLabel:"One conversation, new possibilities", sceneTitle:"From a question to the next step.", sceneText:"Choose an agent, share your context and organize the conversation around what matters to you.", example:"Illustrative example", question:"How can I structure a lesson about drug interactions?", answerTitle:"A structure to get started", answer:"Define learning objectives, present a case and propose discussion questions. Finish with a review activity.", note:"Review responses and check sources for your professional context.",
  areasLabel:"Made for your context", areasTitle:"One platform, different paths.", areasText:"Explore possibilities for your practice, teaching and research.", demoLabel:"Try an idea", demoTitle:"See where to begin.", demoText:"Choose a context to explore a possible use. These examples are illustrative.", prompt:"A possible question", result:"A path to explore",
  educationLabel:"Learn together", educationTitle:"Take the classroom further.", educationText:"Teachers can organize activities with agents. Students can join virtual rooms or OSCE exams using information provided by their teacher.", room:"Virtual room", roomText:"Join a class with the PIN you received.", pin:"Room PIN", pinGo:"Join room", osceText:"Join an exam with the information provided by your teacher.", osce:"Join OSCE",
  toolsLabel:"Build your path", toolsTitle:"Your knowledge can be part of the conversation.", toolsText:"Create custom agents, use knowledge bases and connect steps in agent workflows.", toolsLink:"Read the documentation", ctaTitle:"Start with a question.", ctaText:"Find an agent for your next challenge or create an account to explore the platform.", pricing:"Plans and credits", docs:"Documentation", contact:"Contact", privacy:"Privacy", terms:"Terms", cookies:"Cookies", agents:"Agents", flows:"Workflows",
  areas:[{title:"Health",desc:"Explore clinical and pharmaceutical questions with specialized agents.",question:"How can I organize a discussion about drug interactions?",answer:"Structure the context, identify points of attention and prepare questions for review."},{title:"Education",desc:"Prepare activities, lesson plans and learning experiences.",question:"How can I plan an activity based on a clinical case?",answer:"Start with objectives, develop the case and propose a group discussion."},{title:"Research",desc:"Organize ideas and explore stages of academic work.",question:"How can I structure the next stages of a research project?",answer:"Organize the question, objectives and points requiring investigation."}]
 },
 es: {
  eyebrow:"IA para salud, educación e investigación", title:"Conocimiento en movimiento.", intro:"Agentes especializados para explorar preguntas, preparar clases y desarrollar ideas con mayor claridad.", start:"Crear cuenta gratuita", explore:"Explorar agentes", access:"Entrar a una actividad", scroll:"Desplázate para descubrir",
  sceneLabel:"Una conversación, nuevas posibilidades", sceneTitle:"De la pregunta al siguiente paso.", sceneText:"Elige un agente, comparte tu contexto y organiza la conversación en torno a lo que te importa.", example:"Ejemplo ilustrativo", question:"¿Cómo puedo estructurar una clase sobre interacciones medicamentosas?", answerTitle:"Una estructura para empezar", answer:"Define los objetivos de aprendizaje, presenta un caso y propone preguntas para debatir. Termina con una actividad de revisión.", note:"Revisa las respuestas y comprueba las fuentes según tu contexto profesional.",
  areasLabel:"Para tu contexto", areasTitle:"Una plataforma, distintos caminos.", areasText:"Explora posibilidades para tu práctica, enseñanza e investigación.", demoLabel:"Prueba una idea", demoTitle:"Descubre por dónde empezar.", demoText:"Selecciona un contexto para conocer una posibilidad de uso. Los ejemplos son ilustrativos.", prompt:"Una pregunta posible", result:"Un camino para explorar",
  educationLabel:"Aprender juntos", educationTitle:"El aula también puede ir más allá.", educationText:"Los profesores pueden organizar actividades con agentes. Los estudiantes acceden a salas virtuales o pruebas OSCE con los datos proporcionados por su profesor.", room:"Sala virtual", roomText:"Entra a una clase con el PIN recibido.", pin:"PIN de la sala", pinGo:"Entrar a la sala", osceText:"Accede a una prueba con los datos proporcionados por tu profesor.", osce:"Entrar al OSCE",
  toolsLabel:"Construye tu camino", toolsTitle:"Tu conocimiento puede formar parte de la conversación.", toolsText:"Crea agentes personalizados, utiliza bases de conocimiento y conecta etapas en flujos de agentes.", toolsLink:"Ver la documentación", ctaTitle:"Comienza con una pregunta.", ctaText:"Encuentra un agente para tu próximo desafío o crea una cuenta para explorar la plataforma.", pricing:"Planes y créditos", docs:"Documentación", contact:"Contacto", privacy:"Privacidad", terms:"Términos", cookies:"Cookies", agents:"Agentes", flows:"Flujos",
  areas:[{title:"Salud",desc:"Explora cuestiones clínicas y farmacéuticas con agentes especializados.",question:"¿Cómo organizar una discusión sobre interacciones medicamentosas?",answer:"Estructura el contexto, identifica puntos de atención y prepara preguntas para revisar."},{title:"Educación",desc:"Prepara actividades, planes de clase y experiencias de aprendizaje.",question:"¿Cómo planear una actividad basada en un caso clínico?",answer:"Empieza por los objetivos, desarrolla el caso y propone una discusión en grupo."},{title:"Investigación",desc:"Organiza ideas y explora etapas del trabajo académico.",question:"¿Cómo estructurar las siguientes etapas de un proyecto de investigación?",answer:"Organiza la pregunta, los objetivos y los puntos que necesitan investigación."}]
 }
};
type Copy = typeof text.pt;

function MatrixRain() {
 const canvas = useRef<HTMLCanvasElement>(null);
 useEffect(() => {
  const el = canvas.current; if (!el) return;
  const ctx = el.getContext("2d"); if (!ctx) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer = 0; let columns: number[] = [];
  const resize = () => { el.width = el.clientWidth; el.height = el.clientHeight; columns = Array.from({length: Math.ceil(el.width / 24)}, () => Math.random() * -40); };
  const draw = () => {
   ctx.fillStyle = "rgba(2, 9, 13, .12)"; ctx.fillRect(0, 0, el.width, el.height); ctx.font = "14px monospace";
   columns.forEach((y, i) => { ctx.fillStyle = i % 7 === 0 ? "rgba(157,255,231,.7)" : "rgba(50,198,156,.4)"; ctx.fillText("01アイウエカキクケコ+<>".charAt(Math.floor(Math.random()*15)), i*24, y*21); if (y*21 > el.height && Math.random() > .975) columns[i] = 0; else columns[i] += .65; });
  };
  resize(); if (!reduced.matches) timer = window.setInterval(draw, 65);
  window.addEventListener("resize", resize);
  return () => { window.clearInterval(timer); window.removeEventListener("resize", resize); };
 }, []);
 return <canvas ref={canvas} className="matrix-rain" aria-hidden="true"/>;
}

const processCopy = {
 pt: { label: "Fluxo ilustrativo", steps: ["Sua pergunta", "Agente organiza", "Próximo passo"], build: ["Contexto", "Caso", "Atividade"], tools: ["Conhecimento", "Agente", "Fluxo"] },
 en: { label: "Illustrative workflow", steps: ["Your question", "Agent organizes", "Next step"], build: ["Context", "Case", "Activity"], tools: ["Knowledge", "Agent", "Workflow"] },
 es: { label: "Flujo ilustrativo", steps: ["Tu pregunta", "Agente organiza", "Siguiente paso"], build: ["Contexto", "Caso", "Actividad"], tools: ["Conocimiento", "Agente", "Flujo"] },
};

function Process({ label, steps, variant = "flow" }: { label: string; steps: string[]; variant?: "flow" | "build" }) {
 return <div className={"process-visual process-" + variant} aria-label={label}>
  <span className="process-caption">{label}</span>
  <div className="process-track">{steps.map((step, i) => <div className="process-step" key={step}><span className="process-node">{i === 1 ? <Pill size={16}/> : <span/>}</span><span>{step}</span></div>)}</div>
 </div>;
}

function Story({ c }: { c: Copy }) {
 const section = useRef<HTMLElement>(null);
 useEffect(() => {
  const el = section.current; if (!el) return;
  let frame = 0;
  const update = () => { frame = 0; const rect = el.getBoundingClientRect(); const distance = rect.height - window.innerHeight; const progress = distance > 0 ? Math.max(0, Math.min(1, -rect.top / distance)) : 0; el.style.setProperty("--story-progress", String(progress)); el.style.setProperty("--story-lift", ((1-progress)*55)+"px"); el.style.setProperty("--story-scale", String(.82+progress*.18)); el.style.setProperty("--portal-scale", String(.65+progress*1.15)); el.style.setProperty("--story-opacity", String(.65+progress*.35)); el.style.setProperty("--portal-opacity", String(.85-progress*.42)); };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  update(); window.addEventListener("scroll", schedule, {passive:true}); window.addEventListener("resize", schedule);
  return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
 }, []);
 return <section ref={section} className="landing-story" id="como-funciona"><div className="landing-story-stage"><div className="story-portal" aria-hidden="true"><i/><i/><i/><i/></div><div className="story-grid" aria-hidden="true"/><div className="landing-story-inner"><div className="landing-story-copy"><p className="landing-kicker">{c.sceneLabel}</p><h2>{c.sceneTitle}</h2><p>{c.sceneText}</p></div><div className="landing-story-visual"><div className="landing-conversation"><div className="landing-conversation-head"><div className="landing-agent-icon"><Pill size={18}/></div><div><strong>Agentes Posológicos</strong><span>{c.example}</span></div><span className="landing-conversation-dots">•••</span></div><div className="landing-conversation-body"><div className="landing-question">{c.question}</div><div className="landing-answer"><span className="landing-answer-icon"><MessageCircle size={17}/></span><div><strong>{c.answerTitle}</strong><p>{c.answer}</p></div></div><p className="landing-note">{c.note}</p></div></div></div></div></div></section>;
}

export default function Landing() {
 const {locale} = useLanguage(); const c = text[locale] || text.pt; const process = processCopy[locale] || processCopy.pt; const navigate = useNavigate();
 const [area,setArea] = useState(0); const [pin,setPin] = useState(""); const icons = [Stethoscope,GraduationCap,FlaskConical];
 return <div className="landing-page">
  <SEO title="Agentes Posológicos — IA para Saúde, Educação e Pesquisa" description="Agentes de IA para prática clínica, ensino em saúde e pesquisa." path="/" />
  <MatrixRain/>
  <header className="landing-header"><div className="landing-nav"><Link to="/" className="landing-brand"><span><Pill size={15}/></span>Agentes Posológicos</Link><nav aria-label="Navigation"><a href="#areas">{c.areasLabel}</a><a href="#access">{c.access}</a><Link to="/precos">{c.pricing}</Link></nav><div className="landing-header-actions"><LanguageSelector/><FloatingAuth/></div></div></header>
  <main>
   <section className="landing-hero"><div className="landing-hero-glow" aria-hidden="true"/><div className="hero-orbit" aria-hidden="true"><i/><i/><i/><span/></div><div className="landing-hero-content"><div className="hero-copy"><p className="landing-kicker">{c.eyebrow}</p><h1>{c.title}</h1><p className="landing-hero-intro">{c.intro}</p><div className="landing-actions"><Link className="landing-button landing-button-primary" to="/signup">{c.start}</Link><Link className="landing-button landing-button-secondary" to="/vitrine">{c.explore}</Link></div></div><div className="hero-access"><div className="hero-access-heading"><span className="hero-pulse"/><span>{c.access}</span></div><form onSubmit={e=>{e.preventDefault(); if(pin.trim()) navigate("/sala/"+encodeURIComponent(pin.trim()));}}><div className="hero-card-top"><span className="hero-icon"><MessageCircle size={22}/></span><span>LIVE</span></div><h2>{c.room}</h2><p>{c.roomText}</p><label htmlFor="landing-pin">{c.pin}</label><div className="landing-pin-row"><input id="landing-pin" value={pin} onChange={e=>setPin(e.target.value)} required/><button type="submit">{c.pinGo}</button></div></form><Link className="hero-osce" to="/osce/entrar"><div className="hero-card-top"><span className="hero-icon"><Stethoscope size={22}/></span><span>OSCE</span></div><h2>OSCE Virtual</h2><p>{c.osceText}</p><span className="hero-osce-action">{c.osce} <span aria-hidden="true">↗</span></span></Link></div></div><div className="landing-hero-bottom"><span>{c.scroll}</span><span aria-hidden="true">↓</span><span>Agentes Posológicos</span></div></section>
   <Story c={c}/>
   <section className="landing-section landing-areas" id="areas"><div className="landing-section-heading"><div><p className="landing-kicker">{c.areasLabel}</p><h2>{c.areasTitle}</h2></div><p>{c.areasText}</p></div><div className="landing-area-grid">{c.areas.map((item,i) => {const Icon=icons[i]; return <article key={item.title}><Icon size={25} strokeWidth={1.5}/><h3>{item.title}</h3><p>{item.desc}</p></article>;})}</div><LandingSquad locale={locale}/></section>
   <section className="landing-section landing-demo"><div className="landing-demo-intro"><p className="landing-kicker">{c.demoLabel}</p><h2>{c.demoTitle}</h2><p>{c.demoText}</p><div className="landing-tabs" aria-label={c.demoLabel}>{c.areas.map((item,i)=><button key={item.title} type="button" aria-pressed={area===i} onClick={()=>setArea(i)}>{item.title}</button>)}</div><Process label={process.label} steps={process.steps} variant="build"/></div><div className="landing-demo-card" aria-live="polite"><span>{c.example}</span><div><small>{c.prompt}</small><p>{c.areas[area].question}</p></div><div><small>{c.result}</small><p>{c.areas[area].answer}</p></div><Link to="/vitrine">{c.explore}</Link></div></section>
   <section className="landing-section landing-education" id="access"><div><p className="landing-kicker">{c.educationLabel}</p><h2>{c.educationTitle}</h2><p>{c.educationText}</p><Process label={c.example} steps={process.build} variant="build"/></div><div className="education-portal"><div className="education-portal-ring" aria-hidden="true"/><div className="education-portal-content"><span className="hero-pulse"/><h3>{c.room} &amp; OSCE</h3><p>{c.educationText}</p><a className="landing-inline-link" href="#landing-pin">{c.access}</a></div></div></section>
   <section className="landing-section landing-tools"><div className="landing-tools-visual" aria-hidden="true"><div><BookOpen/><span>{process.tools[0]}</span></div><div><Pill/><span>{process.tools[1]}</span></div><div><Workflow/><span>{process.tools[2]}</span></div></div><div><p className="landing-kicker">{c.toolsLabel}</p><h2>{c.toolsTitle}</h2><p>{c.toolsText}</p><Link className="landing-inline-link" to="/docs">{c.toolsLink}</Link></div></section>
   <section className="landing-final"><p className="landing-kicker">Agentes Posológicos</p><h2>{c.ctaTitle}</h2><p>{c.ctaText}</p><div className="landing-actions"><Link className="landing-button landing-button-primary" to="/signup">{c.start}</Link><Link className="landing-button landing-button-secondary" to="/vitrine">{c.explore}</Link></div></section>
  </main>
  <footer className="landing-footer"><Link to="/" className="landing-brand"><span><Pill size={15}/></span>Agentes Posológicos</Link><div><Link to="/precos">{c.pricing}</Link><Link to="/docs">{c.docs}</Link><Link to="/fale-conosco">{c.contact}</Link><Link to="/privacidade">{c.privacy}</Link><Link to="/termos">{c.terms}</Link><Link to="/cookies">{c.cookies}</Link></div><p>© {new Date().getFullYear()} Agentes Posológicos · Posologia Produções</p></footer><SalesAgentWidget/>
 </div>;
}
