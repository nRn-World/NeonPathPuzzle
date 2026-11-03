import { memo, useId } from "react";
import { chapters, type Chapter } from "@/lib/chapters";
import { useSettingsStore } from "@/lib/settings";

/*
 * The city grows with the player: one district per chapter, one window group per
 * cleared level, and a whole district lights up (signs, haze, beacons, traffic) once
 * its chapter is done. The geometry is seeded, so the skyline never changes between visits.
 */

const VIEW_W = 1200;
const VIEW_H = 220;
const GROUND = 204;
const DISTRICT_W = VIEW_W / chapters.length;
// Window grid: every window sits on this pitch, so the dark-window pattern and the lit windows line up.
const PITCH_X = 3;
const PITCH_Y = 5;
const WINDOW_W = 1.6;
const WINDOW_H = 2.6;
/** Lit windows per cleared level; caps a finished city at a few thousand rects. */
const WINDOWS_PER_LEVEL = 7;
const WARM = "#ffe9b0";
const BEACON = "#ff3b6b";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Window {
  x: number;
  y: number;
  /** Index into the chapter's levels: the window lights when that level is cleared. */
  slot: number;
  warm: boolean;
}

interface Building extends Block {
  /** A narrower upper block (setback), or null. */
  top: Block | null;
  /** Height of a rooftop antenna, 0 for none. */
  antenna: number;
}

