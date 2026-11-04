# Neon Path Puzzle — design decisions

This document is the single place that explains *why* the game behaves the way
it does. Round 4 covers the ten improvement tips; round 5 covers the seven
premium features. Update it together with the code so README, FEATURES and
UPGRADE_NOTES stop drifting apart.

| # | Decision | Where it lives |
|---|----------|----------------|
| 1 | Measurement is opt-in and aggregate. No event is recorded until the player enables diagnostics; counters are player-less, stay on the device and only reach the worker when online play is on. A React error boundary turns a white screen into a recoverable screen. | `client/src/lib/telemetry.ts`, `client/src/components/ErrorBoundary.tsx`, `worker/src/index.ts` `/telemetry`, `worker/schema.sql` |
| 2 | Losing a run is no longer the default. Unlimited attempts, no crash on app close. Three attempts + system crash is now an opt-in **Hardcore** setting. Cloud saves carry *all* local stores, not just progress; the existing backup code + "Sync save now" covers guests. | `client/src/lib/settings.ts` (`hardcore`), `client/src/pages/Game.tsx`, `client/src/lib/cloudSync.ts`, `client/src/lib/backup.ts` |
| 3 | Daily/weekly boards are their own puzzles: 18 provably single-solution campaign boards × 4 rotations/mirrors = 72 slots in a fixed permutation, so no board repeats inside 72 days/weeks. The verification worker rebuilds the exact same board from the date/week key. A par-normalised pace score makes small and large boards comparable. | `shared/challenges.ts`, `client/src/lib/daily.ts`, `client/src/lib/weekly.ts`, `shared/verify.ts` |
| 4 | First-run onboarding is interactive: a live demo of the line drawing itself, three steps, skip/back/play, plus contextual tips on levels 1–3. The previously dead `tutorialSeen` flag is finally used. | `client/src/components/TutorialOverlay.tsx`, `client/src/components/StartMenu.tsx`, `client/src/pages/Game.tsx` |
| 5 | Hints are progressive and solver-based: next step (free) → next three steps (1 token) → whole line (2 tokens). The solver continues the player's *current* line through the real move rules, so a detour is handled instead of restarting from the canned answer. | `shared/solver.ts`, `client/src/lib/hints.ts`, `client/src/components/GameCanvas.tsx` (`getPath`) |
| 6 | Puzzle quality is measured with a real Hamiltonian-path solver. Campaign layouts are deliberately **not** regenerated — that would invalidate saved ghost paths, level codes, share cards and old leaderboard replays — so uniqueness is enforced where it matters (competitive challenge boards) and audited everywhere else. The solver's DFS effort also produces a 0–100 difficulty score per challenge board and a small par-time factor, so two boards with the same node count are not treated as equally hard. `npm run audit:uniqueness` fails when a known single-solution board regresses. | `shared/solver.ts`, `script/audit-uniqueness.ts`, `shared/challenges.ts`, `shared/solver.test.ts` |
| 7 | Stars reward planning, not reaction time: no hints, no backtracks, no dead ends. Time still affects score and leaderboards and is shown against par. All in-game star explanations were rewritten in four languages. | `client/src/lib/scoring.ts`, `client/src/pages/Game.tsx`, `client/src/lib/i18n*.ts` |
| 8 | CI runs `npm test`, level validation, the uniqueness audit, the privacy drift check and a bundle-size budget, plus Playwright smoke tests on desktop and a 390 px mobile viewport. The E2E suite includes a regression guard that the win overlay is really unmounted before the next level is played. | `.github/workflows/deploy-pages.yml`, `tests/e2e/smoke.spec.ts`, `script/check-bundle.ts` |
| 9 | One source of truth for privacy. The in-game page (four languages) and `PRIVACY_POLICY.md` are generated from `client/src/lib/privacyPolicy.ts`; CI checks drift. Portal SDKs are injected at runtime only for the matching build, ads need consent and are capped to one per five clears with a three-minute gap. | `client/src/lib/privacyPolicy.ts`, `script/sync-privacy.ts`, `client/src/lib/platform.ts`, `client/src/lib/playgama.ts`, `client/index.html` |
| 10 | Zoom is allowed (WCAG 1.4.4), the canvas has a DOM description of node coordinates plus a live head-position announcement, and the remaining English-only content (300 level affirmations, privacy page) is translated. Pair order and sync steps were already shown as numbers, not just colours. | `client/index.html`, `client/src/components/GameCanvas.tsx`, `client/src/lib/levelMessages*.ts`, `client/src/pages/Privacy.tsx` |


