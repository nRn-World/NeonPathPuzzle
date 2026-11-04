import { useState } from "react";
import Game from "@/pages/Game";
import { DailyRitual, hasSeenDailyReveal } from "@/components/DailyRitual";
import { getDateKey } from "@/lib/daily";
import { getProgress } from "@/lib/progress";
import { useUserId } from "@/hooks/use-game";

export default function Daily() {
  const userId = useUserId();
  // A returning player who already saw today's reveal goes straight to the board.
  const [entered, setEntered] = useState(() => hasSeenDailyReveal(getDateKey()));
  const [state] = useState(() => getProgress(userId).daily);

  return (
    <>
      <DailyRitual state={state} onEnter={() => setEntered(true)} />
      {entered && <Game mode="daily" />}
    </>
  );
}
