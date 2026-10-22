import { content } from "@/lib/contentText";
import { getChapterForLevel } from "@/lib/chapters";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { generateLevel } from "@shared/level-generator";
import { EMPTY_MECHANICS, getLevelMechanics, isValidPlayerPath, mirrorLevel } from "@shared/mechanics";
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
import { useI18n, upper } from "@/lib/i18n";
import { createRunClock, elapsedAt, pauseClock, resumeClock, setFrozen, startRun } from "@/lib/runClock";
import { playCrashSound, playDeadEndSound } from "@/lib/sounds";
import { CrashModal, DeadEndOverlay, LastAttemptConfirm } from "@/components/AttemptOverlays";
import { hasSeenIntro, markIntroSeen, MechanicIntro, MECHANIC_INTROS } from "@/components/MechanicIntro";
import {
  crashRun,
  getAttemptsUsed,
  getLevelRecord,
  getProgress,
  isFrontierLevel,
  markLevelPlayed,
  MAX_ATTEMPTS,
  startAttempt,
  recordDailyResult,
  TOTAL_LEVELS,
} from "@/lib/progress";

export type GameMode = "level" | "daily" | "weekly" | "zen";
type PauseReason = "manual" | "system";

interface GameProps {
  mode?: GameMode;
  [key: string]: unknown;
}

