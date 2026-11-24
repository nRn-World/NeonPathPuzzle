import { useMemo } from "react";
import { content } from "@/lib/contentText";
import { chapters } from "@/lib/chapters";
import { useI18n, upper } from "@/lib/i18n";
import { formatResultTime } from "@/lib/scoring";
import { computeProfileStats } from "@/lib/stats";
import { TOTAL_LEVELS, type ProgressData } from "@/lib/progress";

function NeonCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-neon-blue bg-black/30 p-4 shadow-neon transition-all hover:scale-105 hover:shadow-neon-hover">
      <div className="font-orbitron text-xl font-bold text-neon-blue">{value}</div>
      <div className="mt-1 font-exo text-xs text-neon-pink">{label}</div>
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
    <div className="space-y-6 bg-gradient-to-br from-black via-neon-dark to-black p-6 rounded-xl shadow-neon-container">
      <div className="border-2 border-neon-blue bg-black/30 p-4 rounded-lg shadow-neon">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neon-pink">{t("brainRank")}</span>
          <span className="font-mono text-xs text-neon-pink">
            {stats.rank.starsToNext === null ? t("topRankReached") : t("starsToNextRank", { count: stats.rank.starsToNext })}
          </span>
        </div>
        <div className="mt-1 font-orbitron text-2xl font-bold text-neon-blue">{upper(t(stats.rank.key))}</div>
        <div className="mt-3 h-1.5 bg-white/10 rounded-full">
          <div
            className="h-full bg-neon-blue rounded-full transition-[width]"
            style={{ width: `${Math.min(100, (stats.totalStars / rankCeiling) * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <NeonCard label={t("levelsSolvedStat")} value={`${stats.clears}/${TOTAL_LEVELS}`} />
        <NeonCard label={t("starsEarnedStat")} value={`${stats.totalStars}/${TOTAL_LEVELS * 3}`} />
        <NeonCard label={t("threeStarClears")} value={String(stats.threeStarClears)} />
        <NeonCard label={t("flawlessClears")} value={String(stats.flawlessClears)} />
        <NeonCard label={t("averageStars")} value={stats.averageStars.toFixed(2)} />
        <NeonCard label={t("timeOnSolved")} value={stats.totalBestTimeMs > 0 ? formatHours(stats.totalBestTimeMs) : "—"} />
        <NeonCard label={t("dailyStreak")} value={String(dailyStreak)} />
        <NeonCard label={t("bestStreakStat")} value={String(bestStreak)} />
        <NeonCard label={t("crashesStat")} value={String(crashes)} />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-neon-blue">{t("activityTitle")}</h3>
          <span className="font-mono text-[10px] text-neon-pink">{t(stats.activeDays === 1 ? "activeDay" : "activeDays", { count: stats.activeDays })}</span>
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
              className="aspect-square bg-neon-blue rounded-sm"
              style={{ opacity: day.count === 0 ? 0.08 : 0.25 + 0.75 * (day.count / maxActivity) }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-neon-blue">{t("chaptersProgress")}</h3>
        <div className="space-y-2">
          {stats.chapters.map(stat => {
            const chapter = chapters.find(item => item.id === stat.id)!;
            return (
              <div key={stat.id} className="flex items-center gap-3 font-exo text-xs">
                <span className="w-28 truncate text-left text-neon-pink sm:w-36">{content.chapter(chapter).name}</span>
                <div className="h-1.5 flex-1 bg-white/10 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${(stat.cleared / stat.total) * 100}%`, background: chapter.accent }} />
                </div>
                <span className="w-16 text-right font-mono text-neon-pink">{stat.stars}/{stat.maxStars}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
