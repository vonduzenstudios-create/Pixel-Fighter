import { ac, noise, tone, voice } from './audio';

// Procedural sound effects. Each one layers a few oscillators and filtered noise bursts.
export const sfx = {
  whoosh(heavy = false) {
    noise({ dur: heavy ? 0.2 : 0.13, vol: heavy ? 0.22 : 0.14, type: 'bandpass', freq: 500, to: heavy ? 2400 : 3200, q: 1.5 });
  },
  hit(heavy = false) {
    tone({ type: 'sine', freq: heavy ? 170 : 220, to: 45, dur: heavy ? 0.22 : 0.12, vol: heavy ? 0.65 : 0.45 });
    noise({ dur: heavy ? 0.18 : 0.09, vol: heavy ? 0.5 : 0.35, freq: heavy ? 1800 : 2600, to: 300 });
    if (heavy) tone({ type: 'square', freq: 90, to: 40, dur: 0.12, vol: 0.12, filter: { type: 'lowpass', freq: 900 } });
  },
  slash() {
    noise({ dur: 0.18, vol: 0.4, type: 'highpass', freq: 3000, to: 1200, q: 2 });
    tone({ type: 'sawtooth', freq: 1400, to: 300, dur: 0.15, vol: 0.12 });
    sfx.hit(true);
  },
  block() {
    tone({ type: 'square', freq: 980, to: 900, dur: 0.07, vol: 0.12 });
    tone({ type: 'square', freq: 1470, dur: 0.05, vol: 0.08 });
    noise({ dur: 0.05, vol: 0.2, type: 'highpass', freq: 4000 });
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

// Speech uses the browser's built-in synthesiser; every caller must cope with it being missing.
export interface SpeechOpts {
  /** 0..2, 1 is the voice's normal pitch. */
  pitch: number;
  /** 0.1..10, 1 is normal speed. */
  rate: number;
  /** Prefer a higher, female system voice. */
  female?: boolean;
}

const MALE = /male|daniel|fred|alex|david|george|mark|james/i;
const FEMALE = /female|samantha|victoria|karen|zira|susan|moira|tessa|fiona|hazel|serena/i;
const voiceCache = new Map<boolean, SpeechSynthesisVoice>();
function pickVoice(ss: SpeechSynthesis, female: boolean) {
  const hit = voiceCache.get(female);
  if (hit) return hit;
  const vs = ss.getVoices().filter((v) => /en/i.test(v.lang));
  const want = female ? FEMALE : MALE;
  const v = vs.find((v) => want.test(v.name) && (female || !/female/i.test(v.name))) ?? vs[0] ?? null;
  // voices load asynchronously in some browsers, so only remember a real pick
  if (v) voiceCache.set(female, v);
  return v;
}

/** Speak a line. Returns false when speech synthesis is unavailable. */
export function say(text: string, o: SpeechOpts): boolean {
  const ss = window.speechSynthesis;
  if (!ss) return false;
  try {
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(ss, !!o.female);
    if (v) u.voice = v;
    u.pitch = o.pitch;
    u.rate = o.rate;
    u.volume = 1;
    ss.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function speaking() {
  try {
    return !!window.speechSynthesis?.speaking;
  } catch {
    return false;
  }
}

export function hush() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* speech is optional */
  }
}

/** Chiptune "voice": one formant blip per syllable around the character's grunt pitch. */
export function bark(text: string, pitch: number, vol = 0.2) {
  const c = ac();
  if (!c) return;
  const vowels = [[700, 1150, 2500], [400, 2000, 2600], [300, 900, 2300], [500, 1500, 2500]];
  const syl = text.toLowerCase().match(/[aeiouy]+/g) ?? ['a'];
  let t = c.currentTime;
  syl.forEach((v, i) => {
    const f = pitch * (1 + 0.25 * Math.sin(i * 1.7)) * (i === syl.length - 1 ? 0.85 : 1);
    const d = 0.07 + v.length * 0.03;
    voice(f, f * 0.9, d, vol, vowels['aeiouy'.indexOf(v[0]) % 4], t);
    t += d + 0.025;
  });
}

// Announcer: deep and slow speech with a synth boom under it.
export function announce(text: string) {
  sfx.boom();
  say(text, { pitch: 0.1, rate: 0.8 });
}
