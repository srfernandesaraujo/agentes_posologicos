import { useEffect, useRef } from "react";

interface NodeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tone: "emerald" | "cyan" | "violet";
  label?: string;
  phase: number;
}

const DOMAIN_LABELS = ["mg/kg", "ClCr", "CYP3A4", "PubMed", "OSCE", "GRADE A", "RAG", "t½", "PK/PD"];

/**
 * Bio-precision ambient field replacing the generic Matrix rain:
 * organic molecular nodes, subtle covalent-like bonds, cursor resonance,
 * and a breathing pharmacokinetic curve along the lower horizon.
 */
export function MolecularField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999, active: false };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: NodeParticle[] = [];
    let raf = 0;

    const tones: Array<NodeParticle["tone"]> = ["emerald", "cyan", "emerald", "violet"];

    const buildNodes = () => {
      const count = Math.max(24, Math.min(58, Math.floor((width * height) / 26000)));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.6 + Math.random() * 2.1,
        tone: tones[i % tones.length],
        label: i < DOMAIN_LABELS.length ? DOMAIN_LABELS[i] : undefined,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNodes();
    };

    const colorFor = (tone: NodeParticle["tone"], alpha: number) => {
      if (tone === "cyan") return `rgba(56, 189, 248, ${alpha})`;
      if (tone === "violet") return `rgba(167, 139, 250, ${alpha})`;
      return `rgba(94, 234, 212, ${alpha})`;
    };

    const drawPkCurve = (t: number) => {
      // Subtle pharmacokinetic concentration-time contour in lower viewport
      const baseY = height * 0.84;
      ctx.save();
      ctx.beginPath();
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = u * width;
        const pk = Math.exp(-3.4 * u) * (1 - Math.exp(-11 * u)) * 185;
        const ripple = Math.sin(u * 7.5 - t * 0.45) * 8;
        const y = baseY - pk + ripple;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, baseY - 120, width, baseY);
      grad.addColorStop(0, "rgba(56, 189, 248, 0)");
      grad.addColorStop(0.28, "rgba(94, 234, 212, 0.16)");
      grad.addColorStop(0.62, "rgba(56, 189, 248, 0.09)");
      grad.addColorStop(1, "rgba(167, 139, 250, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.restore();
    };

    const drawFrame = (ts: number) => {
      const t = ts * 0.001;
      ctx.clearRect(0, 0, width, height);

      drawPkCurve(t);

      const maxDist = Math.min(185, Math.max(125, width * 0.13));

      // Update positions
      if (!reducedMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = width + 20;
          if (n.x > width + 20) n.x = -20;
          if (n.y < -20) n.y = height + 20;
          if (n.y > height + 20) n.y = -20;

          if (pointer.active) {
            const dx = pointer.x - n.x;
            const dy = pointer.y - n.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 28 && dist < 190) {
              n.x += (dx / dist) * 0.16;
              n.y += (dy / dist) * 0.16;
            }
          }
        }
      }

      // Draw molecular bonds
      ctx.lineWidth = 0.85;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            const alpha = (1 - d / maxDist) * 0.14;
            ctx.strokeStyle = colorFor(a.tone, alpha);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes & occasional scientific labels
      ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      for (const n of nodes) {
        const pulse = 0.72 + Math.sin(t * 1.4 + n.phase) * 0.28;
        const nearCursor = pointer.active && Math.hypot(pointer.x - n.x, pointer.y - n.y) < 150;
        const boost = nearCursor ? 1.55 : 1;

        // Soft outer halo
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 2.8 * boost, 0, Math.PI * 2);
        ctx.fillStyle = colorFor(n.tone, 0.06 * pulse * boost);
        ctx.fill();

        // Core atom
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = colorFor(n.tone, 0.42 * pulse * boost);
        ctx.fill();

        if (n.label) {
          ctx.fillStyle = colorFor(n.tone, nearCursor ? 0.42 : 0.16);
          ctx.fillText(n.label, n.x + n.r + 7, n.y + 3);
        }
      }

      if (!reducedMotion) {
        raf = window.requestAnimationFrame(drawFrame);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
      } else if (!reducedMotion) {
        raf = window.requestAnimationFrame(drawFrame);
      }
    };

    resize();
    if (reducedMotion) {
      drawFrame(0);
    } else {
      raf = window.requestAnimationFrame(drawFrame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="lp-molecular-field" aria-hidden="true" />;
}
