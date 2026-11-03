// Fast bug hunt against the CrazyGames build (:5055). Solutions come from the dev API (:5000).
//   node qa.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:5055/";
const API = "http://localhost:5000/api/levels";
const USER = "qa-user-0000-0000-0000-000000000000";
const IGNORE = [/vibrate/i, /Failed to load resource.*(404|500)/i];
const found = [];
const note = (where, what) => {
  const line = `${where}: ${what}`;
  if (!found.includes(line)) found.push(line);
};

const seed = (completed) => {
  const record = id => ({ levelId: id, completed: true, stars: 3, bestTimeMs: 9000, bestMoves: 20, bestMistakes: 0, bestScore: 3000, bestPath: [], hintsUsed: 0 });
  return {
    one_line_user_id: USER,
    [`neon_path_progress_v2_${USER}`]: JSON.stringify({ version: 2, completed, runCompleted: completed, attempts: {}, crashes: 0, hints: [], records: Object.fromEntries(completed.map(id => [id, record(id)])) }),
    "neon-path-language": JSON.stringify({ state: { language: "en" }, version: 1 }),
    "neon-path-settings": JSON.stringify({ state: { soundEnabled: false, soundVolume: 0 }, version: 0 }),
  };
};

async function newPage(browser, viewport, completed, mobile) {
  const context = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await context.addInitScript(entries => {
    if (sessionStorage.getItem("qa-seeded")) return;
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
    sessionStorage.setItem("qa-seeded", "1");
  }, seed(completed));
  const page = await context.newPage();
  let where = "boot";
  page.setWhere = w => { where = w; };
  page.on("pageerror", err => note(where, `PAGE ERROR ${err.message.slice(0, 160)}`));
  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORE.some(re => re.test(text))) return;
    note(where, `console.error ${text.slice(0, 160)}`);
  });
  return { context, page };
}

