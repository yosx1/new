import { useEffect, useRef } from 'react';

/* Animated "network" backdrop in the plant's navy/blue identity: drifting nodes joined by fading lines,
   with a soft pull towards the pointer. Dark for the login hero, faint for the app background.
   Stops when the tab is hidden and stays still for people who ask their device to reduce motion. */
const THEMES = {
  dark: { node: '154,192,255', line: '96,150,240', glow: 'rgba(21,101,216,.35)', alpha: 1, density: 9000 },
  light: { node: '21,101,216', line: '21,101,216', glow: 'rgba(21,101,216,.06)', alpha: 0.32, density: 16000 },
};

export function NetworkBackground({ variant = 'dark', className = '' }: { variant?: 'dark' | 'light'; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const th = THEMES[variant];
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, running = true;
    const mouse = { x: -1e4, y: -1e4 };
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let pts: P[] = [];

    const resize = () => {
      const box = cv.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width; h = box.height;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(18, Math.min(110, Math.round((w * h) / th.density)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1 + Math.random() * 1.6,
      }));
      if (still) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // slow moving glow
      const t = performance.now() / 9000;
      const gx = w * (0.5 + 0.35 * Math.cos(t)), gy = h * (0.45 + 0.3 * Math.sin(t * 1.3));
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6);
      g.addColorStop(0, th.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      const max = Math.min(160, Math.max(110, w / 9));
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
          if (d < max) {
            ctx.strokeStyle = `rgba(${th.line},${(1 - d / max) * 0.45 * th.alpha})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (md < 180) {
          ctx.strokeStyle = `rgba(${th.line},${(1 - md / 180) * 0.6 * th.alpha})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${th.node},${0.85 * th.alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    };

    const step = () => {
      if (!running) return;
      for (const p of pts) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
        if (d < 180 && d > 1) { p.vx += (dx / d) * 0.004; p.vy += (dy / d) * 0.004; }
        p.vx = Math.max(-0.6, Math.min(0.6, p.vx)); p.vy = Math.max(-0.6, Math.min(0.6, p.vy));
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; };
    const onLeave = () => { mouse.x = mouse.y = -1e4; };
    const onVis = () => {
      running = !document.hidden && !still;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(step);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement!);
    resize();
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [variant]);

  return <canvas ref={canvas} className={'net-bg ' + className} aria-hidden="true" />;
}
