// Records trailer scenes from the local game, frame by frame on a frozen clock,
// so the footage is sharp and every animation plays at real speed.
//   node record.mjs <landscape|portrait> [scene...]
// Frames land in frames/<format>/<scene>/NNNN.jpg (30 fps). Needs the dev server on :5000.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:5000/";
const FPS = 30;
const FRAME = 1000 / FPS;
const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1620 } };
const format = process.argv[2] ?? "landscape";
const only = process.argv.slice(3);
const size = FORMATS[format];
const USER = "trailer-user-0000-0000-000000000000";

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Local storage for a player who has cleared `completed`, English, sound off. */
function storageFor(completed) {
  const record = id => ({ levelId: id, completed: true, stars: 3, bestTimeMs: 9000, bestMoves: 20, bestMistakes: 0, bestScore: 3000, bestPath: [], hintsUsed: 0 });
  return {
    one_line_user_id: USER,
    [`neon_path_progress_v2_${USER}`]: JSON.stringify({
      version: 2,
      completed,
      runCompleted: completed,
      attempts: {},
      crashes: 0,
      hints: [],
      records: Object.fromEntries(completed.map(id => [id, record(id)])),
    }),
    "neon-path-language": JSON.stringify({ state: { language: "en" }, version: 1 }),
    "neon-path-settings": JSON.stringify({ state: { soundEnabled: false, soundVolume: 0, reducedMotion: false }, version: 0 }),
  };
}

async function open(browser, completed) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  await context.addInitScript(entries => {
    if (sessionStorage.getItem("trailer-seeded")) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    sessionStorage.setItem("trailer-seeded", "1");
    // Seeded randomness: the same boards and particles on every run.
    let seed = 1337;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  }, storageFor(completed));
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-11-03T12:00:00") });
  return { context, page };
}

async function settle(page, ms) {
  for (let t = 0; t < ms; t += 100) {
    await page.clock.runFor(100);
    await page.waitForTimeout(15);
  }
}

class Recorder {
  constructor(page, scene) {
    this.page = page;
    this.dir = path.join("frames", format, scene);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.n = 0;
  }
  async frames(count) {
    for (let i = 0; i < count; i++) {
      await this.page.clock.runFor(FRAME);
      this.n++;
      await this.page.screenshot({ path: path.join(this.dir, `${String(this.n).padStart(4, "0")}.jpg`), type: "jpeg", quality: 95 });
    }
  }
  seconds(s) {
    return this.frames(Math.round(s * FPS));
  }
}

/** The board the game is showing, read from GameCanvas's props. */
async function boardInfo(page) {
  return page.evaluate(() => {
    const canvas = [...document.querySelectorAll("canvas")].find(c => c.className.includes("cursor-crosshair"));
    const key = Object.keys(canvas).find(k => k.startsWith("__reactFiber"));
    let fiber = canvas[key];
    while (fiber && !fiber.memoizedProps?.level?.nodes) fiber = fiber.return;
    const level = fiber.memoizedProps.level;
    const rect = canvas.getBoundingClientRect();
    return { level, rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } };
  });
}

/** Hamiltonian path over the nodes from the start (small boards only). */
function solve(level) {
  const keys = new Set(level.nodes.map(p => `${p.x},${p.y}`));
  keys.add(`${level.start.x},${level.start.y}`);
  const path = [level.start];
  const seen = new Set([`${level.start.x},${level.start.y}`]);
  const step = () => {
    if (path.length === keys.size) return true;
    const head = path[path.length - 1];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: head.x + dx, y: head.y + dy };
      const key = `${next.x},${next.y}`;
      if (!keys.has(key) || seen.has(key)) continue;
      seen.add(key);
      path.push(next);
      if (step()) return true;
      path.pop();
      seen.delete(key);
    }
    return false;
  };
  return step() ? path : null;
}

/** Drags `route` on the board, recording `framesPerNode` frames per step. */
async function drag(rec, page, route, framesPerNode, stopAfter = route.length) {
  const { level, rect } = await boardInfo(page);
  const cell = rect.w / level.gridSize;
  const at = p => [rect.x + cell * (p.x + 0.5), rect.y + cell * (p.y + 0.5)];
  await page.mouse.move(...at(route[0]));
  await page.mouse.down();
  for (const point of route.slice(1, stopAfter)) {
    await page.mouse.move(...at(point), { steps: 2 });
    await rec.frames(framesPerNode);
  }
  await page.mouse.up();
}