## Round 5 — seven premium features

| # | Decision | Where it lives |
|---|----------|----------------|
| 11 | The win moment gets a one-second cinematic beat *before* the result card. Input is already locked, so the canvas needs an explicit `celebrate` prop to keep its rAF loop alive; reduced motion skips the camera push and the reverse pulse. The haptic thud and the chapter resolve chord land with the shockwave. | `client/src/components/GameCanvas.tsx`, `client/src/lib/sounds.ts` (`playSurgeSound`) |
| 12 | Chapter identity is musical as well as visual. Every chapter gets its own root, pentatonic scale, chord and phrase length; the cache in `melodyFor` is keyed by scale so two chapters can never accidentally share a tune. The synth is rebuilt when the chapter changes. | `client/src/lib/chapterAudio.ts`, `synth.ts`, `melody.ts`, `sounds.ts`, `pages/Game.tsx` |
| 13 | Player-made boards live entirely in a checksum-protected base64url code (grid 3–9, ≥4 nodes, versioned). A real solver proves *exactly one solution* before "Play" is enabled, and DFS effort becomes a 0–100 difficulty score. No backend and no account. | `shared/labBoards.ts`, `shared/challenges.ts` (`difficultyFromExpanded`), `client/src/pages/Lab.tsx` |
| 14 | Ghost races reuse the same code with a line and a time appended. The ghost runs once from a real `performance.now()` start instead of looping, so the live pace delta is honest. The share action sits in the win card, and a QR code is generated locally from the same URL. | `shared/labBoards.ts`, `client/src/pages/Rival.tsx`, `client/src/components/WinModal.tsx`, `components/QrShare.tsx`, `lib/qr.ts` |
| 15 | The daily board becomes a once-per-day event: full-screen reveal, paused preview, 30-day calendar and countdown. Streak shields are earned every seventh day, bridge one missed day, and are merged into cloud saves. | `client/src/components/DailyRitual.tsx`, `pages/Daily.tsx`, `lib/daily.ts`, `lib/progress.ts`, `components/DailyCard.tsx` |
| 16 | Bosses are set pieces, not badges. `bossTier` unlocks rule families 25–100 levels early, `bossCombo` is shown on a briefing card, and the board wears a pulsing chapter-coloured frame. All 300 canonical solutions still pass the real move rules. | `shared/mechanics.ts`, `client/src/components/BossIntro.tsx`, `GameCanvas.tsx`, `pages/Game.tsx` |
| 17 | Pro polish is enforced by tests: axe WCAG A/AA scans on desktop *and* mobile, screenshots of every new screen, and a pixel-luminance guard that would fail if the dark win backdrop ever came back. Diagnostics and the install prompt are user-visible, not hidden settings. | `tests/e2e/a11y.spec.ts`, `tests/e2e/visual.spec.ts`, `components/InstallPrompt.tsx`, `pages/Insights.tsx`, `CHANGELOG.md` |

## Correction to an earlier number

An earlier tip quoted "210 of 300 levels have multiple solutions". That figure
came from a solver that counted paths one node short of a full solution. The
corrected solver (`shared/solver.ts`) finds complete Hamiltonian paths: of the
300 campaign boards, **18 have exactly one solution, 266 have more than one**
and 16 hit the search budget. The qualitative conclusion is unchanged (and
stronger): most campaign boards are "open" puzzles, while the daily/weekly
boards are now guaranteed single-solution.

## Verification

```bash
npm run check          # TypeScript
npm test               # unit tests (incl. npm run test:lab)
npx tsx verify-levels.ts
npm run audit:uniqueness
npm run privacy:check
npm run build && npm run check:bundle
npm run test:e2e       # axe scan + visual regression; needs Playwright browsers
```
