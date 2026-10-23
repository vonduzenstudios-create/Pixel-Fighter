import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, HIT_HIGH, LIE } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import { lerp, offscreenX, type Intro } from '../../game/intro';
import * as AN from '../../game/anims';
import type { PortraitStyle } from '../../gfx/portrait';
import { Painter, makeCanvas } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import { drawRig, fk, groundOffset, type Part, type PartSet } from '../../gfx/rig';
import { ac, noise, tone } from '../../audio/audio';
import { say, sfx } from '../../audio/sfx';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';

// Pamela Handerson: an original cartoon character, a giant right hand that tiptoes about on its
// index and middle fingers. Big lashes and lipstick on the back of the hand, a hot pink manicure,
// a cocktail ring and a fluffy cuff where a sleeve would be. The thumb is her "arm"; the two
// walking fingers are her legs. She fights with flicks, slaps, a finger pistol and a karate chop.
// Name, look, moves and lines are all original.

const OUT = '#140a10';

/** Everything that tells the two palettes apart. */
interface HandStyle {
  skin: string;
  nail: string;
  metal: string;
  gem: string;
  cuff: string;
  lips: string;
  shadow: string;
}
const MAIN: HandStyle = {
  skin: '#f2c2a2', nail: '#ff2a78', metal: '#f0c040', gem: '#ff6ab8', cuff: '#ff8ccc', lips: '#d8205a', shadow: '#b878d8',
};
/** Palette swap for mirror matches: teal polish, silver jewellery and a violet cuff. */
const ALT: HandStyle = {
  skin: '#a8704c', nail: '#20c8b4', metal: '#d8dce8', gem: '#6a50ff', cuff: '#a878ff', lips: '#8a1040', shadow: '#40b0c8',
};

// The portrait and generic code still want a Look; the sprites come from HandStyle via CharDef.sprites.
export const HAND_LOOK: Look = {
  skin: MAIN.skin, hair: MAIN.cuff, eye: '#3a2a50', shirt: MAIN.skin, pants: MAIN.skin, boots: MAIN.nail, hairStyle: 'bald',
};
export const HAND_ALT: Look = {
  skin: ALT.skin, hair: ALT.cuff, eye: '#2a1a20', shirt: ALT.skin, pants: ALT.skin, boots: ALT.nail, hairStyle: 'bald',
};
const styleOf = (L: Look) => (L === HAND_ALT ? ALT : MAIN);

export const HANDERSON_LINES = {
  intro: "Hands down, I'm the best in the business.",
  finisher: 'Consider yourself handled.',
};
const VOICE = { pitch: 1.2, rate: 1.0, female: true };

// ------------------------------------------------------------------ sprites
// Same pivots and bone lengths as the human parts (chars/build.ts), so every shared animation,
// hitbox and stage finish works: the back of the hand is the torso, the wrist and cuff the head,
// the thumb the front arm, and the index and middle fingers the legs.

/**
 * Back of the hand with her face on it. 36x40, knuckles (hip) at (22, 30), wrist at y = 5. The
 * walking fingers hang from the front half, by the thumb; the ring and little fingers are curled
 * under at the back.
 */
function handBack(S: HandStyle): Painter {
  const p = new Painter(36, 40);
  const skinD = darken(S.skin, 0.16);
  p.ellipse(7, 31.5, 4.2, 3.8, skinD);
  p.ellipse(12.5, 33.5, 4.2, 3.6, skinD);
  p.ellipse(4.5, 34, 1.8, 1.4, S.nail);
  p.ellipse(10, 36.6, 2, 1.4, S.nail);
  // narrow at the wrist, broad and square over the knuckles
  p.poly([[14, 3], [30, 3], [33, 11], [34.5, 21], [34.5, 30], [3, 30], [3.5, 19], [7, 10]], S.skin);
  for (const [x, r] of [[7, 4], [13.5, 3.8], [20, 3.8], [26.5, 3.8], [31.5, 3]] as const) p.ellipse(x, 30, r, 3.4, S.skin);
  p.shade(0.2);
  // knuckle creases and the tendons fanning toward them
  for (const x of [13, 20, 26]) p.line(x - 1, 30, x + 1, 30, skinD);
  for (const [x0, x1] of [[16, 13], [20, 20], [24, 26]]) p.line(x0, 21, x1, 27, lighten(S.skin, 0.12));
  // eyes (three-quarter view, looking toward the opponent), shadow, lashes
  for (const [cx, rx] of [[16, 2.6], [25, 3]] as const) {
    p.rect(cx - rx, 10, rx * 2 + 1, 2, S.shadow);
    p.ellipse(cx + 0.5, 15.5, rx, 3.6, '#fbf8f4');
    p.rect(cx + 1, 14, 2, 3, '#2a1a30');
    p.set(cx + 1, 14, '#ffffff');
    p.line(cx - rx, 11.5, cx + rx + 1, 11.5, OUT);
    p.set(cx + rx + 1, 10, OUT), p.set(cx + rx + 2, 9, OUT), p.set(cx - rx, 10.5, OUT), p.set(cx, 10, OUT);
  }
  // blush, lips and a beauty mark
  p.set(12, 20, lighten(S.lips, 0.45)), p.set(13, 20, lighten(S.lips, 0.45)), p.set(29, 19, lighten(S.lips, 0.45));
  p.rect(20, 22, 7, 1, S.lips);
  p.rect(21, 23, 5, 2, S.lips);
  p.set(19, 22, darken(S.lips, 0.3)), p.set(27, 22, darken(S.lips, 0.3));
  p.set(23, 23, lighten(S.lips, 0.4));
  p.set(30, 22, '#3a1a20');
  p.outline(OUT);
  return p;
}

