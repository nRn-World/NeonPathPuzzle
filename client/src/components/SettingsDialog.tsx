import { useRef, useState } from "react";
import { DatabaseBackup, Download,  Upload } from "lucide-react";
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
import { useSettingsStore } from "@/lib/settings";
import { useToast } from "@/hooks/use-toast";
import { useUserId } from "@/hooks/use-game";
import { getDateKey } from "@/lib/daily";
import { applyBackup, backupToJson, createBackup, parseBackup } from "@/lib/backup";
import { useI18n } from "@/lib/i18n";
import { useHintTokenStore } from "@/lib/hintTokens";

export function SettingsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = useUserId();
  const { toast } = useToast();
  const { t, language, setLanguage } = useI18n();
  const hintTokens = useHintTokenStore(state => state.tokens);
  const {
    soundEnabled,
    hapticsEnabled,
    reducedMotion,
    showGhost,
    setSoundEnabled,
    setHapticsEnabled,
    setReducedMotion,
    setShowGhost,
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
          aria-label="Settings"
          className={triggerClassName ?? "h-8 w-8 rounded-none border-white/15 p-0 text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary md:h-9 md:w-9"}
        >
          <GearIcon className="h-5 w-5 md:h-[22px] md:w-[22px]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GearIcon className="h-5 w-5 text-primary" />
            {t("settingsTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("settingsDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <SettingRow
            label={t("sound")}
            description={t("soundDesc")}
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />
          <SettingRow
            label={t("haptics")}
            description={t("hapticsDesc")}
            checked={hapticsEnabled}
            onChange={setHapticsEnabled}
          />
          <SettingRow
            label={t("reduceMotion")}
            description={t("reduceMotionDesc")}
            checked={reducedMotion}
            onChange={setReducedMotion}
          />
          <SettingRow
            label={t("ghost")}
            description={t("ghostDesc")}
            checked={showGhost}
            onChange={setShowGhost}
          />

          <div className="flex items-center justify-between gap-4 rounded-lg border border-secondary/25 bg-secondary/5 p-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t("hintTokensTitle")}</Label>
              <p className="text-xs text-muted-foreground">{t("hintTokensDesc")}</p>
            </div>
            <span className="font-orbitron text-2xl font-bold text-secondary">{hintTokens}</span>
          </div>

          <div className="space-y-2 rounded-lg border border-white/10 p-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">{t("language")}</Label>
              <p className="text-xs text-muted-foreground">{t("languageDesc")}</p>
            </div>
            <LanguageButtons />
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <DatabaseBackup className="h-3.5 w-3.5 text-primary" />
                {t("backup")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("backupDesc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="border-white/15">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("exportSave")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="border-white/15"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t("restoreSave")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImport}
                className="hidden"
                aria-label="Restore save file"
              />
            </div>
            <p className="text-[10px] text-muted-foreground/70">
              {t("restoreReplaces")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
