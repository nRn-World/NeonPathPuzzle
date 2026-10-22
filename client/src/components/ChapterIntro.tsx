import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { chapters } from "@/lib/chapters";
import { content } from "@/lib/contentText";
import { getChapterStory } from "@/lib/story";
import { useI18n, upper } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/settings";

/** A terminal-style briefing shown the first time a chapter is entered. */
export function ChapterIntro({ chapterId, onClose }: { chapterId: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const chapter = chapters.find(item => item.id === chapterId);
  const story = chapterId !== null ? getChapterStory(chapterId) : "";
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!chapter) return;
    if (reducedMotion) {
      setShown(story.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown(value => {
        if (value >= story.length) {
          window.clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 22);
    return () => window.clearInterval(timer);
  }, [chapter, story, reducedMotion]);

  const done = shown >= story.length;

  return (
    <AnimatePresence>
      {chapter && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 px-5 backdrop-blur-md"
          role="dialog"
          aria-labelledby="chapter-intro-title"
          onClick={() => !done && setShown(story.length)}
        >
          <motion.div
            initial={{ y: 16, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            className="w-full max-w-md space-y-4 border bg-black/70 p-6"
            style={{ borderColor: `${chapter.accent}66`, boxShadow: `0 0 50px ${chapter.accent}22` }}
          >
            <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: chapter.accent }}>
              {upper(t("chapterLabel", { n: chapter.id }))}
            </p>
            <h2 id="chapter-intro-title" className="font-orbitron text-2xl font-black tracking-wide">
              {upper(content.chapter(chapter).name)}
            </h2>
            <p
              className="min-h-[7.5rem] whitespace-pre-line font-mono text-sm leading-relaxed text-foreground/85"
              aria-label={story}
            >
              <span aria-hidden="true">
                {story.slice(0, shown)}
                {!done && <span className="animate-pulse">▌</span>}
              </span>
            </p>
            <Button
              onClick={onClose}
              className="w-full rounded-none font-bold text-background"
              style={{ background: chapter.accent }}
            >
              {done ? t("beginChapter") : t("skip")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
