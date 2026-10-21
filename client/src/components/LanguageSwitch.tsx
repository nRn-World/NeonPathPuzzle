import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n, type Language } from "@/lib/i18n";

/** Five-point star outline around (cx, cy). */
function starPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const r = index % 2 === 0 ? radius : radius * 0.4;
    return `${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`;
  }).join(" ");
}

/** Small hand-drawn flags, so nothing is fetched and they match on every device. */
export function Flag({ code, className = "h-4 w-6" }: { code: Language; className?: string }) {
  const common = { viewBox: "0 0 24 16", className: `${className} shrink-0 rounded-[2px]`, "aria-hidden": true } as const;

  switch (code) {
    case "sv":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#006AA7" />
          <rect x="7" width="3.2" height="16" fill="#FECC00" />
          <rect y="6.4" width="24" height="3.2" fill="#FECC00" />
        </svg>
      );
    case "tr":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#E30A17" />
          <circle cx="9" cy="8" r="4.2" fill="#fff" />
          <circle cx="10.2" cy="8" r="3.4" fill="#E30A17" />
          <polygon points={starPoints(14.2, 8, 2.3)} fill="#fff" />
        </svg>
      );
    case "es":
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#AA151B" />
          <rect y="4" width="24" height="8" fill="#F1BF00" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
          <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.2" />
          <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="5.4" />
          <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3.2" />
        </svg>
      );
  }
}

/** Language picker for the title screen: the current flag, a menu of all four. */
export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  const current = LANGUAGES.find(item => item.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${t("language")}: ${current.name}`}
          className="flex h-9 items-center gap-2 rounded-none border border-white/15 px-3 font-mono text-[11px] uppercase tracking-wider text-foreground/80 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          <Flag code={current.code} />
          {current.code}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[10rem] rounded-none border-white/15 bg-background/95 backdrop-blur-md">
        {LANGUAGES.map(item => (
          <DropdownMenuItem
            key={item.code}
            onSelect={() => setLanguage(item.code)}
            className="flex cursor-pointer items-center gap-3 rounded-none font-exo text-sm"
          >
            <Flag code={item.code} />
            <span className="flex-1">{item.name}</span>
            {item.code === language && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Segmented picker with flags for the settings dialog. */
export function LanguageButtons() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("language")}>
      {LANGUAGES.map(item => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLanguage(item.code)}
          aria-pressed={language === item.code}
          className={`flex items-center gap-2.5 rounded-md border px-3 py-2 font-exo text-sm transition-colors ${
            language === item.code
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground"
          }`}
        >
          <Flag code={item.code} />
          {item.name}
        </button>
      ))}
    </div>
  );
}
