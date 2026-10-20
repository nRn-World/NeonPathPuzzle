import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Home, RotateCcw, Undo2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface DeadEndProps {
  open: boolean;
  /** Undos still available: when > 0 the player can back out instead. */
  undoLeft: number;
  /** Attempts left after this one; null when the level has no attempt limit. */
  attemptsLeft: number | null;
  onUndo: () => void;
  onRestart: () => void;
}

/**
 * The line has no legal move left. With undos left this is a small banner the
 * player can dismiss by backing out; without them the attempt is over.
 */
export function DeadEndOverlay({ open, undoLeft, attemptsLeft, onUndo, onRestart }: DeadEndProps) {
  const { t } = useI18n();
  const final = attemptsLeft === 0;

  return (
    <AnimatePresence>
      {open && undoLeft > 0 && (
        <motion.div
          key="banner"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="absolute bottom-4 left-1/2 z-30 flex w-[min(92%,420px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-400/40 bg-background/90 px-4 py-3 shadow-[0_0_30px_rgba(251,191,36,0.15)] backdrop-blur-md"
          role="status"
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="font-orbitron text-xs font-bold tracking-wide text-amber-200">{t("deadEnd")}</p>
            <p className="font-exo text-[11px] text-muted-foreground">{t("deadEndUndo", { count: undoLeft })}</p>
          </div>
          <Button size="sm" onClick={onUndo} className="bg-amber-400 font-bold text-background hover:bg-amber-300">
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            {t("undo")}
          </Button>
        </motion.div>
      )}

      {open && undoLeft <= 0 && (
        <motion.div
          key="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/80 px-6 text-center backdrop-blur-md"
          role="alertdialog"
          aria-labelledby="dead-end-title"
        >
          <motion.div
            initial={{ scale: 0.8, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${final ? "border-red-500/50 bg-red-500/10" : "border-amber-400/40 bg-amber-400/10"}`}
          >
            <Zap className={`h-8 w-8 ${final ? "text-red-400" : "text-amber-300"}`} />
          </motion.div>
          <div className="space-y-1">
            <h2 id="dead-end-title" className="font-orbitron text-2xl font-bold tracking-wide">{t("shortCircuit")}</h2>
            <p className="max-w-xs font-exo text-sm text-muted-foreground">
              {attemptsLeft === null
                ? t("shortCircuitFree")
                : final
                  ? t("shortCircuitFinal")
                  : t("shortCircuitDesc", { count: attemptsLeft })}
            </p>
          </div>
          <Button
            onClick={onRestart}
            className={final ? "bg-red-500 font-bold text-white hover:bg-red-400" : "bg-primary font-bold text-background hover:bg-primary/90"}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {final ? t("acceptCrash") : t("tryAgain")}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Restarting on the last attempt ends the run, so it is never one stray tap. */
export function LastAttemptConfirm({ open, onConfirm, onCancel }: ConfirmProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 px-6 backdrop-blur-md"
          role="alertdialog"
          aria-labelledby="last-attempt-title"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-red-500/40 bg-background/95 p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.2)]"
          >
            <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
            <h2 id="last-attempt-title" className="font-orbitron text-xl font-bold">{t("lastAttemptTitle")}</h2>
            <p className="font-exo text-sm text-muted-foreground">{t("lastAttemptDesc")}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={onCancel} className="bg-primary font-bold text-background hover:bg-primary/90">
                {t("keepPlaying")}
              </Button>
              <Button variant="outline" onClick={onConfirm} className="border-red-500/40 text-red-300 hover:bg-red-500/10">
                {t("acceptCrash")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CrashProps {
  open: boolean;
  levelId: number;
  /** Levels the run had cleared before it crashed. */
  lostLevels: number;
  reducedMotion: boolean;
  onRestartRun: () => void;
  onMenu: () => void;
}

/** Three failed attempts: the run is wiped and starts again at level 1. */
export function CrashModal({ open, levelId, lostLevels, reducedMotion, onRestartRun, onMenu }: CrashProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 px-6"
          role="alertdialog"
          aria-labelledby="crash-title"
        >
          {!reducedMotion && <div className="crash-scanlines pointer-events-none absolute inset-0" />}
          <motion.div
            initial={reducedMotion ? false : { scale: 1.3, opacity: 0, filter: "blur(8px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative w-full max-w-md space-y-5 rounded-2xl border border-red-500/50 bg-background/95 p-7 text-center shadow-[0_0_60px_rgba(239,68,68,0.35)]"
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-red-400/80">ERR_0x{levelId.toString(16).toUpperCase().padStart(3, "0")} · CORE DUMP</p>
            <h2
              id="crash-title"
              data-text="SYSTEM CRASH"
              className={`font-orbitron text-3xl font-black tracking-wider text-red-400 md:text-4xl ${reducedMotion ? "" : "glitch-text"}`}
            >
              SYSTEM CRASH
            </h2>
            <p className="font-exo text-sm text-muted-foreground">
              {t("crashDesc", { level: levelId })}
            </p>
            {lostLevels > 0 && (
              <p className="font-exo text-xs text-red-300/80">{t("crashLost", { count: lostLevels })}</p>
            )}
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 font-exo text-xs text-primary/90">
              {t("crashKept")}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={onRestartRun} className="bg-red-500 py-5 font-bold text-white hover:bg-red-400">
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("rebootFromOne")}
              </Button>
              <Button variant="outline" onClick={onMenu} className="border-white/15">
                <Home className="mr-2 h-4 w-4" />
                {t("menu")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
