import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, Pill, Shield, Zap, Brain, BarChart3, DoorOpen, Wrench, Stethoscope, Smartphone, Workflow } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { FloatingAuth } from "@/components/auth/FloatingAuth";
import { SalesAgentWidget } from "@/components/sales/SalesAgentWidget";
import { SEO } from "@/components/seo/SEO";
import landingAvatar from "@/assets/landing-avatar.png";

/* ---------- Cinematic avatar layer ----------
 * Fixed full-viewport canvas with:
 *  - scroll-driven scale + vertical drift (avatar approaches as you scroll)
 *  - mouse parallax (drag/lag effect on pointer move)
 *  - cross-fading text overlays per scroll act
 */
const ACTS: { id: string; eyebrow: string; title: React.ReactNode; body?: string; align?: "left" | "right" | "center" }[] = [
  {
    id: "act-1",
    eyebrow: "[ ORIGEM ]",
    title: <>SINTA<br />ANTES DE VER</>,
    body: "Agentes de IA que traduzem dados clínicos densos em decisões claras — para você, para o paciente, para a sala de aula.",
    align: "right",
  },
  {
    id: "act-2",
    eyebrow: "[ PRESENÇA ]",
    title: <>FÉ AGNÓSTICA<br />NA EVIDÊNCIA</>,
    body: "Cada resposta é ancorada em literatura, diretrizes e contexto. Nenhum palpite. Nenhum ruído.",
    align: "right",
  },
  {
    id: "act-3",
    eyebrow: "[ ABSORÇÃO ]",
    title: <>ABSORVENDO<br />A REALIDADE</>,
    body: "Sua prescrição, seu protocolo, seu plano de aula, seus dados de pesquisa — entram, viram sinal.",
    align: "center",
  },
  {
    id: "act-4",
    eyebrow: "[ SINAL ]",
    title: <>ISOLANDO SINAIS<br />DO RUÍDO</>,
    body: "Dois lados da mesma entidade: a especialidade do profissional e a precisão do agente.",
    align: "center",
  },
  {
    id: "act-5",
    eyebrow: "[ ENGENHARIA ]",
    title: <>ENGENHARIA<br />DO INVISÍVEL</>,
    body: "Pixels brutos viram nuances. Fragmentos viram contexto. Contexto vira ação de alto valor clínico, didático e científico.",
    align: "right",
  },
];

