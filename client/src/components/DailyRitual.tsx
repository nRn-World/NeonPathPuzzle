import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Flame, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/GameCanvas";
import { EMPTY_MECHANICS } from "@shared/mechanics";
import { generateLevel } from "@shared/level-generator";
import type { LevelResponse } from "@shared/schema";
import {
  formatCountdown,
  getActiveStreak,
  getDailyLevelId,
  getDateKey,
  getRecentDateKeys,
  getShieldCount,
  getTimeUntilNextDaily,
  type DailyState,
} from "@/lib/daily";
import { chapterAccentForLevel } from "@/lib/chapterAudio";
import { useI18n, upper } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";

const SEEN_KEY = "neon-path-daily-reveal-v1";

/** The full-screen reveal happens once per calendar day, not on every visit. */
export function hasSeenDailyReveal(dateKey: string): boolean {
  try { return localStorage.getItem(SEEN_KEY) === dateKey; } catch { return false; }
}

export function markDailyRevealSeen(dateKey: string): void {
  try { localStorage.setItem(SEEN_KEY, dateKey); } catch { /* no storage */ }
}

function weekday(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "narrow" });
}

/**
 * The daily ritual turns a menu link into a small event: a full-screen board
 * reveal, the last 30 days at a glance, a live countdown and the shields the
 * player has banked. Nothing here talks to a server.
 */
export function DailyRitual({ state, onEnter }: { state: DailyState; onEnter: () => void }) {
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const dateKey = getDateKey();
  const levelId = getDailyLevelId(dateKey);
  const accent = chapterAccentForLevel(levelId);
  const [visible, setVisible] = useState(() => !hasSeenDailyReveal(dateKey));
  const [remaining, setRemaining] = useState(() => getTimeUntilNextDaily());

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getTimeUntilNextDaily()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const days = useMemo(() => getRecentDateKeys(dateKey, 30), [dateKey]);
  const streak = getActiveStreak(state, dateKey);
  const shields = getShieldCount(state);
  const preview = useMemo<LevelResponse>(() => {
    const level = generateLevel(levelId);
    return { ...level, isLocked: false, isCompleted: false };
  }, [levelId]);

  const enter = () => {
    markDailyRevealSeen(dateKey);
    setVisible(false);
    onEnter();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto bg-[#05070f]/95 px-5 py-8 text-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-reveal-title"
        >
          <motion.div
            initial={reducedMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex w-full max-w-lg flex-col items-center gap-4"
          >
            <p className="font-mono text-[10px] tracking-[0.35em]" style={{ color: accent }}>{dateKey}</p>
            <h1 id="daily-reveal-title" className="font-orbitron text-3xl font-black tracking-wide text-white md:text-4xl">
              {upper(t("dailyRevealTitle"))}
            </h1>
            <p className="font-exo text-sm text-muted-foreground">{t("dailyRevealSubtitle")}</p>

            <div
              className="relative aspect-square w-full max-w-[min(60vw,42vh)] overflow-hidden border"
              style={{ borderColor: `${accent}55`, boxShadow: `0 0 60px ${accent}22` }}
              aria-hidden="true"
            >
              {/* A paused, non-interactive preview of today's exact board. */}
              <GameCanvas
                level={preview}
                onComplete={() => undefined}
                showHint={false}
                onBacktrack={() => false}
                paused
                reducedMotion
                mechanics={EMPTY_MECHANICS}
                gridLabel={t("dailyRevealTitle")}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070f]/80 to-transparent" />
            </div>

            <div className="flex w-full flex-wrap items-center justify-center gap-3 font-exo text-xs">
              <span className="flex items-center gap-1 text-orange-300">
                <Flame className="h-4 w-4" />
                {streak > 0 ? t("dailyStreakCount", { count: streak }) : t("dailyStreak")}
              </span>
              <span className="flex items-center gap-1 text-violet-300">
                <Shield className="h-4 w-4" />{t("dailyShields", { count: shields })}
              </span>
              <span className="font-mono text-muted-foreground">{t("dailyNextIn", { time: formatCountdown(remaining) })}</span>
            </div>

            <div className="w-full border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("dailyCalendar", { count: 30 })}
              </p>
              <div className="grid grid-cols-10 gap-1" role="list" aria-label={t("dailyCalendar", { count: 30 })}>
                {days.map(key => {
                  const result = state.results[key];
                  const isToday = key === dateKey;
                  return (
                    <div
                      key={key}
                      role="listitem"
                      title={result ? `${key} · ${result.stars}★` : `${key} · ${t("notPlayed")}`}
                      className={`flex aspect-square items-center justify-center border text-[9px] ${
                        isToday ? "border-white/50" : "border-white/5"
                      } ${result ? "bg-secondary/60 text-white" : "bg-white/[0.03] text-muted-foreground/50"}`}
                    >
                      {weekday(key)}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-left font-exo text-[11px] text-muted-foreground">{t("dailyShieldHint")}</p>
            </div>

            <Button onClick={enter} size="lg" className="w-full max-w-xs font-bold text-background" style={{ background: accent }}>
              {t("dailyRevealEnter")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
