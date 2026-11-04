import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate, useLanguageStore } from "@/lib/i18n";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";

/**
 * A crashed React tree used to leave a black screen. Now it records one opt-in
 * diagnostic event and offers a way back into the game.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Neon Path Puzzle crashed:", error, info.componentStack);
    track("error", { mode: "render" });
  }

  private reload = () => window.location.reload();

  private backToMenu = () => {
    window.location.hash = "#/";
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    const language = useLanguageStore.getState().language;
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
        <h1 className="font-orbitron text-2xl font-bold text-primary">
          {translate("errorTitle", language)}
        </h1>
        <p className="max-w-sm font-exo text-sm text-muted-foreground">
          {translate("errorDesc", language)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={this.reload} className="bg-primary font-bold text-background">
            {translate("errorRetry", language)}
          </Button>
          <Button variant="outline" onClick={this.backToMenu} className="border-white/15">
            {translate("errorMenu", language)}
          </Button>
        </div>
      </div>
    );
  }
}
