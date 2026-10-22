import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "./hooks/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Daily from "@/pages/Daily";
import Weekly from "@/pages/Weekly";
import Privacy from "@/pages/Privacy";
import { initAudio, resumeAudio, suspendAudio } from "@/lib/sounds";
import { applyMotionPreference, applyTextPreference, useSettingsStore } from "@/lib/settings";
import { useEffect } from "react";
import { useLanguageStore } from "@/lib/i18n";

function LevelGame() {
  return <Game />;
}

function RiftGame() {
  return <Game mode="rift" />;
}

function ZenGame() {
  return <Game mode="zen" />;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/play/:id" component={LevelGame} />
        <Route path="/daily" component={Daily} />
        <Route path="/weekly" component={Weekly} />
        <Route path="/zen/:id" component={ZenGame} />
        <Route path="/rift/:id" component={RiftGame} />
        <Route path="/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const largeText = useSettingsStore(state => state.largeText);

  useEffect(() => {
    applyTextPreference(largeText);
  }, [largeText]);

  useEffect(() => {
    applyMotionPreference(reducedMotion);
  }, [reducedMotion]);

  // Keeps CSS text-transform and screen readers on the chosen language.
  const language = useLanguageStore(state => state.language);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      window.removeEventListener("pointerdown", handleInteraction);
    };

    window.addEventListener("pointerdown", handleInteraction, { passive: true });

    if (!Capacitor.isNativePlatform()) {
      return () => window.removeEventListener("pointerdown", handleInteraction);
    }

    void StatusBar.setStyle({ style: Style.Light });
    void StatusBar.setBackgroundColor({ color: "#0a0f1e" });
    void SplashScreen.hide();

    const backListener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      const route = window.location.hash.replace(/^#/, "") || "/";
      if (route !== "/") {
        window.location.hash = "#/";
      } else if (canGoBack) {
        window.history.back();
      } else {
        void CapacitorApp.minimizeApp();
      }
    });

    const stateListener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) resumeAudio();
      else suspendAudio();
    });

    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      void backListener.then((listener) => listener.remove());
      void stateListener.then((listener) => listener.remove());
    };
  }, []);

  return (
    <div className="app-shell w-screen h-screen overflow-hidden">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
