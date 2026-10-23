import type { Look } from './build';
import { A, P, STANCE, CROUCH, DIZZY, HIT_HIGH, HIT_MID, WALK } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import type { Particle } from '../game/particles';
import { Projectile } from '../game/projectile';
import { cleaver, cloche, plate, skillet, sprig, steak } from '../gfx/props';
import { darken, lighten } from '../gfx/palette';
import { propTip, type Part } from '../gfx/rig';
import { PW, PH, type PortraitStyle } from '../gfx/portrait';
import { lerp, offscreenX, type Intro } from '../game/intro';
import { playCue } from '../audio/specials';
import { say, sfx } from '../audio/sfx';
import { rand } from '../core/rng';

// Gordon Ramsay: a pixel caricature of the famously furious celebrity chef. Spiky blond crop,
// double-breasted chef whites, a cast-iron skillet and a cleaver. Every line is original.

export const RAMSAY_LOOK: Look = {
  skin: '#e8ae88', hair: '#e8c468', eye: '#3a5a8c', shirt: '#f4f2ec', pants: '#22222a', boots: '#121216',
  hairStyle: 'spiky', chefCoat: '#2a2a34', apron: '#585e6c',
};
/** Palette swap for mirror matches: black chef jacket, red apron. */
export const RAMSAY_ALT: Look = { ...RAMSAY_LOOK, shirt: '#26262e', chefCoat: '#e8e4dc', apron: '#8a1a1e', hair: '#d8a850', pants: '#3a3a44' };

const VOICE = { pitch: 0.95, rate: 1.1 };
export const RAMSAY_LINES = {
  intro: "Right! Let's turn up the heat.",
  finisher: 'Plated, seasoned, and served.',
};

let IMG: { steak: HTMLCanvasElement; cloche: HTMLCanvasElement; plate: HTMLCanvasElement; sprig: HTMLCanvasElement } | null = null;
const img = () => (IMG ??= { steak: steak(), cloche: cloche(), plate: plate(), sprig: sprig() });

/** World position of the tip of whatever he is holding. */
function tip(self: Fighter, len = 24) {
  const v = propTip(self.skel, len);
  return { x: self.wx(v[0]), y: self.wy(v[1]) };
}

// ------------------------------------------------------------------ poses
const PAN_OUT = P(STANCE, { af: -80, ef: -12, pa: 0, ab: -40, eb: -100, t: 6 });
const CHOP_UP = P(STANCE, { af: -175, ef: -35, ab: -40, eb: -90, t: -6, h: -6, lf: -30, kf: 30, lb: 24, kb: 8 });
const CHOP_DOWN = P(STANCE, { af: -62, ef: -6, pa: 12, ab: -30, eb: -80, t: 26, h: 8, lf: -42, kf: 42, lb: 30, kb: 8 });
const ARMS_FOLDED = P(STANCE, { t: 2, h: -6, af: -50, ef: -140, ab: -60, eb: -130, lf: -14, kf: 8, lb: 14, kb: 4 });

