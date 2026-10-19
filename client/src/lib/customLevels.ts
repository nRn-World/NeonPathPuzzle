import type { LevelResponse, Point } from "@shared/schema";

export interface CustomLevelData {
  name: string;
  gridSize: number;
  start: Point;
  nodes: Point[];
}

export interface CustomLevel {
  code: string;
  data: CustomLevelData;
}

export type CustomLevelResult =
  | { ok: true; level: CustomLevel }
  | { ok: false; error: string };

const MAX_GRID = 10;
const MIN_GRID = 3;
const MAX_NODES = 120;
const SAVED_KEY = "neon_path_custom_levels_v1";

export interface SavedCustomLevel {
  code: string;
  name: string;
  gridSize: number;
  nodeCount: number;
  createdAt: number;
}

const fallbackSaved: SavedCustomLevel[] = [];

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(code: string): string {
  const normalized = code.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function sanitizeName(name: unknown): string {
  const cleaned = String(name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 40);
  return cleaned || "Custom circuit";
}

function validatePath(points: Point[], gridSize: number): string | null {
  if (!Number.isInteger(gridSize) || gridSize < MIN_GRID || gridSize > MAX_GRID) {
    return `Grid size must be ${MIN_GRID}-${MAX_GRID}.`;
  }
  if (!Array.isArray(points) || points.length < 3) return "Draw at least three nodes.";
  if (points.length > Math.min(MAX_NODES, gridSize * gridSize)) {
    return "This custom level has too many nodes.";
  }

  const seen = new Set<string>();
  for (const point of points) {
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) return "Invalid node coordinates.";
    if (point.x < 0 || point.y < 0 || point.x >= gridSize || point.y >= gridSize) {
      return "A node is outside the grid.";
    }
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return "The path crosses itself.";
    seen.add(key);
  }

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const distance = Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y);
    if (distance !== 1) return "Every node must touch the previous one.";
  }

  return null;
}

export function encodeCustomLevel(input: {
  name: string;
  gridSize: number;
  path: Point[];
}): CustomLevelResult {
  const error = validatePath(input.path, input.gridSize);
  if (error) return { ok: false, error };

  const payload = {
    v: 1,
    n: sanitizeName(input.name),
    g: input.gridSize,
    p: input.path.map(point => [point.x, point.y]),
  };
  const code = toBase64Url(JSON.stringify(payload));
  return {
    ok: true,
    level: {
      code,
      data: {
        name: payload.n,
        gridSize: input.gridSize,
        start: input.path[0],
        nodes: input.path.map(point => ({ x: point.x, y: point.y })),
      },
    },
  };
}

export function decodeCustomLevel(code: string): CustomLevelResult {
  if (!code || code.length > 2_000) return { ok: false, error: "This level code is invalid." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return { ok: false, error: "This level code is not readable." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "This level code is not readable." };
  }

  const payload = parsed as { v?: number; n?: unknown; g?: unknown; p?: unknown };
  if (payload.v !== 1 || !Array.isArray(payload.p)) {
    return { ok: false, error: "This level code uses an unsupported format." };
  }

  const path: Point[] = [];
  for (const item of payload.p) {
    if (!Array.isArray(item) || item.length !== 2) return { ok: false, error: "This level code is damaged." };
    path.push({ x: Number(item[0]), y: Number(item[1]) });
  }

  const gridSize = Number(payload.g);
  const error = validatePath(path, gridSize);
  if (error) return { ok: false, error };

  return {
    ok: true,
    level: {
      code,
      data: {
        name: sanitizeName(payload.n),
        gridSize,
        start: path[0],
        nodes: path,
      },
    },
  };
}

export function customLevelToResponse(level: CustomLevelData): LevelResponse {
  return {
    id: 0,
    gridSize: level.gridSize,
    start: level.start,
    nodes: level.nodes,
    isLocked: false,
    isCompleted: false,
  };
}

export function getSavedCustomLevels(): SavedCustomLevel[] {
  const storage = getStorage();
  if (!storage) return [...fallbackSaved];
  try {
    const raw = storage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedCustomLevel =>
      Boolean(entry)
      && typeof (entry as SavedCustomLevel).code === "string"
      && typeof (entry as SavedCustomLevel).name === "string"
      && typeof (entry as SavedCustomLevel).createdAt === "number",
    );
  } catch {
    return [];
  }
}

function writeSaved(levels: SavedCustomLevel[]): void {
  const trimmed = levels
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  const storage = getStorage();
  if (!storage) {
    fallbackSaved.splice(0, fallbackSaved.length, ...trimmed);
    return;
  }
  try {
    storage.setItem(SAVED_KEY, JSON.stringify(trimmed));
  } catch {
    fallbackSaved.splice(0, fallbackSaved.length, ...trimmed);
  }
}

export function saveCustomLevel(level: CustomLevel): SavedCustomLevel {
  const entry: SavedCustomLevel = {
    code: level.code,
    name: level.data.name,
    gridSize: level.data.gridSize,
    nodeCount: level.data.nodes.length,
    createdAt: Date.now(),
  };
  const levels = getSavedCustomLevels().filter(saved => saved.code !== level.code);
  writeSaved([entry, ...levels]);
  return entry;
}

export function deleteCustomLevel(code: string): SavedCustomLevel[] {
  const levels = getSavedCustomLevels().filter(saved => saved.code !== code);
  writeSaved(levels);
  return levels;
}
