import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  FlaskConical,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Volume2,
} from "lucide-react";
import type { LandingCopy } from "./landingCopy";
import { LANDING_MEDIA } from "./mediaConfig";
import { Reveal } from "./Reveal";

interface InteractiveDemoSectionProps {
  c: LandingCopy["demo"];
}

const WAVE_BARS = [
  28, 52, 74, 44, 88, 62, 95, 48, 70, 84, 38, 66,
  92, 58, 76, 40, 82, 68, 50, 86, 46, 72, 56, 34,
];

export function InteractiveDemoSection({ c }: InteractiveDemoSectionProps) {
  const [tab, setTab] = useState<"clinical" | "osce" | "pubmed">("clinical");

  // Clinical tab state
  const [scenarioIdx, setScenarioIdx] = useState(0);

  // OSCE live playback state
  const [osceStep, setOsceStep] = useState(4);
  const [osceSeconds, setOsceSeconds] = useState(272); // 04:32

  // Voice briefing preview state
  const [briefingPlaying, setBriefingPlaying] = useState(false);
  const [briefingLineIdx, setBriefingLineIdx] = useState(0);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Restart OSCE animation cleanly when user switches to OSCE tab
  useEffect(() => {
    if (tab !== "osce") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setOsceStep(4);
      return;
    }
    setOsceStep(1);
    setOsceSeconds(240);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setOsceStep(2), 1100));
    timers.push(window.setTimeout(() => setOsceStep(3), 2400));
    timers.push(window.setTimeout(() => setOsceStep(4), 3800));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [tab]);

  // OSCE live timer tick
  useEffect(() => {
    if (tab !== "osce") return;
    const id = window.setInterval(() => {
      setOsceSeconds((s) => (s > 0 ? s - 1 : 240));
    }, 1000);
    return () => window.clearInterval(id);
  }, [tab]);

  // Voice briefing playback + synced transcript (/media/briefing-demo.mp3)
  useEffect(() => {
    const audio = audioRef.current;
    if (!briefingPlaying) {
      if (audio) audio.pause();
      return;
    }
    if (audio) {
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.1)) {
        audio.currentTime = 0;
      }
      audio.play().catch(() => {
        // Fallback silently if audio cannot autoplay
      });
    }
    if (audioDuration > 0) return;
    const id = window.setInterval(() => {
      setBriefingLineIdx((prev) => (prev + 1) % c.pubmed.briefingLines.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [briefingPlaying, audioDuration, c.pubmed.briefingLines.length]);

  const formatAudioTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return "00:00";
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(Math.floor(sec % 60)).padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (tab !== "pubmed" && briefingPlaying) {
      setBriefingPlaying(false);
    }
  }, [tab, briefingPlaying]);

  const replayOsce = () => {
    setOsceStep(1);
    window.setTimeout(() => setOsceStep(2), 950);
    window.setTimeout(() => setOsceStep(3), 2050);
    window.setTimeout(() => setOsceStep(4), 3200);
  };

  const scenario = c.clinical.scenarios[scenarioIdx] || c.clinical.scenarios[0];
  const osceScore = c.osce.rubric.reduce(
    (sum, r) => (osceStep >= r.triggerStep ? sum + parseInt(r.pts.replace(/\D/g, ""), 10) : sum),
    0
  );
  const mm = String(Math.floor(osceSeconds / 60)).padStart(2, "0");
  const ss = String(osceSeconds % 60).padStart(2, "0");

  return (
    <section className="lp-section lp-demo-section" id="demo">
      <Reveal>
        <div className="lp-section-head">
          <div>
            <p className="lp-kicker">{c.kicker}</p>
            <h2 className="lp-section-title">{c.title}</h2>
          </div>
          <p className="lp-section-sub">{c.subtitle}</p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="lp-demo-tabs" role="tablist" aria-label={c.kicker}>
          {c.tabs.map((item) => {
            const Icon =
              item.id === "clinical"
                ? Activity
                : item.id === "osce"
                ? Stethoscope
                : FlaskConical;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`lp-demo-tab ${active ? "is-active" : ""}`}
                onClick={() => setTab(item.id as "clinical" | "osce" | "pubmed")}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="lp-demo-stage" aria-live="polite">
          {tab === "clinical" && (
            <div className="lp-demo-clinical">
              <div className="lp-demo-toolbar">
                <div className="lp-scenario-pills">
                  {c.clinical.scenarios.map((sc, idx) => (
                    <button
                      key={sc.id}
                      type="button"
                      className={`lp-scenario-pill ${scenarioIdx === idx ? "is-active" : ""}`}
                      onClick={() => setScenarioIdx(idx)}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
                <span className="lp-severity-badge">
                  <AlertTriangle size={13} />
                  {scenario.severity}
                </span>
              </div>

              <div className="lp-clinical-grid">
                <div className="lp-clinical-summary">
                  <div className="lp-drug-pair">
                    <span className="lp-drug-chip">{scenario.drugA}</span>
                    <span className="lp-drug-plus">+</span>
                    <span className="lp-drug-chip lp-drug-chip-b">{scenario.drugB}</span>
                  </div>

                  <div className="lp-meter-block">
                    <div className="lp-meter-header">
                      <span>{scenario.metricLabel}</span>
                      <strong>{scenario.score}/100</strong>
                    </div>
                    <div className="lp-meter-track">
                      <div
                        className="lp-meter-fill"
                        style={{ width: `${scenario.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="lp-evidence-line">
                    <ShieldCheck size={15} />
                    <span>{scenario.evidence}</span>
                  </div>

                  <Link to="/vitrine" className="lp-inline-cta">
                    <span>{c.clinical.cta}</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </div>

                <div className="lp-params-grid">
                  {scenario.params.map((p) => (
                    <div key={p.k} className="lp-param-card">
                      <span>{p.k}</span>
                      <strong>{p.v}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "osce" && (
            <div className="lp-demo-osce">
              <div className="lp-osce-header">
                <div className="lp-osce-title">
                  <span className="lp-live-dot" />
                  <strong>{c.osce.stationTitle}</strong>
                </div>
                <div className="lp-osce-controls">
                  <span className="lp-osce-timer" title={c.osce.timerLabel}>
                    <Clock size={14} />
                    <span>
                      {mm}:{ss}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="lp-replay-btn"
                    onClick={replayOsce}
                  >
                    <RotateCcw size={13} />
                    <span>{c.osce.replay}</span>
                  </button>
                </div>
              </div>

              <div className="lp-osce-layout">
                <div className="lp-osce-chat">
                  {c.osce.messages.map((msg, idx) => {
                    const visible = osceStep >= idx + 1;
                    return (
                      <div
                        key={idx}
                        className={`lp-osce-msg lp-osce-${msg.role} ${visible ? "is-visible" : ""}`}
                      >
                        <small>{msg.name}</small>
                        <p>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="lp-osce-rubric">
                  <div className="lp-rubric-top">
                    <span>{c.osce.rubricTitle}</span>
                    <div className="lp-rubric-score">
                      <small>{c.osce.scoreLabel}</small>
                      <strong>{osceScore}%</strong>
                    </div>
                  </div>
                  <div className="lp-rubric-bar">
                    <div style={{ width: `${osceScore}%` }} />
                  </div>
                  <ul className="lp-rubric-list">
                    {c.osce.rubric.map((item) => {
                      const done = osceStep >= item.triggerStep;
                      return (
                        <li key={item.text} className={done ? "is-checked" : ""}>
                          <span className="lp-rubric-check">
                            {done && <Check size={12} />}
                          </span>
                          <span className="lp-rubric-text">{item.text}</span>
                          <span className="lp-rubric-pts">{item.pts}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <Link to="/osce/entrar" className="lp-inline-cta">
                    <span>{c.osce.cta}</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {tab === "pubmed" && (
            <div className="lp-demo-pubmed">
              <div className="lp-pubmed-searchbar">
                <BookOpen size={15} />
                <span className="lp-pubmed-query">{c.pubmed.query}</span>
                <span className="lp-pubmed-status">{c.pubmed.status}</span>
              </div>

              <div className="lp-pubmed-layout">
                <div className="lp-pubmed-list">
                  {c.pubmed.articles.map((art, idx) => (
                    <article
                      key={art.pmid}
                      className="lp-pubmed-card"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="lp-pubmed-meta">
                        <span className="lp-pmid-badge">{art.pmid}</span>
                        <span className="lp-journal">{art.journal}</span>
                        <span className="lp-grade-badge">{art.grade}</span>
                      </div>
                      <h4>{art.title}</h4>
                      <p>{art.takeaway}</p>
                    </article>
                  ))}
                </div>

                <div className="lp-voice-card">
                  <div className="lp-voice-head">
                    <span className="lp-voice-icon">
                      <Headphones size={18} />
                    </span>
                    <div>
                      <strong>{c.pubmed.briefingTitle}</strong>
                      <span>{c.pubmed.briefingSubtitle}</span>
                    </div>
                  </div>

                  {/* Real ElevenLabs mp3: public/media/briefing-demo.mp3 */}
                  {LANDING_MEDIA.briefingDemo && (
                    <audio
                      ref={audioRef}
                      src="/media/briefing-demo.mp3"
                      preload="metadata"
                      onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
                      onTimeUpdate={(e) => {
                        const t = e.currentTarget.currentTime;
                        const d = e.currentTarget.duration || 0;
                        setAudioTime(t);
                        if (d > 0) {
                          const nextIdx = Math.min(
                            c.pubmed.briefingLines.length - 1,
                            Math.floor((t / d) * c.pubmed.briefingLines.length)
                          );
                          setBriefingLineIdx(nextIdx);
                        }
                      }}
                      onEnded={() => {
                        setBriefingPlaying(false);
                        setAudioTime(0);
                        setBriefingLineIdx(0);
                      }}
                    />
                  )}

                  <div className={`lp-waveform ${briefingPlaying ? "is-playing" : ""}`} aria-hidden="true">
                    {WAVE_BARS.map((h, i) => {
                      const pct = audioDuration > 0 ? (audioTime / audioDuration) * 100 : 0;
                      const barPct = ((i + 0.5) / WAVE_BARS.length) * 100;
                      return (
                        <span
                          key={i}
                          className={barPct <= pct ? "is-played" : ""}
                          style={{
                            height: `${h}%`,
                            animationDelay: `${(i % 8) * 90}ms`,
                          }}
                        />
                      );
                    })}
                  </div>

                  {audioDuration > 0 && (
                    <div className="lp-voice-progress-row">
                      <span>{formatAudioTime(audioTime)}</span>
                      <div
                        className="lp-voice-progress-track"
                        role="progressbar"
                        aria-valuenow={Math.round((audioTime / audioDuration) * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          if (audioRef.current) {
                            audioRef.current.currentTime = ratio * audioDuration;
                            setAudioTime(ratio * audioDuration);
                          }
                        }}
                      >
                        <div style={{ width: `${(audioTime / audioDuration) * 100}%` }} />
                      </div>
                      <span>{formatAudioTime(audioDuration)}</span>
                    </div>
                  )}

                  <p className="lp-voice-transcript" key={briefingLineIdx}>
                    <Volume2 size={14} />
                    <span>“{c.pubmed.briefingLines[briefingLineIdx]}”</span>
                  </p>

                  <div className="lp-voice-actions">
                    <button
                      type="button"
                      className="lp-voice-play-btn"
                      onClick={() => setBriefingPlaying((p) => !p)}
                    >
                      {briefingPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                      <span>{briefingPlaying ? c.pubmed.pauseLabel : c.pubmed.playLabel}</span>
                    </button>
                    <Link to="/vitrine" className="lp-inline-cta">
                      <span>{c.pubmed.cta}</span>
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}