// ------------------------------------------------------------------ specials
/** Flicks the skillet and sends a flaming steak spinning across the stage. */
const steakFlip: Move = {
  id: 'proj_steak', prop: 'skillet',
  anim: A([
    [P(STANCE, { af: -40, ef: -30, pa: -30, ab: -40, eb: -100, t: 2 }), 6],
    [P(STANCE, { af: -22, ef: -10, pa: -20, t: -4, h: -4 }), 3],
    [P(STANCE, { af: -112, ef: -20, pa: 24, ab: -30, eb: -90, t: 14, h: -2, lf: -35, kf: 35, lb: 25, kb: 8 }), 10],
    [P(STANCE, { af: -90, ef: -10, t: 8 }), 10],
    [STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr < 9 && fr % 3 === 0) {
      const t = tip(self);
      f.particles.smoke(t.x, t.y + 3, 1, '#e0d8d0');
    }
    if (fr === 9) {
      f.projectiles.push(new Projectile(self, 'steak', self.x + self.facing * 26, 58));
      self.projOut = true;
      f.sfx('whoosh');
    }
  },
};

/** Brandy into the pan and a pillar of fire roars up: an anti-air launcher. */
const flambe: Move = {
  id: 'flambe', prop: 'skillet',
  anim: A([
    [P(PAN_OUT, { ab: -110, eb: -50, t: 8 }), 5],
    [P(CROUCH, { af: -62, ef: -10, pa: 0, ab: -115, eb: -40, t: 24, h: -6 }), 4],
    [P(STANCE, { af: -152, ef: -14, pa: 30, ab: -30, eb: -60, t: -14, h: -16, lf: -40, kf: 30, lb: 10, kb: 20 }), 14],
    [P(STANCE, { af: -140, ef: -20, pa: 20, t: -8, h: -8 }), 8],
    [STANCE, 8],
  ]),
  active: [8, 22],
  vx: (fr) => (fr < 9 ? 1.4 : 0),
  hit: { limb: 'prop', r: 13, dmg: 100, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true, sfx: 'burn' },
  onFrame: (self, f, fr) => {
    const t = tip(self);
    if (fr < 6 && fr % 2 === 0) f.particles.sparks(t.x - self.facing * 6, t.y + 6, 1, '#c87a30'); // the brandy splash
    if (fr >= 5 && fr < 9) f.particles.fire(t.x, t.y + 2, 2, 3);
    if (fr === 9) {
      f.particles.flash(t.x, t.y + 6, 10, '#ffd060');
      f.shake(3);
    }
    if (fr >= 9 && fr < 26) for (let k = 0; k < 4; k++) f.particles.fire(t.x + rand(-4, 4), t.y + k * 9, 2, 3);
    if (fr >= 12 && fr < 30 && fr % 3 === 0) f.particles.smoke(t.x, t.y + 40, 1, '#3a3438');
  },
};

/** A furious chopping flurry with the cleaver, stepping in on every stroke. */
const mince: Move = {
  id: 'mince', prop: 'cleaver',
  anim: A([
    [P(CHOP_UP, { af: -165, ef: -50 }), 5],
    ...[0, 1, 2, 3].flatMap((): [ReturnType<typeof P>, number][] => [[CHOP_UP, 4], [CHOP_DOWN, 4]]),
    [P(CHOP_DOWN, { t: 30, h: 10 }), 6],
    [STANCE, 10],
  ]),
  active: [7, 37],
  vx: (fr) => (fr >= 5 && fr < 33 ? 1.7 : 0),
  hit: { limb: 'prop', r: 9, dmg: 24, level: 'mid', effect: 'light', push: 1.2, stun: 14, rehit: 6, special: true, sfx: 'slash' },
  onFrame: (self, f, fr) => {
    if (fr >= 5 && fr < 37 && fr % 8 === 1) f.sfx('whoosh');
    if (fr >= 9 && fr < 37 && fr % 8 === 1) {
      const t = tip(self, 22);
      f.particles.sparks(t.x, Math.max(4, t.y), 2, '#f4f8ff');
    }
  },
};

export const RAMSAY_SPECIALS: Special[] = [
  { name: 'Sizzling Steak', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: steakFlip },
  { name: 'Flambe Pillar', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP', move: flambe },
  { name: 'Mince Meat', cmd: [4, 6], btn: 'lp', mash: 'lp', text: 'B, F + LP or MASH LP', move: mince },
];

// ------------------------------------------------------------------ round 1 entrance
/** Tosses a steak in the skillet as he strides in, then flambes it with a roar. */
export const RAMSAY_INTRO: Intro = {
  line: RAMSAY_LINES.intro,
  speech: VOICE,
  speakAt: 66,
  dur: 150,
  update(self, f, t, home) {
    self.propOverride = self.ch.props.skillet ?? null;
    if (t <= 46) {
      if (t === 0) self.setAnim(WALK);
      self.poseOverride = null;
      self.x = lerp(offscreenX(self, f), home, t / 46);
      if (t % 8 === 0) f.particles.smoke(self.x + self.facing * 22, 50, 1, '#e0d8d0');
      return;
    }
    const flip = (t >= 52 && t < 56) || (t >= 74 && t < 78);
    if (t < 96) self.poseOverride = flip ? P(PAN_OUT, { af: -100, pa: 20 }) : PAN_OUT;
    else if (t < 130) self.poseOverride = P(STANCE, { af: -140, ef: -16, pa: 24, ab: -60, eb: -110, t: -8, h: -10 });
    else self.poseOverride = P(PAN_OUT, { af: -70 });
    if (t === 52 || t === 74) {
      // the steak leaves the pan, turns over and drops back in
      const p = tip(self);
      f.particles.add({ kind: 'img', img: img().steak, ix: 7, iy: 5, x: p.x, y: p.y + 4, vx: 0, vy: 3, grav: 0.27, rot: 0, vrot: 0.29 * self.facing, life: 22, max: 22, floor: false });
      playCue('sizzle');
    }
    if (t === 74 + 21) playCue('panClang');
    if (t === 96) {
      playCue('flambe');
      f.shake(3);
    }
    if (t >= 96 && t < 128) {
      const p = tip(self);
      for (let k = 0; k < 3; k++) f.particles.fire(p.x + rand(-4, 4), p.y + k * 8, 2, 3);
    }
    if (t >= 46 && t < 96 && t % 6 === 0) {
      const p = tip(self);
      f.particles.smoke(p.x, p.y + 4, 1, '#e0d8d0');
    }
  },
};

// ------------------------------------------------------------------ finisher
/**
 * Chef's Table: a cleaver flurry that takes them apart, a plate slid onto the deck, the head
 * landing on it, a giant serving dome, a cloud of steam, the reveal with garnish, and a taste.
 */
function chefsTable(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  const floor = ps.floorY;
  /** Particles under the finisher's direct control: long-lived and never culled. */
  const keep = (p: Particle) => {
    p.life = 99999;
    if (!ps.list.includes(p)) ps.list.push(p);
    return p;
  };
  const spawn = (o: Partial<Particle> & { x: number; y: number }) => {
    ps.add({ life: 99999, max: 99999, floor: false, grav: 0, rot: 0, ...o });
    return ps.list[ps.list.length - 1];
  };
  const neck = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) });

  if (tt === 0) {
    D.dir = w.facing;
    D.px = 0;
  }
  const dir: 1 | -1 = D.dir;
  w.facing = dir;

  // ---- the chopping
  if (tt < 16) {
    w.x += (l.x - dir * 30 - w.x) * 0.2;
    w.propOverride = w.ch.props.cleaver ?? null;
    w.poseOverride = CHOP_UP;
    if (tt === 4) playCue('chefBark');
  } else if (tt < 64) {
    const ph = (tt - 16) % 8, k = (tt - 16) >> 3;
    w.poseOverride = ph < 4 ? CHOP_UP : CHOP_DOWN;
    if (ph === 4) {
      const hy = rand(36, 66);
      playCue('cleaverChop');
      l.shake = 3;
      l.poseOverride = k % 2 ? HIT_HIGH : HIT_MID;
      ps.blood(l.x - dir * 4, hy, dir, 10, 1.1);
      ps.sparks(l.x - dir * 6, hy, 2, '#ffffff');
      const s = l.skel, L = l.parts;
      if (k === 1) {
        l.hidden.add('armF');
        ps.chunk(L.uarm.img, L.uarm.px, L.uarm.py, l.wx(s.shF[0]), l.wy(s.shF[1]), dir * 1.4, 3, 0.3 * dir);
        ps.chunk(L.farm.img, L.farm.px, L.farm.py, l.wx(s.elbowF[0]), l.wy(s.elbowF[1]), dir * 2, 2.5, -0.3 * dir);
        ps.blood(l.wx(s.shF[0]), l.wy(s.shF[1]), dir, 30, 1.3);
        sfx.blood();
      }
      if (k === 3) {
        l.hidden.add('armB');
        ps.chunk(L.uarmB.img, L.uarmB.px, L.uarmB.py, l.wx(s.shB[0]), l.wy(s.shB[1]), -dir * 1.2, 3, -0.3 * dir);
        ps.chunk(L.farmB.img, L.farmB.px, L.farmB.py, l.wx(s.elbowB[0]), l.wy(s.elbowB[1]), -dir * 1.8, 2.5, 0.3 * dir);
        ps.blood(l.wx(s.shB[0]), l.wy(s.shB[1]), -dir, 30, 1.3);
        sfx.blood();
      }
    }
    if (tt === 36) sfx.scream();
  } else if (tt < 72) {
    w.poseOverride = P(CHOP_UP, { af: -190, ef: -20, t: -12, h: -10 });
    l.poseOverride = DIZZY;
    l.shake = 0;
    if (tt === 64) playCue('chefBark');
  }
  if (tt === 72) {
    // one last stroke and the whole lot comes apart
    w.poseOverride = P(CHOP_DOWN, { t: 34, h: 12 });
    playCue('cleaverChop');
    sfx.slash();
    sfx.blood();
    fight.shake(12);
    fight.hitstop = 6;
    const s = l.skel, L = l.parts;
    const bits: [Part, [number, number]][] = [
      [L.torso, s.hip], [L.thigh, s.hipF], [L.shin, s.kneeF], [L.foot, s.ankleF], [L.thighB, s.hipB], [L.shinB, s.kneeB], [L.footB, s.ankleB],
    ];
    for (const [part, at] of bits) ps.chunk(part.img, part.px, part.py, l.wx(at[0]), l.wy(at[1]), rand(-1.4, 1.4), rand(1, 3.5), rand(-0.3, 0.3));
    const n = neck();
    D.h0 = n;
    D.head = spawn({ kind: 'img', img: l.parts.head.img, ix: l.parts.head.px, iy: l.parts.head.py, x: n.x, y: n.y });
    ps.blood(n.x, n.y, dir, 40, 1.5);
    ps.blood(l.x, 40, -dir, 40, 1.5);
    l.alpha = 0;
    D.px = w.x + dir * 42;
  }
  if (tt > 72 && tt < 100 && tt % 4 === 0) ps.blood(D.px - dir * 2 + rand(-10, 10), 4, rand(-1, 1), 3, 0.9);

  // ---- plating: slide a plate out, the head drops onto it
  if (tt === 80) {
    w.propOverride = null;
    D.plate = spawn({ kind: 'img', img: img().plate, ix: 21, iy: 3, x: w.x + dir * 14, y: floor + 3 });
    playCue('boardKnock');
  }
  if (tt >= 80 && tt < 100) {
    w.poseOverride = P(CROUCH, { af: -84, ef: -4, ab: -40, eb: -90, t: 32, h: 4 });
    keep(D.plate).x = lerp(w.x + dir * 14, D.px, (tt - 80) / 16);
  }
  if (D.head && tt > 72 && tt <= 112) {
    // a high arc from the neck stump down onto the plate
    const k = (tt - 72) / 40;
    const h = keep(D.head);
    h.x = lerp(D.h0.x, D.px, k);
    h.y = lerp(D.h0.y, floor + 4, k) + Math.sin(k * Math.PI) * 70;
    h.rot = (1 - k) * 4 * dir;
    if (tt === 112) {
      h.rot = 0;
      sfx.thud();
      playCue('boardKnock');
      ps.blood(D.px, floor + 6, dir, 8, 0.6);
    }
  }
  if (tt >= 100 && tt < 140) w.poseOverride = ARMS_FOLDED;

  // ---- the serving dome comes down, steam escapes
  if (tt === 118) D.cl = spawn({ kind: 'img', img: img().cloche, ix: 20, iy: 38, x: D.px, y: floor + 140 });
  if (D.cl && tt > 118 && tt <= 140) {
    const k = (tt - 118) / 22;
    keep(D.cl).y = floor + 2 + 138 * (1 - k * k);
    if (tt === 140) {
      playCue('panClang');
      sfx.thud();
      fight.shake(5);
      ps.smoke(D.px, floor + 2, 8, '#f0ece8');
    }
  }
  if (tt >= 140 && tt < 200) {
    w.poseOverride = tt % 30 < 15 ? ARMS_FOLDED : P(ARMS_FOLDED, { lf: -30, kf: 20 }); // tapping a foot
    if (tt % 5 === 0) ps.smoke(D.px + rand(-18, 18), floor + 3, 1, '#f4f0ec');
    if (tt === 150 || tt === 176) playCue('steam');
  }

  // ---- the reveal and the taste
  if (tt >= 200 && D.cl) {
    w.poseOverride = tt < 212 ? P(STANCE, { t: 10, af: -100, ef: -20, ab: -40, eb: -90 }) : tt < 250 ? P(STANCE, { t: -6, h: -10, af: -168, ef: -10, ab: 20, eb: -60 }) : w.poseOverride;
    const c = keep(D.cl);
    if (tt < 250) {
      const hx = w.wx(w.skel.handF[0]), hy = w.wy(w.skel.handF[1]);
      c.x += (hx - c.x) * 0.3;
      c.y += (hy - 6 - c.y) * 0.3;
    }
    if (tt === 206) {
      playCue('steam');
      sfx.twinkle();
      ps.smoke(D.px, floor + 10, 14, '#ffffff');
      ps.sparks(D.px, floor + 24, 10, '#ffffff');
      spawn({ kind: 'img', img: img().sprig, ix: 3, iy: 5, x: D.px + dir * 12, y: floor + 5 });
      spawn({ kind: 'img', img: img().sprig, ix: 3, iy: 5, x: D.px - dir * 13, y: floor + 5 });
    }
    if (tt === 250) {
      // done with the dome: it goes over his shoulder with a clatter
      c.life = 400;
      c.vx = -dir * 2.2;
      c.vy = 3;
      c.grav = 0.25;
      c.vrot = -0.2 * dir;
      c.floor = true;
      D.cl = null;
    }
  }
  if (tt >= 254) {
    // leans in for a taste
    w.poseOverride = tt < 290 ? P(STANCE, { t: 24, h: 18, af: -70, ef: -40, ab: -90, eb: -150 }) : P(STANCE, { t: 0, h: -10, af: -60, ef: -130, ab: -60, eb: -130 });
    if (tt === 262) say(RAMSAY_LINES.finisher, VOICE);
  }
  if (D.head && tt > 112) keep(D.head);
  if (D.plate && tt > 100) keep(D.plate);
  return tt >= 330;
}

