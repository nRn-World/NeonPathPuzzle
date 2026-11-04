/**
 * Build-target aware loading of third-party portal SDKs.
 *
 * The plain web/PWA/Android build loads no external script at all. Portal
 * builds set `VITE_PLATFORM=playgama` (or `crazygames`) and the SDK is injected
 * at runtime, so a blocking third-party <script> never sits in index.html for
 * every player. Consent for ads is a separate, persisted setting — see
 * `useSettingsStore.adsEnabled` and `showInterstitial()`.
 */

export type Platform = "web" | "playgama" | "crazygames";

const SDK_URLS: Record<Exclude<Platform, "web">, string> = {
  playgama: "https://bridge.playgama.com/v2/stable/playgama-bridge.js",
  crazygames: "https://sdk.crazygames.com/crazygames-sdk-v3.js",
};

export function platform(): Platform {
  const value = (import.meta.env?.VITE_PLATFORM as string | undefined) ?? "web";
  return value === "playgama" || value === "crazygames" ? value : "web";
}

export function platformSdkUrl(): string | null {
  const current = platform();
  return current === "web" ? null : SDK_URLS[current];
}

let loader: Promise<void> | null = null;

/** Idempotent, non-blocking script injection. Resolves to false when blocked. */
export function loadPlatformSdk(): Promise<boolean> {
  const url = platformSdkUrl();
  if (!url || typeof document === "undefined") return Promise.resolve(false);
  if (!loader) {
    loader = new Promise<void>(resolve => {
      // Portal build scripts may inject the tag at build time; never load the
      // same SDK twice.
      const existing = document.querySelector<HTMLScriptElement>(`script[data-platform-sdk="${platform()}"]`)
        ?? document.querySelector<HTMLScriptElement>(`script[src="${url}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
        } else {
          // A build-time tag may already have finished loading before we attached.
          existing.addEventListener("load", () => resolve(), { once: true });
          setTimeout(resolve, 1_500);
        }
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.platformSdk = platform();
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => resolve(), { once: true });
      document.head.appendChild(script);
    });
  }
  return loader.then(() => Boolean(window.bridge || window.CrazyGames));
}