/** Wrist, bangle and fluffy cuff. 24x22, wrist base (neck) at (12, 20). */
function wrist(S: HandStyle): Painter {
  const p = new Painter(24, 22);
  p.rect(5, 10, 14, 12, S.skin);
  p.rect(4, 13, 16, 3, S.metal);
  p.line(4, 13, 19, 13, lighten(S.metal, 0.4));
  p.set(12, 14, S.gem);
  for (let i = 0; i < 6; i++) p.ellipse(3 + i * 3.6, 8.5, 2.8, 3.2, S.cuff);
  for (let i = 0; i < 5; i++) p.ellipse(5 + i * 3.6, 4.5, 2.6, 2.6, lighten(S.cuff, 0.15));
  p.shade(0.22);
  for (let i = 0; i < 5; i++) p.set(4 + i * 3.6, 5, lighten(S.cuff, 0.45));
  p.outline(OUT);
  return p;
}

/** Thumb, lower joint. Same frame as an upper arm: 12x21, pivot (6, 3). */
function thumbBase(S: HandStyle): Painter {
  const p = new Painter(12, 21);
  p.capsule(6, 3, 4.2, 6, 15, 3.8, S.skin);
  p.shade(0.2);
  p.line(4, 15, 8, 15, darken(S.skin, 0.2));
  p.outline(OUT);
  return p;
}
/** Thumb tip with its nail. 12x20, pivot (6, 3). */
function thumbTip(S: HandStyle): Painter {
  const p = new Painter(12, 20);
  p.capsule(6, 3, 3.8, 6, 12, 3.4, S.skin);
  p.shade(0.2);
  p.ellipse(7.5, 11.5, 2.2, 3.2, S.nail);
  p.set(8, 10, lighten(S.nail, 0.5));
  p.outline(OUT);
  return p;
}
/** First finger joint (a thigh): 14x25, pivot (7, 3). The index finger wears the cocktail ring. */
function fingerBase(S: HandStyle, ring: boolean): Painter {
  const p = new Painter(14, 25);
  p.capsule(7, 3, 4, 7, 19, 3.6, S.skin);
  p.shade(0.2);
  p.line(4, 20, 10, 20, darken(S.skin, 0.2));
  if (ring) {
    p.rect(2.5, 10, 9, 3, S.metal);
    p.line(3, 10, 11, 10, lighten(S.metal, 0.4));
    p.ellipse(8.5, 11, 2.4, 2.4, S.gem);
    p.set(8, 10, '#ffffff');
  }
  p.outline(OUT);
  return p;
}
/** Middle joint (a shin): 12x25, pivot (6, 2). */
function fingerMid(S: HandStyle): Painter {
  const p = new Painter(12, 25);
  p.capsule(6, 2, 3.6, 6, 17, 3.3, S.skin);
  p.shade(0.2);
  p.line(4, 9, 8, 9, darken(S.skin, 0.15));
  p.outline(OUT);
  return p;
}
/** Fingertip (a foot): 16x10, pivot (4, 2), the manicured nail on top. */
function fingerTip(S: HandStyle): Painter {
  const p = new Painter(16, 10);
  p.capsule(4, 4, 3.4, 11, 5, 3.1, S.skin);
  p.shade(0.2);
  p.poly([[6, 1.5], [11, 1.5], [14, 3], [14, 5], [6, 4.5]], S.nail);
  p.line(8, 2, 11, 2, lighten(S.nail, 0.55));
  p.outline(OUT);
  return p;
}

