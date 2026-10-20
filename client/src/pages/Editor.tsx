import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Copy,
  Play,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type { Point } from "@shared/schema";
import {
  deleteCustomLevel,
  encodeCustomLevel,
  getSavedCustomLevels,
  saveCustomLevel,
  type SavedCustomLevel,
} from "@/lib/customLevels";

const GRID_SIZES = [4, 5, 6, 7, 8];

export default function Editor() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useI18n();
  const [gridSize, setGridSize] = useState(5);
  const [path, setPath] = useState<Point[]>([]);
  const [name, setName] = useState(() => t("defaultCircuitName"));
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedCustomLevel[]>(() => getSavedCustomLevels());

  const encoded = useMemo(
    () => encodeCustomLevel({ name, gridSize, path }),
    [gridSize, name, path],
  );
  const pathKeys = new Map(path.map((point, index) => [`${point.x},${point.y}`, index]));
  const error = encoded.ok ? null : encoded.error;

  const handleCell = (point: Point) => {
    const existingIndex = pathKeys.get(`${point.x},${point.y}`);
    if (existingIndex !== undefined) {
      setPath(current => current.slice(0, existingIndex + 1));
      return;
    }

    if (path.length === 0) {
      setPath([point]);
      return;
    }

    const last = path[path.length - 1];
    if (Math.abs(last.x - point.x) + Math.abs(last.y - point.y) !== 1) {
      toast({ title: t("nodesMustTouch"), description: t("nodesMustTouchDesc") });
      return;
    }
    setPath(current => [...current, point]);
  };

  const changeGrid = (size: number) => {
    setGridSize(size);
    setPath([]);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!encoded.ok) return;
    const link = `${window.location.origin}${window.location.pathname}#/custom/${encoded.level.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: t("linkCopied"), description: t("linkCopiedDesc") });
    } catch {
      toast({ title: t("couldNotCopy"), description: t("couldNotCopyDesc"), variant: "destructive" });
    }
  };

  const handleSave = () => {
    if (!encoded.ok) return;
    saveCustomLevel(encoded.level);
    setSaved(getSavedCustomLevels());
    toast({ title: t("levelSaved"), description: t("levelSavedDesc") });
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-background p-4 md:p-8 safe-scroll">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              {t("menu")}
            </Link>
            <h1 className="bg-gradient-to-br from-primary via-white to-secondary bg-clip-text font-orbitron text-3xl font-bold text-transparent md:text-4xl">
              {t("editorTitle").toUpperCase()}
            </h1>
            <p className="font-exo text-sm text-muted-foreground">
              {t("editorSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-white/15">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("menu")}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-xl border border-white/10 bg-card/50 p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" role="group" aria-label="Grid size">
                {GRID_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => changeGrid(size)}
                    aria-pressed={size === gridSize}
                    className={`h-8 w-8 rounded-md border font-mono text-xs transition-colors ${
                      size === gridSize
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-white/10 text-muted-foreground hover:border-white/30"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPath(current => current.slice(0, -1))}
                  disabled={path.length === 0}
                  className="border-white/15"
                >
                  <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("undo")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPath([])}
                  disabled={path.length === 0}
                  className="border-white/15"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {t("clear")}
                </Button>
              </div>
            </div>

            <div
              className="mx-auto grid aspect-square w-full max-w-xl gap-1.5 rounded-xl border border-white/10 bg-background/60 p-3"
              style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: gridSize * gridSize }, (_, index) => {
                const point = { x: index % gridSize, y: Math.floor(index / gridSize) };
                const order = pathKeys.get(`${point.x},${point.y}`);
                const isLast = order === path.length - 1;
                const isStart = order === 0;
                return (
                  <button
                    key={index}
                    onClick={() => handleCell(point)}
                    aria-label={`Cell ${point.x + 1}, ${point.y + 1}${order !== undefined ? `, step ${order + 1}` : ""}`}
                    className={`flex aspect-square items-center justify-center rounded-lg border font-orbitron text-sm transition-all ${
                      order !== undefined
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-white/5 bg-white/[0.02] text-muted-foreground/30 hover:border-white/20 hover:bg-white/5"
                    } ${isStart ? "ring-2 ring-primary/60" : ""} ${
                      isLast ? "shadow-[0_0_18px_rgba(0,243,255,0.45)]" : ""
                    }`}
                  >
                    {order !== undefined ? order + 1 : "·"}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-center font-exo text-xs text-muted-foreground">
              {t("drawHint")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-card/50 p-4">
              <label className="mb-1.5 block font-exo text-xs text-muted-foreground" htmlFor="circuit-name">
                {t("circuitName")}
              </label>
              <input
                id="circuit-name"
                value={name}
                maxLength={40}
                onChange={event => setName(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-background/60 px-3 py-2 font-exo text-sm outline-none focus:border-primary/60"
              />

              <dl className="mt-4 grid grid-cols-2 gap-2 font-exo text-xs">
                <div className="rounded-lg border border-white/10 p-2">
                  <dt className="text-muted-foreground">{t("nodes")}</dt>
                  <dd className="font-orbitron text-lg text-primary">{path.length}</dd>
                </div>
                <div className="rounded-lg border border-white/10 p-2">
                  <dt className="text-muted-foreground">{t("grid")}</dt>
                  <dd className="font-orbitron text-lg text-primary">{gridSize}×{gridSize}</dd>
                </div>
              </dl>

              {error && (
                <p className="mt-3 font-exo text-xs text-amber-300" role="status">
                  {error}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <Button
                  onClick={() => encoded.ok && setLocation(`/custom/${encoded.level.code}`)}
                  disabled={!encoded.ok}
                  className="w-full bg-primary font-bold text-background hover:bg-primary/90"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t("playCircuit")}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleCopy} disabled={!encoded.ok} className="border-white/15">
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? t("copied") : t("copyLink")}
                  </Button>
                  <Button variant="outline" onClick={handleSave} disabled={!encoded.ok} className="border-white/15">
                    <Save className="mr-2 h-4 w-4" />
                    {t("save")}
                  </Button>
                </div>
              </div>

              {encoded.ok && (
                <p className="mt-3 break-all rounded-md border border-white/10 bg-background/50 p-2 font-mono text-[9px] text-muted-foreground">
                  {encoded.level.code}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-card/50 p-4">
              <h2 className="mb-2 flex items-center gap-2 font-orbitron text-sm font-bold">
                <Wand2 className="h-4 w-4 text-secondary" />
                {t("savedCircuits")}
              </h2>
              {saved.length === 0 ? (
                <p className="font-exo text-xs text-muted-foreground">
                  {t("nothingSaved")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {saved.map(level => (
                    <li
                      key={level.code}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-exo text-sm">{level.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {level.gridSize}×{level.gridSize} · {level.nodeCount} nodes
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        <button
                          onClick={() => setLocation(`/custom/${level.code}`)}
                          aria-label={`Play ${level.name}`}
                          className="rounded p-1.5 text-primary hover:bg-primary/10"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setSaved(deleteCustomLevel(level.code))}
                          aria-label={`Delete ${level.name}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-white/5 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
