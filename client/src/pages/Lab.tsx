import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Copy, Dices, Eraser, Play, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/GameCanvas";
import { EMPTY_MECHANICS } from "@shared/mechanics";
import { countSolutions } from "@shared/solver";
import { difficultyFromExpanded, UNIQUE_LEVEL_IDS } from "@shared/challenges";
import { generateLevel } from "@shared/level-generator";
import {
  decodeLabBoard,
  encodeLabBoard,
  labBoardError,
  labBoardToLevel,
  LAB_MAX_GRID,
  LAB_MIN_GRID,
  LAB_MIN_NODES,
  type LabBoard,
} from "@shared/labBoards";
import type { LevelResponse, Point } from "@shared/schema";
import { useI18n, upper } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";
import { formatResultTime } from "@/lib/scoring";
import { absoluteHashUrl, copyText, labRoute } from "@/lib/shareLinks";
import { playClickSound } from "@/lib/sounds";

const pointKey = (point: Point) => `${point.x},${point.y}`;

function fromGenerated(levelId: number): LabBoard {
  const level = generateLevel(levelId);
  return { gridSize: level.gridSize, start: level.start, nodes: level.nodes };
}

/** A proven unique 5-node puzzle is a friendlier first canvas than an empty grid. */
function initialBoard(): LabBoard {
  return fromGenerated(1);
}

function clampBoard(board: LabBoard, size: number): LabBoard {
  const nodes = board.nodes
    .filter(node => node.x < size && node.y < size)
    .map(node => ({ x: node.x, y: node.y }));
  const startInside = board.start.x < size && board.start.y < size && nodes.some(node => pointKey(node) === pointKey(board.start));
  const start = startInside ? board.start : (nodes[0] ?? { x: 0, y: 0 });
  if (!nodes.some(node => pointKey(node) === pointKey(start))) nodes.unshift({ ...start });
  return { gridSize: size, start, nodes };
}

