import type { TranslationKey } from "./i18n";

/**
 * "Brain rank": a title that grows with the stars earned over every run. It is
 * the game's answer to "am I getting better at this?", so it only ever goes up.
 */
const RANKS: { from: number; key: TranslationKey }[] = [
  { from: 0, key: "rank0" },
  { from: 30, key: "rank1" },
  { from: 90, key: "rank2" },
  { from: 200, key: "rank3" },
  { from: 380, key: "rank4" },
  { from: 600, key: "rank5" },
  { from: 850, key: "rank6" },
];

export interface BrainRank {
  key: TranslationKey;
  /** 0-based position, for styling. */
  tier: number;
  /** Stars still needed for the next rank, or null at the top. */
  starsToNext: number | null;
}

export function getBrainRank(totalStars: number): BrainRank {
  const stars = Math.max(0, Math.floor(Number.isFinite(totalStars) ? totalStars : 0));
  let tier = 0;
  RANKS.forEach((rank, index) => {
    if (stars >= rank.from) tier = index;
  });
  const next = RANKS[tier + 1];
  return { key: RANKS[tier].key, tier, starsToNext: next ? next.from - stars : null };
}
