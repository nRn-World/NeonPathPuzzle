import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { initPlaygama } from "./lib/playgama";
import { platform } from "./lib/platform";
import "@fontsource/exo-2/latin-400.css";
import "@fontsource/exo-2/latin-500.css";
import "@fontsource/exo-2/latin-600.css";
import "@fontsource/exo-2/latin-700.css";
import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-600.css";
import "@fontsource/orbitron/latin-700.css";
import "./index.css";

void initPlaygama();
createRoot(document.getElementById("root")!).render(<App />);

// Production only: a cache-first worker would otherwise serve stale dev modules.
if (
  import.meta.env.PROD
  && "serviceWorker" in navigator
  && /^https?:$/.test(window.location.protocol)
  && !Capacitor.isNativePlatform()
  // Portal builds serve each upload fresh; caching an old shell breaks them.
  && platform() === "web"
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional; the game still works without it.
    });
  });
}
