import { ac, noise, tone, voice } from './audio';
import { sfx } from './sfx';
import type { Cue, Move, MoveSounds } from '../game/types';
import type { ProjKind } from '../game/projectile';

// Layered sound design for special moves. Every special gets a cast/windup cue on its move frames,
// and an impact (and optionally blocked) cue that plays on top of the generic hit sound.
// Projectiles get launch, travel (looping), impact and clash cues.
//
// To give a new fighter's specials their own sounds, either set `sounds` on the Move itself, or add
// an entry to MOVE_SOUNDS keyed by the move id (and PROJ_SOUNDS for a new projectile kind).
// A cue is the name of a sound in FX or sfx, a list of names to layer, or a function.

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

/** Sound building blocks used only by specials. */
export const FX: Record<string, () => void> = {
  // ---------------------------------------------------------------- generic windups
  /** Sharp intake of breath before a big move. */
  inhale() {
    noise({ dur: 0.22, vol: 0.12, type: 'bandpass', freq: 900, to: 2200, q: 2, attack: 0.15 });
  },
  /** Effortful grunt for heavy windups. */
  heave() {
    voice(140 * vary(), 95, 0.22, 0.2, [550, 950, 2300]);
  },
  /** Low war cry for charges. */
  warCry() {
    voice(220 * vary(), 260, 0.45, 0.22, [700, 1150, 2600]);
  },
  /** Ki/chi build-up: a shimmering rising tone. */
  chi() {
    tone({ type: 'sine', freq: 400, to: 1600, dur: 0.3, vol: 0.08, attack: 0.2 });
    tone({ type: 'triangle', freq: 800, to: 3200, dur: 0.3, vol: 0.04, attack: 0.2, detune: 12 });
    noise({ dur: 0.3, vol: 0.05, type: 'highpass', freq: 5000, attack: 0.2 });
  },
  /** Blade drawn or swung edge-first. */
  shing() {
    noise({ dur: 0.18, vol: 0.2, type: 'highpass', freq: 3000, to: 7000, q: 3 });
    tone({ type: 'sine', freq: 3100 * vary(), dur: 0.35, vol: 0.05 });
    tone({ type: 'sine', freq: 4700 * vary(), dur: 0.25, vol: 0.03 });
  },
  stomp() {
    tone({ type: 'sine', freq: 90 * vary(), to: 45, dur: 0.1, vol: 0.25 });
    noise({ dur: 0.06, vol: 0.12, freq: 500, to: 150 });
  },
  /** Heavy wooden object rolling over planks. */
  rumble() {
    tone({ type: 'triangle', freq: 55 * vary(), to: 48, dur: 0.3, vol: 0.18 });
    noise({ dur: 0.3, vol: 0.12, freq: 260, to: 180, q: 2 });
  },
  /** Creaking wood as an axe handle flexes. */
  creak() {
    tone({ type: 'sawtooth', freq: 180 * vary(), to: 120, dur: 0.18, vol: 0.06, filter: { type: 'bandpass', freq: 900, q: 6 } });
  },
  // ---------------------------------------------------------------- electricity
  /** Tesla coil charging: a hum that climbs in pitch with crackle on top. */
  charge() {
    tone({ type: 'sawtooth', freq: 60, to: 240, dur: 0.35, vol: 0.08, filter: { type: 'lowpass', freq: 1200 }, attack: 0.25 });
    tone({ type: 'square', freq: 120, to: 480, dur: 0.35, vol: 0.03, attack: 0.25 });
    noise({ dur: 0.35, vol: 0.08, type: 'highpass', freq: 3500, attack: 0.2 });
  },
  crackle() {
    const t = now();
    for (let i = 0; i < 3; i++) noise({ dur: 0.02, vol: 0.1, type: 'highpass', freq: 3000 + Math.random() * 3000, at: t + Math.random() * 0.12 });
  },
  /** Electrocution on contact: harsh buzz plus snapping arcs. */
  elecHit() {
    tone({ type: 'square', freq: 110, to: 90, dur: 0.25, vol: 0.12, filter: { type: 'lowpass', freq: 2400 } });
    tone({ type: 'sawtooth', freq: 1800 * vary(), to: 300, dur: 0.12, vol: 0.08 });
    FX.crackle();
  },
  /** Reappearing out of thin air. */
  popIn() {
    tone({ type: 'sine', freq: 2400, to: 300, dur: 0.18, vol: 0.18 });
    noise({ dur: 0.05, vol: 0.2, type: 'highpass', freq: 2500 });
  },
  // ---------------------------------------------------------------- fire and holy
  /** A short sung chord as holy power gathers. */
  choir() {
    sfx.sing([[12, 2], [16, 3]], 0.08, 0.14);
    tone({ type: 'sine', freq: 880, dur: 0.5, vol: 0.04, attack: 0.15 });
  },
  fireCrackle() {
    const t = now();
    for (let i = 0; i < 2; i++) noise({ dur: 0.03, vol: 0.08, type: 'bandpass', freq: 1500 + Math.random() * 1500, q: 3, at: t + Math.random() * 0.1 });
    noise({ dur: 0.15, vol: 0.05, freq: 500, to: 900 });
  },
  /** Fireball bursting on a body. */
  flameBurst() {
    noise({ dur: 0.4, vol: 0.4, freq: 300, to: 2400, q: 1, attack: 0.02 });
    tone({ type: 'sine', freq: 110, to: 40, dur: 0.3, vol: 0.35 });
    FX.fireCrackle();
  },
  // ---------------------------------------------------------------- powder and wood
  fuse() {
    noise({ dur: 0.4, vol: 0.1, type: 'highpass', freq: 4500, to: 6000 });
    FX.crackle();
  },
  /** Falling whistle of a cannonball in flight. */
  whistle() {
    tone({ type: 'sine', freq: 1800 * vary(), to: 1100, dur: 0.5, vol: 0.04 });
  },
  /** Axe biting into a body. */
  chop() {
    noise({ dur: 0.12, vol: 0.4, type: 'bandpass', freq: 1100, to: 400, q: 2 });
    tone({ type: 'square', freq: 120, to: 50, dur: 0.15, vol: 0.18, filter: { type: 'lowpass', freq: 800 } });
  },
  /** Solid wooden clack: nunchaku and log. */
  clack() {
    tone({ type: 'square', freq: 900 * vary(), to: 600, dur: 0.04, vol: 0.12, filter: { type: 'bandpass', freq: 1500, q: 4 } });
    noise({ dur: 0.04, vol: 0.2, type: 'bandpass', freq: 2200 * vary(), q: 5 });
  },
  chainRattle() {
    const t = now();
    for (let i = 0; i < 4; i++) noise({ dur: 0.025, vol: 0.08, type: 'bandpass', freq: 5000 * vary(0.2), q: 8, at: t + i * 0.035 });
  },
  // ---------------------------------------------------------------- metal
  /** Steel on steel: inharmonic partials ring out. */
  clang() {
    const v = vary();
    for (const [f, vol, d] of [[523, 0.1, 0.6], [1307, 0.07, 0.5], [2093, 0.05, 0.4], [3271, 0.03, 0.3]])
      tone({ type: 'sine', freq: f * v, dur: d, vol, attack: 0.002 });
    noise({ dur: 0.05, vol: 0.25, type: 'highpass', freq: 3500 });
  },
  // ---------------------------------------------------------------- martial arts
  /** Bone-rattling crack for a perfect strike. */
  boneCrack() {
    noise({ dur: 0.05, vol: 0.4, type: 'highpass', freq: 2000 });
    tone({ type: 'square', freq: 220 * vary(), to: 70, dur: 0.1, vol: 0.14, filter: { type: 'lowpass', freq: 1400 } });
    tone({ type: 'sine', freq: 60, to: 30, dur: 0.3, vol: 0.35 });
  },
  bootThud() {
    tone({ type: 'sine', freq: 130 * vary(), to: 60, dur: 0.07, vol: 0.2 });
    noise({ dur: 0.04, vol: 0.15, type: 'bandpass', freq: 1200, q: 2 });
  },
  // ---------------------------------------------------------------- wind
  wind() {
    noise({ dur: 0.35, vol: 0.12, type: 'bandpass', freq: 500 * vary(0.2), to: 900, q: 3, attack: 0.1 });
  },
  windHit() {
    noise({ dur: 0.3, vol: 0.35, type: 'lowpass', freq: 1500, to: 200 });
    tone({ type: 'sine', freq: 100, to: 40, dur: 0.25, vol: 0.3 });
  },
  // ---------------------------------------------------------------- money and opera
  coins() {
    const t = now();
    for (let i = 0; i < 4; i++) tone({ type: 'square', freq: 2400 + Math.random() * 1600, dur: 0.05, vol: 0.04, at: t + i * 0.04 + Math.random() * 0.02 });
  },
  /** Big paper check flapping through the air. */
  paperFlap() {
    noise({ dur: 0.15, vol: 0.12, type: 'bandpass', freq: 1800, to: 900, q: 1.5 });
  },
  paperSlap() {
    noise({ dur: 0.08, vol: 0.35, type: 'bandpass', freq: 2500, to: 1000, q: 1.2 });
    tone({ type: 'sine', freq: 160, to: 60, dur: 0.12, vol: 0.25 });
  },
  /** High note that rattles the target: glassy ringing partials. */
  shatter() {
    const t = now();
    for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: 2000 + Math.random() * 3000, dur: 0.3, vol: 0.04, at: t + i * 0.03 });
    noise({ dur: 0.2, vol: 0.15, type: 'highpass', freq: 4000 });
  },
};

