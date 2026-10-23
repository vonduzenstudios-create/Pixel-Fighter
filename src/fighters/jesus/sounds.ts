import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';

// Sound cues for Jesus's moves: water, a choir swell, a harp, bread and a slippery fish.
const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

export const JESUS_FX: Record<string, () => void> = {
  /** A soft sustained choir chord, for the offered cheek. */
  graceHum() {
    sfx.sing([[4, 5]], 0.12, 0.06);
    tone({ type: 'sine', freq: 262, dur: 0.8, vol: 0.05, attack: 0.2 });
    tone({ type: 'sine', freq: 392, dur: 0.8, vol: 0.03, attack: 0.25 });
  },
  /** The choir swelling up a major triad. */
  graceSwell() {
    sfx.sing([[0, 2], [4, 2], [7, 4]], 0.07, 0.08);
    const t = now();
    [0, 4, 7, 12].forEach((n, i) => tone({ type: 'triangle', freq: 330 * Math.pow(2, n / 12), dur: 0.5, vol: 0.04, at: t + i * 0.05 }));
  },
  /** A bright burst of light hitting home: a shimmer and a soft low push. */
  graceBurst() {
    const t = now();
    for (let i = 0; i < 6; i++) tone({ type: 'sine', freq: (1200 + i * 260) * vary(0.02), dur: 0.35, vol: 0.04, at: t + i * 0.025 });
    tone({ type: 'sine', freq: 160 * vary(), to: 70, dur: 0.2, vol: 0.18 });
    noise({ dur: 0.25, vol: 0.12, type: 'highpass', freq: 3000, to: 6000 });
  },
  /** The struck cheek: a springy, cartoon boing that does no harm. */
  cheekBoing() {
    tone({ type: 'triangle', freq: 180, to: 420, dur: 0.18, vol: 0.18 });
    tone({ type: 'sine', freq: 420, to: 240, dur: 0.3, vol: 0.1, at: now() + 0.12 });
  },
  /** Gliding over still water: a gentle lap and a shimmer. */
  waterGlide() {
    noise({ dur: 0.35, vol: 0.12, type: 'bandpass', freq: 900, to: 500, q: 2, attack: 0.08 });
    tone({ type: 'sine', freq: 880 * vary(0.03), to: 1320, dur: 0.3, vol: 0.03 });
  },
  /** A wave slapping into someone. */
  splashHit() {
    noise({ dur: 0.3, vol: 0.28, type: 'bandpass', freq: 1400, to: 400, q: 1.2 });
    tone({ type: 'sine', freq: 300 * vary(), to: 120, dur: 0.12, vol: 0.12 });
    const t = now();
    for (let i = 0; i < 6; i++) tone({ type: 'sine', freq: 600 + Math.random() * 900, to: 1600, dur: 0.05, vol: 0.03, at: t + 0.05 + Math.random() * 0.2 });
  },
  /** Water blushing into wine: a little harp run and a sparkle. */
  wineTurn() {
    const t = now();
    [0, 4, 7, 11, 14].forEach((n, i) => tone({ type: 'triangle', freq: 523 * Math.pow(2, n / 12), dur: 0.5, vol: 0.05, at: t + i * 0.07 }));
    sfx.twinkle();
  },
  /** One fish becoming two: a quick rising pop and a chime. */
  multiply() {
    tone({ type: 'square', freq: 500, to: 1000, dur: 0.08, vol: 0.06 });
    tone({ type: 'sine', freq: 1568, dur: 0.4, vol: 0.05, at: now() + 0.06 });
  },
  /** A wet fish across the face. */
  fishSlap() {
    noise({ dur: 0.09, vol: 0.32, type: 'bandpass', freq: 1800, q: 0.8 });
    tone({ type: 'sine', freq: 240 * vary(), to: 110, dur: 0.1, vol: 0.18 });
  },
  /** A loaf bouncing off someone: a soft doughy bop. */
  breadBop() {
    tone({ type: 'sine', freq: 190 * vary(), to: 90, dur: 0.12, vol: 0.26 });
    noise({ dur: 0.08, vol: 0.12, type: 'lowpass', freq: 900, to: 300 });
  },
  /** Loaves and fishes raining down onto a growing pile. */
  foodPatter() {
    const t = now();
    for (let i = 0; i < 5; i++) {
      const at = t + Math.random() * 0.2;
      if (Math.random() < 0.5) tone({ type: 'sine', freq: 170 + Math.random() * 60, to: 80, dur: 0.08, vol: 0.12, at });
      else noise({ dur: 0.05, vol: 0.12, type: 'bandpass', freq: 1500 + Math.random() * 800, q: 1, at });
    }
  },
  /** The last fish flopping on top of the pile. */
  fishFlop() {
    const t = now();
    for (let i = 0; i < 6; i++) {
      noise({ dur: 0.05, vol: 0.2 - i * 0.025, type: 'bandpass', freq: 1600, q: 1, at: t + i * 0.16 });
      tone({ type: 'sine', freq: 260, to: 140, dur: 0.06, vol: 0.08 - i * 0.01, at: t + i * 0.16 });
    }
  },
};
