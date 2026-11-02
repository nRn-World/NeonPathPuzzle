import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Heart, Home, Play, RotateCcw, Skull, Timer, Undo2, Zap } from "lucide-react";
import { generateLevel } from "@shared/level-generator";
import { getLevelMechanics } from "@shared/mechanics";
import type { LevelResponse } from "@shared/schema";
import { GameCanvas, type GameCanvasHandle } from "@/components/GameCanvas";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/settings";
import { useI18n, upper } from "@/lib/i18n";
import { playCrashSound, playDeadEndSound, playWinSound } from "@/lib/sounds";
import {
  SURVIVAL_START_HEARTS,
  SURVIVAL_UNDOS,
  comboMultiplier,
  levelIdForRound,
  readSurvivalBest,
  roundTimeMs,
  scoreForClear,
  writeSurvivalBest,
  type SurvivalBest,
} from "@/lib/survival";

type Phase = "intro" | "playing" | "over";
type Banner = { title: string; detail: string; tone: "gain" | "loss" };

/** Draws a board for a round, mechanics and all. */
function buildBoard(round: number) {
  const generated = generateLevel(levelIdForRound(round));
  const level: LevelResponse = {
    id: generated.id,
    gridSize: generated.gridSize,
    start: generated.start,
    nodes: generated.nodes,
    isLocked: false,
    isCompleted: false,
  };
  return { level, mechanics: getLevelMechanics(generated, generated.solution) };
}

/**
 * Rift Survival: endless boards, a shrinking clock and three hearts. Nothing
 * here touches campaign progress — the run lives and dies on this screen.
 */
