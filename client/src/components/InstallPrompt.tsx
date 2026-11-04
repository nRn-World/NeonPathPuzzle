import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "neon-path-install-dismissed";

/** Native A2HS prompt surfaced in the UI, never as a browser-default banner. */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage blocked: still allow the prompt.
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setDeferred(null);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* no storage */ }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setVisible(false);
    setDeferred(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          role="dialog"
          aria-label={t("installTitle")}
          className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] space-y-3 border border-primary/40 bg-black/90 p-4 shadow-[0_0_30px_rgba(0,243,255,0.15)] backdrop-blur"
        >
          <button
            onClick={dismiss}
            aria-label={t("installDismiss")}
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="font-orbitron text-sm font-black text-primary">{t("installTitle")}</h2>
          </div>
          <p className="pr-5 font-exo text-xs leading-relaxed text-muted-foreground">{t("installDesc")}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={install} className="flex-1">{t("installAction")}</Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>{t("installDismiss")}</Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
