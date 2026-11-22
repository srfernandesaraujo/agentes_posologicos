import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  MessageCircle,
  Play,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LandingCopy } from "./landingCopy";
import { LANDING_MEDIA } from "./mediaConfig";

interface HeroSectionProps {
  c: LandingCopy["hero"];
  onOpenShowreel: () => void;
}

export function HeroSection({ c, onOpenShowreel }: HeroSectionProps) {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [pulseIdx, setPulseIdx] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    vid.play().catch(() => {});
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setPulseIdx((prev) => (prev + 1) % c.pulseItems.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, [c.pulseItems.length]);

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = pin.trim();
    if (!code) return;
    // PIN de sala virtual vai para a sala; se não houver sala com esse PIN, pode ser uma prova OSCE.
    try {
      const { data } = await supabase.rpc("get_room_by_pin", { p_pin: code });
      const found = Array.isArray(data) ? data.length > 0 : !!data;
      if (!found) {
        navigate("/osce/entrar?pin=" + encodeURIComponent(code));
        return;
      }
    } catch {
      /* sem resposta: segue o caminho de sempre */
    }
    navigate("/sala/" + encodeURIComponent(code));
  };

  const handleSpotlight = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const currentPulse = c.pulseItems[pulseIdx] || c.pulseItems[0];

  return (
    <section className="lp-hero">
      {/* Bespoke macro molecular poster with gentle Ken Burns drift; upgrades seamlessly to hero-ambient.mp4 when present */}
      <img
        src="/media/hero-poster.jpg"
        alt=""
        aria-hidden="true"
        className={`lp-hero-poster ${videoReady ? "is-hidden" : ""}`}
      />
      {LANDING_MEDIA.heroAmbient && (
        <video
          ref={videoRef}
          className={`lp-hero-video ${videoReady ? "is-ready" : ""}`}
          src="/media/hero-ambient.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/media/hero-poster.jpg"
          aria-hidden="true"
          onCanPlay={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
        />
      )}

      <div className="lp-hero-aura" aria-hidden="true" />
      <div className="lp-hero-grid-bg" aria-hidden="true" />

      <div className="lp-hero-content">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow-pill">
            <span className="lp-live-dot" />
            <span>{c.eyebrow}</span>
          </div>

          <h1 className="lp-hero-title">
            <span>{c.titleLine1}</span>
            <span className="lp-hero-title-accent">{c.titleLine2}</span>
          </h1>

          <p className="lp-hero-intro">{c.intro}</p>

          <div className="lp-hero-actions">
            <Link className="lp-btn lp-btn-primary" to="/signup">
              <span>{c.ctaPrimary}</span>
              <ArrowRight size={16} />
            </Link>
            <Link className="lp-btn lp-btn-secondary" to="/vitrine">
              {c.ctaSecondary}
            </Link>
            <button
              type="button"
              className="lp-btn lp-btn-video"
              onClick={onOpenShowreel}
            >
              <span className="lp-play-ring" aria-hidden="true">
                <Play size={12} fill="currentColor" />
              </span>
              <span>{c.ctaVideo}</span>
            </button>
          </div>

          <ul className="lp-trust-strip" aria-label="Destaques clínicos">
            {c.trustItems.map((item) => (
              <li key={item}>
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lp-hero-panel" aria-label={c.accessHeading}>
          <div className="lp-pulse-bar" aria-live="polite">
            <span className={`lp-pulse-tag lp-tone-${currentPulse.tone}`}>
              <ShieldCheck size={12} />
              {currentPulse.tag}
            </span>
            <span className="lp-pulse-text" key={pulseIdx}>
              {currentPulse.text}
            </span>
          </div>

          <div className="lp-access-heading">
            <span className="lp-live-dot" />
            <span>{c.accessHeading}</span>
          </div>

          <div className="lp-access-grid">
            <form
              className="lp-access-card lp-card-room"
              onSubmit={handlePinSubmit}
              onMouseMove={handleSpotlight}
            >
              <div className="lp-card-top">
                <span className="lp-card-icon lp-icon-emerald">
                  <MessageCircle size={20} />
                </span>
                <span className="lp-card-badge lp-badge-emerald">{c.roomBadge}</span>
              </div>
              <h2>{c.roomTitle}</h2>
              <p>{c.roomText}</p>
              <label htmlFor="landing-pin">{c.pinLabel}</label>
              <div className="lp-pin-row">
                <input
                  id="landing-pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder={c.pinPlaceholder}
                  inputMode="text"
                  autoComplete="off"
                  required
                />
                <button type="submit">{c.pinGo}</button>
              </div>
            </form>

            <Link
              className="lp-access-card lp-card-osce"
              to="/osce/entrar"
              onMouseMove={handleSpotlight}
            >
              <div className="lp-card-top">
                <span className="lp-card-icon lp-icon-cyan">
                  <Stethoscope size={20} />
                </span>
                <span className="lp-card-badge lp-badge-cyan">{c.osceBadge}</span>
              </div>
              <h2>{c.osceTitle}</h2>
              <p>{c.osceText}</p>
              <span className="lp-osce-link">
                <span>{c.osceAction}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </Link>
          </div>
        </aside>
      </div>

      <div className="lp-hero-bottom">
        <a href="#como-funciona" className="lp-scroll-cue">
          <span className="lp-scroll-mouse" aria-hidden="true">
            <span />
          </span>
          <span>{c.scroll}</span>
        </a>
        <span className="lp-hero-footnote">POSOLOGIA · BIO-PRECISION AI</span>
      </div>
    </section>
  );
}
