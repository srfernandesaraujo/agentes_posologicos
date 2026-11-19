import { useEffect, useRef, useState } from "react";
import { Calculator, QrCode, Radio, ShieldCheck, Users, WifiOff } from "lucide-react";
import type { LandingCopy } from "./landingCopy";
import { LANDING_MEDIA } from "./mediaConfig";
import { Reveal } from "./Reveal";

interface ProductShowcaseBentoProps {
  c: LandingCopy["showcase"];
}

function SmartVideoClip({ src, cardId }: { src: string; cardId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const enabled = Boolean(LANDING_MEDIA.bentoClips[cardId]);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const vid = videoRef.current;
    if (!enabled || !vid || !hasVideo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(vid);
    return () => observer.disconnect();
  }, [enabled, hasVideo]);

  return (
    <div className="lp-bento-media">
      {enabled && (
        <video
          ref={videoRef}
          className={`lp-bento-video ${hasVideo ? "is-ready" : ""}`}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setHasVideo(true)}
          onCanPlay={() => setHasVideo(true)}
          onError={() => setHasVideo(false)}
        />
      )}

      {/* Rich built-in live motion mockup shown automatically until a custom MP4 is enabled */}
      {!hasVideo && <BuiltInPreview cardId={cardId} />}
    </div>
  );
}

function BuiltInPreview({ cardId }: { cardId: string }) {
  if (cardId === "osce-live") {
    return (
      <div className="lp-mock lp-mock-osce" aria-hidden="true">
        <div className="lp-mock-top">
          <span className="lp-mock-pin">PIN 842 910</span>
          <span className="lp-mock-live">
            <Users size={12} /> 28/28
          </span>
        </div>
        <div className="lp-mock-bars">
          {[
            { name: "Ana C.", pct: 96 },
            { name: "Lucas M.", pct: 84 },
            { name: "Beatriz S.", pct: 72 },
          ].map((s, i) => (
            <div key={s.name} className="lp-mock-bar-row">
              <span>{s.name}</span>
              <div className="lp-mock-track">
                <i style={{ width: `${s.pct}%`, animationDelay: `${i * 0.4}s` }} />
              </div>
              <strong>{s.pct}%</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (cardId === "dose-calc") {
    return (
      <div className="lp-mock lp-mock-dose" aria-hidden="true">
        <div className="lp-mock-top">
          <span className="lp-mock-chip">
            <Calculator size={12} /> Cockcroft-Gault
          </span>
          <span className="lp-mock-offline">
            <WifiOff size={11} /> Offline
          </span>
        </div>
        <div className="lp-dose-readout">
          <div>
            <small>ClCr</small>
            <strong>38.4</strong>
            <span>mL/min</span>
          </div>
          <div>
            <small>mg/kg</small>
            <strong>15.0</strong>
            <span>q24h</span>
          </div>
        </div>
      </div>
    );
  }

  if (cardId === "voice-briefing") {
    return (
      <div className="lp-mock lp-mock-voice" aria-hidden="true">
        <div className="lp-mock-top">
          <span className="lp-mock-chip">
            <Radio size={12} /> ElevenLabs · 03:18
          </span>
          <span className="lp-mock-dot-pulse" />
        </div>
        <div className="lp-mini-eq">
          {[35, 70, 52, 92, 64, 80, 44, 86, 58, 74, 48, 90, 62, 42].map((h, idx) => (
            <span key={idx} style={{ height: `${h}%`, animationDelay: `${idx * 85}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lp-mock lp-mock-cert" aria-hidden="true">
      <div className="lp-cert-badge">
        <QrCode size={34} strokeWidth={1.5} />
        <div>
          <span className="lp-cert-ok">
            <ShieldCheck size={12} /> SHA-256 Verified
          </span>
          <strong>POS-2026-8F4C</strong>
          <small>Sala Virtual · Evidência Auditada</small>
        </div>
      </div>
    </div>
  );
}

export function ProductShowcaseBento({ c }: ProductShowcaseBentoProps) {
  return (
    <section className="lp-section lp-showcase-section" id="recursos">
      <Reveal>
        <div className="lp-section-head">
          <div>
            <p className="lp-kicker">{c.kicker}</p>
            <h2 className="lp-section-title">{c.title}</h2>
          </div>
          <p className="lp-section-sub">{c.subtitle}</p>
        </div>
      </Reveal>

      <div className="lp-bento-grid">
        {c.cards.map((card, idx) => (
          <Reveal key={card.id} delay={idx * 70}>
            <article className={`lp-bento-card lp-bento-${card.id}`}>
              <SmartVideoClip src={card.videoSrc} cardId={card.id} />
              <div className="lp-bento-copy">
                <span className="lp-bento-badge">{card.badge}</span>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
