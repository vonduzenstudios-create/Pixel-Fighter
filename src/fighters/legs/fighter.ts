import { buildParts, type Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, DIZZY, VICTORY, WALK } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Finisher, HitDef, Move, MoveSounds, Special } from '../../game/types';
import { FLOOR, STAGE_W } from '../../core/consts';
import { Painter, makeCanvas } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import type { Part, PartSet, Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import type { SetPainter } from '../../scenes/sets';
import { ac, noise, tone } from '../../audio/audio';
import { sfx, say } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { ease, lerp, offscreenX, type Intro } from '../../game/intro';

// ------------------------------------------------------------------ Legs McGee (original)
// A roller-derby jammer who is about two-thirds leg. She never throws a punch: every button is a
// kick, she out-reaches everyone, and she rolls everywhere on her skates. The catch: those legs
// are a huge target, and she is still tall when she ducks.

/** Bone lengths: the standard thigh and shin are 18 each. */
const LIMBS = { thigh: 36, shin: 38 };

export const LEGS_LOOK: Look = {
  skin: '#e8b48c', hair: '#c8401c', eye: '#2a6a3a', shirt: '#18a8b8', pants: '#e83888', boots: '#f4f0e8',
  hairStyle: 'long', jersey: { color: '#18a8b8', trim: '#ffd040', number: '11' }, wristband: '#ffd040',
  lips: '#c02050', earrings: '#ffd040', freckles: '#c07850',
};
/** Palette swap for mirror matches: the away kit. */
export const LEGS_ALT: Look = {
  ...LEGS_LOOK, hair: '#e8c860', shirt: '#6a2aa8', pants: '#202028', boots: '#202028', wristband: '#40e0d0',
  jersey: { color: '#6a2aa8', trim: '#40e0d0', number: '11' }, lips: '#802070', earrings: '#d0d8e0',
};

/** Colours for the parts the standard builder doesn't paint: pads, socks and skates. */
interface Kit { pad: string; sock: string; stripe: string; wheel: string; stop: string; band: string }
const KIT: Kit = { pad: '#1c1a24', sock: '#f4f0e8', stripe: '#e83888', wheel: '#ffd040', stop: '#e83888', band: '#ffd040' };
const ALT_KIT: Kit = { pad: '#d8d8e0', sock: '#202028', stripe: '#40e0d0', wheel: '#40e0d0', stop: '#6a2aa8', band: '#40e0d0' };

// Original lines (not from any film, song or show).
export const LEGS_LINES = {
  intro: "Long story short? I'm not short.",
  finisher: 'And that is long division.',
};
const VOICE = { pitch: 1.15, rate: 1.05, female: true };

// ------------------------------------------------------------------ sprites
const OUT = '#100810';

function thighP(L: Look): Painter {
  // 36 long: hip pivot (7,3), knee at (7,39)
  const p = new Painter(14, 44);
  p.capsule(7, 3, 5.4, 7, 37, 4.2, L.skin);
  p.line(9, 12, 9, 30, lighten(L.skin, 0.14)); // shine down the front of the thigh
  // high-cut derby shorts
  p.capsule(7, 3, 6.2, 7, 7, 5.8, L.pants);
  p.line(1.5, 11, 12.5, 11, darken(L.pants, 0.3));
  p.shade(0.2);
  p.outline(OUT);
  return p;
}
function shinP(L: Look, k: Kit): Painter {
  // 38 long: knee pivot (6,2), ankle at (6,40)
  const p = new Painter(12, 46);
  p.capsule(6, 2, 4.4, 6, 38, 3.4, L.skin);
  // striped tube socks up to mid-shin
  p.capsule(6, 20, 4, 6, 38, 3.6, k.sock);
  p.rect(1.5, 18, 9, 2, lighten(k.sock, 0.2));
  p.rect(1.5, 21, 9, 1, k.stripe);
  p.rect(1.5, 23, 9, 1, k.stripe);
  // skate boot
  p.rect(1.5, 34, 9, 9, L.boots);
  p.line(3, 36, 9, 36, darken(L.boots, 0.25));
  p.line(3, 38, 9, 38, darken(L.boots, 0.25));
  p.shade(0.2);
  // knee pad over the joint
  p.ellipse(6, 3, 5, 4.4, k.pad);
  p.line(3, 1, 8, 1, lighten(k.pad, 0.35));
  p.outline(OUT);
  return p;
}
function skateP(L: Look, k: Kit): Painter {
  // ankle pivot (4,2); the sole sits 4px under the ankle, so the wheels just touch the floor
  const p = new Painter(17, 10);
  p.poly([[1, 0], [7, 0], [12.5, 2.5], [13, 4], [1, 4]], L.boots);
  p.rect(0, 4, 14, 1, '#9a9aa8'); // plate
  p.ellipse(14, 4.5, 1.6, 1.4, k.stop); // toe stop
  p.shade(0.2);
  for (const x of [2.5, 10.5]) {
    p.ellipse(x, 6.3, 1.9, 1.7, k.wheel);
    p.set(Math.round(x), 6, darken(k.wheel, 0.4));
  }
  p.outline(OUT);
  return p;
}

const dimmed = (p: Painter, dim: boolean) => {
  const c = p.clone();
  if (dim) c.dim(0.32);
  return c.canvas();
};

function legsParts(L: Look, k: Kit): PartSet {
  const base = buildParts(L);
  const th = thighP(L), sh = shinP(L, k), ft = skateP(L, k);
  const part = (p: Painter, px: number, py: number, dim = false): Part => ({ img: dimmed(p, dim), px, py });
  // a sweatband across the forehead
  const head = base.head.img;
  const g = head.getContext('2d')!;
  g.fillStyle = k.band;
  g.fillRect(6, 22, 11, 2);
  g.fillStyle = OUT;
  g.fillRect(6, 21, 11, 1);
  return {
    ...base,
    thigh: part(th, 7, 3), shin: part(sh, 6, 2), foot: part(ft, 4, 2),
    thighB: part(th, 7, 3, true), shinB: part(sh, 6, 2, true), footB: part(ft, 4, 2, true),
    limbs: LIMBS,
  };
}

// ------------------------------------------------------------------ sounds
const now = () => ac()?.currentTime ?? 0;
const vary = (a = 0.06) => 1 + (Math.random() * 2 - 1) * a;
/** Urethane wheels rolling on boards: a low rumble with the clack of the seams. */
function skateRoll() {
  const t = now();
  noise({ dur: 0.32, vol: 0.13, type: 'lowpass', freq: 380, to: 260, q: 1.5 });
  tone({ type: 'triangle', freq: 70 * vary(), to: 62, dur: 0.3, vol: 0.08 });
  for (let i = 0; i < 3; i++) noise({ dur: 0.02, vol: 0.12, type: 'bandpass', freq: 1500, q: 4, at: t + 0.06 + i * 0.09 });
}
/** Toe stop dragging on the floor. */
function toeScrape() {
  noise({ dur: 0.22, vol: 0.18, type: 'bandpass', freq: 2400, to: 1200, q: 2 });
  tone({ type: 'sawtooth', freq: 160 * vary(), to: 120, dur: 0.18, vol: 0.04, filter: { type: 'bandpass', freq: 1100, q: 5 } });
}
/** Long leg cutting the air: a lower, longer whoosh than a normal kick. */
function longSwish() {
  noise({ dur: 0.26, vol: 0.2, type: 'bandpass', freq: 500, to: 2400, q: 1.6, attack: 0.08 });
}
/** Skate boot meeting a body: a hard rubber smack. */
function skateSmack() {
  tone({ type: 'sine', freq: 140 * vary(), to: 60, dur: 0.12, vol: 0.28 });
  noise({ dur: 0.07, vol: 0.22, type: 'bandpass', freq: 1800, q: 1.2 });
}
/** Wheels spinning free in the air. */
function wheelWhir() {
  tone({ type: 'square', freq: 520 * vary(), to: 740, dur: 0.2, vol: 0.03, filter: { type: 'lowpass', freq: 1800 } });
  noise({ dur: 0.2, vol: 0.06, type: 'highpass', freq: 3000 });
}
/** Joints popping as she stretches all the way up. */
function stretchPop() {
  const t = now();
  for (let i = 0; i < 2; i++) noise({ dur: 0.015, vol: 0.25, type: 'bandpass', freq: 2600 + i * 600, q: 6, at: t + i * 0.07 });
}
/** A rising whistle while the leg is held up, before it comes down. */
function sirenUp() {
  tone({ type: 'sine', freq: 600, to: 1800, dur: 0.6, vol: 0.06, attack: 0.3 });
}

// ------------------------------------------------------------------ poses (facing right)
// her own crouch is still waist-high to everyone else, so the "low" moves keep the hip up
const CR = (o: Pose = {}) => P(CROUCH, o);
const ARMS_BACK = { af: -20, ef: -70, ab: 40, eb: -40 };
const hit = (h: Omit<HitDef, 'limb'> & { limb?: HitDef['limb'] }): HitDef => ({ limb: 'toeF', line: true, ...h });

// ------------------------------------------------------------------ normals (all kicks)
const JAB: Move = {
  id: 'legs_jab',
  anim: A([
    [P(STANCE, { lf: -64, kf: 96, t: -2, ...ARMS_BACK }), 2, 'out'],
    [P(STANCE, { lf: -70, kf: 2, ff: -10, t: -10, h: 4, ...ARMS_BACK }), 1, 'lin'],
    [P(STANCE, { lf: -70, kf: 6, ff: -6, t: -8, h: 4, ...ARMS_BACK }), 3],
    [P(STANCE, { lf: -54, kf: 80, t: -2 }), 3, 'out'],
    [STANCE, 5],
  ]),
  active: [3, 6],
  hit: hit({ r: 5, dmg: 28, level: 'mid', effect: 'light', push: 2.5, stun: 13 }),
  whoosh: true,
};
const HIGH: Move = {
  id: 'legs_hp',
  anim: A([
    [P(STANCE, { lf: -78, kf: 120, t: 4, ...ARMS_BACK }), 4, 'in'],
    [P(STANCE, { lf: -82, kf: 0, ff: -30, t: -20, h: 8, ...ARMS_BACK }), 1, 'lin'],
    [P(STANCE, { lf: -82, kf: 2, ff: -30, t: -18, h: 8, ...ARMS_BACK }), 4],
    [P(STANCE, { lf: -70, kf: 90, t: -4 }), 4, 'out'],
    [STANCE, 5],
  ]),
  active: [5, 9],
  hit: hit({ r: 6, dmg: 50, level: 'high', effect: 'heavy', push: 3.5, stun: 17 }),
  whoosh: true,
};
const LOW: Move = {
  id: 'legs_lk',
  anim: A([
    [P(STANCE, { lf: -40, kf: 80, ff: 10, t: 2 }), 3, 'in'],
    [P(STANCE, { lf: -48, kf: 0, ff: 16, t: -6, ...ARMS_BACK }), 1, 'lin'],
    [P(STANCE, { lf: -48, kf: 4, ff: 12, t: -6, ...ARMS_BACK }), 4],
    [P(STANCE, { lf: -34, kf: 60, t: 0 }), 3, 'out'],
    [STANCE, 5],
  ]),
  active: [4, 8],
  hit: hit({ r: 5, dmg: 42, level: 'mid', effect: 'light', push: 3, stun: 14 }),
  whoosh: true,
};
const HIGH_KICK: Move = {
  id: 'legs_hk',
  anim: A([
    [P(STANCE, { t: -4, lf: -50, kf: 90, lb: 12, ...ARMS_BACK }), 3, 'in'],
    [P(STANCE, { lf: -80, kf: 60, ff: 10, t: -16, h: 6, af: -30, ef: -80, ab: 10, eb: -60 }), 2, 'in'],
    [P(STANCE, { lf: -92, kf: 0, ff: -30, t: -28, h: 10, af: -20, ef: -60, ab: 30, lb: 8 }), 1, 'lin'],
    [P(STANCE, { lf: -92, kf: 2, ff: -30, t: -26, h: 10, af: -20, ef: -60, ab: 30, lb: 8 }), 5],
    [P(STANCE, { lf: -60, kf: 80, t: -8 }), 4, 'out'],
    [STANCE, 7],
  ]),
  active: [5, 11],
  hit: hit({ r: 6, dmg: 60, level: 'high', effect: 'heavy', push: 4, stun: 18 }),
  whoosh: true,
};
/** Spinning heel off the back leg, kept at head height instead of the usual skyward arc. */
const ROUNDHOUSE: Move = {
  id: 'legs_roundhouse',
  anim: A([
    [P(STANCE, { t: 26, h: 6, lb: -70, kb: 110, af: -20, ef: -60, ab: -90, eb: -40, lf: -10, kf: 14 }), 5, 'in'],
    [P(STANCE, { t: -30, h: 16, lb: -86, kb: -4, fb: -35, af: 25, ef: -25, ab: -150, eb: -15, lf: 10, kf: 2 }), 4, 'lin'],
    [P(STANCE, { t: -36, h: 18, lb: -96, kb: -6, fb: -40, af: 40, ef: -20, ab: -160, eb: -10, lf: 14, kf: 0 }), 4, 'out'],
    [P(STANCE, { t: 18, h: -6, lb: -40, kb: 70, af: -40, ef: -80 }), 4],
    [STANCE, 8],
  ]),
  active: [5, 12],
  vx: (fr) => (fr < 10 ? 1.1 : 0),
  hit: hit({ limb: 'toeB', r: 7, dmg: 85, level: 'high', effect: 'launch', lift: [5.6, 3.4], push: 3, stun: 20, sfx: 'heavy' }),
  whoosh: true,
};
/** Drops into the full splits, the front skate scything along the floor. Slow to get back up from. */
const SWEEP: Move = {
  id: 'legs_sweep',
  crouch: true,
  anim: A([
    [P(STANCE, { lf: -50, kf: 50, lb: 30, kb: 20, t: 10, af: -60, ab: -40 }), 3, 'in'],
    [P(STANCE, { lf: -86, kf: 0, ff: -4, lb: 86, kb: 0, fb: 10, t: 24, h: -14, af: -100, ef: -10, ab: 60, eb: -10 }), 3, 'out'],
    [P(STANCE, { lf: -88, kf: 0, ff: -4, lb: 88, kb: 0, fb: 10, t: 28, h: -14, af: -96, ef: -10, ab: 64, eb: -10 }), 8],
    [P(STANCE, { lf: -60, kf: 40, lb: 50, kb: 30, t: 12, af: -60, ab: 20 }), 8, 'in'],
    [STANCE, 6],
  ]),
  active: [4, 13],
  hit: hit({ r: 7, dmg: 65, level: 'low', effect: 'sweep', push: 2, stun: 20 }),
  whoosh: true,
};
const CROUCH_POKE: Move = {
  id: 'legs_cp',
  crouch: true,
  anim: A([[CR({ lf: -70, kf: 100 }), 2, 'out'], [CR({ lf: -84, kf: 0, ff: 6, t: 14 }), 1, 'lin'], [CR({ lf: -84, kf: 4, ff: 6, t: 14 }), 4], [CR({ lf: -76, kf: 90 }), 3, 'out'], [CROUCH, 4]]),
  active: [3, 7],
  hit: hit({ r: 5, dmg: 28, level: 'low', effect: 'light', push: 2.5, stun: 13 }),
};
const CROUCH_KICK: Move = {
  id: 'legs_ck',
  crouch: true,
  anim: A([[CR({ lf: -60, kf: 100 }), 3, 'in'], [CR({ lf: -72, kf: 0, ff: 18, t: 18 }), 1, 'lin'], [CR({ lf: -72, kf: 2, ff: 18, t: 20 }), 5], [CR({ lf: -66, kf: 90, t: 10 }), 3, 'out'], [CROUCH, 6]]),
  active: [4, 9],
  hit: hit({ r: 5, dmg: 40, level: 'low', effect: 'light', push: 2.5, stun: 14 }),
};
const CROUCH_HIGH: Move = {
  id: 'legs_chk',
  crouch: true,
  anim: A([
    [CR({ lf: -70, kf: 120, t: 20 }), 4, 'in'],
    [CR({ lf: -104, kf: 0, ff: -20, t: 10, h: -2, af: -40, ab: 10 }), 1, 'lin'],
    [CR({ lf: -104, kf: 4, ff: -20, t: 10, h: -4, af: -40, ab: 10 }), 5],
    [CR({ lf: -76, kf: 100, t: 20 }), 4, 'out'],
    [CROUCH, 6],
  ]),
  active: [5, 10],
  hit: hit({ r: 6, dmg: 55, level: 'mid', effect: 'heavy', push: 3.5, stun: 17 }),
  whoosh: true,
};
/** The launcher: one leg swung from the floor straight up past her ear. Id stays 'uppercut' for stage finishes. */
const SKY_KICK: Move = {
  id: 'uppercut',
  crouch: true,
  anim: A([
    [CR({ t: 30, lf: -30, kf: 120, af: -40, ab: -60 }), 4, 'in'],
    [P(STANCE, { t: 10, h: 4, lf: -70, kf: 4, ff: -10, lb: 10, kb: 6, fb: 30, af: -10, ef: -60, ab: 30, eb: -40 }), 2, 'lin'],
    [P(STANCE, { t: -12, h: 10, lf: -130, kf: 0, ff: -40, lb: 6, kb: 0, fb: 40, af: 10, ef: -40, ab: 40, eb: -30 }), 3, 'out'],
    [P(STANCE, { t: -18, h: 12, lf: -172, kf: 0, ff: -50, lb: 4, kb: 0, fb: 45, af: 20, ef: -40, ab: 40, eb: -30 }), 8],
    [P(STANCE, { t: 6, lf: -80, kf: 70 }), 6],
    [STANCE, 5],
  ]),
  active: [4, 12],
  hit: hit({ r: 8, dmg: 115, level: 'mid', effect: 'launch', lift: [8.4, 1.1], push: 2, stun: 30, sfx: 'heavy' }),
  whoosh: true,
};
const JUMP_STAB: Move = {
  id: 'legs_jp',
  air: true,
  anim: A([[P(TUCK, { lf: -40, kf: 90 }), 3, 'out'], [P(TUCK, { t: 10, lf: -48, kf: 0, ff: 20, lb: -30, kb: 110, af: -40, ab: 20 }), 40]]),
  active: [3, 20],
  hit: hit({ r: 6, dmg: 55, level: 'overhead', effect: 'heavy', push: 3, stun: 18 }),
  whoosh: true,
};
const JUMP_KICK: Move = {
  id: 'legs_jk',
  air: true,
  anim: A([[P(TUCK, { lf: -60, kf: 70 }), 3, 'out'], [P(TUCK, { t: -12, lf: -70, kf: 0, ff: 10, lb: 20, kb: 10, af: -60, ef: -90 }), 40]]),
  active: [3, 22],
  hit: hit({ r: 6, dmg: 65, level: 'overhead', effect: 'heavy', push: 3, stun: 18 }),
  whoosh: true,
};
/** Hooks them behind the neck with her ankle and hoists them over her head. */
const HOIST: Move = {
  id: 'legs_throw',
  anim: A([
    [P(STANCE, { lf: -60, kf: 110, t: 6, ...ARMS_BACK }), 6, 'in'],
    [P(STANCE, { lf: -140, kf: 70, ff: -30, t: -14, h: 8, af: -40, ab: 40 }), 10, 'lin'],
    [P(STANCE, { lf: -190, kf: 30, ff: -40, t: -24, h: 12, af: -10, ab: 50 }), 10],
    [STANCE, 10],
  ]),
};

// ------------------------------------------------------------------ specials
const lungeSounds: MoveSounds = { frames: { 0: skateRoll, 6: longSwish, 22: toeScrape }, impact: [skateSmack, 'boneCrack'], blocked: 'clack' };
/** Skates forward in a low split, the front leg out like a lance. */
const lunge: Move = {
  id: 'legs_lunge',
  anim: A([
    [P(STANCE, { t: 22, lf: -40, kf: 90, lb: 20, af: -60, ab: -40 }), 6, 'in'],
    [P(STANCE, { t: -6, h: 6, lf: -80, kf: 0, ff: -20, lb: 56, kb: 0, fb: 30, af: -20, ef: -60, ab: 40, eb: -30 }), 18],
    [P(STANCE, { t: 4, lf: -46, kf: 40, lb: 24, kb: 10 }), 8],
    [STANCE, 8],
  ]),
  active: [6, 24],
  vx: (fr) => (fr >= 6 && fr < 22 ? 4.6 : fr < 28 ? 1.2 : 0),
  hit: hit({ r: 8, dmg: 95, level: 'mid', effect: 'knockdown', push: 2, stun: 22, special: true }),
  sounds: lungeSounds,
  onFrame: (self, f, fr) => {
    if (fr >= 6 && fr < 24 && fr % 3 === 0) f.particles.dust(self.x - self.facing * 30, 2);
  },
};

/** Rising scissor kicks, legs swapping overhead: the anti-air launcher. */
const SCISSOR_A = P(STANCE, { t: -10, h: 8, lf: -170, kf: 0, ff: -40, lb: 30, kb: 0, af: 10, ef: -40, ab: 40, eb: -40 });
const SCISSOR_B = P(STANCE, { t: -4, h: 6, lf: 20, kf: 0, lb: -160, kb: 0, fb: -40, af: -30, ef: -60, ab: 30, eb: -40 });
const scissor: Move = {
  id: 'legs_scissor', air: true,
  anim: A([
    [CR({ t: 20, af: -60, ab: -40 }), 3],
    [SCISSOR_A, 5, 'lin'], [SCISSOR_B, 5, 'lin'], [SCISSOR_A, 5, 'lin'], [SCISSOR_B, 5, 'lin'],
    [P(TUCK, { lf: -60, kf: 60, lb: -30, kb: 60 }), 30],
  ]),
  active: [3, 23],
  hit: hit({ r: 9, dmg: 105, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true, sfx: 'heavy' }),
  sounds: { frames: { 1: 'inhale', 3: wheelWhir, 8: longSwish, 13: longSwish, 18: wheelWhir }, impact: [skateSmack, 'bootThud'], blocked: 'clack' },
  onFrame: (self, f, fr) => {
    if (fr === 2) {
      self.vy = 6.6;
      self.y = 1;
      self.vx = 1.2 * self.facing;
      f.particles.dust(self.x, 6);
    }
  },
};

/** Spins on one skate with the other leg straight out: a turnstile nobody gets through. */
const PIN = P(STANCE, { t: -10, h: 4, lf: -74, kf: 0, ff: -10, lb: 4, kb: 0, fb: 40, af: -150, ef: -20, ab: 60, eb: -20 });
const pinwheel: Move = {
  id: 'legs_pinwheel',
  anim: A([
    [P(STANCE, { lf: -50, kf: 80, af: -120, ab: 30 }), 4],
    [PIN, 36],
    [P(STANCE, { lf: -40, kf: 40 }), 8],
    [STANCE, 6],
  ]),
  spin: 4,
  active: [4, 40],
  vx: (fr) => (fr >= 4 && fr < 40 ? 1.4 : 0),
  hit: hit({ r: 7, dmg: 24, level: 'mid', effect: 'light', push: 1.4, stun: 14, rehit: 8, special: true }),
  sounds: { frames: { 0: skateRoll, 40: toeScrape }, impact: skateSmack, blocked: 'clack' },
  onFrame: (self, f, fr) => {
    if (fr >= 4 && fr < 40 && fr % 8 === 4) {
      playCue(longSwish);
      if (fr % 16 === 4) playCue(wheelWhir);
    }
    if (fr >= 4 && fr < 40 && fr % 4 === 0) f.particles.dust(self.x, 2);
  },
};

export const LEGS_SPECIALS: Special[] = [
  { name: 'Mile-Long Lunge', cmd: [2, 3, 6], btn: 'k', text: 'D, DF, F + K', move: lunge },
  { name: 'Scissor Lift', cmd: [6, 2, 3], btn: 'k', text: 'F, D, DF + K', move: scissor },
  { name: 'Pinwheel', cmd: [2, 5, 2], btn: 'hk', mash: 'hk', text: 'MASH HK', move: pinwheel },
];

export const LEGS_FINISHER: Finisher = { name: 'Long Division', cmd: [4, 6, 2], btn: 'hk', text: 'B, F, D + HK (mid range)', range: [30, 130] };

// ------------------------------------------------------------------ finisher
// She glides into range, raises one leg all the way up until the skate is far above everyone's
// head, holds it there, then brings the heel down through the loser, top to bottom. The two
// halves peel apart and topple, and she drops into the splits between them.

/** Horizontal gap she wants for the axe kick to land on top of the head. */
const AXE_GAP = 70;
let cutBuf: ReturnType<typeof makeCanvas> | null = null;
const CUT_GROUND = 160;

function longDivision(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  if (tt === 0) {
    D.a = l.x >= w.x ? 1 : -1;
    D.x0 = w.x;
    // stay on the stage: if the loser is near the edge, push them inward a little
    const sw = fight.stage.width ?? STAGE_W;
    D.tx = Math.max(30, Math.min(sw - 30, l.x - D.a * AXE_GAP));
    playCue(skateRoll);
  }
  const a = D.a as 1 | -1;
  w.facing = a;
  w.vx = 0;
  if (!D.split) l.poseOverride = DIZZY;

  if (tt < 24) {
    if (tt === 0) w.setAnim(WALK);
    w.poseOverride = P(STANCE, { t: 10, lf: -40, kf: 20, lb: 30, kb: 10, af: -60, ab: 30 });
    w.x = lerp(D.x0, D.tx, ease(tt / 22));
    if (tt === 20) playCue(toeScrape);
  } else if (tt < 70) {
    // the slow raise, up on the toes of the standing skate
    const k = ease((tt - 24) / 40);
    w.poseOverride = P(STANCE, { t: lerp(8, -8, k), h: lerp(-4, 8, k), lf: lerp(-22, -184, k), kf: lerp(22, 0, k), ff: lerp(0, -60, k), lb: 4, kb: 0, fb: lerp(0, 40, k), af: lerp(-60, -110, k), ef: -20, ab: lerp(-35, 70, k), eb: -20 });
    if (tt === 24) playCue('inhale');
    if (tt === 48) playCue(stretchPop);
    if (tt === 56) playCue(sirenUp);
  } else if (tt < 80) {
    // the hold: a glint off the wheels way up top
    if (tt === 72) {
      const tx = w.wx(w.skel.toeF[0]), ty = w.wy(w.skel.toeF[1]);
      fight.particles.sparks(tx, ty, 6, '#fff2c0');
      fight.particles.flash(tx, ty, 6, '#ffffff');
      sfx.twinkle();
    }
  } else if (tt < 86) {
    // the drop
    const k = (tt - 80) / 5;
    w.poseOverride = P(STANCE, { t: lerp(-8, 30, k), h: lerp(8, 4, k), lf: lerp(-184, -40, k * k), kf: 0, ff: -30, lb: 4, kb: 0, fb: 30, af: lerp(-110, -40, k), ab: lerp(70, 30, k), ef: -40, eb: -30 });
    if (tt === 80) playCue(longSwish);
    if (tt === 83) split(fight, l, D);
  } else if (tt < 120) {
    if (tt === 104) w.poseOverride = P(STANCE, { t: 20, lf: -40, kf: 30, lb: 10, af: -50, ab: 20 });
  } else if (tt < 140) {
    // slide into the splits between the halves, arms up
    const k = ease((tt - 120) / 14);
    w.poseOverride = P(STANCE, { t: lerp(20, -4, k), h: -6, lf: lerp(-40, -90, k), kf: lerp(30, 0, k), ff: -10, lb: lerp(10, 90, k), kb: 0, fb: 10, af: -160, ef: -20, ab: -150, eb: -20 });
    w.x = lerp(D.tx, D.split?.x ?? D.tx, k);
    if (tt === 120) playCue(toeScrape);
  } else {
    if (tt === 150) say(LEGS_LINES.finisher, VOICE);
    if (tt === 160) playCue('crowd');
  }

  // the halves topple outward, spraying from the cut
  if (D.split) {
    const t = tt - D.split.t0;
    // a beat standing, then both halves keel over
    D.split.ang = ease((t - 16) / 40) * 1.45;
    if (t < 70 && t % 2 === 0) {
      for (const s of [-1, 1]) {
        const h = 60 * Math.cos(D.split.ang) + 6;
        fight.particles.blood(D.split.x + s * (2 + Math.sin(D.split.ang) * 30), h, s * 0.4, 3, 1.2);
      }
    }
    if (t === 56) {
      fight.shake(6);
      sfx.thud();
      playCue('splat');
      for (const s of [-1, 1]) fight.particles.smoke(D.split.x + s * 40, 2, 4, '#7a6a5a');
    }
    if (t % 24 === 0 && t < 90) sfx.blood();
  }
  return tt >= 280;
}

/** Freeze the loser into a picture, then cut it down the middle along the line of the heel. */
function split(fight: Fight, l: Fighter, D: any) {
  const [CUT, CUTX] = (cutBuf ??= makeCanvas(160, 170));
  CUTX.setTransform(1, 0, 0, 1, 0, 0);
  CUTX.clearRect(0, 0, 160, 170);
  l.poseOverride = DIZZY;
  l.computePose();
  l.draw(CUTX, l.x - 80, CUT_GROUND);
  const half = (sx: number) => {
    const [c, g] = makeCanvas(80, 170);
    g.drawImage(CUT, sx, 0, 80, 170, 0, 0, 80, 170);
    // a raw red edge along the cut
    const d = g.getImageData(0, 0, 80, 170);
    const edge = sx === 0 ? 79 : 0;
    for (let y = 0; y < 170; y++) {
      const i = (y * 80 + edge) * 4;
      if (d.data[i + 3] > 0) d.data.set([150, 0, 16, 255], i), d.data.set([200, 20, 30, 255], i + (sx === 0 ? -4 : 4));
    }
    g.putImageData(d, 0, 0);
    return c;
  };
  D.split = { t0: fight.fatal!.t - 1, x: l.x, ang: 0, L: half(0), R: half(80) };
  l.alpha = 0;
  fight.shake(16);
  sfx.crunch();
  sfx.hit(true, true);
  playCue(['boneCrack', skateSmack]);
  fight.particles.blood(l.x, 70, 0, 50, 1.8);
  fight.particles.blood(l.x, 40, 1, 30, 1.4);
  fight.particles.blood(l.x, 40, -1, 30, 1.4);
  setTimeout(() => sfx.scream(), 60);
}

function drawHalves(ctx: CanvasRenderingContext2D, fight: Fight, cam: number, front: boolean) {
  const S = fight.fatal?.data?.split;
  if (!S || front) return;
  const x = Math.round(S.x - cam);
  for (const s of [-1, 1]) {
    ctx.save();
    // each half rocks over on its outer foot, so the cut side swings up and out
    ctx.translate(x + s * 12, FLOOR);
    ctx.rotate(s * S.ang);
    ctx.drawImage(s < 0 ? S.L : S.R, s < 0 ? -68 : -12, -CUT_GROUND, 80, 170);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ round-one entrance
/** Rolls in from the edge with long pushes, spins to a stop and holds a standing split. */
export const LEGS_INTRO: Intro = {
  line: LEGS_LINES.intro,
  speech: VOICE,
  speakAt: 92,
  dur: 150,
  update(self, f, t, home) {
    const x0 = offscreenX(self, f);
    if (t <= 54) {
      // long strides: push off with one leg, glide on the other
      const ph = (t % 18) / 18, pushB = Math.floor(t / 18) % 2 === 0;
      const reach = Math.sin(ph * Math.PI) * 40;
      self.poseOverride = pushB
        ? P(STANCE, { t: 16, lf: -12, kf: 10, lb: 10 + reach, kb: 4, fb: 10, af: -40, ab: -60, ef: -30, eb: -30 })
        : P(STANCE, { t: 16, lb: 4, kb: 6, lf: 10 + reach, kf: 4, ff: 10, af: -40, ab: -60, ef: -30, eb: -30 });
      self.x = lerp(x0, home + self.facing * 20, ease(t / 54) * 0.4 + (t / 54) * 0.6);
      if (t % 18 === 0) playCue(skateRoll);
    } else if (t < 70) {
      // a spin to kill the speed, sliding back to her mark
      self.poseOverride = P(STANCE, { t: -4, lf: -20, kf: 10, lb: 6, af: -150, ab: 60, ef: -20, eb: -20 });
      self.x = lerp(home + self.facing * 20, home, (t - 54) / 16);
      if (t % 4 === 0) self.facing = (self.facing * -1) as 1 | -1;
      if (t === 54) playCue(toeScrape);
    } else if (t < 130) {
      if (t === 70) self.facing = f.f[0] === self ? 1 : -1;
      // standing split, holding the raised ankle
      const k = ease((t - 70) / 18);
      self.poseOverride = P(STANCE, { t: lerp(8, -6, k), h: 6, lf: lerp(-22, -178, k), kf: 0, ff: -50, lb: 2, kb: 0, fb: 30, af: lerp(-60, -168, k), ef: -6, ab: 40, eb: -40 });
      if (t === 76) playCue(stretchPop);
    } else {
      self.poseOverride = P(VICTORY, { lf: -30, kf: 20 });
    }
  },
};

// ------------------------------------------------------------------ post-match portrait
export const LEGS_PORTRAIT: PortraitStyle = {
  front(p, c) {
    const L = c.look, k = L.hair === LEGS_ALT.hair ? ALT_KIT : KIT;
    // sweatband across the forehead
    if (!c.beaten) {
      p.poly([[24, 30], [80, 26], [81, 32], [25, 36]], k.band);
      p.line(25, 34, 80, 30, darken(k.band, 0.3));
    } else p.poly([[24, 40], [80, 34], [81, 40], [25, 46]], k.band);
  },
};

// ------------------------------------------------------------------ character select set
/** A roller rink after hours: purple wall, a turning mirror ball and the polished track. */
const RINK: SetPainter = (g) => {
  const u = g.u;
  for (let i = 0; i < 4; i++) g.r(0, (g.floor * i) / 4, g.w, g.floor / 4 + 1, ['#1a0c2a', '#24103a', '#2e1448', '#3a1a58'][i]);
  // light spots thrown by the ball, drifting across the wall
  for (let i = 0; i < 9; i++) {
    const x = ((i * 37 + g.t * 0.6) % (g.w + 20)) - 10, y = ((i * 23) % Math.max(1, g.floor - 6 * u)) + 2 * u;
    g.r(x, y, 2 * u, u, i % 3 ? '#ff80d0' : '#80f0ff');
  }
  // rail along the back of the track
  g.r(0, g.floor - 5 * u, g.w, u, '#ffd040');
  for (let x = 2 * u; x < g.w; x += 12 * u) g.r(x, g.floor - 5 * u, u, 5 * u, '#c8a030');
  // the mirror ball on its chain
  const bx = g.w * 0.72, by = 7 * u;
  g.r(bx, 0, u, by - 3 * u, '#8a8a96');
  g.r(bx - 3 * u, by - 3 * u, 7 * u, 6 * u, '#c8ccd8');
  for (let i = 0; i < 6; i++) g.r(bx - 3 * u + ((i * 2 + Math.floor(g.t / 8)) % 7) * u, by - 3 * u + (i % 3) * 2 * u, u, u, '#ffffff');
  // varnished boards with the painted lane lines
  for (let i = 0; i < 3; i++) g.r(0, g.floor + ((g.h - g.floor) * i) / 3, g.w, (g.h - g.floor) / 3 + 1, ['#c88a4a', '#b87a3c', '#a86c30'][i]);
  g.r(0, g.floor, g.w, u, '#e8b070');
  g.r(0, g.floor + (g.h - g.floor) * 0.45, g.w, u, '#e83888');
  g.r(0, g.floor + (g.h - g.floor) * 0.75, g.w, u, '#18a8b8');
};

// ------------------------------------------------------------------ win-screen taunts
export const LEGS_QUOTES = [
  'I KEPT YOU AT ARM\'S LENGTH, {L}. WELL. LEG\'S LENGTH.',
  'YOU NEVER GOT CLOSE ENOUGH TO LOSE PROPERLY.',
  'I HAVE NO IDEA WHAT MY HANDS ARE FOR.',
  'NEXT TIME, BRING A LADDER.',
];
export const LEGS_TAUNTS_VS: Record<string, string> = {
  shaq: 'FINALLY, SOMEONE I CAN LOOK IN THE KNEE.',
  brucelee: 'ONE KICK TEN THOUSAND TIMES? I ONLY NEEDED ONE KICK.',
  chuck: 'YOUR ROUNDHOUSE IS CUTE. MINE HAS A POSTCODE.',
};

export function legsMcGee(): CharDef {
  return {
    id: 'legs', name: 'Legs McGee', short: 'LEGS', title: 'The Long Haul', look: LEGS_LOOK, alt: LEGS_ALT,
    specials: LEGS_SPECIALS, voice: 300, props: {}, reach: 70,
    sprites: (L) => legsParts(L, L === LEGS_ALT ? ALT_KIT : KIT),
    normals: {
      jab: JAB, hp: HIGH, lk: LOW, hk: HIGH_KICK, roundhouse: ROUNDHOUSE, sweep: SWEEP,
      cp: CROUCH_POKE, ck: CROUCH_KICK, chk: CROUCH_HIGH, uppercut: SKY_KICK, jp: JUMP_STAB, jk: JUMP_KICK, throw: HOIST,
    },
    finisher: LEGS_FINISHER, fatality: longDivision, fatalityDraw: drawHalves,
    intro: LEGS_INTRO, portrait: LEGS_PORTRAIT, selectSet: RINK, quotes: LEGS_QUOTES, quotesVs: LEGS_TAUNTS_VS,
  };
}
