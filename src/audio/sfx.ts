import { ac, noise, tone, voice } from './audio';

/** Small random pitch drift so repeated hits never sound identical. */
const vary = (amt = 0.08) => 1 + (Math.random() * 2 - 1) * amt;

/** Maps an attack's damage to a sound strength tier: 0 light, 1 medium, 2 heavy. */
export const strengthOf = (dmg: number) => (dmg < 40 ? 0 : dmg < 70 ? 1 : 2);

// Procedural sound effects. Each one layers a few oscillators and filtered noise bursts.
export const sfx = {
  /** Swing of an attack. strength 0 = light, 1 = medium, 2 = heavy. Kicks sit lower and push more air. */
  whoosh(strength = 0, kick = false) {
    const c = ac();
    if (!c) return;
    const s = Math.max(0, Math.min(2, strength | 0));
    const v = vary();
    const lo = (kick ? 300 : 450) * v, hi = (kick ? 1800 : 3200 - s * 500) * v;
    const dur = [0.1, 0.15, 0.22][s] * (kick ? 1.15 : 1);
    // Main air sweep: rises then falls, like a limb cutting past the ear.
    noise({ dur: dur * 0.55, vol: [0.12, 0.17, 0.22][s], type: 'bandpass', freq: lo, to: hi, q: 1.4, attack: dur * 0.3 });
    noise({ dur: dur * 0.6, vol: [0.06, 0.1, 0.15][s], type: 'bandpass', freq: hi, to: lo, q: 1.2, at: c.currentTime + dur * 0.45 });
    // Medium and heavy swings carry a low body of moving air.
    if (s >= 1) noise({ dur, vol: s === 2 ? 0.16 : 0.09, type: 'lowpass', freq: 250 * v, to: 700 * v, attack: dur * 0.4 });
    if (s === 2) tone({ type: 'sine', freq: 140 * v, to: 70, dur: dur * 0.9, vol: 0.06, attack: dur * 0.35 });
  },
  /** Connecting hit. strength 0 = light jab, 1 = medium, 2 = heavy, 3 = launcher (uppercut, roundhouse). */
  hit(strength: number | boolean = 0, kick = false) {
    const c = ac();
    if (!c) return;
    const s = typeof strength === 'boolean' ? (strength ? 2 : 0) : Math.max(0, Math.min(3, strength | 0));
    const v = vary();
    const t = c.currentTime;
    const body = (kick ? 140 : 190) * v;
    // Knuckle/shin crack: a very short bright transient.
    noise({ dur: 0.025 + s * 0.01, vol: 0.35 + s * 0.08, type: 'highpass', freq: (kick ? 2200 : 3200) * v });
    // Flesh smack: band-limited noise sweeping down.
    noise({ dur: [0.07, 0.1, 0.15, 0.2][s], vol: [0.32, 0.4, 0.5, 0.55][s], type: 'bandpass', freq: (kick ? 1400 : 2000) * v, to: 280, q: 1.1 });
    // Body thump: a pitched-down sine gives the punch weight.
    tone({ type: 'sine', freq: body * (1 + s * 0.1), to: 40, dur: [0.09, 0.14, 0.22, 0.3][s], vol: [0.4, 0.5, 0.62, 0.7][s] });
    if (s >= 1) tone({ type: 'triangle', freq: body * 2.1, to: body * 0.6, dur: 0.06, vol: 0.12 });
    if (s >= 2) {
      // Crunch: gritty square under a lowpass, and a sub boom.
      tone({ type: 'square', freq: 95 * v, to: 38, dur: 0.14, vol: 0.14, filter: { type: 'lowpass', freq: 1000, to: 200 } });
      tone({ type: 'sine', freq: 70, to: 30, dur: 0.35, vol: 0.4 });
      noise({ dur: 0.12, vol: 0.18, type: 'bandpass', freq: 600, to: 200, q: 2, at: t + 0.03 });
    }
    if (s === 3) {
      // Launcher: bone-crack layer plus a slapback echo so it rings through the arena.
      tone({ type: 'sawtooth', freq: 260 * v, to: 60, dur: 0.12, vol: 0.12, filter: { type: 'lowpass', freq: 1800 } });
      noise({ dur: 0.04, vol: 0.3, type: 'highpass', freq: 2500, at: t + 0.02 });
      for (let i = 1; i <= 2; i++) {
        noise({ dur: 0.1, vol: 0.14 / i, type: 'bandpass', freq: 1200, to: 300, q: 1, at: t + i * 0.09 });
        tone({ type: 'sine', freq: body, to: 45, dur: 0.15, vol: 0.18 / i, at: t + i * 0.09 });
      }
    }
  },
  slash() {
    noise({ dur: 0.18, vol: 0.4, type: 'highpass', freq: 3000, to: 1200, q: 2 });
    tone({ type: 'sawtooth', freq: 1400, to: 300, dur: 0.15, vol: 0.12 });
    sfx.hit(2);
  },
  /** Guarded hit: a dull forearm thud with a short metallic chip. Heavier blocks ring longer and push harder. */
  block(heavy = false) {
    const v = vary();
    noise({ dur: 0.04, vol: 0.22, type: 'highpass', freq: 4200 * v });
    tone({ type: 'square', freq: 880 * v, to: 820 * v, dur: heavy ? 0.12 : 0.07, vol: 0.09, filter: { type: 'bandpass', freq: 1800, q: 3 } });
    tone({ type: 'triangle', freq: 1330 * v, dur: heavy ? 0.1 : 0.05, vol: 0.07 });
    tone({ type: 'sine', freq: 2210 * v, dur: heavy ? 0.16 : 0.08, vol: 0.04 });
    tone({ type: 'sine', freq: (heavy ? 130 : 170) * v, to: 70, dur: heavy ? 0.14 : 0.08, vol: heavy ? 0.35 : 0.22 });
    if (heavy) noise({ dur: 0.12, vol: 0.18, type: 'lowpass', freq: 900, to: 200 });
  },
  blood() {
    noise({ dur: 0.25, vol: 0.25, freq: 900, to: 150, q: 3 });
  },
  land() {
    tone({ type: 'sine', freq: 110, to: 50, dur: 0.1, vol: 0.25 });
  },
  thud() {
    tone({ type: 'sine', freq: 90, to: 35, dur: 0.3, vol: 0.6 });
    noise({ dur: 0.25, vol: 0.35, freq: 600, to: 100 });
  },
  jump() {
    noise({ dur: 0.08, vol: 0.06, type: 'bandpass', freq: 800, to: 1600 });
  },
  zap(dur = 0.35) {
    const c = ac();
    if (!c) return;
    for (let i = 0; i < 6; i++)
      tone({ type: 'sawtooth', freq: 120 + Math.random() * 900, to: 80 + Math.random() * 300, dur: 0.06, vol: 0.1, at: c.currentTime + i * (dur / 6) });
    noise({ dur, vol: 0.2, type: 'highpass', freq: 2500 });
  },
  fire() {
    noise({ dur: 0.5, vol: 0.35, freq: 400, to: 1400, q: 1, attack: 0.05 });
    tone({ type: 'sawtooth', freq: 70, to: 110, dur: 0.4, vol: 0.08, filter: { type: 'lowpass', freq: 500 } });
  },
  cannon() {
    tone({ type: 'sine', freq: 120, to: 30, dur: 0.5, vol: 0.7 });
    noise({ dur: 0.6, vol: 0.6, freq: 1200, to: 80 });
  },
  explode() {
    tone({ type: 'sine', freq: 90, to: 20, dur: 1.2, vol: 0.8 });
    noise({ dur: 1.4, vol: 0.8, freq: 3000, to: 60, attack: 0.01 });
    noise({ dur: 0.6, vol: 0.4, type: 'highpass', freq: 2000 });
  },
  hatSpin() {
    noise({ dur: 0.35, vol: 0.12, type: 'bandpass', freq: 1200, to: 2500, q: 4 });
  },
  teleport() {
    tone({ type: 'sine', freq: 300, to: 2400, dur: 0.25, vol: 0.2 });
    tone({ type: 'square', freq: 600, to: 4800, dur: 0.25, vol: 0.05 });
  },
  roll() {
    noise({ dur: 0.4, vol: 0.18, freq: 300, to: 200 });
  },
  impale() {
    noise({ dur: 0.3, vol: 0.5, freq: 2500, to: 300 });
    tone({ type: 'square', freq: 160, to: 60, dur: 0.25, vol: 0.2 });
    sfx.blood();
  },
  gong() {
    const c = ac();
    if (!c) return;
    for (const [f, v] of [[98, 0.4], [196 * 1.01, 0.2], [293 * 0.99, 0.12], [415, 0.08], [587, 0.05]])
      tone({ type: 'sine', freq: f, to: f * 0.98, dur: 2.5, vol: v, attack: 0.005 });
    noise({ dur: 0.3, vol: 0.2, freq: 3000, to: 400 });
  },
  grunt() {
    voice(160 + Math.random() * 40, 110, 0.18, 0.22, [600, 1000, 2400]);
  },
  scream() {
    voice(520, 160, 1.2, 0.3, [800, 1200, 2600]);
  },
  menuMove() {
    tone({ type: 'square', freq: 660, dur: 0.05, vol: 0.08 });
  },
  menuPick() {
    tone({ type: 'square', freq: 523, dur: 0.07, vol: 0.1 });
    const c = ac();
    if (c) tone({ type: 'square', freq: 784, dur: 0.12, vol: 0.1, at: c.currentTime + 0.07 });
  },
  boom() {
    tone({ type: 'sine', freq: 60, to: 30, dur: 0.9, vol: 0.6 });
    noise({ dur: 0.7, vol: 0.25, freq: 500, to: 60 });
  },
};

// Announcer: uses the browser's built-in speech synthesis (deep and slow) with a synth boom under it.
let voicePick: SpeechSynthesisVoice | null = null;
export function announce(text: string) {
  sfx.boom();
  const ss = window.speechSynthesis;
  if (!ss) return;
  try {
    if (!voicePick) {
      const vs = ss.getVoices();
      voicePick = vs.find((v) => /en/i.test(v.lang) && /male|daniel|fred|alex|david|george/i.test(v.name)) ?? vs.find((v) => /en/i.test(v.lang)) ?? null;
    }
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voicePick) u.voice = voicePick;
    u.pitch = 0.1;
    u.rate = 0.8;
    u.volume = 1;
    ss.speak(u);
  } catch {
    /* speech is optional */
  }
}
