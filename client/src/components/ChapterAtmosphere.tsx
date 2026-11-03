import { useEffect, useRef } from "react";
import { getChapterForLevel } from "@/lib/chapters";
import { useSettingsStore } from "@/lib/settings";

/**
 * Background mood per campaign chapter. Lives on its own canvas behind the board;
 * the board paints an opaque background, so the atmosphere only shows around it.
 */

type Rgb = [number, number, number];

interface Scene {
  step?(dt: number, t: number): void;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
}

type SceneFactory = (rgb: Rgb) => Scene;

type Variant =
  | "scanlines" | "rain" | "glyphs" | "glitch" | "heat" | "bubbles"
  | "frost" | "orbit" | "nodes" | "rings" | "fireflies" | "starfield";

const VARIANT_BY_CHAPTER: Record<number, Variant> = {
  1: "scanlines",
  2: "rain",
  3: "glyphs",
  4: "glitch",
  5: "heat",
  6: "bubbles",
  7: "frost",
  8: "orbit",
  9: "nodes",
  10: "rings",
  11: "fireflies",
  12: "starfield",
};

/** Time used for the single static frame drawn under reduced motion. */
const STATIC_TIME = 6;
const GLYPHS = "01<>/{}=+*#:".split("");

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const wrap = (value: number) => ((value % 1) + 1) % 1;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
/** Stable pseudo-random 0..1 for an index, so static shapes do not jitter per frame. */
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (rgb: Rgb, alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;

// Chapter 1: slow scanlines with a drifting band and a faint flicker.
const scanlines: SceneFactory = rgb => {
  let band = 0;
  return {
    step(dt) {
      band = (band + dt * 0.07) % 1.3;
    },
    draw(ctx, w, h, t) {
      ctx.fillStyle = rgba(rgb, 0.05);
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      const y = band * h;
      const flicker = 0.8 + 0.2 * Math.sin(t * 2.3) * Math.sin(t * 0.7);
      const grad = ctx.createLinearGradient(0, y - h * 0.1, 0, y + h * 0.1);
      grad.addColorStop(0, rgba(rgb, 0));
      grad.addColorStop(0.5, rgba(rgb, 0.1 * flicker));
      grad.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - h * 0.1, w, h * 0.2);
    },
  };
};

