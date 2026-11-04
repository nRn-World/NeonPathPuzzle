/**
 * Generates PRIVACY_POLICY.md from the same structured document the in-game
 * privacy page renders. Run `npm run privacy:sync` after editing
 * `client/src/lib/privacyPolicy.ts`; CI runs `--check` and fails on drift.
 */
import { readFile, writeFile } from "fs/promises";
import { policyDocs, PRIVACY_UPDATED } from "../client/src/lib/privacyPolicy";

const TARGET = new URL("../PRIVACY_POLICY.md", import.meta.url);

function render(): string {
  const doc = policyDocs.en;
  const lines = [
    "# Privacy Policy for Neon Path Puzzle",
    "",
    `Last updated: ${PRIVACY_UPDATED}`,
    "",
    doc.intro,
    "",
    ...doc.sections.flatMap(section => [`## ${section.heading}`, "", section.body, ""]),
    `## Contact`,
    "",
    doc.contact,
    "",
    "Translations of this policy are shown in the game's Privacy page in English, Swedish, Turkish and Spanish.",
    "",
  ];
  return lines.join("\n");
}

const expected = render();
if (process.argv.includes("--check")) {
  const actual = await readFile(TARGET, "utf-8");
  if (actual !== expected) {
    console.error("PRIVACY_POLICY.md is out of date — run npm run privacy:sync");
    process.exitCode = 1;
  } else {
    console.log("PRIVACY_POLICY.md is in sync with the in-game policy.");
  }
} else {
  await writeFile(TARGET, expected, "utf-8");
  console.log("Wrote PRIVACY_POLICY.md");
}
