import { useMemo } from "react";
import { content } from "@/lib/contentText";
import { chapters } from "@/lib/chapters";
import { useI18n, upper } from "@/lib/i18n";
import { formatResultTime } from "@/lib/scoring";
import { computeProfileStats } from "@/lib/stats";
import { TOTAL_LEVELS, type ProgressData } from "@/lib/progress";

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/10 bg-black/30 p-4">
      <div className="font-orbitron text-xl font-bold text-primary">{value}</div>
      <div className="mt-1 font-exo text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatHours(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const minutes = Math.round(ms / 60000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

/** The player's profile: rank, headline numbers, 12-week calendar, chapter progress, fastest clears. */
export function ProfilePanel({
  progress,
  crashes,
  dailyStreak,
  bestStreak,
}: {
  progress: ProgressData;
  crashes: number;
  dailyStreak: number;
  bestStreak: number;
}) {
  const { t } = useI18n();
  const stats = useMemo(() => computeProfileStats(progress), [progress]);
  const maxActivity = Math.max(1, ...stats.activity.map(day => day.count));
  const rankCeiling = stats.rank.starsToNext === null ? 1 : stats.totalStars + stats.rank.starsToNext;

  return (
    <div className="space-y-6">
      <div className="border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t("brainRank")}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {stats.rank.starsToNext === null ? t("topRankReached") : t("starsToNextRank", { count: stats.rank.starsToNext })}
          </span>
        </div>
        <div className="mt-1 font-orbitron text-2xl font-bold text-primary">{upper(t(stats.rank.key))}</div>
        <div className="mt-3 h-1.5 bg-white/10">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.min(100, (stats.totalStars / rankCeiling) * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Card label={t("levelsSolvedStat")} value={`${stats.clears}/${TOTAL_LEVELS}`} />
        <Card label={t("starsEarnedStat")} value={`${stats.totalStars}/${TOTAL_LEVELS * 3}`} />
        <Card label={t("threeStarClears")} value={String(stats.threeStarClears)} />
        <Card label={t("flawlessClears")} value={String(stats.flawlessClears)} />
        <Card label={t("averageStars")} value={stats.averageStars.toFixed(2)} />
        <Card label={t("timeOnSolved")} value={stats.totalBestTimeMs > 0 ? formatHours(stats.totalBestTimeMs) : "—"} />
        <Card label={t("dailyStreak")} value={String(dailyStreak)} />
        <Card label={t("bestStreakStat")} value={String(bestStreak)} />
        <Card label={t("crashesStat")} value={String(crashes)} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">{t("activityTitle")}</h3>
          <span className="font-mono text-[10px] text-muted-foreground">{t(stats.activeDays === 1 ? "activeDay" : "activeDays", { count: stats.activeDays })}</span>
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px]"
          role="img"
          aria-label={t(stats.activeDays === 1 ? "activeDay" : "activeDays", { count: stats.activeDays })}
        >
          {stats.activity.map(day => (
            <span
              key={day.dateKey}
              title={`${day.dateKey}: ${day.count}`}
              className="aspect-square bg-primary"
              style={{ opacity: day.count === 0 ? 0.08 : 0.25 + 0.75 * (day.count / maxActivity) }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">{t("chaptersProgress")}</h3>
        <div className="space-y-2">
          {stats.chapters.map(stat => {
            const chapter = chapters.find(item => item.id === stat.id)!;
            return (
              <div key={stat.id} className="flex items-center gap-3 font-exo text-xs">
                <span className="w-28 truncate text-left text-muted-foreground sm:w-36">{content.chapter(chapter).name}</span>
                <div className="h-1.5 flex-1 bg-white/10">
                  <div className="h-full" style={{ width: `${(stat.cleared / stat.total) * 100}%`, background: chapter.accent }} />
                </div>
                <span className="w-16 text-right font-mono text-muted-foreground">{stat.stars}/{stat.maxStars}★</span>
              </div>
            );
          })}
        </div>
      </div>

      {stats.fastest.length > 0 && (
        <div>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-primary">{t("fastestClears")}</h3>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {stats.fastest.map((entry, index) => (
              <li key={entry.levelId} className="flex items-center justify-between border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs">
                <span className="text-muted-foreground">#{index + 1} · {upper(t("level"))} {entry.levelId}</span>
                <span className="text-primary">{formatResultTime(entry.timeMs)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
