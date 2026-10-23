import { ac, noise, tone } from '../../audio/audio';

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

/** Miss Cleo's own sound cues (psychic props and the hotline). */
export const CLEO_FX: Record<string, () => void> = {
  /** Wind chimes and a soft shimmer: the spirits arriving. */
  mysticChime() {
    const t = now();
    [1568, 1976, 2349, 2637, 3136].forEach((f, i) => tone({ type: 'sine', freq: f * vary(0.01), dur: 0.7, vol: 0.035, at: t + i * 0.07 + Math.random() * 0.03 }));
    noise({ dur: 0.6, vol: 0.025, type: 'highpass', freq: 6000, attack: 0.2 });
  },
  /** A glass ball humming with power: a low throb under a glassy whine. */
  crystalHum() {
    tone({ type: 'sine', freq: 110, to: 116, dur: 0.6, vol: 0.12, attack: 0.15 });
    tone({ type: 'triangle', freq: 880 * vary(0.02), to: 932, dur: 0.6, vol: 0.03, attack: 0.25, detune: 15 });
    tone({ type: 'sine', freq: 1760, to: 1866, dur: 0.5, vol: 0.015, attack: 0.3 });
  },
  /** Bowling the ball: a low rolling rumble with a glassy ping. */
  crystalRoll() {
    tone({ type: 'triangle', freq: 70 * vary(), to: 60, dur: 0.25, vol: 0.15 });
    noise({ dur: 0.2, vol: 0.06, freq: 300, to: 200, q: 2 });
    tone({ type: 'sine', freq: 2400 * vary(0.05), dur: 0.12, vol: 0.03 });
  },
  /** An old desk phone's bell: two quick bursts of a fast trill. */
  phoneRing() {
    const t = now();
    for (let b = 0; b < 2; b++)
      for (let i = 0; i < 9; i++) {
        tone({ type: 'square', freq: 1150, dur: 0.025, vol: 0.05, at: t + b * 0.4 + i * 0.033, filter: { type: 'bandpass', freq: 1800 } });
        tone({ type: 'square', freq: 1380, dur: 0.025, vol: 0.04, at: t + b * 0.4 + i * 0.033 + 0.016, filter: { type: 'bandpass', freq: 1800 } });
      }
  },
  /** Coiled cord whirring round overhead. */
  cordWhir() {
    noise({ dur: 0.14, vol: 0.1, type: 'bandpass', freq: 700, to: 1400, q: 3 });
  },
  /** A plastic handset cracking against a skull. */
  receiverSmack() {
    noise({ dur: 0.05, vol: 0.35, type: 'bandpass', freq: 1700, q: 2 });
    tone({ type: 'square', freq: 420 * vary(), to: 180, dur: 0.06, vol: 0.08 });
    tone({ type: 'square', freq: 1150, dur: 0.05, vol: 0.03, at: now() + 0.05 });
  },
  /** A tarot card fanned out of the deck. */
  cardFan() {
    noise({ dur: 0.05, vol: 0.12, type: 'bandpass', freq: 3600 * vary(0.2), q: 3 });
  },
  /** A heavy glass dome landing on the floor. */
  glassThud() {
    tone({ type: 'sine', freq: 95, to: 50, dur: 0.25, vol: 0.35 });
    tone({ type: 'sine', freq: 1900 * vary(0.05), dur: 0.5, vol: 0.04 });
    tone({ type: 'sine', freq: 2850 * vary(0.05), dur: 0.4, vol: 0.025 });
  },
  /** Glass splitting under pressure. */
  glassCrack() {
    noise({ dur: 0.07, vol: 0.25, type: 'highpass', freq: 3500 });
    tone({ type: 'sine', freq: 3200 * vary(0.1), to: 2600, dur: 0.15, vol: 0.04 });
  },
};
