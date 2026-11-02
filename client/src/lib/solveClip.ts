import type { Point } from "@shared/schema";
import { formatDuration, formatResultTime } from "./scoring";

/**
 * Renders a solved board as a vertical 9:16 clip (1080x1920) and records it with
 * MediaRecorder, so a clear can be posted straight to Shorts / Reels / TikTok.
 * Everything happens on the device: no frame ever leaves the browser.
 */

const WIDTH = 1080;
const HEIGHT = 1920;
const BOARD_SIZE = 880;
const BOARD_LEFT = (WIDTH - BOARD_SIZE) / 2;
const BOARD_TOP = 560;
/** How long the path takes to draw itself. */
const DRAW_MS = 4200;
/** The finished board holds this long before the clip ends. */
const OUTRO_MS = 1500;

export interface SolveClipInput {
  levelId: number;
  gridSize: number;
  nodes: Point[];
  path: Point[];
  timeMs: number;
  stars: number;
  /** Daily and weekly boards have no level number worth printing. */
  label?: string;
}

export type ClipOutcome = "shared" | "downloaded" | "unsupported" | "failed";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type)) ?? null;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawBackdrop(context: CanvasRenderingContext2D, time: number) {
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, "#050914");
  gradient.addColorStop(0.55, "#0a0f1e");
  gradient.addColorStop(1, "#140a2e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // Dot grid, matching the menu background.
  context.fillStyle = "rgba(0, 243, 255, 0.12)";
  for (let y = 40; y < HEIGHT; y += 60) {
    for (let x = 40; x < WIDTH; x += 60) {
      context.beginPath();
      context.arc(x, y, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  const glow = context.createRadialGradient(540, 1000, 60, 540, 1000, 720);
  glow.addColorStop(0, "rgba(0, 243, 255, 0.16)");
  glow.addColorStop(1, "rgba(0, 243, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // A slow scanline sweep keeps the still frames alive.
  const sweep = (time / 14) % (HEIGHT + 400) - 200;
  const sweepGradient = context.createLinearGradient(0, sweep - 120, 0, sweep + 120);
  sweepGradient.addColorStop(0, "rgba(0, 243, 255, 0)");
  sweepGradient.addColorStop(0.5, "rgba(0, 243, 255, 0.05)");
  sweepGradient.addColorStop(1, "rgba(0, 243, 255, 0)");
  context.fillStyle = sweepGradient;
  context.fillRect(0, sweep - 120, WIDTH, 240);
}

function drawBoard(
  context: CanvasRenderingContext2D,
  input: SolveClipInput,
  reveal: number,
  time: number,
) {
  const cell = BOARD_SIZE / input.gridSize;
  const centerOf = (point: Point) => ({
    x: BOARD_LEFT + point.x * cell + cell / 2,
    y: BOARD_TOP + point.y * cell + cell / 2,
  });
  const path = input.path.length > 1 ? input.path : [input.path[0], input.path[0]];

  // Plate.
  roundRect(context, BOARD_LEFT, BOARD_TOP, BOARD_SIZE, BOARD_SIZE, 28);
  context.fillStyle = "rgba(255,255,255,0.025)";
  context.fill();
  context.strokeStyle = "rgba(0, 243, 255, 0.28)";
  context.lineWidth = 3;
  context.stroke();

  // How far along the route the line has travelled, in path steps.
  const reached = reveal * (path.length - 1);
  const whole = Math.floor(reached);
  const partial = reached - whole;
  const visited = new Set(
    path.slice(0, whole + 1).map(point => `${point.x},${point.y}`),
  );

  // Board nodes.
  input.nodes.forEach(node => {
    const { x, y } = centerOf(node);
    const isVisited = visited.has(`${node.x},${node.y}`);
    const breathe = (Math.sin(time / 520 + node.x * 0.9 + node.y * 1.3) + 1) / 2;
    context.save();
    if (isVisited) {
      context.shadowColor = "#00f3ff";
      context.shadowBlur = 22;
      context.beginPath();
      context.arc(x, y, cell * 0.13, 0, Math.PI * 2);
      context.fillStyle = "#00f3ff";
      context.fill();
      context.shadowBlur = 0;
      context.beginPath();
      context.arc(x, y, cell * 0.21, 0, Math.PI * 2);
      context.strokeStyle = "rgba(0, 243, 255, 0.8)";
      context.lineWidth = 3;
      context.stroke();
    } else {
      context.beginPath();
      context.arc(x, y, cell * 0.18, 0, Math.PI * 2);
      context.strokeStyle = `rgba(0, 243, 255, ${0.25 + breathe * 0.35})`;
      context.lineWidth = 3;
      context.stroke();
      context.beginPath();
      context.arc(x, y, cell * 0.06, 0, Math.PI * 2);
      context.fillStyle = "rgba(0, 243, 255, 0.6)";
      context.fill();
    }
    context.restore();
  });

  // The traced line: soft underlay, bright core, travelling highlight.
  const trace = (limit: number, part: number) => {
    context.beginPath();
    const first = centerOf(path[0]);
    context.moveTo(first.x, first.y);
    for (let index = 1; index <= limit; index++) {
      const point = centerOf(path[index]);
      context.lineTo(point.x, point.y);
    }
    if (limit < path.length - 1) {
      const from = centerOf(path[limit]);
      const to = centerOf(path[limit + 1]);
      context.lineTo(from.x + (to.x - from.x) * part, from.y + (to.y - from.y) * part);
    }
  };

  if (reached > 0) {
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0, 243, 255, 0.25)";
    context.lineWidth = cell * 0.36;
    trace(whole, partial);
    context.stroke();
    context.strokeStyle = "#00f3ff";
    context.shadowColor = "#00f3ff";
    context.shadowBlur = 34;
    context.lineWidth = cell * 0.17;
    trace(whole, partial);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(255,255,255,0.75)";
    context.lineWidth = Math.max(2, cell * 0.045);
    context.setLineDash([cell * 0.35, cell * 0.28]);
    context.lineDashOffset = -time / 26;
    trace(whole, partial);
    context.stroke();
    context.restore();
  }

  // Head.
  if (reveal < 1) {
    const head = centerOf(path[whole]);
    const next = centerOf(path[Math.min(path.length - 1, whole + 1)]);
    const x = head.x + (next.x - head.x) * partial;
    const y = head.y + (next.y - head.y) * partial;
    const halo = context.createRadialGradient(x, y, 0, x, y, cell * 0.5);
    halo.addColorStop(0, "rgba(255,255,255,0.95)");
    halo.addColorStop(0.4, "rgba(0, 243, 255, 0.85)");
    halo.addColorStop(1, "rgba(0, 243, 255, 0)");
    context.fillStyle = halo;
    context.beginPath();
    context.arc(x, y, cell * 0.5, 0, Math.PI * 2);
    context.fill();
  }
}

function drawHud(context: CanvasRenderingContext2D, input: SolveClipInput, reveal: number) {
  context.textAlign = "center";

  context.fillStyle = "#00f3ff";
  context.font = "700 34px 'Exo 2', Arial, sans-serif";
  context.fillText("NEON PATH PUZZLE", 540, 170);

  context.fillStyle = "#ffffff";
  context.font = "700 120px Orbitron, Arial, sans-serif";
  context.fillText(input.label ?? `LEVEL ${input.levelId}`, 540, 320);

  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = "500 34px 'Exo 2', Arial, sans-serif";
  context.fillText("ONE LINE · EVERY NODE", 540, 390);

  // Result row appears as the line finishes.
  const appear = Math.max(0, Math.min(1, (reveal - 0.85) / 0.15));
  context.globalAlpha = appear;

  roundRect(context, 150, 1500, 780, 190, 28);
  context.fillStyle = "rgba(10, 15, 30, 0.75)";
  context.fill();
  context.strokeStyle = "rgba(0, 243, 255, 0.35)";
  context.lineWidth = 3;
  context.stroke();

  // Tenths, like the win screen: a fast board would otherwise print 0:00.
  const timeText = formatResultTime(input.timeMs);
  const timeSize = timeText.length >= 7 ? 56 : timeText.length >= 6 ? 66 : 90;
  context.fillStyle = "#ffffff";
  context.font = `700 ${timeSize}px Orbitron, Arial, sans-serif`;
  context.fillText(timeText, 420, timeSize >= 90 ? 1600 : 1592);
  context.fillStyle = "rgba(255,255,255,0.45)";
  context.font = "500 26px 'Exo 2', Arial, sans-serif";
  context.fillText("TIME", 420, 1650);

  const stars = Math.max(1, Math.min(3, input.stars));
  for (let index = 0; index < 3; index++) {
    context.font = "700 72px Arial, sans-serif";
    context.fillStyle = index < stars ? "#ffd700" : "rgba(255,255,255,0.16)";
    context.fillText("★", 700 + index * 78, 1618);
  }

  context.fillStyle = "rgba(0, 243, 255, 0.85)";
  context.font = "600 32px 'Exo 2', Arial, sans-serif";
  context.fillText("Play it free · nrnworld.one", 540, 1790);
  context.globalAlpha = 1;
}

/** Draws one frame of the clip at relative time `elapsed` (ms). */
function drawFrame(
  context: CanvasRenderingContext2D,
  input: SolveClipInput,
  elapsed: number,
) {
  const reveal = Math.min(1, elapsed / DRAW_MS);
  drawBackdrop(context, elapsed);
  drawBoard(context, input, reveal, elapsed);
  drawHud(context, input, reveal);

  // Flash on the winning step.
  if (reveal >= 1) {
    const after = elapsed - DRAW_MS;
    if (after < 420) {
      context.fillStyle = `rgba(0, 243, 255, ${0.22 * (1 - after / 420)})`;
      context.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }
}

const EBML_INFO = [0x15, 0x49, 0xa9, 0x66];
const EBML_DURATION = [0x44, 0x89];

function readVint(bytes: Uint8Array, offset: number): { length: number; value: number; unknown: boolean } | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first === 0) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
  if (length > 8 || offset + length > bytes.length) return null;

  let value = first & (0xff >> length);
  let unknown = value === (0xff >> length);
  for (let i = 1; i < length; i += 1) {
    value = value * 256 + bytes[offset + i];
    if (bytes[offset + i] !== 0xff) unknown = false;
  }
  return { length, value, unknown };
}

function encodeVint(value: number, length: number): number[] | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const max = 2 ** (7 * length) - 1;
  if (value > max - 1) return null;
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i -= 1) {
    out.push(Math.floor(value / 2 ** (8 * i)) & 0xff);
  }
  out[0] |= 0x80 >> (length - 1);
  return out;
}

