import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "@fontsource/exo-2/latin-400.css";
import "@fontsource/exo-2/latin-500.css";
import "@fontsource/exo-2/latin-600.css";
import "@fontsource/exo-2/latin-700.css";
import "@fontsource/orbitron/latin-400.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-600.css";
import "@fontsource/orbitron/latin-700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Production only: a cache-first worker would otherwise serve stale dev modules.
if (
  import.meta.env.PROD
  && "serviceWorker" in navigator
  && /^https?:$/.test(window.location.protocol)
  && !Capacitor.isNativePlatform()
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional; the game still works without it.
    });
  });
}