function CinematicAvatar() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const overlaysRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    const overlays = overlaysRef.current;
    if (!wrap || !img || !overlays) return;

    const compute = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress 0..1 across the cinematic section
      const total = rect.height - vh;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      // Avatar approaches: scale 0.55 -> 1.55, drifts slightly down
      const scale = 0.55 + p * 1.0;
      const ty = -40 + p * 60;
      // Lerp mouse for drag feel
      mouse.current.tx += (mouse.current.x - mouse.current.tx) * 0.08;
      mouse.current.ty += (mouse.current.y - mouse.current.ty) * 0.08;
      const mx = mouse.current.tx * 40 * (1 - p * 0.4);
      const my = mouse.current.ty * 30 * (1 - p * 0.4);
      img.style.transform = `translate3d(${mx}px, ${ty + my}px, 0) scale(${scale})`;

      // Cross-fade overlays based on per-act windows
      const acts = overlays.querySelectorAll<HTMLElement>("[data-act]");
      const n = acts.length;
      acts.forEach((el, i) => {
        const center = (i + 0.5) / n;
        const dist = Math.abs(p - center);
        const window_ = 0.5 / n;
        const opacity = Math.max(0, 1 - dist / window_);
        const lift = (1 - opacity) * 30;
        el.style.opacity = String(opacity);
        el.style.transform = `translateY(${lift}px)`;
        el.style.pointerEvents = opacity > 0.6 ? "auto" : "none";
      });

      raf.current = null;
    };

    const schedule = () => {
      if (raf.current == null) raf.current = requestAnimationFrame(compute);
    };

    const onMouse = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };

    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("mousemove", onMouse, { passive: true });
    // continuous loop for smooth mouse lerp
    let loop = 0;
    const tick = () => {
      schedule();
      loop = requestAnimationFrame(tick);
    };
    loop = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("mousemove", onMouse);
      cancelAnimationFrame(loop);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <section ref={wrapRef} className="relative" style={{ height: "500vh" }}>
      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Aurora light streaks */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 50% 110%, rgba(20,184,166,0.18) 0%, transparent 55%), radial-gradient(80% 50% at 80% 20%, rgba(56,189,248,0.18) 0%, transparent 60%), radial-gradient(60% 40% at 10% 30%, rgba(168,85,247,0.14) 0%, transparent 60%)",
          }}
        />
        {/* Light streaks */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, rgba(125,211,252,0.25) 45%, rgba(125,211,252,0.05) 48%, transparent 60%), linear-gradient(100deg, transparent 40%, rgba(192,132,252,0.18) 52%, transparent 65%)",
            filter: "blur(6px)",
          }}
        />

        {/* Avatar (LCP-style) */}
        <div
          ref={imgRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
          style={{ width: "min(82vh, 90vw)", height: "min(82vh, 90vw)", transition: "transform 0.08s linear" }}
        >
          <img
            src={landingAvatar}
            alt="Agente de IA — avatar simbólico"
            width={1024}
            height={1024}
            className="h-full w-full object-contain drop-shadow-[0_30px_80px_rgba(56,189,248,0.25)]"
            draggable={false}
          />
        </div>

        {/* Side rail */}
        <div className="pointer-events-none absolute left-4 md:left-8 top-1/2 -translate-y-1/2 flex flex-col gap-12 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          <div>
            <p className="text-white/70">[ ORIGEM ]</p>
            <p className="mt-2 max-w-[140px] leading-relaxed">A fundação da nossa realidade, propósito e capacidades.</p>
          </div>
          <div className="flex flex-col gap-3 border-l border-white/10 pl-4">
            <span className="text-white">INTRO</span>
            <span>PRESENÇA</span>
            <span>SINAL</span>
          </div>
        </div>
        <div className="pointer-events-none absolute right-4 md:right-8 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40 [writing-mode:vertical-rl] rotate-180">
          PORTFÓLIO · AGENTES POSOLÓGICOS
        </div>

        {/* Text overlays */}
        <div ref={overlaysRef} className="absolute inset-0">
          {ACTS.map((a) => (
            <div
              key={a.id}
              data-act
              className="absolute inset-0 flex items-center px-6 md:px-20"
              style={{ opacity: 0, transition: "opacity 0.3s ease, transform 0.5s ease" }}
            >
              <div
                className={`max-w-2xl ${
                  a.align === "right" ? "ml-auto text-left" : a.align === "center" ? "mx-auto text-center" : "text-left"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/60 mb-6">{a.eyebrow}</p>
                <h2 className="font-display font-black uppercase leading-[0.92] tracking-[-0.02em] text-[clamp(2.5rem,7vw,6rem)] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
                  {a.title}
                </h2>
                {a.body && (
                  <p className="mt-6 font-mono text-[11px] md:text-[12px] uppercase tracking-[0.16em] leading-[1.8] text-white/70 max-w-md">
                    {a.body}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.style.animationPlayState = "running";
            el.classList.add("opacity-100");
            el.classList.remove("opacity-0");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`opacity-0 animate-sw-rise ${className}`}
      style={{ animationDelay: `${delay}ms`, animationPlayState: "paused" }}
    >
      {children}
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const { t } = useLanguage();

  const FEATURES = [
    { icon: Brain, title: t("feature.specialized"), description: t("feature.specialized.desc") },
    { icon: Wrench, title: t("feature.custom"), description: t("feature.custom.desc") },
    { icon: Stethoscope, title: t("feature.virtual"), description: t("feature.virtual.desc") },
    { icon: Smartphone, title: t("feature.whatsapp"), description: t("feature.whatsapp.desc") },
    { icon: Shield, title: t("feature.rag"), description: t("feature.rag.desc") },
    { icon: Zap, title: t("feature.structured"), description: t("feature.structured.desc") },
    { icon: Workflow, title: "Rede de Agentes (Fluxos)", description: "Encadeie múltiplos agentes em pipelines interativos. Cada etapa alimenta a próxima, com pausas inteligentes para perguntas e exportação em PDF ao final." },
    { icon: BarChart3, title: "Dashboard Analítico", description: "Painel completo com saldo de créditos, conversas recentes, agentes criados e bases de conhecimento — tudo em uma visão rápida." },
  ];

  const CATEGORIES = [
    { color: "hsl(199,89%,48%)", name: t("cat.clinical"), agents: ["Interações Cardiovasculares", "Antibioticoterapia", "Educador Clínico"] },
    { color: "hsl(174,62%,47%)", name: t("cat.edtech"), agents: ["Metodologias Ativas", "Simulador Clínico", "Analisador de Turma"] },
    { color: "hsl(262,52%,56%)", name: t("cat.research"), agents: ["Editais de Fomento", "Análise Estatística"] },
    { color: "hsl(38,92%,50%)", name: t("cat.content"), agents: ["SEO para YouTube", "Fact-Checker de Saúde"] },
  ];

  const STATS = [
    { value: "10+", label: t("landing.stats.agents") },
    { value: "5", label: t("landing.stats.providers") },
    { value: "∞", label: t("landing.stats.custom") },
    { value: "RAG", label: t("landing.stats.rag") },
    { value: "Fluxos", label: "Pipelines de agentes encadeados" },
  ];

  const handlePinAccess = () => {
    if (pin.trim().length >= 4) {
      navigate(`/sala/${pin.trim()}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black antialiased">
      <SEO
        title="Agentes Posológicos — IA para Saúde, Educação e Pesquisa"
        description="Plataforma de agentes de IA especializados em prática clínica, farmácia, ensino em saúde, pesquisa acadêmica e produção de conteúdo. Crie sua conta gratuita."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Agentes Posológicos",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        }}
      />
      {/* Subtle grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.7'/></svg>\")",
        }}
      />

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1440px] flex h-14 items-center justify-between px-6 md:px-10 font-mono text-[11px] uppercase tracking-[0.18em]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-5 w-5 rounded-[5px] bg-white grid place-items-center">
              <Pill className="h-3 w-3 text-black" />
            </div>
            <span className="text-white">Agentes Posológicos<span className="text-white/40">®</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-white/50">
            <a href="#index" className="hover:text-white transition-colors">Índice</a>
            <a href="#capabilities" className="hover:text-white transition-colors">Capacidades</a>
            <a href="#agents" className="hover:text-white transition-colors">Agentes</a>
            <a href="#access" className="hover:text-white transition-colors">Acesso</a>
          </nav>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <FloatingAuth />
          </div>
        </div>
      </header>

      <main className="relative z-[2] pt-14">
        {/* Hero */}
        <section className="relative min-h-[100svh] flex flex-col justify-between overflow-hidden">
          {/* breathing orb */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 h-[680px] w-[680px] rounded-full animate-sw-orb"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18) 0%, rgba(56,189,248,0.12) 28%, rgba(20,184,166,0.08) 48%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          {/* Top meta line */}
          <div className="relative mx-auto w-full max-w-[1440px] px-6 md:px-10 pt-10 grid grid-cols-2 md:grid-cols-3 gap-6 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 animate-sw-fade">
            <span>[ V.2026 / PT-BR ]</span>
            <span className="hidden md:block text-center">Plataforma de Agentes de IA</span>
            <span className="text-right">Saúde · Educação · Pesquisa</span>
          </div>

          {/* Headline */}
          <div className="relative mx-auto w-full max-w-[1440px] px-6 md:px-10 py-24 md:py-32 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/40 mb-10 animate-sw-fade">
              ✦ &nbsp; {t("landing.subtitle")} &nbsp; ✦
            </p>
            <h1 className="font-display font-light leading-[0.92] tracking-[-0.04em] text-[clamp(3rem,11vw,11rem)] animate-sw-rise">
              <span className="block italic font-serif text-white/95">{t("landing.hero.title1")}.</span>
              <span className="block font-bold uppercase">{t("landing.hero.title2")}</span>
            </h1>

            <p className="mx-auto max-w-xl text-base md:text-lg text-white/55 mt-12 leading-relaxed animate-sw-fade" style={{ animationDelay: "300ms" }}>
              {t("landing.hero.desc")}
            </p>

            <div className="mt-14 flex items-center justify-center gap-3 animate-sw-fade" style={{ animationDelay: "500ms" }}>
              <Link to="/signup">
                <Button className="group h-12 rounded-full bg-white text-black hover:bg-white/90 px-7 text-[12px] font-mono uppercase tracking-[0.2em] gap-3">
                  {t("landing.cta")}
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-black text-white transition-transform group-hover:rotate-45">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost" className="h-12 rounded-full border border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white px-7 text-[12px] font-mono uppercase tracking-[0.2em]">
                  {t("landing.login")}
                </Button>
              </Link>
            </div>
          </div>

          {/* Bottom scroll cue */}
          <div className="relative mx-auto w-full max-w-[1440px] px-6 md:px-10 pb-8 flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-white/35 animate-sw-fade" style={{ animationDelay: "700ms" }}>
            <span>Role para descobrir</span>
            <div className="h-px w-24 md:w-64 bg-white/15" />
            <span>↓ 001</span>
          </div>
        </section>

        {/* Marquee strip */}
        <section className="border-y border-white/[0.06] overflow-hidden py-5">
          {/* Cinematic scroll act injected above marquee */}
        </section>
        <CinematicAvatar />
        <section className="border-y border-white/[0.06] overflow-hidden py-5">
          <div className="flex whitespace-nowrap animate-sw-marquee font-display italic text-3xl md:text-5xl text-white/70">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center shrink-0 pr-12 gap-12">
                <span>Clínica</span><span className="text-white/20">✦</span>
                <span className="font-bold not-italic uppercase">Farmácia</span><span className="text-white/20">✦</span>
                <span>Ensino</span><span className="text-white/20">✦</span>
                <span className="font-bold not-italic uppercase">Pesquisa</span><span className="text-white/20">✦</span>
                <span>Conteúdo</span><span className="text-white/20">✦</span>
                <span className="font-bold not-italic uppercase">Fluxos</span><span className="text-white/20">✦</span>
                <span>RAG</span><span className="text-white/20">✦</span>
              </div>
            ))}
          </div>
        </section>

        {/* Stats / Index */}
        <section id="index" className="border-b border-white/[0.06]">
          <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-24 grid lg:grid-cols-12 gap-10">
            <Reveal className="lg:col-span-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40 mb-6">[ 001 ] Índice</p>
              <h2 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
                <span className="italic font-serif font-light">A escala</span><br />
                <span className="font-bold uppercase">em números.</span>
              </h2>
            </Reveal>
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-5 gap-y-10 gap-x-6 self-end">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 80}>
                  <p className="font-display text-4xl md:text-5xl font-light text-white">{s.value}</p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 leading-relaxed">{s.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Features / Capabilities */}
        <section id="capabilities" className="border-b border-white/[0.06]">
          <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-28">
            <div className="grid lg:grid-cols-12 gap-10 mb-20">
              <Reveal className="lg:col-span-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40 mb-6">[ 002 ] Capacidades</p>
                <h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
                  <span className="italic font-serif font-light">Tudo o que</span><br />
                  <span className="font-bold uppercase">você precisa.</span>
                </h2>
              </Reveal>
              <Reveal delay={120} className="lg:col-span-5 lg:col-start-8 self-end">
                <p className="text-white/55 text-base md:text-lg leading-relaxed">{t("landing.features.desc")}</p>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 border-t border-white/[0.08]">
              {FEATURES.map((f, i) => (
                <Reveal
                  key={f.title}
                  delay={(i % 4) * 100}
                  className="group relative border-b border-white/[0.08] md:border-r md:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0 p-8 lg:p-10 hover:bg-white/[0.02] transition-colors min-h-[280px] flex flex-col"
                >
                  <div className="flex items-start justify-between mb-12">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                      {String(i + 1).padStart(3, "0")}
                    </span>
                    <f.icon className="h-5 w-5 text-white/40 group-hover:text-white transition-colors" strokeWidth={1.2} />
                  </div>
                  <h3 className="font-display text-2xl leading-tight tracking-tight mb-4 text-white">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed mt-auto">{f.description}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Categories / Agents */}
        <section id="agents" className="border-b border-white/[0.06]">
          <div className="mx-auto max-w-[1440px] px-6 md:px-10 py-28">
            <Reveal className="max-w-3xl mb-20">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40 mb-6">[ 003 ] Agentes</p>
              <h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
                <span className="italic font-serif font-light">Especialistas</span>{" "}
                <span className="font-bold uppercase">por domínio.</span>
              </h2>
              <p className="mt-8 text-white/55 text-base md:text-lg max-w-xl leading-relaxed">{t("landing.categories.desc")}</p>
            </Reveal>

            <div className="space-y-px bg-white/[0.06]">
              {CATEGORIES.map((cat, i) => (
                <Reveal key={cat.name} delay={i * 90}>
                  <div className="group grid grid-cols-12 items-center gap-6 bg-black hover:bg-white/[0.025] transition-colors px-2 md:px-6 py-8 md:py-10">
                    <div className="col-span-1 font-mono text-[11px] text-white/35">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="col-span-11 md:col-span-4 flex items-center gap-4">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color, boxShadow: `0 0 24px ${cat.color}` }} />
                      <h3 className="font-display text-2xl md:text-3xl tracking-tight text-white">{cat.name}</h3>
                    </div>
                    <div className="col-span-12 md:col-span-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                      {cat.agents.map((a) => (
                        <span key={a} className="before:content-['—_'] before:text-white/25">{a}</span>
                      ))}
                    </div>
                    <div className="hidden md:flex col-span-1 justify-end">
                      <ArrowUpRight className="h-5 w-5 text-white/30 group-hover:text-white group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" strokeWidth={1.2} />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Access / PIN */}
        <section id="access" className="border-b border-white/[0.06] relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute right-[-15%] top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full opacity-50"
            style={{
              background: "radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 60%)",
              filter: "blur(60px)",
            }}
          />
          <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 py-28 grid lg:grid-cols-12 gap-10 items-center">
            <Reveal className="lg:col-span-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40 mb-6">[ 004 ] Salas Virtuais</p>
              <h2 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
                <span className="italic font-serif font-light">Entre com</span><br />
                <span className="font-bold uppercase inline-flex items-center gap-4">
                  um PIN
                  <DoorOpen className="h-12 w-12 text-white/60" strokeWidth={1.2} />
                </span>
              </h2>
              <p className="mt-8 text-white/55 max-w-lg leading-relaxed">{t("landing.pin.desc")}</p>
            </Reveal>
            <Reveal delay={150} className="lg:col-span-5 lg:col-start-8">
              <div className="border border-white/10 bg-white/[0.02] p-6 md:p-8">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 mb-4">{t("landing.pin.title")}</p>
                <div className="flex flex-col gap-3">
                  <Input
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder={t("landing.pin.placeholder")}
                    className="h-14 border-0 border-b border-white/20 rounded-none bg-transparent text-white placeholder:text-white/30 font-mono text-2xl tracking-[0.4em] text-center px-0 focus-visible:ring-0 focus-visible:border-white"
                    onKeyDown={(e) => { if (e.key === "Enter") handlePinAccess(); }}
                  />
                  <Button
                    onClick={handlePinAccess}
                    disabled={pin.trim().length < 4}
                    className="h-12 rounded-full bg-white text-black hover:bg-white/90 font-mono text-[12px] uppercase tracking-[0.2em] gap-3 group"
                  >
                    {t("landing.pin.access")}
                    <span className="grid place-items-center h-7 w-7 rounded-full bg-black text-white transition-transform group-hover:rotate-45">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full animate-sw-orb"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(56,189,248,0.10) 30%, transparent 65%)",
              filter: "blur(50px)",
            }}
          />
          <div className="relative mx-auto max-w-[1440px] px-6 md:px-10 py-32 md:py-44 text-center">
            <Reveal>
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/40 mb-10">[ 005 ] Comece agora</p>
              <h2 className="font-display leading-[0.92] tracking-[-0.04em] text-[clamp(2.75rem,9vw,8rem)]">
                <span className="block italic font-serif font-light text-white/95">{t("landing.cta2.title")}</span>
              </h2>
              <p className="mt-10 mx-auto max-w-xl text-white/55 text-base md:text-lg leading-relaxed">{t("landing.cta2.desc")}</p>
              <div className="mt-14">
                <Link to="/signup">
                  <Button className="group h-14 rounded-full bg-white text-black hover:bg-white/90 px-10 text-[12px] font-mono uppercase tracking-[0.22em] gap-4">
                    {t("landing.signup")}
                    <span className="grid place-items-center h-8 w-8 rounded-full bg-black text-white transition-transform group-hover:rotate-45">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-[2] border-t border-white/[0.08]">
        <div className="container">
          <div className="py-16 grid grid-cols-2 md:grid-cols-4 gap-10 font-mono text-[11px] uppercase tracking-[0.18em]">
            <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-[5px] bg-white grid place-items-center">
                  <Pill className="h-3 w-3 text-black" />
                </div>
                <span className="text-white">Agentes Posológicos</span>
              </div>
              <p className="text-white/40 text-[11px] leading-relaxed normal-case tracking-normal font-sans">
                Agentes de IA especializados para profissionais de saúde, educadores e pesquisadores.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-white/40">Produto</h4>
              <Link to="/signup" className="text-white/70 hover:text-white transition-colors">Criar Conta</Link>
              <Link to="/login" className="text-white/70 hover:text-white transition-colors">Entrar</Link>
              <Link to="/precos" className="text-white/70 hover:text-white transition-colors">Créditos</Link>
              <Link to="/vitrine" className="text-white/70 hover:text-white transition-colors">Marketplace</Link>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-white/40">Recursos</h4>
              <Link to="/docs" className="text-white/70 hover:text-white transition-colors">Documentação</Link>
              <Link to="/fale-conosco" className="text-white/70 hover:text-white transition-colors">Contato</Link>
              <a href="#access" className="text-white/70 hover:text-white transition-colors">Salas Virtuais</a>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="text-white/40">Legal</h4>
              <Link to="/termos" className="text-white/70 hover:text-white transition-colors">Termos</Link>
              <Link to="/privacidade" className="text-white/70 hover:text-white transition-colors">Privacidade</Link>
              <Link to="/cookies" className="text-white/70 hover:text-white transition-colors">Cookies</Link>
            </div>
          </div>

          <div className="border-t border-white/[0.06] py-6 flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            <span>© {new Date().getFullYear()} Agentes Posológicos — {t("landing.footer.rights")}</span>
            <span>Sérgio Araújo · Posologia Produções</span>
          </div>
        </div>
      </footer>
      <SalesAgentWidget />
    </div>
  );
}
