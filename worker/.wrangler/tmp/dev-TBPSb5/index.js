var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../client/src/lib/daily.ts
var DAILY_LEVEL_COUNT = 200;
function getDateKey(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
__name(getDateKey, "getDateKey");
function hashDateKey(dateKey) {
  let hash = 2166136261;
  for (let index = 0; index < dateKey.length; index++) {
    hash ^= dateKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
__name(hashDateKey, "hashDateKey");
function getDailyLevelId(dateKey = getDateKey()) {
  return hashDateKey(dateKey) % DAILY_LEVEL_COUNT + 1;
}
__name(getDailyLevelId, "getDailyLevelId");

// ../client/src/lib/weekly.ts
var MODIFIERS = ["mirror", "no-undo", "time-attack", "no-hints"];
function getWeekKey(date = /* @__PURE__ */ new Date()) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - day + 3);
  const year = utc.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / 6048e5);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
__name(getWeekKey, "getWeekKey");
function getWeekNumber(date) {
  return Number(getWeekKey(date).split("-W")[1]);
}
__name(getWeekNumber, "getWeekNumber");
function getWeeklyChallenge(date = /* @__PURE__ */ new Date()) {
  const weekKey = getWeekKey(date);
  const weekNumber = getWeekNumber(date);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  const endsAt = new Date(monday);
  endsAt.setDate(endsAt.getDate() + 7);
  return {
    weekKey,
    levelId: hashDateKey(`weekly-${weekKey}`) % 200 + 1,
    modifier: MODIFIERS[(weekNumber - 1) % MODIFIERS.length],
    startsAt: monday.getTime(),
    endsAt: endsAt.getTime()
  };
}
__name(getWeeklyChallenge, "getWeeklyChallenge");

// ../shared/names.ts
var NAME_ADJECTIVES = [
  "Neon",
  "Quiet",
  "Swift",
  "Bright",
  "Lucky",
  "Silent",
  "Cosmic",
  "Turbo",
  "Rapid",
  "Calm",
  "Bold",
  "Clever",
  "Cyber",
  "Electric",
  "Frosty",
  "Golden",
  "Hyper",
  "Iron",
  "Jolly",
  "Keen",
  "Lunar",
  "Mighty",
  "Nimble",
  "Omega",
  "Plasma",
  "Quantum",
  "Rusty",
  "Solar",
  "Tidy",
  "Ultra",
  "Vivid",
  "Wild",
  "Zen",
  "Amber",
  "Brisk",
  "Crisp",
  "Dusty",
  "Eager",
  "Fuzzy",
  "Gentle",
  "Hasty",
  "Icy",
  "Jumpy",
  "Lively",
  "Misty",
  "Noble",
  "Proud",
  "Royal",
  "Sleek",
  "Tiny",
  "Urban",
  "Velvet",
  "Witty",
  "Zesty",
  "Sunny",
  "Stormy",
  "Snappy",
  "Sharp",
  "Steady",
  "Magic"
];
var NAME_NOUNS = [
  "Fox",
  "Wolf",
  "Owl",
  "Hawk",
  "Lynx",
  "Otter",
  "Panda",
  "Tiger",
  "Falcon",
  "Raven",
  "Cobra",
  "Gecko",
  "Koala",
  "Llama",
  "Moose",
  "Newt",
  "Orca",
  "Pika",
  "Quail",
  "Robin",
  "Shark",
  "Toad",
  "Viper",
  "Wasp",
  "Yak",
  "Zebra",
  "Node",
  "Pixel",
  "Circuit",
  "Signal",
  "Vector",
  "Orbit",
  "Comet",
  "Nova",
  "Pulse",
  "Spark",
  "Beam",
  "Byte",
  "Core",
  "Drift",
  "Echo",
  "Flux",
  "Glow",
  "Hex",
  "Link",
  "Loop",
  "Mesh",
  "Nexus",
  "Path",
  "Quark",
  "Relay",
  "Sprite",
  "Trace",
  "Volt",
  "Wave",
  "Wisp",
  "Ion",
  "Laser",
  "Matrix",
  "Photon"
];
var ADJECTIVES = new Set(NAME_ADJECTIVES);
var NOUNS = new Set(NAME_NOUNS);
function isGeneratedName(name) {
  if (typeof name !== "string") return false;
  const match = /^([A-Z][a-z]+)([A-Z][a-z]+)(\d{2})$/.exec(name);
  return match !== null && ADJECTIVES.has(match[1]) && NOUNS.has(match[2]);
}
__name(isGeneratedName, "isGeneratedName");

// ../shared/level-generator.ts
function mulberry32(seed) {
  return /* @__PURE__ */ __name(function random() {
    let value = seed += 1831565813;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }, "random");
}
__name(mulberry32, "mulberry32");
var LAYOUT_FAMILIES = [
  "serpentine",
  "column-serpentine",
  "reverse-serpentine",
  "spiral",
  "outward-spiral",
  "wander",
  "hug",
  "drift",
  "turn",
  "border",
  "corner",
  "weave"
];
var FAMILY_COUNT = LAYOUT_FAMILIES.length;
var LATE_FAMILY_POOL = [
  "spiral",
  "outward-spiral",
  "wander",
  "drift",
  "turn",
  "border",
  "corner",
  "weave"
];
var LATE_FAMILY_FROM = 151;
var DIFFICULTY_TIERS = [
  { from: 1, to: 3, gridSize: 3, startNodes: 5, endNodes: 7 },
  { from: 4, to: 12, gridSize: 4, startNodes: 8, endNodes: 12 },
  { from: 13, to: 24, gridSize: 5, startNodes: 12, endNodes: 17 },
  { from: 25, to: 40, gridSize: 6, startNodes: 18, endNodes: 24 },
  { from: 41, to: 60, gridSize: 7, startNodes: 25, endNodes: 32 },
  { from: 61, to: 85, gridSize: 8, startNodes: 33, endNodes: 42 },
  { from: 86, to: 115, gridSize: 9, startNodes: 43, endNodes: 53 },
  { from: 116, to: 150, gridSize: 10, startNodes: 54, endNodes: 65 },
  { from: 151, to: 175, gridSize: 11, startNodes: 66, endNodes: 78 },
  { from: 176, to: 200, gridSize: 12, startNodes: 79, endNodes: 92 },
  // Expansion: difficulty now comes mostly from the new rules (sync nodes,
  // blackout), so the boards only grow a little and stay readable on a phone.
  { from: 201, to: 240, gridSize: 12, startNodes: 93, endNodes: 106 },
  { from: 241, to: 300, gridSize: 13, startNodes: 107, endNodes: 122 },
  // The Rift: a bonus sector after the campaign with its own rules (levels 301-330).
  { from: 301, to: 330, gridSize: 13, startNodes: 123, endNodes: 130 }
];
var MAX_LEVEL_ID = 300;
var GENERATOR_MAX_LEVEL_ID = 330;
var DIFFICULTY_CURVE = [
  [1, 5],
  [2, 6],
  [3, 7],
  [5, 11],
  [10, 17],
  [20, 26],
  [30, 38],
  [40, 50],
  [50, 60],
  [75, 86],
  [100, 112],
  [125, 138],
  [150, 164],
  [175, 190],
  [190, 206],
  [200, 236],
  [250, 284],
  [290, 322],
  [300, 352],
  [330, 390]
];
function targetDifficulty(levelId) {
  for (let index = 1; index < DIFFICULTY_CURVE.length; index++) {
    const [toId, toScore] = DIFFICULTY_CURVE[index];
    if (levelId > toId) continue;
    const [fromId, fromScore] = DIFFICULTY_CURVE[index - 1];
    return fromScore + (toScore - fromScore) * (levelId - fromId) / (toId - fromId);
  }
  return DIFFICULTY_CURVE[DIFFICULTY_CURVE.length - 1][1];
}
__name(targetDifficulty, "targetDifficulty");
function isStrictLevel(levelId) {
  return levelId <= 3 || levelId >= 191 && levelId <= 200 || levelId >= 291;
}
__name(isStrictLevel, "isStrictLevel");
function baseWindow(levelId) {
  return isStrictLevel(levelId) ? 1 : 2;
}
__name(baseWindow, "baseWindow");
var WINDOW_STEPS = [0, 2, 5, 10, 20];
var NON_CORRIDOR_FROM = 3;
var MIN_BRANCHING_EDGES = 3;
var VARIANT_LIMIT = 192;
var OPTION_LIMIT = 24;
var EXTRA_NODE_LIMIT = 5;
var MASK_WORDS = 6;
function capacityFor(size) {
  return Math.floor(size * size * (size >= 12 ? 0.78 : 0.8));
}
__name(capacityFor, "capacityFor");
function key(point) {
  return `${point.x},${point.y}`;
}
__name(key, "key");
function getLevelShape(levelId) {
  const tier = DIFFICULTY_TIERS.find(({ from, to }) => levelId >= from && levelId <= to);
  if (!tier) throw new RangeError(`No difficulty tier configured for Level ${levelId}`);
  const progress = tier.to === tier.from ? 1 : (levelId - tier.from) / (tier.to - tier.from);
  const capacity = capacityFor(tier.gridSize);
  const targetLength = Math.min(
    capacity,
    Math.max(3, Math.round(tier.startNodes + (tier.endNodes - tier.startNodes) * progress))
  );
  return { gridSize: tier.gridSize, targetLength };
}
__name(getLevelShape, "getLevelShape");
function neighbors(point, size) {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y }
  ].filter(({ x, y }) => x >= 0 && x < size && y >= 0 && y < size);
}
__name(neighbors, "neighbors");
function fullSerpentine(size, vertical) {
  const path = [];
  for (let line = 0; line < size; line++) {
    for (let step = 0; step < size; step++) {
      const forward = line % 2 === 0;
      const across = forward ? step : size - 1 - step;
      path.push(vertical ? { x: line, y: across } : { x: across, y: line });
    }
  }
  return path;
}
__name(fullSerpentine, "fullSerpentine");
function fullSpiral(size, clockwise) {
  const path = [];
  let left = 0;
  let right = size - 1;
  let top = 0;
  let bottom = size - 1;
  while (left <= right && top <= bottom) {
    if (clockwise) {
      for (let x = left; x <= right; x++) path.push({ x, y: top });
      for (let y = top + 1; y <= bottom; y++) path.push({ x: right, y });
      if (top < bottom) for (let x = right - 1; x >= left; x--) path.push({ x, y: bottom });
      if (left < right) for (let y = bottom - 1; y > top; y--) path.push({ x: left, y });
    } else {
      for (let y = top; y <= bottom; y++) path.push({ x: left, y });
      for (let x = left + 1; x <= right; x++) path.push({ x, y: bottom });
      if (left < right) for (let y = bottom - 1; y >= top; y--) path.push({ x: right, y });
      if (top < bottom) for (let x = right - 1; x > left; x--) path.push({ x, y: top });
    }
    left++;
    right--;
    top++;
    bottom--;
  }
  return path;
}
__name(fullSpiral, "fullSpiral");
function slicePath(full, length, random) {
  if (length > full.length) return null;
  const offset = Math.floor(random() * (full.length - length + 1));
  return full.slice(offset, offset + length);
}
__name(slicePath, "slicePath");
function biasedPath(size, length, start, random, bias, budget = 8e4) {
  const path = [start];
  const visited = /* @__PURE__ */ new Set([key(start)]);
  let remainingWork = budget;
  const score = /* @__PURE__ */ __name((candidate, current, previous) => {
    const onward = neighbors(candidate, size).filter((next) => !visited.has(key(next))).length;
    const dx = current.x - (previous ?? current).x;
    const dy = current.y - (previous ?? current).y;
    const sameDirection = candidate.x - current.x === dx && candidate.y - current.y === dy;
    const edge = Math.min(candidate.x, candidate.y, size - 1 - candidate.x, size - 1 - candidate.y);
    const center = Math.abs(candidate.x - (size - 1) / 2) + Math.abs(candidate.y - (size - 1) / 2);
    const tie = random();
    switch (bias) {
      case "hug":
        return onward * 10 + tie;
      case "drift":
        return onward * 6 + (sameDirection ? 0 : 6) + tie;
      case "turn":
        return onward * 6 + (sameDirection ? 6 : 0) + tie;
      case "border":
        return onward * 6 + edge * 3 + tie;
      case "corner":
        return onward * 5 + (candidate.x + candidate.y) * 2 + tie;
      case "weave":
        return onward * 7 + (candidate.x + candidate.y) % 2 * 2 + tie;
      default:
        return tie;
    }
  }, "score");
  const extend = /* @__PURE__ */ __name((current) => {
    if (path.length === length) return true;
    if (--remainingWork <= 0) return false;
    const previous = path.length > 1 ? path[path.length - 2] : null;
    const candidates = neighbors(current, size).filter((point) => !visited.has(key(point))).map((point) => ({ point, score: score(point, current, previous) })).sort((a, b) => a.score - b.score);
    for (const { point } of candidates) {
      path.push(point);
      visited.add(key(point));
      if (extend(point)) return true;
      visited.delete(key(point));
      path.pop();
      if (remainingWork <= 0) break;
    }
    return false;
  }, "extend");
  return extend(start) ? path : null;
}
__name(biasedPath, "biasedPath");
function transform(point, size, variant) {
  const max = size - 1;
  switch (variant % 8) {
    case 0:
      return point;
    case 1:
      return { x: max - point.y, y: point.x };
    case 2:
      return { x: max - point.x, y: max - point.y };
    case 3:
      return { x: point.y, y: max - point.x };
    case 4:
      return { x: max - point.x, y: point.y };
    case 5:
      return { x: point.x, y: max - point.y };
    case 6:
      return { x: point.y, y: point.x };
    default:
      return { x: max - point.y, y: max - point.x };
  }
}
__name(transform, "transform");
function buildFamilyPath(family, size, length, random, sub) {
  switch (family) {
    case "serpentine":
      return slicePath(fullSerpentine(size, false), length, random);
    case "column-serpentine":
      return slicePath(fullSerpentine(size, true), length, random);
    case "reverse-serpentine":
      return slicePath([...fullSerpentine(size, false)].reverse(), length, random);
    case "spiral":
      return slicePath(fullSpiral(size, sub % 2 === 0), length, random);
    case "outward-spiral":
      return slicePath([...fullSpiral(size, sub % 2 === 0)].reverse(), length, random);
    default: {
      const start = {
        x: Math.floor(random() * size),
        y: Math.floor(random() * size)
      };
      return biasedPath(size, length, start, random, family);
    }
  }
}
__name(buildFamilyPath, "buildFamilyPath");
function fallbackPath(size, length, random) {
  return slicePath(fullSerpentine(size, false), length, random) ?? slicePath(fullSerpentine(size, true), length, random);
}
__name(fallbackPath, "fallbackPath");
var levelCache = /* @__PURE__ */ new Map();
var usedMasks = /* @__PURE__ */ new Map();
var familyUsage = /* @__PURE__ */ new Map();
var lastDifficulty = 0;
var lastNodes = 0;
var lastFamily = null;
function createCandidate(levelId, variant, extraNodes = 0) {
  const shape = getLevelShape(levelId);
  const gridSize = shape.gridSize;
  const capacity = capacityFor(gridSize);
  const targetLength = Math.min(capacity, shape.targetLength + extraNodes);
  const random = mulberry32(levelId * 9973 + 12345 + variant * 2654435769);
  const family = LAYOUT_FAMILIES[variant % FAMILY_COUNT];
  const sub = Math.floor(variant / FAMILY_COUNT);
  let solution = buildFamilyPath(family, gridSize, targetLength, random, sub);
  solution ??= biasedPath(gridSize, targetLength, {
    x: Math.floor(random() * gridSize),
    y: Math.floor(random() * gridSize)
  }, random, "hug");
  solution ??= fallbackPath(gridSize, targetLength, random);
  const orientation = (variant * 5 + levelId) % 8;
  const oriented = solution.map((point) => transform(point, gridSize, orientation));
  return {
    id: levelId,
    gridSize,
    start: oriented[0],
    nodes: [...oriented].sort((a, b) => a.y - b.y || a.x - b.x),
    solution: oriented,
    family
  };
}
__name(createCandidate, "createCandidate");
function toMask(level, variant) {
  const mask = new Array(MASK_WORDS).fill(0);
  for (const node of level.nodes) {
    const point = transform(node, level.gridSize, variant);
    const index = point.y * level.gridSize + point.x;
    mask[index >>> 5] |= 1 << (index & 31);
  }
  return mask;
}
__name(toMask, "toMask");
function popcount(value) {
  let bits = value - (value >>> 1 & 1431655765);
  bits = (bits & 858993459) + (bits >>> 2 & 858993459);
  bits = bits + (bits >>> 4) & 252645135;
  return bits * 16843009 >>> 24;
}
__name(popcount, "popcount");
function maskDistance(a, b) {
  let distance = 0;
  for (let word = 0; word < MASK_WORDS; word++) {
    distance += popcount((a[word] ^ b[word]) >>> 0);
  }
  return distance;
}
__name(maskDistance, "maskDistance");
function minLayoutDistance(level, stored) {
  if (!stored || stored.length === 0) return Infinity;
  let smallest = Infinity;
  for (let variant = 0; variant < 8; variant++) {
    const mask = toMask(level, variant);
    for (const other of stored) {
      const distance = maskDistance(mask, other);
      if (distance < smallest) {
        smallest = distance;
        if (smallest === 0) return 0;
      }
    }
  }
  return smallest;
}
__name(minLayoutDistance, "minLayoutDistance");
function requiredDistance(nodeCount) {
  const cap = nodeCount > 106 ? 20 : 16;
  return Math.min(cap, Math.max(3, Math.round(nodeCount * 0.16)));
}
__name(requiredDistance, "requiredDistance");
function countBranchingEdges(path) {
  const cells = new Set(path.map(key));
  let edges = 0;
  for (const point of path) {
    if (cells.has(`${point.x + 1},${point.y}`)) edges++;
    if (cells.has(`${point.x},${point.y + 1}`)) edges++;
  }
  return Math.max(0, edges - (path.length - 1));
}
__name(countBranchingEdges, "countBranchingEdges");
function greedySuccessRate(level, runs = 24) {
  const nodes = new Set(level.nodes.map(key));
  const total = level.nodes.length;
  let wins = 0;
  for (let run = 0; run < runs; run++) {
    const random = mulberry32(level.id * 8191 + run * 131 + level.gridSize * 17);
    const seen = /* @__PURE__ */ new Set([key(level.start)]);
    let current = level.start;
    while (seen.size < total) {
      const candidates = neighbors(current, level.gridSize).filter((point) => nodes.has(key(point)) && !seen.has(key(point))).map((point) => ({
        point,
        onward: neighbors(point, level.gridSize).filter((next) => nodes.has(key(next)) && !seen.has(key(next))).length,
        tie: random()
      })).sort((a, b) => a.onward - b.onward || a.tie - b.tie);
      if (candidates.length === 0) break;
      current = candidates[0].point;
      seen.add(key(current));
    }
    if (seen.size === total) wins++;
  }
  return wins / runs;
}
__name(greedySuccessRate, "greedySuccessRate");
function getLevelDifficulty(level) {
  return structuralDifficulty(level) + trapPressure(level);
}
__name(getLevelDifficulty, "getLevelDifficulty");
function structuralDifficulty(level) {
  return level.nodes.length + countBranchingEdges(level.solution) * 2;
}
__name(structuralDifficulty, "structuralDifficulty");
function trapPressure(level) {
  const ramp = Math.min(1, Math.max(0, (level.id - 25) / 50));
  return Math.round((1 - greedySuccessRate(level)) * 32 * ramp);
}
__name(trapPressure, "trapPressure");
function onCurve(levelId, difficulty, window) {
  if (Math.abs(difficulty - targetDifficulty(levelId)) > window) return false;
  return !isStrictLevel(levelId) || levelId === 1 || difficulty > lastDifficulty;
}
__name(onCurve, "onCurve");
var RIFT_MAX_SEPARATION = 12;
function meetsRiftRules(level) {
  if (level.family === lastFamily) return false;
  if (countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) return false;
  const distance = minLayoutDistance(level, usedMasks.get(level.gridSize));
  return distance >= Math.min(RIFT_MAX_SEPARATION, requiredDistance(level.nodes.length));
}
__name(meetsRiftRules, "meetsRiftRules");
function searchRiftLevel(levelId) {
  for (let extraNodes = 0; extraNodes <= EXTRA_NODE_LIMIT; extraNodes++) {
    for (const variant of variantOrder(levelId)) {
      const level = createCandidate(levelId, variant, extraNodes);
      if (!meetsRiftRules(level)) continue;
      return { level, difficulty: 0, structural: 0, traps: 0, distance: 0, variant, extraNodes };
    }
  }
  throw new Error(`Could not create a layout for Rift level ${levelId}`);
}
__name(searchRiftLevel, "searchRiftLevel");
function targetFamily(levelId) {
  if (levelId >= LATE_FAMILY_FROM) {
    return LATE_FAMILY_POOL[(levelId - 1) * 5 % LATE_FAMILY_POOL.length];
  }
  return LAYOUT_FAMILIES[(levelId - 1) * 5 % FAMILY_COUNT];
}
__name(targetFamily, "targetFamily");
function familyAllowed(levelId, family) {
  return levelId < LATE_FAMILY_FROM || LATE_FAMILY_POOL.includes(family);
}
__name(familyAllowed, "familyAllowed");
function variantOrder(levelId) {
  const target = LAYOUT_FAMILIES.indexOf(targetFamily(levelId));
  const limit = VARIANT_LIMIT;
  const order = [];
  for (let sub = 0; sub < limit / FAMILY_COUNT; sub++) {
    order.push(target + sub * FAMILY_COUNT);
  }
  for (let variant = 0; variant < limit; variant++) {
    if (order.includes(variant)) continue;
    if (!familyAllowed(levelId, LAYOUT_FAMILIES[variant % FAMILY_COUNT])) continue;
    order.push(variant);
  }
  return order;
}
__name(variantOrder, "variantOrder");
function collectOptions(levelId, extraNodes, stored, furthest, window, margin = 0) {
  const options = [];
  const needed = Math.max(1, requiredDistance(createLevelLength(levelId, extraNodes)) - margin);
  for (const variant of variantOrder(levelId)) {
    const level = createCandidate(levelId, variant, extraNodes);
    if (level.nodes.length < lastNodes) continue;
    if (level.family === lastFamily) continue;
    const structural = structuralDifficulty(level);
    const traps = trapPressure(level);
    const difficulty = structural + traps;
    const distance = minLayoutDistance(level, stored);
    if (distance === 0) continue;
    if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) continue;
    const candidate = {
      level,
      difficulty,
      structural,
      traps,
      distance,
      variant,
      extraNodes
    };
    if (!furthest.current || distance > furthest.current.distance) {
      furthest.current = candidate;
    }
    if (!onCurve(levelId, difficulty, window)) continue;
    if (distance < needed) continue;
    options.push(candidate);
    if (options.length >= OPTION_LIMIT) break;
  }
  return options;
}
__name(collectOptions, "collectOptions");
function createLevelLength(levelId, extraNodes) {
  const shape = getLevelShape(levelId);
  return Math.min(capacityFor(shape.gridSize), shape.targetLength + extraNodes);
}
__name(createLevelLength, "createLevelLength");
function selectBest(options, levelId) {
  const target = targetDifficulty(levelId);
  const family = targetFamily(levelId);
  const score = /* @__PURE__ */ __name((candidate) => Math.abs(candidate.difficulty - target) * 3 + (familyUsage.get(candidate.level.family) ?? 0) * 16 + (candidate.level.family === family ? 0 : 40), "score");
  return options.sort(
    (a, b) => score(a) - score(b) || b.distance - a.distance || a.variant - b.variant
  )[0];
}
__name(selectBest, "selectBest");
function searchLevel(levelId) {
  if (levelId > MAX_LEVEL_ID) return searchRiftLevel(levelId);
  const { gridSize } = getLevelShape(levelId);
  const stored = usedMasks.get(gridSize) ?? [];
  const furthest = { current: null };
  const base = baseWindow(levelId);
  for (const margin of [0, 2]) {
    for (const step of WINDOW_STEPS) {
      for (let extraNodes = 0; extraNodes <= EXTRA_NODE_LIMIT; extraNodes++) {
        const options = collectOptions(levelId, extraNodes, stored, furthest, base + step, margin);
        if (options.length > 0) return selectBest(options, levelId);
      }
    }
  }
  if (!furthest.current || furthest.current.distance === 0) {
    throw new Error(`Could not create a layout for level ${levelId}`);
  }
  return furthest.current;
}
__name(searchLevel, "searchLevel");
var VARIANT_TABLE = [
  672,
  520,
  464,
  312,
  160,
  200,
  16,
  136,
  1088,
  152,
  1504,
  328,
  192,
  144,
  848,
  120,
  832,
  456,
  328,
  832,
  32,
  1208,
  1528,
  504,
  88,
  1200,
  272,
  1176,
  928,
  40,
  1008,
  856,
  1328,
  800,
  776,
  208,
  912,
  712,
  32,
  856,
  832,
  816,
  1464,
  376,
  896,
  760,
  32,
  240,
  560,
  96,
  1424,
  616,
  208,
  752,
  48,
  1272,
  232,
  1240,
  832,
  184,
  624,
  536,
  704,
  944,
  760,
  640,
  1296,
  760,
  1280,
  616,
  993,
  617,
  256,
  1392,
  520,
  1200,
  760,
  1520,
  432,
  928,
  1089,
  65,
  809,
  1120,
  424,
  1464,
  376,
  448,
  144,
  472,
  1504,
  752,
  520,
  368,
  1104,
  1384,
  1080,
  848,
  832,
  944,
  544,
  240,
  1288,
  280,
  808,
  336,
  80,
  424,
  1177,
  809,
  1528,
  816,
  904,
  568,
  200,
  512,
  376,
  216,
  736,
  272,
  1120,
  1040,
  664,
  1040,
  1120,
  784,
  48,
  568,
  1248,
  320,
  1344,
  432,
  1240,
  1384,
  1488,
  256,
  568,
  1200,
  1024,
  1232,
  832,
  232,
  1232,
  376,
  1424,
  696,
  128,
  352,
  1040,
  360,
  608,
  1232,
  376,
  352,
  136,
  472,
  1192,
  352,
  1088,
  1328,
  1376,
  40,
  848,
  264,
  1312,
  1384,
  664,
  1232,
  184,
  514,
  810,
  732,
  453,
  828,
  1436,
  1467,
  762,
  1378,
  1193,
  281,
  1176,
  712,
  1120,
  520,
  456,
  520,
  1041,
  1216,
  232,
  633,
  617,
  161,
  281,
  1288,
  256,
  280,
  944,
  1048,
  544,
  696,
  760,
  352,
  617,
  1337,
  449,
  472,
  928,
  1289,
  1312,
  1481,
  345,
  376,
  1465,
  1121,
  848,
  600,
  1432,
  1312,
  713,
  281,
  544,
  560,
  448,
  1320,
  344,
  464,
  64,
  616,
  64,
  1336,
  1384,
  1216,
  88,
  616,
  256,
  88,
  1120,
  857,
  616,
  280,
  696,
  472,
  1464,
  1136,
  1384,
  24,
  1528,
  1176,
  184,
  448,
  40,
  1144,
  1504,
  1528,
  640,
  464,
  425,
  362,
  1025,
  1338,
  258,
  426,
  1329,
  185,
  731,
  331,
  546,
  1018,
  1219,
  379,
  546,
  474,
  1314,
  1290,
  257,
  715,
  1051,
  1027,
  475,
  523,
  68,
  716,
  827,
  1339,
  451,
  861,
  140,
  380,
  1508,
  1148,
  260,
  1292,
  1029,
  477,
  180,
  1124,
  189,
  909,
  1045,
  925,
  64,
  32,
  80,
  152,
  24,
  32,
  40,
  88,
  64,
  416,
  80,
  56,
  984,
  40,
  56,
  88,
  64,
  40,
  80,
  56,
  40,
  56,
  40,
  88,
  64,
  88,
  272,
  56,
  40,
  56
];
function selectLevel(levelId) {
  const packed = VARIANT_TABLE[levelId - 1];
  if (packed === void 0) return searchLevel(levelId);
  const variant = packed >> 3;
  const extraNodes = packed & 7;
  return {
    level: createCandidate(levelId, variant, extraNodes),
    difficulty: 0,
    structural: 0,
    traps: 0,
    distance: 0,
    variant,
    extraNodes
  };
}
__name(selectLevel, "selectLevel");
function commitLevel(id, candidate) {
  const level = candidate.level;
  usedMasks.set(level.gridSize, [...usedMasks.get(level.gridSize) ?? [], toMask(level, 0)]);
  levelCache.set(id, level);
  familyUsage.set(level.family, (familyUsage.get(level.family) ?? 0) + 1);
  lastDifficulty = getLevelDifficulty(level);
  lastNodes = Math.max(lastNodes, level.nodes.length);
  lastFamily = level.family;
}
__name(commitLevel, "commitLevel");
function generateThrough(targetLevelId) {
  for (let id = levelCache.size + 1; id <= targetLevelId; id++) {
    commitLevel(id, selectLevel(id));
  }
}
__name(generateThrough, "generateThrough");
var directCache = /* @__PURE__ */ new Map();
function generateLevel(levelId) {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > GENERATOR_MAX_LEVEL_ID) {
    throw new RangeError(`Level id must be an integer from 1 to ${GENERATOR_MAX_LEVEL_ID}. Received: ${levelId}`);
  }
  const packed = VARIANT_TABLE[levelId - 1];
  if (packed !== void 0) {
    let level = directCache.get(levelId);
    if (!level) {
      level = createCandidate(levelId, packed >> 3, packed & 7);
      directCache.set(levelId, level);
    }
    return level;
  }
  generateThrough(levelId);
  return levelCache.get(levelId);
}
__name(generateLevel, "generateLevel");