function buildHand(S: HandStyle): PartSet {
  const part = (p: Painter, px: number, py: number, dim = false): Part => {
    const c = p.clone();
    if (dim) c.dim(0.16);
    return { img: c.canvas(), px, py };
  };
  const none: Part = { img: new Painter(1, 1).canvas(), px: 0, py: 0 };
  const tb = thumbBase(S), tt = thumbTip(S), mid = fingerMid(S), tip = fingerTip(S);
  return {
    torso: part(handBack(S), 22, 30), head: part(wrist(S), 12, 20),
    uarm: part(tb, 6, 3), farm: part(tt, 6, 3),
    thigh: part(fingerBase(S, true), 7, 3), shin: part(mid, 6, 2), foot: part(tip, 4, 2),
    // the other fingers are curled into the hand, so the back "arm" draws nothing
    uarmB: none, farmB: none,
    thighB: part(fingerBase(S, false), 7, 3, true), shinB: part(mid, 6, 2, true), footB: part(tip, 4, 2, true),
  };
}

// ------------------------------------------------------------------ sounds
const now = () => ac()?.currentTime ?? 0;
export const hsfx = {
  /** Thumb cocking back like a hammer: two dry clicks. */
  cock() {
    noise({ dur: 0.012, vol: 0.3, type: 'highpass', freq: 4000 });
    noise({ dur: 0.016, vol: 0.22, type: 'bandpass', freq: 2400, q: 4, at: now() + 0.06 });
  },
  /** A cheeky mouth "pew" with a pop of air behind it. */
  pew() {
    tone({ type: 'square', freq: 1900, to: 320, dur: 0.13, vol: 0.06, filter: { type: 'lowpass', freq: 3000 } });
    noise({ dur: 0.06, vol: 0.25, type: 'bandpass', freq: 1400, q: 1 });
    tone({ type: 'sine', freq: 210, to: 60, dur: 0.12, vol: 0.22 });
  },
  /** Cartoon ricochet when the shot is blocked or lands. */
  ricochet() {
    tone({ type: 'sine', freq: 2600, to: 900, dur: 0.28, vol: 0.05 });
    tone({ type: 'triangle', freq: 1300, to: 450, dur: 0.28, vol: 0.03, detune: 12 });
  },
  /** The index finger straining against the thumb before a flick. */
  creak() {
    tone({ type: 'sawtooth', freq: 85, to: 150, dur: 0.32, vol: 0.05, filter: { type: 'lowpass', freq: 700 } });
    noise({ dur: 0.3, vol: 0.04, type: 'bandpass', freq: 500, q: 6, attack: 0.2 });
  },
  /** The flick letting go: a sharp thwip. */
  flick() {
    noise({ dur: 0.04, vol: 0.32, type: 'highpass', freq: 2200 });
    tone({ type: 'triangle', freq: 1300, to: 260, dur: 0.09, vol: 0.12 });
  },
  /** Fingernail on forehead: a woodblock bonk. */
  bonk() {
    tone({ type: 'sine', freq: 760, to: 520, dur: 0.09, vol: 0.28 });
    tone({ type: 'square', freq: 1520, dur: 0.04, vol: 0.04 });
  },
  /** An open-handed slap: crack of skin over a dull thump. */
  slap() {
    noise({ dur: 0.05, vol: 0.42, type: 'bandpass', freq: 2600, q: 0.8 });
    noise({ dur: 0.09, vol: 0.2, type: 'lowpass', freq: 450 });
    tone({ type: 'sine', freq: 170, to: 80, dur: 0.07, vol: 0.18 });
  },
  /** A pine board splitting under the chop. */
  boardCrack() {
    noise({ dur: 0.12, vol: 0.36, type: 'bandpass', freq: 900, q: 1.5 });
    tone({ type: 'square', freq: 230, to: 90, dur: 0.08, vol: 0.07 });
    noise({ dur: 0.05, vol: 0.18, type: 'highpass', freq: 3200, at: now() + 0.03 });
  },
  /** Finger snap. */
  snap() {
    noise({ dur: 0.02, vol: 0.5, type: 'highpass', freq: 3000 });
    tone({ type: 'sine', freq: 2100, to: 1750, dur: 0.05, vol: 0.12 });
  },
  /** Breathing on a fresh coat of polish. */
  blow() {
    noise({ dur: 0.35, vol: 0.09, type: 'bandpass', freq: 1300, to: 900, q: 1.2, attack: 0.06 });
  },
  /** Something very large falling out of the sky. */
  fallWhistle() {
    tone({ type: 'sine', freq: 1900, to: 330, dur: 0.75, vol: 0.06 });
  },
  /** The whole hand landing flat. */
  bigSplat() {
    noise({ dur: 0.4, vol: 0.5, type: 'lowpass', freq: 600 });
    tone({ type: 'sine', freq: 95, to: 32, dur: 0.45, vol: 0.42 });
    hsfx.slap();
  },
  /** A star twinkling where the flicked opponent vanished. */
  ding() {
    tone({ type: 'sine', freq: 2637, dur: 0.45, vol: 0.07 });
    tone({ type: 'sine', freq: 3520, dur: 0.4, vol: 0.05, at: now() + 0.09 });
  },
};

