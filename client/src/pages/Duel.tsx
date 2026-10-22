import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bot, Loader2, Shuffle, Swords, Trophy } from "lucide-react";
import { generateLevel } from "@shared/level-generator";
import { getLevelMechanics } from "@shared/mechanics";
import type { Point } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { GameCanvas } from "@/components/GameCanvas";
import { DuelConnection, type DuelEvent, type DuelScore } from "@/lib/duel";
import {
  fetchBoard,
  getPlayer,
  leaderboardEnabled,
  rerollName,
  setOnline,
} from "@/lib/leaderboard";
import { getDateKey } from "@/lib/daily";
import { useSettingsStore } from "@/lib/settings";
import { playCrashSound, playWinSound } from "@/lib/sounds";
import { formatDuration } from "@/lib/scoring";
import { useI18n, upper } from "@/lib/i18n";

type Phase = "lobby" | "searching" | "playing" | "finished" | "lost-connection";

interface RoundState {
  round: number;
  levelId: number;
  /** performance.now() at which play begins. */
  startsAt: number;
  limitMs: number;
}

const NO_SCORE: DuelScore = { you: 0, opponent: 0 };

export default function Duel() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const [player, setPlayer] = useState(getPlayer);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [rating, setRating] = useState<number | null>(null);
  const [opponent, setOpponent] = useState<{ name: string; rating: number; bot: boolean } | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [score, setScore] = useState<DuelScore>(NO_SCORE);
  const [roundNote, setRoundNote] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<DuelEvent, { kind: "matchResult" }> | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [submitted, setSubmitted] = useState(false);
  const connection = useRef<DuelConnection | null>(null);

  const enabled = leaderboardEnabled();

  useEffect(() => {
    if (!enabled || !player.online) return;
    fetchBoard("duel", getDateKey()).then(board => setRating(board.you?.value ?? null)).catch(() => undefined);
  }, [enabled, player.online, player.id, result]);

  useEffect(() => () => connection.current?.close(), []);

  // One clock for the countdown and the round timer.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const onEvent = useCallback((event: DuelEvent) => {
    switch (event.kind) {
      case "match":
        setOpponent(event.opponent);
        setScore(NO_SCORE);
        setPhase("playing");
        break;
      case "round":
        setRound({ round: event.round, levelId: event.levelId, startsAt: event.receivedAt + event.startsInMs, limitMs: event.limitMs });
        setScore(event.score);
        setRoundNote(null);
        setSubmitted(false);
        setNow(performance.now());
        break;
      case "roundResult":
        setScore(event.score);
        setRoundNote(event.winner === "you" ? t("duelYouWonRound") : event.winner === "opponent" ? t("duelOppWonRound") : t("duelNoWinner"));
        if (event.winner === "you") playWinSound();
        else if (event.winner === "opponent") playCrashSound();
        break;
      case "matchResult":
        setResult(event);
        setPhase("finished");
        if (event.winner === "you") playWinSound();
        break;
      case "rejected":
        setSubmitted(false);
        break;
      case "error":
        if (event.reason === "queued elsewhere") setPhase("lobby");
        else setPhase("lost-connection");
        break;
      default:
        break;
    }
  }, [t]);

  const start = () => {
    connection.current?.close();
    setResult(null);
    setRound(null);
    setOpponent(null);
    connection.current = new DuelConnection(onEvent);
    connection.current.findMatch();
    setPhase("searching");
  };

  const cancel = () => {
    connection.current?.close();
    connection.current = null;
    setPhase("lobby");
  };

  const leave = () => {
    if (!window.confirm(t("duelLeaveConfirm"))) return;
    connection.current?.leave();
    connection.current = null;
    setPhase("lobby");
  };

  const level = useMemo(() => {
    if (!round) return null;
    const generated = generateLevel(round.levelId);
    return {
      level: { id: generated.id, gridSize: generated.gridSize, start: generated.start, nodes: generated.nodes, isLocked: false, isCompleted: false },
      mechanics: getLevelMechanics(generated, generated.solution),
    };
  }, [round]);

  const countdown = round ? Math.ceil((round.startsAt - now) / 1000) : 0;
  const live = round !== null && now >= round.startsAt && roundNote === null;
  const elapsed = round ? Math.max(0, now - round.startsAt) : 0;

  const submit = (path: Point[]) => {
    if (!round || submitted) return;
    setSubmitted(true);
    connection.current?.submit(round.round, path);
  };

  if (!enabled) {
    return (
      <Shell onBack={() => setLocation("/")} title={t("duelTitle")}>
        <p className="font-exo text-sm text-muted-foreground">{t("rankingOff")}</p>
      </Shell>
    );
  }

  if (phase === "lobby" || phase === "lost-connection") {
    return (
      <Shell onBack={() => setLocation("/")} title={t("duelTitle")}>
        <div className="space-y-5">
          {phase === "lost-connection" && <p className="font-exo text-sm text-destructive">{t("duelConnectionLost")}</p>}
          <p className="font-exo text-sm leading-relaxed text-muted-foreground">{t("duelRules")}</p>

          {!player.online ? (
            <div className="space-y-3 border border-primary/30 bg-primary/5 p-4">
              <p className="font-exo text-sm">{t("rankingJoinDesc")}</p>
              <Button onClick={() => setPlayer(setOnline(true))} className="rounded-none font-bold text-background">
                {t("rankingJoin")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border border-white/10 bg-black/30 p-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("rankingYourName")}</div>
                  <div className="font-orbitron text-lg font-bold text-primary">{player.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{t("duelRating")}: {rating ?? 1000}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPlayer(rerollName())} className="rounded-none border-white/15">
                  <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                  {t("rankingNewName")}
                </Button>
              </div>
              <Button onClick={start} className="h-14 w-full rounded-none bg-primary font-orbitron text-lg font-black tracking-wide text-background">
                <Swords className="mr-2 h-5 w-5" />
                {upper(t("duelFind"))}
              </Button>
            </>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === "searching") {
    return (
      <Shell onBack={cancel} title={t("duelTitle")}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-orbitron text-lg font-bold">{t("duelSearching")}</p>
          <p className="max-w-xs font-exo text-sm text-muted-foreground">{t("duelBotHint")}</p>
          <Button variant="outline" onClick={cancel} className="rounded-none border-white/15">{t("duelCancel")}</Button>
        </div>
      </Shell>
    );
  }

  if (phase === "finished" && result) {
    const won = result.winner === "you";
    const title = result.winner === "cancelled" ? t("duelCancelled") : won ? t("duelVictory") : result.winner === "draw" ? t("duelDraw") : t("duelDefeat");
    return (
      <Shell onBack={() => setLocation("/")} title={t("duelTitle")}>
        <div className="space-y-5 text-center">
          <Trophy className={`mx-auto h-12 w-12 ${won ? "text-amber-300" : "text-muted-foreground"}`} />
          <h2 className={`font-orbitron text-3xl font-black ${won ? "text-primary" : ""}`}>{upper(title)}</h2>
          <p className="font-mono text-lg">{result.score.you} – {result.score.opponent}</p>
          {result.forfeit && <p className="font-exo text-xs text-muted-foreground">{t("duelForfeit")}</p>}
          {result.winner !== "cancelled" && (
            <p className="font-mono text-sm text-muted-foreground">
              {t("duelRating")}: <span className="text-foreground">{result.rating}</span>{" "}
              <span className={result.ratingDelta >= 0 ? "text-emerald-300" : "text-red-300"}>
                ({result.ratingDelta >= 0 ? "+" : ""}{result.ratingDelta})
              </span>
            </p>
          )}
          {opponent?.bot && <p className="font-exo text-xs text-muted-foreground">{t("duelBotNote")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={start} className="rounded-none font-bold text-background">{t("duelPlayAgain")}</Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="rounded-none border-white/15">{t("menu")}</Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <button type="button" onClick={leave} aria-label={t("duelLeave")} className="p-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-center gap-3 font-orbitron text-sm font-bold">
            <span className="truncate text-primary">{player.name}</span>
            <span className="rounded-none border border-white/15 px-2 py-0.5 font-mono">{score.you} – {score.opponent}</span>
            <span className="flex items-center gap-1 truncate">
              {opponent?.bot && <Bot className="h-3.5 w-3.5" />}
              {opponent?.bot ? t("duelPracticeBot") : opponent?.name}
            </span>
          </div>
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {round ? t("duelRound", { n: round.round }) : "…"} · {live ? formatDuration(elapsed) : "0:00"}
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-2 py-2">
        <div className="menu-grid pointer-events-none absolute inset-0 z-0" />
        <div className="relative z-10 h-full max-h-[calc(100vh-90px)] w-full max-w-4xl">
          {level && round && (
            <GameCanvas
              key={round.round}
              level={level.level}
              mechanics={level.mechanics}
              showHint={false}
              onBacktrack={() => true}
              onComplete={(_moves, path) => submit(path)}
              reducedMotion={reducedMotion}
              paused={!live || submitted}
              gridLabel={t("gridLabel", { size: level.level.gridSize })}
            />
          )}
        </div>

        {round && countdown > 0 && roundNote === null && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">{upper(t("duelRound", { n: round.round }))}</p>
            <p className="font-orbitron text-7xl font-black text-primary">{countdown}</p>
          </div>
        )}
        {roundNote && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <p className="px-6 text-center font-orbitron text-2xl font-black">{roundNote}</p>
          </div>
        )}
        {submitted && roundNote === null && (
          <div className="absolute bottom-4 z-20 rounded-none border border-primary/40 bg-background/90 px-4 py-2 font-mono text-xs">{t("duelChecking")}</div>
        )}
      </main>
    </div>
  );
}

function Shell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <main className="safe-scroll h-full overflow-y-auto bg-background px-5 py-8 text-foreground">
      <section className="mx-auto max-w-md space-y-6 border border-primary/20 bg-black/40 p-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back" className="p-1 text-primary hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="neon-text font-orbitron text-3xl font-black text-primary">{upper(title)}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