// ../shared/mechanics.ts
var PAIR_COLORS = ["#ff6ec7", "#ffd700"];
var key2 = /* @__PURE__ */ __name((point) => `${point.x},${point.y}`, "key");
function seededRandom(seed) {
  let state = seed * 2654435761 >>> 0;
  return () => {
    state = state * 1664525 + 1013904223 >>> 0;
    return state / 4294967295;
  };
}
__name(seededRandom, "seededRandom");
function emptyCells(level, solution) {
  const blocked = new Set([...level.nodes, ...solution].map(key2));
  const cells = [];
  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const point = { x, y };
      if (!blocked.has(key2(point))) cells.push(point);
    }
  }
  return cells;
}
__name(emptyCells, "emptyCells");
function getLevelMechanics(level, solution) {
  const levelId = level.id;
  const isBoss = levelId % 25 === 0;
  const random = seededRandom(levelId * 97 + 13);
  const empty = emptyCells(level, solution);
  const walls = [];
  if (levelId >= 11) {
    const wallCount = Math.min(empty.length, isBoss ? 6 : 4, 3 + Math.floor(levelId / 50));
    const pool = [...empty];
    while (walls.length < wallCount && pool.length > 0) {
      const index = Math.floor(random() * pool.length);
      walls.push(pool.splice(index, 1)[0]);
    }
  }
  const oneWays = [];
  if (levelId >= 51 && solution.length > 4) {
    const fractions = levelId >= 126 ? [0.22, 0.48, 0.74] : [0.3, 0.62];
    fractions.forEach((fraction, index) => {
      if (index > 0 && levelId < 101) return;
      const pathIndex = Math.min(solution.length - 2, Math.max(1, Math.floor(solution.length * fraction)));
      const point = solution[pathIndex];
      const next = solution[pathIndex + 1];
      if (!point || !next) return;
      const dx = Math.sign(next.x - point.x);
      const dy = Math.sign(next.y - point.y);
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;
      if (oneWays.some((entry) => entry.point.x === point.x && entry.point.y === point.y)) return;
      oneWays.push({ point, dx, dy });
    });
  }
  const pairs = [];
  if (levelId >= 76 && solution.length > 8) {
    const pairCount = levelId >= 126 ? 2 : 1;
    const ranges = [
      [0.2, 0.65],
      [0.45, 0.9]
    ];
    const paired = /* @__PURE__ */ new Set();
    for (let index = 0; index < pairCount; index++) {
      const [from, to] = ranges[index];
      const first = solution[Math.floor(solution.length * from)];
      const second = solution[Math.floor(solution.length * to)];
      if (!first || !second || key2(first) === key2(second)) continue;
      if (paired.has(key2(first)) || paired.has(key2(second))) continue;
      pairs.push({ first, second, color: PAIR_COLORS[index % PAIR_COLORS.length] });
      paired.add(key2(first));
      paired.add(key2(second));
    }
  }
  const portals = [];
  if (levelId >= 101 && empty.length >= 2) {
    const usedWalls = new Set(walls.map(key2));
    const pool = empty.filter((cell) => !usedWalls.has(key2(cell)));
    const adjacentToNode = /* @__PURE__ */ __name((cell) => level.nodes.some(
      (node) => Math.abs(node.x - cell.x) + Math.abs(node.y - cell.y) === 1
    ), "adjacentToNode");
    const candidates = pool.filter(adjacentToNode);
    if (candidates.length >= 2) {
      const firstIndex = Math.floor(random() * candidates.length);
      const a = candidates.splice(firstIndex, 1)[0];
      const secondIndex = Math.floor(random() * candidates.length);
      const b = candidates[secondIndex];
      if (a && b) portals.push({ a, b });
    }
  }
  const syncNodes = [];
  if (levelId >= 201 && solution.length > 12) {
    const claimed = /* @__PURE__ */ new Set([
      ...oneWays.map((rule) => key2(rule.point)),
      ...pairs.flatMap((pair) => [key2(pair.first), key2(pair.second)])
    ]);
    const count = levelId >= 276 ? 4 : levelId >= 226 ? 3 : 2;
    for (let index = 0; index < count; index++) {
      let step = Math.floor(solution.length * (index + 1) / (count + 1));
      while (step < solution.length - 1 && claimed.has(key2(solution[step]))) step++;
      if (step < 1 || claimed.has(key2(solution[step]))) continue;
      claimed.add(key2(solution[step]));
      syncNodes.push({ point: solution[step], step });
    }
  }
  const phaseNodes = [];
  const flipArrows = [];
  if (levelId >= 301 && solution.length > 12) {
    const claimed = /* @__PURE__ */ new Set([
      ...oneWays.map((rule) => key2(rule.point)),
      ...pairs.flatMap((pair) => [key2(pair.first), key2(pair.second)]),
      ...syncNodes.map((node) => key2(node.point))
    ]);
    const free = /* @__PURE__ */ __name((step) => step >= 1 && step < solution.length - 1 && !claimed.has(key2(solution[step])), "free");
    const place = /* @__PURE__ */ __name((target) => {
      let step = Math.floor(target);
      while (step < solution.length - 1 && !free(step)) step++;
      return free(step) ? step : null;
    }, "place");
    const phaseCount = 3 + Math.floor((levelId - 301) / 8);
    for (let index = 0; index < phaseCount; index++) {
      const step = place(solution.length * (index + 0.5) / phaseCount);
      if (step === null) continue;
      claimed.add(key2(solution[step]));
      phaseNodes.push({ point: solution[step], parity: (step + 1) % 2 });
    }
    if (levelId >= 316) {
      const flipCount = 3 + Math.floor((levelId - 316) / 5);
      for (let index = 0; index < flipCount; index++) {
        const step = place(solution.length * (index + 0.25) / flipCount);
        if (step === null) continue;
        const point = solution[step];
        const next = solution[step + 1];
        const dx = Math.sign(next.x - point.x);
        const dy = Math.sign(next.y - point.y);
        if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
        claimed.add(key2(point));
        flipArrows.push({ point, dx, dy, parity: (step + 1) % 2 });
      }
    }
  }
  return {
    isBoss,
    syncNodes,
    phaseNodes,
    flipArrows,
    // The first half of the Rift introduces the new rules on a lit board.
    blackout: levelId >= 251 && !(levelId >= 301 && levelId <= 315),
    walls,
    oneWays,
    pairs,
    portals,
    parMultiplier: isBoss ? 1.15 : 1
  };
}
__name(getLevelMechanics, "getLevelMechanics");
function mirrorLevel(level, solution) {
  const flip = /* @__PURE__ */ __name((point) => ({ x: level.gridSize - 1 - point.x, y: point.y }), "flip");
  return {
    level: {
      ...level,
      start: flip(level.start),
      nodes: level.nodes.map(flip)
    },
    solution: solution.map(flip)
  };
}
__name(mirrorLevel, "mirrorLevel");
function createMoveRules(level, mechanics) {
  const nodeKeys = new Set(level.nodes.map(key2));
  const portals = /* @__PURE__ */ new Map();
  mechanics.portals.forEach((pair) => {
    portals.set(key2(pair.a), pair.b);
    portals.set(key2(pair.b), pair.a);
  });
  const oneWays = new Map(mechanics.oneWays.map((rule) => [key2(rule.point), rule]));
  const secondOfPair = new Map(mechanics.pairs.map((pair) => [key2(pair.second), key2(pair.first)]));
  const syncSteps = new Map(mechanics.syncNodes.map((node) => [key2(node.point), node.step]));
  const phases = new Map(mechanics.phaseNodes.map((node) => [key2(node.point), node.parity]));
  const flips = new Map(mechanics.flipArrows.map((rule) => [key2(rule.point), rule]));
  const visitedNodeCount = /* @__PURE__ */ __name((path) => path.filter((point) => nodeKeys.has(key2(point))).length, "visitedNodeCount");
  const step = /* @__PURE__ */ __name((path, target) => {
    const head = path[path.length - 1];
    if (!head) return null;
    if (Math.abs(target.x - head.x) + Math.abs(target.y - head.y) !== 1) return null;
    const targetKey = key2(target);
    const twin = portals.get(targetKey);
    if (!nodeKeys.has(targetKey) && !twin) return null;
    if (path.some((point) => key2(point) === targetKey)) return null;
    const oneWay = oneWays.get(key2(head));
    if (oneWay && (target.x - head.x !== oneWay.dx || target.y - head.y !== oneWay.dy)) return null;
    const flip = flips.get(key2(head));
    if (flip) {
      const sign = visitedNodeCount(path) % 2 === flip.parity ? 1 : -1;
      if (target.x - head.x !== flip.dx * sign || target.y - head.y !== flip.dy * sign) return null;
    }
    const partner = secondOfPair.get(targetKey);
    if (partner && !path.some((point) => key2(point) === partner)) return null;
    const sync = syncSteps.get(targetKey);
    if (sync !== void 0 && visitedNodeCount(path) !== sync) return null;
    const phase = phases.get(targetKey);
    if (phase !== void 0 && (visitedNodeCount(path) + 1) % 2 !== phase) return null;
    const next = [...path, target];
    if (twin && !next.some((point) => key2(point) === key2(twin))) next.push({ ...twin });
    return next;
  }, "step");
  const isComplete = /* @__PURE__ */ __name((path) => visitedNodeCount(path) === nodeKeys.size, "isComplete");
  const isStuck = /* @__PURE__ */ __name((path) => {
    if (isComplete(path)) return false;
    const head = path[path.length - 1];
    if (!head) return false;
    return [[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => step(path, { x: head.x + dx, y: head.y + dy }) === null);
  }, "isStuck");
  return { step, isComplete, isStuck, visitedNodeCount };
}
__name(createMoveRules, "createMoveRules");

// ../shared/verify.ts
var MIN_MS_PER_NODE = 40;
var isPoint = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null && Number.isInteger(value.x) && Number.isInteger(value.y), "isPoint");
function verifyPlayedPath(levelId, path, timeMs, options = {}) {
  if (!Array.isArray(path) || path.length < 2 || path.length > 800 || !path.every(isPoint)) return "path required";
  const generated = generateLevel(levelId);
  const base = { id: generated.id, gridSize: generated.gridSize, start: generated.start, nodes: generated.nodes };
  const source = options.mirrored ? mirrorLevel(base, generated.solution) : { level: base, solution: generated.solution };
  const mechanics = getLevelMechanics(source.level, source.solution);
  const rules = createMoveRules(source.level, mechanics);
  if (path[0].x !== source.level.start.x || path[0].y !== source.level.start.y) return "wrong start";
  let current = [path[0]];
  for (let index = 1; index < path.length; index++) {
    const next = rules.step(current, path[index]);
    if (!next) return "path does not follow the rules";
    if (next.length === current.length + 2) {
      const twin = next[next.length - 1];
      const recorded = path[index + 1];
      if (!recorded || recorded.x !== twin.x || recorded.y !== twin.y) return "path does not follow the rules";
      index++;
    }
    current = next;
  }
  if (!rules.isComplete(current)) return "path does not solve the level";
  if (!Number.isFinite(timeMs) || timeMs < source.level.nodes.length * MIN_MS_PER_NODE) return "time too short";
  return null;
}
__name(verifyPlayedPath, "verifyPlayedPath");

