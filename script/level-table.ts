/**
 * Prints the baked VARIANT_TABLE that lives in shared/level-generator.ts.
 *
 *   npx tsx script/level-table.ts            # patch: only re-search levels that break a rule
 *   npx tsx script/level-table.ts --rebuild  # rebuild: search every level from scratch
 *
 * Paste the printed block over the existing table, then run `npm run test:levels`.
 */
import { readFileSync } from "node:fs";

import { buildVariantTable, repairVariantTable } from "../shared/level-generator";

const SOURCE = new URL("../shared/level-generator.ts", import.meta.url);

function readBakedTable(): number[] {
  const match = readFileSync(SOURCE, "utf8").match(/const VARIANT_TABLE: number\[\] = \[([\s\S]*?)\];/);
  if (!match) throw new Error("Could not find VARIANT_TABLE in shared/level-generator.ts");

  return match[1]
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .map(Number);
}

const rebuild = process.argv.includes("--rebuild");
const current = rebuild ? [] : readBakedTable();

const started = Date.now();
const table = rebuild ? buildVariantTable() : repairVariantTable(current);
const elapsed = Date.now() - started;

const changed = table
  .map((value, index) => (value === current[index] ? null : `${index + 1}:${current[index] ?? "-"}->${value}`))
  .filter((entry): entry is string => entry !== null);

console.log(`// ${rebuild ? "rebuilt" : "patched"} in ${elapsed} ms, ${changed.length} entries changed`);
if (changed.length > 0) console.log(`// ${changed.join(" ")}`);
console.log("const VARIANT_TABLE: number[] = [");
for (let index = 0; index < table.length; index += 20) {
  console.log(`  ${table.slice(index, index + 20).join(", ")},`);
}
console.log("];");