// ------------------------------------------------------------------ portrait
/** Gelled spikes, the deep forehead creases, and the stand-up collar and buttons of the chef whites. */
export const RAMSAY_PORTRAIT: PortraitStyle = {
  front: (p, c) => {
    const L = c.look;
    // the whole crown of the head is repainted as one gelled mass so the tufts shade with it
    const spikes: number[][][] = [];
    const rise = [7, 11, 8, 12, 9, 13, 10, 12, 9, 11, 8, 6];
    for (let i = 0; i < rise.length; i++) {
      const bx = 22 + i * 4.8, by = 31 - 14 * Math.sqrt(Math.max(0, 1 - ((bx - 51) / 26) ** 2)) + 4;
      const lean = 4 + (i % 3) * 2 + i * 0.4;
      spikes.push([[bx - 3, by + 2], [bx + lean, by - rise[i]], [bx + 4, by + 2]]);
    }
    const top = new Uint8Array(PW * PH);
    for (let y = 0; y < 31; y++) top.fill(1, y * PW, y * PW + PW);
    c.sculpt((m) => {
      m.ellipse(51, 31, 26, 14, '#fff');
      spikes.forEach((s) => m.poly(s, '#fff'));
    }, L.hair, { soft: 2, bias: 0.1, clip: top });
    const hi = lighten(L.hair, 0.4), lo = darken(L.hair, 0.35);
    for (const [b, t] of spikes) {
      p.line((b[0] + t[0]) / 2 + 1, (b[1] + t[1]) / 2 + 3, t[0], t[1] + 2, hi);
      p.line(b[0] + 2, b[1] + 2, (b[0] + t[0]) / 2, (b[1] + t[1]) / 2 + 4, lo);
    }
    // forehead creases, deeper when he is angry
    const crease = darken(L.skin, c.beaten ? 0.25 : 0.36);
    for (const y of [33, 36, 39]) {
      p.line(49, y + 1, 58, y, crease);
      p.line(58, y, 69, y + 1, crease);
    }
    if (!c.beaten) p.line(57, 42, 58, 46, crease), p.line(60, 42, 60, 46, crease);
    if (!L.chefCoat) return;
    // chef whites: stand-up collar, crossover flap, two rows of buttons
    p.poly([[38, 87], [68, 87], [70, 96], [36, 96]], lighten(L.shirt, 0.08));
    p.line(36, 96, 70, 96, darken(L.shirt, 0.3));
    p.line(53, 87, 53, 96, darken(L.shirt, 0.2));
    p.line(68, 98, 46, 121, darken(L.shirt, 0.22));
    for (const [x, y] of [[40, 104], [40, 115], [68, 104], [66, 115]]) {
      p.ellipse(x, y, 2, 2, L.chefCoat);
      p.set(x - 1, y - 1, lighten(L.chefCoat, 0.4));
    }
  },
};

