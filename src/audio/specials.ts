import { ac, noise, tone, voice } from './audio';
import { sfx } from './sfx';
import type { Cue, Move, MoveSounds } from '../game/types';
import type { ProjKind } from '../game/projectile';

// Layered sound design for special moves. Every special gets a cast/windup cue on its move frames,
// and an impact (and optionally blocked) cue that plays on top of the generic hit sound.
// Projectiles get launch, travel (looping), impact and clash cues.
//
// To give a new fighter's specials their own sounds, either set `sounds` on the Move itself, or add
// an entry to MOVE_SOUNDS under the character id and move id (and PROJ_SOUNDS for a new projectile kind).
// A cue is the name of a sound in FX or sfx, a list of names to layer, or a function.

const vary = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
const now = () => ac()?.currentTime ?? 0;

function snort(delay: number) {
  const t = now() + delay;
  noise({ dur: 0.14, vol: 0.3, type: 'bandpass', freq: 380, to: 220, q: 3, at: t });
  tone({ type: 'sawtooth', freq: 85, to: 70, dur: 0.12, vol: 0.08, at: t, filter: { type: 'lowpass', freq: 600 } });
}

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
  // ---------------------------------------------------------------- the fried-chicken colonel
  /** Startled hen: two quick nasal squawks. */
  cluck() {
    voice(620 * vary(0.1), 880, 0.07, 0.12, [900, 1900, 3200]);
    voice(700 * vary(0.1), 520, 0.11, 0.12, [900, 1900, 3200], 0.09);
  },
  /** A spinning drumstick fluttering through the air. */
  flutter() {
    noise({ dur: 0.08, vol: 0.06, type: 'bandpass', freq: 1400 * vary(0.2), q: 3 });
  },
  /** Hot oil spitting: a hiss with popping droplets on top. */
  sizzle() {
    noise({ dur: 0.5, vol: 0.14, type: 'highpass', freq: 3800, to: 5200, attack: 0.02 });
    const t = now();
    for (let i = 0; i < 6; i++) noise({ dur: 0.012, vol: 0.12, type: 'bandpass', freq: 2500 + Math.random() * 3500, q: 6, at: t + Math.random() * 0.45 });
  },
  /** A tin of seasoning shaken twice. */
  shaker() {
    const t = now();
    for (let i = 0; i < 2; i++) noise({ dur: 0.05, vol: 0.1, type: 'bandpass', freq: 6500 * vary(0.1), q: 2, at: t + i * 0.07 });
  },
  /** Cane tip rapping the floor: a woody knock with a little ring from the metal cap. */
  caneTap() {
    tone({ type: 'triangle', freq: 520 * vary(), to: 300, dur: 0.05, vol: 0.14 });
    noise({ dur: 0.03, vol: 0.12, type: 'bandpass', freq: 2600 * vary(), q: 6 });
    tone({ type: 'sine', freq: 3300 * vary(), dur: 0.12, vol: 0.02 });
  },
  /** Biting into a crisp crust. */
  bite() {
    const t = now();
    for (let i = 0; i < 4; i++) noise({ dur: 0.03, vol: 0.16, type: 'bandpass', freq: 2400 + Math.random() * 1600, q: 3, at: t + i * 0.025 });
    noise({ dur: 0.08, vol: 0.08, freq: 600, at: t + 0.08 });
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
  // ---------------------------------------------------------------- physics
  /** Deep throbbing drone of a tiny black hole. */
  drone() {
    tone({ type: 'sine', freq: 48 * vary(), to: 40, dur: 0.4, vol: 0.14, attack: 0.1 });
    tone({ type: 'triangle', freq: 97 * vary(), to: 80, dur: 0.4, vol: 0.05, attack: 0.1 });
  },
  /** Getting sucked in: reverse swell that snaps shut. */
  gravityHit() {
    noise({ dur: 0.25, vol: 0.3, type: 'bandpass', freq: 200, to: 2400, q: 2, attack: 0.2 });
    tone({ type: 'sine', freq: 50, to: 25, dur: 0.4, vol: 0.4 });
  },
  /** Electric wheelchair motor spinning up. */
  servo() {
    tone({ type: 'square', freq: 200, to: 900, dur: 0.3, vol: 0.04, filter: { type: 'lowpass', freq: 1500 } });
    tone({ type: 'sine', freq: 400, to: 1800, dur: 0.3, vol: 0.05 });
  },
  /** Metal frame crunching into a body. */
  metalCrash() {
    FX.clang();
    sfx.thud();
  },
  /** Geiger counter ticking faster and faster. */
  geiger() {
    const t = now();
    let at = 0;
    for (let i = 0; i < 10; i++) {
      noise({ dur: 0.008, vol: 0.2, type: 'highpass', freq: 3000, at: t + at });
      at += 0.06 * (1 - i / 12) * vary(0.4);
    }
  },
  // ---------------------------------------------------------------- boxing
  /** Leather glove snapping into a body. */
  glovePop() {
    noise({ dur: 0.05, vol: 0.35, type: 'bandpass', freq: 1600 * vary(), q: 1.5 });
    tone({ type: 'sine', freq: 180 * vary(), to: 80, dur: 0.08, vol: 0.25 });
  },
  /** Quick footwork: sneaker squeaks on the canvas. */
  shuffle() {
    const t = now();
    for (let i = 0; i < 3; i++) tone({ type: 'sine', freq: 2200 * vary(0.15), to: 2700, dur: 0.04, vol: 0.04, at: t + i * 0.07 });
  },
  ropeCreak() {
    tone({ type: 'sawtooth', freq: 120 * vary(), to: 90, dur: 0.35, vol: 0.06, filter: { type: 'bandpass', freq: 700, q: 8 } });
    noise({ dur: 0.3, vol: 0.05, type: 'bandpass', freq: 400, q: 4 });
  },
  // ---------------------------------------------------------------- painting
  brushTap() {
    noise({ dur: 0.05, vol: 0.12, type: 'bandpass', freq: 3000 * vary(), q: 2 });
    tone({ type: 'sine', freq: 600, to: 400, dur: 0.04, vol: 0.05 });
  },
  /** Wet paint splatting on a body. */
  splat() {
    noise({ dur: 0.15, vol: 0.35, type: 'lowpass', freq: 1800 * vary(), to: 400 });
    tone({ type: 'sine', freq: 300, to: 90, dur: 0.1, vol: 0.15 });
  },
  /** A tree bursting up through the deck. */
  woodBurst() {
    FX.chop();
    FX.creak();
    tone({ type: 'sine', freq: 80, to: 160, dur: 0.25, vol: 0.2 });
  },
  // ---------------------------------------------------------------- talk show
  /** Wrapping paper crinkling. */
  giftRustle() {
    const t = now();
    for (let i = 0; i < 4; i++) noise({ dur: 0.04, vol: 0.08, type: 'bandpass', freq: 2500 + Math.random() * 2500, q: 2, at: t + i * 0.03 + Math.random() * 0.02 });
  },
  /** Party popper: a sharp pop and a glittery tail. */
  confettiPop() {
    noise({ dur: 0.05, vol: 0.35, type: 'bandpass', freq: 1800, q: 1.2 });
    tone({ type: 'sine', freq: 500, to: 160, dur: 0.08, vol: 0.18 });
    const t = now();
    for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: 2600 + Math.random() * 2400, dur: 0.12, vol: 0.03, at: t + 0.05 + i * 0.04 });
  },
  /** A studio audience applauding: a wash of randomly timed hand claps. */
  applause() {
    const t = now();
    for (let i = 0; i < 40; i++) noise({ dur: 0.02, vol: 0.05 + Math.random() * 0.04, type: 'bandpass', freq: 1000 + Math.random() * 2500, q: 1.5, at: t + Math.random() * 0.9 });
    noise({ dur: 0.9, vol: 0.04, type: 'bandpass', freq: 1800, q: 0.8, attack: 0.15 });
  },
  /** One open-palm smack. */
  clap() {
    noise({ dur: 0.04, vol: 0.4, type: 'bandpass', freq: 1400 * vary(0.15), q: 1.4 });
    tone({ type: 'sine', freq: 220 * vary(), to: 120, dur: 0.05, vol: 0.12 });
  },
  pageFlutter() {
    const t = now();
    for (let i = 0; i < 6; i++) noise({ dur: 0.03, vol: 0.07, type: 'bandpass', freq: 3200 * vary(0.25), q: 2, at: t + i * 0.025 });
  },
  /** A heavy hardcover landing flat on a skull. */
  bookThump() {
    tone({ type: 'sine', freq: 120 * vary(), to: 45, dur: 0.18, vol: 0.4 });
    noise({ dur: 0.1, vol: 0.35, type: 'lowpass', freq: 1400, to: 300 });
    noise({ dur: 0.04, vol: 0.2, type: 'bandpass', freq: 2600, q: 2 });
  },
  /** Big V8 revving past. */
  engine() {
    tone({ type: 'sawtooth', freq: 55 * vary(), to: 95, dur: 0.45, vol: 0.12, filter: { type: 'lowpass', freq: 700 } });
    tone({ type: 'square', freq: 110 * vary(), to: 190, dur: 0.45, vol: 0.04, filter: { type: 'lowpass', freq: 900 } });
  },
  /** Tyres screeching to a stop. */
  screech() {
    tone({ type: 'sawtooth', freq: 1900, to: 1500, dur: 0.7, vol: 0.06, filter: { type: 'bandpass', freq: 2200, q: 6 } });
    noise({ dur: 0.7, vol: 0.08, type: 'bandpass', freq: 3000, to: 2000, q: 4 });
  },
  /** Short skid as a car slides to a halt (Guy Fieri's entrance calls it). */
  skid() {
    noise({ dur: 0.35, vol: 0.08, type: 'bandpass', freq: 2600, to: 1800, q: 4 });
    tone({ type: 'sawtooth', freq: 1700, to: 1300, dur: 0.3, vol: 0.04, filter: { type: 'bandpass', freq: 2000, q: 6 } });
  },
  /** Single horn honk (Guy Fieri's entrance calls it). */
  honk() {
    tone({ type: 'square', freq: 392, dur: 0.22, vol: 0.06, filter: { type: 'lowpass', freq: 1800 } });
    tone({ type: 'square', freq: 494, dur: 0.22, vol: 0.05, filter: { type: 'lowpass', freq: 1800 } });
  },
  /** Two-tone car horn: beep beep. */
  horn() {
    const t = now();
    for (const at of [0, 0.18]) {
      tone({ type: 'square', freq: 392, dur: 0.13, vol: 0.06, at: t + at, filter: { type: 'lowpass', freq: 2000 } });
      tone({ type: 'square', freq: 494, dur: 0.13, vol: 0.05, at: t + at, filter: { type: 'lowpass', freq: 2000 } });
    }
  },
  // ---------------------------------------------------------------- street magic
  /** A deck riffled through the thumb: a quick run of paper ticks. */
  cardRiffle() {
    const t = now();
    for (let i = 0; i < 14; i++) noise({ dur: 0.012, vol: 0.09 + i * 0.004, type: 'bandpass', freq: 3200 * vary(0.25), q: 3, at: t + i * 0.018 });
  },
  /** One card snapped off the fingertips. */
  cardFlick() {
    noise({ dur: 0.04, vol: 0.25, type: 'highpass', freq: 2800 });
    noise({ dur: 0.12, vol: 0.1, type: 'bandpass', freq: 2400, to: 5000, q: 2, attack: 0.02 });
  },
  /** Thin, fast whir of a spinning card. */
  cardWhir() {
    noise({ dur: 0.1, vol: 0.06, type: 'bandpass', freq: 4200 * vary(), to: 3000, q: 6 });
  },
  /** A card edge slicing in: a paper-cut zip and a thin sting. */
  cardSlice() {
    noise({ dur: 0.07, vol: 0.3, type: 'highpass', freq: 4000, to: 1800, q: 2 });
    tone({ type: 'sine', freq: 3600 * vary(), to: 2400, dur: 0.12, vol: 0.04 });
  },
  /** Levitation: a hushed, airy shimmer drifting upward. */
  levitate() {
    tone({ type: 'sine', freq: 330, to: 660, dur: 0.9, vol: 0.06, attack: 0.4 });
    tone({ type: 'sine', freq: 495, to: 990, dur: 0.9, vol: 0.04, attack: 0.5, detune: 8 });
    noise({ dur: 0.8, vol: 0.05, type: 'bandpass', freq: 1200, to: 3000, q: 4, attack: 0.4 });
  },
  /** Cold hiss of ice forming around a body. */
  freeze() {
    noise({ dur: 0.6, vol: 0.14, type: 'highpass', freq: 5000, to: 2500, attack: 0.2 });
    tone({ type: 'sine', freq: 1900, to: 2600, dur: 0.5, vol: 0.03, attack: 0.3 });
  },
  /** Ice under strain: a sharp crack with a creak. */
  iceCrack() {
    noise({ dur: 0.03, vol: 0.35, type: 'highpass', freq: 2500 });
    tone({ type: 'square', freq: 700 * vary(), to: 180, dur: 0.08, vol: 0.06, filter: { type: 'bandpass', freq: 1500, q: 3 } });
  },
  /** A block of ice bursting apart: glassy partials and a dull thump. */
  iceShatter() {
    FX.shatter();
    tone({ type: 'sine', freq: 120, to: 50, dur: 0.25, vol: 0.3 });
    noise({ dur: 0.3, vol: 0.2, type: 'bandpass', freq: 3000, to: 1200, q: 1 });
  },
  // ---------------------------------------------------------------- the tomb
  /** A swarm of beetles: fast clicking over a papery buzz. */
  buzz() {
    const t = now();
    tone({ type: 'sawtooth', freq: 180 * vary(), to: 220, dur: 0.35, vol: 0.05, filter: { type: 'bandpass', freq: 1400, q: 3 } });
    for (let i = 0; i < 8; i++) noise({ dur: 0.012, vol: 0.12, type: 'highpass', freq: 3500 + Math.random() * 2500, at: t + i * 0.04 * vary(0.3) });
  },
  /** Stone sliding on stone. */
  stoneGrind() {
    noise({ dur: 0.4, vol: 0.2, type: 'bandpass', freq: 220 * vary(), to: 160, q: 4 });
    tone({ type: 'sawtooth', freq: 48 * vary(), to: 40, dur: 0.4, vol: 0.06, filter: { type: 'lowpass', freq: 400 } });
  },
  /** Linen bandage snapping taut. */
  linenSnap() {
    noise({ dur: 0.06, vol: 0.22, type: 'bandpass', freq: 2400 * vary(), to: 900, q: 2 });
    noise({ dur: 0.03, vol: 0.12, type: 'highpass', freq: 5000 });
  },
  /** A low, ominous two-note chant from somewhere inside the tomb. */
  curseChant() {
    voice(98 * vary(0.02), 92, 0.5, 0.18, [500, 850, 2400]);
    voice(73 * vary(0.02), 70, 0.7, 0.16, [450, 800, 2400], 0.45);
    noise({ dur: 1.0, vol: 0.05, type: 'bandpass', freq: 300, to: 200, q: 3, attack: 0.3 });
  },
  /** Desert wind whipped into a twister. */
  sandWind() {
    noise({ dur: 0.5, vol: 0.16, type: 'bandpass', freq: 600, to: 1800, q: 1.5, attack: 0.15 });
    noise({ dur: 0.4, vol: 0.08, type: 'highpass', freq: 4500, attack: 0.1 });
  },
  /** Grit sprayed into a face. */
  sandHit() {
    noise({ dur: 0.18, vol: 0.28, type: 'highpass', freq: 2500 * vary(), to: 1200 });
    tone({ type: 'sine', freq: 160, to: 80, dur: 0.08, vol: 0.12 });
  },
  // ---------------------------------------------------------------- kitchen and hot rods
  /** Grill flaring up: a whoomp of gas catching. */
  flareUp() {
    noise({ dur: 0.5, vol: 0.4, type: 'lowpass', freq: 300, to: 2400, attack: 0.04 });
    tone({ type: 'sine', freq: 70, to: 140, dur: 0.35, vol: 0.3 });
    FX.fireCrackle();
  },
  /** Spatula pressing a patty flat: a metal clank and a hiss. */
  smashPress() {
    tone({ type: 'square', freq: 700 * vary(), to: 420, dur: 0.05, vol: 0.08, filter: { type: 'bandpass', freq: 1600, q: 4 } });
    noise({ dur: 0.18, vol: 0.12, type: 'highpass', freq: 4500 });
  },
  /** Two-finger whistle calling the car round. */
  whistleCall() {
    const t = now();
    tone({ type: 'sine', freq: 1900, to: 2700, dur: 0.14, vol: 0.12 });
    tone({ type: 'sine', freq: 2700, to: 2100, dur: 0.22, vol: 0.12, at: t + 0.16 });
  },
  /** V8 revving up. */
  engineRev() {
    tone({ type: 'sawtooth', freq: 45, to: 120, dur: 0.6, vol: 0.14, filter: { type: 'lowpass', freq: 500, to: 1200 } });
    tone({ type: 'square', freq: 90, to: 240, dur: 0.6, vol: 0.05, filter: { type: 'lowpass', freq: 700 } });
    noise({ dur: 0.6, vol: 0.06, type: 'bandpass', freq: 200, to: 600, q: 2 });
  },
  /** Car slamming into a body. */
  carCrash() {
    FX.clang();
    sfx.thud();
    noise({ dur: 0.3, vol: 0.3, type: 'lowpass', freq: 2000, to: 300 });
  },
  shatter() {
    const t = now();
    for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: 2000 + Math.random() * 3000, dur: 0.3, vol: 0.04, at: t + i * 0.03 });
    noise({ dur: 0.2, vol: 0.15, type: 'highpass', freq: 4000 });
  },  // ---------------------------------------------------------------- wildlife
  /** Two-finger whistle calling the animals in: a quick rise, then a long falling note. */
  callWhistle() {
    const t = now();
    tone({ type: 'sine', freq: 1500 * vary(0.03), to: 2600, dur: 0.12, vol: 0.09, at: t });
    tone({ type: 'sine', freq: 2700 * vary(0.03), to: 1700, dur: 0.38, vol: 0.1, attack: 0.02, at: t + 0.13 });
    noise({ dur: 0.5, vol: 0.03, type: 'bandpass', freq: 2400, q: 6, at: t });
  },
  /** Leaves and dry grass shuffling as something moves underneath. */
  rustle() {
    const t = now();
    for (let i = 0; i < 5; i++) noise({ dur: 0.05, vol: 0.07, type: 'bandpass', freq: 3500 * vary(0.3), q: 1.5, at: t + i * 0.05 * vary(0.4) });
  },
  /** A croc's warning: a long breathy hiss over a low growl. */
  crocHiss() {
    noise({ dur: 0.55, vol: 0.16, type: 'highpass', freq: 2200, to: 3200, attack: 0.05 });
    tone({ type: 'sawtooth', freq: 55 * vary(), to: 42, dur: 0.5, vol: 0.08, filter: { type: 'lowpass', freq: 300 } });
  },
  /** Claws scrabbling over the ground. */
  scuttle() {
    const t = now();
    for (let i = 0; i < 4; i++) noise({ dur: 0.02, vol: 0.08, type: 'bandpass', freq: 1800 * vary(0.3), q: 3, at: t + i * 0.045 });
  },
  /** Jaws slamming shut: a hollow wooden clap with a bony crack. */
  jawSnap() {
    tone({ type: 'square', freq: 320 * vary(), to: 120, dur: 0.06, vol: 0.16, filter: { type: 'bandpass', freq: 900, q: 3 } });
    noise({ dur: 0.07, vol: 0.35, type: 'bandpass', freq: 1400 * vary(), q: 2 });
    tone({ type: 'sine', freq: 90, to: 40, dur: 0.15, vol: 0.25 });
  },
  /** A deep croc bellow that rattles the floor. */
  bellow() {
    tone({ type: 'sawtooth', freq: 48, to: 36, dur: 0.9, vol: 0.14, attack: 0.08, filter: { type: 'lowpass', freq: 220 } });
    tone({ type: 'sine', freq: 31, dur: 0.9, vol: 0.3, attack: 0.08 });
    noise({ dur: 0.8, vol: 0.08, type: 'lowpass', freq: 400, to: 150, attack: 0.1 });
  },
  /** Springy take-off of a kangaroo hop. */
  rooSpring() {
    tone({ type: 'triangle', freq: 180 * vary(), to: 420, dur: 0.12, vol: 0.06 });
  },
  /** Big hind feet landing a hop. */
  hopThump() {
    tone({ type: 'sine', freq: 110 * vary(), to: 55, dur: 0.09, vol: 0.2 });
    noise({ dur: 0.04, vol: 0.08, type: 'lowpass', freq: 700 });
  },
  /** Both hind feet driving into a body. */
  rooKick() {
    FX.bootThud();
    tone({ type: 'sine', freq: 70, to: 35, dur: 0.2, vol: 0.3 });
    noise({ dur: 0.06, vol: 0.25, type: 'bandpass', freq: 900, q: 1.5 });
  },
  /** Snake hiss with a forked flicker on top. */
  snakeHiss() {
    noise({ dur: 0.45, vol: 0.14, type: 'highpass', freq: 4500, to: 6500, attack: 0.04 });
    noise({ dur: 0.08, vol: 0.06, type: 'bandpass', freq: 7000, q: 6, at: now() + 0.3 });
  },
  /** A python lashing up and wrapping on: whipping air and a heavy coil. */
  snakeStrike() {
    noise({ dur: 0.12, vol: 0.25, type: 'bandpass', freq: 1200, to: 3200, q: 1.5 });
    tone({ type: 'sine', freq: 140, to: 60, dur: 0.18, vol: 0.22 });
  },
  /** A very satisfied croc. */
  burp() {
    voice(95 * vary(), 70, 0.45, 0.3, [400, 800, 2000]);
    tone({ type: 'sawtooth', freq: 60, to: 45, dur: 0.4, vol: 0.08, filter: { type: 'lowpass', freq: 400 } });
  },
  /** Something big going down in one swallow. */
  gulp() {
    tone({ type: 'sine', freq: 260, to: 90, dur: 0.18, vol: 0.25 });
    noise({ dur: 0.12, vol: 0.1, type: 'lowpass', freq: 600, to: 200 });
  },
  // ---------------------------------------------------------------- basketball
  /** Rubber ball slapping a hardwood floor: a hollow low thump with a ping. */
  dribble() {
    tone({ type: 'sine', freq: 150 * vary(), to: 70, dur: 0.09, vol: 0.32 });
    tone({ type: 'triangle', freq: 520 * vary(), to: 300, dur: 0.05, vol: 0.07 });
    noise({ dur: 0.03, vol: 0.12, type: 'bandpass', freq: 900, q: 2 });
  },
  /** Sneakers squeaking on a polished court. */
  squeak() {
    const t = now();
    tone({ type: 'sawtooth', freq: 2400 * vary(0.1), to: 3100, dur: 0.07, vol: 0.035, filter: { type: 'bandpass', freq: 2800, q: 6 } });
    tone({ type: 'sine', freq: 2900 * vary(0.1), to: 2300, dur: 0.06, vol: 0.04, at: t + 0.06 });
  },
  /** A big body thumping into another (post-up bump). */
  bodyBump() {
    tone({ type: 'sine', freq: 85 * vary(), to: 40, dur: 0.14, vol: 0.38 });
    noise({ dur: 0.08, vol: 0.18, type: 'lowpass', freq: 700, to: 200 });
  },
  /** Net swish: a soft filtered rush that falls away. */
  swish() {
    noise({ dur: 0.35, vol: 0.22, type: 'bandpass', freq: 4200, to: 1800, q: 1.2, attack: 0.02 });
    noise({ dur: 0.2, vol: 0.06, type: 'highpass', freq: 6000, at: now() + 0.05 });
  },
  /** The rim and backboard shaking after a dunk: metallic clang with a long wobble. */
  rimRattle() {
    const t = now();
    tone({ type: 'square', freq: 310 * vary(), to: 290, dur: 0.5, vol: 0.06, filter: { type: 'bandpass', freq: 1400, q: 8 } });
    tone({ type: 'triangle', freq: 1240 * vary(), dur: 0.6, vol: 0.05 });
    for (let i = 0; i < 4; i++) tone({ type: 'sine', freq: 620 + i * 37, dur: 0.12, vol: 0.05 - i * 0.01, at: t + 0.12 + i * 0.1 });
    noise({ dur: 0.1, vol: 0.2, type: 'bandpass', freq: 2200, q: 3 });
  },
  /** Arena horn. */
  buzzer() {
    tone({ type: 'sawtooth', freq: 233, dur: 0.9, vol: 0.1, filter: { type: 'lowpass', freq: 1500 } });
    tone({ type: 'square', freq: 235, dur: 0.9, vol: 0.06, filter: { type: 'lowpass', freq: 1000 } });
  },
  /** A stadium crowd rising to its feet. */
  crowd() {
    noise({ dur: 1.4, vol: 0.18, type: 'bandpass', freq: 700, to: 1100, q: 0.8, attack: 0.3 });
    noise({ dur: 1.2, vol: 0.08, type: 'bandpass', freq: 2200, q: 1.5, attack: 0.4 });
  },
  /** Ground-shaking landing of a very large man. */
  bigStomp() {
    tone({ type: 'sine', freq: 70 * vary(), to: 28, dur: 0.3, vol: 0.45 });
    noise({ dur: 0.18, vol: 0.25, type: 'lowpass', freq: 600, to: 90 });
  },
  // ---------------------------------------------------------------- toys and tantrums
  /** Winding a clockwork key: a run of tightening ratchet clicks. */
  windUp() {
    const t = now();
    for (let i = 0; i < 6; i++) {
      tone({ type: 'square', freq: 1800 + i * 140, dur: 0.02, vol: 0.06, at: t + i * 0.055, filter: { type: 'bandpass', freq: 2500, q: 5 } });
      noise({ dur: 0.015, vol: 0.08, type: 'highpass', freq: 4000, at: t + i * 0.055 });
    }
  },
  /** Clockwork tick-tock of a tin toy walking. */
  tinTick() {
    const t = now();
    tone({ type: 'square', freq: 3100 * vary(), dur: 0.015, vol: 0.05, at: t });
    tone({ type: 'square', freq: 2300 * vary(), dur: 0.015, vol: 0.05, at: t + 0.09 });
  },
  /** Tin robot bashing into shins: hollow can clatter. */
  tinClank() {
    for (const [f, d] of [[740, 0.25], [1180, 0.2], [1960, 0.15]]) tone({ type: 'triangle', freq: f * vary(), to: f * 0.9, dur: d, vol: 0.07 });
    noise({ dur: 0.1, vol: 0.25, type: 'bandpass', freq: 2600, q: 2 });
    FX.windUp();
  },
  /** Handlebar bell: two bright dings. */
  bikeBell() {
    const t = now();
    for (const at of [0, 0.16])
      for (const [f, v] of [[2650, 0.08], [3980, 0.05], [5300, 0.025]]) tone({ type: 'sine', freq: f, dur: 0.35, vol: v, at: t + at, attack: 0.002 });
  },
  /** Pedalling hard: chain whirr and freewheel clicks. */
  pedal() {
    const t = now();
    noise({ dur: 0.25, vol: 0.07, type: 'bandpass', freq: 1500, to: 2400, q: 3 });
    for (let i = 0; i < 5; i++) noise({ dur: 0.01, vol: 0.06, type: 'highpass', freq: 5000, at: t + i * 0.045 });
  },
  /** Bicycle ploughing into somebody: frame clang, a thud and a last wobbly ding. */
  bikeCrash() {
    FX.clang();
    sfx.thud();
    tone({ type: 'sine', freq: 2650, to: 2500, dur: 0.4, vol: 0.05, at: now() + 0.12 });
  },
  /** A whiny, rising-then-falling "waaah". */
  wail() {
    voice(430 * vary(), 640, 0.25, 0.22, [850, 1350, 2800]);
    voice(640 * vary(), 380, 0.4, 0.22, [850, 1350, 2800], 0.25);
  },
  /** A sneaker stamped down mid-tantrum. */
  tantrumStomp() {
    FX.stomp();
    voice(300 * vary(), 240, 0.08, 0.12, [600, 1100, 2500]);
  },
  /** Spring boing with a warble as it settles. */
  boing() {
    const t = now();
    tone({ type: 'sine', freq: 140, to: 560, dur: 0.12, vol: 0.22 });
    for (let i = 0; i < 6; i++) tone({ type: 'triangle', freq: i % 2 ? 300 : 420, dur: 0.05, vol: 0.1 * (1 - i / 7), at: t + 0.12 + i * 0.05 });
  },
  /** A little tinkling music-box phrase (an original tune) as the crank turns. */
  musicBox() {
    const t = now();
    const tune = [79, 84, 86, 88, 86, 84, 81, 83, 79];
    tune.forEach((n, i) => {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      tone({ type: 'sine', freq: f, dur: 0.5, vol: 0.06, at: t + i * 0.17, attack: 0.002 });
      tone({ type: 'sine', freq: f * 4.07, dur: 0.12, vol: 0.015, at: t + i * 0.17, attack: 0.002 });
    });
  },
  /** High giggle, three quick "hee"s tumbling down, capped by a snort. */
  giggle() {
    for (let i = 0; i < 3; i++) voice((880 - i * 90) * vary(), 700 - i * 90, 0.09, 0.2, [400, 2300, 3100], i * 0.12);
    snort(0.4);
  },
  snort() {
    snort(0);
  },
};

