import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Check, Flame, Play, Star } from "lucide-react";
import { getProgress } from "@/lib/progress";
import {
  formatCountdown,
  getActiveStreak,
  getDailyLevelId,
  getDateKey,
  getRecentDateKeys,
  getTimeUntilNextDaily,
  hasCompletedDaily,
  type DailyState,
} from "@/lib/daily";
import { useUserId } from "@/hooks/use-game";
import { formatDuration } from "@/lib/scoring";
import { useI18n } from "@/lib/i18n";

function weekdayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "narrow" });
}

export function DailyCard({ compact = false }: { compact?: boolean }) {
  const userId = useUserId();
  const { t } = useI18n();
  const [daily, setDaily] = useState<DailyState>(() => getProgress(userId).daily);
  const [remainingMs, setRemainingMs] = useState(() => getTimeUntilNextDaily());
  const dateKey = getDateKey();
  const levelId = getDailyLevelId(dateKey);
  const today = daily.results[dateKey];
  const completed = hasCompletedDaily(daily, dateKey);
  const activeStreak = getActiveStreak(daily, dateKey);
  const recentDays = getRecentDateKeys(dateKey, 7);

  useEffect(() => {
    setDaily(getProgress(userId).daily);
  }, [userId]);

  useEffect(() => {
    const interval = window.setInterval(() => setRemainingMs(getTimeUntilNextDaily()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Link href="/daily">
      <div
        className={`group relative cursor-pointer overflow-hidden rounded-xl border border-secondary/30 bg-gradient-to-br from-secondary/15 to-primary/5 transition-all hover:border-secondary/60 hover:shadow-[0_0_25px_rgba(138,43,226,0.2)] ${
          compact ? "p-4" : "p-5"
        }`}
      >
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-secondary/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-secondary/40 bg-secondary/10">
            {completed ? <Check className="h-5 w-5 text-secondary" /> : <CalendarDays className="h-5 w-5 text-secondary" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-orbitron text-sm font-bold text-secondary">{t("dailyChallenge").toUpperCase()}</h3>
              {activeStreak > 0 && (
                <span className="flex items-center gap-1 text-xs text-orange-300">
                  <Flame className="h-3 w-3" />
                  {activeStreak}
                </span>
              )}
            </div>
            <p className="font-exo text-xs text-muted-foreground">
              {completed && today
                ? t("solvedIn", { time: formatDuration(today.timeMs), stars: today.stars })
                : t("samePuzzle", { level: levelId })}
              <span className="mx-1.5 text-white/20">·</span>
              <span className="font-mono text-[10px] text-secondary/80">
                {t("left", { time: formatCountdown(remainingMs) })}
              </span>
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {completed && today && (
              <div className="hidden gap-0.5 sm:flex">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Star
                    key={index}
                    className={`h-3 w-3 ${index < today.stars ? "fill-secondary text-secondary" : "text-white/20"}`}
                  />
                ))}
              </div>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-secondary/40 bg-secondary/10 text-secondary transition-transform group-hover:scale-110">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
          </div>
        </div>

        <div className="relative mt-3 flex items-center gap-1 border-t border-white/10 pt-2.5">
          {recentDays.map(key => {
            const result = daily.results[key];
            const isToday = key === dateKey;
            const strength = result
              ? result.stars >= 3
                ? "bg-secondary"
                : result.stars === 2
                  ? "bg-secondary/70"
                  : "bg-secondary/40"
              : "bg-white/10";
            return (
              <div
                key={key}
                title={
                  result
                    ? `${key} · ${result.stars}/3 stars · ${formatDuration(result.timeMs)}`
                    : `${key} · not played`
                }
                className={`flex flex-1 flex-col items-center gap-1 rounded-md border px-1 py-1 ${
                  isToday ? "border-secondary/50 bg-secondary/10" : "border-transparent"
                }`}
              >
                <span className={`font-exo text-[9px] uppercase ${isToday ? "text-secondary" : "text-muted-foreground/70"}`}>
                  {isToday ? t("today") : weekdayLabel(key)}
                </span>
                <span className={`h-1 w-full rounded-full ${strength}`} />
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
