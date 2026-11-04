import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Real accessibility scanning in the browser, not just hand-written aria
 * assertions. Every critical/serious WCAG A/AA finding — including real text
 * contrast — fails the build; purely decorative pixels are covered by the
 * visual spec instead.
 */
const ROUTES = [
  ["menu", "/"],
  ["circuit lab", "/#/lab/AQMCAjkBphc"],
  ["ghost challenge", "/#/rival/AgMCAjkBAAUIBQQDAAAAHOizTw"],
  ["diagnostics", "/#/insights"],
  ["privacy", "/#/privacy"],
] as const;

for (const [name, route] of ROUTES) {
  test(`axe finds no critical or serious WCAG issues on ${name}`, async ({ page }) => {
    await page.goto(route);
    // Let lazy routes mount and any entry animations settle before scanning.
    await page.waitForTimeout(350);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations
      .filter(violation => violation.impact === "critical" || violation.impact === "serious")
      .map(violation => `${violation.id} (${violation.nodes.length} nodes: ${violation.nodes.slice(0, 2).map(node => node.target.join(" ")).join(", ")})`);
    expect(blocking).toEqual([]);
  });
}