const dismissOverlays = async page => {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole("button", { name: /^(skip|got it|continue|ok|start|let's go|dismiss)/i }).first();
    if (!(await skip.count()) || !(await skip.isVisible().catch(() => false))) return;
    await skip.click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(120);
  }
};

async function overflow(page, where) {
  const bad = await page.evaluate(() => {
    const vw = innerWidth;
    const out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}>${vw})`);
    for (const el of document.querySelectorAll('[role="dialog"], [role="dialog"] *')) {
      if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue; // the city band is clipped on purpose
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 2 || r.left < -2)) { out.push(`dialog child outside viewport: <${el.tagName.toLowerCase()}> ${(el.textContent || "").trim().slice(0, 30)}`); break; }
    }
    return out;
  });
  bad.forEach(b => note(where, b));
}

async function board(page) {
  return page.evaluate(() => {
    const canvas = [...document.querySelectorAll("canvas")].find(c => c.className.includes("cursor-crosshair"));
    if (!canvas) return null;
    const key = Object.keys(canvas).find(k => k.startsWith("__reactFiber"));
    let fiber = canvas[key];
    while (fiber && !fiber.memoizedProps?.level?.nodes) fiber = fiber.return;
    const r = canvas.getBoundingClientRect();
    return fiber ? { level: fiber.memoizedProps.level, rect: { x: r.left, y: r.top, w: r.width } } : null;
  });
}

async function drag(page, route) {
  let info = await board(page);
  // Wait until the board has stopped moving (entrance animation / resize) before touching it.
  for (let i = 0; i < 20 && info; i++) {
    await page.waitForTimeout(120);
    const next = await board(page);
    if (next && next.rect.x === info.rect.x && next.rect.y === info.rect.y && next.rect.w === info.rect.w) { info = next; break; }
    info = next;
  }
  if (!info) return false;
  // A zoomed board scrolls with the head, so pointer coordinates stop matching: use the arrow keys.
  if (page.viewportSize().width < 500 || info.rect.w / info.level.gridSize < 26) {
    await page.locator("canvas.cursor-crosshair").first().evaluate(el => (el.closest("[tabindex]") ?? el).focus());
    const keys = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
    for (let i = 1; i < route.length; i++) await page.keyboard.press(keys[`${route[i].x - route[i - 1].x},${route[i].y - route[i - 1].y}`]);
    return true;
  }
  const cell = info.rect.w / info.level.gridSize;
  const at = p => [info.rect.x + cell * (p.x + 0.5), info.rect.y + cell * (p.y + 0.5)];
  await page.mouse.move(...at(route[0]));
  await page.mouse.down();
  for (const p of route.slice(1)) await page.mouse.move(...at(p), { steps: 2 });
  await page.mouse.up();
  return true;
}

const winShown = page => page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(d => /cleared/i.test(d.textContent || "")), null, { timeout: 4500 }).then(() => true, () => false);

async function solveLevel(page, id, label) {
  page.setWhere(label);
  await dismissOverlays(page);
  const res = await fetch(`${API}/${id}/solution`);
  if (!res.ok) return note(label, `no solution from API (${res.status})`);
  const { path } = await res.json();
  if (!(await drag(page, path))) return note(label, "board canvas not found");
  if (!(await winShown(page))) {
    await page.screenshot({ path: `frames/qa-fail-${label.replace(/\W+/g, "-")}.png` });
    return note(label, `solved level ${id} but no win card within 4.5 s`);
  }
  await overflow(page, `${label} win card`);
}

const browser = await chromium.launch();
const t0 = Date.now();

// 1. Real playthrough, desktop: levels 1-30 in order from a fresh save.
{
  const { context, page } = await newPage(browser, { width: 1280, height: 720 }, [], false);
  await page.goto(`${BASE}#/`);
  await page.waitForTimeout(800);
  for (let id = 1; id <= 30; id++) {
    const label = `desktop play ${id}`;
    await page.goto(`${BASE}#/play/${id}`);
    await page.waitForTimeout(350);
    await solveLevel(page, id, label);
    await overflow(page, `${label} board`);
  }
  await context.close();
  console.log(`1/4 playthrough done ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.env.QA_ONLY === "1") {
  await browser.close();
  console.log(found.length ? "FOUND:\n" + found.join("\n") : "No problems found");
  process.exit(0);
}

// 2. Sample across all chapters on desktop and a phone, everything unlocked.
const everything = Array.from({ length: 300 }, (_, i) => i + 1);
const sample = [31, 49, 50, 51, 75, 76, 99, 100, 101, 125, 126, 150, 151, 175, 176, 199, 200, 201, 225, 226, 250, 251, 275, 276, 299, 300];
for (const [name, viewport, mobile] of [["desktop", { width: 1280, height: 720 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const { context, page } = await newPage(browser, viewport, everything, mobile);
  await page.goto(`${BASE}#/`);
  await page.waitForTimeout(800);
  await overflow(page, `${name} menu`);
  for (const id of sample) {
    await page.goto(`${BASE}#/play/${id}`);
    await page.waitForTimeout(300);
    await solveLevel(page, id, `${name} level ${id}`);
  }
  await context.close();
  console.log(`2/4 ${name} sample done ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// 3. Every other route loads cleanly on both sizes.
const routes = ["#/", "#/daily", "#/weekly", "#/zen/5", "#/rift/301", "#/rift/310", "#/survival", "#/chain", "#/duel", "#/privacy", "#/nope"];
for (const [name, viewport, mobile] of [["desktop", { width: 1280, height: 720 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const { context, page } = await newPage(browser, viewport, everything, mobile);
  for (const route of routes) {
    page.setWhere(`${name} ${route}`);
    await page.goto(`${BASE}${route}`);
    await page.waitForTimeout(700);
    await dismissOverlays(page);
    await overflow(page, `${name} ${route}`);
    const blank = await page.evaluate(() => (document.body.innerText || "").trim().length < 5 && !document.querySelector("canvas"));
    if (blank) note(`${name} ${route}`, "blank screen");
  }
  await context.close();
}
console.log(`3/4 routes done ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// 4. Survival with the current on, Chain, and the menu buttons on a phone.
{
  const { context, page } = await newPage(browser, { width: 390, height: 844 }, everything, true);
  page.setWhere("phone survival+chain");
  await page.goto(`${BASE}#/survival`);
  await page.waitForTimeout(600);
  for (const name of [/current/i, /start/i]) {
    const button = page.getByRole("button", { name }).first();
    if (await button.count()) await button.click().catch(e => note("phone survival", `click failed: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(6000); // let the current run: a heart should drop without crashing
  await overflow(page, "phone survival");
  await page.goto(`${BASE}#/chain`);
  await page.waitForTimeout(600);
  const start = page.getByRole("button", { name: /start/i }).first();
  if (await start.count()) await start.click();
  await page.waitForTimeout(600);
  await overflow(page, "phone chain");
  await context.close();
}

await browser.close();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(found.length ? "FOUND:\n" + found.map(f => " - " + f).join("\n") : "No problems found");
