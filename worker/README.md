# Neon Path online worker (rankings + duels)

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

## Duels
`/ws/queue` is the matchmaking queue (one `Lobby` Durable Object); each match runs in its own `Arena` Durable Object at `/ws/arena/<id>`. Best of three: the same level for both players, the first line that the shared move rules accept wins the round, first to two wins. After 21 s in the queue a practice bot is added (bot wins give +6 rating up to 1200 and never cost points). Ratings (Elo, K=32, start 1000) are stored in the `ratings` table and shown on the Duel board. Players never type a name: names are generated from fixed word lists (`shared/names.ts`) and the server rejects anything else.

Local end-to-end test:
```bash
cd worker
npx wrangler d1 execute neon-path-leaderboard --local --file=schema.sql
npx wrangler dev --local --port 8787
npx tsx scripts/duel-smoke.mts pvp   # two scripted players; or "bot" for the bot path
```
