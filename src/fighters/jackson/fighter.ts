import type { CharDef } from '../../game/fighter';
import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, LAUNCHED, FALL } from '../../game/anims';
import type { Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import type { Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import { sfx } from '../../audio/sfx';
import { rand } from '../../core/rng';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Michael Jackson: a pixel caricature of the pop showman. Every special is a dance move.
// Voice barks are original synth whoops; no lyrics, melodies or logos.

export const JACKSON_LOOK: Look = {
  skin: '#c89070', hair: '#100c10', eye: '#2a1a14', shirt: '#ecebf0', coat: '#b01820', coatTrim: '#d8d8e0',
  pants: '#141218', boots: '#0c0a0e', socks: '#f4f4f8', hat: 'fedora', hatTrim: '#ecebf0', hairStyle: 'curls',
  gloveFront: '#f4f4ff', belt: '#1a1a1e', buckle: '#d8d8e0',
};
/** Palette swap for mirror matches: the white suit. */
export const JACKSON_ALT: Look = {
  ...JACKSON_LOOK, coat: '#e8e6ea', coatTrim: '#8a8a90', shirt: '#2a3a7a', pants: '#e8e6ea', hatColor: '#ecebef',
  hatTrim: '#141218', boots: '#ecebef', socks: '#ecebef', belt: '#e0dee4', necktie: '#ecebef',
};

const SPARKLE = '#ffffff';

/** Pose for the forward lean, rigid from the heels up. */
const LEAN = P(STANCE, { rot: 32, t: 0, h: -10, lf: 0, kf: 0, lb: 0, kb: 0, ff: -32, fb: -32, ab: 15, eb: -10, af: 10, ef: -15 });
/** One hand on the hat brim, the other at the hip. */
const HAT_TIP = P(STANCE, { t: 2, h: 6, af: -150, ef: -120, ab: 20, eb: -60, lf: -10, kf: 6, lb: 12, kb: 4 });

// Moonwalk legs: one foot flat, the other heel-up, swapping every step.
const MW_A = P(STANCE, { t: 2, h: -2, ab: 15, eb: -25, af: 20, ef: -35, lf: 4, kf: 0, ff: 0, lb: -18, kb: 38, fb: 35 });
const MW_B = P(STANCE, { t: 2, h: -2, ab: 25, eb: -35, af: 10, ef: -25, lb: 4, kb: 0, fb: 0, lf: -18, kf: 38, ff: 35 });

const fedoraToss: Move = {
  id: 'proj_fedora',
  anim: A([
    [P(HAT_TIP, { af: -165, ef: -110 }), 7],
    [P(STANCE, { af: -92, ef: -2, ab: 30, eb: -40, t: 18, h: -4, lf: -35, kf: 35, lb: 25, kb: 8 }), 10],
    [P(STANCE, { af: -88, ef: -8, t: 12 }), 10],
    [STANCE, 6],
  ]),
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 0) f.sfx('hee');
    if (fr === 9) {
      f.projectiles.push(new Projectile(self, 'fedora', self.x + self.facing * 22, 58));
      self.projOut = true;
      f.sfx('hatSpin');
    }
  },
};

const moonwalkStrike: Move = {
  id: 'moonwalk',
  anim: A([
    [P(STANCE, { t: 0, h: 0, ab: 10, af: 10 }), 4],
    [MW_A, 6], [MW_B, 6], [MW_A, 6], [MW_B, 6],
    // spin back round into a high heel kick
    [P(STANCE, { lf: -85, kf: 100, t: -10, af: -60, ab: 20 }), 3],
    [P(STANCE, { lf: -140, kf: -4, ff: -40, t: -34, h: 14, af: -10, ef: -50, ab: 40, lb: 6, kb: 0 }), 8],
    [STANCE, 10],
  ]),
  active: [29, 37],
  vx: (fr) => (fr >= 4 && fr < 28 ? 3.1 : 0),
  hit: { limb: 'toeF', r: 7, dmg: 90, level: 'high', effect: 'knockdown', push: 2.5, stun: 20, special: true },
  whoosh: true,
  onFrame: (self, f, fr) => {
    // face away and glide backwards into the opponent, then turn and kick
    if (fr === 0) self.facing = (-self.moveDir) as 1 | -1;
    if (fr === 28) {
      self.facing = self.moveDir as 1 | -1;
      f.sfx('ow');
    }
    if (fr >= 4 && fr < 28 && fr % 3 === 0) f.particles.smoke(self.x, 2, 1, '#6a6070');
    if (fr === 4) f.sfx('roll');
  },
};

const toeSpin: Move = {
  id: 'toespin', air: true,
  anim: A([
    [P(CROUCH, { af: -20, ab: -20 }), 2],
    [P(STANCE, { t: -4, h: -10, af: -172, ef: -8, ab: -40, eb: -60, lf: 0, kf: 0, ff: 40, lb: -70, kb: 120 }), 18],
    [P(TUCK, { af: -150, ef: -30 }), 30],
  ]),
  spin: 3,
  active: [2, 18],
  hit: { limb: 'body', r: 14, dmg: 105, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true },
  onFrame: (self, f, fr) => {
    if (fr === 1) {
      self.vy = 7.2;
      self.y = 1;
      self.vx = 0.8 * self.facing;
      f.sfx('hee');
      f.sfx('sparkle');
    }
    if (fr > 1 && fr < 18) f.particles.sparks(self.x + rand(-10, 10), self.y + rand(20, 80), 1, SPARKLE);
  },
};