// ------------------------------------------------------------------ poses (facing right)
/** Balanced on the middle finger, index aimed at the opponent, thumb cocked up like a hammer. */
const AIM = P(STANCE, { t: -10, h: -6, lf: -92, kf: 0, ff: 0, lb: 8, kb: 6, fb: 0, af: -172, ef: -8 });
/** Bang: the thumb drops and the barrel kicks up. */
const FIRE = P(AIM, { t: -18, lf: -112, af: -105, ef: -55 });
/** Index tucked under the thumb, straining. */
const CURL = P(STANCE, { t: 6, h: 4, lf: -62, kf: 150, ff: 60, lb: 14, kb: 8, af: -35, ef: -40 });
/** The flick released. */
const FLICK = P(STANCE, { t: -10, h: -8, lf: -102, kf: -6, ff: -10, lb: 20, kb: 4, af: -80, ef: -20 });
const SLAP_F = P(STANCE, { t: 62, h: 18, lf: -40, kf: 30, lb: 22, kb: 10, af: -130, ef: -10 });
const SLAP_B = P(STANCE, { t: -34, h: -16, lf: -8, kf: 14, lb: 30, kb: 12, af: 10, ef: -30 });
/** Fingers pressed together under her like a blade. */
const BLADE = P(STANCE, { t: -4, h: -6, lf: -6, kf: 6, lb: 6, kb: 6, ff: 30, fb: 30, af: -170, ef: -10 });
/** Flat on her front, palm down: the swat. */
const FLAT = P(STANCE, { rot: -90, t: 0, h: 4, lf: -2, kf: 2, lb: 2, kb: 2, ff: 0, fb: 0, af: -20, ef: 0 });
/** Index raised to her lips to blow on the polish. */
const NAILS = P(STANCE, { t: -8, h: -10, lf: -150, kf: -50, ff: -70, lb: 8, kb: 4, af: -60, ef: -95 });
/** Standing on the index finger, middle finger pressed to the thumb: ready to snap. */
const SNAP_READY = P(STANCE, { t: -4, lf: 6, kf: 4, lb: -150, kb: -30, fb: -60, af: -150, ef: -40 });
const SNAP_DONE = P(SNAP_READY, { lb: -120, kb: 20, af: -170, ef: -10 });
const THUMBS_UP = P(STANCE, { t: -6, h: -8, af: -178, ef: -4, lf: -18, kf: 10, lb: 14, kb: 6 });

// ------------------------------------------------------------------ specials
const fingerPistol: Move = {
  id: 'proj_fingerbang',
  anim: A([
    [P(STANCE, { af: -120, ef: -40 }), 5],
    [AIM, 9, 'hold'],
    [FIRE, 2, 'out'],
    [FIRE, 10],
    [STANCE, 7],
  ]),
  sounds: { frames: { 4: hsfx.cock } },
  onFrame: (self, f, fr) => {
    if (fr === 14) {
      const s = self.skel;
      const x = self.wx(s.toeF[0] + 4), y = self.wy(s.toeF[1]);
      f.projectiles.push(new Projectile(self, 'fingerbang', x, y));
      self.projOut = true;
      hsfx.pew();
      f.particles.flash(x, y, 4, '#fff0f8');
    }
    // a wisp of smoke off the fingertip
    if (fr > 16 && fr < 28 && fr % 3 === 0) f.particles.smoke(self.wx(self.skel.toeF[0]), self.wy(self.skel.toeF[1]) + 2, 1, '#d8d0d8');
  },
};

const megaFlick: Move = {
  id: 'megaflick',
  anim: A([
    [CURL, 6, 'in'],
    [P(CURL, { kf: 156, t: 8 }), 9],
    [FLICK, 2, 'out'],
    [FLICK, 8],
    [STANCE, 8],
  ]),
  active: [16, 23],
  vx: (fr) => (fr >= 4 && fr < 15 ? 2 : 0),
  hit: { limb: 'toeF', r: 8, dmg: 100, level: 'mid', effect: 'knockdown', push: 4, stun: 22, special: true },
  sounds: { frames: { 5: hsfx.creak, 15: hsfx.flick }, impact: hsfx.bonk, blocked: hsfx.bonk },
  onFrame: (self, f, fr) => {
    // trembling with the strain
    self.shake = fr >= 6 && fr < 15 ? 2 : 0;
    if (fr === 16) f.particles.sparks(self.wx(self.skel.toeF[0]), self.wy(self.skel.toeF[1]), 4, '#fff2f8');
  },
};