// src/logic.ts
var MAX_STARS = 900;
var MAX_TIME_MS = 60 * 60 * 1e3;
var isPlayerId = /* @__PURE__ */ __name((value) => typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value), "isPlayerId");
var utcDay = /* @__PURE__ */ __name((dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}, "utcDay");
var fail = /* @__PURE__ */ __name((status, error) => ({ status, body: { error } }), "fail");
async function handleSubmit(input, store, now) {
  const body = input ?? {};
  const name = isGeneratedName(body.name) ? body.name : null;
  if (!isPlayerId(body.playerId)) return fail(400, "invalid player id");
  if (!name) return fail(400, "invalid name");
  const value = body.value;
  if (!Number.isInteger(value) || value < 0) return fail(400, "invalid value");
  const score = value;
  if (body.kind === "stars") {
    if (score > MAX_STARS) return fail(400, "invalid value");
    await store.upsert("stars", body.playerId, name, score, "high", now.getTime());
    return { status: 200, body: { ok: true } };
  }
  if (body.kind === "daily") {
    const dateKey = typeof body.dateKey === "string" ? body.dateKey : "";
    const day = utcDay(dateKey);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (day === null || Math.abs(day - today) > 864e5) return fail(400, "not today's challenge");
    if (score > MAX_TIME_MS) return fail(400, "invalid value");
    const problem = verifyPlayedPath(getDailyLevelId(dateKey), body.path, score);
    if (problem) return fail(422, problem);
    await store.upsert(`daily:${dateKey}`, body.playerId, name, score, "low", now.getTime());
    return { status: 200, body: { ok: true } };
  }
  if (body.kind === "weekly") {
    const challenge = getWeeklyChallenge(now);
    if (body.weekKey !== challenge.weekKey) return fail(400, "not this week's challenge");
    if (score > MAX_TIME_MS) return fail(400, "invalid value");
    const problem = verifyPlayedPath(challenge.levelId, body.path, score, { mirrored: challenge.modifier === "mirror" });
    if (problem) return fail(422, problem);
    await store.upsert(`weekly:${challenge.weekKey}`, body.playerId, name, score, "low", now.getTime());
    return { status: 200, body: { ok: true } };
  }
  return fail(400, "unknown board");
}
__name(handleSubmit, "handleSubmit");
async function handleTop(kind, playerId, dateKey, store, now) {
  let board;
  let order = "low";
  if (kind === "duel") {
    const rows2 = await store.topRatings(20);
    const you2 = playerId && isPlayerId(playerId) ? await store.rankRating(playerId) : null;
    return {
      status: 200,
      body: {
        board: "duel",
        entries: rows2.map((row, index) => ({ rank: index + 1, name: row.name, value: row.value, you: row.playerId === playerId })),
        you: you2
      }
    };
  }
  if (kind === "stars") {
    board = "stars";
    order = "high";
  } else if (kind === "daily") {
    const day = dateKey ? utcDay(dateKey) : null;
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    board = dateKey && day !== null && Math.abs(day - today) <= 864e5 ? `daily:${dateKey}` : `daily:${new Date(today).toISOString().slice(0, 10)}`;
  } else if (kind === "weekly") {
    board = `weekly:${getWeeklyChallenge(now).weekKey}`;
  } else {
    return fail(400, "unknown board");
  }
  const rows = await store.top(board, order, 20);
  const you = playerId && isPlayerId(playerId) ? await store.rank(board, playerId, order) : null;
  return {
    status: 200,
    body: {
      board,
      entries: rows.map((row, index) => ({ rank: index + 1, name: row.name, value: row.value, you: row.playerId === playerId })),
      you
    }
  };
}
__name(handleTop, "handleTop");