// Chapter 2: neon rain streaks with ripples where they land.
const rain: SceneFactory = rgb => {
  const drops = Array.from({ length: 70 }, () => ({
    u: Math.random(),
    v: Math.random(),
    len: rand(0.03, 0.09),
    speed: rand(0.5, 1.1),
    alpha: rand(0.12, 0.25),
  }));
  const ripples: { u: number; age: number }[] = [];
  return {
    step(dt) {
      for (const drop of drops) {
        drop.v += drop.speed * dt;
        if (drop.v > 1) {
          drop.v -= 1;
          if (ripples.length < 20) ripples.push({ u: drop.u, age: 0 });
          drop.u = Math.random();
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].age += dt;
        if (ripples[i].age > 1.2) ripples.splice(i, 1);
      }
    },
    draw(ctx, w, h) {
      ctx.lineWidth = 1;
      for (const drop of drops) {
        const x = drop.u * w;
        const y = drop.v * h;
        ctx.strokeStyle = rgba(rgb, drop.alpha);
        ctx.beginPath();
        ctx.moveTo(x, y - drop.len * h);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      for (const ripple of ripples) {
        const p = ripple.age / 1.2;
        ctx.strokeStyle = rgba(rgb, 0.22 * (1 - p));
        ctx.beginPath();
        ctx.ellipse(ripple.u * w, h, p * 0.05 * w, p * 0.01 * h + 1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  };
};

// Chapter 3: sparse falling data characters in a few columns.
const glyphs: SceneFactory = rgb => {
  const TRAIL = 8;
  const columns = Array.from({ length: 14 }, (_, i) => ({
    u: (i + 0.5) / 14,
    on: Math.random() < 0.6,
    v: Math.random(),
    speed: rand(0.04, 0.12),
    chars: Array.from({ length: TRAIL }, () => pick(GLYPHS)),
  }));
  return {
    step(dt) {
      for (const col of columns) {
        col.v += col.speed * dt;
        if (col.v > 1 + TRAIL * 0.035) {
          col.v = -rand(0, 0.5);
          col.on = Math.random() < 0.6;
          col.speed = rand(0.04, 0.12);
        }
        if (Math.random() < 0.1) col.chars[Math.floor(Math.random() * TRAIL)] = pick(GLYPHS);
      }
    },
    draw(ctx, w, h) {
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      for (const col of columns) {
        if (!col.on) continue;
        for (let k = 0; k < TRAIL; k++) {
          const y = (col.v - k * 0.035) * h;
          if (y < 0 || y > h) continue;
          ctx.fillStyle = rgba(rgb, k === 0 ? 0.25 : 0.2 * (1 - k / TRAIL));
          ctx.fillText(col.chars[k], col.u * w, y);
        }
      }
    },
  };
};

// Chapter 4: occasional glitch bars, faint static specks and flickering edges.
const glitch: SceneFactory = rgb => {
  const bars: { x: number; y: number; w: number; h: number; life: number; alpha: number }[] = [];
  const specks = Array.from({ length: 120 }, () => ({ u: Math.random(), v: Math.random() }));
  let nextBar = 0;
  let reshuffle = 0;
  return {
    step(dt) {
      nextBar -= dt;
      if (nextBar <= 0) {
        nextBar = rand(0.4, 1.4);
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          bars.push({
            x: rand(-0.1, 0.6),
            y: Math.random(),
            w: rand(0.2, 0.5),
            h: rand(0.004, 0.02),
            life: rand(0.08, 0.22),
            alpha: rand(0.12, 0.25),
          });
        }
      }
      for (let i = bars.length - 1; i >= 0; i--) {
        bars[i].life -= dt;
        if (bars[i].life <= 0) bars.splice(i, 1);
      }
      reshuffle -= dt;
      if (reshuffle <= 0) {
        reshuffle = 0.1;
        for (const s of specks) {
          s.u = Math.random();
          s.v = Math.random();
        }
      }
    },
    draw(ctx, w, h) {
      ctx.fillStyle = rgba(rgb, 0.08);
      for (const s of specks) ctx.fillRect(s.u * w, s.v * h, 2, 2);
      for (const bar of bars) {
        ctx.fillStyle = rgba(rgb, bar.alpha);
        ctx.fillRect(bar.x * w, bar.y * h, bar.w * w, Math.max(1, bar.h * h));
      }
      ctx.fillStyle = rgba(rgb, 0.18);
      ctx.fillRect(0, 0, 2, h);
      ctx.fillRect(w - 2, 0, 2, h);
    },
  };
};

// Chapter 5: heat shimmer lines near the bottom and embers rising upward.
const heat: SceneFactory = rgb => {
  const sparks = Array.from({ length: 60 }, () => ({
    u: Math.random(),
    v: Math.random(),
    speed: rand(0.04, 0.14),
    size: rand(0.8, 2),
    phase: rand(0, Math.PI * 2),
    wobble: rand(4, 12),
    alpha: rand(0.15, 0.25),
  }));
  return {
    step(dt) {
      for (const s of sparks) {
        s.v -= s.speed * dt;
        if (s.v < -0.02) {
          s.v = 1.02;
          s.u = Math.random();
        }
      }
    },
    draw(ctx, w, h, t) {
      const glow = ctx.createLinearGradient(0, h * 0.6, 0, h);
      glow.addColorStop(0, rgba(rgb, 0));
      glow.addColorStop(1, rgba(rgb, 0.08));
      ctx.fillStyle = glow;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(rgb, 0.07);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const y = h * (0.78 + i * 0.04) + Math.sin(x * 0.02 + t * 1.5 + i) * 5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (const s of sparks) {
        const x = s.u * w + Math.sin(t * 2 + s.phase) * s.wobble;
        ctx.fillStyle = rgba(rgb, s.alpha * (0.6 + 0.4 * Math.sin(t * 8 + s.phase)));
        ctx.beginPath();
        ctx.arc(x, s.v * h, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 6: deep bubbles that wobble and rise slowly.
const bubbles: SceneFactory = rgb => {
  const items = Array.from({ length: 60 }, () => ({
    u: Math.random(),
    v: Math.random(),
    speed: rand(0.01, 0.04),
    radius: rand(2, 11),
    phase: rand(0, Math.PI * 2),
    alpha: rand(0.08, 0.2),
  }));
  return {
    step(dt) {
      for (const b of items) {
        b.v -= b.speed * dt;
        if (b.v < -0.05) {
          b.v = 1.05;
          b.u = Math.random();
        }
      }
    },
    draw(ctx, w, h, t) {
      ctx.lineWidth = 1;
      for (const b of items) {
        const x = b.u * w + Math.sin(t * 0.8 + b.phase) * 8;
        const y = b.v * h;
        ctx.strokeStyle = rgba(rgb, b.alpha);
        ctx.beginPath();
        ctx.arc(x, y, b.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = rgba(rgb, b.alpha * 1.2);
        ctx.beginPath();
        ctx.arc(x - b.radius * 0.4, y - b.radius * 0.4, Math.max(0.8, b.radius * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 7: frost branches growing from the four corners, with slow glints.
const frost: SceneFactory = rgb => {
  const glints = Array.from({ length: 30 }, () => ({
    u: Math.random(),
    v: Math.random(),
    speed: rand(0.005, 0.02),
    phase: rand(0, Math.PI * 2),
    size: rand(0.8, 1.8),
  }));
  return {
    step(dt) {
      for (const g of glints) {
        g.v += g.speed * dt;
        if (g.v > 1) {
          g.v = 0;
          g.u = Math.random();
        }
      }
    },
    draw(ctx, w, h, t) {
      const fade = Math.min(1, t / 2.5);
      const size = Math.min(w, h);
      const corners: [number, number, number, number][] = [
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ];
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(rgb, 0.22 * fade);
      corners.forEach(([ox, oy, dx, dy], c) => {
        for (let i = 0; i < 7; i++) {
          const seed = c * 10 + i;
          const angle = ((i + 0.5 * hash(seed + 50)) / 7) * (Math.PI / 2);
          const len = size * (0.1 + 0.14 * hash(seed));
          const cosA = Math.cos(angle) * dx;
          const sinA = Math.sin(angle) * dy;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(ox + cosA * len, oy + sinA * len);
          ctx.stroke();
          const sx = ox + cosA * len * 0.55;
          const sy = oy + sinA * len * 0.55;
          for (const side of [-1, 1]) {
            const a = angle + side * 0.7;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(a) * dx * len * 0.4, sy + Math.sin(a) * dy * len * 0.4);
            ctx.stroke();
          }
        }
      });
      for (const g of glints) {
        ctx.fillStyle = rgba(rgb, (0.1 + 0.1 * Math.sin(t * 1.5 + g.phase)) * fade);
        ctx.beginPath();
        ctx.arc(g.u * w, g.v * h, g.size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 8: particles orbiting the board on elliptical tracks.
const orbit: SceneFactory = rgb => {
  const particles = Array.from({ length: 80 }, () => {
    const r = rand(0.35, 0.95);
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      r,
      angle: rand(0, Math.PI * 2),
      speed: (dir * rand(0.03, 0.12)) / r,
      size: rand(0.8, 2.2),
      alpha: rand(0.1, 0.25),
    };
  });
  const rings = [0.5, 0.75, 0.95];
  return {
    step(dt) {
      for (const p of particles) p.angle += p.speed * dt;
    },
    draw(ctx, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(rgb, 0.05);
      for (const r of rings) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * w * 0.5, r * h * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of particles) {
        ctx.fillStyle = rgba(rgb, p.alpha);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(p.angle) * p.r * w * 0.5, cy + Math.sin(p.angle) * p.r * h * 0.5, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 9: drifting nodes linked by fading lines when they come close.
const nodes: SceneFactory = rgb => {
  const LINK = 120;
  const points = Array.from({ length: 40 }, () => ({
    u: Math.random(),
    v: Math.random(),
    vx: rand(-0.01, 0.01),
    vy: rand(-0.01, 0.01),
    phase: rand(0, Math.PI * 2),
  }));
  return {
    step(dt) {
      for (const p of points) {
        p.u = wrap(p.u + p.vx * dt);
        p.v = wrap(p.v + p.vy * dt);
      }
    },
    draw(ctx, w, h, t) {
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const d = Math.hypot((a.u - b.u) * w, (a.v - b.v) * h);
          if (d >= LINK) continue;
          ctx.strokeStyle = rgba(rgb, 0.18 * (1 - d / LINK));
          ctx.beginPath();
          ctx.moveTo(a.u * w, a.v * h);
          ctx.lineTo(b.u * w, b.v * h);
          ctx.stroke();
        }
      }
      for (const p of points) {
        ctx.fillStyle = rgba(rgb, 0.12 + 0.08 * Math.sin(t * 2 + p.phase));
        ctx.beginPath();
        ctx.arc(p.u * w, p.v * h, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 10: concentric rings expanding out from the centre.
const rings: SceneFactory = rgb => {
  const LIFE = 4;
  const pulses = [0.5, 1.8, 3.1].map(age => ({ age }));
  let spawn = 0;
  return {
    step(dt) {
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 1.6;
        pulses.push({ age: 0 });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].age += dt;
        if (pulses[i].age > LIFE) pulses.splice(i, 1);
      }
    },
    draw(ctx, w, h) {
      const maxR = Math.hypot(w, h) * 0.5;
      ctx.lineWidth = 1.5;
      for (const pulse of pulses) {
        const p = pulse.age / LIFE;
        ctx.strokeStyle = rgba(rgb, 0.22 * Math.pow(1 - p, 1.5));
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, p * maxR, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  };
};

// Chapter 11: a few dim fireflies with soft pulsing glows.
const fireflies: SceneFactory = rgb => {
  const flies = Array.from({ length: 40 }, () => ({
    u: Math.random(),
    v: Math.random(),
    vx: rand(-0.02, 0.02),
    vy: rand(-0.02, 0.02),
    phase: rand(0, Math.PI * 2),
    rate: rand(0.3, 0.9),
  }));
  return {
    step(dt) {
      for (const f of flies) {
        f.u = wrap(f.u + f.vx * dt);
        f.v = wrap(f.v + f.vy * dt);
      }
    },
    draw(ctx, w, h, t) {
      const r = 16;
      for (const f of flies) {
        const x = f.u * w;
        const y = f.v * h;
        const pulse = 0.5 + 0.5 * Math.sin(t * f.rate * Math.PI * 2 + f.phase);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, rgba(rgb, 0.04 + 0.14 * pulse));
        glow.addColorStop(1, rgba(rgb, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

// Chapter 12: stars streaming outward from the centre.
const starfield: SceneFactory = rgb => {
  const stars = Array.from({ length: 110 }, () => ({
    angle: rand(0, Math.PI * 2),
    dist: Math.random(),
  }));
  return {
    step(dt) {
      for (const s of stars) {
        s.dist += dt * (0.03 + 0.2 * s.dist);
        if (s.dist > 1) {
          s.dist = 0.01;
          s.angle = rand(0, Math.PI * 2);
        }
      }
    },
    draw(ctx, w, h) {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) * 0.5;
      ctx.lineWidth = 1;
      for (const s of stars) {
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        const d = s.dist * R;
        const trail = (0.01 + 0.08 * s.dist) * R;
        ctx.strokeStyle = rgba(rgb, 0.04 + 0.22 * s.dist);
        ctx.beginPath();
        ctx.moveTo(cx + cos * (d - trail), cy + sin * (d - trail));
        ctx.lineTo(cx + cos * d, cy + sin * d);
        ctx.stroke();
      }
    },
  };
};

const SCENES: Record<Variant, SceneFactory> = {
  scanlines,
  rain,
  glyphs,
  glitch,
  heat,
  bubbles,
  frost,
  orbit,
  nodes,
  rings,
  fireflies,
  starfield,
};

export function ChapterAtmosphere({ levelId }: { levelId: number }) {
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const chapter = getChapterForLevel(levelId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const scene = SCENES[VARIANT_BY_CHAPTER[chapter.id] ?? "scanlines"](hexToRgb(chapter.accent));
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let time = 0;

    const render = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      scene.draw(ctx, w, h, t);
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      time += dt;
      scene.step?.(dt, time);
      render(time);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (reducedMotion || raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      if (reducedMotion) render(STATIC_TIME);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [chapter.id, chapter.accent, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  );
}
