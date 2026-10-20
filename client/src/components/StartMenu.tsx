import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Heart,
  HelpCircle,
  Lock,
  PenLine,
  Play,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { ChapterBoard } from "@/components/ChapterBoard";
import { DailyCard } from "@/components/DailyCard";
import { WeeklyCard } from "@/components/WeeklyCard";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { formatDuration } from "@/lib/scoring";
import { getLevelFromCode } from "@/lib/levelCodes";
import { getLevelMessage } from "@/lib/levelMessages";
import { useLevels, useUserProgress, useUserId } from "@/hooks/use-game";
import { unlockLevelsThroughCode } from "@/lib/sessionLevelUnlock";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/lib/settings";
import { getProgress, markTutorialSeen, TOTAL_LEVELS } from "@/lib/progress";
import { playClickSound } from "@/lib/sounds";
import { useI18n } from "@/lib/i18n";

type MenuScreen = "main" | "info" | "completed";

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getThemeColors } = useTheme();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animation = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      context.clearRect(0, 0, width, height);
      const colors = getThemeColors();

      particles.forEach(particle => {
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = colors.primary + Math.floor(particle.alpha * 255).toString(16).padStart(2, "0");
        context.fill();

        if (reducedMotion) return;
        particles.forEach(other => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 150) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = colors.primary
              + Math.floor(0.1 * (1 - distance / 150) * 255).toString(16).padStart(2, "0");
            context.lineWidth = 0.5;
            context.stroke();
          }
        });
      });

      if (!reducedMotion) animation = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, [getThemeColors, reducedMotion]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />;
}

function GlowingOrb({ className, color = "#00f3ff" }: { className?: string; color?: string }) {
  return (
    <div
      className={`absolute rounded-full opacity-30 blur-[100px] ${className}`}
      style={{ background: color }}
    />
  );
}