/** Per-special sound design, keyed by move id. */
export const MOVE_SOUNDS: Record<string, MoveSounds> = {
  // Lincoln
  proj_hat: { frames: { 1: 'inhale' } },
  railsplit: { frames: { 1: 'heave', 6: 'creak' }, impact: 'chop', blocked: 'clack' },
  logroll: { frames: { 1: 'heave', 6: 'rumble', 14: 'rumble', 22: 'rumble' }, impact: ['clack', 'thud'] },
  // Tesla
  proj_bolt: { frames: { 1: 'charge' } },
  teleport: { frames: { 15: 'popIn', 24: 'crackle' }, impact: 'elecHit' },
  acfield: { frames: { 1: 'charge', 14: 'crackle', 22: 'crackle', 30: 'crackle' }, impact: 'elecHit' },
  // Joan
  proj_holy: { frames: { 1: 'choir' } },
  charge: { frames: { 1: 'shing', 4: 'warCry', 8: 'stomp', 13: 'stomp', 18: 'stomp' }, impact: 'clang', blocked: 'clang' },
  ascend: { frames: { 0: 'shing' }, impact: 'flameBurst', blocked: 'clang' },
  // Blackbeard
  proj_cannon: { frames: { 1: 'fuse' } },
  proj_keg: { frames: { 1: 'fuse' } },
  cyclone: { frames: { 1: 'shing' }, impact: 'chop', blocked: 'clang' },
  // Bruce Lee
  inchpunch: { frames: { 1: 'chi' }, impact: 'boneCrack' },
  dragonkick: { frames: { 0: 'chi' }, impact: 'boneCrack' },
  nunchaku: { frames: { 1: 'chainRattle', 13: 'chainRattle', 25: 'chainRattle' }, impact: 'clack', blocked: 'clack' },
  // Chuck Norris
  proj_gust: { frames: { 1: 'inhale' } },
  tornado: { frames: { 0: 'heave' }, impact: 'boneCrack' },
  flurry: { frames: { 1: 'heave' }, impact: 'bootThud' },
  // Monty Lumpsum
  proj_cash: { frames: { 1: 'coins' } },
  proj_aria: { frames: { 1: 'inhale' } },
  checkslam: { frames: { 1: 'paperFlap', 8: 'heave' }, impact: 'paperSlap' },
};

