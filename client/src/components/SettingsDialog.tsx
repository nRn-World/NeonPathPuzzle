import { useRef, useState } from "react";
import { DatabaseBackup, Download, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GearIcon } from "@/components/icons/GameIcons";
import { LanguageButtons } from "@/components/LanguageSwitch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { previewVolume } from "@/lib/sounds";
import { useSettingsStore } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/use-game";
import { getDateKey } from "@/lib/daily";
import { applyBackup, backupToJson, createBackup, parseBackup } from "@/lib/backup";
import { useI18n } from "@/lib/i18n";
import { useHintTokenStore } from "@/lib/hintTokens";
import { GoogleAccount } from "@/components/RankingPanel";
import { getPlayer } from "@/lib/leaderboard";
import { googleSignInEnabled } from "@/lib/googleSignIn";
import { telemetryToJson, flushTelemetry } from "@/lib/telemetry";
import { cloudSyncReady, syncProgress } from "@/lib/cloudSync";
import { motion } from "framer-motion";

export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState(getPlayer);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = useUserId();
  const { toast } = useToast();
  const { t } = useI18n();
  const hintTokens = useHintTokenStore(state => state.tokens);
  const {
    soundEnabled,
    soundVolume,
    hapticsEnabled,
    reducedMotion,
    showGhost,
    colorBlind,
    largeText,
    setSoundEnabled,
    setSoundVolume,
    setHapticsEnabled,
    setReducedMotion,
    setShowGhost,
    setColorBlind,
    setLargeText,
    telemetryEnabled,
    hardcore,
    adsEnabled,
    setTelemetryEnabled,
    setHardcore,
    setAdsEnabled,
  } = useSettingsStore();

  const handleExport = () => {
    const backup = createBackup(userId);
    const blob = new Blob([backupToJson(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `neon-path-backup-${getDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast({ title: t("saveExported"), description: t("saveExportedDesc") });
  };

  const handleExportDiagnostics = () => {
    const blob = new Blob([telemetryToJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `neon-path-diagnostics-${getDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleSyncNow = () => {
    void syncProgress(userId).then(() => {
      void flushTelemetry(true);
      toast({ title: t("syncNowDone") });
    });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      toast({
        title: t("couldNotRestore"),
        description: t("couldNotReadSave"),
        variant: "destructive",
      });
      return;
    }

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      toast({
        title: t("couldNotRestore"),
        description: parsed.error,
        variant: "destructive",
      });
      return;
    }

    const stats = applyBackup(userId, parsed.backup);
    toast({
      title: t("saveRestored"),
      description: t("reloading", { levels: stats.completedLevels, stars: stats.stars }),
    });
    window.setTimeout(() => window.location.reload(), 900);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("settings")}
          className={triggerClassName ?? "h-8 w-8 rounded-none border-white/15 p-0 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary md:h-9 md:w-9"}
        >
          <GearIcon className="h-5 w-5 md:h-[22px] md:w-[22px]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-background/95 backdrop-blur-md border border-primary/20 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-orbitron">
            <GearIcon className="h-5 w-5 text-primary" />
            {t("settingsTitle")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("settingsDesc")}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">{t("gameplay")}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound" className="text-muted-foreground">{t("sound")}</Label>
                <Switch
                  id="sound"
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume" className="text-muted-foreground">{t("volume")}</Label>
                <Slider
                  id="volume"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[soundVolume]}
                  onValueChange={([value]) => {
                    setSoundVolume(value);
                    previewVolume(value);
                  }}
                  className="data-[state=active]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="haptics" className="text-muted-foreground">{t("haptics")}</Label>
                <Switch
                  id="haptics"
                  checked={hapticsEnabled}
                  onCheckedChange={setHapticsEnabled}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="reduced-motion" className="text-muted-foreground">{t("reducedMotion")}</Label>
                <Switch
                  id="reduced-motion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-ghost" className="text-muted-foreground">{t("showGhost")}</Label>
                <Switch
                  id="show-ghost"
                  checked={showGhost}
                  onCheckedChange={setShowGhost}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="color-blind" className="text-muted-foreground">{t("colorBlind")}</Label>
                <Switch
                  id="color-blind"
                  checked={colorBlind}
                  onCheckedChange={setColorBlind}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="large-text" className="text-muted-foreground">{t("largeText")}</Label>
                <Switch
                  id="large-text"
                  checked={largeText}
                  onCheckedChange={setLargeText}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">{t("privacy")}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="telemetry" className="text-muted-foreground">{t("telemetry")}</Label>
                <Switch
                  id="telemetry"
                  checked={telemetryEnabled}
                  onCheckedChange={setTelemetryEnabled}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hardcore" className="text-muted-foreground">{t("hardcore")}</Label>
                <Switch
                  id="hardcore"
                  checked={hardcore}
                  onCheckedChange={setHardcore}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ads" className="text-muted-foreground">{t("ads")}</Label>
                <Switch
                  id="ads"
                  checked={adsEnabled}
                  onCheckedChange={setAdsEnabled}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">{t("language")}</h3>
            <LanguageButtons />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">{t("dataManagement")}</h3>
            <div className="space-y-4">
              <Button
                onClick={handleExport}
                className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Download className="mr-2 h-4 w-4" />
                {t("exportSave")}
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("importSave")}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                className="hidden"
              />
              {cloudSyncReady && (
                <Button
                  onClick={handleSyncNow}
                  className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("syncNow")}
                </Button>
              )}
              <Button
                onClick={handleExportDiagnostics}
                className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/20"
              >
                <DatabaseBackup className="mr-2 h-4 w-4" />
                {t("exportDiagnostics")}
              </Button>
            </div>
          </div>

          {googleSignInEnabled && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-primary">{t("account")}</h3>
              <GoogleAccount player={player} onChange={setPlayer} />
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
