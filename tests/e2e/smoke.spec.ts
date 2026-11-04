import { test, expect } from "@playwright/test";

/** The app is hash-routed, so "/" and "/play/1" both work after a reload. */
async function openLevelOne(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Neon Path", level: 1 })).toBeVisible();

  // First run shows the interactive tutorial; it must be dismissible.
  await page.getByRole("button", { name: "Skip" }).click({ timeout: 5_000 }).catch(() => {});

  await page.getByRole("button", { name: "Start game" }).click();
  const board = page.getByRole("application");
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute("aria-label", /Puzzle grid/i);
  await board.focus();
  return board;
}

test("the menu loads, tutorial can be skipped and level 1 accepts keyboard input", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  const board = await openLevelOne(page);

  // The board has a DOM description of node coordinates for screen readers.
  await expect(board.locator("p.sr-only")).toContainText(/Nodes by row/i);

  await page.keyboard.press("ArrowUp");
  // The live status div is the authoritative connected-count announcement.
  await expect(board.locator("div.sr-only")).toContainText(/2 of 5 nodes connected/i);

  // Zoom must stay available (WCAG 1.4.4) and the app must not crash.
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport ?? "").not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
  expect(errors).toEqual([]);
});

test("the win overlay is gone before the next level is played", async ({ page }) => {
  // Regression: an exiting, pointer-transparent backdrop used to stay mounted
  // forever, leaving the next board dark and blurred with no visible dialog.
  await openLevelOne(page);
  for (const key of ["ArrowUp", "ArrowLeft", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.press(key);
  }
  const backdrop = page.getByTestId("win-modal-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /next level/i }).click();
  await expect(backdrop).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("application")).toBeVisible();
});

test("progress survives a reload", async ({ page }) => {
  await openLevelOne(page);
  // Level 1 solution: up, left, left, up.
  for (const key of ["ArrowUp", "ArrowLeft", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.press(key);
  }
  await expect(page.getByText(/cleared|perfect/i).first()).toBeVisible({ timeout: 10_000 });

  // Reload the game route, then go back to the menu: the clear must be there.
  await page.reload();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /continue/i }).first()).toBeVisible();
});
