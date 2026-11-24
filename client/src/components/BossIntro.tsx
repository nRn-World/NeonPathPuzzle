import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chapters, getChapterForLevel } from "@/lib/chapters";
import { content } from "@/lib/contentText";
import { useI18n, upper, type TranslationKey } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";

const SEEN_KEY = "neon_path_boss_intros_seen";

const COMBO_LABELS: Record<string, TranslationKey> = {
  oneWay: "introOneWay",
  pairs: "introPairs",
  portals: "introPortals",
  sync: "introSync",
  phase: "introPhase",
};

/** Per-device convenience only: losing it just shows the briefing again. */
export function hasSeenBossIntro(levelId: number): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[]).includes(levelId);
  } catch {
    return false;
  }
}

export function markBossIntroSeen(levelId: number): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[];
    if (!seen.includes(levelId)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, levelId]));
  } catch {
    // Storage blocked: the briefing simply shows again next time.
  }
}

/**
 * Boss levels are no longer just a badge and two extra walls: every 25th
 * board now opens with a chapter-coloured briefing, wears a pulsing frame
 * (GameCanvas `boss`) and ends with a chapter-coloured power surge.
 */
export function BossIntro({ levelId, combo = [], onClose }: { levelId: number | null; combo?: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const chapter = levelId === null ? undefined : getChapterForLevel(levelId);
  const number = levelId === null ? 0 : Math.floor(levelId / 25);
  const accent = chapter?.accent ?? "#ffd700";
  const total = chapters.length;

  return (
    <AnimatePresence>
      {chapter && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 px-5 backdrop-blur-md"
          role="dialog"
          aria-labelledby="boss-intro-title"
        >
          <motion.div
            initial={reducedMotion ? false : { scale: 0.9, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md space-y-4 border bg-black/70 p-6 text-center"
            style={{ borderColor: `${accent}88`, boxShadow: `0 0 60px ${accent}33` }}
          >
            <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: accent }}>
              {upper(t("bossIntroEyebrow", { n: number, total }))}
            </p>
            <motion.div
              animate={reducedMotion ? undefined : { rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border"
              style={{ borderColor: `${accent}66`, background: `${accent}14` }}
            >
              <Crown className="h-8 w-8" style={{ color: accent }} />
            </motion.div>
            <h2 id="boss-intro-title" className="font-orbitron text-2xl font-black tracking-wide">
              {upper(content.chapter(chapter).name)}
            </h2>
            <p className="font-exo text-sm leading-relaxed text-muted-foreground">
              {t("bossIntroBody", { chapter: content.chapter(chapter).name })}
            </p>
            {combo.length > 1 && (
              <div className="flex flex-wrap justify-center gap-1.5" aria-label={t("newMechanic")}>
                {combo.filter(rule => COMBO_LABELS[rule]).map(rule => (
                  <span key={rule} className="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ borderColor: `${accent}55`, color: accent }}>
                    {t(COMBO_LABELS[rule])}
                  </span>
                ))}
              </div>
            )}
            <Button onClick={onClose} className="w-full font-bold text-background" style={{ background: accent }}>
              {t("bossIntroStart")}
            </Button>
          </motion.div>
          {/* Neon animation */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <motion.div
              className="absolute inset-0"
              animate={reducedMotion ? undefined : {
                boxShadow: [
                  `0 0 10px ${accent}`,
                  `0 0 20px ${accent}`,
                  `0 0 10px ${accent}`,
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={reducedMotion ? undefined : {
                rotate: [0, 360],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            >
              <svg width="100%" height="100%" viewBox="0 0 100 100" className="pointer-events-none">
                <defs>
                  <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={accent} />
                    <stop offset="100%" stopColor={accent} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" fill="none" stroke="url(#neonGradient)" strokeWidth="2" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#neonGradient)" strokeWidth="2" />
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#neonGradient)" strokeWidth="2" />
              </svg>
            </motion.div>
          </motion.div>fy-center"
              animate={reducedMotion ? undefined : {
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="w-4 h-4 rounded-full" style={{ background: accent }} />
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={reducedMotion ? undefined : {
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <div className="w-6 h-6 rounded-full" style={{ background: accent }} />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
