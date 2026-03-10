import { type Point } from "@shared/schema";

// Simple seeded random number generator
function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

export interface GeneratedLevel {
  id: number;
  gridSize: number;
  start: Point;
  nodes: Point[];
  solution: Point[];
}

export function generateLevel(levelId: number): GeneratedLevel {
  // Ensure each level is unique with deterministic seed based on levelId
  const rng = mulberry32(levelId * 9973 + 12345);

  // 1. Progressive Difficulty - Better scaling from 1 to 200
  // Levels 1-200 with MUCH steeper progression especially at start
  let difficulty = 0;
  
  if (levelId <= 4) {
    difficulty = 0.2 + (levelId / 4) * 0.15;  // 0.2 to 0.35 (start harder)
  } else if (levelId <= 10) {
    difficulty = 0.35 + ((levelId - 4) / 6) * 0.35; // 0.35 to 0.70
  } else if (levelId <= 20) {
    difficulty = 0.70 + ((levelId - 10) / 10) * 0.20; // 0.70 to 0.90
  } else if (levelId <= 31) {
    difficulty = 0.90 + ((levelId - 20) / 11) * 0.10; // 0.90 to 1.00 (end of first tier very hard)
  } else if (levelId <= 60) {
    difficulty = 1.0 + ((levelId - 31) / 29) * 0.0; // 1.0 (stay challenging)
  } else if (levelId <= 100) {
    difficulty = 1.0 + ((levelId - 60) / 40) * 0.0; // 1.0 (maintain challenge)
  } else if (levelId <= 130) {
    // Levels 101-130: Extreme (1.0 to 1.15)
    difficulty = 1.0 + ((levelId - 100) / 30) * 0.15;
  } else if (levelId <= 170) {
    // Levels 131-170: Insane (1.15 to 1.35)
    difficulty = 1.15 + ((levelId - 130) / 40) * 0.2;
  } else {
    // Levels 171-200: Nightmare (1.35 to 1.5)
    difficulty = 1.35 + ((levelId - 170) / 30) * 0.15;
  }
  
  // Increase grid size progression - MUCH FASTER for levels 1-31
  let gridSize = 3;
  if (levelId > 4) gridSize = 4;      // Levels 5-12
  if (levelId > 10) gridSize = 5;     // Levels 11-22
  if (levelId > 16) gridSize = 6;     // Levels 17-30
  if (levelId > 31) gridSize = 7;     // Levels 32+
  if (levelId > 60) gridSize = 8;     // Levels 61-200
  if (levelId > 85) gridSize = 8;     // Keep at 8x8
  if (levelId > 110) gridSize = 8;    // Levels 111+ stay at 8x8

  // 2. Node Count - Progressive increase with AGGRESSIVE early game
  const gridCells = gridSize * gridSize;
  let nodeCountFactor = 0.4 + (difficulty * 0.5); // 40% to 90%+
  
  // AGGRESSIVE for levels 1-31 to ensure they're harder
  if (levelId >= 1 && levelId <= 5) {
    nodeCountFactor = Math.max(0.65, nodeCountFactor); // At least 65%
  } else if (levelId >= 6 && levelId <= 15) {
    nodeCountFactor = Math.max(0.75, nodeCountFactor); // At least 75%
  } else if (levelId >= 16 && levelId <= 31) {
    nodeCountFactor = Math.max(0.85, nodeCountFactor); // At least 85%
  }
  
  // For levels 101-200, push towards max coverage
  if (levelId > 100) {
    nodeCountFactor = Math.min(0.98, nodeCountFactor * 1.1);
  }
  
  const targetNodeCount = Math.max(3, Math.floor(gridCells * nodeCountFactor));

  // 3. Use unique generation pattern based on levelId
  // MORE variation to ensure NO two levels are alike
  const patternA = Math.floor((levelId * 7) % 5);
  const patternB = Math.floor((levelId * 13) % 5);
  const patternC = Math.floor((levelId * 19) % 5);
  const generationStyle = (patternA + patternB + patternC) % 7; // 7 different styles (was 5)
  
  let result: Point[] | null = null;
  let attempts = 0;
  
  // More attempts for harder levels (101-200)
  const maxAttempts = levelId > 100 ? 500 : 350;

  while (attempts < maxAttempts && !result) {
    result = attemptGeneratePath(
      gridSize, 
      targetNodeCount, 
      rng, 
      levelId, 
      generationStyle,
      difficulty
    );
    attempts++;
  }

  if (!result || result.length < 3) {
    // Fallback to simple level
    return generateFallbackLevel(levelId, gridSize);
  }

  return {
    id: levelId,
    gridSize,
    start: result[0],
    nodes: [...result].sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    solution: result
  };
}