const karateChop: Move = {
  id: 'karatechop', air: true,
  anim: A([
    [P(CROUCH, { af: -150, ef: -20 }), 2],
    [BLADE, 9, 'out'],
    [P(BLADE, { rot: 80 }), 8, 'out'],
    [P(TUCK, { af: -150, ef: -30, rot: 0 }), 30],
  ]),
  active: [2, 18],
  hit: { limb: 'body', r: 15, dmg: 110, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true },
  sounds: { frames: { 1: 'jump', 10: ['whoosh'] }, impact: hsfx.boardCrack },
  onFrame: (self, f, fr) => {
    if (fr === 1) {
      self.vy = 7.4;
      self.y = 1;
      self.vx = 1.2 * self.facing;
      f.sfx('kiai', 520);
    }
    // splinters of the imaginary board
    if (fr === 11) f.particles.sparks(self.x + self.facing * 14, self.y + 70, 3, '#e8c890');
  },
};

const SLAP_KEYS: [ReturnType<typeof P>, number, 'out'?][] = [];
for (let i = 0; i < 6; i++) SLAP_KEYS.push([i % 2 ? SLAP_B : SLAP_F, 3, 'out'], [P(i % 2 ? SLAP_B : SLAP_F, { t: i % 2 ? -26 : 52 }), 3]);
const slapHappy: Move = {
  id: 'slaphappy',
  anim: A([[P(STANCE, { t: -22, h: -10 }), 4], ...SLAP_KEYS, [STANCE, 10]]),
  active: [4, 40],
  vx: (fr) => (fr >= 4 && fr < 40 ? 0.8 : 0),
  hit: { limb: 'body', r: 22, dmg: 20, level: 'mid', effect: 'light', push: 1.2, stun: 14, rehit: 6, special: true },
  sounds: { impact: hsfx.slap },
  onFrame: (self, f, fr) => {
    if (fr >= 4 && fr < 40 && fr % 6 === 4) {
      sfx.whoosh(1);
      f.particles.sparks(self.x + self.facing * rand(18, 28), rand(50, 70), 2, '#ffd0e0');
    }
  },
};

const specials: Special[] = [
  { name: 'Finger Pistol', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: fingerPistol },
  { name: 'Mega Flick', cmd: [4, 6], btn: 'k', text: 'B, F + K', move: megaFlick },
  { name: 'Karate Chop', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP', move: karateChop },
  { name: 'Slap Happy', cmd: [6, 4], btn: 'hp', mash: 'hp', text: 'MASH HP', move: slapHappy },
];

/** Finger-pistol shot: a hot pink slug of nail polish with a speed streak and a glint. */
export function drawFingerBang(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  ctx.fillStyle = '#ff9ac8';
  ctx.fillRect(dir > 0 ? -16 : 4, 0, 12, 1);
  ctx.fillRect(dir > 0 ? -11 : 4, -2, 7, 1);
  ctx.fillStyle = OUT;
  ctx.fillRect(-4, -3, 8, 6);
  ctx.fillStyle = '#ff2a78';
  ctx.fillRect(-3, -2, 6, 4);
  ctx.fillRect(dir > 0 ? 3 : -4, -1, 1, 2);
  ctx.fillStyle = '#ffd0e8';
  ctx.fillRect(dir > 0 ? 0 : -2, -2, 2, 1);
  if (t % 6 < 3) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dir > 0 ? 1 : -2, -1, 1, 1);
  }
}

// ------------------------------------------------------------------ finisher
let FLAT_BUF: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;
/** The loser's sprite lying on its back, floor at y = 100 of a 200x200 buffer. */
function lyingSprite(l: Fighter): HTMLCanvasElement {
  const [cv, c] = (FLAT_BUF ??= makeCanvas(200, 200));
  const s = fk(LIE), k = l.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, 200, 200);
  c.translate(100, 100 - groundOffset(s) * k);
  c.scale(l.facing * k, k);
  drawRig(c, l.parts, s);
  return cv;
}

/**
 * Swat & Flick: she leaps out of sight, the victim's shadow-check goes badly, and she comes down
 * flat as a giant swat. What is left is a paper-thin pancake, which she flicks into the sky until
 * it twinkles out like a star. Then the snap.
 */
