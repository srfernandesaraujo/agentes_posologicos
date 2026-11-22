import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FlaskConical,
  GraduationCap,
  Megaphone,
  Pill,
  Stethoscope,
} from "lucide-react";
import { useForceDark } from "@/contexts/NewUIContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { FloatingAuth } from "@/components/auth/FloatingAuth";
import { SalesAgentWidget } from "@/components/sales/SalesAgentWidget";
import { SEO } from "@/components/seo/SEO";
import { landingCopy, type LandingLocale } from "@/components/landing/landingCopy";
import { MolecularField } from "@/components/landing/MolecularField";
import { HeroSection } from "@/components/landing/HeroSection";
import { ClinicalStorySection } from "@/components/landing/ClinicalStorySection";
import { InteractiveDemoSection } from "@/components/landing/InteractiveDemoSection";
import { ProductShowcaseBento } from "@/components/landing/ProductShowcaseBento";
import { WorkflowGraphSection } from "@/components/landing/WorkflowGraphSection";
import { AuthorityVideoSection } from "@/components/landing/AuthorityVideoSection";
import { ShowreelModal } from "@/components/landing/ShowreelModal";
import { Reveal } from "@/components/landing/Reveal";
import { DoseTrySection } from "@/components/landing/DoseTrySection";
import { LandingSquad } from "./LandingSquad";
import "./Landing.css";

const PILLAR_ICONS = [Stethoscope, GraduationCap, FlaskConical, Megaphone];

export default function Landing() {
  useForceDark();
  const { locale } = useLanguage();
  const safeLocale: LandingLocale = locale === "en" || locale === "es" ? locale : "pt";
  const c = landingCopy[safeLocale];
  const [showreelOpen, setShowreelOpen] = useState(false);

  // Barra de curva ligada à rolagem (CSS var, sem re-render)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--lp-scroll", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--lp-scroll");
    };
  }, []);

  const spot = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div className="landing-page">
      <SEO title={c.seoTitle} description={c.seoDesc} path="/" />

      {/* Bio-precision molecular & pharmacokinetic canvas */}
      <MolecularField />

      <div className="lp-scroll-curve" aria-hidden="true"><span /></div>

      <header className="lp-header">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-brand-mark">
              <Pill size={15} />
            </span>
            <span>Agentes Posológicos</span>
          </Link>

          <nav className="lp-nav-links" aria-label="Navegação principal">
            <a href="#como-funciona">{c.nav.story}</a>
            <a href="#demo">{c.nav.demo}</a>
            <a href="#squads">{c.nav.squads}</a>
            <a href="#recursos">{c.nav.showcase}</a>
            <Link to="/precos">{c.nav.pricing}</Link>
          </nav>

          <div className="lp-header-actions">
            <LanguageSelector />
            <FloatingAuth />
          </div>
        </div>
      </header>

      <main className="lp-main">
        <HeroSection c={c.hero} onOpenShowreel={() => setShowreelOpen(true)} />

        <ClinicalStorySection c={c.story} />

        {/* Four specialized domain pillars + Interactive Pixel-Art Squad Studio */}
        <section className="lp-section lp-pillars-section" id="areas">
          <Reveal>
            <div className="lp-section-head">
              <div>
                <p className="lp-kicker">{c.pillars.kicker}</p>
                <h2 className="lp-section-title">{c.pillars.title}</h2>
              </div>
              <p className="lp-section-sub">{c.pillars.subtitle}</p>
            </div>
          </Reveal>

          <div className="lp-pillars-grid">
            {c.pillars.items.map((item, i) => {
              const Icon = PILLAR_ICONS[i] || Stethoscope;
              return (
                <Reveal key={item.title} delay={i * 75}>
                  <article className={`lp-pillar-card lp-pillar-${item.tone}`} onMouseMove={spot}>
                    <div className="lp-pillar-top">
                      <span className="lp-pillar-icon">
                        <Icon size={21} strokeWidth={1.65} />
                      </span>
                      <span className="lp-pillar-tag">{item.tag}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                    <div className="lp-pillar-chips">
                      {item.metrics.map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={120}>
            <LandingSquad locale={safeLocale} />
          </Reveal>
        </section>

        <DoseTrySection locale={safeLocale} />

        <InteractiveDemoSection c={c.demo} />

        <ProductShowcaseBento c={c.showcase} />

        <WorkflowGraphSection c={c.workflow} />

        <AuthorityVideoSection c={c.authority} />

        <section className="lp-final">
          <div className="lp-final-halo" aria-hidden="true" />
          <Reveal>
            <div className="lp-final-inner">
              <p className="lp-kicker">{c.finalCta.kicker}</p>
              <h2>{c.finalCta.title}</h2>
              <p>{c.finalCta.text}</p>
              <div className="lp-final-actions">
                <Link className="lp-btn lp-btn-primary" to="/signup">
                  <span>{c.finalCta.primary}</span>
                  <ArrowRight size={16} />
                </Link>
                <Link className="lp-btn lp-btn-secondary" to="/precos">
                  {c.finalCta.secondary}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-brand-mark">
              <Pill size={15} />
            </span>
            <span>Agentes Posológicos</span>
          </Link>

          <div className="lp-footer-links">
            <Link to="/vitrine">{c.footer.vitrine}</Link>
            <Link to="/precos">{c.footer.pricing}</Link>
            <Link to="/docs">{c.footer.docs}</Link>
            <Link to="/fale-conosco">{c.footer.contact}</Link>
            <Link to="/privacidade">{c.footer.privacy}</Link>
            <Link to="/termos">{c.footer.terms}</Link>
            <Link to="/cookies">{c.footer.cookies}</Link>
          </div>

          <p className="lp-footer-copy">
            © {new Date().getFullYear()} Agentes Posológicos · Posologia Produções
          </p>
        </div>
      </footer>

      <ShowreelModal open={showreelOpen} onOpenChange={setShowreelOpen} c={c.showreel} />
      <SalesAgentWidget />
    </div>
  );
}
