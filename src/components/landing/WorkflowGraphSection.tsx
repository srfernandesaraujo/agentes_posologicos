import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, Cpu, ShieldCheck, Workflow } from "lucide-react";
import type { LandingCopy } from "./landingCopy";
import { Reveal } from "./Reveal";

interface WorkflowGraphSectionProps {
  c: LandingCopy["workflow"];
}

const ICONS = [BookOpen, Cpu, ShieldCheck, Workflow];

export function WorkflowGraphSection({ c }: WorkflowGraphSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % c.nodes.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [paused, c.nodes.length]);

  const activeNode = c.nodes[activeIdx] || c.nodes[0];

  return (
    <section className="lp-section lp-workflow-section">
      <div className="lp-workflow-grid">
        <Reveal>
          <div className="lp-workflow-copy">
            <p className="lp-kicker">{c.kicker}</p>
            <h2 className="lp-section-title">{c.title}</h2>
            <p className="lp-section-sub">{c.subtitle}</p>

            <div className="lp-workflow-inspector" aria-live="polite">
              <span className="lp-inspector-tag">{activeNode.tag}</span>
              <strong>{activeNode.title}</strong>
              <p>{activeNode.detail}</p>
            </div>

            <Link to="/docs" className="lp-inline-cta">
              <span>{c.link}</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div
            className="lp-graph-canvas"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Animated connecting Bezier curves */}
            <svg
              className="lp-graph-svg"
              viewBox="0 0 600 320"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="lpFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#5eead4" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              <path
                d="M 135 88 C 210 88, 220 220, 295 220"
                className="lp-graph-path"
              />
              <path
                d="M 305 220 C 370 220, 385 95, 455 95"
                className="lp-graph-path lp-graph-path-2"
              />
              <path
                d="M 135 88 C 250 40, 355 40, 455 95"
                className="lp-graph-path lp-graph-path-subtle"
              />
              <path
                d="M 305 220 C 390 245, 430 235, 480 235"
                className="lp-graph-path lp-graph-path-3"
              />
            </svg>

            <div className="lp-graph-nodes">
              {c.nodes.map((node, i) => {
                const Icon = ICONS[i] || Workflow;
                const active = activeIdx === i;
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`lp-graph-node lp-gnode-${i} ${active ? "is-active" : ""}`}
                    onClick={() => setActiveIdx(i)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="lp-gnode-icon">
                      <Icon size={18} />
                    </span>
                    <span className="lp-gnode-tag">{node.tag}</span>
                    <strong>{node.title}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
