/**
 * Public player names are never typed in: they are built from two words in
 * these lists plus a number, so nothing offensive or political can appear. The
 * server accepts only names that decompose back into this exact pattern.
 */
export const NAME_ADJECTIVES = [
  "Neon", "Quiet", "Swift", "Bright", "Lucky", "Silent", "Cosmic", "Turbo", "Rapid", "Calm",
  "Bold", "Clever", "Cyber", "Electric", "Frosty", "Golden", "Hyper", "Iron", "Jolly", "Keen",
  "Lunar", "Mighty", "Nimble", "Omega", "Plasma", "Quantum", "Rusty", "Solar", "Tidy", "Ultra",
  "Vivid", "Wild", "Zen", "Amber", "Brisk", "Crisp", "Dusty", "Eager", "Fuzzy", "Gentle",
  "Hasty", "Icy", "Jumpy", "Lively", "Misty", "Noble", "Proud", "Royal", "Sleek", "Tiny",
  "Urban", "Velvet", "Witty", "Zesty", "Sunny", "Stormy", "Snappy", "Sharp", "Steady", "Magic",
] as const;

export const NAME_NOUNS = [
  "Fox", "Wolf", "Owl", "Hawk", "Lynx", "Otter", "Panda", "Tiger", "Falcon", "Raven",
  "Cobra", "Gecko", "Koala", "Llama", "Moose", "Newt", "Orca", "Pika", "Quail", "Robin",
  "Shark", "Toad", "Viper", "Wasp", "Yak", "Zebra", "Node", "Pixel", "Circuit", "Signal",
  "Vector", "Orbit", "Comet", "Nova", "Pulse", "Spark", "Beam", "Byte", "Core", "Drift",
  "Echo", "Flux", "Glow", "Hex", "Link", "Loop", "Mesh", "Nexus", "Path", "Quark",
  "Relay", "Sprite", "Trace", "Volt", "Wave", "Wisp", "Ion", "Laser", "Matrix", "Photon",
] as const;

/** A name for any non-negative integer seed: the same seed always gives the same name. */
export function nameFromSeed(seed: number): string {
  let state = (Math.imul(Math.trunc(seed) ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
  const adjective = NAME_ADJECTIVES[next() % NAME_ADJECTIVES.length];
  const noun = NAME_NOUNS[next() % NAME_NOUNS.length];
  return `${adjective}${noun}${10 + (next() % 90)}`;
}

const ADJECTIVES = new Set<string>(NAME_ADJECTIVES);
const NOUNS = new Set<string>(NAME_NOUNS);

/** True only for names made from the lists above: Adjective + Noun + two digits. */
export function isGeneratedName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const match = /^([A-Z][a-z]+)([A-Z][a-z]+)(\d{2})$/.exec(name);
  return match !== null && ADJECTIVES.has(match[1]) && NOUNS.has(match[2]);
}
