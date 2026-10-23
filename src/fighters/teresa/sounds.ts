import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';

// Sound cues for Mother Teresa's moves: bells, a choir hum, a harp and a doughy loaf.
const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

export const TERESA_FX: Record<string, () => void> = {
  /** A small church bell: a struck partial stack with a long, soft tail. */
  blessBell() {
    const f = 660 * vary(0.02);
    tone({ type: 'sine', freq: f, dur: 1.4, vol: 0.12 });
    tone({ type: 'sine', freq: f * 2.0, dur: 0.9, vol: 0.05 });
    tone({ type: 'sine', freq: f * 2.76, dur: 0.6, vol: 0.03 });
    tone({ type: 'sine', freq: f * 0.5, dur: 1.2, vol: 0.05, attack: 0.02 });
  },
  /** A bright little chime, for each pulse of the prayer circle. */
  chime() {
    const f = [1320, 1480, 1760][Math.floor(Math.random() * 3)];
    tone({ type: 'sine', freq: f, dur: 0.5, vol: 0.06 });
    tone({ type: 'triangle', freq: f * 2, dur: 0.25, vol: 0.02 });
  },
  /** A warm sustained choir "ahh" with a soft pad under it. */
  haloHum() {
    sfx.sing([[0, 6]], 0.12, 0.07);
    sfx.sing([[7, 6]], 0.12, 0.05);
    tone({ type: 'sine', freq: 220, dur: 0.9, vol: 0.05, attack: 0.25 });
    tone({ type: 'sine', freq: 330, dur: 0.9, vol: 0.03, attack: 0.3 });
  },
  /** A harp sweeping up a major arpeggio. */
  harpGliss() {
    const t = now();
    [0, 4, 7, 12, 16, 19, 24, 28].forEach((n, i) => {
      const f = 392 * Math.pow(2, n / 12);
      tone({ type: 'triangle', freq: f, dur: 0.6, vol: 0.05, at: t + i * 0.06 });
      tone({ type: 'sine', freq: f * 2, dur: 0.3, vol: 0.015, at: t + i * 0.06 });
    });
  },
  /** Both palms shoving forward: a quick rush of air and a low push. */
  palmShove() {
    noise({ dur: 0.16, vol: 0.18, type: 'bandpass', freq: 700, to: 1800, q: 1.5 });
    tone({ type: 'sine', freq: 140 * vary(), to: 80, dur: 0.12, vol: 0.12 });
  },
  /** A crusty loaf landing: a soft doughy thud and a scatter of crumbs. */
  breadThump() {
    tone({ type: 'sine', freq: 170 * vary(), to: 70, dur: 0.12, vol: 0.3 });
    noise({ dur: 0.1, vol: 0.18, type: 'lowpass', freq: 900, to: 300 });
    const t = now();
    for (let i = 0; i < 5; i++) noise({ dur: 0.015, vol: 0.06, type: 'highpass', freq: 3500 + Math.random() * 2500, at: t + 0.04 + Math.random() * 0.12 });
  },
};
