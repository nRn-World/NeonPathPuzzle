import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Home as HomeIcon, Loader2, PenLine, Play, Star, Trophy } from "lucide-react";
import { useLevels, useUserProgress, useUserId } from "@/hooks/use-game";
import { ChapterBoard } from "@/components/ChapterBoard";
import { DailyCard } from "@/components/DailyCard";
import { WeeklyCard } from "@/components/WeeklyCard";
import { StartMenu } from "@/components/StartMenu";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { ThemeSelector } from "@/components/ThemeSelector";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration } from "@/lib/scoring";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);
  const [activeTab, setActiveTab] = useState("levels");
  const [, setLocation] = useLocation();
  const userId = useUserId();
  const { data: levels, isLoading, error, refetch } = useLevels(userId);
  const { data: summary } = useUserProgress(userId);
  const { t } = useI18n();

  useEffect(() => {
    if (gameStarted) void refetch();
  }, [gameStarted, refetch]);

  const records = summary?.records ?? {};

  const stats = useMemo(() => {
    const values = Object.values(records);
    return {
      threeStars: values.filter(record => record.stars === 3).length,
      bestTime: values.reduce<number | null>((best, record) => {
        if (record.bestTimeMs === null) return best;
        return best === null ? record.bestTimeMs : Math.min(best, record.bestTimeMs);
      }, null),
      totalScore: values.reduce((total, record) => total + (record.bestScore ?? 0), 0),
      bestLevelScore: values.reduce((best, record) => Math.max(best, record.bestScore ?? 0), 0),
    };
  }, [records]);

  const handleStartLevel = (levelId: number) => {
    setGameStarted(true);
    setLocation(`/play/${levelId}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !levels) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-destructive">
        <h2 className="text-2xl font-bold">System Error</h2>
        <p>Failed to load level matrix.</p>
      </div>
    );
  }

  if (!gameStarted) {
    return <StartMenu onStart={() => setGameStarted(true)} onStartLevel={handleStartLevel} />;
  }

  const continueLevel = summary?.continueLevel ?? 1;
  const totalStars = summary?.totalStars ?? 0;

  return (
    <div className="min-h-screen overflow-y-auto bg-background p-4 md:p-8 safe-scroll">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGameStarted(false)}
                className="-ml-2 text-muted-foreground hover:text-primary"
              >
                <HomeIcon className="mr-1.5 h-4 w-4" />
                {t("menu")}
              </Button>
            </div>
            <h1 className="bg-gradient-to-br from-primary via-white to-secondary bg-clip-text font-orbitron text-3xl font-bold tracking-tight text-transparent md:text-5xl">
              NEON PATH
            </h1>
            <p className="font-exo text-sm text-muted-foreground">
              <span className="text-primary">{summary?.completedCount ?? 0}</span> {t("levelsSolved")}
              <span className="mx-2 text-white/20">·</span>
              <Star className="mb-0.5 inline h-3.5 w-3.5 fill-primary text-primary" />{" "}
              <span className="text-primary">{totalStars}</span> {t("starsEarnedOf", { total: 600 })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/15">
              <Link href="/editor">
                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                {t("editor")}
              </Link>
            </Button>
            <ThemeSelector />
            <SettingsDialog />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <DailyCard />
          <WeeklyCard />
        </div>

        <Link href={`/play/${continueLevel}`}>
          <div className="group flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/60 hover:bg-primary/10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <Play className="h-4 w-4 fill-current" />
              </span>
              <div>
                <div className="font-orbitron text-sm font-bold text-primary">
                  {t("continueLevel", { level: continueLevel }).toUpperCase()}
                </div>
                <div className="font-exo text-xs text-muted-foreground">
                  {t("jumpBack")}
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="levels" className="gap-2">
              <span className="text-base">▦</span>
              {t("chaptersTab")}
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-2">
              <Trophy className="h-4 w-4" />
              {t("achievementsTab")}
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <Star className="h-4 w-4" />
              {t("statsTab")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="levels" className="mt-6">
            <ChapterBoard levels={levels} continueLevel={continueLevel} />
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <AchievementsPanel />
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">              <StatCard label={t("levelsSolvedStat")} value={`${summary?.completedCount ?? 0}/200`} />
              <StatCard label={t("starsEarnedStat")} value={`${totalStars}/600`} />
              <StatCard label={t("threeStarClears")} value={String(stats.threeStars)} />
              <StatCard label={t("bestTimeStat")} value={stats.bestTime !== null ? formatDuration(stats.bestTime) : "—"} />
              <StatCard label={t("dailyStreak")} value={String(summary?.dailyStreak ?? 0)} />
              <StatCard label={t("bestStreakStat")} value={String(summary?.bestStreak ?? 0)} />
              <StatCard
                label={t("completion")}
                value={`${Math.round(((summary?.completedCount ?? 0) / 200) * 100)}%`}
              />
              <StatCard label={t("totalScore")} value={stats.totalScore.toLocaleString()} />
              <StatCard
                label={t("bestLevelScore")}
                value={stats.bestLevelScore > 0 ? stats.bestLevelScore.toLocaleString() : "—"}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-card/60 p-4">
      <div className="font-orbitron text-2xl font-bold text-primary">{value}</div>
      <div className="mt-1 font-exo text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
