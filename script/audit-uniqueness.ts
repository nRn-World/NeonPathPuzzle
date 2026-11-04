/**
 * Puzzle-quality audit: how many campaign boards have exactly one solution,
 * and how much search effort each one costs. Run with:
 *
 *   npx tsx script/audit-uniqueness.ts
 *
 * Add `--strict` to fail when a known single-solution board regresses.
 */
import { generateLevel, MAX_LEVEL_ID } from "../shared/level-generator";
import { countSolutions } from "../shared/solver";
import { challengeDifficulty, UNIQUE_LEVEL_IDS } from "../shared/challenges";

const strict = process.argv.includes("--strict");
let unique = 0;
let multi = 0;
let unresolved = 0;
let totalExpanded = 0;
const regressions: number[] = [];
const report: string[] = [];

for (let id = 1; id <= MAX_LEVEL_ID; id++) {
  const level = generateLevel(id);
  const board = { id: level.id, gridSize: level.gridSize, start: level.start, nodes: level.nodes };
  const { count, incomplete, expanded } = countSolutions(level, { cap: 2, budget: 300_000 });
  totalExpanded += expanded;
  if (incomplete) unresolved += 1;
  else if (count === 1) unique += 1;
  else multi += 1;

  const expectUnique = UNIQUE_LEVEL_IDS.includes(id);
  if (expectUnique && (count !== 1 || incomplete)) regressions.push(id);
  const difficulty = expectUnique ? challengeDifficulty(id, board).score : null;
  report.push(`${id}\t${level.nodes.length}\t${incomplete ? "?" : String(count)}\t${expanded}\t${difficulty ?? "-"}`);
}

console.log(`Campaign puzzle audit (${MAX_LEVEL_ID} boards)`);
console.log(`  exactly one solution : ${unique}`);
console.log(`  multiple solutions   : ${multi}`);
console.log(`  search budget hit    : ${unresolved}`);
console.log(`  mean DFS nodes/board : ${Math.round(totalExpanded / MAX_LEVEL_ID)}`);
console.log(`  unique-board pool    : ${UNIQUE_LEVEL_IDS.length} boards × 4 transforms = ${UNIQUE_LEVEL_IDS.length * 4} challenges`);
console.log("\nlevel\tnodes\tsolutions\tsearchNodes\tchallengeDifficulty");
console.log(report.join("\n"));

if (strict && regressions.length) {
  console.error(`\nUniqueness regression on levels: ${regressions.join(", ")}`);
  process.exitCode = 1;
}
