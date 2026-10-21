import { generateLevel, MAX_LEVEL_ID, type GeneratedLevel } from "./shared/level-generator";

const signature = (level: GeneratedLevel) =>
  `${level.gridSize}|${level.nodes.map(node => `${node.x},${node.y}`).join(";")}`;

function validate(level: GeneratedLevel) {
  const issues: string[] = [];
  const nodes = new Set(level.nodes.map(node => `${node.x},${node.y}`));
  const solution = new Set(level.solution.map(node => `${node.x},${node.y}`));
  if (nodes.size !== level.nodes.length) issues.push("duplicate nodes");
  if (solution.size !== level.solution.length) issues.push("solution repeats a node");
  if (level.solution.length !== level.nodes.length) issues.push("solution/node length mismatch");
  if (!nodes.has(`${level.start.x},${level.start.y}`)) issues.push("start is not a node");
  level.solution.forEach((point, index) => {
    if (point.x < 0 || point.x >= level.gridSize || point.y < 0 || point.y >= level.gridSize) {
      issues.push(`point ${index} is outside the grid`);
    }
    if (!nodes.has(`${point.x},${point.y}`)) issues.push(`point ${index} is not a node`);
    if (index > 0) {
      const previous = level.solution[index - 1];
      if (Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) !== 1) {
        issues.push(`invalid move at point ${index}`);
      }
    }
  });
  return issues;
}

const signatures = new Map<string, number>();
const duplicates: Array<[number, number]> = [];
const errors: Array<{ level: number; error: string }> = [];
let slowest = { level: 0, milliseconds: 0 };

for (let id = 1; id <= MAX_LEVEL_ID; id++) {
  try {
    const startedAt = performance.now();
    const level = generateLevel(id);
    const milliseconds = performance.now() - startedAt;
    if (milliseconds > slowest.milliseconds) slowest = { level: id, milliseconds };
    if (milliseconds > 1000) errors.push({ level: id, error: `generation took ${milliseconds.toFixed(1)}ms` });
    validate(level).forEach(error => errors.push({ level: id, error }));
    const levelSignature = signature(level);
    const duplicateOf = signatures.get(levelSignature);
    if (duplicateOf) duplicates.push([duplicateOf, id]);
    else signatures.set(levelSignature, id);
  } catch (error) {
    errors.push({ level: id, error: String(error) });
  }
}

console.log(`Generated and validated ${MAX_LEVEL_ID - new Set(errors.map(error => error.level)).size}/${MAX_LEVEL_ID} levels.`);
console.log(`Slowest level: ${slowest.level} (${slowest.milliseconds.toFixed(1)}ms).`);
console.log(duplicates.length ? `Duplicate pairs: ${JSON.stringify(duplicates)}` : "All node layouts are unique.");
if (errors.length) console.error("Validation errors:", errors);
if (errors.length || duplicates.length) process.exitCode = 1;
