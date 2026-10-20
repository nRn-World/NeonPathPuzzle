/**
 * The level timer as a small state machine. Time Freeze and manual/system
 * pauses both stop the clock, so each stopped millisecond must be credited
 * exactly once: a freeze is settled into `frozenTotalMs` before a pause starts,
 * and a still-active freeze restarts only when the pause ends.
 */
export interface RunClock {
  startedAt: number | null;
  frozenTotalMs: number;
  freezeStartedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;
}

export function createRunClock(): RunClock {
  return {
    startedAt: null,
    frozenTotalMs: 0,
    freezeStartedAt: null,
    pausedAt: null,
    pausedTotalMs: 0,
  };
}

/** The run starts with the first move; a freeze that was already active counts from here. */
export function startRun(clock: RunClock, at: number, frozen: boolean): RunClock {
  if (clock.startedAt !== null) return clock;
  return {
    ...clock,
    startedAt: at,
    freezeStartedAt: frozen && clock.pausedAt === null ? at : null,
  };
}

function settleFreeze(clock: RunClock, at: number): RunClock {
  if (clock.freezeStartedAt === null) return clock;
  return {
    ...clock,
    frozenTotalMs: clock.frozenTotalMs + Math.max(0, at - clock.freezeStartedAt),
    freezeStartedAt: null,
  };
}

/** Start or stop freeze accounting. Freeze time never runs before the first move or while paused. */
export function setFrozen(clock: RunClock, at: number, frozen: boolean): RunClock {
  if (!frozen) return settleFreeze(clock, at);
  if (clock.startedAt === null || clock.pausedAt !== null || clock.freezeStartedAt !== null) return clock;
  return { ...clock, freezeStartedAt: at };
}

export function pauseClock(clock: RunClock, at: number): RunClock {
  if (clock.pausedAt !== null) return clock;
  return { ...settleFreeze(clock, at), pausedAt: at };
}

export function resumeClock(clock: RunClock, at: number, frozen: boolean): RunClock {
  if (clock.pausedAt === null) return clock;
  const resumed: RunClock = {
    ...clock,
    pausedTotalMs: clock.pausedTotalMs + Math.max(0, at - clock.pausedAt),
    pausedAt: null,
  };
  return frozen && resumed.startedAt !== null ? { ...resumed, freezeStartedAt: at } : resumed;
}

export function elapsedAt(clock: RunClock, now: number): number {
  if (clock.startedAt === null) return 0;
  const currentFreeze = clock.freezeStartedAt === null ? 0 : Math.max(0, now - clock.freezeStartedAt);
  const currentPause = clock.pausedAt === null ? 0 : Math.max(0, now - clock.pausedAt);
  return Math.max(
    0,
    now - clock.startedAt - clock.frozenTotalMs - currentFreeze
      - clock.pausedTotalMs - currentPause,
  );
}
