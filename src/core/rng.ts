// Small seeded PRNG so procedural art is identical on every load.
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)],
  };
}
export type Rng = ReturnType<typeof rng>;

export const rand = (lo = 0, hi = 1) => lo + Math.random() * (hi - lo);
export const chance = (p: number) => Math.random() < p;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- lockstep randomness
// Online fights run the same simulation on both computers, so every random roll inside a fight
// step must come out the same on both. While a seeded block runs, Math.random (and so rand and
// chance) draws from a shared seed; sound effects switch back to the browser's own random, since
// one player may have sound running and the other not.

/** The browser's own Math.random, untouched by seeded blocks. */
export const nativeRandom = Math.random.bind(Math);

/** A random stream that both players' games share; `run` makes Math.random draw from it. */
export function seededRandom(seed: number) {
  const r = rng(seed);
  return {
    run<T>(f: () => T): T {
      const prev = Math.random;
      Math.random = r.next;
      try {
        return f();
      } finally {
        Math.random = prev;
      }
    },
  };
}

/** Wraps a function (a sound) so it uses the browser's own random even inside a seeded block. */
export function unseeded<F extends (...a: any[]) => any>(f: F): F {
  return function (this: unknown, ...a: any[]) {
    const prev = Math.random;
    Math.random = nativeRandom;
    try {
      return f.apply(this, a);
    } finally {
      Math.random = prev;
    }
  } as F;
}