export interface ProjSounds {
  /** When the projectile leaves the hand (layered on the move's own release sound). */
  launch?: Cue;
  /** Repeats every `every` frames while it flies. */
  travel?: { every: number; cue: Cue };
  impact?: Cue;
  blocked?: Cue;
  /** Two projectiles cancelling each other out. */
  clash?: Cue;
}

export const PROJ_SOUNDS: Partial<Record<ProjKind, ProjSounds>> = {
  hat: { impact: 'clack' },
  bolt: { travel: { every: 8, cue: 'crackle' }, impact: 'elecHit', blocked: 'crackle' },
  holy: { travel: { every: 10, cue: 'fireCrackle' }, impact: 'flameBurst' },
  cannon: { travel: { every: 30, cue: 'whistle' }, impact: 'cannon', blocked: 'cannon' },
  keg: { travel: { every: 14, cue: 'rumble' }, impact: 'cannon', blocked: 'cannon' },
  gust: { travel: { every: 9, cue: 'wind' }, impact: 'windHit' },
  cash: { travel: { every: 14, cue: 'coins' }, impact: ['kaching', 'paperSlap'], blocked: 'kaching' },
  aria: { impact: 'shatter' },
};

/** Plays a cue: a sound name (special FX first, then the shared sfx), a list to layer, or a function. */
export function playCue(cue: Cue | undefined) {
  if (!cue) return;
  if (typeof cue === 'function') return cue();
  if (Array.isArray(cue)) return cue.forEach(playCue);
  (FX[cue] ?? (sfx as Record<string, unknown>)[cue] as (() => void) | undefined)?.();
}

export function moveSounds(m: Move | null | undefined): MoveSounds | undefined {
  return m ? m.sounds ?? MOVE_SOUNDS[m.id] : undefined;
}