export default function Lab() {
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const [, params] = useRoute("/lab/:code");
  const sharedCode = params?.code ?? null;
  const decoded = useMemo(() => (sharedCode ? decodeLabBoard(sharedCode) : null), [sharedCode]);

  const [board, setBoard] = useState<LabBoard>(() => decoded ?? initialBoard());
  const [setStartMode, setSetStartMode] = useState(false);
  const [phase, setPhase] = useState<"edit" | "play">("edit");
  const [raceKey, setRaceKey] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [resultMs, setResultMs] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  const nodeKeys = useMemo(() => new Set(board.nodes.map(pointKey)), [board.nodes]);
  const validation = useMemo(() => {
    const error = labBoardError(board);
    if (error) return { error, count: 0, incomplete: false, difficulty: 0 };
    const level = labBoardToLevel(board);
    const stats = countSolutions(level, { cap: 2, budget: 120_000 });
    return {
      error: null,
      count: stats.count,
      incomplete: stats.incomplete,
      difficulty: difficultyFromExpanded(stats.expanded, board.nodes.length).score,
    };
  }, [board]);

  const canPlay = validation.error === null && validation.count === 1 && !validation.incomplete;
  const shareCode = useMemo(() => encodeLabBoard(board), [board]);
  const level = useMemo<LevelResponse>(
    () => ({ ...labBoardToLevel(board), isLocked: false, isCompleted: false }),
    [board],
  );

  const update = (next: LabBoard) => {
    playClickSound();
    setBoard(next);
  };

  const toggleCell = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (setStartMode) {
      if (nodeKeys.has(key)) {
        update({ ...board, start: { x, y } });
        setSetStartMode(false);
      }
      return;
    }
    const exists = nodeKeys.has(key);
    let nodes = exists ? board.nodes.filter(node => pointKey(node) !== key) : [...board.nodes, { x, y }];
    let start = board.start;
    if (exists && pointKey(start) === key) {
      start = nodes[0] ?? { x, y };
      if (nodes.length === 0) nodes = [{ ...start }];
    }
    update({ ...board, start, nodes });
  };

  const surpriseMe = () => {
    const id = UNIQUE_LEVEL_IDS[Math.floor(Math.random() * UNIQUE_LEVEL_IDS.length)];
    setSetStartMode(false);
    update(fromGenerated(id));
  };

  const share = async () => {
    if (!shareCode) return;
    const ok = await copyText(absoluteHashUrl(labRoute(shareCode)));
    setCopyState(ok ? "done" : "failed");
    window.setTimeout(() => setCopyState("idle"), 2400);
  };

  const startPlay = () => {
    setResultMs(null);
    setStartedAt(Date.now());
    setRaceKey(value => value + 1);
    setPhase("play");
  };

  const status = validation.error !== null
    ? t("labInvalid", { count: LAB_MIN_NODES })
    : validation.incomplete
      ? t("labSolutionUnknown")
      : validation.count === 0
        ? t("labSolutionNone")
        : validation.count === 1
          ? t("labSolutionOne")
          : t("labSolutionMulti", { count: validation.count });
  const statusTone = canPlay
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
    : "border-amber-400/30 bg-amber-400/5 text-amber-200";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 md:p-6">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label={t("backToMenu")}>
              <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="font-orbitron text-xl font-black tracking-wide text-primary md:text-2xl">
                {upper(t("labTitle"))}
              </h1>
              <p className="font-exo text-xs text-muted-foreground">{t("labSubtitle")}</p>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-violet-300">LAB / v1</span>
        </header>

        {decoded && (
          <div className="border border-secondary/30 bg-secondary/10 p-3 font-exo text-xs text-violet-200">
            <strong className="font-bold">{t("labOpened")}</strong> · {t("labOpenedDesc")}
          </div>
        )}
        {sharedCode && !decoded && (
          <div className="border border-rose-400/30 bg-rose-400/10 p-3 font-exo text-xs text-rose-200">
            {t("rivalInvalid")}
          </div>
        )}

        {phase === "edit" ? (
          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="flex flex-col gap-3">
              <div className="mx-auto w-full max-w-[min(78vw,72vh)]">
                <div
                  className="grid aspect-square w-full gap-[2px] border border-white/10 bg-black/40 p-[2px]"
                  style={{ gridTemplateColumns: `repeat(${board.gridSize}, minmax(0, 1fr))` }}
                  role="group"
                  aria-label={t("labTitle")}
                >
                  {Array.from({ length: board.gridSize * board.gridSize }, (_, index) => {
                    const x = index % board.gridSize;
                    const y = Math.floor(index / board.gridSize);
                    const key = `${x},${y}`;
                    const isNode = nodeKeys.has(key);
                    const isStart = pointKey(board.start) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCell(x, y)}
                        aria-label={`${x + 1},${y + 1}${isNode ? " node" : " empty"}${isStart ? " start" : ""}`}
                        aria-pressed={isNode}
                        className={`relative flex items-center justify-center border text-[10px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                          isNode ? "border-primary/40 bg-primary/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.06]"
                        }`}
                      >
                        {isNode && (
                          <motion.span
                            layout={!reducedMotion}
                            className={`rounded-full ${isStart ? "h-1/2 w-1/2 bg-amber-300 shadow-[0_0_12px_#fcd34d]" : "h-1/3 w-1/3 bg-cyan-300 shadow-[0_0_8px_#67e8f9]"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-center font-exo text-xs text-muted-foreground">
                {setStartMode ? t("labStartHint") : t("labNodes", { count: board.nodes.length })}
              </p>
            </section>

            <aside className="flex flex-col gap-3">
              <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                <label htmlFor="lab-grid" className="font-exo text-xs text-muted-foreground">{t("labGrid")}</label>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: LAB_MAX_GRID - LAB_MIN_GRID + 1 }, (_, i) => LAB_MIN_GRID + i).map(size => (
                    <button
                      key={size}
                      id={size === board.gridSize ? "lab-grid" : undefined}
                      onClick={() => update(clampBoard(board, size))}
                      aria-pressed={size === board.gridSize}
                      className={`h-8 w-8 border font-mono text-xs ${size === board.gridSize ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-muted-foreground hover:border-primary/40"}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-exo text-xs text-muted-foreground">{t("labStart")}</span>
                  <span className="font-mono text-xs text-amber-200">{board.start.x + 1},{board.start.y + 1}</span>
                </div>
                <Button
                  variant={setStartMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSetStartMode(value => !value)}
                  className="w-full"
                >
                  <Target className="mr-2 h-4 w-4" />
                  {t("labStart")}
                </Button>
              </div>

              <div className={`border p-3 font-exo text-sm ${statusTone}`} role="status" aria-live="polite">
                {status}
                {validation.error === null && (
                  <p className="mt-1 font-mono text-[11px] opacity-80">{t("labDifficulty", { score: validation.difficulty })}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={surpriseMe}>
                  <Dices className="mr-1 h-4 w-4" />{t("labRandom")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ ...board, nodes: [{ ...board.start }] })}
                >
                  <Eraser className="mr-1 h-4 w-4" />{t("labClear")}
                </Button>
              </div>

              <Button onClick={startPlay} disabled={!canPlay} size="lg" className="w-full font-bold">
                <Play className="mr-2 h-4 w-4" />{t("labPlay")}
              </Button>
              <Button onClick={share} disabled={!shareCode} variant="outline" className="w-full">
                {copyState === "done" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copyState === "done" ? t("labShareDone") : copyState === "failed" ? t("labShareFail") : t("labShare")}
              </Button>
              {shareCode && (
                <code className="break-all font-mono text-[10px] leading-tight text-muted-foreground">#{labRoute(shareCode)}</code>
              )}
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-4">
            <div className="relative aspect-square w-full max-w-[min(78vw,72vh)] border border-primary/20 bg-black/30">
              <GameCanvas
                key={raceKey}
                level={level}
                onComplete={() => setResultMs(Date.now() - startedAt)}
                showHint={false}
                onBacktrack={() => true}
                paused={resultMs !== null}
                celebrate={resultMs !== null}
                celebrationColor="#00f3ff"
                reducedMotion={reducedMotion}
                mechanics={EMPTY_MECHANICS}
                gridLabel={t("labMode")}
              />
            </div>
            {resultMs !== null && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md space-y-3 border border-primary/40 bg-primary/10 p-5 text-center"
              >
                <h2 className="font-orbitron text-xl font-black text-primary">{t("labWin")}</h2>
                <p className="font-exo text-sm">{t("labWinTime", { time: formatResultTime(resultMs) })}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={startPlay} variant="outline"><Play className="mr-2 h-4 w-4" />{t("labReplay")}</Button>
                  <Button onClick={() => setPhase("edit")} variant="outline">{t("labEdit")}</Button>
                </div>
                <Button onClick={share} variant="ghost" className="w-full">
                  <Copy className="mr-2 h-4 w-4" />{copyState === "done" ? t("labShareDone") : t("labShare")}
                </Button>
              </motion.div>
            )}
            {resultMs === null && (
              <Button variant="outline" onClick={() => setPhase("edit")}>{t("labEdit")}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
