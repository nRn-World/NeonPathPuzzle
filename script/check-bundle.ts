/**
 * Bundle-size budget. Fails CI when a dependency or a new feature makes the
 * first load noticeably heavier. Run after `npm run build`:
 *
 *   npm run check:bundle
 */
import { readdir, stat } from "fs/promises";
import path from "path";

const ASSETS = path.resolve(process.cwd(), "dist/public/assets");
const TOTAL_LIMIT = Number(process.env.BUNDLE_TOTAL_LIMIT ?? 2_500_000);
const FILE_LIMIT = Number(process.env.BUNDLE_FILE_LIMIT ?? 1_200_000);

async function main() {
  let files: string[];
  try {
    files = await readdir(ASSETS);
  } catch {
    console.error("No build output found — run npm run build first.");
    process.exitCode = 1;
    return;
  }
  const sizes = await Promise.all(files.map(async file => ({ file, bytes: (await stat(path.join(ASSETS, file))).size })));
  const total = sizes.reduce((sum, entry) => sum + entry.bytes, 0);
  const largest = sizes.sort((a, b) => b.bytes - a.bytes)[0];
  console.log(`Client bundle: ${(total / 1_000_000).toFixed(2)} MB in ${sizes.length} files`);
  console.log(`Largest chunk: ${largest.file} (${(largest.bytes / 1_000_000).toFixed(2)} MB)`);
  if (total > TOTAL_LIMIT || largest.bytes > FILE_LIMIT) {
    console.error(`Bundle budget exceeded: total ≤ ${TOTAL_LIMIT}, file ≤ ${FILE_LIMIT} bytes.`);
    process.exitCode = 1;
  } else {
    console.log("Bundle is within budget.");
  }
}

void main();
