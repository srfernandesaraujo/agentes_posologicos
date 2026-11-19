import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  Database,
  FileCheck2,
  Pill,
  ShieldAlert,
} from "lucide-react";
import type { LandingCopy } from "./landingCopy";

interface ClinicalStorySectionProps {
  c: LandingCopy["story"];
}

const NODE_ICONS = [Database, BookOpen, Calculator, ShieldAlert];

export function ClinicalStorySection({ c }: ClinicalStorySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeAct, setActiveAct] = useState(0);
  const [manualLock, setManualLock] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveAct(2);
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      if (manualLock) return;
      const rect = el.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      if (distance <= 80) return;
      const progress = Math.max(0, Math.min(1, -rect.top / distance));
      el.style.setProperty("--story-p", progress.toFixed(3));
      const nextAct = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;
      setActiveAct((prev) => (prev === nextAct ? prev : nextAct));
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [manualLock]);

  const handleSelectAct = (idx: number) => {
    setManualLock(true);
    setActiveAct(idx);
    // Release manual lock shortly after user resumes scrolling
    window.setTimeout(() => setManualLock(false), 2600);
  };

  return (
    <section ref={sectionRef} className="lp-story" id="como-funciona">
      <div className="lp-story-stage">
        <div className="lp-story-ambient" aria-hidden="true" />
        <div className="lp-story-inner">
          <div className="lp-story-left">
            <p className="lp-kicker">{c.kicker}</p>
            <h2 className="lp-section-title">{c.title}</h2>
            <p className="lp-section-sub">{c.subtitle}</p>

            <div className="lp-story-steps" role="tablist" aria-label={c.kicker}>
              {c.acts.map((act, idx) => {
                const isActive = activeAct === idx;
                const isPast = activeAct > idx;
                return (
                  <button
                    key={act.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`lp-story-step ${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""}`}
                    onClick={() => handleSelectAct(idx)}
                  >
                    <span className="lp-step-num">{act.step}</span>
                    <div className="lp-step-body">
                      <span className="lp-step-label">{act.label}</span>
                      <strong>{act.heading}</strong>
                      <p>{act.body}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lp-story-right">
            <div className="lp-clinical-console" data-act={activeAct}>
              <div className="lp-console-head">
                <div className="lp-console-brand">
                  <span className="lp-console-icon">
                    <Pill size={16} />
                  </span>
                  <div>
                    <strong>Agentes Posológicos</strong>
                    <span>{c.casePromptLabel}</span>
                  </div>
                </div>
                <div className="lp-console-act-pill">
                  <span className="lp-live-dot" />
                  <span>{c.acts[activeAct].label}</span>
                </div>
              </div>

              <div className="lp-console-body">
                {/* Act 1: Clinical Prompt */}
                <div className={`lp-console-prompt ${activeAct >= 0 ? "is-shown" : ""}`}>
                  <p>{c.casePrompt}</p>
                </div>

                {/* Act 2: Verification Pipeline X-Ray */}
                <div className={`lp-console-pipeline ${activeAct >= 1 ? "is-shown" : ""}`}>
                  <div className="lp-pipeline-track" aria-hidden="true">
                    <span className="lp-pipeline-pulse" />
                  </div>
                  <div className="lp-pipeline-grid">
                    {c.pipelineNodes.map((node, i) => {
                      const Icon = NODE_ICONS[i] || Database;
                      return (
                        <div
                          key={node.title}
                          className={`lp-pipe-node ${activeAct >= 1 ? "is-lit" : ""}`}
                          style={{ transitionDelay: `${i * 90}ms` }}
                        >
                          <span className="lp-pipe-icon">
                            <Icon size={14} />
                          </span>
                          <strong>{node.title}</strong>
                          <span>{node.meta}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Act 3: Structured Verified Output */}
                <div className={`lp-console-result ${activeAct >= 2 ? "is-shown" : ""}`}>
                  <div className="lp-alert-head">
                    <span className="lp-alert-badge">
                      <AlertTriangle size={13} />
                      {c.alertBadge}
                    </span>
                    <span className="lp-verified-pill">
                      <FileCheck2 size={13} />
                      {c.citations[2]}
                    </span>
                  </div>
                  <h4>{c.alertTitle}</h4>
                  <p>{c.alertBody}</p>
                  <div className="lp-citation-row">
                    {c.citations.slice(0, 2).map((cite) => (
                      <span key={cite} className="lp-cite-chip">
                        <CheckCircle2 size={12} />
                        {cite}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="lp-console-note">{c.disclaimer}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
