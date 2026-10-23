import { ac, noise, tone } from '../../audio/audio';

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

/** Allison's own sound cues: card guards, potions, rabbit holes and tea. */
export const ALLISON_FX: Record<string, () => void> = {
  /** A deck riffled through the thumbs. */
  cardShuffle() {
    const t = now();
    for (let i = 0; i < 12; i++) noise({ dur: 0.015, vol: 0.12, type: 'bandpass', freq: 2600 + Math.random() * 1800, q: 4, at: t + i * 0.018 });
    noise({ dur: 0.05, vol: 0.08, type: 'bandpass', freq: 1200, q: 2, at: t + 0.23 });
  },
  /** A card guard's step: a snare tap and a little stiff-legged knock. */
  cardMarch() {
    noise({ dur: 0.04, vol: 0.1, type: 'highpass', freq: 2200 * vary(0.1) });
    tone({ type: 'triangle', freq: 210 * vary(), to: 150, dur: 0.05, vol: 0.08 });
  },
  /** A halberd thrust home. */
  cardSpear() {
    noise({ dur: 0.1, vol: 0.18, type: 'highpass', freq: 2500, to: 6500, q: 2 });
    tone({ type: 'sine', freq: 1900 * vary(), dur: 0.2, vol: 0.04 });
  },
  /** A herald's trumpet calling the guards: a short rising call. */
  fanfare() {
    const t = now();
    const call: [number, number][] = [[67, 0.1], [67, 0.1], [72, 0.14], [76, 0.14], [79, 0.36]];
    let at = t;
    for (const [n, d] of call) {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      tone({ type: 'sawtooth', freq: f, dur: d, vol: 0.07, at, attack: 0.01, filter: { type: 'lowpass', freq: 2400 } });
      tone({ type: 'square', freq: f * 2, dur: d * 0.8, vol: 0.02, at, attack: 0.01 });
      at += d + 0.02;
    }
  },
  /** A snare roll that swells. */
  drumRoll() {
    const t = now();
    for (let i = 0; i < 24; i++) noise({ dur: 0.03, vol: 0.04 + i * 0.006, type: 'highpass', freq: 1800, at: t + i * 0.035 });
  },
  /** A giant card dropping edge-first, then the chop. */
  cardBlade() {
    noise({ dur: 0.25, vol: 0.22, type: 'lowpass', freq: 5000, to: 400 });
    tone({ type: 'sine', freq: 2900 * vary(), dur: 0.4, vol: 0.05, at: now() + 0.12 });
    tone({ type: 'sine', freq: 90, to: 40, dur: 0.2, vol: 0.25, at: now() + 0.12 });
  },
  /** Two big glugs from a little bottle. */
  potionGulp() {
    const t = now();
    for (let i = 0; i < 2; i++) {
      tone({ type: 'sine', freq: 340 * vary(), to: 160, dur: 0.1, vol: 0.18, at: t + i * 0.16 });
      noise({ dur: 0.08, vol: 0.06, type: 'bandpass', freq: 500, q: 4, at: t + i * 0.16 });
    }
  },
  /** Shooting up to giant size: a wobbling slide upward with a shimmer on top. */
  growSwell() {
    tone({ type: 'sawtooth', freq: 110, to: 520, dur: 0.6, vol: 0.08, attack: 0.1, filter: { type: 'lowpass', freq: 900, to: 2400 } });
    tone({ type: 'sine', freq: 600, to: 2400, dur: 0.6, vol: 0.04, attack: 0.2, detune: 8 });
    noise({ dur: 0.6, vol: 0.04, type: 'highpass', freq: 5000, attack: 0.3 });
  },
  /** A giant's foot coming down. */
  giantStomp() {
    tone({ type: 'sine', freq: 70, to: 28, dur: 0.4, vol: 0.34 });
    noise({ dur: 0.25, vol: 0.2, freq: 400, to: 90 });
    noise({ dur: 0.05, vol: 0.1, type: 'bandpass', freq: 1500, q: 2 });
  },
  /** Shrinking back down: a quick slide whistle falling. */
  shrinkZip() {
    tone({ type: 'sine', freq: 1500, to: 260, dur: 0.32, vol: 0.12 });
    tone({ type: 'triangle', freq: 3000, to: 520, dur: 0.32, vol: 0.03 });
  },
  /** Scrabbling through soft earth. */
  burrow() {
    const t = now();
    for (let i = 0; i < 4; i++) noise({ dur: 0.05, vol: 0.12, type: 'bandpass', freq: 500 + Math.random() * 400, q: 2, at: t + i * 0.06 });
  },
  /** A cork popping (or a girl popping out of a hole). */
  popOut() {
    tone({ type: 'sine', freq: 520, to: 1500, dur: 0.07, vol: 0.18 });
    noise({ dur: 0.03, vol: 0.14, type: 'highpass', freq: 3000 });
  },
  /** Porcelain: a teacup set down on its saucer. */
  teaClink() {
    const t = now();
    for (const [f, d] of [[2650, 0], [3980, 0], [2650, 0.09]] as [number, number][]) tone({ type: 'sine', freq: f * vary(0.02), dur: 0.3, vol: 0.05, at: t + d, attack: 0.001 });
  },
  /** Falling a very long way: a slow slide whistle down. */
  fallWhistle() {
    tone({ type: 'sine', freq: 1900, to: 320, dur: 1.4, vol: 0.08, attack: 0.05 });
    tone({ type: 'sine', freq: 3800, to: 640, dur: 1.4, vol: 0.015, attack: 0.05 });
  },
};
