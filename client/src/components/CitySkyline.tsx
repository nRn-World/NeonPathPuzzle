import { memo, useId } from "react";
import { chapters, type Chapter } from "@/lib/chapters";
import { useSettingsStore } from "@/lib/settings";

/*
 * The city grows with the player: one district per chapter, one window group per
 * cleared level, and a whole district lights up (signs, glow, traffic) once its
 * chapter is done. The geometry is seeded, so the skyline never changes between visits.
 */

const VIEW_W = 1200;
const VIEW_H = 200;
const GROUND = 186;
const DISTRICT_W = VIEW_W / chapters.length;

interface Window {
  x: number;
  y: number;
  /** Index into the chapter's levels: the window lights when that level is cleared. */
  slot: number;
}

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface District {
  chapter: Chapter;
  x0: number;
  buildings: Building[];
  windows: Window[];
  signs: Building[];
}

/** Small deterministic PRNG (mulberry32), so the skyline is the same on every load. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDistrict(chapter: Chapter, index: number): District {
  const rnd = mulberry32(chapter.id * 9301 + 49297);
  const x0 = index * DISTRICT_W;
  const levelCount = chapter.to - chapter.from + 1;

  // Shuffled slot order so one level's windows are spread across the district.
  const order = Array.from({ length: levelCount }, (_, slot) => slot);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const buildings: Building[] = [];
  const signs: Building[] = [];
  const windows: Window[] = [];
  let windowCount = 0;
  let x = x0 + 1;

  while (x < x0 + DISTRICT_W - 3) {
    const w = 5 + Math.floor(rnd() * 7);
    // Taller buildings towards the middle of each district.
    const centre = 1 - Math.abs((x - x0) / DISTRICT_W - 0.5) * 1.4;
    const h = Math.min(GROUND - 8, 34 + Math.floor(rnd() * 70) + Math.round(centre * 50));
    const building = { x, y: GROUND - h, w, h };
    buildings.push(building);
    if (buildings.length % 4 === 1 && w >= 6) signs.push({ x: x + 1, y: GROUND - h - 3, w: Math.min(w - 2, 8), h: 2.2 });

    const cols = Math.max(1, Math.floor((w - 2) / 3));
    const rows = Math.floor((h - 6) / 5);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (rnd() < 0.12) continue;
        windows.push({
          x: x + 1.5 + col * 3,
          y: GROUND - h + 3 + row * 5,
          slot: order[windowCount % levelCount],
        });
        windowCount++;
      }
    }
    x += w + 1 + Math.floor(rnd() * 2);
  }

  return { chapter, x0, buildings, windows, signs };
}

/** Pure geometry, built once at module load. */
const CITY: District[] = chapters.map((chapter, index) => buildDistrict(chapter, index));

interface CitySkylineProps {
  /** Level ids that have been cleared. */
  completedLevels: number[];
  className?: string;
}

function CitySkylineImpl({ completedLevels, className = "" }: CitySkylineProps) {
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const uid = useId().replace(/:/g, "");
  const done = new Set(completedLevels);
  const glowId = `${uid}-glow`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden
      className={`pointer-events-none block h-auto w-full select-none ${className}`}
    >
      <defs>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ground and the dark silhouettes. */}
      <rect x={0} y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill="#070b18" />
      {CITY.map(district => (
        <g key={district.chapter.id}>
          {district.buildings.map(building => (
            <rect
              key={building.x}
              x={building.x}
              y={building.y}
              width={building.w}
              height={building.h}
              fill="#0b1124"
              stroke="hsl(var(--primary) / 0.12)"
              strokeWidth={0.6}
            />
          ))}
        </g>
      ))}

      {CITY.map(district => {
        const { from, to } = district.chapter;
        let complete = true;
        for (let level = from; level <= to; level++) {
          if (!done.has(level)) {
            complete = false;
            break;
          }
        }
        const lit = district.windows.filter(window => done.has(district.chapter.from + window.slot));

        return (
          <g key={`lit-${district.chapter.id}`}>
            {/* Each cleared level lights its own window group. */}
            <g filter={`url(#${glowId})`} fill="hsl(var(--primary))" opacity={complete ? 1 : 0.85}>
              {lit.map((window, index) => (
                <rect
                  key={`${window.x}-${window.y}`}
                  x={window.x}
                  y={window.y}
                  width={1.8}
                  height={2.8}
                >
                  {!reducedMotion && index % 9 === 0 && (
                    <animate
                      attributeName="opacity"
                      values="0.45;1;0.7;1"
                      dur={`${3 + (index % 5)}s`}
                      begin={`-${index % 7}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </rect>
              ))}
            </g>

            {complete && (
              <g>
                {/* A finished chapter lights its whole district: signs in the chapter accent. */}
                {district.signs.map(sign => (
                  <rect key={sign.x} x={sign.x} y={sign.y} width={sign.w} height={sign.h} fill={district.chapter.accent} filter={`url(#${glowId})`}>
                    {!reducedMotion && (
                      <animate attributeName="opacity" values="0.6;1;0.8;1" dur="4s" begin={`-${sign.x % 4}s`} repeatCount="indefinite" />
                    )}
                  </rect>
                ))}
                <rect
                  x={district.x0 + 1}
                  y={GROUND - 2}
                  width={DISTRICT_W - 2}
                  height={1}
                  fill={district.chapter.accent}
                  opacity={0.7}
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Traffic: a faint road, with a moving light for each finished district. */}
      <line
        x1={0}
        y1={GROUND + 7}
        x2={VIEW_W}
        y2={GROUND + 7}
        stroke="hsl(var(--primary) / 0.25)"
        strokeWidth={1}
        strokeDasharray="2 8"
      />
      {CITY.map(district => {
        const { from, to } = district.chapter;
        let complete = true;
        for (let level = from; level <= to; level++) {
          if (!done.has(level)) {
            complete = false;
            break;
          }
        }
        if (!complete || reducedMotion) return null;
        return (
          <line
            key={`traffic-${district.chapter.id}`}
            x1={district.x0}
            y1={GROUND + 7}
            x2={district.x0 + DISTRICT_W}
            y2={GROUND + 7}
            stroke={district.chapter.accent}
            strokeWidth={1.4}
            strokeDasharray="10 90"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-100" dur={`${4 + district.chapter.id % 3}s`} repeatCount="indefinite" />
          </line>
        );
      })}
    </svg>
  );
}

export const CitySkyline = memo(CitySkylineImpl);
