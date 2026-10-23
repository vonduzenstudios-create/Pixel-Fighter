import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, VICTORY, LAUNCHED, FALL } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import type { Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import type { Particles } from '../../game/particles';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { Color, darken, lighten } from '../../gfx/palette';
import type { Part } from '../../gfx/rig';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { say, sfx } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Oprah Winfrey: a light-hearted pixel caricature of the daytime talk-show host. Big blowout,
// gold earrings, a magenta power suit. She fights with giveaways, a book-club hardcover and a
// studio audience that never stops clapping. Every line is original; no show quotes or logos.

const OUT = '#100810';
const CONFETTI = ['#f04878', '#f0c020', '#40b8f0', '#60d070', '#ffffff', '#b060f0'];

export const OPRAH_LOOK: Look = {
  skin: '#8e5a3a', hair: '#2a1810', eye: '#1e120c', shirt: '#f4ece0', coat: '#a81c6c', coatTrim: '#e8c050',
  pants: '#a81c6c', boots: '#1a1018', hairStyle: 'blowout', earrings: '#f0c848', lips: '#8a2438',
};
/** Palette swap for mirror matches: the royal-blue suit with silver jewellery. */
export const OPRAH_ALT: Look = {
  ...OPRAH_LOOK, coat: '#1e4a9a', coatTrim: '#d8dce8', pants: '#1e4a9a', shirt: '#f8f4ec', earrings: '#e0e4f0', hair: '#3a2214', lips: '#a03048',
};

// ------------------------------------------------------------------ sprites

function done(p: Painter, px: number, py: number): Part {
  p.outline(OUT);
  return { img: p.canvas(), px, py };
}

/** Oversized book-club hardcover, gripped by its top edge. */
export function hardcover(): Part {
  const p = new Painter(16, 26);
  p.rect(1, 2, 14, 22, '#2a4a8a');
  p.rect(12, 3, 3, 20, '#f0e8d0'); // page block
  for (let y = 5; y < 22; y += 3) p.line(12, y, 14, y, '#c8bca0');
  p.rect(1, 2, 2, 22, '#1a3060'); // spine
  p.line(5, 7, 10, 7, '#e8c050');
  p.line(5, 9, 9, 9, '#e8c050');
  // gold seal of approval
  p.ellipse(7.5, 16, 3, 3, '#e8c050');
  p.set(7, 15, '#fff4c0');
  p.set(8, 17, '#a07820');
  p.rect(6, 0, 4, 3, '#1a3060');
  p.shade(0.15);
  return done(p, 8, 1);
}

/** Wrapped present with a ribbon and bow. */
function giftBox(): HTMLCanvasElement {
  const p = new Painter(14, 14);
  p.rect(1, 4, 12, 9, '#e83878');
  p.rect(6, 4, 2, 9, '#f0c020');
  p.rect(1, 6, 12, 2, '#f0c020');
  p.ellipse(4.5, 2.5, 2.5, 1.8, '#f0c020');
  p.ellipse(9.5, 2.5, 2.5, 1.8, '#f0c020');
  p.set(7, 3, '#fff0a0');
  p.shade(0.2);
  p.outline(OUT);
  return p.canvas();
}

/** The grand prize: a shiny red sedan wearing a giant gold bow. Faces right unless flipped. */
function prizeCar(flip: boolean): HTMLCanvasElement {
  const Wd = 60;
  const p = new Painter(Wd, 30);
  const X = (x: number) => (flip ? Wd - 1 - x : x);
  const poly = (pts: number[][], c: Color) => p.poly(pts.map(([x, y]) => [X(x), y]), c);
  const rect = (x: number, y: number, w: number, h: number, c: Color) => p.rect(flip ? Wd - x - w : x, y, w, h, c);
  const body = '#c81828';
  poly([[2, 17], [4, 13], [16, 12], [22, 6], [40, 6], [47, 12], [56, 13], [58, 17], [58, 23], [2, 23]], body);
  poly([[23, 7.5], [31, 7.5], [31, 12], [18.5, 12]], '#a8d8f0'); // rear window
  poly([[33, 7.5], [39.5, 7.5], [45, 12], [33, 12]], '#a8d8f0'); // windscreen
  rect(31, 7, 2, 6, darken(body, 0.3));
  rect(3, 15, 54, 1, lighten(body, 0.4)); // chrome stripe
  rect(54, 15, 4, 3, '#fff4b0'); // headlight
  rect(2, 15, 2, 3, '#ff6060'); // tail light
  rect(1, 21, 58, 2, '#c8ccd8'); // bumper line
  for (const wx of [14, 46]) {
    p.ellipse(X(wx), 23, 5.5, 5.5, '#141218');
    p.ellipse(X(wx), 23, 3, 3, '#c8ccd8');
    p.set(X(wx), 23, '#ffffff');
  }
  // the bow on the roof
  p.ellipse(X(26), 3, 5, 3, '#f0c020');
  p.ellipse(X(36), 3, 5, 3, '#f0c020');
  p.ellipse(X(31), 4, 2, 2, '#ffe060');
  poly([[30, 5], [26, 10], [28, 10], [31, 6]], '#d8a010');
  poly([[32, 5], [36, 10], [34, 10], [31, 6]], '#d8a010');
  p.shade(0.18);
  p.line(X(22), 6, X(40), 6, lighten(body, 0.5));
  p.outline(OUT);
  return p.canvas();
}

let SPR: { gift: HTMLCanvasElement; carR: HTMLCanvasElement; carL: HTMLCanvasElement } | null = null;
const spr = () => (SPR ??= { gift: giftBox(), carR: prizeCar(false), carL: prizeCar(true) });

/** Projectile drawing for the 'gift' kind (called from projectile.ts, origin at its centre). */
export function drawGift(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  ctx.rotate(Math.sin(t * 0.35) * 0.35 * dir);
  ctx.drawImage(spr().gift, -7, -7);
}

/** A burst of falling paper confetti. */
export function confetti(ps: Particles, x: number, y: number, n: number, spread = 1.6) {
  for (let i = 0; i < n; i++)
    ps.add({
      kind: 'spark', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-spread, spread), vy: rand(0.4, 2.6),
      grav: 0.06, life: 70, max: 70, size: 2, color: CONFETTI[i % CONFETTI.length],
    });
}

