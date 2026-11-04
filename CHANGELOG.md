# Changelog

All notable changes to Neon Path Puzzle. Entries are newest first; this file is
hand-maintained and ships with the source, so players can see exactly what a
build contains.

## Unreleased — 4 November 2026

### Seven premium features ("wow" round)

- **Cinematic power surge.** The last node now triggers a one-second beat before
  the result card: a slow camera push, a bright pulse running backwards along
  the finished line, a chapter-coloured shockwave, a heavy haptic thud and a
  resolve chord. The canvas keeps animating while input is locked, and reduced
  motion skips the camera work entirely.
- **A soundtrack identity per chapter.** Twelve profiles (roots through the
  circle of fifths, minor/major/suspended/Kumoi pentatonic scales, distinct
  chords and phrase lengths) replace the single shared scale. Dead ends add a
  short dissonant swell; clearing plays the chapter's chord. Switching chapter
  rebuilds the synth so the new key takes effect immediately.
- **Circuit Lab / Nivåverkstad** (`#/lab`). Draw your own board cell by cell,
  move the start, change the grid from 3×3 to 9×9, and get live solver feedback:
  *exactly one solution*, the number of solutions, or *no solution from this
  start*, plus a 0–100 difficulty score derived from DFS effort. Play the board
  in place, then copy a short checksum-protected link. Every link carries the
  whole board in the URL fragment — no server, no account.
- **Rival ghost** (`#/rival/<code>`). The win card can now copy a challenge link
  containing the exact board, the winning line and your time. The recipient sees
  a live pace delta against a ghost that runs once at your pace (not a looping
  animation), a result card saying who won, a replay button and a locally
  generated QR code so another device can scan the challenge.
- **Daily ritual.** A full-screen once-per-day reveal with a paused preview of
  the exact board, a 30-day calendar, a live countdown, streak shields and a
  streak counter. Shields are earned every seventh consecutive day (max three)
  and bridge a single missed day instead of resetting the streak; they survive
  save merges and are visible on the menu's daily card.
- **Real boss set pieces.** Levels 25, 50, …, 300 now combine rule families
  earlier than the campaign normally does (`walls → one-way → pairs → portals
  → sync → phase`), show a chapter-coloured briefing card the first time with
  the combo listed, wear a pulsing corner frame on the board, and end with the
  chapter-coloured surge plus a chapter-coloured resolve chord. All 300 levels
  are still proven solvable through the real move rules.
- **Pro polish.** Playwright now runs an axe WCAG A/AA scan on the menu, Lab,
  ghost race, diagnostics and privacy pages plus visual-regression screenshots
  of every new screen and a pixel-level luminance guard for the dark-overlay
  bug. An "Add to home screen" prompt surfaces the native install event, a
  diagnostics page shows/exports/erases the opt-in local event log, and this
  CHANGELOG documents the release. Contrast and keyboard-focus findings from
  axe were fixed in the menu, language picker and all new pages.

### Bug fixes

- **The next level is no longer dark.** `WinModal`'s backdrop used
  `usePresence()` without calling `safeToRemove()`, so `AnimatePresence` never
  unmounted a pointer-transparent, 65 %-black, blurred sheet. It now uses
  `useIsPresent()` and a synchronous close in `Game.resetTransientState`. An
  E2E regression asserts zero backdrops/dialogs after "Next level"; Replay and
  Menu were verified too.
- English copy accidentally written in Swedish in the win card was replaced
  with English.

### Ten improvement tips (earlier in this release)

1. Opt-in telemetry with an error boundary and a local event ring buffer.
2. The three-attempt "system crash" became an opt-in Hardcore setting.
3. Daily/weekly challenges use dedicated provably single-solution boards
   (18 unique layouts × 4 transforms = 72 slots) with solver-based difficulty
   and par-normalised pace scores.
4. Interactive first-run tutorial with a live line demo and contextual tips.
5. Graduated, solver-based hints that continue the player's current line.
6. A real Hamiltonian-path solver audits the campaign and powers difficulty.
7. Stars reward planning (no hints, no backtracks, no dead ends), not speed.
8. CI with real Playwright E2E, a bundle-size budget and the win-overlay
   regression guard.
9. One source of truth for the privacy policy; third-party SDKs load only in
   the matching portal build and ads require consent.
10. Pinch zoom, screen-readable board descriptions, translated affirmations
    and privacy pages.

### Verification commands

```bash
npm run check
npm test
npm run test:lab
npm run test:e2e          # needs Playwright browsers; runs in CI
npx tsx verify-levels.ts
npm run audit:uniqueness
npm run privacy:check
npm run build && npm run check:bundle
```

### Deployment notes

- `worker/schema.sql` must be re-run before deploying the worker that accepts
  `/telemetry`; client and worker should be deployed together.
- No GitHub push is part of this change set; it lives on the working branch.
