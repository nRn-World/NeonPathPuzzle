# Neon Path Puzzle — Features

## Overview

**Neon Path Puzzle** is a cyber-logic puzzle game where players connect every node with a single continuous line. It combines neon aesthetics, short satisfying runs, and a long 300-level campaign.

---

## Core Gameplay

- **Objective**: Connect every node on the grid with one continuous path
- **Rules**:
  - Visit every node exactly once
  - Move only up, down, left, or right
  - The path may not cross or repeat itself
- **Three backtracks per level**: Drag backwards, press Backspace / Ctrl+Z, or use the undo button — up to three times per level. Backtracks cost a star.
- **Three attempts per new level**: The first try plus two restarts. An attempt starts with the first move, so opening and studying a board is free. Leaving mid-attempt does not refund it.
- **System crash**: Fail the third attempt and the run crashes back to level 1. Stars, best times, records, themes and achievements are kept; only the run's unlocks reset. Restarting on the last attempt asks for confirmation first. Cleared levels can be replayed freely.
- **Dead-end detection**: When the line has no legal move left, a banner offers an undo; with no undos left the attempt ends with a short circuit.
- **Timer**: Starts on the first move. Time Freeze pauses it, and the clock stops automatically when the tab or app goes to the background.
- **Par time**: The header shows the live time against par, so the three-star window is always visible.
- **Progress bar**: A thin bar under the header tracks how many nodes are connected.
- **Keyboard**: Arrow keys extend the line one cell at a time. `Z`/`U` undo, `H` hints, `R` restarts, `P`/`Esc` pauses.
- **Shortcuts**: A dedicated help dialog in the game header lists every key.

### Level Mechanics 2.0

Mechanics are derived from each level's canonical solution, so every level stays solvable:

- **Walls** — blocked decorative cells inside the grid (from level 11)
- **One-way nodes** — a white arrow forces the next step (from level 51)
- **Ordered color pairs** — visit ring 1 before ring 2 (from level 76)
- **Portals** — optional A/B pads that teleport the line (from level 101)
- **Sync nodes** — green numbered hexagons that must be the Nth node of the line; the one due next pulses, a missed one turns red (from level 201)
- **Blackout** — only a pool of light around the line's head is lit; the rest of the board fades to near-black (from level 251)
- **First-encounter intros** — each new mechanic is introduced with a card the first time it appears
- All move rules live in one shared function (`createMoveRules`), and a test plays every level's canonical solution through it, so all 300 levels are proven solvable
- **Boss levels** — every 25th level gets a crown, a 15% longer par and a denser layout
- **Fast swipes**: Pointer samples are interpolated, so fast mobile drags do not skip nodes.

---

## Stars & Scoring

Each level awards 1–3 stars:

| Requirement | Effect |
|-------------|--------|
| Use no hint | Keeps one star |
| Make no backtrack | Keeps one star |
| Finish under par time | Keeps one star |

- Best time, best score, fewest moves, and fewest mistakes are stored per level
- Score is calculated from nodes, stars, speed, and active Score Boost
- Replaying a level can improve stars, best time, and best score
- The Stats tab shows total score and the best single-level score

---

## Campaign & Progression

### 300 Levels in 12 Chapters

1. **Boot Sequence** (1–25)
2. **Neon District** (26–50)
3. **Data Stream** (51–75)
4. **Ghost Protocol** (76–100)
5. **Overclock** (101–125)
6. **Deep Net** (126–150)
7. **Black Ice** (151–175)
8. **Singularity** (176–200)
9. **Quantum Core** (201–225) — sync nodes arrive
10. **Event Horizon** (226–250) — three sync nodes per board
11. **Blackout** (251–275) — 13×13 boards in the dark
12. **Omega** (276–300) — four sync nodes, blackout, the final staircase

- Twelve layout families rotate through the campaign — serpentine, spiral, outward spiral, wander, hug, drift, turn, border, corner, weave and more — and neighbouring levels never share one
- All 300 layouts are checked by `npm run test:levels`: no board repeats another one, not even after rotation or mirroring, and any two levels on the same grid differ by a growing margin (at least 12% of their nodes)
- Boards run from 3×3 tutorials to 13×13 finales and stop around 65% coverage, which leaves room for large, readable holes instead of a wall of circles
- Node count climbs at every level, and every 20-level block is harder than the one before it, so level 1 is the easiest board in the game and level 300 the hardest (levels 1–200 kept their exact layouts when the expansion was added)
- Difficulty combines junctions with a measured trap score: a greedy solver is run against each layout, and boards that punish greedy play score higher
- The first three levels, levels 191–200 and levels 291–300 climb strictly, so the campaign starts gently and ends on a ten-level staircase
- From level 4 on, a layout must have at least three junctions, which stops the campaign from turning into forced corridors
- Chapter board shows solved levels, stars, and progress
- Filters for **Unsolved** and **Needs 3★** make cleanup runs fast
- Jump directly to any unlocked level from the chapter board
- **Practice toggle** opens any unlocked level in zen mode
- Continue button resumes the next unsolved circuit
- Levels 101–300 unlock after all 100 main levels
- The Stats tab shows the current run and the number of system crashes
- Progress v2 migrates existing local saves automatically