export function ramsay(): CharDef {
  return {
    id: 'ramsay', name: 'Gordon Ramsay', short: 'RAMSAY', title: 'The Furious Chef', look: RAMSAY_LOOK, alt: RAMSAY_ALT,
    specials: RAMSAY_SPECIALS, voice: 150, props: { skillet: skillet(), cleaver: cleaver() },
    finisher: { name: "Chef's Table", cmd: [4, 6, 4], btn: 'lp', text: 'B, F, B + LP (close)', range: [0, 90] },
    fatality: chefsTable, intro: RAMSAY_INTRO, portrait: RAMSAY_PORTRAIT,
    quotes: [
      'YOU CALL THAT A FIGHT? I HAVE SEEN TOUGHER SOUFFLES.',
      'SEARED, SEASONED AND SERVED, {L}. NEXT!',
      'THAT WAS UNDERCOOKED. BACK TO THE PREP LINE.',
      'MY NAN HITS HARDER, AND SHE ONLY BAKES SCONES.',
      'WAKE UP, {L}! THE TICKETS ARE PILING UP!',
    ],
    quotesVs: {
      bobross: 'LOVELY LITTLE TREE. I AM USING IT AS GARNISH.',
      lumpsum: 'KEEP THE CHANGE. THE SERVICE WAS SHOCKING.',
      jackson: 'ONE GLOVE? GOOD. NOW WASH YOUR HANDS.',
      colonel: 'YOUR CHICKEN IS DRY, COLONEL. SO IS YOUR FIGHTING.',
    },
  };
}
