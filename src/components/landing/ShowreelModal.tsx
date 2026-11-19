import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Pause,
  Play,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LandingCopy } from "./landingCopy";
import { LANDING_MEDIA } from "./mediaConfig";

interface ShowreelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  c: LandingCopy["showreel"];
}

const CHAPTER_ICONS = [Activity, Stethoscope, FlaskConical, Users];

export function ShowreelModal({ open, onOpenChange, c }: ShowreelModalProps) {
  const [hasRealVideo, setHasRealVideo] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      setChapterIdx(0);
      setProgress(0);
      setPlaying(true);
      return;
    }
    if (hasRealVideo || !playing) return;

    const tick = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setChapterIdx((idx) => (idx + 1) % c.chapters.length);
          return 0;
        }
        return prev + 2.5;
      });
    }, 150);

    return () => window.clearInterval(tick);
  }, [open, hasRealVideo, playing, c.chapters.length]);

  const chapter = c.chapters[chapterIdx] || c.chapters[0];
  const Icon = CHAPTER_ICONS[chapterIdx] || Activity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lp-showreel-dialog max-w-4xl border-white/15 bg-[#061216] p-0 text-[#eefef9] overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">{c.title}</DialogTitle>

        <div className="lp-showreel-topbar">
          <div className="lp-showreel-meta">
            <span className="lp-live-dot" />
            <span>{c.badge}</span>
            <strong>{c.title}</strong>
          </div>
          <button
            type="button"
            className="lp-showreel-close"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Real MP4 video automatically takes over when LANDING_MEDIA.showreel is enabled */}
        {LANDING_MEDIA.showreel && (
          <video
            className={`lp-showreel-video ${hasRealVideo ? "is-ready" : ""}`}
            src={c.videoSrc}
            controls
            autoPlay={open && hasRealVideo}
            playsInline
            preload="metadata"
            onLoadedMetadata={() => setHasRealVideo(true)}
            onCanPlay={() => setHasRealVideo(true)}
            onError={() => setHasRealVideo(false)}
          />
        )}

        {!hasRealVideo && (
          <div className="lp-reel-stage">
            <div className="lp-reel-canvas" key={chapter.id}>
              <div className="lp-reel-chapter-pill">
                <Icon size={15} />
                <span>{chapter.label}</span>
                <span className="lp-reel-time">{chapter.time}</span>
              </div>

              <h3>{chapter.headline}</h3>
              <p>{chapter.summary}</p>

              <div className="lp-reel-highlights">
                {chapter.highlights.map((h) => (
                  <div key={h} className="lp-reel-chip">
                    <CheckCircle2 size={14} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-reel-timeline">
              {c.chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  type="button"
                  className={`lp-reel-seg ${chapterIdx === i ? "is-active" : ""}`}
                  onClick={() => {
                    setChapterIdx(i);
                    setProgress(0);
                  }}
                >
                  <div className="lp-reel-seg-bar">
                    <span
                      style={{
                        width:
                          i < chapterIdx
                            ? "100%"
                            : i === chapterIdx
                            ? `${progress}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span>{ch.label}</span>
                </button>
              ))}
            </div>

            <div className="lp-reel-footer">
              <button
                type="button"
                className="lp-reel-play-btn"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                <span>{playing ? c.pause : c.play}</span>
              </button>

              <Link
                to="/signup"
                className="lp-btn lp-btn-primary lp-btn-sm"
                onClick={() => onOpenChange(false)}
              >
                <span>{c.cta}</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
