# Neon Path Puzzle — Features

## Overview

**Neon Path Puzzle** is a cyber-logic puzzle game where players connect every node with a single continuous line. It combines neon aesthetics, short satisfying runs, and a long 200-level campaign.

---

## Core Gameplay

- **Objective**: Connect every node on the grid with one continuous path
- **Rules**:
  - Visit every node exactly once
  - Move only up, down, left, or right
  - The path may not cross or repeat itself
- **Three backtracks per level**: Drag backwards, press Backspace / Ctrl+Z, or use the undo button — up to three times per level. Backtracks cost a star, never a life. Restarts are always free.
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

### 200 Levels in 8 Chapters

1. **Boot Sequence** (1–25)
2. **Neon District** (26–50)
3. **Data Stream** (51–75)
4. **Ghost Protocol** (76–100)
5. **Overclock** (101–125)
6. **Deep Net** (126–150)
7. **Black Ice** (151–175)
8. **Singularity** (176–200)

- All 200 layouts are checked by `npm run test:levels`: no board repeats another one, not even after rotation or mirroring, and any two levels on the same grid differ by at least three cells
- Difficulty never drops: every level has at least as many nodes and junctions as the one before it, so level 1 is the easiest board in the game and level 200 the hardest
- The first three levels and the last ten climb strictly, so the campaign starts gently and ends on a real peak
- From level 4 on, a layout must have at least three junctions, which stops the campaign from turning into forced corridors
- Chapter board shows solved levels, stars, and progress
- Filters for **Unsolved** and **Needs 3★** make cleanup runs fast
- Jump directly to any unlocked level from the chapter board
- **Practice toggle** opens any unlocked level in zen mode
- Continue button resumes the next unsolved circuit
- Levels 101–200 unlock after all 100 main levels
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

### Circuit Editor & Custom Levels

- Draw a path on a 4×4–8×8 grid in the in-app editor
- Codes are validated for adjacency, overlaps and bounds
- Share a level as a link (`#/custom/...`) or save it locally
- Custom levels never touch campaign progress

---

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

- The fastest run's path is stored per level
- A faint dashed trace shows your best line while you replay
- Toggle it in Settings

---

## Achievements

- 10 achievements across bronze → diamond
- Tracks levels completed, perfect runs, hint-free runs, speed runs, power-ups, and themes
- New unlocks raise a toast notification

---

## Themes & Settings

- 5 neon themes: Cyberpunk, Retro Wave, Cosmic, Matrix, Neon Sunset
- Themes unlock at 10 / 50 / 100 / 200 completed levels
- Settings: sound effects, haptics, reduced motion, ghost overlay, language
- Reduced motion disables particles, pulses, animated trails, and confetti
- Export and restore a save file (progress, achievements, power-ups, hint tokens, theme, weekly results, custom levels) from Settings
- Restores are validated before anything is overwritten
- Swedish and English UI chrome (menus, HUD, results, settings); defaults to the browser language

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
- Additive mechanics generator with 200-level solvability tests
- Procedural Web Audio sound layer: each connected node plays the next note of a pentatonic scale, so the melody tracks progress
- PWA manifest and service worker for installable, offline play (hashed assets cache-first, shell stale-while-revalidate, registered in production builds only)
- Lightweight i18n store with Swedish and English dictionaries
- Capacitor Android shell with haptics, splash screen, and status bar handling

---

## License

MIT License — see LICENSE.