export const JACKSON_SPECIALS: Special[] = [
  { name: 'Fedora Toss', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: fedoraToss },
  { name: 'Moonwalk Strike', cmd: [4, 6], btn: 'lk', text: 'B, F + LK', move: moonwalkStrike },
  { name: 'Toe Spin Rise', cmd: [6, 2, 3], btn: 'hk', text: 'F, D, DF + HK', move: toeSpin },
];

export const JACKSON_FINISHER = { name: 'Showstopper', cmd: [2, 6], btn: 'hk' as const, text: 'D, F + HK (close)', range: [0, 90] as [number, number] };

/** Entrance state per fighter: the facing he started with and where he glided in from. */
const entry = new WeakMap<Fighter, { face: 1 | -1; x0: number }>();

/** Round 1 entrance: moonwalks in backwards from the edge, spins round and tips the hat. */
export const JACKSON_INTRO: Intro = {
  line: 'Hee hee! Try to keep up.',
  speech: { pitch: 1.6, rate: 1.1 },
  speakAt: 80,
  dur: 140,
  update(self, f, t, home) {
    if (t === 0 || !entry.has(self)) entry.set(self, { face: self.facing, x0: offscreenX(self, f) });
    const E = entry.get(self)!;
    if (t <= 56) {
      // face away from the opponent while gliding toward them
      self.facing = (-E.face) as 1 | -1;
      self.x = lerp(E.x0, home, t / 56);
      self.poseOverride = Math.floor(t / 6) % 2 ? MW_B : MW_A;
      if (t % 4 === 0) f.particles.smoke(self.x, 2, 1, '#6a6070');
    } else if (t < 72) {
      self.facing = ((t >> 2) % 2 ? E.face : -E.face) as 1 | -1;
      self.poseOverride = P(STANCE, { t: -2, h: -6, af: -95, ef: -5, ab: -80, eb: -10, lf: 0, kf: 0, ff: 40, lb: -60, kb: 110 });
      f.particles.sparks(self.x + rand(-8, 8), rand(20, 70), 1, SPARKLE);
      if (t === 58) f.sfx('sparkle');
    } else {
      self.facing = E.face;
      self.poseOverride = t < 110 ? HAT_TIP : null;
      if (t === 72) f.sfx('hee');
    }
  },
};

/**
 * Finisher: a sparkling pirouette, a heel kick that sends the head flying,
 * then the impossible lean and a tip of the hat while the body drops.
 * Returns true when the sequence has finished.
 */
export function jacksonFatality(fight: Fight, tt: number, w: Fighter, l: Fighter, D: any): boolean {
  const neck = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) });
  const glove = () => ({ x: w.wx(w.skel.handF[0]), y: w.wy(w.skel.handF[1]) });
  if (tt === 0) D.dir = w.facing;
  if (tt < 24) {
    w.x += (l.x - D.dir * 40 - w.x) * 0.2;
    w.poseOverride = HAT_TIP;
    if (tt === 6) sfx.hee();
  } else if (tt < 64) {
    // pirouette with the glove throwing off sparkles
    w.facing = ((tt >> 2) % 2 === 0 ? D.dir : -D.dir) as 1 | -1;
    w.poseOverride = P(STANCE, { t: -2, h: -6, af: -95, ef: -5, ab: -80, eb: -10, lf: 0, kf: 0, ff: 40, lb: -60, kb: 110 });
    const g = glove();
    fight.particles.sparks(g.x, g.y, 2, SPARKLE);
    if (tt % 10 === 4) sfx.sparkle();
  } else if (tt < 72) {
    w.facing = D.dir;
    w.poseOverride = P(STANCE, { lf: -85, kf: 100, t: -10, af: -60, ab: 20 });
  } else if (tt < 110) {
    w.poseOverride = P(STANCE, { lf: -150, kf: -4, ff: -40, t: -36, h: 14, af: -10, ef: -50, ab: 40, lb: 6, kb: 0 });
  } else if (tt < 190) {
    w.poseOverride = LEAN;
  } else {
    w.poseOverride = HAT_TIP;
  }
  if (tt === 72) {
    sfx.slash();
    sfx.ow();
    const n = neck();
    l.hidden.add('head');
    fight.particles.chunk(l.parts.head.img, l.parts.head.px, l.parts.head.py, n.x, n.y, D.dir * 1.1, 7, 0.4 * D.dir);
    fight.particles.blood(n.x, n.y, D.dir, 50, 1.4);
    fight.particles.sparks(n.x, n.y, 12, SPARKLE);
    fight.shake(10);
    sfx.blood();
  }
  if (tt > 72 && tt < 150) {
    const n = neck();
    // a fountain straight up from the neck
    fight.particles.blood(n.x, n.y + 2, rand(-0.4, 0.4), 3, 1.8);
    if (tt % 18 === 0) sfx.blood();
  }
  if (tt === 110) sfx.hee();
  if (tt === 140) {
    l.poseOverride = null;
    l.setState('fall', FALL);
    l.vy = 1.5;
    l.y = 1;
    l.vx = -D.dir * 0.5;
  }
  if (tt === 200) sfx.hee();
  if (tt < 140 && tt >= 72) l.poseOverride = P(LAUNCHED, { t: -10, h: 0, af: -40, ab: -30, lf: -10, kf: 15, lb: 10, kb: 10 });
  return tt >= 250;
}

export function jackson(): CharDef {
  return {
    id: 'jackson', name: 'Michael Jackson', short: 'JACKSON', title: 'The Gloved One', look: JACKSON_LOOK, alt: JACKSON_ALT,
    specials: JACKSON_SPECIALS, voice: 230, props: {}, finisher: JACKSON_FINISHER, intro: JACKSON_INTRO,
  };
}
