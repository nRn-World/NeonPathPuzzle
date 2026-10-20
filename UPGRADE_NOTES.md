# Neon Path Puzzle 2.0 — Build Notes

This update implements most of the suggested modernization pass directly in the existing React/Canvas game.

## Shipped

### Progression
- Versioned `ProgressData` v2 store with automatic migration from the old `{ completed, hints }` format
- Per-level records: stars, best time, best moves, best mistakes, hints used
- Continue level, total stars, completion count, tutorial flag, daily state
- Compatibility fix: completed levels remain playable even when their sequence is otherwise locked

### Gameplay
- Removed lives and the game-over screen; backtracks are capped at three per level
- Up to three backtracks via drag, Backspace, Ctrl/Cmd+Z, and a header button, with the remaining count in the header
- Restart button and replay from the win screen
- Live level timer with Time Freeze support
- Par time and 1–3 star scoring
- Keyboard controls with arrow keys
- Interpolated pointer samples so fast swipes cannot skip nodes
- Canvas renderer rewritten around `requestAnimationFrame`:
  - animated energy trail
  - pulsing head and node sparks
  - celebration rings on completion
  - high-DPI transform reset (fixes compounding DPR scaling)
- Reduced-motion mode disables particles, pulses, dash motion, and confetti

### Meta & UI
- Start menu Continue CTA, chapter entry, completed-level browser, stats, theme, settings, and tutorial
- 8-chapter level board with per-chapter stars and progress
- Daily Challenge route (`#/daily`), deterministic daily level, streak tracking, and share card
- Daily clears are isolated from campaign completion
- Power-ups awarded every fifth new level
- Path Reveal now really shows the solution for 5 seconds
- Time Freeze pauses the visible timer
- Undo Shield now protects a star instead of a life
- Theme locks at 10 / 50 / 100 / 200 completed levels
- Settings dialog: sound, haptics, reduced motion (persisted)
- First-run three-step tutorial
- Achievement unlock toasts

### Accessibility
- Canvas is a focusable `role="application"` with an ARIA label
- Live region announces `N of M nodes connected`
- Keyboard support and visible focus styles
- Reduced-motion preference is applied on load and at runtime
- Dialogs expose accessible roles and labels

## Verification

Run from the repository root:

```bash
npx tsc --noEmit
npm test
npm run build
```

Verified result at hand-off:

- TypeScript: clean
- Tests: 41 passing (level codes, level generator, mechanics, scoring, daily, progress, backup, weekly, custom levels)
- Production build: successful (`dist/public`)

Browser checks against the production build served locally:

- First-run tutorial, start menu, Continue CTA
- Level 1 solved with keyboard; win dialog, stars, best time, score
- Free undo and a one-backtrack run correctly recorded 2 stars
- Campaign completion isolated from Daily Challenge completion
- Daily clear, streak of 1, share button producing a PNG
- Chapter board, chapter progress, stars
- Stats tab and Continue link
- Settings persisted and `reduce-motion` class applied
- Theme selector locks with completion requirements

## Round 2 — UX, trust and retention pass

The second pass focused on the places where a polished campaign still leaks excitement: unfair timers, invisible progress, dead ends in a 200-level grid, and save data that only lived on one device.

1. **Timer integrity** — the clock auto-pauses when the tab or native app goes to the background, with a resume overlay. Switching away can no longer burn a three-star run.
2. **Live par time** — the header shows `time / par` and turns amber once par is passed, so the star window is never a mystery.
3. **Visible node progress** — a one-pixel gradient bar under the header fills as nodes connect, mirrored by an ARIA progress bar.
4. **Best score per level** — records now store `bestScore`; replays can only improve it. Stats adds total score and best single-level score, and the win dialog calls out new score records.
5. **Progress backup** — Settings exports and restores a validated JSON save (progress, achievements, power-ups, theme). Malformed files are rejected before anything is overwritten.
6. **Daily history and countdown** — the daily card shows the last seven days at a glance plus a live `Hh MMm left` countdown to the next puzzle.
7. **Share every clear** — the result card works for campaign levels too, not only the daily challenge.
8. **Keyboard workflow** — `H` hint, `R` restart, `Z`/`U` undo, `P`/`Esc` pause, plus a shortcuts dialog in the header.
9. **Jump to level** — a numeric jump field with lock validation replaces scrolling through 25-card chapters.
10. **Chapter filters** — All / Unsolved / Needs 3★ make star cleanup and completion runs fast, with an empty-state message when a filter is done.