export default function Game({ mode = "level" }: GameProps) {
  const [, playParams] = useRoute("/play/:id");
  const [, zenParams] = useRoute("/zen/:id");
  const [, setLocation] = useLocation();

  // Pinned for the session: a timer tick past local midnight must not swap the
  // puzzle (and reset the board) under the player's line.
  const dailyKey = useMemo(() => getDateKey(), []);
  const dailyLevelId = useMemo(() => getDailyLevelId(dailyKey), [dailyKey]);
  const weeklyChallenge = useMemo(() => getWeeklyChallenge(), []);

  const parsedId = mode === "zen" ? Number(zenParams?.id) : Number(playParams?.id);
  const levelId = mode === "daily"
    ? dailyLevelId
    : mode === "weekly"
      ? weeklyChallenge.levelId
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
  const isScored = !isZen;
  const allowLocked = isDaily || isWeekly;

  const levelQuery = useLevel(levelId, userId, allowLocked);
  const updateProgressMutation = useUpdateProgress();
  const queryClient = useQueryClient();

  const weeklyModifier = isWeekly ? weeklyChallenge.modifier : null;
  const mirrored = weeklyModifier === "mirror";
  const timeAttack = weeklyModifier === "time-attack";
  const noHints = weeklyModifier === "no-hints";
  const noUndo = weeklyModifier === "no-undo";

  const generated = useMemo(
    () => (Number.isInteger(levelId) && levelId >= 1 && levelId <= TOTAL_LEVELS
      ? generateLevel(levelId)
      : null),
    [levelId],
  );

  const variant = useMemo(() => {
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
  }, [generated, levelQuery.data, mirrored]);

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
  /** False until the first reset has run: the fresh board needs no remount. */
  const hasResetOnceRef = useRef(false);
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

  // Attempt limit: frontier campaign levels allow three tries (two restarts);
  // failing the third crashes the run back to level 1.
  const [frontier, setFrontier] = useState(false);
  const frontierRef = useRef(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const attemptStartedRef = useRef(false);
  const [attemptStarted, setAttemptStarted] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [confirmCrash, setConfirmCrash] = useState(false);
  const [crash, setCrash] = useState<{ levelId: number; lost: number } | null>(null);
  const [introLevel, setIntroLevel] = useState<number | null>(null);
  const limited = mode === "level" && frontier;
  const attemptNumber = attemptStarted ? attemptsUsed : Math.min(MAX_ATTEMPTS, attemptsUsed + 1);

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
    attemptStartedRef.current = false;
    setAttemptStarted(false);
    setStuck(false);
    setConfirmCrash(false);
    // A brand-new canvas already opens on a clean path, so remounting it here
    // would only throw that board away and make the level fade in twice.
    if (hasResetOnceRef.current) setCanvasKey(previous => previous + 1);
    else hasResetOnceRef.current = true;
    usePowerUpsStore.getState().removeEffect("path_hint");
    usePowerUpsStore.getState().removeEffect("time_freeze");
  }, []);

  const crashNow = useCallback(() => {
    if (!userId) return;
    const lost = getProgress(userId).runCompleted.length;
    crashRun(userId);
    playCrashSound();
    frontierRef.current = true;
    setFrontier(true);
    setAttemptsUsed(0);
    setConfirmCrash(false);
    setStuck(false);
    setCrash({ levelId, lost });
    // Not the level query: it would lock this board under the crash screen.
    void queryClient.invalidateQueries({ queryKey: [api.progress.get.path] });
    void queryClient.invalidateQueries({ queryKey: [api.levels.list.path] });
  }, [levelId, queryClient, userId]);

  useEffect(() => {
    resetTransientState();
    setCrash(null);
    if (!userId) return;

    const progress = getProgress(userId);
    const record = getLevelRecord(progress, levelId);
    const dailyRecord = isDaily ? progress.daily.results[dailyKey] : null;
    const weeklyRecord = isWeekly ? getWeeklyResult(weeklyChallenge.weekKey) : null;

    setBestTimeMs(
      isDaily ? dailyRecord?.timeMs ?? null : isWeekly ? weeklyRecord?.timeMs ?? null : record?.bestTimeMs ?? null,
    );
    setBestScore(isDaily || isWeekly ? null : record?.bestScore ?? null);

    const isFrontier = mode === "level" && isFrontierLevel(progress, levelId);
    const used = isFrontier ? getAttemptsUsed(progress, levelId) : 0;
    frontierRef.current = isFrontier;
    setFrontier(isFrontier);
    setAttemptsUsed(used);
    // Leaving mid-attempt does not refund it: an abandoned third try is a crash.
    if (isFrontier && used >= MAX_ATTEMPTS) {
      crashNow();
      return;
    }

    setIntroLevel(mode === "level" && MECHANIC_INTROS[levelId] && !hasSeenIntro(levelId) ? levelId : null);

    if (mode === "level") {
      markLevelPlayed(userId, levelId);
      void queryClient.invalidateQueries({ queryKey: [api.progress.get.path, userId] });
    }
  }, [
    crashNow,
    dailyKey,
    isDaily,
    isWeekly,
    levelId,
    mode,
    queryClient,
    resetTransientState,
    userId,
    weeklyChallenge.weekKey,
  ]);

  // Kept apart from the reset effect: a background refetch of the level must not
  // wipe the line, but the saved ghost still needs to follow the current record.
  useEffect(() => {
    if (isDaily || isWeekly || !level || !generated || !userId) {
      setGhostPath(null);
      return;
    }
    const savedGhost = getLevelRecord(getProgress(userId), levelId)?.bestPath ?? null;
    const ghostMechanics = getLevelMechanics(level, generated.solution);
    setGhostPath(
      savedGhost && isValidPlayerPath(savedGhost, level, ghostMechanics) ? savedGhost : null,
    );
  }, [generated, isDaily, isWeekly, level, levelId, userId]);

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
    // The first move of an attempt is what spends it, so opening a level and
    // looking at it is free.
    if (pathLength > 1 && frontierRef.current && !attemptStartedRef.current && userId) {
      attemptStartedRef.current = true;
      setAttemptStarted(true);
      setAttemptsUsed(startAttempt(userId, levelId));
    }
  }, [isTimeFrozen, levelId, userId]);

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

  const canOfferHint = !noHints;

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
    setStuck(false);
    frontierRef.current = false;
    setFrontier(false);

    const colors = getThemeColors();
    const runTime = isScored ? getElapsed() : 0;
    setFinalTimeMs(runTime);

    const progressBefore = getProgress(userId);
    const recordBefore = getLevelRecord(progressBefore, levelId);
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
          title: t("achievementUnlocked", { name: content.achievement(achievement).name }),
          description: content.achievement(achievement).description,
        });
      });
      if (newlyUnlocked.length > 0) addTokens(newlyUnlocked.length);

      if (!wasCompleted && levelId % 5 === 0) {
        const reward = powerUps[Math.floor(levelId / 5) % powerUps.length];
        usePowerUpsStore.getState().addPowerUp(reward);
        toast({
          title: t("powerUpEarned"),
          description: t("powerUpEarnedDesc", { icon: reward.icon, name: reward.name }),
        });
      }
    }

    // Score Boost only covers campaign levels; practice, daily and weekly
    // runs never store a score, so consuming a charge there would waste it.
    if (mode === "level" && hasActiveEffect("score_multiplier")) {
      consumeEffectUse("score_multiplier");
    }
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
      setLocation(levelId < TOTAL_LEVELS ? `/play/${levelId + 1}` : "/");
    } else {
      setLocation("/");
    }
  };

  useEffect(() => {
    if (stuck && !hasWon) playDeadEndSound();
  }, [hasWon, stuck]);

  const handleRestart = useCallback(() => {
    if (frontierRef.current && attemptStartedRef.current && attemptsUsed >= MAX_ATTEMPTS) {
      setConfirmCrash(true);
      return;
    }
    resetTransientState();
  }, [attemptsUsed, resetTransientState]);

  const handleCrashRestart = () => {
    setCrash(null);
    if (levelId === 1) resetTransientState();
    else setLocation("/play/1");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (crash || confirmCrash || introLevel !== null) return;

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
  }, [confirmCrash, crash, introLevel, handleHint, handleRestart, hasWon, isScored, pauseReason, pauseGame, resumeGame]);

  const crashModal = (
    <CrashModal
      open={crash !== null}
      levelId={crash?.levelId ?? levelId}
      lostLevels={crash?.lost ?? 0}
      reducedMotion={reducedMotion}
      onRestartRun={handleCrashRestart}
      onMenu={() => {
        setCrash(null);
        setLocation("/");
      }}
    />
  );

  // A crash on entry (an abandoned last attempt) can lock this level before it
  // ever renders, so the crash screen must not depend on the board.
  if (crash && !level) {
    return <div className="h-screen w-screen bg-background">{crashModal}</div>;
  }

  if (levelQuery.isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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

  // The chapter gives every level a place in the campaign.
  const chapterName = mode === "level" ? upper(content.chapter(getChapterForLevel(levelId)).name) : undefined;

  const modeTitle = isDaily
    ? undefined
    : isWeekly
      ? upper(t("weeklyChallenge"))
      : isZen
        ? `ZEN · ${upper(t("level"))} ${levelId}`
        : undefined;
  const modeSubtitle = isWeekly
    ? t(weeklyModifierKeys[weeklyChallenge.modifier].label)
    : isZen
      ? t("practiceNoRecords")
      : undefined;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Header
        levelId={levelId}
        isDaily={isDaily}
        title={modeTitle}
        subtitle={limited ? `${upper(t("attemptOf", { n: attemptNumber, max: MAX_ATTEMPTS }))} · ${chapterName}` : modeSubtitle ?? chapterName}
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
        restartsLeft={limited ? MAX_ATTEMPTS - attemptNumber : undefined}
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
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: `${(connectedCount / level.nodes.length) * 100}%` }}
        />
      </div>

      {(mechanics.oneWays.length > 0 || mechanics.pairs.length > 0 || mechanics.portals.length > 0
        || mechanics.syncNodes.length > 0 || mechanics.blackout) && (
        <div className="flex items-center gap-x-3 gap-y-0.5 overflow-x-auto whitespace-nowrap border-b border-white/5 bg-background/40 px-2 py-1 font-exo text-[10px] text-muted-foreground sm:flex-wrap sm:justify-center sm:whitespace-normal">
          {mechanics.oneWays.length > 0 && <span>{t("symbolOneWay")}</span>}
          {mechanics.pairs.length > 0 && <span>{t("symbolPairs")}</span>}
          {mechanics.portals.length > 0 && <span>{t("symbolPortals")}</span>}
          {mechanics.syncNodes.length > 0 && <span className="text-emerald-300/90">{t("symbolSync")}</span>}
          {mechanics.blackout && <span className="text-indigo-300/90">{t("symbolBlackout")}</span>}
        </div>
      )}

      <main className="relative flex w-full flex-1 items-center justify-center overflow-hidden px-2 py-2 md:px-4 md:py-4">
        <div className="menu-grid pointer-events-none absolute inset-0 z-0" />
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <div className="h-full max-h-[calc(100vh-120px)] w-full max-w-4xl">
            <GameCanvas
              key={canvasKey}
              ref={canvasRef}
              level={level}
              mechanics={mechanics}
              ghostPath={!isDaily && !isWeekly && !mechanics.blackout ? ghostPath : null}
              showGhost={showGhost}
              disableUndo={noUndo || backtracks >= MAX_BACKTRACKS}
              gridLabel={t("gridLabel", { size: level.gridSize })}
              statusText={t("nodesConnectedStatus", { connected: connectedCount, total: level.nodes.length })}
              onComplete={handleWin}
              showHint={showHint}
              hintPath={hintPath}
              onBacktrack={handleBacktrack}
              onPathChange={handlePathChange}
              onStuckChange={setStuck}
              reducedMotion={reducedMotion}
              paused={hasWon || pauseReason !== null || confirmCrash || crash !== null || introLevel !== null}
            />
          </div>
        </div>

        {pauseReason !== null && !hasWon && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
              <Pause className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="font-orbitron text-2xl font-bold tracking-wide">{t("paused")}</h2>
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
        <DeadEndOverlay
          open={stuck && !hasWon && pauseReason === null && crash === null}
          undoLeft={noUndo ? 0 : Math.max(0, MAX_BACKTRACKS - backtracks)}
          attemptsLeft={limited ? MAX_ATTEMPTS - attemptNumber : null}
          onUndo={() => canvasRef.current?.undo()}
          onRestart={() => (limited && attemptNumber >= MAX_ATTEMPTS ? crashNow() : resetTransientState())}
        />
        <MechanicIntro
          levelId={introLevel}
          onClose={() => {
            if (introLevel !== null) markIntroSeen(introLevel);
            setIntroLevel(null);
          }}
        />
        <LastAttemptConfirm
          open={confirmCrash && crash === null}
          onCancel={() => setConfirmCrash(false)}
          onConfirm={crashNow}
        />
      </main>

      {crashModal}

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
