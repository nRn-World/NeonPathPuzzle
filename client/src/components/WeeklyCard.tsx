import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CalendarClock, Check, Play, Sparkles, Star } from "lucide-react";
import { formatDuration } from "@/lib/scoring";
import { useI18n, upper } from "@/lib/i18n";
import {
  getTimeUntilNextWeekly,
  getWeekKey,
  getWeeklyChallenge,
  getWeeklyResult,
  weeklyModifierKeys,
  type WeeklyResult,
} from "@/lib/weekly";

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

export function WeeklyCard({ compact = false }: { compact?: boolean }) {
  const challenge = getWeeklyChallenge();
  const modifier = weeklyModifierKeys[challenge.modifier];
  const { t } = useI18n();
  const [result, setResult] = useState<WeeklyResult | null>(() => getWeeklyResult(challenge.weekKey));
  const [remainingMs, setRemainingMs] = useState(() => getTimeUntilNextWeekly());

  useEffect(() => {
    setResult(getWeeklyResult(getWeekKey()));
    const interval = window.setInterval(() => setRemainingMs(getTimeUntilNextWeekly()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Link href="/weekly">
      <div
        className={`group relative h-full cursor-pointer overflow-hidden rounded-none border border-white/10 border-l-[3px] border-l-amber-400 bg-white/[0.03] transition-all hover:border-amber-400/60 hover:shadow-[0_0_25px_rgba(255,215,0,0.15)] ${
          compact ? "p-4" : "p-5"
        }`}
      >
        <div className="relative flex items-center gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-none border border-amber-400/40 bg-amber-400/10">
            {result ? <Check className="h-5 w-5 text-amber-300" /> : <CalendarClock className="h-5 w-5 text-amber-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-orbitron text-sm font-bold text-amber-300">{upper(t("weeklyChallenge"))}</h3>
              <span className="flex items-center gap-1 rounded-none border border-amber-400/30 px-2 py-0.5 font-exo text-[10px] text-amber-200/90">
                <Sparkles className="h-2.5 w-2.5" />
                {t(modifier.label)}
              </span>
            </div>
            <p className="font-exo text-xs text-muted-foreground">
              {t("level")} {challenge.levelId} · {t(modifier.description)}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-amber-200/60">
              {result
                ? `${formatDuration(result.timeMs)} · ${result.stars}/3 stars · `
                : ""}
              {t("weeklyLeft", { time: formatRemaining(remainingMs) })}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {result && (
              <div className="hidden gap-0.5 sm:flex">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Star
                    key={index}
                    className={`h-3 w-3 ${index < result.stars ? "fill-amber-300 text-amber-300" : "text-white/20"}`}
                  />
                ))}
              </div>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-none border border-amber-400/40 bg-amber-400/10 text-amber-300 transition-transform group-hover:scale-110">
              <Play className="h-3.5 w-3.5 fill-current" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