### Round 2 verification

- `npx tsc --noEmit`, `npm test` (29 passing), `npm run build` all clean
- Production build served locally and exercised in the browser:
  - pause overlay from `P`; timer frozen across a 3-second sample
  - background-tab pause path fired from a synthetic `visibilitychange`
  - level 2 solved via arrow keys; win dialog stored `bestScore: 2100` and showed the share button
  - Settings showed the backup section; a crafted save restored 5 levels, a best score, and the Matrix theme, reloaded, and kept data after rejecting a broken file
  - chapter filters returned only matching levels; jumping to 199 was blocked with a lock message

## Round 3 — Depth, modes and reach

The third pass implements the ten follow-up ideas end to end. All mechanics are additive and derived from each level's canonical solution, so the original 200-level guarantees still hold.

1. **Star explanations** — the win dialog lists every lost star (hint, backtrack, over par), celebrates flawless runs, and is driven by an explicit `flawless` flag so translations cannot misclassify it.
2. **Render pause + DPR cap** — the canvas stops its `requestAnimationFrame` loop while paused or backgrounded and caps device pixel ratio at 2.
3. **Mechanics 2.0** — walls, one-way nodes, ordered color pairs, optional portals and boss levels. A shared `getLevelMechanics` generator is tested against all 200 canonical solutions; `mirrorLevel` powers the weekly mirror.
4. **Zen mode** — `/zen/:id` (or the Practice toggle) plays any unlocked level with no timer, stars, achievements or records; hints are free.
5. **Hint tokens** — persisted economy replacing the permanent star penalty. Spend one token per hint; earn from daily/weekly clears, every tenth new level and achievements. Settings shows the balance.
6. **Weekly challenges** — ISO-week seed, rotating modifiers (mirror, no-undo, time attack, no hints), best-result storage, countdown card and token reward.
7. **Ghost paths** — `bestPath` is stored with the fastest run and rendered as a faint dashed trace; toggle in Settings.
8. **Circuit editor** — draw, validate, save and share custom circuits as base64url links under `/custom/:code`; custom runs never touch campaign progress.
9. **PWA** — manifest link, real 512px PNG icon, service worker with network-first navigation and runtime asset caching, and guarded registration outside Capacitor.
10. **Localization** — persisted `sv`/`en` dictionaries with browser-language detection, a Settings switch, translated navigation, settings, daily/weekly cards, game HUD, pause overlay, win dialog, chapter filters and editor.

### Round 3 verification

- TypeScript clean, **41 tests passing**, production build successful
- Browser checks against the production build:
  - level 100 (61 nodes, one-way + color pairs, boss) solved with the canonical path; boss badge, symbol legend and par multiplier visible
  - level 101 shows the portal legend
  - daily level 89 cleared; result stored, streak 1, token granted
  - weekly level 163 cleared with time attack; result stored under `2026-W43`
  - zen level 50 hides timer/stars, does not consume a hint token
  - editor drew a 5-node circuit, generated a code, played it at `/custom/...`, won and copied the link
  - paid hint consumed a token, still awarded **3 stars**, stored `hintsUsed: true` and the 9-point ghost path
  - language switched sv → en → sv and persisted
  - service worker cached shell + hashed assets; the game loaded and rendered after the static server was stopped, then the server was restarted

## Difficulty pass — a campaign that never goes backwards

