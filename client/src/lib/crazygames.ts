// CrazyGames SDK v3: its <script> is only added by script/build-crazygames.py, so every call is guarded.
type CrazySdk = {
  init: () => Promise<void>;
  game: { gameplayStart: () => void; gameplayStop: () => void };
};

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
  }
}

let ready: Promise<CrazySdk | null> | null = null;
let playing = false;

function sdk(): Promise<CrazySdk | null> {
  if (!ready) {
    const instance = window.CrazyGames?.SDK;
    ready = instance
      ? instance.init().then(() => instance).catch(err => {
        console.warn("CrazyGames SDK init failed", err);
        return null;
      })
      : Promise.resolve(null);
  }
  return ready;
}

/** Tells CrazyGames whether the player is in gameplay (a board) or in menus. */
export function setGameplay(active: boolean): void {
  if (active === playing) return;
  playing = active;
  void sdk().then(instance => {
    if (!instance) return;
    if (active) instance.game.gameplayStart();
    else instance.game.gameplayStop();
  });
}