function attemptGeneratePath(
  size: number, 
  targetLength: number, 
  rng: () => number, 
  levelId: number,
  style: number,
  difficulty: number
): Point[] | null {
  const visited = new Set<string>();
  const path: Point[] = [];

  // Vary start position based on style and level for MAXIMUM uniqueness
  let startX: number, startY: number;
  
  const startStyle = (style + Math.floor(levelId / 10) + Math.floor(levelId / 50)) % 7; // 7 variations instead of 5
  
  switch (startStyle) {
    case 0: // Corner starts (rotated based on levelId)
      startX = (levelId % 2) === 0 ? 0 : size - 1;
      startY = (Math.floor(levelId / 2) % 2) === 0 ? 0 : size - 1;
      break;
    case 1: // Edge starts - top/bottom
      startX = Math.floor(rng() * size);
      startY = (levelId % 2) === 0 ? 0 : size - 1;
      break;
    case 2: // Edge starts - left/right
      startX = (levelId % 2) === 0 ? 0 : size - 1;
      startY = Math.floor(rng() * size);
      break;
    case 3: // Center-bias starts
      startX = Math.floor(size / 2 + (rng() - 0.5) * size * 0.4);
      startY = Math.floor(size / 2 + (rng() - 0.5) * size * 0.4);
      startX = Math.max(0, Math.min(size - 1, startX));
      startY = Math.max(0, Math.min(size - 1, startY));
      break;
    case 4: // Random offset starts
      const offset = Math.floor(levelId % size);
      startX = offset;
      startY = (offset + Math.floor(levelId / size)) % size;
      break;
    case 5: // Asymmetric corner based on levelId
      startX = (levelId % 3 === 0) ? 0 : (levelId % 3 === 1) ? size - 1 : Math.floor(size / 2);
      startY = (Math.floor(levelId / 3) % 3 === 0) ? 0 : (Math.floor(levelId / 3) % 3 === 1) ? size - 1 : Math.floor(size / 2);
      break;
    default: // Wave starts - moves along edges dynamically
      const wave = Math.floor(levelId / 7) % size;
      startX = (levelId % 4 === 0) ? wave : (levelId % 4 === 1) ? size - 1 - wave : rng() < 0.5 ? 0 : size - 1;
      startY = (levelId % 4 === 2) ? wave : (levelId % 4 === 3) ? size - 1 - wave : rng() < 0.5 ? 0 : size - 1;
      startX = Math.max(0, Math.min(size - 1, startX));
      startY = Math.max(0, Math.min(size - 1, startY));
  }

  const start = { x: startX, y: startY };
  path.push(start);
  visited.add(`${startX},${startY}`);

  if (extendPath(start, path, visited, size, targetLength, rng, style, difficulty)) {
    return path;
  }

  return null;
}

