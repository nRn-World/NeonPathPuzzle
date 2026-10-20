export const MIN_CODED_LEVEL = 10;
export const MAX_CODED_LEVEL = 300;

/**
 * Permanent public level-code contract.
 *
 * Never change this multiplier or the formula: players may save a code and
 * expect it to keep opening the same level after every refresh and release.
 * 9973 is coprime with 10000, so levels 10-300 all receive unique codes.
 */
const PERMANENT_CODE_MULTIPLIER = 9973;

export function generateLevelCode(levelId: number): string {
  if (
    !Number.isInteger(levelId)
    || levelId < MIN_CODED_LEVEL
    || levelId > MAX_CODED_LEVEL
  ) {
    return "";
  }

  const hash = (levelId * PERMANENT_CODE_MULTIPLIER) % 10000;
  return String(hash).padStart(4, "0");
}

/**
 * Find level ID from code
 * Returns null if code is invalid
 */
export function getLevelFromCode(code: string): number | null {
  if (!/^\d{4}$/.test(code)) {
    return null;
  }

  for (let levelId = MIN_CODED_LEVEL; levelId <= MAX_CODED_LEVEL; levelId++) {
    if (generateLevelCode(levelId) === code) {
      return levelId;
    }
  }

  return null;
}