// ------------------------------------------------------------------ poses

/** Both arms flung wide: "presenting" the prize. */
const PRESENT: Pose = P(STANCE, { t: -4, h: -8, af: -130, ef: -10, ab: -120, eb: -15, lf: -14, kf: 10, lb: 16, kb: 4 });
/** One hand on the hip, the other pointing at the audience. */
const POINT: Pose = P(STANCE, { t: 2, h: -6, af: -110, ef: -4, ab: 30, eb: -110, lf: -10, kf: 6, lb: 12, kb: 4 });
const WAVE_A: Pose = P(STANCE, { t: 0, h: -6, af: -165, ef: -30, ab: 20, eb: -40 });
const WAVE_B: Pose = P(STANCE, { t: 0, h: -6, af: -150, ef: -70, ab: 20, eb: -40 });
/** Clapping above her head. */
const CLAP_UP: Pose = P(STANCE, { t: -6, h: -10, af: -160, ef: -40, ab: -150, eb: -50 });

// ------------------------------------------------------------------ specials

const giveaway: Move = {
  id: 'proj_gift',
  anim: A([
    // underhand toss: box down by the back hip, then a big scooping swing
    [P(STANCE, { af: 40, ef: -30, ab: -40, eb: -90, t: 14, h: -2, lf: -30, kf: 40, lb: 24, kb: 10 }), 8],
    [P(STANCE, { af: -50, ef: -10, ab: 10, eb: -40, t: 6, h: -6, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
    [P(STANCE, { af: -125, ef: -8, ab: 20, eb: -30, t: -6, h: -10, lf: -36, kf: 36, lb: 26, kb: 6 }), 12],
    [STANCE, 6],
  ]),
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 10) {
      f.projectiles.push(new Projectile(self, 'gift', self.x + self.facing * 22, 46));
      self.projOut = true;
      f.sfx('whoosh');
    }
  },
};

const bookSlam: Move = {
  id: 'bookslam', prop: 'book',
  anim: A([
    [P(STANCE, { af: -205, ef: -10, ab: -195, eb: -10, t: -16, h: -8, lf: -20, kf: 20 }), 9],
    [P(STANCE, { af: -80, ef: -4, ab: -72, eb: -6, t: 32, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 }), 5],
    [P(STANCE, { af: -58, ef: -4, ab: -52, eb: -6, t: 36, h: 8, lf: -45, kf: 45, lb: 30, kb: 6 }), 14],
    [STANCE, 8],
  ]),
  active: [9, 15],
  vx: (fr) => (fr < 12 ? 1.8 : 0),
  hit: { limb: 'prop', r: 10, dmg: 110, level: 'overhead', effect: 'knockdown', push: 2.5, stun: 22, special: true },
  whoosh: true,
  onFrame: (self, f, fr) => {
    if (fr === 15 && self.hits > 0) {
      // loose pages flutter off the cover
      const x = self.opp.x, ps = f.particles;
      for (let i = 0; i < 8; i++) ps.add({ kind: 'spark', x: x + rand(-8, 8), y: rand(50, 70), vx: rand(-1, 1), vy: rand(0.5, 2), grav: 0.04, life: 50, max: 50, size: 2, color: i % 2 ? '#f4ecd8' : '#ffffff' });
    }
  },
};

// alternating open-palm slaps, like a crowd that will not stop clapping
const slaps: [Pose, number][] = [];
for (let i = 0; i < 6; i++)
  slaps.push([
    i % 2
      ? P(STANCE, { af: -55, ef: -85, ab: -96, eb: -4, t: 20, h: 2, lf: -42, kf: 42, lb: 30, kb: 8 })
      : P(STANCE, { af: -96, ef: -4, ab: -55, eb: -85, t: 16, h: 0, lf: -40, kf: 40, lb: 30, kb: 8 }),
    4,
  ]);

const ovation: Move = {
  id: 'ovation',
  anim: A([[CLAP_UP, 5], ...slaps, [P(CLAP_UP, { t: -8, h: -12 }), 8], [STANCE, 8]]),
  active: [5, 29],
  vx: (fr) => (fr >= 5 && fr < 29 ? 1.3 : 0),
  hit: { limb: 'handF', r: 11, dmg: 24, level: 'mid', effect: 'light', push: 1.3, stun: 14, rehit: 6, special: true },
  onFrame: (self, f, fr) => {
    if (fr >= 5 && fr < 29 && fr % 4 === 1) {
      f.sfx('whoosh');
      f.particles.sparks(self.x + self.facing * 30, rand(44, 64), 2, CONFETTI[fr % CONFETTI.length]);
    }
    if (fr === 30) confetti(f.particles, self.x, 90, 14);
  },
};

const specials: Special[] = [
  { name: 'Giveaway Toss', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: giveaway },
  { name: 'Book Club Slam', cmd: [4, 6], btn: 'hp', text: 'B, F + HP', move: bookSlam },
  { name: 'Standing Ovation', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP', move: ovation },
];

// ------------------------------------------------------------------ intro

export const OPRAH_LINES = {
  intro: "Welcome to the show! Today's topic: your defeat.",
  finisher: 'You get a car! And you get a car! And you get a car!',
};
const VOICE = { pitch: 1.0, rate: 1.0, female: true };

/** Round 1 entrance: walks out under a spotlight waving to the crowd, then presents herself to applause. */
export const OPRAH_INTRO: Intro = {
  line: OPRAH_LINES.intro,
  speech: VOICE,
  speakAt: 72,
  dur: 150,
  update(self, f, t, home) {
    if (t <= 48) {
      self.x = lerp(offscreenX(self, f), home, t / 48);
      self.poseOverride = null;
      if (t === 0) self.setAnim(A([[P(WAVE_A, { lf: -26, kf: 20, lb: 20, kb: 6 }), 6], [P(WAVE_B, { lf: 14, kf: 10, lb: -22, kb: 24 }), 6]], true));
    } else if (t < 64) {
      self.poseOverride = (t >> 2) % 2 ? WAVE_A : WAVE_B;
    } else if (t < 120) {
      self.poseOverride = PRESENT;
      if (t === 64) {
        playCue(['applause', 'confettiPop']);
        confetti(f.particles, self.x, 120, 30, 2.2);
      }
      if (t === 92) playCue('applause');
    } else self.poseOverride = POINT;
  },
  draw(ctx, self, _f, t, cam) {
    // a soft studio spotlight that follows her in
    const x = Math.round(self.x - cam);
    ctx.globalAlpha = Math.min(1, t / 20) * 0.16;
    ctx.fillStyle = '#fff2c8';
    ctx.beginPath();
    ctx.moveTo(x - 8, 0);
    ctx.lineTo(x + 8, 0);
    ctx.lineTo(x + 30, FLOOR);
    ctx.lineTo(x - 30, FLOOR);
    ctx.fill();
    ctx.fillRect(x - 30, FLOOR - 2, 60, 4);
    ctx.globalAlpha = 1;
  },
};

// ------------------------------------------------------------------ finisher

/**
 * Grand Prize Reveal: "You get a car!" Each shout drops a prize car out of the sky, the first one
 * squarely on the loser, then it just rains cars all over the stage and the confetti cannons go off.
 */
function grandPrize(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  if (t === 0) {
    D.dir = w.facing;
    D.cars = [];
  }
  const dir = D.dir as 1 | -1;
  // back up to give the first car room to land on the loser
  if (t < 24 && (l.x - w.x) * dir < 70) w.x = Math.max(20, Math.min(f.sw - 20, w.x - dir * 2.5));
  const drop = (x: number) => {
    // never on Oprah herself
    if (Math.abs(x - w.x) < 40) x = w.x + dir * 40 * (x === l.x ? 1 : Math.sign(x - w.x) || 1);
    const flip = (x - w.x) * dir > 0 ? dir === 1 : rand(0, 1) < 0.5;
    ps.add({ kind: 'img', img: flip ? spr().carL : spr().carR, ix: 30, iy: 28, x, y: 240, vx: 0, vy: -1, grav: 0.3, rot: rand(-0.3, 0.3), vrot: rand(-0.04, 0.04), life: 9999, max: 9999, floor: true, bounce: 0.25 });
    const car = ps.list[ps.list.length - 1];
    D.cars.push(car);
    playCue('whistle');
    return car;
  };
  // pointing at a new winner on every shout, then arms wide while it pours
  if (t === 4) playCue('applause');
  if (t === 14) say(OPRAH_LINES.finisher, VOICE);
  if (t < 160) w.poseOverride = (t - 14) % 56 < 30 ? POINT : PRESENT;
  if (t === 24) D.first = drop(l.x);
  if (t === 70) drop(l.x - dir * 70);
  if (t === 126) drop(l.x + dir * 60);
  if (t >= 160 && t < 300 && t % 9 === 0) drop(f.camX + rand(10, 246));
  for (const car of D.cars) {
    // a busy finish can push old particles out of the list; keep the cars on stage
    if (!ps.list.includes(car)) ps.list.push(car);
    if (!car.landed && car.y <= 0.5) {
      car.landed = true;
      sfx.crunch();
      sfx.thud();
      f.shake(car === D.first ? 14 : 6);
      ps.smoke(car.x, 2, 6, '#8a8088');
      ps.sparks(car.x, 4, 6);
      if (rand(0, 1) < 0.35) playCue('horn');
    }
    if (car.landed && car.grav === 0) car.rot = 0;
  }
  // the first car lands right on top of the loser
  if (D.first && !D.hit && D.first.y < 74) {
    D.hit = t;
    sfx.blood();
    for (const n of ['torso', 'head', 'armF', 'armB', 'legF', 'legB'] as const) l.hidden.add(n);
    const s = l.skel, Pt = l.parts;
    const parts: [Part, [number, number]][] = [
      [Pt.torso, s.hip], [Pt.head, s.neck], [Pt.uarm, s.shF], [Pt.farm, s.elbowF], [Pt.uarmB, s.shB], [Pt.farmB, s.elbowB],
      [Pt.thigh, s.hipF], [Pt.shin, s.kneeF], [Pt.foot, s.ankleF], [Pt.thighB, s.hipB], [Pt.shinB, s.kneeB], [Pt.footB, s.ankleB],
    ];
    for (const [part, at] of parts)
      ps.chunk(part.img, part.px, part.py, l.wx(at[0]), l.wy(at[1]), rand(-3, 3), rand(2, 5), rand(-0.4, 0.4));
    ps.blood(l.x, 40, -1, 50, 1.8);
    ps.blood(l.x, 40, 1, 50, 1.8);
    l.alpha = 0;
  }
  if (D.hit && t > D.hit && t < D.hit + 80) ps.blood(l.x + rand(-20, 20), 2, rand(-1, 1), 2, 1);
  if (t >= 160) w.poseOverride = (t >> 4) % 2 ? PRESENT : P(VICTORY, { ab: -150, eb: -20 });
  if (t === 330) {
    playCue(['confettiPop', 'applause']);
    confetti(ps, w.x - dir * 40, 150, 40, 2.4);
    confetti(ps, w.x + dir * 60, 150, 40, 2.4);
  }
  if (t > 330 && t % 20 === 0 && t < 420) confetti(ps, w.x + rand(-80, 80), 190, 10);
  return t >= 440;
}

export const OPRAH_PORTRAIT: PortraitStyle = {
  back(p, c) {
    // the big bouncy blowout behind the face, flipped out at the shoulders
    const h = c.look.hair;
    c.sculpt((m) => m.ellipse(50, 38, 36, 32, '#fff'), h, { soft: 7 });
    c.sculpt((m) => m.poly([[16, 52], [36, 60], [42, 92], [26, 98], [12, 92], [14, 72]], '#fff'), h, { soft: 4 });
    for (let i = 0; i < 6; i++) p.line(22 + i * 10, 12 + (i % 2) * 2, 30 + i * 9, 30 + i, lighten(h, 0.3));
    for (let y = 60; y < 94; y += 6) p.line(18, y, 30, y + 3, lighten(h, 0.2));
  },
  front(p, c) {
    const g = c.geom, L = c.look;
    // side-swept fringe over the brow
    c.sculpt((m) => m.poly([[44, 22], [82, 30], [80, 40], [66, 36], [52, 38], [44, 34]], '#fff'), L.hair, { soft: 3 });
    p.line(52, 26, 78, 33, lighten(L.hair, 0.35));
    // drop earring
    const [ex, ey] = g.ear;
    c.sculpt((m) => m.ellipse(ex, ey + 12, 3, 4, '#fff'), L.earrings ?? '#f0c848', { soft: 1 });
    p.set(ex - 1, ey + 10, '#ffffff');
    // lipstick
    if (L.lips && !c.beaten) {
      const [mx, my] = g.mouth;
      p.line(mx - 8, my + 1, mx + 3, my, L.lips);
      p.line(mx - 6, my + 2, mx + 2, my + 2, darken(L.lips, 0.2));
    }
  },
};

export function oprah(): CharDef {
  return {
    id: 'oprah', name: 'Oprah Winfrey', short: 'OPRAH', title: 'The Talk Show Titan', look: OPRAH_LOOK, alt: OPRAH_ALT,
    specials, voice: 210, props: { book: hardcover() }, intro: OPRAH_INTRO, portrait: OPRAH_PORTRAIT,
    finisher: { name: 'Grand Prize Reveal', cmd: [6, 4, 6], btn: 'lk', text: 'F, B, F + LK (any range)', range: [0, 400] },
    fatality: grandPrize,
    quotes: [
      'YOU CAME ON AS A GUEST, {L}. YOU LEAVE AS A CAUTIONARY TALE.',
      'LOOK UNDER YOUR SEAT. THAT IS A BRUISE.',
      'THE AUDIENCE GAVE YOU A STANDING OVATION. FOR LEAVING.',
      'THAT WAS A TEACHABLE MOMENT. CLASS DISMISSED.',
    ],
    quotesVs: {
      lumpsum: 'KEEP YOUR BIG CHECK. I GIVE AWAY BIGGER ONES ON TUESDAYS.',
      bobross: 'LOVELY LITTLE TREES. NOW SIT DOWN FOR THE COMMERCIAL BREAK.',
    },
  };
}
