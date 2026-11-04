import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, upper } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";
import {
  clearTelemetryEvents,
  getTelemetryEvents,
  telemetryToJson,
  type TelemetryEventName,
} from "@/lib/telemetry";

/**
 * Telemetry transparency: the player can see exactly which counters this
 * device holds, export them, or wipe them. Nothing here is sent anywhere.
 */
export default function Insights() {
  const { t } = useI18n();
  const enabled = useSettingsStore(state => state.telemetryEnabled);
  const [version, setVersion] = useState(0);
  const events = useMemo(() => getTelemetryEvents(), [version]);
  const counts = useMemo(() => {
    const map = new Map<TelemetryEventName, number>();
    events.forEach(event => map.set(event.name, (map.get(event.name) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const exportJson = () => {
    const blob = new Blob([telemetryToJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neon-path-diagnostics.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-background px-5 py-8 text-foreground">
      <section className="mx-auto max-w-2xl space-y-5 border border-primary/20 bg-black/40 p-6 md:p-10">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href="/"><ArrowLeft size={18} /> {t("backToMenu")}</Link>
        </Button>

        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="font-orbitron text-2xl font-black text-primary md:text-3xl">{upper(t("insightsTitle"))}</h1>
        </div>
        <p className="font-exo text-sm leading-relaxed text-muted-foreground">{t("insightsDesc")}</p>

        {!enabled && (
          <p className="border border-amber-400/30 bg-amber-400/5 p-3 font-exo text-xs text-amber-200">
            {t("insightsDisabled")}
          </p>
        )}

        <p className="font-mono text-xs text-violet-300">{t("insightsTotal", { count: events.length })}</p>

        {events.length === 0 ? (
          <p className="border border-white/10 p-4 font-exo text-sm text-muted-foreground">{t("insightsEmpty")}</p>
        ) : (
          <div className="border border-white/10">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{t("insightsEvent")}</span><span>{t("insightsCount")}</span>
            </div>
            {counts.map(([name, count]) => (
              <div key={name} className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/5 px-3 py-2 font-mono text-xs last:border-0">
                <span className="truncate text-foreground/80">{name}</span>
                <span className="text-primary">{count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson} disabled={events.length === 0}>
            <Download className="mr-2 h-4 w-4" />{t("insightsExport")}
          </Button>
          <Button
            variant="outline"
            onClick={() => { clearTelemetryEvents(); setVersion(value => value + 1); }}
            disabled={events.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />{t("insightsClear")}
          </Button>
          <Button asChild variant="ghost"><Link href="/privacy">{t("privacyPolicy")}</Link></Button>
        </div>
      </section>
    </main>
  );
}
