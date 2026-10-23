import { ac, noise, tone } from '../../audio/audio';

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

/** Vex Vector's own sound cues: a wrist keyboard, data packets, glitches and a firewall. */
export const VEX_FX: Record<string, () => void> = {
  /** A burst of clacky keys on the wrist deck. */
  keyTap() {
    const t = now();
    for (let i = 0; i < 4; i++) {
      noise({ dur: 0.018, vol: 0.14, type: 'bandpass', freq: 2600 * vary(0.25), q: 4, at: t + i * 0.045 + Math.random() * 0.012 });
      tone({ type: 'square', freq: 180 * vary(0.2), dur: 0.012, vol: 0.03, at: t + i * 0.045 });
    }
  },
  /** One heavy Enter key. */
  enterKey() {
    noise({ dur: 0.04, vol: 0.28, type: 'bandpass', freq: 1500, q: 2 });
    tone({ type: 'square', freq: 110, to: 70, dur: 0.06, vol: 0.08 });
  },
  /** A data packet fired off: a rising chiptune chirp and a fizz. */
  packetSend() {
    tone({ type: 'square', freq: 440 * vary(0.03), to: 1760, dur: 0.12, vol: 0.07 });
    tone({ type: 'square', freq: 880, to: 2640, dur: 0.1, vol: 0.04, at: now() + 0.05 });
    noise({ dur: 0.14, vol: 0.08, type: 'highpass', freq: 4000 });
  },
  /** The packet in flight: a quick run of bit-blips. */
  dataStream() {
    const t = now();
    for (let i = 0; i < 4; i++) tone({ type: 'square', freq: (Math.random() < 0.5 ? 1200 : 1800) * vary(0.02), dur: 0.02, vol: 0.025, at: t + i * 0.03 });
  },
  /** A packet bursting into stray bits. */
  packetPop() {
    tone({ type: 'square', freq: 2200, to: 220, dur: 0.12, vol: 0.08 });
    noise({ dur: 0.1, vol: 0.2, type: 'bandpass', freq: 3000, to: 900, q: 2 });
  },
  /** Breaking up into glitchy blocks: a stuttering bitcrushed sweep down. */
  glitchOut() {
    const t = now();
    for (let i = 0; i < 6; i++) tone({ type: 'square', freq: 1600 / (i + 1) * vary(0.1), dur: 0.03, vol: 0.06, at: t + i * 0.035 });
    noise({ dur: 0.22, vol: 0.12, type: 'bandpass', freq: 1800, to: 300, q: 1.5 });
  },
  /** Snapping back together somewhere else: the same stutter sweeping up. */
  glitchIn() {
    const t = now();
    for (let i = 0; i < 6; i++) tone({ type: 'square', freq: 200 * (i + 1) * vary(0.1), dur: 0.03, vol: 0.06, at: t + i * 0.03 });
    noise({ dur: 0.18, vol: 0.12, type: 'bandpass', freq: 400, to: 2400, q: 1.5 });
  },
  /** The firewall bursting out of the floor: a digital roar. */
  firewallRise() {
    tone({ type: 'sawtooth', freq: 55, to: 140, dur: 0.4, vol: 0.12, filter: { type: 'lowpass', freq: 1200 } });
    noise({ dur: 0.5, vol: 0.22, type: 'bandpass', freq: 600, to: 2400, q: 1.2 });
    tone({ type: 'square', freq: 880, to: 1320, dur: 0.3, vol: 0.025, at: now() + 0.05 });
  },
  /** Crackling code-flames. */
  firewallCrackle() {
    const t = now();
    for (let i = 0; i < 3; i++) noise({ dur: 0.03, vol: 0.12, type: 'highpass', freq: 2500 * vary(0.3), at: t + i * 0.05 + Math.random() * 0.02 });
  },
  /** A plastic mouse click. */
  mouseClick() {
    noise({ dur: 0.012, vol: 0.3, type: 'highpass', freq: 3500 });
    noise({ dur: 0.012, vol: 0.2, type: 'highpass', freq: 3000, at: now() + 0.07 });
  },
  /** A cheerful-sounding system chime that means something terrible. */
  dialogChime() {
    const t = now();
    [659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.25, vol: 0.06, at: t + i * 0.09 }));
  },
  /** The low buzz of a stern error box. */
  errorBuzz() {
    tone({ type: 'square', freq: 196, dur: 0.25, vol: 0.07, filter: { type: 'lowpass', freq: 1400 } });
    tone({ type: 'square', freq: 185, dur: 0.25, vol: 0.05, filter: { type: 'lowpass', freq: 1400 } });
  },
  /** A chunk of the loser deleted: a short descending bit-crunch. */
  deleteChunk() {
    tone({ type: 'square', freq: 1400 * vary(0.1), to: 90, dur: 0.1, vol: 0.07 });
    noise({ dur: 0.08, vol: 0.16, type: 'bandpass', freq: 1200 * vary(0.2), to: 300, q: 2 });
  },
  /** Old hard-drive grinding while the progress bar fills. */
  driveGrind() {
    const t = now();
    for (let i = 0; i < 5; i++) noise({ dur: 0.025, vol: 0.1, type: 'bandpass', freq: 900 * vary(0.3), q: 6, at: t + i * 0.06 + Math.random() * 0.02 });
    tone({ type: 'sine', freq: 120, dur: 0.3, vol: 0.04 });
  },
};
