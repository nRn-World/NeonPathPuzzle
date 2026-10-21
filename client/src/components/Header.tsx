import { useState } from "react";
import { Link } from "wouter";
import { Crown } from "lucide-react";
import {
  BackIcon,
  TrophyIcon,
  HintIcon,
  HelpIcon,
  PowerIcon,
  RestartIcon,
  StarIcon,
  TimerIcon,
  UndoIcon,
} from "@/components/icons/GameIcons";
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
import { useI18n, upper } from "@/lib/i18n";

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

const iconButton = "h-8 w-[30px] flex-shrink-0 rounded-none p-0 md:h-9 md:w-9 [&_svg]:!size-[18px] md:[&_svg]:!size-[22px]";
/** A button with an icon and a number beside it, so counts are always readable. */
const countButton = "h-8 flex-shrink-0 gap-0.5 rounded-none px-1.5 md:h-9 md:gap-1.5 md:px-2.5 [&_svg]:!size-[18px] md:[&_svg]:!size-[22px]";
const count = "font-mono text-sm font-black leading-none tabular-nums md:text-base";

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
      <div className="flex min-w-[5.5rem] flex-1 items-center gap-2 overflow-hidden md:gap-3">
        <Link
          href="/"
          aria-label={t("backToMenu")}
          className="flex-shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary"
        >
          <BackIcon className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 whitespace-nowrap font-orbitron text-xs font-bold md:text-lg">
            {title ? (
              <span className="truncate text-primary neon-text">{title}</span>
            ) : isDaily ? (
              <span className="text-secondary neon-text">{upper(t("dailyChallenge"))}</span>
            ) : (
              <>{upper(t("level"))} <span className="text-primary neon-text">{levelId}</span></>
            )}
            {isBoss && (
              <span className="flex flex-shrink-0 items-center gap-0.5 rounded border border-amber-400/50 bg-amber-400/10 px-1 py-0.5 font-exo text-[8px] font-bold uppercase tracking-wide text-amber-300">
                <Crown className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">{t("boss")}</span>
              </span>
            )}
          </h2>
          <div className="truncate font-exo text-[10px] text-muted-foreground md:text-xs">
            {subtitle ?? (isDaily ? upper(t("samePuzzleEveryone")) : upper(t("oneLineMaster")))}
          </div>
        </div>
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-1 md:gap-1.5">
        {!hideTimer && (
          <div
            className={`flex h-8 flex-shrink-0 items-center gap-1 rounded-none border px-1.5 font-mono text-[10px] md:h-9 md:gap-1.5 md:px-2 md:text-xs ${
              isFrozen
                ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                : overPar
                  ? "border-amber-400/40 bg-amber-400/5 text-amber-300"
                  : "border-white/15 text-foreground/70"
            }`}
            title={isFrozen
              ? t("timerFrozen")
              : parTimeMs
                ? t("levelTimerPar", { time: formatDuration(parTimeMs) })
                : t("levelTimer")}
          >
            <TimerIcon className="hidden h-3.5 w-3.5 sm:block" />
            {formatDuration(timeMs)}
            {parTimeMs !== undefined && (
              <span className="hidden text-muted-foreground/50 sm:inline">/{formatDuration(parTimeMs)}</span>
            )}
          </div>
        )}

        {!hideStars && (
          <div className="hidden items-center gap-0.5 px-1 sm:flex" title={t("starsAvailable", { stars })}>
            {Array.from({ length: 3 }).map((_, index) => (
              <StarIcon
                key={index}
                filled={index < stars}
                className={`h-3.5 w-3.5 transition-colors ${
                  index < stars ? "text-primary" : "text-white/15"
                }`}
              />
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo || undoDisabled || undoRemaining <= 0}
          aria-label={undoDisabled
            ? t("undoOffMode")
            : undoRemaining <= 0
              ? t("undoLimitReached")
              : `${t("undoHint")} · ${t("undoRemaining", { count: undoRemaining })}`}
          title={undoDisabled
            ? t("undoOffWeek")
            : undoRemaining <= 0
              ? t("undoLimitReached")
              : `${t("undoHint")} · ${t("undoRemaining", { count: undoRemaining })}`}
          className={`${countButton} border-white/15 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-40`}
        >
          <UndoIcon />
          {!undoDisabled && (
            <span className={`${count} ${undoRemaining > 0 ? "" : "text-amber-400"}`}>{undoRemaining}</span>
          )}
        </Button>

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
          className={`${countButton} ${restartsLeft === 0
            ? "border-red-500/60 text-red-300 hover:bg-red-500/10"
            : "border-white/15 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary"}`}
        >
          <RestartIcon />
          {restartsLeft !== undefined && <span className={count}>{restartsLeft}</span>}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onHint}
          disabled={hintLocked}
          aria-label={t("hintReveal")}
          title={hintDisabled
            ? t("hintsOffMode")
            : usesTokens && hintTokens <= 0
              ? t("hintTokenEmpty")
              : usesTokens
                ? t("hintCost", { label: t("hintReveal") })
                : t("hintReveal")}
          className={`${countButton} border-white/15 transition-colors ${
            hintLocked
              ? "cursor-not-allowed text-muted-foreground opacity-40"
              : "text-amber-300 hover:border-amber-300 hover:bg-amber-300/10"
          }`}
        >
          <HintIcon className={isHintLoading ? "animate-pulse" : ""} />
          {usesTokens && !hintDisabled && <span className={count}>{hintTokens}</span>}
        </Button>

        <Dialog open={showPowerUps} onOpenChange={setShowPowerUps}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("powerUps")}
              className={`${iconButton} border-white/15 text-primary hover:border-primary hover:bg-primary/10`}
            >
              <PowerIcon className="" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PowerIcon className="h-5 w-5 text-amber-300" />
                {t("powerUps")}
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
              aria-label={t("achievements")}
              className={`${iconButton} hidden border-white/15 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary sm:inline-flex`}
            >
              <TrophyIcon className="" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrophyIcon className="h-5 w-5 text-primary" />
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
              aria-label={t("keyboardShortcuts")}
              title={t("keyboardShortcuts")}
              className={`${iconButton} hidden border-white/15 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary sm:inline-flex`}
            >
              <HelpIcon className="" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpIcon className="h-5 w-5 text-primary" />
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
