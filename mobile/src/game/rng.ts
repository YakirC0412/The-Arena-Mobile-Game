export type RandomSource = () => number;

export type RandomCursor = {
  random: RandomSource;
  // The internal state after the numbers drawn so far; feed it back into
  // createRandomCursor to continue the same sequence later.
  state: () => number;
};

// mulberry32: small, fast and good enough for game decisions. The same seed
// always replays the same game, which tests and a future server rely on.
export function createRandomCursor(seed: number): RandomCursor {
  let value = seed >>> 0;
  return {
    random: () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    },
    state: () => value,
  };
}

export function createSeededRandom(seed: number): RandomSource {
  return createRandomCursor(seed).random;
}

// The only place that reads real entropy; everything else takes a RandomSource.
export function createSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
