import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * Visual regression coverage: deterministic screenshots of every new screen,
 * plus a pixel-level guard against the bug where an invisible, dark, blurred
 * win backdrop stayed mounted over the *next* level. DOM assertions alone
 * cannot prove the board is actually bright enough to play.
 */
const OUTPUT = path.join(process.cwd(), "test-results", "visual");

async function shot(page: Page, name: string): Promise<Buffer> {
  await mkdir(OUTPUT, { recursive: true });
  const buffer = await page.screenshot({ path: path.join(OUTPUT, `${name}.png`) });
  expect(buffer.subarray(1, 4).toString(), `${name} is a PNG`).toBe("PNG");
  expect(buffer.byteLength, `${name} is not a blank/empty frame`).toBeGreaterThan(8_000);
  return buffer;
}

/** Decode a screenshot inside the browser so no native PNG library is needed. */
async function meanLuminance(page: Page, buffer: Buffer): Promise<number> {
  const url = `data:image/png;base64,${buffer.toString("base64")}`;
  return page.evaluate(async (dataUrl: string) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d");
    if (!context) return -1;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      sum += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
      count += 1;
    }
    return sum / count;
  }, url);
}

async function openLevelOne(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Neon Path", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click({ timeout: 5_000 }).catch(() => {});
  await page.getByRole("button", { name: "Start game" }).click();
  const board = page.getByRole("application");
  await expect(board).toBeVisible();
  await board.focus();
  return board;
}

test("screenshots of the new screens render real content", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/#/lab/AQMCAjkBphc");
  await expect(page.getByRole("heading", { name: /circuit lab/i })).toBeVisible();
  await page.waitForTimeout(450);
  await shot(page, "circuit-lab");

  await page.goto("/#/rival/AgMCAjkBAAUIBQQDAAAAHOizTw");
  await expect(page.getByRole("heading", { name: /ghost challenge/i })).toBeVisible();
  await page.waitForTimeout(450);
  await shot(page, "rival-ghost");

  await page.goto("/#/insights");
  await expect(page.getByRole("heading", { name: /diagnostics/i })).toBeVisible();
  await page.waitForTimeout(450);
  await shot(page, "insights");

  await page.goto("/#/daily");
  await expect(page.getByRole("dialog", { name: /today's circuit/i })).toBeVisible();
  // The reveal fades in; capture the settled frame, not a half-transparent one.
  await page.waitForTimeout(700);
  await shot(page, "daily-ritual");

  expect(errors).toEqual([]);
});

test("the next level is as bright as the previous one (dark-overlay regression)", async ({ page }) => {
  const board = await openLevelOne(page);
  await page.waitForTimeout(250);
  const first = await shot(page, "level-1-baseline");
  const firstLuminance = await meanLuminance(page, first);
  expect(firstLuminance).toBeGreaterThan(0);

  for (const key of ["ArrowUp", "ArrowLeft", "ArrowLeft", "ArrowUp"]) await page.keyboard.press(key);
  await expect(page.getByTestId("win-modal-backdrop")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /next level/i }).click();
  await expect(page.getByTestId("win-modal-backdrop")).toHaveCount(0, { timeout: 5_000 });
  await expect(board).toBeVisible();
  // Let the chapter atmosphere and canvas settle after the route change.
  await page.waitForTimeout(450);

  const second = await shot(page, "level-2-after-next");
  const secondLuminance = await meanLuminance(page, second);
  // A 65 %-black backdrop over the board would drop this well below 60 %.
  expect(secondLuminance, `level 1=${firstLuminance.toFixed(1)}, level 2=${secondLuminance.toFixed(1)}`)
    .toBeGreaterThan(firstLuminance * 0.6);
});
