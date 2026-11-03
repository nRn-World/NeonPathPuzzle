// Renders the social-media captions and end card as transparent PNGs in the game's font.
//   node captions.mjs <landscape|portrait>  ->  frames/<format>/captions/*.png
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const format = process.argv[2] ?? "landscape";
const size = format === "portrait" ? { width: 1080, height: 1620 } : { width: 1920, height: 1080 };
const font = pathToFileURL(path.resolve("../node_modules/@fontsource/orbitron/files/orbitron-latin-900-normal.woff2")).href;
const dir = path.resolve("frames", format, "captions");
fs.mkdirSync(dir, { recursive: true });

export const CAPTIONS = {
  oneline: "ONE LINE.",
  everynode: "EVERY NODE.",
  city: "POWER THE CITY.",
  current: "OUTRUN THE CURRENT.",
  chain: "YOUR LINE BUILDS THE NEXT.",
  url: "nrnworld.one",
};

const scale = format === "portrait" ? 0.8 : 1;
const html = text => `<!doctype html><html><head><style>
@font-face { font-family: Orbitron; font-weight: 900; src: url(${font}); }
html, body { margin: 0; background: transparent; }
body { width: ${size.width}px; height: ${size.height}px; display: flex; justify-content: center; align-items: ${text === CAPTIONS.url || text === CAPTIONS.city ? "flex-end" : "flex-start"}; }
.cap { margin: ${Math.round(120 * scale)}px 0; padding: ${Math.round(18 * scale)}px ${Math.round(38 * scale)}px; font: 900 ${Math.round(72 * scale)}px Orbitron; letter-spacing: .04em; color: #fff;
  background: rgba(5,8,20,.78); border: 2px solid #00f3ff; box-shadow: 0 0 40px rgba(0,243,255,.45); text-shadow: 0 0 18px rgba(0,243,255,.8); }
</style></head><body><div class="cap">${text}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: size });
for (const [name, text] of Object.entries(CAPTIONS)) {
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, html(text));
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, `${name}.png`), omitBackground: true });
}
await browser.close();
console.log(`${format}: ${Object.keys(CAPTIONS).length} captions`);
