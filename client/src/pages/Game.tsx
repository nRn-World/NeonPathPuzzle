import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { generateLevel, isValidSolutionPath } from "@shared/level-generator";
import { EMPTY_MECHANICS, getLevelMechanics, mirrorLevel } from "@shared/mechanics";
import type { Point } from "@shared/schema";
import confetti from "canvas-confetti";
import { Loader2, Pause, Play } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLevel, useUpdateProgress, useUserId } from "@/hooks/use-game";
import { usePowerUps, usePowerUpsStore } from "@/hooks/use-powerups";
import { useAchievements } from "@/hooks/use-achievements";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { useSettingsStore } from "@/lib/settings";
import { useHintTokenStore } from "@/lib/hintTokens";
import { Header } from "@/components/Header";
import { GameCanvas, MAX_BACKTRACKS, type GameCanvasHandle } from "@/components/GameCanvas";
import { WinModal } from "@/components/WinModal";
import { Button } from "@/components/ui/button";
import { powerUps } from "@/lib/powerups";
import { calculateScore, calculateStars, getParTimeMs, type StarCount } from "@/lib/scoring";
import { getDailyLevelId, getDateKey } from "@/lib/daily";
import { getWeeklyChallenge, getWeeklyResult, saveWeeklyResult, weeklyModifierKeys } from "@/lib/weekly";
import { useI18n } from "@/lib/i18n";
import { customLevelToResponse, decodeCustomLevel } from "@/lib/customLevels";
import { createRunClock, elapsedAt, pauseClock, resumeClock, setFrozen, startRun } from "@/lib/runClock";
import {
  getLevelRecord,
  getProgress,
  markLevelPlayed,
  recordDailyResult,
} from "@/lib/progress";

export type GameMode = "level" | "daily" | "weekly" | "zen" | "custom";
type PauseReason = "manual" | "system";

interface GameProps {
  mode?: GameMode;
  customCode?: string;
  [key: string]: unknown;
}