function findBytes(bytes: Uint8Array, pattern: number[], from: number, to: number): number {
  const limit = Math.min(to, bytes.length) - pattern.length;
  for (let i = Math.max(0, from); i <= limit; i += 1) {
    let hit = true;
    for (let k = 0; k < pattern.length; k += 1) {
      if (bytes[i + k] !== pattern[k]) {
        hit = false;
        break;
      }
    }
    if (hit) return i;
  }
  return -1;
}

/**
 * MediaRecorder writes a live WebM: the Info element carries no Duration, so
 * players open the file with an unknown length and TikTok / CapCut / most
 * editors import it as a broken or truncated clip. This grafts a Duration
 * into the Info element (widening it in place) so the file declares its length.
 */
export function patchWebmDuration(bytes: Uint8Array, durationMs: number): Uint8Array {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return bytes;

  const info = findBytes(bytes, EBML_INFO, 0, 512);
  if (info < 0) return bytes;

  const size = readVint(bytes, info + 4);
  if (!size || size.unknown) return bytes;

  const contentStart = info + 4 + size.length;
  const contentEnd = contentStart + size.value;
  if (contentEnd > bytes.length) return bytes;

  const existing = findBytes(bytes, EBML_DURATION, contentStart, contentEnd);
  if (existing >= 0) {
    const field = readVint(bytes, existing + 2);
    if (!field || field.unknown) return bytes;
    const valueStart = existing + 2 + field.length;
    const out = bytes.slice();
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    if (field.value === 8) view.setFloat64(valueStart, durationMs, false);
    else if (field.value === 4) view.setFloat32(valueStart, durationMs, false);
    else return bytes;
    return out;
  }

  // No Duration at all: write a float64 Duration and grow Info to fit it.
  const next = encodeVint(size.value + 11, size.length);
  if (!next) return bytes;

  const out = new Uint8Array(bytes.length + 11);
  out.set(bytes.subarray(0, contentEnd), 0);
  out.set([0x44, 0x89, 0x88], contentEnd);
  new DataView(out.buffer, out.byteOffset, out.byteLength).setFloat64(contentEnd + 3, durationMs, false);
  out.set(bytes.subarray(contentEnd), contentEnd + 11);
  out.set(next, info + 4);
  return out;
}

