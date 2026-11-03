import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Flame, Home, Play, RotateCcw, Skull, Undo2 } from "lucide-react";
import { CHAIN_UNDOS, generateChainBoard, type ChainBoard } from "@shared/chain";
import { EMPTY_MECHANICS } from "@shared/mechanics";
import type { LevelResponse, Point } from "@shared/schema";
import { GameCanvas, type GameCanvasHandle } from "@/components/GameCanvas";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/settings";
import { playDeadEndSound, playWinSound } from "@/lib/sounds";

type Phase = "intro" | "playing";

const BEST_KEY = "neon_path_chain_v1";

function readBestChain(): number {
  try {
    const value = Number(localStorage.getItem(BEST_KEY) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeBestChain(value: number) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be blocked; the best chain then only lasts for this visit.
  }
}

function toLevel(board: ChainBoard): LevelResponse {
  return {
    id: 0,
    gridSize: board.gridSize,
    start: board.start,
    nodes: board.nodes,
    isLocked: false,
    isCompleted: false,
  };
}

/**
 * Kedjan: solve a board, and the line you drew becomes walls on the next one.
 * Each cleared board extends the chain and the grid grows slowly.
 */
export default function Chain() {
  const [, setLocation] = useLocation();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);

  const [phase, setPhase] = useState<Phase>("intro");
  const [chain, setChain] = useState(1);
  const [board, setBoard] = useState<ChainBoard | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [undosLeft, setUndosLeft] = useState(CHAIN_UNDOS);
  const [stuck, setStuck] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [best, setBest] = useState(readBestChain);

  const canvasRef = useRef<GameCanvasHandle>(null);
  const boardRef = useRef<ChainBoard | null>(null);
  const chainRef = useRef(1);
  const undosRef = useRef(CHAIN_UNDOS);
  const advancingRef = useRef(false);
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  /** Puts a new board on screen and resets the per-board undo budget. */
  const commitBoard = useCallback((next: ChainBoard) => {
    boardRef.current = next;
    undosRef.current = CHAIN_UNDOS;
    setUndosLeft(CHAIN_UNDOS);
    setStuck(false);
    setBoard(next);
    setBoardKey(key => key + 1);
  }, []);

  const startRun = useCallback(() => {
    window.clearTimeout(timerRef.current);
    advancingRef.current = false;
    chainRef.current = 1;
    setChain(1);
    setBanner(null);
    commitBoard(generateChainBoard(1, null));
    setPhase("playing");
  }, [commitBoard]);

  /** The line the player drew becomes the walls of the next board. */
  const handleComplete = useCallback(
    (_moves: number, path: Point[]) => {
      const current = boardRef.current;
      if (!current || advancingRef.current) return;
      advancingRef.current = true;

      const nextChain = chainRef.current + 1;
      const next = generateChainBoard(nextChain, { path, gridSize: current.gridSize });

      playWinSound();
      setBanner(`Kedja ${nextChain}`);
      if (nextChain > best) {
        setBest(nextChain);
        writeBestChain(nextChain);
      }

      timerRef.current = window.setTimeout(() => {
        chainRef.current = nextChain;
        setChain(nextChain);
        setBanner(null);
        advancingRef.current = false;
        commitBoard(next);
      }, 900);
    },
    [best, commitBoard],
  );

  /** One free undo per board in the first place; after that a dead end is stuck. */
  const handleBacktrack = useCallback(() => {
    if (undosRef.current <= 0) return false;
    undosRef.current -= 1;
    setUndosLeft(undosRef.current);
    return true;
  }, []);

  const handleStuck = useCallback((value: boolean) => {
    if (value) playDeadEndSound();
    setStuck(value);
  }, []);

  const level = useMemo(() => (board ? toLevel(board) : null), [board]);
  const mechanics = useMemo(
    () => (board ? { ...EMPTY_MECHANICS, walls: board.walls } : EMPTY_MECHANICS),
    [board],
  );

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0a0f1e]">
      <div className="menu-grid pointer-events-none absolute inset-0 z-0" />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 border-b border-primary/20 px-2 py-2 sm:px-4">
          <button
            onClick={() => setLocation("/")}
            aria-label="Tillbaka"
            className="p-2 text-primary/70 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="neon-text truncate font-orbitron text-sm font-bold uppercase tracking-[0.2em] text-primary sm:text-lg">
              Kedjan
            </h1>
            <p className="truncate font-exo text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Din linje blir nästa bana
            </p>
          </div>

          {phase === "playing" && (
            <div className="flex h-7 flex-shrink-0 items-center gap-1 border border-primary/30 px-1.5 font-orbitron text-[11px] font-bold tabular-nums text-primary/80">
              <Flame className="h-3 w-3" />
              Kedja {chain}
            </div>
          )}
        </header>

        <div className="grid grid-cols-4 gap-2 border-b border-white/5 px-2 py-2 text-center sm:px-4">
          <Stat label="Kedja" value={String(chain)} highlight />
          <Stat label="Rutnät" value={board ? `${board.gridSize}×${board.gridSize}` : "-"} />
          <Stat label="Väggar" value={board ? String(board.walls.length) : "-"} />
          <Stat label="Bäst" value={String(best)} />
        </div>

        <main className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2">
          <AnimatePresence mode="wait">
            {phase === "playing" && level && mechanics && (
              <motion.div
                key="board"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full max-w-3xl"
              >
                <GameCanvas
                  key={boardKey}
                  ref={canvasRef}
                  level={level}
                  mechanics={mechanics}
                  showHint={false}
                  onComplete={handleComplete}
                  onBacktrack={handleBacktrack}
                  onStuckChange={handleStuck}
                  disableUndo={undosLeft <= 0}
                  paused={phase !== "playing"}
                  reducedMotion={reducedMotion}
                  showGhost={false}
                  gridLabel={`${level.gridSize}×${level.gridSize}`}
                  statusText={`${level.nodes.length} noder`}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12 }}
                className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 border border-primary/50 bg-primary/10 px-4 py-2 text-center font-orbitron text-lg font-bold text-primary"
              >
                {banner}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dead end: undo while budget lasts, or restart the board or the chain. */}
          {phase === "playing" && stuck && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/85 px-6 text-center backdrop-blur-sm">
              <Skull className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <h2 className="font-orbitron text-xl font-bold uppercase tracking-wider text-destructive">
                  Död ände
                </h2>
                <p className="font-exo text-sm text-muted-foreground">
                  {undosLeft > 0
                    ? `${undosLeft} ångra kvar på den här banan`
                    : "Inga ångra kvar. Börja om banan eller kedjan."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {undosLeft > 0 && (
                  <Button
                    onClick={() => canvasRef.current?.undo()}
                    className="bg-primary font-bold text-background hover:bg-primary/90"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Ångra
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setStuck(false);
                    canvasRef.current?.restart();
                  }}
                  className="border-white/10"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Banan
                </Button>
                <Button variant="outline" onClick={startRun} className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10">
                  Kedjan
                </Button>
              </div>
            </div>
          )}

          {/* Intro card. */}
          <AnimatePresence>
            {phase === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="absolute inset-0 z-30 flex items-center justify-center px-4"
              >
                <div className="w-full max-w-md space-y-5 border border-primary/25 border-t-[3px] border-t-primary bg-background/95 p-6 text-center shadow-[0_0_60px_rgba(0,0,0,0.6)]">
                  <Flame className="mx-auto h-10 w-10 text-primary" />
                  <div className="space-y-2">
                    <h2 className="font-orbitron text-2xl font-black uppercase tracking-wide text-white">Kedjan</h2>
                    <p className="font-exo text-sm leading-relaxed text-muted-foreground">
                      Lös banan. Linjen du ritade blir väggar i nästa bana, och varje klar bana förlänger kedjan.
                      Rutnätet växer långsamt.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border border-white/10 bg-background/60 p-3">
                    <Stat label="Bäst" value={String(best)} highlight />
                    <Stat label="Rutnät" value="4×4" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      onClick={startRun}
                      className="h-12 w-full bg-primary text-lg font-bold text-background shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:bg-primary/90"
                    >
                      <Play className="mr-2 h-5 w-5" />
                      Starta
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/")} className="border-white/10">
                      <Home className="mr-2 h-4 w-4" />
                      Meny
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className={`font-orbitron text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="font-exo text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
