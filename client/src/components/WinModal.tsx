import { TOTAL_LEVELS } from "@/lib/progress";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Copy, Home, Link2, Play, RotateCcw, Share2, Star } from "lucide-react";
import { Link } from "wouter";
import { generateLevelCode } from "@/lib/levelCodes";
import { formatDuration } from "@/lib/scoring";
import { getDateKey } from "@/lib/daily";
import { shareResult, type ShareOutcome } from "@/lib/shareCard";
import { useI18n, upper } from "@/lib/i18n";

interface WinModalProps {
  isOpen: boolean;
  levelId: number;
  score: number;
  stars: number;
  timeMs: number;
  bestTimeMs: number | null;
  bestScore?: number | null;
  isNewBest: boolean;
  isNewBestScore?: boolean;
  isDaily?: boolean;
  isWeekly?: boolean;
  isZen?: boolean;
  isCustom?: boolean;
  customName?: string;
  customCode?: string;
  dailyStreak?: number;
  starReasons?: string[];
  flawless?: boolean;
  parTimeMs?: number;
  onNext: () => void;
  onReplay: () => void;
}

export function WinModal({
  isOpen,
  levelId,
  score,
  stars,
  timeMs,
  bestTimeMs,
  bestScore = null,
  isNewBest,
  isNewBestScore = false,
  isDaily = false,
  isWeekly = false,
  isZen = false,
  isCustom = false,
  customName,
  customCode,
  dailyStreak = 0,
  starReasons = [],
  flawless = false,
  parTimeMs,
  onNext,
  onReplay,
}: WinModalProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [shareState, setShareState] = useState<ShareOutcome | null>(null);
  const { t } = useI18n();
  const levelCode = generateLevelCode(levelId);
  const showStars = !isZen && !isCustom;
  const isFlawless = flawless;
  const lostStars = flawless ? [] : starReasons;
  const canShare = !isZen;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(levelCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setCodeCopied(false);
    }
  };

  const handleShare = async () => {
    if (isCustom && customCode) {
      try {
        const link = `${window.location.origin}${window.location.pathname}#/custom/${customCode}`;
        await navigator.clipboard.writeText(link);
        setShareState("copied");
      } catch {
        setShareState("failed");
      }
      window.setTimeout(() => setShareState(null), 2500);
      return;
    }

    const outcome = await shareResult({
      dateKey: isDaily ? getDateKey() : undefined,
      levelId,
      timeMs,
      stars,
      streak: dailyStreak,
    });
    setShareState(outcome);
    window.setTimeout(() => setShareState(null), 2500);
  };

  const shareLabel = shareState === "shared"
    ? t("shared")
    : shareState === "downloaded"
      ? t("savedImage")
      : shareState === "copied"
        ? isCustom ? t("linkCopied") : t("copiedText")
        : shareState === "failed"
          ? t("couldNotShare")
          : isCustom ? t("copyLevelLink") : t("shareClear");

  const title = isZen
    ? upper(t("practiceComplete"))
    : isCustom
      ? upper(t("circuitComplete"))
      : isWeekly
        ? upper(t("weeklyCleared"))
        : isDaily
          ? upper(t("dailyCleared"))
          : upper(t("levelCleared"));

  const subtitle = isZen
    ? t("practiceNoRecords")
    : isCustom
      ? customName ?? t("customCircuit")
      : isNewBest
        ? t("newBest")
        : t("wellPlayed");

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isZen ? "Practice complete" : isCustom ? "Custom level complete" : "Level complete"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-primary/30 bg-card/95 p-7 shadow-[0_0_50px_rgba(0,243,255,0.15)]"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/20 blur-[60px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-secondary/20 blur-[60px]" />

            <div className="relative z-10 space-y-5 text-center">
              <div>
                <motion.h2
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="neon-text bg-gradient-to-r from-primary to-secondary bg-clip-text pb-1 font-orbitron text-3xl font-bold text-transparent"
                >
                  {title}
                </motion.h2>
                <p className="font-exo text-sm text-muted-foreground">{subtitle}</p>
              </div>

              {showStars && (
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.15 + index * 0.12, type: "spring", stiffness: 260 }}
                    >
                      <Star
                        className={`h-10 w-10 ${
                          index < stars
                            ? "fill-primary text-primary drop-shadow-[0_0_10px_rgba(0,243,255,0.6)]"
                            : "text-white/15"
                        }`}
                      />
                    </motion.div>
                  ))}
                </div>
              )}

              {!isZen ? (
                <>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-background/40 p-3">
                    <Stat label={upper(t("time"))} value={formatDuration(timeMs)} highlight={isNewBest} />
                    <Stat label={upper(t("best"))} value={bestTimeMs !== null ? formatDuration(bestTimeMs) : "—"} />
                    <Stat label={upper(t("score"))} value={score.toLocaleString()} highlight={isNewBestScore} />
                  </div>

                  {bestScore !== null && bestScore > 0 && !isDaily && !isWeekly && (
                    <p className={`-mt-2 font-exo text-xs ${isNewBestScore ? "text-primary" : "text-muted-foreground"}`}>
                      {isNewBestScore ? t("newBestScore") : t("bestScore")} · {bestScore.toLocaleString()}
                    </p>
                  )}

                  {(isDaily || isWeekly || (!isCustom && starReasons.length > 0)) && (
                    <div className={`-mt-1 space-y-1 rounded-lg border p-3 text-left font-exo text-xs ${
                      isFlawless
                        ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
                        : "border-amber-400/25 bg-amber-400/5 text-amber-200"
                    }`}>
                      {isFlawless ? (
                        <p>{t("flawless")}</p>
                      ) : (
                        <>
                          <p className="font-semibold text-amber-300">
                            {lostStars.length === 1 ? t("oneStarSlipped") : t("starsSlipped")}
                          </p>
                          <ul className="space-y-0.5">
                            {lostStars.map(reason => (
                              <li key={reason} className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-amber-400/70" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                          {parTimeMs !== undefined && (
                            <p className="text-[10px] text-amber-200/60">
                              {t("parNote", { time: formatDuration(parTimeMs) })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-background/40 p-3 font-exo text-xs text-muted-foreground">
                  {t("practiceNeverChanges")}
                </div>
              )}

              {isDaily && dailyStreak > 0 && (
                <p className="font-exo text-sm text-orange-300">
                  {t("dailyStreakComeBack", { streak: dailyStreak })}
                </p>
              )}

              {!isDaily && !isWeekly && !isZen && !isCustom && levelId >= 10 && (
                <div className="space-y-2 rounded-lg border border-secondary/30 bg-secondary/10 p-3">
                  <p className="font-exo text-xs text-muted-foreground">
                    {t("permanentCode", { level: levelId })}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <code className="font-mono text-2xl font-bold tracking-widest text-secondary">
                      {levelCode}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      aria-label="Copy level code"
                      className="rounded p-1.5 transition-colors hover:bg-secondary/20"
                    >
                      {codeCopied
                        ? <Check className="h-4 w-4 text-secondary" />
                        : <Copy className="h-4 w-4 text-secondary/60 hover:text-secondary" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="lg"
                  onClick={onNext}
                  className="h-12 w-full bg-primary text-lg font-bold text-background shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:bg-primary/90"
                >
                  <Play className="mr-2 h-5 w-5" />
                  {isZen || isCustom || isDaily || isWeekly
                    ? t("backToMenu")
                    : levelId < TOTAL_LEVELS ? t("nextLevel") : t("finish")}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={onReplay}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("replay")}
                  </Button>
                  <Button asChild variant="outline" className="border-white/10 hover:bg-white/5">
                    <Link href="/">
                      <Home className="mr-2 h-4 w-4" />
                      {t("menu")}
                    </Link>
                  </Button>
                </div>

                {canShare && (
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className={
                      isDaily || isWeekly
                        ? "border-secondary/40 text-secondary hover:bg-secondary/10"
                        : "border-white/10 text-muted-foreground hover:bg-white/5"
                    }
                  >
                    {isCustom ? <Link2 className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                    {shareLabel}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className={`font-orbitron text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="font-exo text-[10px] tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