Random candidate selection could occasionally produce a wide-open corridor, so a later, larger board felt easier than an earlier one. Level selection now follows an explicit, precomputed plan:

- `getLevelDifficulty` scores each layout as **node count + branching edges** (adjacent cells that are not consecutive steps).
- A precomputed variant table picks the layout for every level so that score never decreases from one level to the next.
- Levels 1–3 and 10–12 were reshaped slightly to keep the early ramp collision-free.
- Old ghost paths from layouts that no longer exist are ignored instead of drawn over the new board.
- Tests cover per-level monotonic difficulty, a branching floor after the tutorial, and ghost-path validation.

Verified: TypeScript clean, **44 tests passing**, production build successful; levels 24 (22 nodes) and 100 (61 nodes, boss + mechanics) solved in the browser with no console errors. The three-backtrack cap was exercised live: after three undos the header showed **0**, the fourth was ignored, and Restart restored the count to **3**.

## Level design rebuild — distinct silhouettes, measured difficulty

The campaign no longer grows by making the same board denser. Every level now has a designed silhouette, and the curve is driven by structure plus a solver check:

- **Twelve layout families** — serpentine, column serpentine, reverse serpentine, inward spiral, outward spiral, wander, hug, drift, turn, border, corner and weave. A deterministic family schedule rotates them, and neighbouring levels may never reuse one.
- **Boards stop around 65% coverage.** The old 10×10 endgame filled almost every cell, which forced the last fifty levels to be near-identical blobs. The campaign now grows from 3×3 to 12×12 while keeping large empty regions, so each board has its own readable shape.
- **Genuine difficulty score.** `getLevelDifficulty` now combines node count, real junctions, and trap pressure measured by running a deterministic greedy solver against the layout. Trap pressure fades in after the tutorial so a single unlucky greedy walk cannot make level 6 harder than level 60.
- **Steady progression.** Node count never shrinks; every 20-level block is harder than the previous one; the opening three levels and the last ten climb strictly, ending on a designed staircase with level 200 as the hardest board.
- **Uniqueness by construction.** Layouts are compared as bitmasks over all eight rotations and reflections, and must differ by a growing margin (12% of node count, capped at 12 cells). No two levels on the same grid are near-edits of each other.
- **Offline bake.** The variant table is still precomputed (`npx tsx script/level-table.ts --rebuild`) so a phone never pays for the search; the generator tests verify the baked result.

Verified in this pass: TypeScript clean, all tests green, production build successful, levels 1, 120, 199 and 200 rendered in the production build with no console errors; level 1 solved end-to-end with the canonical keyboard path.

## Intentionally not shipped

These need dedicated design/backend work and were left out rather than half-implemented:

1. **Cloud save / accounts** — requires a backend or managed auth service plus conflict resolution.
2. **Online leaderboards** — requires a server and anti-cheat/validation strategy. Ghost paths are stored locally per device.
3. **Music and an audio mixer** — sound effects are implemented and mutable; an ambient soundtrack still needs composition and licensing.
4. **Store A/B testing and marketing assets** — screenshots/trailer/icon variants are a Play Console workflow, not a code change.

## Known limitations

- The development server (`npm run dev`) could not start in this environment because the installed `better-sqlite3` native binary was built for a different Node ABI. The production build was verified instead with a static server.
- Daily share falls back to a PNG download on desktop; Web Share is used only where `navigator.canShare({ files })` is available.
- Only the time-attack weekly modifier was exercised live; mirror, no-undo and no-hints rotate in future weeks and are covered by unit tests and code review.
- The PWA was verified over localhost HTTP; the native install prompt and iOS Add-to-Home-Screen flow were not exercised.
- Localization covers navigation, HUD, result flows, settings, daily/weekly and the editor. Tutorial copy, achievement and power-up names, level flavor messages and the privacy page remain English.
- Progress remains local-first. Use Settings → Export save before clearing site/app storage; level codes are still level jumps, not backups.
