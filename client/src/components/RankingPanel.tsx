import { useEffect, useRef, useState } from "react";
import { Crown, Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDateKey } from "@/lib/daily";
import { googleSignInEnabled, renderGoogleButton } from "@/lib/googleSignIn";
import {
  fetchBoard,
  getBackupCode,
  getPlayer,
  leaderboardEnabled,
  MAX_NAME_CHANGES,
  nameChangesLeft,
  rerollName,
  restoreFromBackupCode,
  setOnline,
  signInWithGoogle,
  signOutGoogle,
  type BoardKind,
  type Player,
  type BoardResult,
} from "@/lib/leaderboard";
import { useI18n, upper, type TranslationKey } from "@/lib/i18n";
import { formatResultTime } from "@/lib/scoring";

const BOARDS: { kind: BoardKind; label: TranslationKey }[] = [
  { kind: "duel", label: "rankingDuel" },
  { kind: "daily", label: "rankingDaily" },
  { kind: "weekly", label: "rankingWeekly" },
  { kind: "stars", label: "rankingStars" },
];

/** Google account: points follow the account. Guests keep the generated-name play. Hidden until a client id is set. */
export function GoogleAccount({ player, onChange }: { player: Player; onChange: (player: Player) => void }) {
  const { t } = useI18n();
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const enabled = googleSignInEnabled();

  useEffect(() => {
    if (!enabled || player.google || !slot.current) return;
    renderGoogleButton(slot.current, async token => {
      const signedIn = await signInWithGoogle({ idToken: token });
      setFailed(signedIn === null);
      if (signedIn) onChange(signedIn);
    }).catch(() => setFailed(true));
  }, [enabled, player.google, onChange]);

  if (!enabled) return null;
  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      {player.google ? (
        <>
          <p className="font-exo text-xs text-muted-foreground">{t("googleSignedIn")}</p>
          <button type="button" onClick={() => onChange(signOutGoogle())} className="font-exo text-[11px] text-muted-foreground underline hover:text-foreground">
            {t("googleSignOut")}
          </button>
        </>
      ) : (
        <>
          <p className="font-exo text-[11px] text-muted-foreground">{player.online ? t("guestNote") : t("googleOr")}</p>
          <div ref={slot} />
        </>
      )}
      {failed && <p className="font-exo text-xs text-destructive">{t("googleFail")}</p>}
    </div>
  );
}

/** Online top lists. Nothing is sent until the player joins; names are generated, never typed. */
export function RankingPanel() {
  const { t } = useI18n();
  const [player, setPlayer] = useState(getPlayer);
  const [kind, setKind] = useState<BoardKind>("duel");
  const [result, setResult] = useState<BoardResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [restore, setRestore] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

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
  }, [kind, player.id, player.online]);

  if (!leaderboardEnabled()) {
    return <p className="border border-white/10 bg-black/30 p-5 text-left font-exo text-sm text-muted-foreground">{t("rankingOff")}</p>;
  }

  const format = (value: number) => (kind === "stars" ? `${value} ★` : kind === "duel" ? String(value) : formatResultTime(value));

  return (
    <div className="space-y-4 text-left">
      {!player.online ? (
        <div className="space-y-3 border border-primary/30 bg-primary/5 p-4">
          <p className="font-exo text-sm">{t("rankingJoinDesc")}</p>
          <Button onClick={() => setPlayer(setOnline(true))} className="rounded-none font-bold text-background">
            {t("rankingJoin")}
          </Button>
          <GoogleAccount player={player} onChange={setPlayer} />
        </div>
      ) : (
        <div className="space-y-3 border border-white/10 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("rankingYourName")}</div>
              <div className="font-orbitron text-lg font-bold text-primary">{player.name}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={nameChangesLeft(player) === 0}
              onClick={() => setPlayer(rerollName())}
              className="rounded-none border-white/15"
            >
              <Shuffle className="mr-1.5 h-3.5 w-3.5" />
              {t("rankingNewName")}
            </Button>
          </div>
          <p className="font-mono text-xs text-amber-300">
            {t("nameChangesLeft", { left: nameChangesLeft(player), max: MAX_NAME_CHANGES })}
          </p>
          <p className="font-exo text-[11px] text-muted-foreground">{t("rankingNameHint")}</p>
          <GoogleAccount player={player} onChange={setPlayer} />

          <div className="space-y-2 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setShowCode(value => !value)}
              className="font-mono text-[11px] uppercase tracking-wider text-primary hover:underline"
            >
              {t("rankingBackup")}
            </button>
            {showCode && (
              <>
                <code className="block break-all border border-white/10 bg-black/40 p-2 font-mono text-xs">{getBackupCode()}</code>
                <p className="font-exo text-[11px] text-muted-foreground">{t("rankingBackupDesc")}</p>
              </>
            )}
            <div className="flex gap-2">
              <input
                value={restore}
                onChange={event => setRestore(event.target.value)}
                placeholder={t("rankingRestorePlaceholder")}
                aria-label={t("rankingRestore")}
                className="min-w-0 flex-1 border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={restore.trim() === ""}
                onClick={() => {
                  const restored = restoreFromBackupCode(restore);
                  setNote(restored ? t("rankingRestored") : t("rankingRestoreFail"));
                  if (restored) {
                    setPlayer(restored);
                    setRestore("");
                  }
                }}
                className="rounded-none border-white/15"
              >
                {t("rankingRestore")}
              </Button>
            </div>
            {note && <p className="font-exo text-xs text-muted-foreground">{note}</p>}
            <button
              type="button"
              onClick={() => setPlayer(setOnline(false))}
              className="font-exo text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              {t("rankingLeave")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5" role="tablist">
        {BOARDS.map(board => (
          <button
            key={board.kind}
            role="tab"
            aria-selected={kind === board.kind}
            onClick={() => setKind(board.kind)}
            className={`border px-1 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors sm:text-[11px] ${
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
