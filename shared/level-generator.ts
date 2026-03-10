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
  if (levelId <= 10) return 4 + levelId;
  if (levelId <= 30) return 10 + (levelId - 10) * 2;
  if (levelId <= 60) return 50 + (levelId - 30);
  if (levelId <= 100) return 80 + (levelId - 60);
  return Math.min(62, 95 + (levelId - 100));
}

function gridSizeForNodeCount(nodeCount: number): number {
  for (let size = 3; size <= 8; size++) {
    if (size * size >= nodeCount) {
      return size;
    }
  }
  return 8;
}

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
}

function makeSnakePath(size: number): Point[] {
  const path: Point[] = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x++) path.push({ x, y });
    } else {
      for (let x = size - 1; x >= 0; x--) path.push({ x, y });
    }
  }
  return path;
}

function makeSpiralPath(size: number): Point[] {
  const path: Point[] = [];
  let left = 0, right = size - 1, top = 0, bottom = size - 1;
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) path.push({ x, y: top });
    top++;
    for (let y = top; y <= bottom; y++) path.push({ x: right, y });
    right--;
    if (top <= bottom) {
      for (let x = right; x >= left; x--) path.push({ x, y: bottom });
      bottom--;
    }
    if (left <= right) {
      for (let y = bottom; y >= top; y--) path.push({ x: left, y });
      left++;
    }
  }
  return path;
}

function makeZigzagPath(size: number): Point[] {
  const path: Point[] = [];
  for (let y = 0; y < size; y++) {
    if (y % 4 === 0 || y % 4 === 1) {
      for (let x = 0; x < size; x++) path.push({ x, y });
    } else {
      for (let x = size - 1; x >= 0; x--) path.push({ x, y });
    }
  }
  return path;
}

function makeDiagonalPath(size: number): Point[] {
  const path: Point[] = [];
  for (let sum = 0; sum < size * 2 - 1; sum++) {
    const startY = Math.max(0, sum - (size - 1));
    const count = Math.min(sum + 1, size, size - startY);
    for (let i = 0; i < count; i++) {
      const x = Math.min(sum, size - 1) - i;
      const y = startY + i;
      if (x >= 0 && y >= 0 && x < size && y < size) path.push({ x, y });
    }
  }
  return path;
}

function makeKnightPath(size: number): Point[] {
  const path: Point[] = [];
  const visited = new Set<string>();
  let x = 0, y = 0;
  for (let i = 0; i < size * size; i++) {
    path.push({ x, y });
    visited.add(`${x},${y}`);
    let found = false;
    const moves = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
    for (const [dx, dy] of moves) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited.has(`${nx},${ny}`)) {
        x = nx; y = ny; found = true; break;
      }
    }
    if (!found) break;
  }
  return path;
}

function makeHilbertPath(size: number): Point[] {
  const path: Point[] = [];
  const hilbert = (x1: number, y1: number, x2: number, y2: number, ox: number, oy: number, n: number) => {
    if (n === 1) {
      if (ox === 0 && oy === 0) path.push({ x: x1, y: y1 }, { x: x2, y: y2 });
      else path.push({ x: x2, y: y1 }, { x: x1, y: y2 });
    } else {
      const mx = Math.floor((x1 + x2) / 2);
      const my = Math.floor((y1 + y2) / 2);
      if (ox === 0 && oy === 0) {
        hilbert(x1, y1, mx, my, 0, 1, n - 1);
        hilbert(mx, my, x2, y2, 0, 1, n - 1);
        hilbert(mx, my, x2, y2, 1, 1, n - 1);
        hilbert(x1, y1, mx, my, 1, 1, n - 1);
      } else if (ox === 1 && oy === 1) {
        hilbert(mx, my, x2, y2, 1, 0, n - 1);
        hilbert(x1, y1, mx, my, 1, 0, n - 1);
        hilbert(x1, y1, mx, my, 0, 0, n - 1);
        hilbert(mx, my, x2, y2, 0, 0, n - 1);
      } else {
        hilbert(mx, my, x2, y2, ox, 1 - oy, n - 1);
        hilbert(x1, y1, mx, my, ox, 1 - oy, n - 1);
        hilbert(x1, y1, mx, my, 1 - ox, 1 - oy, n - 1);
        hilbert(mx, my, x2, y2, 1 - ox, 1 - oy, n - 1);
      }
    }
  };
  hilbert(0, 0, size - 1, size - 1, 0, 0, Math.ceil(Math.log2(size)));
  return path.slice(0, size * size);
}