interface District {
  chapter: Chapter;
  x0: number;
  back: Block[];
  buildings: Building[];
  windows: Window[];
  signs: Block[];
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

const snap = (value: number, step: number) => Math.round(value / step) * step;

function buildDistrict(chapter: Chapter, index: number): District {
  const rnd = mulberry32(chapter.id * 9301 + 49297);
  const x0 = index * DISTRICT_W;
  const levelCount = chapter.to - chapter.from + 1;

  // Far layer: wide, tall, dim towers that give the skyline depth.
  const back: Block[] = [];
  for (let x = x0 - 4; x < x0 + DISTRICT_W; ) {
    const w = 14 + Math.floor(rnd() * 18);
    const h = 70 + Math.floor(rnd() * 90);
    back.push({ x, y: GROUND - h, w, h });
    x += w - 3 + Math.floor(rnd() * 6);
  }

  const buildings: Building[] = [];
  const signs: Block[] = [];
  const candidates: Omit<Window, "slot">[] = [];
  let x = snap(x0 + 2, PITCH_X);

  while (x < x0 + DISTRICT_W - 6) {
    const w = Math.min(snap(6 + rnd() * 16, PITCH_X), snap(x0 + DISTRICT_W - x - 1, PITCH_X));
    if (w < PITCH_X * 2) break;
    // Taller buildings towards the middle of each district, with the odd tower breaking the line.
    const centre = 1 - Math.abs((x - x0) / DISTRICT_W - 0.5) * 1.6;
    const tower = rnd() < 0.18 ? 40 : 0;
    const h = snap(Math.min(GROUND - 30, 28 + rnd() * 50 + centre * 45 + tower), PITCH_Y);
    const y = GROUND - h;
    let top: Block | null = null;
    if (w >= 12 && rnd() < 0.45) {
      const tw = snap(w * (0.45 + rnd() * 0.25), PITCH_X);
      const th = snap(10 + rnd() * 20, PITCH_Y);
      top = { x: x + snap((w - tw) / 2, PITCH_X), y: y - th, w: tw, h: th };
    }
    const antenna = rnd() < 0.3 ? 6 + Math.floor(rnd() * 12) : 0;
    buildings.push({ x, y, w, h, top, antenna });
    if (rnd() < 0.35 && w >= 9) signs.push({ x: x + 1.5, y: y + 4 + Math.floor(rnd() * 3) * PITCH_Y, w: w - 3, h: 2.4 });

    for (const block of top ? [{ x, y, w, h }, top] : [{ x, y, w, h }]) {
      for (let wy = block.y + PITCH_Y; wy < block.y + block.h - 3; wy += PITCH_Y) {
        for (let wx = block.x; wx < block.x + block.w; wx += PITCH_X) {
          candidates.push({ x: wx + 0.7, y: wy + 1.2, warm: rnd() < 0.28 });
        }
      }
    }
    x += w + PITCH_X * Math.floor(rnd() * 2);
  }

  // A shuffled subset of windows, dealt round-robin to the chapter's levels.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const windows = candidates
    .slice(0, levelCount * WINDOWS_PER_LEVEL)
    .map((window, i) => ({ ...window, slot: i % levelCount }));

  return { chapter, x0, back, buildings, windows, signs };
}

/** Pure geometry, built once at module load. */
const CITY: District[] = chapters.map((chapter, index) => buildDistrict(chapter, index));

const roofY = (building: Building) => building.top?.y ?? building.y;

export interface LevelWindow {
  x: number;
  y: number;
  warm: boolean;
}

/** The windows a level lights up in the SVG coordinate space (empty outside the campaign). */
export function getLevelWindows(levelId: number): LevelWindow[] {
  const district = CITY.find(item => levelId >= item.chapter.from && levelId <= item.chapter.to);
  if (!district) return [];
  const slot = levelId - district.chapter.from;
  return district.windows.filter(window => window.slot === slot);
}

interface CitySkylineProps {
  /** Level ids that have been cleared. */
  completedLevels: number[];
  className?: string;
  /** Zooms the view onto this chapter's district. */
  focusChapterId?: number;
  /** Level whose windows light up. With motion on, a beam drops onto them first. */
  highlightLevel?: number;
}

function CitySkylineImpl({ completedLevels, className = "", focusChapterId, highlightLevel }: CitySkylineProps) {
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const uid = useId().replace(/:/g, "");
  const done = new Set(completedLevels);
  const focus = focusChapterId === undefined ? undefined : CITY.find(district => district.chapter.id === focusChapterId);
  const highlight = highlightLevel === undefined ? [] : getLevelWindows(highlightLevel);
  const beamOn = highlight.length > 0 && !reducedMotion;
  // Centre of the level's window cluster; the beam lands on the window nearest to it.
  const centreX = highlight.reduce((sum, item) => sum + item.x, 0) / (highlight.length || 1);
  const centreY = highlight.reduce((sum, item) => sum + item.y, 0) / (highlight.length || 1);
  const beamTarget = highlight.length === 0 ? null : highlight.reduce((best, window) =>
    Math.hypot(window.x - centreX, window.y - centreY) < Math.hypot(best.x - centreX, best.y - centreY) ? window : best);
  // Zoomed view: two districts wide, cropped vertically around the lit windows (or the middle of the city).
  const zoomW = DISTRICT_W * 2;
  const viewBox = focus
    ? `${Math.min(Math.max(focus.x0 + DISTRICT_W / 2 - zoomW / 2, 0), VIEW_W - zoomW)} ${(highlight.length ? centreY : 150) - VIEW_H / 2} ${zoomW} ${VIEW_H}`
    : `0 0 ${VIEW_W} ${VIEW_H}`;
  const svgFit = focus ? "xMidYMid slice" : "xMidYMax meet";
  const svgSize = focus ? "h-full w-full" : "h-auto w-full";
  const glowId = `${uid}-glow`;
  const darkId = `${uid}-dark`;
  const hazeId = `${uid}-haze`;
  const skyId = `${uid}-sky`;
  const isComplete = (chapter: Chapter) => {
    for (let level = chapter.from; level <= chapter.to; level++) if (!done.has(level)) return false;
    return true;
  };

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={svgFit}
      aria-hidden
      className={`pointer-events-none block select-none ${svgSize} ${className}`}
    >
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Unlit windows: one cheap pattern instead of thousands of rects. */}
        <pattern id={darkId} width={PITCH_X} height={PITCH_Y} patternUnits="userSpaceOnUse">
          <rect x={0.7} y={1.2} width={WINDOW_W} height={WINDOW_H} fill="hsl(var(--primary) / 0.07)" />
        </pattern>
        <linearGradient id={hazeId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={skyId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          <stop offset="0.6" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizon glow, then a coloured haze over every finished district. */}
      <rect x={0} y={0} width={VIEW_W} height={GROUND} fill={`url(#${skyId})`} />
      {CITY.map(district => isComplete(district.chapter) && (
        <rect
          key={`haze-${district.chapter.id}`}
          x={district.x0 - 10}
          y={GROUND - 150}
          width={DISTRICT_W + 20}
          height={150}
          fill={`url(#${hazeId})`}
          style={{ color: district.chapter.accent }}
        />
      ))}

      {/* Far layer. */}
      <g fill="#0d1430" opacity={0.75}>
        {CITY.flatMap(district => district.back.map(tower => (
          <rect key={`b-${district.chapter.id}-${tower.x}`} x={tower.x} y={tower.y} width={tower.w} height={tower.h} />
        )))}
      </g>

      {/* Near layer: silhouettes, setbacks, antennas and the dark window grid. */}
      {CITY.map(district => {
        const complete = isComplete(district.chapter);
        return (
          <g key={district.chapter.id}>
            {district.buildings.map(building => (
              <g key={building.x}>
                {building.antenna > 0 && (
                  <line
                    x1={building.x + building.w / 2}
                    y1={roofY(building)}
                    x2={building.x + building.w / 2}
                    y2={roofY(building) - building.antenna}
                    stroke="hsl(var(--primary) / 0.35)"
                    strokeWidth={0.6}
                  />
                )}
                {[building, building.top].map(block => block && (
                  <g key={`${block.x}-${block.y}`}>
                    <rect x={block.x} y={block.y} width={block.w} height={block.h} fill="#080d1f" />
                    <rect x={block.x} y={block.y} width={block.w} height={block.h} fill={`url(#${darkId})`} />
                    <rect
                      x={block.x}
                      y={block.y}
                      width={block.w}
                      height={block.h}
                      fill="none"
                      stroke={complete ? district.chapter.accent : "hsl(var(--primary) / 0.18)"}
                      strokeOpacity={complete ? 0.55 : 1}
                      strokeWidth={0.5}
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>
        );
      })}

      {/* Lit windows and, for finished districts, signs and blinking rooftop beacons. */}
      {CITY.map(district => {
        const complete = isComplete(district.chapter);
        const lit = district.windows.filter(window => {
          const level = district.chapter.from + window.slot;
          return done.has(level) || level === highlightLevel;
        });
        return (
          <g key={`lit-${district.chapter.id}`} filter={`url(#${glowId})`}>
            {lit.map((window, index) => {
              const landing = beamOn && district.chapter.from + window.slot === highlightLevel;
              const base = window.warm ? 0.85 : 1;
              return (
                <rect
                  key={`${window.x}-${window.y}`}
                  x={window.x}
                  y={window.y}
                  width={WINDOW_W}
                  height={WINDOW_H}
                  fill={window.warm ? WARM : district.chapter.accent}
                  opacity={landing ? 0 : base}
                >
                  {landing && (
                    // Dark until the beam hits (0.75 s), then flashes and settles into the lit state.
                    <animate
                      attributeName="opacity"
                      values={`0;1;0.35;1;${base}`}
                      keyTimes="0;0.25;0.5;0.75;1"
                      dur="1.3s"
                      begin="0.75s"
                      fill="freeze"
                    />
                  )}
                  {!landing && !reducedMotion && index % 11 === 0 && (
                    <animate
                      attributeName="opacity"
                      values="0.35;1;0.75;1"
                      dur={`${3 + (index % 5)}s`}
                      begin={`-${index % 7}s`}
                      repeatCount="indefinite"
                    />
                  )}
                </rect>
              );
            })}

            {complete && district.signs.map(sign => (
              <rect key={sign.x} x={sign.x} y={sign.y} width={sign.w} height={sign.h} rx={0.6} fill={district.chapter.accent}>
                {!reducedMotion && (
                  <animate attributeName="opacity" values="0.55;1;0.85;1;0.4;1" dur="5s" begin={`-${sign.x % 5}s`} repeatCount="indefinite" />
                )}
              </rect>
            ))}
            {complete && district.buildings.filter(building => building.antenna > 0).map(building => (
              <circle
                key={`beacon-${building.x}`}
                cx={building.x + building.w / 2}
                cy={roofY(building) - building.antenna}
                r={1.1}
                fill={BEACON}
              >
                {!reducedMotion && (
                  <animate attributeName="opacity" values="1;0.1;1" dur="1.6s" begin={`-${building.x % 3}s`} repeatCount="indefinite" />
                )}
              </circle>
            ))}
          </g>
        );
      })}

      {/* Street: a dark band with lane marks; finished districts get moving head- and taillights. */}
      <rect x={0} y={GROUND} width={VIEW_W} height={VIEW_H - GROUND} fill="#050814" />
      <line x1={0} y1={GROUND} x2={VIEW_W} y2={GROUND} stroke="hsl(var(--primary) / 0.35)" strokeWidth={0.6} />
      <line x1={0} y1={GROUND + 8} x2={VIEW_W} y2={GROUND + 8} stroke="hsl(var(--primary) / 0.2)" strokeWidth={0.8} strokeDasharray="4 8" />
      {!reducedMotion && CITY.map(district => isComplete(district.chapter) && (
        <g key={`traffic-${district.chapter.id}`} filter={`url(#${glowId})`}>
          <line x1={district.x0} y1={GROUND + 5} x2={district.x0 + DISTRICT_W} y2={GROUND + 5} stroke={WARM} strokeWidth={1.2} strokeDasharray="3 47">
            <animate attributeName="stroke-dashoffset" from="0" to="-50" dur={`${3 + district.chapter.id % 3}s`} repeatCount="indefinite" />
          </line>
          <line x1={district.x0} y1={GROUND + 11} x2={district.x0 + DISTRICT_W} y2={GROUND + 11} stroke={BEACON} strokeWidth={1.2} strokeDasharray="3 37">
            <animate attributeName="stroke-dashoffset" from="0" to="40" dur={`${4 + district.chapter.id % 2}s`} repeatCount="indefinite" />
          </line>
        </g>
      ))}

      {/* Power-up: a beam drops onto the level's windows, then a shockwave rings out on impact. */}
      {beamOn && beamTarget && (
        <g filter={`url(#${glowId})`}>
          <line x1={beamTarget.x} y1={beamTarget.y - 90} x2={beamTarget.x} y2={beamTarget.y} stroke="hsl(var(--primary))" strokeWidth={0.8} opacity={0}>
            <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.95;1" dur="0.75s" begin="0.1s" fill="freeze" />
          </line>
          <circle cx={beamTarget.x} cy={beamTarget.y - 90} r={1.8} fill="hsl(var(--primary))" opacity={0}>
            <animate attributeName="cy" values={`${beamTarget.y - 90};${beamTarget.y}`} dur="0.65s" begin="0.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.55 0 1 0.45" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.95;1" dur="0.75s" begin="0.1s" fill="freeze" />
          </circle>
          <circle cx={beamTarget.x} cy={beamTarget.y} r={1} fill="none" stroke="hsl(var(--primary))" strokeWidth={0.6} opacity={0}>
            <animate attributeName="r" values="1;9" dur="0.7s" begin="0.75s" fill="freeze" />
            <animate attributeName="opacity" values="0.9;0" dur="0.7s" begin="0.75s" fill="freeze" />
          </circle>
        </g>
      )}
    </svg>
  );
}

export const CitySkyline = memo(CitySkylineImpl);
