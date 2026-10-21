import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  HelpCircle,
  Lock,
  PenLine,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { ChapterBoard } from "@/components/ChapterBoard";
import { MenuHero } from "@/components/MenuHero";
import { content } from "@/lib/contentText";
import { getChapterForLevel } from "@/lib/chapters";
import { getBrainRank } from "@/lib/rank";
import { LanguageSwitch } from "@/components/LanguageSwitch";
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
import { getProgress, markTutorialSeen, TOTAL_LEVELS } from "@/lib/progress";
import type { TranslationKey } from "@/lib/i18n";

const HOW_TO_PLAY: [TranslationKey, TranslationKey][] = [
  ["howObjectiveTitle", "howObjectiveBody"],
  ["howControlsTitle", "howControlsBody"],
  ["howAttemptsTitle", "howAttemptsBody"],
  ["howStarsTitle", "howStarsBody"],
  ["howNodesTitle", "howNodesBody"],
  ["howDailyTitle", "howDailyBody"],
  ["howPowerTitle", "howPowerBody"],
  ["howProgressTitle", "howProgressBody"],
];
import { playClickSound } from "@/lib/sounds";
import { useI18n, upper } from "@/lib/i18n";

type MenuScreen = "main" | "info" | "completed";

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
      <div className="menu-grid pointer-events-none absolute inset-0 z-0" />

      <div className="relative z-10 h-full overflow-y-auto safe-scroll">
        <div className="flex min-h-screen flex-col items-center justify-start px-4 pb-14 pt-8 sm:pt-12">
          <AnimatePresence mode="wait">
            {screen === "main" && (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <MenuHero
                  hasProgress={hasProgress}
                  continueLevel={continueLevel}
                  runCount={runCount}
                  totalLevels={TOTAL_LEVELS}
                  totalStars={totalStars}
                  maxStars={maxStars}
                  streak={summary?.dailyStreak ?? 0}
                  chapterName={upper(content.chapter(getChapterForLevel(continueLevel)).name)}
                  onPlay={() => handleButtonClick(handleStartClick)}
                  actions={(
                    <>
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
                      <LanguageSwitch />
                      <ThemeSelector />
                      <SettingsDialog triggerClassName="h-9 w-9 rounded-none border-white/15 p-0 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary" />
                      <Button asChild variant="outline" size="sm" className="h-9 rounded-none border-white/15 font-mono text-[11px] uppercase tracking-wider">
                        <Link href="/editor">
                          <PenLine className="mr-1.5 h-3.5 w-3.5" />
                          {t("editor")}
                        </Link>
                      </Button>
                    </>
                  )}
                />

                <div id="dashboard" className="mx-auto max-w-3xl space-y-7 pb-4 pt-12 text-center">
                  <div className="flex items-center gap-4 text-left">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary">{t("dashboardTitle")}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid gap-3 text-left md:grid-cols-2"
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
                          <StatCard
                            label={t("brainRank")}
                            value={upper(t(getBrainRank(totalStars).key))}
                          />
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
                    className="mx-auto w-full max-w-md rounded-none border border-white/10 bg-black/30 p-5 backdrop-blur-sm"
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
                        {upper(t("go"))}
                      </Button>
                    </div>
                    {codeError && <p className="mt-2 font-exo text-sm text-destructive">{codeError}</p>}
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
                        {t("privacyPolicy")}
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
                <div className="space-y-6 rounded-none border border-primary/20 bg-black/50 p-6 backdrop-blur-xl md:p-8">
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
                    {HOW_TO_PLAY.map(([title, body], index) => (
                      <InfoBlock key={title} title={upper(t(title))} tone={index % 2 === 0 ? "primary" : "secondary"}>
                        {t(body)}
                      </InfoBlock>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleButtonClick(() => setScreen("main"))}
                    className="w-full rounded-none bg-primary py-6 font-orbitron text-sm font-bold uppercase tracking-wider text-background hover:bg-primary/90"
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
                <div className="space-y-6 rounded-none border border-secondary/20 bg-black/50 p-6 backdrop-blur-xl md:p-8">
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
                    title={t("levelsRange", { from: 1, to: 100 })}
                    from={1}
                    to={100}
                    levels={levels ?? []}
                    onLevelClick={handleLevelClick}
                  />
                  <CompletedSection
                    title={t("levelsRange", { from: 101, to: 200 })}
                    from={101}
                    to={200}
                    levels={levels ?? []}
                    unlocked={completedCount >= 100}
                    onLevelClick={handleLevelClick}
                  />
                  <CompletedSection
                    title={t("levelsRange", { from: 201, to: 300 })}
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
                    className="w-full rounded-none bg-primary py-6 font-orbitron text-sm font-bold uppercase tracking-wider text-background hover:bg-primary/90"
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
              className="relative w-full max-w-md overflow-hidden rounded-none border border-white/10 bg-background p-8"
            >
              <div className="absolute left-0 top-0 h-[3px] w-full bg-primary" />
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
      size="sm"
      className="h-9 gap-1.5 rounded-none border-white/15 px-3 font-mono text-[11px] uppercase tracking-wider text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary"
    >
      {icon}
      {label}
    </Button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
      <div className="font-orbitron text-xl font-bold text-primary">{value}</div>
      <div className="mt-1 font-exo text-xs text-muted-foreground">{label}</div>
    </div>
  );
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
              className={`relative flex aspect-square flex-col items-center justify-center rounded-none font-orbitron text-xs font-bold transition-all ${
                isCompleted
                  ? "bg-primary text-background hover:brightness-110"
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