export default function Survival() {
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);

  const [best, setBest] = useState<SurvivalBest>(readSurvivalBest);
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState(1);
  const [boardSeed, setBoardSeed] = useState(0);
  const [hearts, setHearts] = useState(SURVIVAL_START_HEARTS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [undosLeft, setUndosLeft] = useState(SURVIVAL_UNDOS);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const canvasRef = useRef<GameCanvasHandle>(null);
  const heartsRef = useRef(SURVIVAL_START_HEARTS);
  const undosRef = useRef(SURVIVAL_UNDOS);
  const streakRef = useRef(0);
  const roundRef = useRef(1);
  const deadlineRef = useRef(0);
  const clearedRef = useRef(false);
  const savedRef = useRef(false);
  const hiddenAtRef = useRef(0);
  const bannerTimerRef = useRef(0);

  // `boardSeed` is a deliberately unused dependency: bumping it rolls a new board.
  const board = useMemo(() => buildBoard(round), [round, boardSeed]);
  const duration = useMemo(
    () => roundTimeMs(board.level.nodes.length, round),
    [board.level.nodes.length, round],
  );

  const flashBanner = useCallback((next: Banner, ms = 1100) => {
    window.clearTimeout(bannerTimerRef.current);
    setBanner(next);
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), ms);
  }, []);

  useEffect(() => () => window.clearTimeout(bannerTimerRef.current), []);

  /** A lost heart re-rolls the current board, or ends the run on the last one. */
  const loseHeart = useCallback(() => {
    const next = Math.max(0, heartsRef.current - 1);
    heartsRef.current = next;
    setHearts(next);
    streakRef.current = 0;
    setStreak(0);
    setStuck(false);
    undosRef.current = SURVIVAL_UNDOS;
    setUndosLeft(SURVIVAL_UNDOS);

    if (next <= 0) {
      playCrashSound();
      setPhase("over");
      return;
    }

    playDeadEndSound();
    flashBanner({ title: "\u22121 \u2665", detail: upper(t("survivalHearts")), tone: "loss" }, 1400);
    setBoardSeed(seed => seed + 1);
  }, [flashBanner, t]);

  const startRun = useCallback(() => {
    heartsRef.current = SURVIVAL_START_HEARTS;
    undosRef.current = SURVIVAL_UNDOS;
    streakRef.current = 0;
    roundRef.current = 1;
    clearedRef.current = false;
    savedRef.current = false;
    setHearts(SURVIVAL_START_HEARTS);
    setUndosLeft(SURVIVAL_UNDOS);
    setStreak(0);
    setScore(0);
    setRound(1);
    setBoardSeed(seed => seed + 1);
    setBanner(null);
    setStuck(false);
    setPhase("playing");
  }, []);

  // The round clock. It is a deadline, not a counter, so a slow frame can never
  // drift the timer away from real time.
  useEffect(() => {
    if (phase !== "playing") return;
    clearedRef.current = false;
    deadlineRef.current = performance.now() + duration;
    setTimeLeftMs(duration);

    const interval = window.setInterval(() => {
      if (clearedRef.current) return;
      const left = deadlineRef.current - performance.now();
      setTimeLeftMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(interval);
        loseHeart();
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [duration, loseHeart, phase]);

  // A backgrounded tab must not eat the clock.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
      } else if (hiddenAtRef.current > 0) {
        deadlineRef.current += performance.now() - hiddenAtRef.current;
        hiddenAtRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleComplete = useCallback(() => {
    if (clearedRef.current) return;
    clearedRef.current = true;

    const remaining = Math.max(0, deadlineRef.current - performance.now());
    const gained = scoreForClear(roundRef.current, remaining, streakRef.current);
    const multiplier = comboMultiplier(streakRef.current);

    playWinSound();
    setScore(total => total + gained);
    streakRef.current += 1;
    setStreak(streakRef.current);
    flashBanner({ title: `+${gained}`, detail: `\u00d7${multiplier}`, tone: "gain" }, 1200);

    window.setTimeout(() => {
      roundRef.current += 1;
      undosRef.current = SURVIVAL_UNDOS;
      setUndosLeft(SURVIVAL_UNDOS);
      setRound(roundRef.current);
      setBoardSeed(seed => seed + 1);
      setStuck(false);
    }, 1000);
  }, [flashBanner]);

  /** One free rewind per board; after that a dead end costs a heart. */
  const handleBacktrack = useCallback(() => {
    if (undosRef.current <= 0) return false;
    undosRef.current -= 1;
    setUndosLeft(undosRef.current);
    return true;
  }, []);

  useEffect(() => {
    if (phase !== "over" || savedRef.current) return;
    savedRef.current = true;
    const next: SurvivalBest = {
      bestRound: Math.max(best.bestRound, round),
      bestScore: Math.max(best.bestScore, score),
    };
    writeSurvivalBest(next);
    setBest(next);
  }, [best, phase, round, score]);

  const timeRatio = duration > 0 ? Math.max(0, Math.min(1, timeLeftMs / duration)) : 0;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const multiplier = comboMultiplier(streak);
  const urgent = timeLeftMs > 0 && timeLeftMs < 5_000;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0a0f1e]">
      <div className="menu-grid pointer-events-none absolute inset-0 z-0" />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 border-b border-primary/20 px-2 py-2 sm:px-4">
          <button
            onClick={() => setLocation("/")}
            aria-label={t("back")}
            className="p-2 text-primary/70 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="neon-text truncate font-orbitron text-sm font-bold uppercase tracking-[0.2em] text-primary sm:text-lg">
              {upper(t("survivalTitle"))}
            </h1>
            <p className="truncate font-exo text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {t("survivalTagline")}
            </p>
          </div>

          <div className="flex items-center gap-1" aria-label={t("survivalHearts")}>
            {Array.from({ length: SURVIVAL_START_HEARTS }, (_, index) => (
              <Heart
                key={index}
                className={`h-4 w-4 transition-colors ${
                  index < hearts ? "fill-rose-500 text-rose-500" : "text-white/20"
                }`}
              />
            ))}
          </div>

          {phase === "playing" && (
            <div
              className={`flex h-7 flex-shrink-0 items-center gap-1 border px-1.5 font-orbitron text-[11px] font-bold tabular-nums ${
                urgent
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-primary/30 text-primary/80"
              }`}
            >
              <Timer className="h-3 w-3" />
              {secondsLeft}s
            </div>
          )}
        </header>

        <div className="grid grid-cols-4 gap-2 border-b border-white/5 px-2 py-2 text-center sm:px-4">
          <Stat label={upper(t("survivalRound"))} value={String(round)} />
          <Stat label={upper(t("score"))} value={score.toLocaleString()} highlight />
          <Stat label={upper(t("survivalCombo"))} value={`\u00d7${multiplier}`} />
          <Stat label={upper(t("survivalBest"))} value={String(best.bestScore.toLocaleString())} />
        </div>

        <div className="relative h-1.5 w-full flex-shrink-0 bg-white/5">
          <div
            className={`h-full transition-[width] duration-100 ${
              urgent ? "bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.7)]" : "bg-primary"
            }`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>

        <main className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2">
          <AnimatePresence mode="wait">
            {phase === "playing" && (
              <motion.div
                key="board"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full max-w-3xl"
              >
                <GameCanvas
                  key={`${boardSeed}-${round}`}
                  ref={canvasRef}
                  level={board.level}
                  mechanics={board.mechanics}
                  showHint={false}
                  onComplete={handleComplete}
                  onBacktrack={handleBacktrack}
                  onStuckChange={setStuck}
                  disableUndo={undosLeft <= 0}
                  paused={phase !== "playing"}
                  reducedMotion={reducedMotion}
                  showGhost={false}
                  gridLabel={t("gridLabel", { size: board.level.gridSize })}
                  statusText={t("nodesConnectedStatus", {
                    connected: 1,
                    total: board.level.nodes.length,
                  })}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Round banner: score gained, or the heart that was just spent. */}
          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner.title + banner.detail}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                className={`pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 border px-4 py-2 text-center font-orbitron text-lg font-bold ${
                  banner.tone === "gain"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                }`}
              >
                {banner.title}
                <span className="ml-2 font-exo text-xs uppercase tracking-widest opacity-70">{banner.detail}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dead end: burn the free rewind or a heart, never soft-lock. */}
          {phase === "playing" && stuck && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center backdrop-blur-sm">
              <Skull className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <h2 className="font-orbitron text-xl font-bold uppercase tracking-wider text-destructive">
                  {upper(t("deadEnd"))}
                </h2>
                <p className="font-exo text-sm text-muted-foreground">
                  {undosLeft > 0
                    ? t("deadEndUndo", { count: undosLeft })
                    : t("survivalTagline")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {undosLeft > 0 && (
                  <Button
                    onClick={() => canvasRef.current?.undo()}
                    className="bg-primary font-bold text-background hover:bg-primary/90"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    {upper(t("undo"))}
                  </Button>
                )}
                <Button variant="outline" onClick={loseHeart} className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                  <Heart className="mr-2 h-4 w-4" />
                  {"\u22121"}
                </Button>
              </div>
            </div>
          )}

          {/* Intro and run-over cards. */}
          <AnimatePresence>
            {phase !== "playing" && (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="absolute inset-0 z-30 flex items-center justify-center px-4"
              >
                <div className="w-full max-w-md space-y-5 border border-primary/25 border-t-[3px] border-t-primary bg-background/95 p-6 text-center shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                  {phase === "over" ? (
                    <>
                      <Skull className="mx-auto h-10 w-10 text-destructive" />
                      <div className="space-y-1">
                        <h2 className="font-orbitron text-2xl font-black uppercase tracking-wide text-white">
                          {upper(t("survivalOver"))}
                        </h2>
                        <p className="font-exo text-sm text-muted-foreground">
                          {t("survivalOverDesc", { round, score: score.toLocaleString() })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border border-white/10 bg-background/60 p-3">
                        <Stat label={upper(t("survivalRound"))} value={String(round)} highlight />
                        <Stat label={upper(t("survivalBest"))} value={best.bestScore.toLocaleString()} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Zap className="mx-auto h-10 w-10 text-primary" />
                      <div className="space-y-2">
                        <h2 className="font-orbitron text-2xl font-black uppercase tracking-wide text-white">
                          {upper(t("survivalTitle"))}
                        </h2>
                        <p className="font-exo text-sm leading-relaxed text-muted-foreground">
                          {t("survivalRules")}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border border-white/10 bg-background/60 p-3">
                        <Stat label={upper(t("survivalBest"))} value={String(best.bestRound)} highlight />
                        <Stat label={upper(t("score"))} value={best.bestScore.toLocaleString()} />
                      </div>
                    </>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      onClick={startRun}
                      className="h-12 w-full bg-primary text-lg font-bold text-background shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:bg-primary/90"
                    >
                      {phase === "over" ? <RotateCcw className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                      {phase === "over" ? t("survivalPlayAgain") : upper(t("startGame"))}
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/")} className="border-white/10">
                      <Home className="mr-2 h-4 w-4" />
                      {t("menu")}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className={`font-orbitron text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="font-exo text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
