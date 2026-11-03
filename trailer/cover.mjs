// Builds the three CrazyGames covers from the clean cover frame: title only, no other text.
//   node cover.mjs   ->  ../crazygames-upload/cover-{landscape,portrait,square}.png
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.resolve(".");
const frame = pathToFileURL(path.join(here, "frames/landscape/cover/0001.jpg")).href;
const font = pathToFileURL(path.resolve("../node_modules/@fontsource/orbitron/files/orbitron-latin-900-normal.woff2")).href;
const out = path.resolve("../crazygames-upload");
fs.mkdirSync(out, { recursive: true });

// The board sits at x 510-1410, y 97-1062 in the 1920x1080 frame.
const BOARD = { x: 510, y: 97, w: 900, h: 965 };

const sizes = {
  landscape: { width: 1920, height: 1080, layout: "row", board: 900, title: 190 },
  portrait: { width: 800, height: 1200, layout: "column", board: 700, title: 128 },
  square: { width: 800, height: 800, layout: "column", board: 560, title: 104 },
  // Opening frame of the portrait trailer (CrazyGames: 1080p at 2:3).
  "video-portrait": { width: 1080, height: 1620, layout: "column", board: 940, title: 172 },
};

const html = ({ width, height, layout, board, title }) => `<!doctype html><html><head><style>
@font-face { font-family: Orbitron; font-weight: 900; src: url(${font}); }
* { margin: 0; box-sizing: border-box; }
body { width: ${width}px; height: ${height}px; overflow: hidden; background:
  radial-gradient(ellipse at 70% 55%, rgba(0,243,255,.18), transparent 60%),
  radial-gradient(ellipse at 20% 20%, rgba(138,43,226,.22), transparent 55%), #070b18; }
.grid { position: absolute; inset: 0; background-image: radial-gradient(rgba(0,243,255,.16) 1px, transparent 1px); background-size: 28px 28px; }
.wrap { position: relative; height: 100%; display: flex; flex-direction: ${layout}; align-items: center; justify-content: center; gap: ${layout === "row" ? 70 : 34}px; padding: 40px; }
.title { font-family: Orbitron; font-weight: 900; font-size: ${title}px; line-height: .92; letter-spacing: -.02em; text-align: ${layout === "row" ? "left" : "center"}; }
.neon { color: #fff; text-shadow: 0 0 24px rgba(255,255,255,.35); }
.path { color: transparent; -webkit-text-stroke: ${Math.max(3, title / 34)}px #00f3ff; filter: drop-shadow(0 0 ${title / 9}px rgba(0,243,255,.9)); }
.board { width: ${board}px; aspect-ratio: ${BOARD.w} / ${BOARD.h}; flex: none; background: url(${frame}) no-repeat;
  background-size: ${(1920 / BOARD.w) * 100}% auto; background-position: ${(BOARD.x / (1920 - BOARD.w)) * 100}% ${(BOARD.y / (1080 - BOARD.h)) * 100}%;
  box-shadow: 0 0 80px rgba(0,243,255,.35), 0 0 0 2px rgba(0,243,255,.55); }
</style></head><body><div class="grid"></div><div class="wrap">
<div class="title"><div class="neon">NEON</div><div class="path">PATH</div></div>
<div class="board" style="${layout === "column" ? `height: ${height - title * 2 - 150}px; width: auto;` : ""}"></div>
</div></body></html>`;

const browser = await chromium.launch();
for (const [name, size] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
  const file = path.join(here, "frames", `cover-${name}.html`);
  fs.writeFileSync(file, html(size));
  await page.goto(pathToFileURL(file).href);
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `cover-${name}.png`) });
  await page.close();
  console.log(`cover-${name}.png ${size.width}x${size.height}`);
}
await browser.close();