function swatAndFlick(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  if (tt === 0) {
    D.dir = w.facing;
    D.shadow = 0;
  }
  const dir = D.dir;
  w.vy = 0;
  if (tt < 16) {
    w.x += (l.x - dir * 54 - w.x) * 0.2;
    w.poseOverride = null;
  } else if (tt < 30) {
    w.poseOverride = P(CROUCH, { af: -150, ef: -20 });
    w.shake = tt > 24 ? 2 : 0;
  } else if (tt < 50) {
    // the leap, out of the top of the screen
    if (tt === 30) {
      sfx.jump();
      hsfx.fallWhistle();
    }
    const k = (tt - 30) / 20;
    w.y = k * k * 260;
    w.x = lerp(l.x - dir * 54, l.x - dir * 6, k);
    w.poseOverride = P(BLADE, { rot: k * 180 * dir });
  } else if (tt < 96) {
    w.alpha = 0;
    w.y = 260;
    D.shadow = (tt - 50) / 46;
    // looking up at what is coming
    l.poseOverride = P(HIT_HIGH, { t: -18, h: -40, af: -140, ef: -60, ab: -120, eb: -70 });
    l.shake = tt > 80 ? 2 : 0;
    if (tt === 62) hsfx.fallWhistle();
    if (tt === 84) sfx.ow();
  } else if (tt < 104) {
    // coming down flat
    w.alpha = 1;
    w.poseOverride = FLAT;
    w.x = l.x - dir * 6;
    w.y = lerp(200, 0, (tt - 96) / 7);
  } else if (tt === 104) {
    w.y = 0;
    hsfx.bigSplat();
    sfx.thud();
    fight.shake(16);
    ps.dust(l.x - 30, 10, '#d8c8b0');
    ps.dust(l.x + 30, 10, '#d8c8b0');
    for (let i = 0; i < 8; i++) ps.sparks(l.x + rand(-40, 40), rand(2, 16), 1, '#ffffff');
    l.alpha = 0;
    l.shake = 0;
    D.flat = lyingSprite(l);
    D.shadow = 0;
    D.squash = 0.12;
  } else if (tt < 140) {
    w.y = 0;
    w.shake = tt < 112 ? 1 : 0;
    D.squash = Math.min(0.34, D.squash + 0.02);
  } else if (tt < 150) {
    // peel back up and step aside
    w.poseOverride = tt < 145 ? P(FLAT, { rot: -60 }) : P(STANCE, { t: -20 });
    if (tt === 140) sfx.jump();
    w.x = lerp(w.x, l.x - dir * 44, 0.35);
  } else if (tt < 176) {
    w.x = l.x - dir * 44;
    w.poseOverride = P(CURL, { kf: 156 });
    w.shake = tt > 156 ? 2 : 0;
    if (tt === 152) hsfx.creak();
  } else if (tt === 176) {
    w.shake = 0;
    w.poseOverride = FLICK;
    hsfx.flick();
    hsfx.bonk();
    D.fly = { x: l.x, y: 4, vx: dir * 5, vy: 7.5, rot: 0, k: 1, t: 0 };
  } else if (tt < 236) {
    if (tt > 190) w.poseOverride = THUMBS_UP;
    if (tt === 192) say(HANDERSON_LINES.finisher, VOICE);
  } else if (tt < 252) {
    w.poseOverride = tt < 246 ? SNAP_READY : SNAP_DONE;
    if (tt === 246) {
      hsfx.snap();
      const s = w.skel;
      ps.sparks(w.wx(s.handF[0]), w.wy(s.handF[1]), 8, '#fff2a0');
    }
  } else {
    w.poseOverride = THUMBS_UP;
  }
  const F = D.fly;
  if (F && F.k > 0) {
    F.t++;
    F.x += F.vx;
    F.y += F.vy;
    F.vy -= 0.12;
    F.rot += 0.35 * dir;
    F.k = Math.max(0, 1 - F.t / 70);
    if (F.k === 0) {
      // gone, twinkling like a star
      hsfx.ding();
      ps.flash(F.x, F.y, 5, '#ffffff');
      ps.sparks(F.x, F.y, 10, '#fff6c0');
    }
  }
  return tt >= 330;
}

