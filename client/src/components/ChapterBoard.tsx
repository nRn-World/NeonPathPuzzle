import { content } from "@/lib/contentText";
import { TOTAL_LEVELS } from "@/lib/progress";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ChevronRight, CornerDownLeft, Star } from "lucide-react";
import { chapters, getChapterForLevel } from "@/lib/chapters";
import { LevelCard } from "@/components/LevelCard";
import type { LevelSummary } from "@/hooks/use-game";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type LevelFilter = "all" | "unsolved" | "missing-stars";

const filters: { id: LevelFilter; key: TranslationKey }[] = [
  { id: "all", key: "all" },
  { id: "unsolved", key: "unsolved" },
  { id: "missing-stars", key: "needsThreeStars" },
];

export function ChapterBoard({
  levels,
  continueLevel,
}: {
  levels: LevelSummary[];
  continueLevel: number;
}) {
  const initialChapter = getChapterForLevel(continueLevel).id;
  const [selectedChapter, setSelectedChapter] = useState(initialChapter);
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [practice, setPractice] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    setSelectedChapter(getChapterForLevel(continueLevel).id);
  }, [continueLevel]);

  const chapter = chapters.find(item => item.id === selectedChapter) ?? chapters[0];
  const chapterLevels = useMemo(
    () => levels.filter(level => level.id >= chapter.from && level.id <= chapter.to),
    [levels, chapter.from, chapter.to],
  );

  const visibleLevels = useMemo(() => chapterLevels.filter(level => {
    if (level.isLocked) return filter === "all";
    if (filter === "unsolved") return !level.isCompleted;
    if (filter === "missing-stars") return level.stars < 3;
    return true;
  }), [chapterLevels, filter]);

  const completed = chapterLevels.filter(level => level.isCompleted).length;
  const stars = chapterLevels.reduce((total, level) => total + level.stars, 0);
  const progress = Math.round((completed / chapterLevels.length) * 100);

  const handleJump = (event: FormEvent) => {
    event.preventDefault();
    const levelId = Number(jumpValue);
    if (!Number.isInteger(levelId) || levelId < 1 || levelId > TOTAL_LEVELS) {
      setJumpError(t("jumpRange"));
      return;
    }

    const level = levels.find(item => item.id === levelId);
    if (level?.isLocked) {
      setJumpError(t("jumpLocked", { level: levelId }));
      return;
    }

    setJumpError(null);
    setLocation(`${practice ? "/zen" : "/play"}/${levelId}`);
  };

  // Optimize rendering for neon theme
  const neonThemeOptimization = useMemo(() => {
    if (chapter.theme === "neon") {
      return {
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
      };
    }
    return {};
  }, [chapter.theme]);

  return (
    <div className="space-y-6" style={neonThemeOptimization}>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 safe-scroll">
        {chapters.map(item => {
          const isActive = item.id === chapter.id;
          const chapterLevels = levels.filter(level => level.id >= item.from && level.id <= item.to);
          const done = chapterLevels.filter(level => level.isCompleted).length;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedChapter(item.id)}
              className={`flex-shrink-0 rounded-none border px-3 py-2 text-left transition-all ${
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/25 hover:text-foreground"
              }`}
              style={item.theme === "neon" ? {
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                boxShadow: "0 0 10px rgba(255, 255, 255, 0.1)",
              } : {}}
            >
              <div className="font-orbitron text-[11px] font-bold uppercase tracking-wide">
                {content.chapter(item).name}
              </div>
              <div className="mt-0.5 text-[10px] font-exo">
                {done}/{chapterLevels.length}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-none border border-white/10 bg-card/50 p-5" style={neonThemeOptimization}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-none" style={{ backgroundColor: chapter.accent }} />
              <h3 className="font-orbitron text-lg font-bold">{content.chapter(chapter).name}</h3>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-exo text-xs text-muted-foreground">
                {content.levelsRange(chapter.from, chapter.to)}
              </span>
            </div>
            <p className="mt-1 font-exo text-sm text-muted-foreground">{content.chapter(chapter).tagline}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary" />
              <span className="font-orbitron font-bold">{stars}</span>
              <span className="text-xs text-muted-foreground">/ {chapterLevels.length * 3}</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="font-orbitron font-bold">{progress}%</span>
              <span className="text-xs text-muted-foreground">{t("completed")}</span>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map(item => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`rounded-none px-3 py-1 text-xs transition-all ${
                filter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {t(item.key)}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <form onSubmit={handleJump} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={jumpValue}
                onChange={e => setJumpValue(e.target.value)}
                placeholder={t("jumpPlaceholder")}
                className="rounded-none border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
              />
              <CornerDownLeft className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Button type="submit" size="sm" className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
              {t("jump")}
            </Button>
          </form>
          {jumpError && <p className="text-xs text-red-400">{jumpError}</p>}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={practice}
              onChange={e => setPractice(e.target.checked)}
              className="h-4 w-4 rounded-none border border-white/10 bg-white/[0.02] text-primary focus:ring-0"
            />
            {t("practiceMode")}
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {visibleLevels.map(level => (
            <LevelCard
              key={level.id}
              level={level}
              onClick={() => setLocation(`${practice ? "/zen" : "/play"}/${level.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