/** Per-special sound design, keyed by character id then move id. */
export const MOVE_SOUNDS: Record<string, Record<string, MoveSounds>> = {
  lincoln: {
    proj_hat: { frames: { 1: 'inhale' } },
    railsplit: { frames: { 1: 'heave', 6: 'creak' }, impact: 'chop', blocked: 'clack' },
    logroll: { frames: { 1: 'heave', 6: 'rumble', 14: 'rumble', 22: 'rumble' }, impact: ['clack', 'thud'] },
  },
  tesla: {
    proj_bolt: { frames: { 1: 'charge' } },
    teleport: { frames: { 15: 'popIn', 24: 'crackle' }, impact: 'elecHit' },
    acfield: { frames: { 1: 'charge', 14: 'crackle', 22: 'crackle', 30: 'crackle' }, impact: 'elecHit' },
  },
  joan: {
    proj_holy: { frames: { 1: 'choir' } },
    charge: { frames: { 1: 'shing', 4: 'warCry', 8: 'stomp', 13: 'stomp', 18: 'stomp' }, impact: 'clang', blocked: 'clang' },
    ascend: { frames: { 0: 'shing' }, impact: 'flameBurst', blocked: 'clang' },
  },
  blackbeard: {
    proj_cannon: { frames: { 1: 'fuse' } },
    proj_keg: { frames: { 1: 'fuse' } },
    cyclone: { frames: { 1: 'shing' }, impact: 'chop', blocked: 'clang' },
  },
  brucelee: {
    inchpunch: { frames: { 1: 'chi' }, impact: 'boneCrack' },
    dragonkick: { frames: { 0: 'chi' }, impact: 'boneCrack' },
    nunchaku: { frames: { 1: 'chainRattle', 13: 'chainRattle', 25: 'chainRattle' }, impact: 'clack', blocked: 'clack' },
  },
  chuck: {
    proj_gust: { frames: { 1: 'inhale' } },
    tornado: { frames: { 0: 'heave' }, impact: 'boneCrack' },
    flurry: { frames: { 1: 'heave' }, impact: 'bootThud' },
  },
  lumpsum: {
    proj_cash: { frames: { 1: 'coins' } },
    proj_aria: { frames: { 1: 'inhale' } },
    checkslam: { frames: { 1: 'paperFlap', 8: 'heave' }, impact: 'paperSlap' },
  },
  ali: {
    flurry: { frames: { 1: 'shuffle', 14: 'shuffle' }, impact: 'glovePop' },
    ropeadope: { frames: { 3: 'ropeCreak' } },
    ropecounter: { frames: { 0: 'heave' }, impact: ['glovePop', 'boneCrack'] },
    lightningcross: { frames: { 0: 'crackle' }, impact: ['glovePop', 'boneCrack'] },
  },
  bobross: {
    proj_paint: { frames: { 1: 'brushTap' } },
    proj_tree: { frames: { 1: 'brushTap', 6: 'brushTap' } },
    flurry: { frames: { 1: 'brushTap' }, impact: 'splat' },
  },
  hawking: {
    proj_hole: { frames: { 1: 'servo' } },
    rocketchair: { frames: { 1: 'servo' }, impact: 'metalCrash', blocked: 'clang' },
    radiation: { frames: { 1: 'geiger' }, impact: 'crackle' },
  },
  colonel: {
    proj_drumstick: { frames: { 1: 'paperFlap', 12: 'heave' } },
    proj_grease: { frames: { 1: 'clang', 9: 'heave' } },
    canethrash: { frames: { 0: 'caneTap', 1: 'warCry' }, impact: ['clack', 'caneTap'], blocked: 'clack' },
  },
  buster: {
    proj_robot: { frames: { 2: 'windUp', 9: 'windUp' } },
    bikedash: { frames: { 2: 'bikeBell', 10: 'pedal', 18: 'pedal', 26: 'pedal' }, impact: 'bikeCrash', blocked: 'clang' },
    tantrum: { frames: { 1: 'wail', 10: 'tantrumStomp', 22: 'tantrumStomp', 34: 'tantrumStomp' }, impact: 'glovePop' },
  },
  kingtut: {
    proj_scarab: { frames: { 1: 'linenSnap', 10: 'buzz' } },
    proj_sarc: { frames: { 2: 'curseChant', 12: 'stoneGrind' } },
    sandstorm: { frames: { 1: 'sandWind', 14: 'sandWind', 28: 'sandWind' }, impact: 'sandHit' },
  },
  fieri: {
    proj_burger: { frames: { 1: 'inhale', 9: 'sizzle' } },
    proj_ragtop: { frames: { 12: 'engineRev' } },
    smash: { frames: { 1: 'heave', 8: 'smashPress', 14: 'smashPress', 20: 'smashPress', 26: 'smashPress', 32: 'smashPress' }, impact: ['smashPress', 'sizzle'], blocked: 'clang' },
  },
  shaq: {
    proj_bball: { frames: { 1: 'dribble', 7: 'dribble', 12: 'squeak' } },
    backboard: { frames: { 0: 'squeak', 2: 'heave', 18: 'bigStomp' }, impact: ['rimRattle', 'boneCrack'], blocked: 'clang' },
    postup: { frames: { 1: 'squeak', 12: 'squeak', 24: 'squeak' }, impact: 'bodyBump', blocked: 'bodyBump' },
  },
  irwin: {
    proj_croc: { frames: { 2: 'callWhistle', 10: 'rustle' } },
    proj_roo: { frames: { 2: 'callWhistle' } },
    proj_snake: { frames: { 1: 'rustle', 8: 'rustle' } },
  },
  jackson: {
    proj_fedora: { frames: { 2: 'shing' } },
    moonwalk: { frames: { 6: 'shuffle', 16: 'shuffle' }, impact: 'boneCrack' },
    toespin: { impact: ['sparkle', 'boneCrack'] },
  },
  oprah: {
    proj_gift: { frames: { 1: 'giftRustle', 9: 'giftRustle' } },
    bookslam: { frames: { 1: 'pageFlutter', 7: 'heave' }, impact: ['bookThump', 'pageFlutter'], blocked: 'bookThump' },
    ovation: { frames: { 1: 'applause', 13: 'clap', 21: 'clap', 30: ['applause', 'confettiPop'] }, impact: 'clap', blocked: 'clap' },
  },
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
  fedora: { impact: 'clack' },
  paint: { impact: 'splat' },
  hole: { travel: { every: 24, cue: 'drone' }, impact: 'gravityHit' },
  tree: { travel: { every: 8, cue: 'rumble' }, impact: 'woodBurst' },
  gift: { travel: { every: 12, cue: 'giftRustle' }, impact: ['confettiPop', 'paperSlap'], blocked: 'giftRustle', clash: 'confettiPop' },
  drumstick: { launch: 'cluck', travel: { every: 12, cue: 'flutter' }, impact: ['crunch', 'splat'], blocked: 'crunch' },
  grease: { launch: 'sizzle', impact: ['sizzle', 'flameBurst'], blocked: 'sizzle' },
  card: { travel: { every: 6, cue: 'cardWhir' }, impact: 'cardSlice', blocked: 'cardFlick' },
  robot: { travel: { every: 12, cue: 'tinTick' }, impact: 'tinClank', blocked: 'tinClank', clash: 'tinClank' },
  scarab: { travel: { every: 12, cue: 'buzz' }, impact: ['buzz', 'crunch'], blocked: 'buzz' },
  sarcophagus: { impact: ['stoneGrind', 'crunch'], blocked: 'stoneGrind' },
  burger: { travel: { every: 12, cue: 'fireCrackle' }, impact: ['splat', 'flameBurst'] },
  ragtop: { launch: ['horn', 'screech'], travel: { every: 16, cue: 'engineRev' }, impact: 'carCrash', blocked: 'carCrash' },
  bball: { impact: ['dribble', 'bodyBump'], blocked: 'dribble', clash: 'dribble' },
  croc: { launch: 'crocHiss', travel: { every: 10, cue: 'scuttle' }, impact: ['jawSnap', 'boneCrack'], blocked: 'jawSnap' },
  roo: { launch: 'rooSpring', impact: ['rooKick', 'boneCrack'], blocked: 'hopThump' },
  snake: { launch: 'snakeHiss', travel: { every: 9, cue: 'rustle' }, impact: ['snakeStrike', 'snakeHiss'], blocked: 'snakeStrike' },
};

/** Plays a cue: a sound name (special FX first, then the shared sfx), a list to layer, or a function. */
export function playCue(cue: Cue | undefined) {
  if (!cue) return;
  if (typeof cue === 'function') return cue();
  if (Array.isArray(cue)) return cue.forEach(playCue);
  (FX[cue] ?? (sfx as Record<string, unknown>)[cue] as (() => void) | undefined)?.();
}

/** Sound design for the move a fighter is doing: inline `sounds` first, then the registry. */
export function moveSounds(f: { ch: { id: string }; move?: Move | null }): MoveSounds | undefined {
  const m = f.move;
  return m ? m.sounds ?? MOVE_SOUNDS[f.ch.id]?.[m.id] : undefined;
}