function extendPath(
  current: Point,
  path: Point[],
  visited: Set<string>,
  size: number,
  targetLength: number,
  rng: () => number,
  style: number,
  difficulty: number
): boolean {
  // Success if we reached target length
  if (path.length >= targetLength) {
    return true;
  }

  // Get neighbors
  const neighbors = [
    { x: current.x, y: current.y - 1 },
    { x: current.x, y: current.y + 1 },
    { x: current.x - 1, y: current.y },
    { x: current.x + 1, y: current.y }
  ].filter(p =>
    p.x >= 0 && p.x < size &&
    p.y >= 0 && p.y < size &&
    !visited.has(`${p.x},${p.y}`)
  );

  // 7 different shuffling strategies for maximum variety
  const shuffleType = (style + path.length) % 7;
  
  if (shuffleType === 0) {
    // Random shuffle - creates chaotic patterns
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
  } else if (shuffleType === 1) {
    // Biased shuffle - prefers to continue in same direction
    neighbors.sort((a, b) => {
      const distA = Math.abs(a.x - current.x) + Math.abs(a.y - current.y);
      const distB = Math.abs(b.x - current.x) + Math.abs(b.y - current.y);
      return rng() * (distA - distB);
    });
  } else if (shuffleType === 2) {
    // X-first directional bias
    neighbors.sort((a, b) => {
      const aScore = Math.abs(a.x - current.x) * 2 + Math.abs(a.y - current.y);
      const bScore = Math.abs(b.x - current.x) * 2 + Math.abs(b.y - current.y);
      return (bScore - aScore) || (rng() - 0.5);
    });
  } else if (shuffleType === 3) {
    // Y-first directional bias
    neighbors.sort((a, b) => {
      const aScore = Math.abs(a.y - current.y) * 2 + Math.abs(a.x - current.x);
      const bScore = Math.abs(b.y - current.y) * 2 + Math.abs(b.x - current.x);
      return (bScore - aScore) || (rng() - 0.5);
    });
  } else if (shuffleType === 4) {
    // Distance from center - spiral patterns
    const centerX = Math.floor(size / 2);
    const centerY = Math.floor(size / 2);
    neighbors.sort((a, b) => {
      const distA = Math.hypot(a.x - centerX, a.y - centerY);
      const distB = Math.hypot(b.x - centerX, b.y - centerY);
      return (distA - distB) || (rng() - 0.5);
    });
  } else if (shuffleType === 5) {
    // Alternating pattern preference
    const preferEven = (path.length % 2 === 0);
    neighbors.sort((a, b) => {
      const aSum = a.x + a.y;
      const bSum = b.x + b.y;
      const aEven = aSum % 2 === 0;
      const bEven = bSum % 2 === 0;
      if (preferEven === aEven && preferEven !== bEven) return -1;
      if (preferEven !== aEven && preferEven === bEven) return 1;
      return rng() - 0.5;
    });
  } else {
    // Reverse random - almost last preference
    for (let i = 0; i < neighbors.length / 2; i++) {
      const j = neighbors.length - 1 - i;
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
  }

  for (const next of neighbors) {
    path.push(next);
    visited.add(`${next.x},${next.y}`);

    if (extendPath(next, path, visited, size, targetLength, rng, style, difficulty)) {
      return true;
    }

    visited.delete(`${next.x},${next.y}`);
    path.pop();
  }

  return false;
}

function generateFallbackLevel(levelId: number, gridSize: number): GeneratedLevel {
  // Unique fallback pattern for each level - EXTENDED to 9 unique patterns
  const rng = mulberry32(levelId * 7919 + levelId * 1321);
  const path: Point[] = [];
  
  // Choose unique pattern based on levelId
  const patternType = levelId % 9; // Now 9 patterns instead of 6
  
  if (patternType === 0) {
    // Spiral pattern (clockwise)
    let x = 0, y = 0;
    let dx = 1, dy = 0;
    let stepsInDirection = 1;
    let stepCount = 0;
    let directionChanges = 0;

    for (let i = 0; i < gridSize * gridSize; i++) {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        path.push({ x, y });
      }

      if (stepCount === stepsInDirection) {
        let temp = dx;
        dx = -dy;
        dy = temp;
        directionChanges++;
        stepCount = 0;

        if (directionChanges % 2 === 0) {
          stepsInDirection++;
        }
      }

      x += dx;
      y += dy;
      stepCount++;
    }
  } else if (patternType === 1) {
    // Diagonal sweep (top-left to bottom-right)
    for (let sum = 0; sum < gridSize * 2; sum++) {
      for (let x = 0; x < gridSize; x++) {
        const y = sum - x;
        if (y >= 0 && y < gridSize) {
          path.push({ x, y });
        }
      }
    }
  } else if (patternType === 2) {
    // Snake pattern (horizontal)
    for (let y = 0; y < gridSize; y++) {
      if (y % 2 === 0) {
        for (let x = 0; x < gridSize; x++) {
          path.push({ x, y });
        }
      } else {
        for (let x = gridSize - 1; x >= 0; x--) {
          path.push({ x, y });
        }
      }
    }
  } else if (patternType === 3) {
    // Radial pattern from center
    const cx = Math.floor(gridSize / 2);
    const cy = Math.floor(gridSize / 2);
    const visited = new Set<string>();
    
    const queue: Point[] = [{ x: cx, y: cy }];
    visited.add(`${cx},${cy}`);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      path.push(current);
      
      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y }
      ];
      
      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (n.x >= 0 && n.x < gridSize && n.y >= 0 && n.y < gridSize && !visited.has(key)) {
          visited.add(key);
          queue.push(n);
        }
      }
    }
  } else if (patternType === 4) {
    // Random walk with backtracking
    const visited = new Set<string>();
    let x = Math.floor(rng() * gridSize);
    let y = Math.floor(rng() * gridSize);
    path.push({ x, y });
    visited.add(`${x},${y}`);

    for (let i = 1; i < gridSize * gridSize; i++) {
      const neighbors = [
        { x, y: y - 1 },
        { x, y: y + 1 },
        { x: x - 1, y },
        { x: x + 1, y }
      ].filter(p => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize);

      if (neighbors.length === 0) break;

      const next = neighbors[Math.floor(rng() * neighbors.length)];
      const key = `${next.x},${next.y}`;

      if (!visited.has(key)) {
        visited.add(key);
        path.push(next);
        x = next.x;
        y = next.y;
      } else {
        i--;
      }
    }
  } else if (patternType === 5) {
    // Vertical snake pattern
    for (let x = 0; x < gridSize; x++) {
      if (x % 2 === 0) {
        for (let y = 0; y < gridSize; y++) {
          path.push({ x, y });
        }
      } else {
        for (let y = gridSize - 1; y >= 0; y--) {
          path.push({ x, y });
        }
      }
    }
  } else if (patternType === 6) {
    // Reverse diagonal sweep (bottom-right to top-left)
    for (let sum = gridSize * 2 - 2; sum >= 0; sum--) {
      for (let x = gridSize - 1; x >= 0; x--) {
        const y = sum - x;
        if (y >= 0 && y < gridSize) {
          path.push({ x, y });
        }
      }
    }
  } else if (patternType === 7) {
    // Spiral pattern (counter-clockwise from center)
    const cx = Math.floor(gridSize / 2);
    const cy = Math.floor(gridSize / 2);
    let x = cx, y = cy;
    let dx = 0, dy = -1;
    let stepsInDirection = 1;
    let stepCount = 0;
    let directionChanges = 0;

    for (let i = 0; i < gridSize * gridSize; i++) {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        path.push({ x, y });
      }

      if (stepCount === stepsInDirection) {
        let temp = dx;
        dx = dy;
        dy = -temp;
        directionChanges++;
        stepCount = 0;

        if (directionChanges % 2 === 0) {
          stepsInDirection++;
        }
      }

      x += dx;
      y += dy;
      stepCount++;
    }
  } else {
    // Pattern 8: Zigzag pattern (diagonal zigzag)
    const points: Point[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        points.push({ x, y });
      }
    }
    
    // Sort by diagonal and position
    points.sort((a, b) => {
      const diagA = a.x + a.y;
      const diagB = b.x + b.y;
      if (diagA !== diagB) return diagA - diagB;
      return (diagA % 2 === 0) ? (a.x - b.x) : (b.x - a.x);
    });
    
    path.push(...points);
  }

  const validPath = path.filter((p, idx) => 
    p.x >= 0 && p.x < gridSize && 
    p.y >= 0 && p.y < gridSize &&
    !path.slice(0, idx).some(prev => prev.x === p.x && prev.y === p.y)
  );

  return {
    id: levelId,
    gridSize,
    start: validPath[0] || { x: 0, y: 0 },
    nodes: validPath.sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    solution: validPath
  };
}