### Daily Challenge

- One deterministic seeded level per day, identical for all players
- Seven-day history strip and a live countdown to the next challenge
- Streak tracking with best streak
- Replaying keeps the best daily result
- Shareable 9:16 result card (Web Share on mobile, PNG download elsewhere)
- Every campaign clear can be shared too, not just the daily challenge
- Daily clears do **not** skip campaign levels

### Weekly Challenge

- One deterministic level per ISO week with a rotating modifier
- Modifiers: **Mirrored**, **No undo**, **Time attack** and **No hints**
- Best stars and time are stored per week; first clear awards a hint token
- Same seven-day countdown and share card flow as the daily

### Level Codes

- Permanent 4-digit codes from Level 10
- Enter a code to jump directly to its level
- Codes remain compatible with all previously released values


## Power-ups

| Power-up | Description |
|----------|-------------|
| **Time Freeze** | Pause the level timer for 30 seconds |
| **Path Reveal** | Reveal the full path for 5 seconds |
| **Undo Shield** | The next backtrack does not cost a star (it still uses one of the three backtracks) |
| **Score Boost** | 2× score for the next 3 completed levels |

- A power-up is awarded every fifth new level
- Achievements also grant power-ups and hint tokens
- Hints reveal the path for 1.5 seconds and cost one **hint token**, not a star
- Tokens: start with 3, earn one from each daily/weekly clear, every tenth new level and each achievement

### Personal Best Ghost

- The fastest run's path is stored per level, but the ghost only runs on levels 1–10
- A faint dashed trace shows your best line while you replay those opening levels
- From level 11 on nothing marks the route — later boards are read from scratch
- Toggle it in Settings

---

## Achievements

- 10 achievements across bronze → diamond
- Tracks levels completed, perfect runs, hint-free runs, speed runs, power-ups, and themes
- New unlocks raise a toast notification

---

## Themes & Settings

- 6 neon themes: Cyberpunk, Retro Wave, Cosmic, Matrix, Neon Sunset, Aurora
- Themes unlock at 10 / 50 / 100 / 200 / 250 completed levels (ever completed, so a crash never re-locks a theme)
- Settings: sound effects with a volume slider, haptics, reduced motion, ghost overlay, language
- Reduced motion disables particles, pulses, animated trails, and confetti
- Export and restore a save file (progress, achievements, power-ups, hint tokens, theme, weekly results, custom levels) from Settings
- Restores are validated before anything is overwritten
- English, Swedish, Turkish and Spanish UI (menus, HUD, results, settings, tutorial). English is the default on every device; the player's choice is stored on that device and kept until changed. Flag pickers on the title screen and in Settings

---

## Look & Feel

- **Title screen**: a board that draws its own solution on a loop (the same animation is in the README as `docs/hero.gif`), a bold NEON/PATH wordmark, a cut-corner play button with a segmented progress bar and the current chapter
- **Brain rank**: a title that grows with your stars (Novice → Apprentice → Thinker → Strategist → Mastermind → Genius → Omega), shown on the title screen and in Stats
- **Readable HUD**: universal icons (stopwatch, undo, restart, light bulb, bolt, trophy, help, gear) with the remaining backtracks, restarts and hint tokens as large numbers beside them; the mobile header always keeps the level number visible
- **First-run tutorial** opens with a live demo of the line drawing itself
- Flat, square design language across the menu, dialogs, win screen
- Layered synthesised sound effects (no audio files, no background music)

---

## Accessibility

- Keyboard controls with visible focus states and a shortcut reference dialog
- ARIA application label, live node-count announcement, and an accessible progress bar
- Pause overlay keeps the timer honest without losing the run
- Screen-reader friendly dialogs and settings
- Reduced-motion preference respected automatically
- Color-independent star and progress feedback

---

## Technical

- React 18 + TypeScript + Vite
- Canvas renderer with device-pixel-ratio support and requestAnimationFrame effects
- Zustand stores for power-ups, achievements, themes, and settings
- React Query for level data
- Local-first progress with versioned migration
- Additive mechanics generator with 300-level solvability tests
- Procedural Web Audio sound layer: each connected node plays the next note of a pentatonic scale, so the melody tracks progress
- PWA manifest and service worker for installable, offline play (hashed assets cache-first, shell stale-while-revalidate, registered in production builds only)
- Lightweight i18n store with Swedish and English dictionaries
- Capacitor Android shell with haptics, splash screen, and status bar handling

---

## License

MIT License — see LICENSE.
