import { useMemo, useState } from "react";
import { Lock, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chapters } from "@/lib/chapters";
import { content } from "@/lib/contentText";
import { getChapterStory } from "@/lib/story";
import { RIFT_FIRST_LEVEL, RIFT_LEVEL_COUNT, isRiftUnlocked } from "@/lib/rift";
import { useI18n, upper } from "@/lib/i18n";
import type { LevelRecord } from "@/lib/progress";

const RIFT_ID = 13;
const RIFT_ACCENT = "#ff4dff";

interface WorldMapProps {
  continueLevel: number;
  completedLevels: number[];
  records: Record<string, LevelRecord>;
  riftCleared: number;
  onPlay: (levelId: number) => void;
}

interface MapNode {
  id: number;
  name: string;
  accent: string;
  from: number;
  to: number;
  unlocked: boolean;
  cleared: number;
  total: number;
  stars: number;
  maxStars: number;
}

const ROW = 96;
const LEFT = 84;
const RIGHT = 276;

/** The campaign as a winding route: one stop per chapter, then the Rift. */
export function WorldMap({ continueLevel, completedLevels, records, riftCleared, onPlay }: WorldMapProps) {
  const { t } = useI18n();
  const nodes = useMemo<MapNode[]>(() => {
    const completed = new Set(completedLevels);
    const campaign = chapters.map(chapter => {
      let cleared = 0;
      let stars = 0;
      for (let id = chapter.from; id <= chapter.to; id++) {
        if (completed.has(id)) cleared++;
        stars += records[String(id)]?.stars ?? 0;
      }
      const total = chapter.to - chapter.from + 1;
      return {
        id: chapter.id,
        name: content.chapter(chapter).name,
        accent: chapter.accent,
        from: chapter.from,
        to: chapter.to,
        unlocked: chapter.from <= continueLevel,
        cleared,
        total,
        stars,
        maxStars: total * 3,
      };
    });
    const riftStars = Array.from({ length: RIFT_LEVEL_COUNT }, (_, index) => records[String(RIFT_FIRST_LEVEL + index)]?.stars ?? 0)
      .reduce((sum, value) => sum + value, 0);
    return [
      ...campaign,
      {
        id: RIFT_ID,
        name: t("riftName"),
        accent: RIFT_ACCENT,
        from: RIFT_FIRST_LEVEL,
        to: RIFT_FIRST_LEVEL + RIFT_LEVEL_COUNT - 1,
        unlocked: isRiftUnlocked(completed.size),
        cleared: riftCleared,
        total: RIFT_LEVEL_COUNT,
        stars: riftStars,
        maxStars: RIFT_LEVEL_COUNT * 3,
      },
    ];
  }, [completedLevels, continueLevel, records, riftCleared, t]);

  const current = nodes.find(node => node.id !== RIFT_ID && continueLevel >= node.from && continueLevel <= node.to) ?? nodes[0];
  const [selectedId, setSelectedId] = useState(current.id);
  const selected = nodes.find(node => node.id === selectedId) ?? current;

  const point = (index: number) => ({ x: index % 2 === 0 ? LEFT : RIGHT, y: 48 + index * ROW });
  const height = 48 + (nodes.length - 1) * ROW + 56;
  const route = nodes
    .map((_, index) => {
      const { x, y } = point(index);
      if (index === 0) return `M ${x} ${y}`;
      const previous = point(index - 1);
      const mid = (previous.y + y) / 2;
      return `C ${previous.x} ${mid} ${x} ${mid} ${x} ${y}`;
    })
    .join(" ");

  const playTarget = (node: MapNode) => {
    if (node.id === RIFT_ID) {
      for (let id = node.from; id <= node.to; id++) {
        if ((records[String(id)]?.stars ?? 0) === 0) return id;
      }
      return node.from;
    }
    if (continueLevel >= node.from && continueLevel <= node.to) return continueLevel;
    for (let id = node.from; id <= Math.min(node.to, continueLevel); id++) {
      if ((records[String(id)]?.stars ?? 0) < 3) return id;
    }
    return node.from;
  };

  return (
    <div className="space-y-5">
      <div
        className="border bg-black/40 p-5 text-left"
        style={{ borderColor: `${selected.accent}66`, boxShadow: `0 0 40px ${selected.accent}18` }}
      >
        <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: selected.accent }}>
          {selected.id === RIFT_ID ? upper(t("bonusSector")) : upper(t("chapterLabel", { n: selected.id }))}
        </p>
        <h3 className="mt-1 font-orbitron text-2xl font-black">{upper(selected.name)}</h3>
        <p className="mt-3 min-h-[5rem] whitespace-pre-line font-mono text-xs leading-relaxed text-foreground/75">
          {selected.unlocked ? getChapterStory(selected.id) : t("chapterLocked")}
        </p>
        <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>{selected.cleared}/{selected.total} · {t("levelsRange", { from: selected.from, to: selected.to })}</span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-accent text-accent" />
            {selected.stars}/{selected.maxStars}
          </span>
        </div>
        <Button
          disabled={!selected.unlocked}
          onClick={() => onPlay(playTarget(selected))}
          className="mt-4 w-full rounded-none font-bold text-background disabled:opacity-40"
          style={{ background: selected.accent }}
        >
          {selected.unlocked ? <Play className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
          {selected.unlocked
            ? upper(t("level")) + " " + playTarget(selected)
            : selected.id === RIFT_ID ? t("riftLocked") : t("locked")}
        </Button>
      </div>

      <svg viewBox={`0 0 360 ${height}`} className="mx-auto w-full max-w-sm" role="group" aria-label={t("worldMap")}>
        <path d={route} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
        {nodes.map((node, index) => {
          const { x, y } = point(index);
          const isCurrent = node.id === current.id;
          const isSelected = node.id === selected.id;
          const done = node.cleared === node.total;
          const labelLeft = x === LEFT;
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${node.name}${node.unlocked ? "" : ` (${t("locked")})`}`}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={event => (event.key === "Enter" || event.key === " ") && setSelectedId(node.id)}
              className="cursor-pointer outline-none"
              opacity={node.unlocked ? 1 : 0.45}
            >
              {isSelected && <circle cx={x} cy={y} r={36} fill="none" stroke={node.accent} strokeOpacity={0.5} strokeDasharray="3 5" />}
              <circle
                cx={x}
                cy={y}
                r={28}
                fill={done ? node.accent : "#0a0f1e"}
                stroke={node.accent}
                strokeWidth={isCurrent ? 4 : 2}
                style={isCurrent ? { filter: `drop-shadow(0 0 10px ${node.accent})` } : undefined}
              />
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Orbitron, sans-serif"
                fontWeight={800}
                fontSize={node.id === RIFT_ID ? 20 : 22}
                fill={done ? "#0a0f1e" : node.unlocked ? node.accent : "#8b93a7"}
              >
                {node.unlocked ? (node.id === RIFT_ID ? "∞" : node.id) : "🔒"}
              </text>
              <text
                x={labelLeft ? x + 40 : x - 40}
                y={y - 5}
                textAnchor={labelLeft ? "start" : "end"}
                fontFamily="Orbitron, sans-serif"
                fontWeight={700}
                fontSize={13}
                fill="#e8ecf8"
              >
                {upper(node.name)}
              </text>
              <text
                x={labelLeft ? x + 40 : x - 40}
                y={y + 13}
                textAnchor={labelLeft ? "start" : "end"}
                fontFamily="'Exo 2', sans-serif"
                fontSize={12}
                fill="#8b93a7"
              >
                {node.cleared}/{node.total} · {node.stars}★
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