function drawSwat(ctx: CanvasRenderingContext2D, fight: Fight, cam: number, front: boolean) {
  const D = fight.fatal?.data, l = fight.loser;
  if (!D || !l) return;
  if (!front) {
    if (D.shadow > 0) {
      // the hand's shadow spreading over the victim
      const w = Math.round(10 + D.shadow * 70), x = Math.round(l.x - cam);
      ctx.fillStyle = `rgba(0,0,0,${0.5 + D.shadow * 0.4})`;
      for (const [dy, inset] of [[-2, 8], [-1, 3], [0, 0], [1, 0], [2, 3], [3, 8]]) ctx.fillRect(x - w / 2 + inset, FLOOR + dy, w - inset * 2, 1);
    }
    if (D.flat && !D.fly) {
      const kx = 1.3, ky = D.squash, x = Math.round(l.x - cam);
      ctx.drawImage(D.flat, 0, 0, 200, 100, x - 100 * kx, FLOOR - 100 * ky + 1, 200 * kx, 100 * ky);
    }
    return;
  }
  const F = D.fly;
  if (F && F.k > 0) {
    ctx.save();
    ctx.translate(Math.round(F.x - cam), Math.round(FLOOR - F.y));
    ctx.rotate(F.rot);
    // flipping end over end like a sheet of paper
    ctx.scale(F.k * Math.max(0.15, Math.abs(Math.cos(F.t * 0.3))), F.k);
    ctx.drawImage(D.flat, 0, 0, 200, 100, -130, -100 * D.squash + 4, 260, 100 * D.squash);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ round-one entrance
const entry = new WeakMap<Fighter, number>();

/** Tiptoes in, blows on a fresh coat of polish, admires it, and gives a thumbs up. */
export const HANDERSON_INTRO: Intro = {
  line: HANDERSON_LINES.intro,
  speech: VOICE,
  speakAt: 104,
  dur: 160,
  update(self, f, t, home) {
    if (t === 0 || !entry.has(self)) {
      entry.set(self, offscreenX(self, f));
      self.setAnim(AN.WALK);
    }
    if (t <= 54) {
      self.x = lerp(entry.get(self)!, home, t / 54);
      if (t === 54) self.setAnim(AN.IDLE);
    } else if (t < 64) {
      self.poseOverride = null;
    } else if (t < 96) {
      self.poseOverride = NAILS;
      const s = self.skel;
      if (t === 70) hsfx.blow();
      if (t >= 70 && t < 86 && t % 3 === 0) {
        // a breath of air from her lips toward the nail
        const mx = self.wx(s.hip[0] + 4), my = self.wy(s.hip[1] - 6);
        f.particles.add({ kind: 'spark', x: mx, y: my, vx: self.facing * 0.8, vy: 0.5, life: 14, max: 14, size: 1, color: '#f0f4ff', floor: false });
      }
      if (t === 90) {
        f.particles.sparks(self.wx(s.toeF[0]), self.wy(s.toeF[1]), 6, '#ffffff');
        sfx.twinkle();
      }
    } else {
      self.poseOverride = THUMBS_UP;
      if (t === 98) {
        const s = self.skel;
        f.particles.sparks(self.wx(s.handF[0]), self.wy(s.handF[1]), 5, '#fff6c0');
        sfx.sparkle();
      }
      if (t >= 150) self.poseOverride = null;
    }
  },
};

// ------------------------------------------------------------------ post-match portrait
/** A close-up of the back of her hand: lashes, lipstick, ring, cuff and that thumb. */
export const HANDERSON_PORTRAIT: PortraitStyle = {
  paint(p, c) {
    const S = styleOf(c.look), b = c.beaten;
    // index and middle fingers heading down out of frame, the other two curled at the back
    c.sculpt((m) => {
      m.capsule(58, 92, 8.5, 57, 126, 8, '#fff');
      m.capsule(77, 90, 8, 80, 126, 7.5, '#fff');
    }, S.skin, { soft: 2, into: c.skin });
    const crease = darken(S.skin, 0.22);
    p.line(52, 112, 62, 112, crease), p.line(74, 113, 84, 113, crease);
    c.sculpt((m) => {
      m.ellipse(34, 98, 11, 9, '#fff');
      m.ellipse(20, 92, 9, 9, '#fff');
    }, darken(S.skin, 0.1), { soft: 2 });
    p.ellipse(37, 104, 4.5, 2.6, S.nail);
    p.ellipse(23, 98, 3.5, 2.6, S.nail);
    // the back of the hand, and the wrist above it
    c.sculpt((m) => {
      m.poly([[30, 16], [76, 16], [84, 30], [92, 58], [94, 90], [12, 90], [12, 58], [20, 30]], '#fff');
      for (const x of [22, 41, 60, 79]) m.ellipse(x, 90, 10, 6, '#fff');
    }, S.skin, { soft: 4, into: c.skin });
    // cocktail ring on the index finger
    p.rect(70, 104, 18, 5, S.metal);
    p.line(70, 104, 87, 104, lighten(S.metal, 0.4));
    p.ellipse(79, 105, 6, 5, S.gem);
    p.set(77, 103, '#ffffff'), p.set(78, 103, '#ffffff');
    // thumb reaching forward, nail up
    c.sculpt((m) => m.capsule(86, 70, 9, 101, 46, 6.5, '#fff'), S.skin, { soft: 3, into: c.skin });
    p.ellipse(98, 46, 4, 6, S.nail);
    p.line(97, 42, 98, 46, lighten(S.nail, 0.5));
    // knuckles and tendons
    for (const x of [41, 60, 79]) p.line(x - 3, 92, x + 3, 92, crease);
    for (const x of [42, 60, 76]) p.line(x, 76, x, 86, lighten(S.skin, 0.1));
    // bangle and fluffy cuff
    p.rect(26, 14, 52, 7, S.metal);
    p.line(26, 15, 77, 15, lighten(S.metal, 0.45));
    p.ellipse(52, 17, 4, 3, S.gem);
    for (let i = 0; i < 8; i++) c.sculpt((m) => m.ellipse(22 + i * 8.5, 7 + (i % 2) * 2, 7, 7, '#fff'), S.cuff, { soft: 2 });
    // eyes: shadow, whites, irises looking toward the opponent, lashes
    for (const [cx, cy, rx] of [[c.geom.eyeA[0], c.geom.eyeA[1], 6], [c.geom.eyeB[0], c.geom.eyeB[1], 7]]) {
      p.ellipse(cx, cy - 7, rx + 2, 4, S.shadow);
      p.ellipse(cx, cy, rx, b ? 4 : 8, '#fbf8f4');
      p.ellipse(cx + 2, cy + (b ? 1 : 1), 3, b ? 2.5 : 4.5, '#5a3a80');
      p.rect(cx + 2, cy, 2, 3, '#140a18');
      p.set(cx + 1, cy - 2, '#ffffff');
      const top = cy - (b ? 4 : 8);
      p.line(cx - rx, top, cx + rx, top, OUT);
      for (let k = 0; k < 4; k++) p.line(cx - rx + 2 + k * 3.5, top, cx - rx + 1 + k * 4, top - 4, OUT);
    }
    // lipstick, beauty mark, blush
    const [mx, my] = c.geom.mouth;
    p.poly([[mx - 8, my], [mx - 3, my - 3], [mx, my - 2], [mx + 3, my - 3], [mx + 8, my], [mx + 3, my + 4], [mx - 3, my + 4]], S.lips);
    p.line(mx - 7, my, mx + 7, my, darken(S.lips, 0.4));
    p.line(mx - 2, my + 2, mx + 2, my + 2, lighten(S.lips, 0.35));
    if (b) p.line(mx + 6, my + 1, mx + 12, my + 6, S.lips); // smudged
    p.ellipse(mx + 13, my - 8, 1.2, 1.2, '#3a1a20');
    for (const [x, y] of [[38, 62], [80, 60]]) c.sculpt((m) => m.ellipse(x, y, 5, 3, '#fff'), lighten(S.lips, 0.4), { soft: 2, clip: c.skin });
    if (b) {
      // a broken nail and a sticking plaster across the knuckles
      p.poly([[95, 41], [101, 42], [99, 45]], darken(S.skin, 0.1));
      p.poly([[50, 84], [68, 80], [70, 85], [52, 89]], '#e8d0a8');
      p.set(58, 84, '#b09070'), p.set(62, 83, '#b09070');
    } else {
      p.set(99, 43, '#ffffff');
    }
  },
};

export function handerson(): CharDef {
  return {
    id: 'handerson', name: 'Pamela Handerson', short: 'HANDERSON', title: 'Five-Finger Fury', look: HAND_LOOK, alt: HAND_ALT,
    specials, voice: 330, props: {}, scale: 1.25,
    sprites: (L) => buildHand(styleOf(L)),
    finisher: { name: 'Swat & Flick', cmd: [4, 6, 4], btn: 'hp', text: 'B, F, B + HP (close)', range: [0, 100] },
    fatality: swatAndFlick, fatalityDraw: drawSwat, intro: HANDERSON_INTRO, portrait: HANDERSON_PORTRAIT,
    quotes: [
      'TALK IS CHEAP, {L}. SLAPS ARE FREE.',
      'I HAVE GOT FIVE FINGERS AND YOU FELT EVERY ONE.',
      'DO NOT TOUCH THE NAILS. THEY ARE STILL WET.',
      'THAT WAS NOT A FIGHT. THAT WAS A MANICURE WITH EXTRA STEPS.',
      'HANDS DOWN, THE BEST. HANDS UP, STILL THE BEST.',
    ],
    quotesVs: {
      jackson: 'ONE GLOVE? HONEY, I AM THE WHOLE HAND.',
      brucelee: 'ONE-INCH PUNCH? I DID IT WITH ONE FINGER.',
      ramsay: 'YOU WANTED IT HANDS-ON, CHEF. YOU GOT IT.',
      blaine: 'SLEIGHT OF HAND? I AM THE HAND.',
    },
  };
}