async function stampDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const patched = patchWebmDuration(new Uint8Array(await blob.arrayBuffer()), durationMs);
    return new Blob([patched], { type: blob.type || "video/webm" });
  } catch {
    return blob;
  }
}

function canvasToVideo(canvas: HTMLCanvasElement, mime: string, durationMs: number): Promise<Blob> {
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Recorder failed"));
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      resolve(new Blob(chunks, { type: mime.split(";")[0] }));
    };

    recorder.start(100);
    window.setTimeout(() => recorder.stop(), durationMs);
  });
}

const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/** Renders and records the clip. Returns the file, or null if the browser can't record. */
export async function recordSolveClip(input: SolveClipInput): Promise<{ blob: Blob; extension: string } | null> {
  const mime = pickMime();
  if (!mime) return null;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") return null;

  const total = DRAW_MS + OUTRO_MS;
  drawFrame(context, input, 0);

  const recording = canvasToVideo(canvas, mime, total);

  const startedAt = performance.now();
  await new Promise<void>(resolve => {
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      drawFrame(context, input, Math.min(total, elapsed));
      if (elapsed >= total) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Let the recorder flush the last frame before it stops.
  await delay(120);
  const recorded = await recording;
  // WebM from MediaRecorder declares no length; stamp it so editors accept the file.
  const blob = mime.startsWith("video/webm")
    ? await stampDuration(recorded, total)
    : recorded;
  return { blob, extension: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

/** Records the clip and hands it to the share sheet, or downloads it. */
export async function shareSolveClip(input: SolveClipInput): Promise<ClipOutcome> {
  const fileName = `neon-path-${input.levelId}-solve`;
  try {
    const recorded = await recordSolveClip(input);
    if (!recorded) return "unsupported";

    const file = new File([recorded.blob], `${fileName}.${recorded.extension}`, {
      type: recorded.blob.type || "video/webm",
    });
    const shareData: ShareData = {
      files: [file],
      title: "Neon Path Puzzle",
      text: `Neon Path ${input.label ?? `level ${input.levelId}`} solved in ${formatDuration(input.timeMs)}.`,
    };

    if (typeof navigator !== "undefined" && navigator.canShare?.(shareData) && navigator.share) {
      await navigator.share(shareData);
      return "shared";
    }

    const url = URL.createObjectURL(recorded.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.${recorded.extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
