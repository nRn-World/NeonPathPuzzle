# Neon Path leaderboard worker

A small Cloudflare Worker + D1 database behind the game's **Ranking** tab. The game works fully without it: until `VITE_LEADERBOARD_URL` is set, nothing is ever sent.

## What it stores
`board, player_id, name, value, updated_at`, one row per player and board. Boards: `stars` (total stars, highest wins), `daily:<date>` and `weekly:<week>` (time in ms, lowest wins). Only the best value per player is kept.

## Anti-cheat
Daily and weekly submissions must include the line that was drawn. The worker rebuilds the level with the same shared generator and rules (`shared/`), rejects any line that doesn't solve it, and rejects times shorter than 40 ms per node. Star totals can't be verified server-side (they are capped at 900).

## Set up (once)
```bash
cd worker
npx wrangler login
npx wrangler d1 create neon-path-leaderboard      # paste the printed database_id into wrangler.toml
npx wrangler d1 execute neon-path-leaderboard --remote --file=schema.sql
npx wrangler deploy                               # prints https://neon-path-leaderboard.<you>.workers.dev
```
Then build the game with the URL: `VITE_LEADERBOARD_URL=https://neon-path-leaderboard.<you>.workers.dev npm run build`.

For GitHub Pages, add `VITE_LEADERBOARD_URL` as a repository variable and pass it to the build step in the workflow. Consider a Cloudflare rate-limit rule on `POST /score` (for example 30 requests per minute per IP).

## Test
```bash
npx tsx --test worker/src/logic.test.ts
```
