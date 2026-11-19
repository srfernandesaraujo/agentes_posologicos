import { useRef, useState } from "react";
import { CheckCircle2, Play, ShieldCheck, X } from "lucide-react";
import type { LandingCopy } from "./landingCopy";
import { LANDING_MEDIA } from "./mediaConfig";
import { Reveal } from "./Reveal";

interface AuthorityVideoSectionProps {
  c: LandingCopy["authority"];
}

export function AuthorityVideoSection({ c }: AuthorityVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasRealVideo, setHasRealVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showBriefOverlay, setShowBriefOverlay] = useState(false);

  const handlePlayClick = () => {
    if (hasRealVideo && videoRef.current) {
      setIsPlaying(true);
      videoRef.current.play().catch(() => {});
    } else {
      setShowBriefOverlay(true);
    }
  };

  return (
    <section className="lp-section lp-authority-section" id="autoridade">
      <div className="lp-authority-grid">
        <Reveal>
          <div className="lp-authority-copy">
            <p className="lp-kicker">{c.kicker}</p>
            <h2 className="lp-section-title">{c.title}</h2>
            <p className="lp-section-sub">{c.subtitle}</p>

            <div className="lp-authority-pillars">
              {c.pillars.map((item) => (
                <div key={item.label} className="lp-authority-stat">
                  <span className="lp-stat-label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="lp-authority-video-frame">
            {LANDING_MEDIA.founderStory && (
              <video
                ref={videoRef}
                className={`lp-authority-video ${isPlaying ? "is-playing" : ""}`}
                src={c.videoSrc}
                controls={isPlaying}
                playsInline
                preload="metadata"
                poster={c.posterSrc}
                onLoadedMetadata={() => setHasRealVideo(true)}
                onCanPlay={() => setHasRealVideo(true)}
                onError={() => setHasRealVideo(false)}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            {!isPlaying && (
              <div className="lp-authority-cover">
                <img
                  src={c.posterSrc}
                  alt={c.videoTitle}
                  className="lp-authority-poster"
                  loading="lazy"
                />
                <div className="lp-authority-scrim" aria-hidden="true" />

                <div className="lp-authority-top">
                  <span className="lp-authority-badge">
                    <ShieldCheck size={13} />
                    {c.videoBadge}
                  </span>
                </div>

                {!showBriefOverlay ? (
                  <div className="lp-authority-center">
                    <button
                      type="button"
                      className="lp-big-play-btn"
                      onClick={handlePlayClick}
                      aria-label={c.playCta}
                    >
                      <span className="lp-big-play-pulse" aria-hidden="true" />
                      <Play size={24} fill="currentColor" />
                    </button>
                    <div className="lp-authority-caption">
                      <h3>{c.videoTitle}</h3>
                      <span>{c.videoCaption}</span>
                    </div>
                  </div>
                ) : (
                  <div className="lp-authority-script-overlay">
                    <div className="lp-script-head">
                      <strong>{c.scriptHeading}</strong>
                      <button
                        type="button"
                        className="lp-script-close"
                        onClick={() => setShowBriefOverlay(false)}
                        aria-label={c.closePreview}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <ul>
                      {c.scriptPoints.map((pt) => (
                        <li key={pt}>
                          <CheckCircle2 size={14} />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
