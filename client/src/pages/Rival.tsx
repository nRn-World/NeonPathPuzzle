import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Flag, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/GameCanvas";
import { QrShare } from "@/components/QrShare";
import { EMPTY_MECHANICS } from "@shared/mechanics";
import { decodeRivalRun, encodeRivalRun, labBoardToLevel } from "@shared/labBoards";
import type { LevelResponse } from "@shared/schema";
import { useI18n, upper } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";
import { formatResultTime } from "@/lib/scoring";
import { absoluteHashUrl, copyText, rivalRoute } from "@/lib/shareLinks";
import { playClickSound } from "@/lib/sounds";

/** Signed seconds, one decimal. Negative means we are ahead of the ghost. */
function deltaText(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds >= 0 ? "+" : "−"}${Math.abs(seconds).toFixed(1)}s`;
}

/**
 * Ticks on its own so the board above is not re-rendered ten times a second.
 * The ghost is drawn from `performance.now()` inside GameCanvas, so both clocks
 * stay in the same time domain.
 */
function PaceBadge({ progress, pace, startedAt, active }: {
  progress: number;
  pace: number;
  startedAt: number;
  active: boolean;
}) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active]);
  const rivalAtMyProgress = progress * pace;
  const delta = active ? now - startedAt - rivalAtMyProgress : 0;
  return (
    <div
      role="status"
      aria-live="off"
      className={`border px-4 py-2 text-center font-mono text-sm ${
        delta <= 0 ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-rose-400/40 bg-rose-400/10 text-rose-300"
      }`}
    >
      {t("rivalDelta", { delta: deltaText(delta) })}
    </div>
  );
}

export default function Rival() {
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const [, params] = useRoute("/rival/:code");
  const run = useMemo(() => (params?.code ? decodeRivalRun(params.code) : null), [params?.code]);

  const [raceKey, setRaceKey] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [startedPerf, setStartedPerf] = useState(() => performance.now());
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ won: boolean } | null>(null);
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  const level = useMemo<LevelResponse | null>(
    () => run ? ({ ...labBoardToLevel(run.board), isLocked: false, isCompleted: false }) : null,
    [run],
  );
  const pace = run ? run.timeMs / Math.max(1, run.path.length - 1) : 0;
  const shareCode = useMemo(() => (run ? encodeRivalRun(run) : null), [run]);
  const shareUrl = useMemo(
    () => (shareCode ? absoluteHashUrl(rivalRoute(shareCode)) : null),
    [shareCode],
  );

  const startRace = useCallback(() => {
    playClickSound();
    setResult(null);
    setProgress(0);
    setStartedAt(Date.now());
    setStartedPerf(performance.now());
    setRaceKey(value => value + 1);
  }, []);

  const handleComplete = useCallback(() => {
    if (!run) return;
    const elapsed = Date.now() - startedAt;
    setFinalTimeMs(elapsed);
    setResult({ won: elapsed <= run.timeMs });
  }, [run, startedAt]);

  const share = async () => {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    setCopyState(ok ? "done" : "failed");
    window.setTimeout(() => setCopyState("idle"), 2400);
  };

  if (!run || !level) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="font-exo text-lg text-rose-300">{t("rivalInvalid")}</p>
        <Button asChild variant="outline"><Link href="/">{t("backToMenu")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label={t("backToMenu")}>
              <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-xl font-black tracking-wide text-violet-300 md:text-2xl">
                {upper(t("rivalTitle"))}
              </h1>
              <p className="font-exo text-xs text-muted-foreground">
                {t("rivalDesc")} · {upper(t("rivalGhostLabel"))} {formatResultTime(run.timeMs)}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-violet-300">{upper(t("rivalGhostLabel"))}</span>
        </header>

        <PaceBadge progress={progress} pace={pace} startedAt={startedAt} active={result === null} />

        <div className="relative mx-auto aspect-square w-full max-w-[min(78vw,72vh)] border border-secondary/20 bg-black/30">
          <GameCanvas
            key={raceKey}
            level={level}
            onComplete={handleComplete}
            onPathChange={visitedNodes => setProgress(Math.max(0, visitedNodes - 1))}
            showHint={false}
            onBacktrack={() => true}
            paused={result !== null}
            celebrate={result !== null}
            celebrationColor="#ff00a0"
            reducedMotion={reducedMotion}
            mechanics={EMPTY_MECHANICS}
            ghostPath={run.path}
            showGhost
            ghostPaceMsPerCell={pace}
            ghostStartAt={startedPerf}
            gridLabel={t("rivalGhostLabel")}
          />
        </div>

        {shareUrl && (
          <div className="mx-auto w-full max-w-md">
            <QrShare url={shareUrl} label={t("shareQr")} />
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-auto w-full max-w-md space-y-3 border p-5 text-center ${
              result.won ? "border-emerald-400/40 bg-emerald-400/10" : "border-rose-400/40 bg-rose-400/10"
            }`}
          >
            <h2 className="font-orbitron text-xl font-black">
              {result.won ? t("rivalWin") : t("rivalLose")}
            </h2>
            <p className="font-exo text-sm">
              {t("rivalResult", { time: formatResultTime(finalTimeMs), rival: formatResultTime(run.timeMs) })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={startRace} variant="outline"><RotateCcw className="mr-2 h-4 w-4" />{t("rivalReplay")}</Button>
              <Button onClick={share} variant="outline">
                {copyState === "done" ? <Copy className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
                {copyState === "done" ? t("rivalShareDone") : copyState === "failed" ? t("rivalShareFail") : t("rivalShare")}
              </Button>
            </div>
            <Button asChild variant="ghost" className="w-full"><Link href="/"><Flag className="mr-2 h-4 w-4" />{t("backToMenu")}</Link></Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