function makeMeanderPath(size: number, rng: () => number): Point[] {
  const path: Point[] = [];
  const visited = new Set<string>();
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  let x = Math.floor(rng() * size);
  let y = Math.floor(rng() * size);
  for (let i = 0; i < size * size; i++) {
    path.push({ x, y });
    visited.add(`${x},${y}`);
    dirs.sort(() => rng() - 0.5);
    let found = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited.has(`${nx},${ny}`)) {
        x = nx; y = ny; found = true; break;
      }
    }
    if (!found) break;
  }
  return path;
}

function transformPoint(p: Point, size: number, transform: number): Point {
  switch (transform % 8) {
    case 0: return { x: p.x, y: p.y };
    case 1: return { x: size - 1 - p.x, y: p.y };
    case 2: return { x: p.x, y: size - 1 - p.y };
    case 3: return { x: size - 1 - p.y, y: p.x };
    case 4: return { x: size - 1 - p.x, y: size - 1 - p.y };
    case 5: return { x: p.y, y: size - 1 - p.x };
    case 6: return { x: p.y, y: p.x };
    default: return { x: size - 1 - p.y, y: size - 1 - p.x };
  }
}

function makePathPattern(size: number, style: number, rng: () => number): Point[] {
  const patternIndex = style % 8;
  let base: Point[];
  
  switch (patternIndex) {
    case 0: base = makeSnakePath(size); break;
    case 1: base = makeSpiralPath(size); break;
    case 2: base = makeZigzagPath(size); break;
    case 3: base = makeDiagonalPath(size); break;
    case 4: base = makeHilbertPath(size); break;
    case 5: base = makeMeanderPath(size, rng); break;
    case 6: base = makeKnightPath(size); break;
    default: base = makeSnakePath(size).reverse();
  }
  
  const transform = Math.floor(style / 8) % 8;
  const transformed = base.map(p => transformPoint(p, size, transform));
  
  return style % 2 === 0 ? transformed : [...transformed].reverse();
}

function nodeSignature(points: Point[]): string {
  return [...points]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(p => `${p.x},${p.y}`)
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

  for (let levelId = 1; levelId <= 200; levelId++) {
    const rng = seededRandom(levelId * 9999 + 42);
    const target = targetNodeCountForLevel(levelId);
    let acceptedSolution: Point[] | null = null;
    let acceptedNodes: Point[] | null = null;
    let selectedGridSize = gridSizeForNodeCount(target);

    for (let candidateGridSize = selectedGridSize; candidateGridSize <= 8 && !acceptedSolution; candidateGridSize++) {
      const maxNodes = candidateGridSize * candidateGridSize;
      const maxPlayableNodes = Math.max(3, maxNodes - 1);
      const baseNodeCount = Math.max(3, Math.min(target, maxPlayableNodes));

      const maxBump = Math.max(0, maxPlayableNodes - baseNodeCount);
      for (let bump = 0; bump <= maxBump && !acceptedSolution; bump++) {
        const nodeCount = baseNodeCount + bump;
        const attempts = Math.max(150, maxNodes * maxNodes);

        for (let attempt = 0; attempt < attempts; attempt++) {
          const style = levelId * 13 + candidateGridSize * 7 + attempt * 3 + Math.floor(rng() * 100);
          const fullPath = makePathPattern(candidateGridSize, style, rng);
          
          if (fullPath.length < nodeCount) continue;
          
          const maxStartIndex = Math.max(0, fullPath.length - nodeCount);
          const startIndex = maxStartIndex === 0 ? 0 : Math.floor(rng() * (maxStartIndex + 1));
          const solution = fullPath.slice(startIndex, startIndex + nodeCount);
          
          if (solution.length < nodeCount) continue;
          
          const signature = nodeSignature(solution);
          if (seenSignatures.has(signature)) continue;

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
    nodes: level.nodes.map(p => ({ ...p })),
    solution: level.solution.map(p => ({ ...p })),
  };
}