export default function Game({ mode = "level", customCode }: GameProps) {
  const [, playParams] = useRoute("/play/:id");
  const [, zenParams] = useRoute("/zen/:id");
  const [, customParams] = useRoute("/custom/:code");
  const [, setLocation] = useLocation();

  const dailyKey = getDateKey();
  const dailyLevelId = getDailyLevelId(dailyKey);
  const weeklyChallenge = useMemo(() => getWeeklyChallenge(), []);
  const activeCustomCode = customCode ?? customParams?.code;
  const customResult = useMemo(
    () => (mode === "custom" && activeCustomCode ? decodeCustomLevel(activeCustomCode) : null),
    [mode, activeCustomCode],
  );

  const parsedId = mode === "zen" ? Number(zenParams?.id) : Number(playParams?.id);
  const levelId = mode === "daily"
    ? dailyLevelId
    : mode === "weekly"
      ? weeklyChallenge.levelId
      : mode === "custom"
        ? 0
        : parsedId;

  const userId = useUserId();
  const { activeEffects, hasActiveEffect, getEffectValue, consumeEffectUse } = usePowerUps();
  const { incrementProgress, checkAchievements } = useAchievements();
  const { getThemeColors } = useTheme();
  const { toast } = useToast();
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const showGhost = useSettingsStore(state => state.showGhost);
  const hintTokens = useHintTokenStore(state => state.tokens);
  const spendToken = useHintTokenStore(state => state.spendToken);
  const addTokens = useHintTokenStore(state => state.addTokens);

  const isZen = mode === "zen";
  const isDaily = mode === "daily";
  const isWeekly = mode === "weekly";
  const isCustom = mode === "custom";
  const isScored = !isZen && !isCustom;
  const allowLocked = isDaily || isWeekly;

  const levelQuery = useLevel(isCustom ? 1 : levelId, userId, allowLocked);
  const updateProgressMutation = useUpdateProgress();
  const queryClient = useQueryClient();

  const weeklyModifier = isWeekly ? weeklyChallenge.modifier : null;
  const mirrored = weeklyModifier === "mirror";
  const timeAttack = weeklyModifier === "time-attack";
  const noHints = weeklyModifier === "no-hints";
  const noUndo = weeklyModifier === "no-undo";

  const generated = useMemo(
    () => (!isCustom && Number.isInteger(levelId) && levelId >= 1 && levelId <= 200
      ? generateLevel(levelId)
      : null),
    [isCustom, levelId],
  );

  const variant = useMemo(() => {
    if (isCustom) {
      if (!customResult) return null;
      if (!customResult.ok) return null;
      const level = customLevelToResponse(customResult.level.data);
      return { level, solution: level.nodes, mechanics: EMPTY_MECHANICS };
    }

    const raw = levelQuery.data;
    if (!raw || !generated) return null;
    const source = mirrored
      ? mirrorLevel(raw, generated.solution)
      : { level: raw, solution: generated.solution };
    return {
      level: source.level,
      solution: source.solution,
      mechanics: getLevelMechanics(source.level, source.solution),
    };
  }, [customResult, generated, isCustom, levelQuery.data, mirrored]);

  const level = variant?.level;
  const mechanics = variant?.mechanics ?? EMPTY_MECHANICS;
  const hintPath = variant?.solution;

  const canvasRef = useRef<GameCanvasHandle>(null);
  const wonRef = useRef(false);
  const clockRef = useRef(createRunClock());
  const backtracksRef = useRef(0);

  const [showHint, setShowHint] = useState(false);
  const [hintUsedThisLevel, setHintUsedThisLevel] = useState(false);
  const [hintPaidWithTokens, setHintPaidWithTokens] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [backtracks, setBacktracks] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState<StarCount>(1);
  const [starReasons, setStarReasons] = useState<string[]>([]);
  const [flawlessRun, setFlawlessRun] = useState(false);
  const [bestTimeMs, setBestTimeMs] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [ghostPath, setGhostPath] = useState<Point[] | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [isNewBestScore, setIsNewBestScore] = useState(false);
  const [connectedCount, setConnectedCount] = useState(1);
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);

  const parTimeMs = level
    ? Math.round(
      getParTimeMs(level.nodes.length)
      * mechanics.parMultiplier
      * (timeAttack ? 0.75 : 1),
    )
    : 0;

  const freezeEffect = activeEffects.find(effect => effect.type === "time_freeze");
  const freezeEndAt = freezeEffect?.endTime ?? null;
  const [isFrozen, setIsFrozen] = useState(false);
  const pathRevealActive = activeEffects.some(
    effect => effect.type === "path_hint" && (!effect.endTime || Date.now() <= effect.endTime),
  );

  const getElapsed = useCallback(() => elapsedAt(clockRef.current, Date.now()), []);

  const isTimeFrozen = useCallback(
    () => usePowerUpsStore.getState().hasActiveEffect("time_freeze"),
    [],
  );

  const pauseGame = useCallback((reason: PauseReason = "manual") => {
    if (wonRef.current || clockRef.current.pausedAt !== null || !isScored) return;
    // Settle the freeze clock before pausing so stopped time is credited once, not twice.
    clockRef.current = pauseClock(clockRef.current, Date.now());
    setPauseReason(reason);
  }, [isScored]);

  const resumeGame = useCallback(() => {
    clockRef.current = resumeClock(clockRef.current, Date.now(), isTimeFrozen());
    setPauseReason(null);
  }, [isTimeFrozen]);

  const resetTransientState = useCallback(() => {
    wonRef.current = false;
    clockRef.current = createRunClock();
    setShowHint(false);
    setHintUsedThisLevel(false);
    setHintPaidWithTokens(false);
    setHasWon(false);
    setMistakes(0);
    backtracksRef.current = 0;
    setBacktracks(0);
    setElapsedMs(0);
    setFinalTimeMs(0);
    setScore(0);
    setStars(1);
    setStarReasons([]);
    setFlawlessRun(false);
    setIsNewBest(false);
    setIsNewBestScore(false);
    setConnectedCount(1);
    setPauseReason(null);
    setCanUndo(false);
    setTimerRunning(false);
    setDailyStreak(0);
    setCanvasKey(previous => previous + 1);
    usePowerUpsStore.getState().removeEffect("path_hint");
    usePowerUpsStore.getState().removeEffect("time_freeze");
  }, []);

  useEffect(() => {
    resetTransientState();
    if (!userId) return;

    if (isCustom) {
      setBestTimeMs(null);
      setBestScore(null);
      setGhostPath(null);
      return;
    }

    const progress = getProgress(userId);
    const record = getLevelRecord(progress, levelId);
    const dailyRecord = isDaily ? progress.daily.results[dailyKey] : null;
    const weeklyRecord = isWeekly ? getWeeklyResult(weeklyChallenge.weekKey) : null;

    setBestTimeMs(
      isDaily ? dailyRecord?.timeMs ?? null : isWeekly ? weeklyRecord?.timeMs ?? null : record?.bestTimeMs ?? null,
    );
    setBestScore(isDaily || isWeekly ? null : record?.bestScore ?? null);
    const savedGhost = record?.bestPath ?? null;
    setGhostPath(
      !isDaily && !isWeekly && savedGhost && generated && isValidSolutionPath(savedGhost, generated)
        ? savedGhost
        : null,
    );

    if (mode === "level") {
      markLevelPlayed(userId, levelId);
      void queryClient.invalidateQueries({ queryKey: [api.progress.get.path, userId] });
    }
  }, [
    dailyKey,
    isCustom,
    isDaily,
    isWeekly,
    levelId,
    generated,
    mode,
    queryClient,
    resetTransientState,
    userId,
    weeklyChallenge.weekKey,
  ]);

  useEffect(() => {
    if (!timerRunning || hasWon || !isScored) return;
    const tick = () => setElapsedMs(getElapsed());
    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [getElapsed, hasWon, isScored, timerRunning]);

  // The freeze expiry cannot wait for a render: a frozen clock keeps the shown
  // time constant, so React would never recompute the effect's end time.
  useEffect(() => {
    if (!freezeEffect) {
      setIsFrozen(false);
      return;
    }
    if (freezeEndAt === null) {
      setIsFrozen(true);
      return;
    }
    const remaining = freezeEndAt - Date.now();
    if (remaining <= 0) {
      setIsFrozen(false);
      return;
    }
    setIsFrozen(true);
    const timeout = window.setTimeout(() => {
      setIsFrozen(false);
      usePowerUpsStore.getState().removeEffect("time_freeze");
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [freezeEffect, freezeEndAt]);

  useEffect(() => {
    clockRef.current = setFrozen(clockRef.current, Date.now(), isFrozen);
  }, [isFrozen]);

  useEffect(() => {
    if (!pathRevealActive || !hintPath?.length) return;
    setShowHint(true);
    const timeout = window.setTimeout(() => {
      setShowHint(false);
      usePowerUpsStore.getState().removeEffect("path_hint");
    }, 5_000);
    return () => window.clearTimeout(timeout);
  }, [hintPath, pathRevealActive]);

  useEffect(() => {
    if (!showHint || pathRevealActive) return;
    const timeout = window.setTimeout(() => setShowHint(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [pathRevealActive, showHint]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseGame("system");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pauseGame]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) pauseGame("system");
    });
    return () => {
      void listener.then(entry => entry.remove());
    };
  }, [pauseGame]);

  const handlePathChange = useCallback((visitedNodes: number, pathLength = 1) => {
    setConnectedCount(visitedNodes);
    setCanUndo(pathLength > 1);
    if (pathLength > 1 && clockRef.current.startedAt === null) {
      clockRef.current = startRun(clockRef.current, Date.now(), isTimeFrozen());
      setTimerRunning(true);
    }
  }, [isTimeFrozen]);

  const handleBacktrack = useCallback((): boolean => {
    if (hasWon || backtracksRef.current >= MAX_BACKTRACKS) return false;
    backtracksRef.current += 1;
    setBacktracks(backtracksRef.current);

    if (hasActiveEffect("undo_protection")) {
      usePowerUpsStore.getState().removeEffect("undo_protection");
      return true;
    }
    setMistakes(current => current + 1);
    return true;
  }, [hasActiveEffect, hasWon]);

  const canOfferHint = !isCustom && !noHints;

  const handleHint = useCallback(() => {
    if (!canOfferHint || showHint || hintUsedThisLevel || !hintPath?.length) return;

    if (!isZen) {
      if (hintTokens <= 0) {
        toast({
          title: t("hintTokenEmpty"),
          description: t("hintTokenEmptyDesc"),
        });
        return;
      }
      if (!spendToken()) return;
      setHintPaidWithTokens(true);
    }

    setShowHint(true);
    setHintUsedThisLevel(true);
  }, [
    canOfferHint,
    hintPath,
    hintTokens,
    hintUsedThisLevel,
    isZen,
    showHint,
    spendToken,
    t,
    toast,
  ]);

  const handleWin = useCallback((moves: number, completedPath: Point[]) => {
    if (wonRef.current || hasWon || !level || !userId) return;
    wonRef.current = true;
    setHasWon(true);
    setShowHint(false);

    const colors = getThemeColors();
    const runTime = isScored ? getElapsed() : 0;
    setFinalTimeMs(runTime);

    const progressBefore = getProgress(userId);
    const recordBefore = isCustom ? null : getLevelRecord(progressBefore, levelId);
    const dailyRecordBefore = isDaily ? progressBefore.daily.results[dailyKey] : undefined;
    const weeklyRecordBefore = isWeekly ? getWeeklyResult(weeklyChallenge.weekKey) : null;
    const previousBest = isDaily
      ? dailyRecordBefore?.timeMs ?? null
      : isWeekly
        ? weeklyRecordBefore?.timeMs ?? null
        : recordBefore?.bestTimeMs ?? null;

    const finalStars = isScored
      ? calculateStars({
        mistakes,
        hintsUsed: hintUsedThisLevel && !hintPaidWithTokens,
        timeMs: runTime,
        parTimeMs,
      })
      : 3;
    const multiplier = getEffectValue("score_multiplier");
    const finalScore = calculateScore({
      nodeCount: level.nodes.length,
      stars: finalStars,
      timeMs: runTime,
      multiplier,
    });

    const reasons: string[] = [];
    if (isScored) {
      if (hintUsedThisLevel && !hintPaidWithTokens) reasons.push(t("usedHint"));
      if (mistakes > 0) reasons.push(t(mistakes === 1 ? "backtrack" : "backtracks", { count: mistakes }));
      if (runTime > parTimeMs) reasons.push(t("overPar"));
      if (reasons.length === 0 && !hintUsedThisLevel) reasons.push(t("flawless"));
    }
    setFlawlessRun(isScored && reasons.length === 1 && reasons[0] === t("flawless"));

    setStars(finalStars);
    setScore(finalScore);
    setStarReasons(reasons);
    setIsNewBest(isScored && (previousBest === null || runTime < previousBest));
    setIsNewBestScore(isScored && !isDaily && !isWeekly
      && (recordBefore?.bestScore === null || recordBefore?.bestScore === undefined
        || finalScore > recordBefore.bestScore));
    setBestTimeMs(current => (!isScored
      ? current
      : current === null ? runTime : Math.min(current, runTime)));
    setBestScore(current => (isScored && !isDaily && !isWeekly
      ? current === null ? finalScore : Math.max(current, finalScore)
      : current));
    if (isScored && !isDaily && !isWeekly && (previousBest === null || runTime <= previousBest)) {
      setGhostPath(completedPath);
    }

    if (isDaily) {
      const daily = recordDailyResult(userId, dailyKey, {
        levelId,
        timeMs: runTime,
        stars: finalStars,
      });
      setDailyStreak(daily.streak);
      if (!dailyRecordBefore) addTokens(1);
      void queryClient.invalidateQueries({ queryKey: [api.progress.get.path, userId] });
    } else if (isWeekly) {
      saveWeeklyResult({
        weekKey: weeklyChallenge.weekKey,
        levelId,
        modifier: weeklyChallenge.modifier,
        timeMs: runTime,
        stars: finalStars,
        completedAt: Date.now(),
      });
      if (!weeklyRecordBefore) addTokens(1);
      void queryClient.invalidateQueries({ queryKey: [api.progress.get.path, userId] });
    } else if (mode === "level") {
      updateProgressMutation.mutate({
        userId,
        levelId,
        completed: true,
        hintsUsed: hintUsedThisLevel,
        stars: finalStars,
        timeMs: runTime,
        moves,
        mistakes,
        score: finalScore,
        path: completedPath,
      });

      const wasCompleted = recordBefore?.completed ?? level.isCompleted;
      if (!wasCompleted) {
        incrementProgress("levels_completed");
        if (levelId % 10 === 0) {
          addTokens(1);
          toast({ title: t("hintTokenEarned"), description: t("hintTokenEarnedDesc") });
        }
      }
      if (!wasCompleted && mistakes === 0) incrementProgress("perfect_levels");
      if (!wasCompleted && !hintUsedThisLevel) incrementProgress("no_hints_used");
      if (runTime < 30_000) incrementProgress("speed_run");
      const newlyUnlocked = checkAchievements();
      newlyUnlocked.forEach(achievement => {
        toast({
          title: `Achievement: ${achievement.name}`,
          description: achievement.description,
        });
      });
      if (newlyUnlocked.length > 0) addTokens(newlyUnlocked.length);

      if (!wasCompleted && levelId % 5 === 0) {
        const reward = powerUps[Math.floor(levelId / 5) % powerUps.length];
        usePowerUpsStore.getState().addPowerUp(reward);
        toast({
          title: "Power-up earned",
          description: `${reward.icon} ${reward.name} added to your inventory.`,
        });
      }
    }

    if (hasActiveEffect("score_multiplier")) consumeEffectUse("score_multiplier");
    usePowerUpsStore.getState().removeEffect("time_freeze");
    usePowerUpsStore.getState().removeEffect("path_hint");

    if (!reducedMotion && isScored) {
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.6 },
        colors: colors.neon,
      });
    }
  }, [
    addTokens,
    checkAchievements,
    consumeEffectUse,
    dailyKey,
    getEffectValue,
    getElapsed,
    getThemeColors,
    hasActiveEffect,
    hasWon,
    hintPaidWithTokens,
    hintUsedThisLevel,
    incrementProgress,
    isCustom,
    isDaily,
    isScored,
    isWeekly,
    level,
    levelId,
    mistakes,
    mode,
    parTimeMs,
    t,
    queryClient,
    reducedMotion,
    toast,
    updateProgressMutation,
    userId,
    weeklyChallenge.modifier,
    weeklyChallenge.weekKey,
  ]);

  const handleNext = () => {
    if (mode === "level") {
      setLocation(levelId < 200 ? `/play/${levelId + 1}` : "/");
    } else {
      setLocation("/");
    }
  };

  const handleRestart = useCallback(() => {
    resetTransientState();
  }, [resetTransientState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      if (event.key === "Escape" || event.key.toLowerCase() === "p") {
        if (!isScored) return;
        event.preventDefault();
        if (pauseReason) resumeGame();
        else pauseGame("manual");
        return;
      }

      if (hasWon || pauseReason) return;

      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        handleHint();
      } else if (key === "r") {
        event.preventDefault();
        handleRestart();
      } else if (key === "u" || key === "z") {
        event.preventDefault();
        canvasRef.current?.undo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleHint, handleRestart, hasWon, isScored, pauseReason, pauseGame, resumeGame]);

  if (levelQuery.isLoading && !isCustom) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isCustom && customResult && !customResult.ok) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h2 className="text-2xl font-bold text-destructive">{t("customUnavailable")}</h2>
        <p className="max-w-sm text-muted-foreground">{customResult.error}</p>
        <Button onClick={() => setLocation("/editor")}>{t("openEditor")}</Button>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-destructive">
        <h2 className="text-2xl font-bold">{t("levelUnavailable")}</h2>
        <p className="text-muted-foreground">
          {t("levelUnavailableDesc")}
        </p>
        <button onClick={() => setLocation("/")} className="underline">
          {t("returnToMenu")}
        </button>
      </div>
    );
  }

  const potentialStars = calculateStars({
    mistakes,
    hintsUsed: hintUsedThisLevel && !hintPaidWithTokens,
    timeMs: elapsedMs,
    parTimeMs,
  });

  const modeTitle = isDaily
    ? undefined
    : isWeekly
      ? t("weeklyChallenge").toUpperCase()
      : isZen
        ? `ZEN · ${t("level").toUpperCase()} ${levelId}`
        : isCustom
          ? customResult?.ok ? customResult.level.data.name : "CUSTOM CIRCUIT"
          : undefined;
  const modeSubtitle = isWeekly
    ? t(weeklyModifierKeys[weeklyChallenge.modifier].label)
    : isZen
      ? t("practiceNoRecords")
      : isCustom
        ? t("customCircuit").toUpperCase()
        : undefined;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Header
        levelId={levelId}
        isDaily={isDaily}
        title={modeTitle}
        subtitle={modeSubtitle}
        timeMs={elapsedMs}
        stars={hasWon ? stars : potentialStars}
        isFrozen={isFrozen}
        parTimeMs={parTimeMs}
        isBoss={mechanics.isBoss}
        hideTimer={isZen}
        hideStars={isZen}
        hintTokens={isZen ? -1 : hintTokens}
        hintDisabled={!canOfferHint}
        onHint={handleHint}
        hintsUsed={hintUsedThisLevel}
        isHintLoading={false}
        onUndo={() => canvasRef.current?.undo()}
        canUndo={canUndo && !hasWon && !noUndo && backtracks < MAX_BACKTRACKS}
        undoDisabled={noUndo}
        undoRemaining={Math.max(0, MAX_BACKTRACKS - backtracks)}
        onRestart={handleRestart}
      />

      <div
        className="h-1 w-full flex-shrink-0 bg-white/5"
        role="progressbar"          aria-label={t("nodesConnected")}
        aria-valuemin={1}
        aria-valuemax={level.nodes.length}
        aria-valuenow={connectedCount}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-200"
          style={{ width: `${(connectedCount / level.nodes.length) * 100}%` }}
        />
      </div>

      {(mechanics.oneWays.length > 0 || mechanics.pairs.length > 0 || mechanics.portals.length > 0) && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-b border-white/5 bg-background/40 px-2 py-1 font-exo text-[10px] text-muted-foreground">
          {mechanics.oneWays.length > 0 && <span>{t("symbolOneWay")}</span>}
          {mechanics.pairs.length > 0 && <span>{t("symbolPairs")}</span>}
          {mechanics.portals.length > 0 && <span>{t("symbolPortals")}</span>}
        </div>
      )}

      <main className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-2 py-2 md:px-4 md:py-4">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <div className="h-full max-h-[calc(100vh-120px)] w-full max-w-4xl">
            <GameCanvas
              key={canvasKey}
              ref={canvasRef}
              level={level}
              mechanics={mechanics}
              ghostPath={!isDaily && !isWeekly && !isCustom ? ghostPath : null}
              showGhost={showGhost}
              disableUndo={noUndo || backtracks >= MAX_BACKTRACKS}
              gridLabel={t("gridLabel", { size: level.gridSize })}
              statusText={t("nodesConnectedStatus", { connected: connectedCount, total: level.nodes.length })}
              onComplete={handleWin}
              showHint={showHint}
              hintPath={hintPath}
              onBacktrack={handleBacktrack}
              onPathChange={handlePathChange}
              reducedMotion={reducedMotion}
              paused={hasWon || pauseReason !== null}
            />
          </div>
        </div>

        {pauseReason !== null && !hasWon && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <Pause className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="font-orbitron text-2xl font-bold tracking-wide">PAUSED</h2>
              <p className="max-w-xs font-exo text-sm text-muted-foreground">
                {pauseReason === "system" ? t("pausedSystem") : t("pausedManual")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={resumeGame}
                className="bg-primary font-bold text-background hover:bg-primary/90"
              >
                <Play className="mr-2 h-4 w-4" />
                {t("resume")}
              </Button>
              <Button variant="outline" onClick={handleRestart} className="border-white/15">
                {t("restartLevel")}
              </Button>
            </div>
            <p className="font-exo text-[11px] text-muted-foreground/70">
              {t("pressResume")}
            </p>
          </div>
        )}
      </main>

      <WinModal
        isOpen={hasWon}
        levelId={levelId}
        score={score}
        stars={stars}
        timeMs={finalTimeMs || elapsedMs}
        bestTimeMs={bestTimeMs}
        bestScore={bestScore}
        isNewBest={isNewBest}
        isNewBestScore={isNewBestScore}
        isDaily={isDaily}
        isWeekly={isWeekly}
        isZen={isZen}
        isCustom={isCustom}
        customName={customResult?.ok ? customResult.level.data.name : undefined}
        customCode={isCustom ? activeCustomCode : undefined}
        dailyStreak={dailyStreak}
        starReasons={starReasons}
        flawless={flawlessRun}
        parTimeMs={parTimeMs}
        onNext={handleNext}
        onReplay={resetTransientState}
      />
    </div>
  );
}
