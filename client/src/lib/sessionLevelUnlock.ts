import { TOTAL_LEVELS } from "./progress";

const MIN_LEVEL = 1;
const MAX_LEVEL = TOTAL_LEVELS;

let codeUnlockedThrough = MIN_LEVEL;

export function unlockLevelsThroughCode(levelId: number) {
  if (!Number.isInteger(levelId) || levelId < MIN_LEVEL || levelId > MAX_LEVEL) {
    return false;
  }

  codeUnlockedThrough = levelId;
  return true;
}

export function getCodeUnlockedThrough() {
  return codeUnlockedThrough;
}
