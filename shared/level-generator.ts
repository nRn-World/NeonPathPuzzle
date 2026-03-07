import { type Point } from "@shared/schema";

export interface GeneratedLevel {
  id: number;
  gridSize: number;
  start: Point;
  nodes: Point[];
  solution: Point[];
}

function clampLevel(levelId: number): number {
  if (!Number.isFinite(levelId)) return 1;
  if (levelId < 1) return 1;
  if (levelId > 200) return 200;
  return Math.floor(levelId);
}

function targetNodeCountForLevel(levelId: number): number {
  const normalized = (levelId - 1) / 199;
  const curved = Math.pow(normalized, 1.05);
  return 3 + Math.floor(curved * 59);
}

function gridSizeForNodeCount(nodeCount: number): number {
  for (let size = 3; size <= 8; size++) {
    if (size * size >= nodeCount) {
      return size;
    }
  }
  return 8;
}

function makeSnakePath(size: number): Point[] {
  const path: Point[] = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x++) {
        path.push({ x, y });
      }
    } else {
      for (let x = size - 1; x >= 0; x--) {
        path.push({ x, y });
      }
    }
  }
  return path;
}

function makeSpiralPath(size: number): Point[] {
  const path: Point[] = [];
  let left = 0;
  let right = size - 1;
  let top = 0;
  let bottom = size - 1;

  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) {
      path.push({ x, y: top });
    }
    top++;

    for (let y = top; y <= bottom; y++) {
      path.push({ x: right, y });
    }
    right--;

    if (top <= bottom) {
      for (let x = right; x >= left; x--) {
        path.push({ x, y: bottom });
      }
      bottom--;
    }

    if (left <= right) {
      for (let y = bottom; y >= top; y--) {
        path.push({ x: left, y });
      }
      left++;
    }
  }

  return path;
}

function transformPoint(p: Point, size: number, transform: number): Point {
  switch (transform % 8) {
    case 0:
      return { x: p.x, y: p.y };
    case 1:
      return { x: size - 1 - p.x, y: p.y };
    case 2:
      return { x: p.x, y: size - 1 - p.y };
    case 3:
      return { x: size - 1 - p.y, y: p.x };
    case 4:
      return { x: size - 1 - p.x, y: size - 1 - p.y };
    case 5:
      return { x: p.y, y: size - 1 - p.x };
    case 6:
      return { x: p.y, y: p.x };
    default:
      return { x: size - 1 - p.y, y: size - 1 - p.x };
  }
}

function makeFullPath(size: number, style: number): Point[] {
  const base = style % 2 === 0 ? makeSnakePath(size) : makeSpiralPath(size);
  const transformed = base.map((p) => transformPoint(p, size, Math.floor(style / 2)));
  return style % 3 === 0 ? [...transformed].reverse() : transformed;
}

function nodeSignature(points: Point[]): string {
  return [...points]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((p) => `${p.x},${p.y}`)
    .join("|");
}

function sortedUnique(points: Point[]): Point[] {
  const seen = new Set<string>();
  const unique: Point[] = [];

  for (const p of points) {
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }

  return unique.sort((a, b) => a.y - b.y || a.x - b.x);
}

function buildAllLevels(): GeneratedLevel[] {
  const levels: GeneratedLevel[] = [];
  const seenSignatures = new Set<string>();
  const groupOccurrences = new Map<string, number>();

  for (let levelId = 1; levelId <= 200; levelId++) {
    const target = targetNodeCountForLevel(levelId);
    let acceptedSolution: Point[] | null = null;
    let acceptedNodes: Point[] | null = null;

    let selectedGridSize = gridSizeForNodeCount(target);

    for (let candidateGridSize = selectedGridSize; candidateGridSize <= 8 && !acceptedSolution; candidateGridSize++) {
      const maxNodes = candidateGridSize * candidateGridSize;
      const maxPlayableNodes = Math.max(3, maxNodes - 1);
      const baseNodeCount = Math.max(3, Math.min(target, maxPlayableNodes));
      const groupKey = `${candidateGridSize}:${baseNodeCount}`;
      const occurrence = groupOccurrences.get(groupKey) ?? 0;
      groupOccurrences.set(groupKey, occurrence + 1);

      const maxBump = Math.max(0, maxPlayableNodes - baseNodeCount);
      for (let bump = 0; bump <= maxBump && !acceptedSolution; bump++) {
        const nodeCount = baseNodeCount + bump;
        const attempts = Math.max(80, maxNodes * maxNodes);

        for (let attempt = 0; attempt < attempts; attempt++) {
          const style = levelId * 11 + occurrence * 17 + attempt;
          const fullPath = makeFullPath(candidateGridSize, style);
          const maxStartIndex = Math.max(0, fullPath.length - nodeCount);
          const startIndex = maxStartIndex === 0
            ? 0
            : (levelId * 7 + occurrence * 5 + attempt * 3) % (maxStartIndex + 1);
          const solution = fullPath.slice(startIndex, startIndex + nodeCount);
          const signature = nodeSignature(solution);

          if (seenSignatures.has(signature)) {
            continue;
          }

          seenSignatures.add(signature);
          acceptedSolution = solution;
          acceptedNodes = sortedUnique(solution);
          selectedGridSize = candidateGridSize;
          break;
        }
      }
    }

    if (!acceptedSolution || !acceptedNodes) {
      const fallbackGridSize = Math.min(8, selectedGridSize + 1);
      const fallbackCount = Math.min((fallbackGridSize * fallbackGridSize) - 1, target + 1);
      const fallbackPath = makeSpiralPath(fallbackGridSize).slice(0, fallbackCount);
      const fallbackSignature = nodeSignature(fallbackPath);
      if (!seenSignatures.has(fallbackSignature)) {
        seenSignatures.add(fallbackSignature);
      }
      acceptedSolution = fallbackPath;
      acceptedNodes = sortedUnique(fallbackPath);
      selectedGridSize = fallbackGridSize;
    }

    levels.push({
      id: levelId,
      gridSize: selectedGridSize,
      start: acceptedSolution[0],
      nodes: acceptedNodes,
      solution: acceptedSolution,
    });
  }

  return levels;
}

const PRECOMPUTED_LEVELS = buildAllLevels();

export function generateLevel(rawLevelId: number): GeneratedLevel {
  const levelId = clampLevel(rawLevelId);
  const level = PRECOMPUTED_LEVELS[levelId - 1];

  return {
    id: level.id,
    gridSize: level.gridSize,
    start: { ...level.start },
    nodes: level.nodes.map((p) => ({ ...p })),
    solution: level.solution.map((p) => ({ ...p })),
  };
}
