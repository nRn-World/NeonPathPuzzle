import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Crown,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Star,
  Timer,
  Trophy,
  Undo2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PowerUpInventory } from "@/components/PowerUpInventory";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { formatDuration } from "@/lib/scoring";
import { useI18n } from "@/lib/i18n";

interface HeaderProps {
  levelId: number;
  isDaily?: boolean;
  title?: string;
  subtitle?: string;
  timeMs: number;
  stars: number;
  isFrozen?: boolean;
  parTimeMs?: number;
  isBoss?: boolean;
  hideTimer?: boolean;
  hideStars?: boolean;
  hintTokens?: number;
  hintDisabled?: boolean;
  onHint: () => void;
  hintsUsed: boolean;
  isHintLoading: boolean;
  onUndo: () => void;
  canUndo: boolean;
  undoDisabled?: boolean;
  undoRemaining?: number;
  /** Restarts left on this level; undefined means restarts are free. */
  restartsLeft?: number;
  onRestart: () => void;
}

const iconButton = "h-7 w-7 p-0 flex-shrink-0 md:h-9 md:w-9";

export function Header({
  levelId,
  isDaily = false,
  title,
  subtitle,
  timeMs,
  stars,
  isFrozen = false,
  parTimeMs,
  isBoss = false,
  hideTimer = false,
  hideStars = false,
  hintTokens = 0,
  hintDisabled = false,
  onHint,
  hintsUsed,
  isHintLoading,
  onUndo,
  canUndo,
  undoDisabled = false,
  undoRemaining = 3,
  restartsLeft,
  onRestart,
}: HeaderProps) {
  const [showPowerUps, setShowPowerUps] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { t } = useI18n();
  const overPar = parTimeMs !== undefined && timeMs > parTimeMs;
  const usesTokens = hintTokens >= 0;
  const hintLocked = hintDisabled || hintsUsed || isHintLoading || (usesTokens && hintTokens <= 0);

  return (
    <header className="sticky top-0 z-10 flex min-h-14 w-full flex-shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-background/80 px-2 py-2 backdrop-blur-md md:min-h-16 md:px-6 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
        <Link
          href="/"
          aria-label="Back to menu"
          className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 truncate font-orbitron text-xs font-bold md:text-lg">
            {title ? (
              <span className="truncate text-primary neon-text">{title}</span>
            ) : isDaily ? (
              <span className="text-secondary neon-text">{t("dailyChallenge").toUpperCase()}</span>
            ) : (
              <>{t("level").toUpperCase()} <span className="text-primary neon-text">{levelId}</span></>
            )}
            {isBoss && (
              <span className="flex flex-shrink-0 items-center gap-0.5 rounded border border-amber-400/50 bg-amber-400/10 px-1 py-0.5 font-exo text-[8px] font-bold uppercase tracking-wide text-amber-300">
                <Crown className="h-2.5 w-2.5" />
                {t("boss")}
              </span>
            )}
          </h2>
          <div className="truncate font-exo text-[10px] text-muted-foreground md:text-xs">
            {subtitle ?? (isDaily ? t("samePuzzleEveryone").toUpperCase() : t("oneLineMaster").toUpperCase())}
          </div>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 flex-shrink-0 items-center gap-0.5 overflow-x-auto md:gap-1.5">
        {!hideTimer && (
          <div
            className={`flex h-7 items-center gap-1 rounded-md border px-1.5 font-mono text-[10px] md:h-9 md:gap-1.5 md:px-2 md:text-xs ${
              isFrozen
                ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                : overPar
                  ? "border-amber-400/40 bg-amber-400/5 text-amber-300"
                  : "border-white/10 text-muted-foreground"
            }`}
            title={isFrozen
              ? "Timer frozen"
              : parTimeMs
                ? `Level timer · par ${formatDuration(parTimeMs)}`
                : "Level timer"}
          >
            <Timer className="h-3 w-3 md:h-3.5 md:w-3.5" />
            {formatDuration(timeMs)}
            {parTimeMs !== undefined && (
              <span className="text-muted-foreground/50">/{formatDuration(parTimeMs)}</span>
            )}
          </div>
        )}

        {!hideStars && (
          <div className="hidden items-center gap-0.5 px-1 sm:flex" title={`${stars} of 3 stars available`}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Star
                key={index}
                className={`h-3.5 w-3.5 transition-colors ${
                  index < stars ? "fill-primary text-primary" : "text-white/15"
                }`}
              />
            ))}
          </div>
        )}

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo || undoDisabled || undoRemaining <= 0}
            aria-label={undoDisabled
              ? "Undo disabled in this mode"
              : undoRemaining <= 0
                ? t("undoLimitReached")
                : t("undoHint")}
            title={undoDisabled
              ? "Undo is disabled this week"
              : undoRemaining <= 0
                ? t("undoLimitReached")
                : `${t("undoHint")} · ${t("undoRemaining", { count: undoRemaining })}`}
            className={`${iconButton} border-white/10 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:opacity-30`}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          {!undoDisabled && (
            <span
              className={`pointer-events-none absolute -right-1 -top-1 min-w-3.5 rounded-full border bg-background px-0.5 text-center font-mono text-[9px] leading-3 ${
                undoRemaining > 0
                  ? "border-primary/50 text-primary"
                  : "border-amber-400/50 text-amber-300"
              }`}
              title={t("undoRemaining", { count: undoRemaining })}
            >
              {undoRemaining}
            </span>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={onRestart}
            aria-label={restartsLeft === undefined
              ? t("restartLevel")
              : restartsLeft > 0 ? t("restartsLeft", { count: restartsLeft }) : t("restartFinal")}
            title={restartsLeft === undefined
              ? t("restartLevel")
              : restartsLeft > 0 ? t("restartsLeft", { count: restartsLeft }) : t("restartFinal")}
            className={`${iconButton} ${restartsLeft === 0
              ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
              : "border-white/10 text-muted-foreground hover:border-white/30 hover:bg-white/5 hover:text-foreground"}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {restartsLeft !== undefined && (
            <span
              className={`pointer-events-none absolute -right-1 -top-1 min-w-3.5 rounded-full border bg-background px-0.5 text-center font-mono text-[9px] leading-3 ${
                restartsLeft > 0 ? "border-white/30 text-foreground" : "border-red-500/60 text-red-300"
              }`}
            >
              {restartsLeft}
            </span>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={onHint}
            disabled={hintLocked}
            aria-label={t("hintReveal")}
            title={hintDisabled
              ? "Hints are disabled in this mode"
              : usesTokens && hintTokens <= 0
                ? t("hintTokenEmpty")
                : usesTokens
                  ? `${t("hintReveal")} (1 token)`
                  : t("hintReveal")}
            className={`${iconButton} border-white/10 transition-all duration-300 ${
              hintLocked
                ? "cursor-not-allowed text-muted-foreground opacity-50"
                : "text-secondary hover:border-secondary/50 hover:bg-secondary/10 hover:shadow-[0_0_15px_rgba(138,43,226,0.3)]"
            }`}
          >
            <Lightbulb className={`h-3.5 w-3.5 ${isHintLoading ? "animate-pulse" : ""}`} />
          </Button>
          {usesTokens && !hintDisabled && (
            <span
              className="pointer-events-none absolute -right-1 -top-1 min-w-3.5 rounded-full border border-secondary/50 bg-background px-0.5 text-center font-mono text-[9px] leading-3 text-secondary"
              title={`${hintTokens} hint tokens`}
            >
              {hintTokens}
            </span>
          )}
        </div>

        <Dialog open={showPowerUps} onOpenChange={setShowPowerUps}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Power-ups"
              className={`${iconButton} border-white/10 text-yellow-400 hover:border-yellow-500/50 hover:bg-yellow-500/10`}
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Power-ups
              </DialogTitle>
              <DialogDescription className="sr-only">
                Use a power-up from your inventory.
              </DialogDescription>
            </DialogHeader>
            <PowerUpInventory />
          </DialogContent>
        </Dialog>

        <Dialog open={showAchievements} onOpenChange={setShowAchievements}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Achievements"
              className={`${iconButton} hidden border-primary/50 bg-primary/5 text-primary hover:border-primary hover:bg-primary/15 sm:inline-flex`}
            >
              <Trophy className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Achievements
              </DialogTitle>
              <DialogDescription className="sr-only">
                Your unlocked achievements and progress.
              </DialogDescription>
            </DialogHeader>
            <AchievementsPanel />
          </DialogContent>
        </Dialog>

        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              className={`${iconButton} hidden border-white/10 text-muted-foreground hover:border-primary/50 hover:bg-primary/10 sm:inline-flex`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                {t("shortcutsTitle")}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Keyboard controls and level symbols.
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 py-2">
              {[
                ["Arrow keys", t("arrowsMove")],
                ["Z / U", t("undoHint")],
                ["Backspace", t("undoHint")],
                ["H", t("hintReveal")],
                ["R", t("restartAction")],
                ["P / Esc", t("pauseKey")],
              ].map(([keys, action]) => (
                <div key={keys} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{action}</dt>
                  <dd className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-xs text-foreground">
                    {keys}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="space-y-1 border-t border-white/10 pt-3 font-exo text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{t("symbolsTitle")}</p>
              <p>{t("symbolOneWay")}</p>
              <p>{t("symbolPairs")}</p>
              <p>{t("symbolPortals")}</p>
            </div>
          </DialogContent>
        </Dialog>

        <SettingsDialog triggerClassName={`${iconButton} border-white/10 text-muted-foreground hover:border-primary/50 hover:bg-primary/10`} />
      </div>
    </header>
  );
}
