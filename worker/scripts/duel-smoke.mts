import { generateLevel } from "../../shared/level-generator.ts";
const BASE = "ws://127.0.0.1:8787";
const log = (...a: unknown[]) => console.log(...a);

function client(name: string, id: string, bot: boolean) {
  return new Promise<void>((resolve, reject) => {
    const q = new WebSocket(`${BASE}/ws/queue`);
    q.onopen = () => q.send(JSON.stringify({ type: "queue", playerId: id, name }));
    q.onmessage = ev => {
      const m = JSON.parse(String(ev.data));
      log(name, "queue<-", m.type);
      if (m.type !== "matched") return;
      const a = new WebSocket(`${BASE}/ws/arena/${m.matchId}`);
      a.onopen = () => a.send(JSON.stringify({ type: "hello", playerId: id }));
      a.onmessage = e => {
        const r = JSON.parse(String(e.data));
        log(name, "arena<-", r.type, r.type === "round" ? `r${r.round} L${r.levelId}` : r.type === "roundResult" ? r.winner : r.type === "matchResult" ? `${r.winner} ${r.ratingDelta} ${r.rating}` : "");
        if (r.type === "round" && (name === "NeonFox42" || bot === false && name === "SwiftOwl11" && r.round % 2 === 0)) {
          setTimeout(() => a.send(JSON.stringify({ type: "done", round: r.round, path: generateLevel(r.levelId).solution })), r.startsInMs + 1500 + (name === "NeonFox42" ? 0 : 400));
        }
        if (r.type === "matchResult") { a.close(); resolve(); }
      };
    };
    q.onerror = e => reject(e);
  });
}
const mode = process.argv[2];
if (mode === "pvp") await Promise.all([client("NeonFox42", "a".repeat(32), false), client("SwiftOwl11", "b".repeat(32), false)]);
else await client("NeonFox42", "c".repeat(32), true);
const top = await fetch("http://127.0.0.1:8787/top?board=duel").then(r => r.json());
log("TOP", JSON.stringify(top));
process.exit(0);
