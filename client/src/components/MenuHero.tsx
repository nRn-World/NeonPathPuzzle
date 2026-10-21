import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Brain, ChevronDown, Flame, Play, Star } from "lucide-react";
import { getBrainRank } from "@/lib/rank";
import type { Point } from "@shared/schema";
import { HERO_BOARD } from "@/lib/heroBoard";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/lib/settings";
import { useI18n, upper } from "@/lib/i18n";

/** Nodes drawn per second while the line traces itself. */
const DRAW_SPEED = 13;
const HOLD_MS = 1800;
const FADE_MS = 900;

/**
 * The title art: the game's own board drawing its own solution, over and over.
 * No glow stack and no particles — just the mechanic the game is about.
 */
export function AnimatedBoard({
  board,
  speed = DRAW_SPEED,
  className = "aspect-square w-full",
}: {
  board: { gridSize: number; solution: Point[] };
  /** Nodes drawn per second. */
  speed?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getThemeColors } = useTheme();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const level = board;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let size = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nodeCount = level.solution.length;
    const drawMs = (nodeCount / speed) * 1000;
    const cycle = drawMs + HOLD_MS + FADE_MS;

    const resize = () => {
      size = canvas.getBoundingClientRect().width;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(drawMs + 1);
    });
    observer.observe(canvas);

    const draw = (elapsed: number) => {
      const colors = getThemeColors();
      // rAF can hand over a timestamp slightly before `start`, so never go negative.
      const t = reducedMotion ? drawMs + 1 : Math.max(0, elapsed) % cycle;
      const progress = Math.min(1, t / drawMs) * (nodeCount - 1);
      const fade = t > drawMs + HOLD_MS ? 1 - (t - drawMs - HOLD_MS) / FADE_MS : 1;
      const cell = size / level.gridSize;
      const center = (value: number) => value * cell + cell / 2;

      context.clearRect(0, 0, size, size);

      // Every node of the board, dim until the line has been through it.
      level.solution.forEach((point, index) => {
        const reached = index <= progress;
        const x = center(point.x);
        const y = center(point.y);
        context.beginPath();
        context.arc(x, y, cell * 0.13, 0, Math.PI * 2);
        context.strokeStyle = reached ? colors.primary : "rgba(255,255,255,0.22)";
        context.globalAlpha = reached ? fade : 1;
        context.lineWidth = Math.max(1.5, cell * 0.035);
        context.stroke();
        if (reached) {
          context.beginPath();
          context.arc(x, y, cell * 0.06, 0, Math.PI * 2);
          context.fillStyle = colors.primary;
          context.fill();
        }
        context.globalAlpha = 1;
      });

      // The line itself: a flat, crisp stroke with a thin bright core.
      const whole = Math.floor(progress);
      const part = progress - whole;
      const trace = () => {
        context.beginPath();
        for (let index = 0; index <= whole; index++) {
          const point = level.solution[index];
          if (index === 0) context.moveTo(center(point.x), center(point.y));
          else context.lineTo(center(point.x), center(point.y));
        }
        const from = level.solution[whole];
        const to = level.solution[Math.min(nodeCount - 1, whole + 1)];
        context.lineTo(center(from.x + (to.x - from.x) * part), center(from.y + (to.y - from.y) * part));
      };
      context.save();
      context.globalAlpha = fade;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = colors.primary;
      context.lineWidth = cell * 0.2;
      trace();
      context.stroke();
      context.strokeStyle = "#0a0f1e";
      context.lineWidth = cell * 0.07;
      trace();
      context.stroke();
      context.restore();

      // Head of the line.
      if (t <= drawMs + HOLD_MS) {
        const from = level.solution[whole];
        const to = level.solution[Math.min(nodeCount - 1, whole + 1)];
        const x = center(from.x + (to.x - from.x) * part);
        const y = center(from.y + (to.y - from.y) * part);
        context.beginPath();
        context.arc(x, y, cell * 0.27, 0, Math.PI * 2);
        context.strokeStyle = colors.accent;
        context.lineWidth = Math.max(1.5, cell * 0.04);
        context.stroke();
        context.beginPath();
        context.arc(x, y, cell * 0.14, 0, Math.PI * 2);
        context.fillStyle = colors.accent;
        context.fill();
      }
    };

    if (reducedMotion) {
      draw(drawMs + 1);
    } else {
      const start = performance.now();
      const tick = (now: number) => {
        draw(now - start);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [getThemeColors, level, reducedMotion, speed]);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

function HeroBoard() {
  return <AnimatedBoard board={HERO_BOARD} />;
}

interface MenuHeroProps {
  hasProgress: boolean;
  continueLevel: number;
  runCount: number;
  totalLevels: number;
  totalStars: number;
  maxStars: number;
  streak: number;
  chapterName: string;
  onPlay: () => void;
  /** Secondary actions: how to play, completed, daily, theme, settings, editor. */
  actions: ReactNode;
}

export function MenuHero({
  hasProgress,
  continueLevel,
  runCount,
  totalLevels,
  totalStars,
  maxStars,
  streak,
  chapterName,
  onPlay,
  actions,
}: MenuHeroProps) {
  const { t } = useI18n();
  const rank = getBrainRank(totalStars);
  const segments = 30;
  const filled = Math.round((runCount / totalLevels) * segments);

  return (
    <section className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-8 py-2 md:py-6 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
      <div className="text-left">
        <motion.p
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
        >
          <span className="h-px w-8 bg-primary" />
          {t("heroEyebrow", { count: totalLevels })}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="font-orbitron text-[clamp(3.4rem,14vw,8rem)] font-black leading-[0.86] tracking-[-0.03em] text-white"
          aria-label="Neon Path"
        >
          NEON
          <span
            className="block text-transparent"
            style={{ WebkitTextStroke: "2px hsl(var(--primary))" }}
          >
            PATH
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-6 max-w-md font-exo text-lg leading-snug text-foreground/70"
        >
          {t("startTagline")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 max-w-md"
        >
          <button
            type="button"
            onClick={onPlay}
            className="group flex w-full items-center justify-between bg-primary px-6 py-5 text-left text-background transition-transform [clip-path:polygon(0_0,calc(100%-22px)_0,100%_22px,100%_100%,22px_100%,0_calc(100%-22px))] hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>
              <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.22em] opacity-70">
                {hasProgress ? t("continueGame") : t("startGame")}
              </span>
              <span className="block font-orbitron text-2xl font-black tracking-wide">
                {upper(t("level"))} {continueLevel}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                {chapterName}
              </span>
            </span>
            <Play className="h-8 w-8 fill-current transition-transform group-hover:translate-x-1" />
          </button>

          <div
            className="mt-4 flex gap-[3px]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalLevels}
            aria-valuenow={runCount}
            aria-label={t("levelsSolved")}
          >
            {Array.from({ length: segments }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 ${index < filled ? "bg-primary" : "bg-white/10"}`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>{runCount}/{totalLevels} {t("levelsSolved")}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-primary" title={t("brainRank")}>
                <Brain className="h-3 w-3" />
                {upper(t(rank.key))}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" />
                {totalStars}/{maxStars}
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-1 text-accent">
                  <Flame className="h-3 w-3" />
                  {streak}
                </span>
              )}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex max-w-md flex-wrap items-center gap-2"
        >
          {actions}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="mx-auto w-full max-w-[min(100%,34rem)]"
      >
        <div className="relative border border-white/10 bg-white/[0.02] p-4 sm:p-6">
          {/* Corner ticks make the board read as an instrument, not a card. */}
          <span className="absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-primary" />
          <span className="absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-primary" />
          <span className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-primary" />
          <span className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-primary" />
          <HeroBoard />
          <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>{HERO_BOARD.gridSize}×{HERO_BOARD.gridSize} · {HERO_BOARD.solution.length} {t("nodes")}</span>
            <span>{t("heroBoardCaption")}</span>
          </div>
        </div>
      </motion.div>

      <a
        href="#dashboard"
        onClick={event => {
          event.preventDefault();
          document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
        }}
        aria-label={t("heroScroll")}
        className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-primary md:flex"
      >
        {t("heroScroll")}
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </a>
    </section>
  );
}