// src/match.ts
var COUNTDOWN_MS = 3e3;
var ROUND_LIMIT_MS = 12e4;
var BETWEEN_ROUNDS_MS = 4500;
var JOIN_WAIT_MS = 25e3;
var RECONNECT_MS = 15e3;
var ROUNDS_TO_WIN = 2;
var MAX_ROUNDS = 5;
var START_RATING = 1e3;
var K = 32;
var BOT_WIN_POINTS = 6;
var BOT_RATING_CEILING = 1200;
var MIN_RATING = 100;
function pickLevels(averageRating, rng, count = MAX_ROUNDS) {
  const high = Math.max(40, Math.min(140, Math.round(60 + (averageRating - START_RATING) / 8)));
  const low = 12;
  const picked = [];
  while (picked.length < count) {
    const id = low + Math.floor(rng() * (high - low + 1));
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}
__name(pickLevels, "pickLevels");
function eloDelta(own, other, score) {
  const expected = 1 / (1 + 10 ** ((other - own) / 400));
  return Math.round(K * (score - expected));
}
__name(eloDelta, "eloDelta");
var Match = class {
  constructor(humans, vsBot, clock, rng, onFinished) {
    this.vsBot = vsBot;
    this.clock = clock;
    this.rng = rng;
    this.onFinished = onFinished;
    const seats = humans.map((fighter) => ({ fighter, bot: false, send: null, wins: 0, dropTimer: null }));
    if (vsBot) {
      const human = humans[0];
      seats.push({ fighter: { id: "bot", name: "Bot", rating: human.rating }, bot: true, send: null, wins: 0, dropTimer: null });
    }
    this.seats = seats;
    this.levels = pickLevels(seats.reduce((sum, seat) => sum + seat.fighter.rating, 0) / seats.length, rng);
    this.timers.push(clock.after(JOIN_WAIT_MS, () => {
      if (!this.started) this.finish(null, false, true);
    }));
  }
  vsBot;
  clock;
  rng;
  onFinished;
  static {
    __name(this, "Match");
  }
  seats;
  levels;
  round = 0;
  roundOpen = false;
  startAt = 0;
  started = false;
  over = false;
  timers = [];
  seatOf(id) {
    return this.seats.find((seat) => seat.fighter.id === id && !seat.bot);
  }
  opponentOf(seat) {
    return this.seats.find((other) => other !== seat);
  }
  broadcast(build) {
    this.seats.forEach((seat) => seat.send?.(build(seat, this.opponentOf(seat))));
  }
  humans() {
    return this.seats.filter((seat) => !seat.bot);
  }
  /** A player's socket is connected (or reconnected). */
  attach(playerId, send) {
    const seat = this.seatOf(playerId);
    if (!seat) {
      send({ type: "error", reason: "not in this match" });
      return;
    }
    seat.dropTimer?.();
    seat.dropTimer = null;
    seat.send = send;
    const opponent = this.opponentOf(seat);
    send({
      type: "match",
      you: { name: seat.fighter.name, rating: seat.fighter.rating },
      opponent: { name: opponent.fighter.name, rating: opponent.fighter.rating, bot: opponent.bot },
      roundsToWin: ROUNDS_TO_WIN
    });
    if (this.over) return;
    if (!this.started) {
      if (this.humans().every((human) => human.send)) {
        this.started = true;
        this.beginRound();
      }
      return;
    }
    if (this.roundOpen) this.sendRound(seat);
  }
  /** A player's socket closed. They have RECONNECT_MS to come back before it counts as leaving. */
  detach(playerId) {
    const seat = this.seatOf(playerId);
    if (!seat || this.over) return;
    seat.send = null;
    seat.dropTimer?.();
    if (!this.started) {
      seat.dropTimer = this.clock.after(RECONNECT_MS, () => this.finish(null, false, true));
      return;
    }
    seat.dropTimer = this.clock.after(RECONNECT_MS, () => this.forfeit(seat));
  }
  receive(playerId, message) {
    const seat = this.seatOf(playerId);
    if (!seat || this.over) return;
    if (message.type === "leave") {
      this.forfeit(seat);
      return;
    }
    if (message.type !== "done" || !this.roundOpen || message.round !== this.round) return;
    const now = this.clock.now();
    if (now < this.startAt) {
      seat.send?.({ type: "rejected", reason: "too early" });
      return;
    }
    const elapsed = now - this.startAt;
    const problem = verifyPlayedPath(this.levels[this.round - 1], message.path, elapsed);
    if (problem) {
      seat.send?.({ type: "rejected", reason: problem });
      return;
    }
    this.endRound(seat, elapsed);
  }
  sendRound(seat) {
    seat.send?.({
      type: "round",
      round: this.round,
      levelId: this.levels[this.round - 1],
      startsInMs: Math.max(0, this.startAt - this.clock.now()),
      limitMs: ROUND_LIMIT_MS,
      score: this.scoreFor(seat)
    });
  }
  scoreFor(seat) {
    return { you: seat.wins, opponent: this.opponentOf(seat).wins };
  }
  beginRound() {
    this.round++;
    this.roundOpen = true;
    this.startAt = this.clock.now() + COUNTDOWN_MS;
    this.seats.forEach((seat) => this.sendRound(seat));
    const level = generateLevel(this.levels[this.round - 1]);
    const bot = this.seats.find((seat) => seat.bot);
    if (bot) {
      const botMs = Math.min(ROUND_LIMIT_MS - 1e4, (2500 + level.nodes.length * 650) * (0.7 + this.rng() * 0.9));
      const round2 = this.round;
      this.timers.push(this.clock.after(COUNTDOWN_MS + botMs, () => {
        if (this.roundOpen && this.round === round2) this.endRound(bot, botMs);
      }));
    }
    const round = this.round;
    this.timers.push(this.clock.after(COUNTDOWN_MS + ROUND_LIMIT_MS, () => {
      if (this.roundOpen && this.round === round) this.endRound(null, ROUND_LIMIT_MS);
    }));
  }
  endRound(winner, elapsedMs) {
    this.roundOpen = false;
    if (winner) winner.wins++;
    this.broadcast((seat, opponent) => ({
      type: "roundResult",
      round: this.round,
      winner: winner === null ? "none" : winner === seat ? "you" : "opponent",
      timeMs: Math.round(elapsedMs),
      score: { you: seat.wins, opponent: opponent.wins }
    }));
    const leader = this.seats.find((seat) => seat.wins >= ROUNDS_TO_WIN);
    if (leader) {
      this.finish(leader, false, false);
      return;
    }
    if (this.round >= MAX_ROUNDS) {
      const [a, b] = this.seats;
      this.finish(a.wins === b.wins ? null : a.wins > b.wins ? a : b, false, false);
      return;
    }
    this.timers.push(this.clock.after(BETWEEN_ROUNDS_MS, () => this.beginRound()));
  }
  forfeit(leaver) {
    if (this.over) return;
    this.finish(this.opponentOf(leaver), true, false);
  }
  /** `winner` null with `cancelled` means the match never really happened: no rating change. */
  finish(winner, forfeit, cancelled) {
    if (this.over) return;
    this.over = true;
    this.roundOpen = false;
    this.timers.forEach((cancel) => cancel());
    this.seats.forEach((seat) => seat.dropTimer?.());
    const deltas = /* @__PURE__ */ new Map();
    if (!cancelled) {
      const humans = this.humans();
      if (this.vsBot) {
        const human = humans[0];
        const won = winner === human;
        deltas.set(human.fighter.id, won && human.fighter.rating < BOT_RATING_CEILING ? BOT_WIN_POINTS : 0);
      } else {
        const [a, b] = humans;
        const scoreA = winner === null ? 0.5 : winner === a ? 1 : 0;
        deltas.set(a.fighter.id, eloDelta(a.fighter.rating, b.fighter.rating, scoreA));
        deltas.set(b.fighter.id, eloDelta(b.fighter.rating, a.fighter.rating, 1 - scoreA));
      }
    }
    const players = this.humans().map((seat) => {
      const rating = Math.max(MIN_RATING, seat.fighter.rating + (deltas.get(seat.fighter.id) ?? 0));
      return { id: seat.fighter.id, name: seat.fighter.name, rating, delta: rating - seat.fighter.rating };
    });
    const humanWinner = winner && !winner.bot ? winner.fighter.id : null;
    this.seats.forEach((seat) => {
      const mine = players.find((player) => player.id === seat.fighter.id);
      seat.send?.({
        type: "matchResult",
        winner: cancelled ? "cancelled" : winner === null ? "draw" : winner === seat ? "you" : "opponent",
        forfeit,
        rating: mine?.rating ?? seat.fighter.rating,
        ratingDelta: mine?.delta ?? 0,
        score: this.scoreFor(seat)
      });
    });
    if (!cancelled) this.onFinished({ winnerId: humanWinner, vsBot: this.vsBot, forfeit, players });
  }
};

// src/store.ts
function d1Store(db) {
  const better = /* @__PURE__ */ __name((order) => order === "low" ? "<" : ">", "better");
  const direction = /* @__PURE__ */ __name((order) => order === "low" ? "ASC" : "DESC", "direction");
  return {
    async upsert(board, playerId, name, value, order, now) {
      await db.prepare(
        `INSERT INTO scores (board, player_id, name, value, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(board, player_id) DO UPDATE SET
             name = excluded.name,
             value = CASE WHEN excluded.value ${better(order)} scores.value THEN excluded.value ELSE scores.value END,
             updated_at = excluded.updated_at`
      ).bind(board, playerId, name, value, now).run();
    },
    async top(board, order, limit) {
      const { results } = await db.prepare(`SELECT player_id AS playerId, name, value FROM scores WHERE board = ?1 ORDER BY value ${direction(order)}, updated_at ASC LIMIT ?2`).bind(board, limit).all();
      return results;
    },
    async getRating(playerId) {
      return db.prepare("SELECT rating, wins, losses FROM ratings WHERE player_id = ?1").bind(playerId).first();
    },
    async saveMatch(player, now) {
      await db.prepare(
        `INSERT INTO ratings (player_id, name, rating, wins, losses, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(player_id) DO UPDATE SET
             name = excluded.name, rating = excluded.rating,
             wins = ratings.wins + ?4, losses = ratings.losses + ?5, updated_at = excluded.updated_at`
      ).bind(player.id, player.name, player.rating, player.outcome === "win" ? 1 : 0, player.outcome === "loss" ? 1 : 0, now).run();
    },
    async topRatings(limit) {
      const { results } = await db.prepare("SELECT player_id AS playerId, name, rating AS value FROM ratings ORDER BY rating DESC, updated_at ASC LIMIT ?1").bind(limit).all();
      return results;
    },
    async rankRating(playerId) {
      const mine = await db.prepare("SELECT rating FROM ratings WHERE player_id = ?1").bind(playerId).first();
      if (!mine) return null;
      const ahead = await db.prepare("SELECT COUNT(*) AS n FROM ratings WHERE rating > ?1").bind(mine.rating).first();
      return { rank: (ahead?.n ?? 0) + 1, value: mine.rating };
    },
    async rank(board, playerId, order) {
      const mine = await db.prepare("SELECT value FROM scores WHERE board = ?1 AND player_id = ?2").bind(board, playerId).first();
      if (!mine) return null;
      const ahead = await db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE board = ?1 AND value ${better(order)} ?2`).bind(board, mine.value).first();
      return { rank: (ahead?.n ?? 0) + 1, value: mine.value };
    }
  };
}
__name(d1Store, "d1Store");

// src/rooms.ts
var BOT_AFTER_MS = 18e3;
var BASE_WINDOW = 150;
var WINDOW_PER_SECOND = 20;
var upgrade = /* @__PURE__ */ __name(() => {
  const pair = new WebSocketPair();
  return { client: pair[0], server: pair[1] };
}, "upgrade");
var asJson = /* @__PURE__ */ __name((data) => {
  try {
    const parsed = JSON.parse(String(data));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}, "asJson");
var Lobby = class {
  constructor(_state, env) {
    this.env = env;
  }
  env;
  static {
    __name(this, "Lobby");
  }
  waiting = [];
  async fetch() {
    const { client, server } = upgrade();
    server.accept();
    server.addEventListener("message", (event) => void this.onMessage(server, event.data));
    server.addEventListener("close", () => this.drop(server));
    server.addEventListener("error", () => this.drop(server));
    return new Response(null, { status: 101, webSocket: client });
  }
  drop(socket) {
    const entry = this.waiting.find((item) => item.socket === socket);
    if (!entry) return;
    clearTimeout(entry.botTimer);
    this.waiting = this.waiting.filter((item) => item !== entry);
  }
  async onMessage(socket, data) {
    const message = asJson(data);
    if (!message) return;
    if (message.type === "cancel") {
      this.drop(socket);
      return;
    }
    if (message.type !== "queue" || this.waiting.some((item) => item.socket === socket)) return;
    if (!isPlayerId(message.playerId) || !isGeneratedName(message.name)) {
      socket.send(JSON.stringify({ type: "error", reason: "invalid player" }));
      socket.close(1008, "invalid player");
      return;
    }
    const saved = await d1Store(this.env.DB).getRating(message.playerId);
    this.waiting.filter((item) => item.fighter.id === message.playerId).forEach((item) => {
      item.socket.send(JSON.stringify({ type: "error", reason: "queued elsewhere" }));
      item.socket.close(1e3, "queued elsewhere");
      this.drop(item.socket);
    });
    const fighter = { id: message.playerId, name: message.name, rating: saved?.rating ?? START_RATING };
    const entry = {
      socket,
      fighter,
      since: Date.now(),
      botTimer: setTimeout(() => void this.startBot(entry), BOT_AFTER_MS)
    };
    this.waiting.push(entry);
    socket.send(JSON.stringify({ type: "queued", rating: fighter.rating, botAfterMs: BOT_AFTER_MS }));
    await this.pairUp();
  }
  /** Pairs the two closest ratings that fall inside each other's (widening) window. */
  async pairUp() {
    const now = Date.now();
    for (const first of this.waiting) {
      for (const second of this.waiting) {
        if (first === second) continue;
        const window = /* @__PURE__ */ __name((item) => BASE_WINDOW + (now - item.since) / 1e3 * WINDOW_PER_SECOND, "window");
        const gap = Math.abs(first.fighter.rating - second.fighter.rating);
        if (gap <= window(first) && gap <= window(second)) {
          await this.startMatch([first, second], false);
          return;
        }
      }
    }
  }
  async startBot(entry) {
    if (!this.waiting.includes(entry)) return;
    await this.startMatch([entry], true);
  }
  async startMatch(entries, vsBot) {
    entries.forEach((entry) => {
      clearTimeout(entry.botTimer);
      this.waiting = this.waiting.filter((item) => item !== entry);
    });
    const matchId = crypto.randomUUID();
    await this.env.ARENA.get(this.env.ARENA.idFromName(matchId)).fetch("https://arena/init", {
      method: "POST",
      body: JSON.stringify({ players: entries.map((entry) => entry.fighter), vsBot })
    });
    entries.forEach((entry) => {
      entry.socket.send(JSON.stringify({ type: "matched", matchId, vsBot }));
      entry.socket.close(1e3, "matched");
    });
  }
};
var Arena = class {
  constructor(_state, env) {
    this.env = env;
  }
  env;
  static {
    __name(this, "Arena");
  }
  match = null;
  sockets = /* @__PURE__ */ new Set();
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json();
      this.match = new Match(
        body.players,
        body.vsBot,
        { now: /* @__PURE__ */ __name(() => Date.now(), "now"), after: /* @__PURE__ */ __name((ms, fn) => {
          const id = setTimeout(fn, ms);
          return () => clearTimeout(id);
        }, "after") },
        Math.random,
        (result) => void this.record(result)
      );
      return new Response("ok");
    }
    const match = this.match;
    const { client, server } = upgrade();
    server.accept();
    this.sockets.add(server);
    let playerId = null;
    const send = /* @__PURE__ */ __name((message) => server.send(JSON.stringify(message)), "send");
    server.addEventListener("message", (event) => {
      const message = asJson(event.data);
      if (!message || !match) return;
      if (message.type === "hello" && !playerId && isPlayerId(message.playerId)) {
        playerId = message.playerId;
        match.attach(playerId, send);
        return;
      }
      if (playerId) match.receive(playerId, message);
    });
    const gone = /* @__PURE__ */ __name(() => {
      this.sockets.delete(server);
      if (match && playerId) match.detach(playerId);
    }, "gone");
    server.addEventListener("close", gone);
    server.addEventListener("error", gone);
    if (!match) {
      send({ type: "error", reason: "match not found" });
      server.close(1008, "match not found");
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  async record(result) {
    const store = d1Store(this.env.DB);
    const now = Date.now();
    for (const player of result.players) {
      const outcome = result.winnerId === null ? "draw" : result.winnerId === player.id ? "win" : "loss";
      await store.saveMatch({ id: player.id, name: player.name, rating: player.rating, outcome }, now).catch(() => void 0);
    }
    setTimeout(() => this.sockets.forEach((socket) => socket.close(1e3, "finished")), 3e3);
  }
};

// src/index.ts
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
var json = /* @__PURE__ */ __name((status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } }), "json");
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const now = /* @__PURE__ */ new Date();
    if (url.pathname === "/ws/queue" || url.pathname.startsWith("/ws/arena/")) {
      if (request.headers.get("upgrade") !== "websocket") return json(426, { error: "websocket required" });
      if (url.pathname === "/ws/queue") return env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch(request);
      const matchId = url.pathname.slice("/ws/arena/".length);
      if (!/^[0-9a-f-]{36}$/.test(matchId)) return json(400, { error: "bad match id" });
      return env.ARENA.get(env.ARENA.idFromName(matchId)).fetch(request);
    }
    const store = d1Store(env.DB);
    try {
      if (request.method === "POST" && url.pathname === "/score") {
        const reply = await handleSubmit(await request.json().catch(() => null), store, now);
        return json(reply.status, reply.body);
      }
      if (request.method === "GET" && url.pathname === "/top") {
        const reply = await handleTop(
          url.searchParams.get("board"),
          url.searchParams.get("playerId"),
          url.searchParams.get("dateKey"),
          store,
          now
        );
        return json(reply.status, reply.body);
      }
    } catch {
      return json(500, { error: "server error" });
    }
    return json(404, { error: "not found" });
  }
};

// C:/Users/Admin/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/Admin/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-JEslMV/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// C:/Users/Admin/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-JEslMV/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Arena,
  Lobby,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