export function StartMenu() {
  const [screen, setScreen] = useState<MenuScreen>("main");
  const [activeTab, setActiveTab] = useState("levels");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [selectedLevelMessage, setSelectedLevelMessage] = useState<{ id: number; message: string } | null>(null);
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const userId = useUserId();
  const { data: levels, refetch } = useLevels(userId);
  const { data: summary } = useUserProgress(userId);
  const [tutorialOpen, setTutorialOpen] = useState(() => !getProgress(userId).tutorialSeen);

  const completedLevels = levels?.filter(level => level.isCompleted) ?? [];
  const completedCount = summary?.completedCount ?? completedLevels.length;
  const totalStars = summary?.totalStars ?? 0;
  const bestStreak = summary?.bestStreak ?? 0;
  const continueLevel = summary?.continueLevel ?? 1;
  const runCount = summary?.runCount ?? completedCount;
  const maxStars = TOTAL_LEVELS * 3;
  const hasProgress = completedCount > 0;
  const recordValues = Object.values(summary?.records ?? {});
  const threeStarClears = recordValues.filter(record => record.stars === 3).length;
  const bestTime = recordValues.reduce<number | null>((best, record) => {
    if (record.bestTimeMs === null) return best;
    return best === null ? record.bestTimeMs : Math.min(best, record.bestTimeMs);
  }, null);
  const totalScore = recordValues.reduce((total, record) => total + (record.bestScore ?? 0), 0);

  useEffect(() => {
    if (screen === "completed") void refetch();
  }, [screen, refetch]);

  const handleButtonClick = (callback: () => void) => {
    playClickSound();
    callback();
  };

  const handleStartClick = () => {
    setLocation(`/play/${continueLevel}`);
  };

  const handleLevelClick = (levelId: number) => {
    setSelectedLevelMessage({ id: levelId, message: getLevelMessage(levelId) });
  };

  const handleCodeSubmit = () => {
    setCodeError("");
    const levelId = getLevelFromCode(codeInput);
    if (!levelId) {
      setCodeError(t("invalidCode"));
      return;
    }
    unlockLevelsThroughCode(levelId);
    setLocation(`/play/${levelId}`);
  };

  const finishTutorial = () => {
    markTutorialSeen(userId);
    setTutorialOpen(false);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0a0f1e]">
      <ParticleBackground />
      <GlowingOrb className="-left-40 -top-40 h-[600px] w-[600px]" color="#00f3ff" />
      <GlowingOrb className="-right-40 top-1/2 h-[500px] w-[500px]" color="#8a2be2" />
      <GlowingOrb className="-bottom-40 left-1/3 h-[400px] w-[400px]" color="#00f3ff" />

      <div className="relative z-10 h-full overflow-y-auto safe-scroll">
        <div className="flex min-h-screen flex-col items-center justify-start px-4 pb-14 pt-8 sm:pt-12">
          <AnimatePresence mode="wait">
            {screen === "main" && (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-3xl"
              >
                <div className="space-y-7 text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
                  >
                    <div className="relative inline-block">
                      <motion.div
                        animate={{
                          boxShadow: [
                            "0 0 20px rgba(0,243,255,0.25)",
                            "0 0 45px rgba(0,243,255,0.45)",
                            "0 0 20px rgba(0,243,255,0.25)",
                          ],
                        }}
                        transition={{ duration: 2.6, repeat: Infinity }}
                        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary sm:h-24 sm:w-24"
                      >
                        <Zap className="h-10 w-10 text-primary sm:h-12 sm:w-12" />
                      </motion.div>
                      <motion.div
                        className="absolute -inset-4 rounded-full border border-primary/30"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                  </motion.div>

                  <div>
                    <motion.h1
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="bg-gradient-to-r from-white via-primary to-white bg-clip-text font-orbitron text-4xl font-black tracking-wider text-transparent sm:text-6xl md:text-7xl"
                      style={{
                        textShadow: "0 0 40px rgba(0,243,255,0.5)",
                        filter: "drop-shadow(0 0 20px rgba(0,243,255,0.3))",
                      }}
                    >
                      NEON PATH
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="mt-3 font-exo text-lg text-cyan-200/80"
                    >
                      {t("startTagline")}
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleButtonClick(handleStartClick)}
                      className="group relative w-full overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/5 to-secondary/20 p-4 text-left shadow-[0_0_28px_rgba(0,243,255,0.18)] transition-all hover:border-primary/70 hover:shadow-[0_0_45px_rgba(0,243,255,0.32)] active:scale-[0.99]"
                    >
                      <span className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                      <span className="relative flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15 text-primary">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-exo text-[11px] uppercase tracking-[0.18em] text-primary/80">
                            {hasProgress ? t("continueGame") : t("startGame")}
                          </span>
                          <span className="block font-orbitron text-xl font-bold text-white sm:text-2xl">
                            {t("level").toUpperCase()} {continueLevel}
                          </span>
                        </span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                          style={{ width: `${Math.min(100, (runCount / TOTAL_LEVELS) * 100)}%` }}
                        />
                      </span>
                      <span className="relative mt-1.5 flex justify-between font-exo text-[10px] text-muted-foreground">
                        <span>{runCount}/{TOTAL_LEVELS} {t("levelsSolved")}</span>
                        <span>{totalStars}/{maxStars} <Star className="mb-0.5 inline h-3 w-3 fill-secondary text-secondary" /></span>
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <MenuButton
                        icon={<HelpCircle className="h-4 w-4" />}
                        label={t("howToPlay")}
                        onClick={() => handleButtonClick(() => setScreen("info"))}
                      />
                      <MenuButton
                        icon={<Trophy className="h-4 w-4" />}
                        label={t("completed")}
                        onClick={() => handleButtonClick(() => setScreen("completed"))}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <ThemeSelector />
                      <SettingsDialog />
                      <Button asChild variant="outline" size="sm" className="border-white/15">
                        <Link href="/editor">
                          <PenLine className="mr-1.5 h-3.5 w-3.5" />
                          {t("editor")}
                        </Link>
                      </Button>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3 text-left"
                  >
                    <DailyCard compact />
                    <WeeklyCard compact />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="text-left"
                  >
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="levels" className="gap-1.5 px-1 font-exo text-[11px] sm:text-sm">
                          <Star className="h-3.5 w-3.5" />
                          {t("chaptersTab")}
                        </TabsTrigger>
                        <TabsTrigger value="achievements" className="gap-1.5 px-1 font-exo text-[11px] sm:text-sm">
                          <Trophy className="h-3.5 w-3.5" />
                          {t("achievementsTab")}
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="gap-1.5 px-1 font-exo text-[11px] sm:text-sm">
                          <Zap className="h-3.5 w-3.5" />
                          {t("statsTab")}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="levels" className="mt-4">
                        <ChapterBoard levels={levels ?? []} continueLevel={continueLevel} />
                      </TabsContent>

                      <TabsContent value="achievements" className="mt-4">
                        <AchievementsPanel />
                      </TabsContent>

                      <TabsContent value="stats" className="mt-4">
                        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                          <StatCard label={t("levelsSolvedStat")} value={`${completedCount}/${TOTAL_LEVELS}`} />
                          <StatCard label={t("starsEarnedStat")} value={`${totalStars}/${maxStars}`} />
                          <StatCard label={t("threeStarClears")} value={String(threeStarClears)} />
                          <StatCard
                            label={t("bestTimeStat")}
                            value={bestTime !== null ? formatDuration(bestTime) : "—"}
                          />
                          <StatCard label={t("dailyStreak")} value={String(summary?.dailyStreak ?? 0)} />
                          <StatCard label={t("bestStreakStat")} value={String(bestStreak)} />
                          <StatCard
                            label={t("completion")}
                            value={`${Math.round((completedCount / TOTAL_LEVELS) * 100)}%`}
                          />
                          <StatCard label={t("totalScore")} value={totalScore.toLocaleString()} />
                          <StatCard label={t("runStat")} value={`${runCount}/${TOTAL_LEVELS}`} />
                          <StatCard label={t("crashesStat")} value={String(summary?.crashes ?? 0)} />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-5 backdrop-blur-sm"
                  >
                    <p className="mb-3 font-exo text-sm text-muted-foreground">
                      {t("haveLevelCode")}
                    </p>
                    <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="0000"
                        value={codeInput}
                        onChange={event => {
                          setCodeInput(event.target.value.replace(/\D/g, ""));
                          setCodeError("");
                        }}
                        onKeyDown={event => event.key === "Enter" && handleCodeSubmit()}
                        className="min-w-0 rounded-lg border border-primary/30 bg-white/5 px-3 py-3 text-center font-mono text-2xl font-bold text-primary placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:shadow-[0_0_20px_rgba(0,243,255,0.2)]"
                      />
                      <Button
                        onClick={handleCodeSubmit}
                        disabled={codeInput.length !== 4}
                        className="h-full w-full bg-secondary font-bold text-black hover:bg-secondary/90 disabled:opacity-30"
                      >
                        {t("go").toUpperCase()}
                      </Button>
                    </div>
                    {codeError && <p className="mt-2 font-exo text-sm text-destructive">{codeError}</p>}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="flex justify-center gap-8 pt-1"
                  >
                    <Stat value={completedCount} label={t("completed").toUpperCase()} tone="primary" />
                    <Divider />
                    <Stat value={totalStars} label={t("stars").toUpperCase()} tone="secondary" />
                    <Divider />
                    <Stat value={bestStreak} label={t("bestStreak").toUpperCase()} tone="primary" />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="pt-4 text-center"
                  >
                    <p className="font-exo text-xs text-muted-foreground/60">
                      {t("startFooter")}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <a href="#/privacy" className="text-xs text-primary/70 transition-colors hover:text-primary">
                        Privacy Policy
                      </a>
                      <a
                        href="mailto:bynrnworld@gmail.com"
                        className="font-exo text-xs text-muted-foreground/40 transition-colors hover:text-primary"
                      >
                        bynrnworld@gmail.com
                      </a>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {screen === "info" && (
              <motion.div
                key="info"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="w-full max-w-2xl"
              >
                <div className="space-y-6 rounded-2xl border border-primary/20 bg-black/50 p-6 backdrop-blur-xl md:p-8">
                  <div className="flex items-center justify-between">
                    <h2 className="neon-text font-orbitron text-3xl font-bold text-primary md:text-4xl">
                      HOW TO PLAY
                    </h2>
                    <button
                      onClick={() => handleButtonClick(() => setScreen("main"))}
                      aria-label="Close"
                      className="p-2 text-primary transition-colors hover:text-secondary"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-5 rounded-lg border border-primary/20 bg-muted/20 p-5 font-exo md:p-6">
                    <InfoBlock title="OBJECTIVE" tone="primary">
                      Connect every node with one continuous line. Move up, down, left or right. You
                      may not revisit a node or cross your own line.
                    </InfoBlock>

                    <InfoBlock title="CONTROLS" tone="secondary">
                      Drag from the glowing start node. Backspace or the undo button steps back.
                      Arrow keys extend the line one cell at a time. Restart is always available.
                    </InfoBlock>

                    <InfoBlock title="THREE STARS" tone="primary">
                      Finish without hints, without backtracks, and under par time. Backtracks are
                      free — they only cost a star, never a life.
                    </InfoBlock>

                    <InfoBlock title="DAILY CHALLENGE" tone="secondary">
                      One seeded level per day, identical for everyone. Build a streak and share
                      your result card.
                    </InfoBlock>

                    <InfoBlock title="POWER-UPS & CODES" tone="primary">
                      Earn a power-up every fifth new level. Hints reveal the path for 1.5 seconds,
                      or 5 seconds with Path Reveal. Codes from level 10 jump straight to a level.
                    </InfoBlock>

                    <InfoBlock title="PROGRESSION" tone="secondary">
                      Complete levels in order. Levels 101–300 unlock after all 100 main levels.
                      Replay any level to improve your stars and best time.
                    </InfoBlock>
                  </div>

                  <Button
                    onClick={() => handleButtonClick(() => setScreen("main"))}
                    className="w-full bg-gradient-to-r from-primary to-secondary py-6 text-lg font-semibold text-black hover:opacity-90"
                  >
                    BACK TO MENU
                  </Button>
                </div>
              </motion.div>
            )}

            {screen === "completed" && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="w-full max-w-4xl"
              >
                <div className="space-y-6 rounded-2xl border border-secondary/20 bg-black/50 p-6 backdrop-blur-xl md:p-8">
                  <div className="flex items-center justify-between">
                    <h2 className="neon-text font-orbitron text-3xl font-bold text-secondary md:text-4xl">
                      COMPLETED LEVELS
                    </h2>
                    <button
                      onClick={() => handleButtonClick(() => setScreen("main"))}
                      aria-label="Close"
                      className="p-2 text-secondary transition-colors hover:text-primary"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <CompletedSection
                    title="LEVELS 1–100"
                    from={1}
                    to={100}
                    levels={levels ?? []}
                    onLevelClick={handleLevelClick}
                  />
                  <CompletedSection
                    title="LEVELS 101–200"
                    from={101}
                    to={200}
                    levels={levels ?? []}
                    unlocked={completedCount >= 100}
                    onLevelClick={handleLevelClick}
                  />
                  <CompletedSection
                    title="LEVELS 201–300"
                    from={201}
                    to={TOTAL_LEVELS}
                    levels={levels ?? []}
                    unlocked={completedCount >= 100}
                    onLevelClick={handleLevelClick}
                  />

                  <p className="text-center font-exo text-sm text-muted-foreground">
                    Progress: <span className="text-primary">{completedCount}</span> / {TOTAL_LEVELS} levels ·{" "}
                    <span className="text-secondary">{totalStars}</span> stars
                  </p>

                  <Button
                    onClick={() => handleButtonClick(() => setScreen("main"))}
                    className="w-full bg-gradient-to-r from-secondary to-primary py-6 text-lg font-semibold text-black hover:opacity-90"
                  >
                    BACK TO MENU
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selectedLevelMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setSelectedLevelMessage(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={event => event.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-[#0a0f1e] to-[#1a1a2e] p-8"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary to-secondary" />
              <div className="relative z-10 space-y-6 text-center">
                <Heart className="mx-auto h-12 w-12 animate-pulse fill-primary text-primary" />
                <div>
                  <h3 className="mb-2 font-orbitron text-2xl font-bold text-secondary">
                    LEVEL {selectedLevelMessage.id}
                  </h3>
                  <p className="neon-text font-exo text-lg leading-relaxed text-primary">
                    “{selectedLevelMessage.message}”
                  </p>
                </div>
                <Button
                  onClick={() => setSelectedLevelMessage(null)}
                  className="w-full bg-primary font-bold text-black hover:bg-primary/90"
                >
                  CLOSE
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tutorialOpen && <TutorialOverlay onDone={finishTutorial} />}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      className="h-14 flex-col gap-1 border-white/15 px-1 font-orbitron text-[10px] uppercase tracking-wide text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary sm:text-xs"
    >
      {icon}
      {label}
    </Button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
      <div className="font-orbitron text-xl font-bold text-primary">{value}</div>
      <div className="mt-1 font-exo text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "primary" | "secondary" }) {
  return (
    <div className="min-w-16 text-center">
      <div className={`font-orbitron text-2xl font-bold ${tone === "primary" ? "text-primary" : "text-secondary"}`}>
        {value}
      </div>
      <div className="font-exo text-[10px] tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-white/10" />;
}

function InfoBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "primary" | "secondary";
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={`mb-1 font-orbitron text-sm font-bold ${tone === "primary" ? "text-primary" : "text-secondary"}`}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function CompletedSection({
  title,
  from,
  to,
  levels,
  unlocked = true,
  onLevelClick,
}: {
  title: string;
  from: number;
  to: number;
  levels: { id: number; isCompleted: boolean; stars: number }[];
  unlocked?: boolean;
  onLevelClick: (levelId: number) => void;
}) {
  return (
    <div className="rounded-lg border border-secondary/20 bg-muted/20 p-5">
      <h3 className="mb-4 flex items-center gap-2 font-orbitron text-sm font-bold text-primary">
        {title}
        {!unlocked && <Lock className="h-3.5 w-3.5 text-destructive" />}
      </h3>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {Array.from({ length: to - from + 1 }, (_, index) => {
          const levelId = from + index;
          const level = levels.find(item => item.id === levelId);
          const isCompleted = Boolean(level?.isCompleted);
          return (
            <button
              key={levelId}
              onClick={() => isCompleted && onLevelClick(levelId)}
              disabled={!isCompleted}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg font-orbitron text-xs font-bold transition-all ${
                isCompleted
                  ? "bg-gradient-to-br from-primary to-secondary text-black shadow-[0_0_12px_rgba(0,243,255,0.25)] hover:scale-105"
                  : "bg-white/5 text-white/20"
              }`}
            >
              {levelId}
              {isCompleted && (
                <span className="mt-0.5 flex gap-0.5">
                  {Array.from({ length: 3 }).map((_, starIndex) => (
                    <Star
                      key={starIndex}
                      className={`h-1.5 w-1.5 ${
                        starIndex < Math.max(level?.stars ?? 0, 1)
                          ? "fill-black text-black"
                          : "text-black/20"
                      }`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
