import { chapters } from "./chapters";
import { getDateKey, shiftDateKey } from "./daily";
import { getBrainRank, type BrainRank } from "./rank";
import { getTotalStars, type ProgressData } from "./progress";

export interface ChapterStat {
  id: number;
  cleared: number;
  total: number;
  stars: number;
  maxStars: number;
}

export interface ActivityDay {
  dateKey: string;
  count: number;
}

export interface ProfileStats {
  totalStars: number;
  clears: number;
  threeStarClears: number;
  flawlessClears: number;
  averageStars: number;
  /** Sum of every personal-best time: a floor for the time spent on solved levels. */
  totalBestTimeMs: number;
  fastest: { levelId: number; timeMs: number }[];
  rank: BrainRank;
  chapters: ChapterStat[];
  /** Oldest first; weeks of 7 days ending today, `weeks * 7` entries. */
  activity: ActivityDay[];
  activeDays: number;
}

const localDateKey = (timestamp: number) => getDateKey(new Date(timestamp));

export function computeProfileStats(
  progress: ProgressData,
  today: string = getDateKey(),
  weeks = 12,
): ProfileStats {
  const records = Object.values(progress.records).filter(record => record.completed);
  const threeStarClears = records.filter(record => record.stars === 3).length;
  const flawlessClears = records.filter(record => record.stars === 3 && !record.hintsUsed).length;
  const totalStars = getTotalStars(progress);

  const timed = records
    .filter((record): record is typeof record & { bestTimeMs: number } => record.bestTimeMs !== null && record.bestTimeMs > 0);
  const fastest = [...timed]
    .sort((a, b) => a.bestTimeMs - b.bestTimeMs)
    .slice(0, 5)
    .map(record => ({ levelId: record.levelId, timeMs: record.bestTimeMs }));

  const chapterStats = chapters.map<ChapterStat>(chapter => {
    const inChapter = records.filter(record => record.levelId >= chapter.from && record.levelId <= chapter.to);
    return {
      id: chapter.id,
      cleared: inChapter.length,
      total: chapter.to - chapter.from + 1,
      stars: inChapter.reduce((sum, record) => sum + record.stars, 0),
      maxStars: (chapter.to - chapter.from + 1) * 3,
    };
  });

  const perDay = new Map<string, number>();
  const bump = (timestamp: number) => {
    const key = localDateKey(timestamp);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  };
  records.forEach(record => bump(record.updatedAt));
  Object.values(progress.daily.results).forEach(result => bump(result.completedAt));

  const days = weeks * 7;
  const activity: ActivityDay[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const dateKey = shiftDateKey(today, -offset);
    activity.push({ dateKey, count: perDay.get(dateKey) ?? 0 });
  }

  return {
    totalStars,
    clears: progress.completed.length,
    threeStarClears,
    flawlessClears,
    averageStars: records.length > 0 ? records.reduce((sum, record) => sum + record.stars, 0) / records.length : 0,
    totalBestTimeMs: timed.reduce((sum, record) => sum + record.bestTimeMs, 0),
    fastest,
    rank: getBrainRank(totalStars),
    chapters: chapterStats,
    activity,
    activeDays: activity.filter(day => day.count > 0).length,
  };
}
