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

  return (
    <div className="space-y-6">
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

      <div className="rounded-none border border-white/10 bg-card/50 p-5">
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
            <span className="font-exo text-muted-foreground">{completed}/{chapterLevels.length} solved</span>
          </div>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-none bg-white/10">
          <div
            className="h-full rounded-none bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter levels">
            {filters.map(item => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`rounded-none border px-3 py-1 font-exo text-[11px] transition-colors ${
                  filter === item.id
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                }`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPractice(value => !value)}
            aria-pressed={practice}
            className={`rounded-none border px-3 py-1 font-exo text-[11px] transition-colors ${
              practice
                ? "border-secondary/60 bg-secondary/15 text-secondary"
                : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
            }`}
            title={t("practiceHint")}
          >
            {t("practice")}
          </button>

          <form onSubmit={handleJump} className="ml-auto flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={TOTAL_LEVELS}
              value={jumpValue}
              onChange={event => {
                setJumpValue(event.target.value);
                setJumpError(null);
              }}
              placeholder={t("goToLevelPlaceholder")}
              aria-label={t("goToLevelPlaceholder")}
              className="h-8 w-28 rounded-none border border-white/15 bg-background/60 px-2 font-mono text-xs text-foreground outline-none placeholder:font-exo placeholder:text-muted-foreground/60 focus:border-primary/60"
            />
            <button
              type="submit"
              aria-label="Open level"
              className="flex h-8 w-8 items-center justify-center rounded-none border border-white/15 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {jumpError && (
          <p role="alert" className="mb-3 font-exo text-xs text-amber-300">
            {jumpError}
          </p>
        )}

        {visibleLevels.length === 0 ? (
          <div className="rounded-none border border-dashed border-white/10 p-6 text-center font-exo text-sm text-muted-foreground">
            {filter === "unsolved"
              ? t("everySolved")
              : filter === "missing-stars"
                ? t("everyThreeStars")
                : t("noLevels")}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-6 sm:gap-3 md:grid-cols-8">
            {visibleLevels.map((level, index) => (
              <LevelCard
                key={level.id}
                id={level.id}
                isLocked={level.isLocked}
                isCompleted={level.isCompleted}
                stars={level.stars}
                bestTimeMs={level.bestTimeMs}
                bestScore={level.bestScore}
                hrefBase={practice ? "/zen" : "/play"}
                delay={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
