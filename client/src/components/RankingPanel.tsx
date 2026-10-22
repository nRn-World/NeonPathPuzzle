import { useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDateKey } from "@/lib/daily";
import {
  fetchBoard,
  getPlayer,
  isValidName,
  leaderboardEnabled,
  setPlayerName,
  type BoardKind,
  type BoardResult,
} from "@/lib/leaderboard";
import { useI18n, upper, type TranslationKey } from "@/lib/i18n";
import { formatDuration } from "@/lib/scoring";

const BOARDS: { kind: BoardKind; label: TranslationKey }[] = [
  { kind: "daily", label: "rankingDaily" },
  { kind: "weekly", label: "rankingWeekly" },
  { kind: "stars", label: "rankingStars" },
];

/** Online top lists. Nothing is sent until the player picks a public name. */
export function RankingPanel() {
  const { t } = useI18n();
  const [player, setPlayer] = useState(getPlayer);
  const [draft, setDraft] = useState(player.name ?? "");
  const [kind, setKind] = useState<BoardKind>("daily");
  const [result, setResult] = useState<BoardResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!leaderboardEnabled()) return;
    let cancelled = false;
    setState("loading");
    fetchBoard(kind, getDateKey())
      .then(board => {
        if (cancelled) return;
        setResult(board);
        setState("idle");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, player.name]);

  if (!leaderboardEnabled()) {
    return <p className="border border-white/10 bg-black/30 p-5 text-left font-exo text-sm text-muted-foreground">{t("rankingOff")}</p>;
  }

  const format = (value: number) => (kind === "stars" ? `${value} ★` : formatDuration(value));
  const nameOk = isValidName(draft);

  return (
    <div className="space-y-4 text-left">
      <div className="space-y-2 border border-white/10 bg-black/30 p-4">
        <label htmlFor="ranking-name" className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("rankingNameLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="ranking-name"
            value={draft}
            maxLength={16}
            onChange={event => setDraft(event.target.value)}
            className="min-w-0 flex-1 border border-white/15 bg-white/5 px-3 py-2 font-exo text-sm focus:border-primary focus:outline-none"
          />
          <Button
            disabled={!nameOk || draft.trim() === player.name}
            onClick={() => setPlayer(setPlayerName(draft.trim().replace(/\s+/g, " ")))}
            className="rounded-none font-bold text-background"
          >
            {t("rankingSave")}
          </Button>
        </div>
        <p className="font-exo text-[11px] text-muted-foreground">{t("rankingNameHint")}</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5" role="tablist">
        {BOARDS.map(board => (
          <button
            key={board.kind}
            role="tab"
            aria-selected={kind === board.kind}
            onClick={() => setKind(board.kind)}
            className={`border px-2 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              kind === board.kind ? "border-primary bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:border-white/30"
            }`}
          >
            {t(board.label)}
          </button>
        ))}
      </div>

      {state === "loading" && !result && (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      )}
      {state === "error" && <p className="font-exo text-sm text-destructive">{t("rankingError")}</p>}

      {result && (
        <>
          {result.entries.length === 0 ? (
            <p className="font-exo text-sm text-muted-foreground">{t("rankingEmpty")}</p>
          ) : (
            <ol className="space-y-1">
              {result.entries.map(entry => (
                <li
                  key={`${entry.rank}-${entry.name}`}
                  className={`flex items-center gap-3 border px-3 py-2 font-mono text-xs ${
                    entry.you ? "border-primary/60 bg-primary/10" : "border-white/10 bg-black/30"
                  }`}
                >
                  <span className="w-6 text-muted-foreground">{entry.rank === 1 ? <Crown className="h-3.5 w-3.5 text-amber-300" /> : `#${entry.rank}`}</span>
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="text-primary">{format(entry.value)}</span>
                </li>
              ))}
            </ol>
          )}
          {result.you && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {upper(t("rankingYou"))}: #{result.you.rank} · {format(result.you.value)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
