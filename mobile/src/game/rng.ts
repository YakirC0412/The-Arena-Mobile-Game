export type RandomSource = () => number;

// mulberry32: small, fast and good enough for game decisions. The same seed
// always replays the same game, which tests and a future server rely on.
export function createSeededRandom(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// The only place that reads real entropy; everything else takes a RandomSource.
export function createSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