async function clickText(page, text) {
  await page.getByRole("button", { name: text }).first().click();
}

const scenes = {
  // A clean cover background: a nearly finished circuit, drawn slowly so no combo text shows.
  async cover(browser) {
    const { context, page } = await open(browser, range(1, 49));
    await page.goto(`${BASE}#/play/50`);
    await settle(page, 2500);
    const solution = (await (await fetch(`${BASE}api/levels/50/solution`)).json()).path;
    const { level, rect } = await boardInfo(page);
    const cell = rect.w / level.gridSize;
    const at = p => [rect.x + cell * (p.x + 0.5), rect.y + cell * (p.y + 0.5)];
    await page.mouse.move(...at(solution[0]));
    await page.mouse.down();
    for (const point of solution.slice(1, -1)) {
      await page.mouse.move(...at(point), { steps: 2 });
      await page.clock.runFor(420);
    }
    await page.clock.runFor(900);
    const rec = new Recorder(page, "cover");
    await rec.frames(1);
    await context.close();
  },

  // Hook → win → city: the last level of chapter 2, so the card says DISTRICT ONLINE.
  async campaign(browser) {
    const { context, page } = await open(browser, range(1, 49));
    await page.goto(`${BASE}#/play/50`);
    await settle(page, 2500);
    const solution = (await (await fetch(`${BASE}api/levels/50/solution`)).json()).path;
    const rec = new Recorder(page, "campaign");
    await rec.seconds(0.6);
    await drag(rec, page, solution, 3);
    await rec.seconds(4.4);
    await context.close();
  },

  // The menu with four lit districts.
  async menu(browser) {
    const { context, page } = await open(browser, range(1, 112));
    await page.goto(BASE);
    await settle(page, 3000);
    await page.evaluate(() => {
      const svg = [...document.querySelectorAll("svg")].find(s => s.querySelector("pattern"));
      svg.scrollIntoView({ block: "end" });
      window.scrollBy(0, 40);
    });
    await settle(page, 300);
    const rec = new Recorder(page, "menu");
    await rec.seconds(3.2);
    await context.close();
  },

  // Rift Survival with the current on: solve while it chases.
  async chase(browser) {
    const { context, page } = await open(browser, range(1, 112));
    await page.goto(`${BASE}#/survival`);
    await settle(page, 2000);
    await clickText(page, /Current chase|OFF/i);
    await settle(page, 200);
    await clickText(page, /start/i);
    await settle(page, 1200);
    const rec = new Recorder(page, "chase");
    const { level } = await boardInfo(page);
    await rec.seconds(0.4);
    await drag(rec, page, solve(level), 8);
    await rec.seconds(1.4);
    // A second board, drawn slower so the current visibly closes in.
    await settle(page, 800);
    const next = await boardInfo(page);
    await drag(rec, page, solve(next.level), 11);
    await rec.seconds(0.8);
    await context.close();
  },

  // Chain: solve one board, then the next one appears with walls from the line.
  async chain(browser) {
    const { context, page } = await open(browser, range(1, 112));
    await page.goto(`${BASE}#/chain`);
    await settle(page, 2000);
    await clickText(page, /start/i);
    await settle(page, 800);
    const rec = new Recorder(page, "chain");
    for (let board = 0; board < 2; board++) {
      const { level } = await boardInfo(page);
      await rec.seconds(0.4);
      await drag(rec, page, solve(level), 4);
      await rec.seconds(1.6);
    }
    await context.close();
  },

  // Three chapter atmospheres, a moment each.
  async atmospheres(browser) {
    const { context, page } = await open(browser, range(1, 200));
    const rec = new Recorder(page, "atmospheres");
    for (const id of [60, 90, 160]) {
      await page.goto(`${BASE}#/play/${id}`);
      await settle(page, 2500);
      const solution = (await (await fetch(`${BASE}api/levels/${id}/solution`)).json()).path;
      // Draw a few steps so the board is alive, not a still.
      await drag(rec, page, solution, 3, Math.min(solution.length - 1, 7));
      await rec.frames(6);
    }
    await context.close();
  },
};

const browser = await chromium.launch();
for (const [name, run] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue;
  const started = Date.now();
  await run(browser);
  console.log(`${format}/${name}: ${fs.readdirSync(path.join("frames", format, name)).length} frames, ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
await browser.close();
