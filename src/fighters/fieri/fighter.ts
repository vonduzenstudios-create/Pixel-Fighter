import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, VICTORY, HIT_HIGH, DIZZY } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import { FLOOR } from '../../core/consts';
import { Painter } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import type { Part } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import { ease, lerp, offscreenX, type Intro } from '../../game/intro';
import { rand } from '../../core/rng';
import { say, sfx } from '../../audio/sfx';
import { FX } from '../../audio/specials';

// Guy Fieri: an original pixel caricature of the frosted-spikes TV chef. Flame-print bowling
// shirt, shades parked on the back of his head, goatee, shorts. Fights with food, fire and a
// red hot-rod convertible. Every line here is written for the game, not taken from his shows.

const OUT = '#100810';

export const FIERI_LOOK: Look = {
  skin: '#e8a878', hair: '#f6eca8', beardColor: '#a07848', eye: '#2a3a4a',
  shirt: '#1a161c', flames: '#ff5a10', rolledSleeves: true,
  pants: '#6a6a50', shorts: true, boots: '#2a2a30', socks: '#f0eee8',
  hairStyle: 'spiky', beard: 'vandyke', shadesBack: '#1a1418', glove: '#e8a878',
};
const FIERI_ALT: Look = { ...FIERI_LOOK, shirt: '#a81818', flames: '#ffd040', pants: '#2a3a5a', hair: '#ff9a40', beardColor: '#6a4a2a', shadesBack: '#e8e4dc' };

export const FIERI_LINES = {
  intro: 'Fire up the grill. You are on the menu!',
  finisher: 'Extra crispy. Just how I like it.',
};
const VOICE = { pitch: 0.85, rate: 1.15 };

// ------------------------------------------------------------------ sprites
/** Long-handled flat-top spatula, hanging from the grip like a limb. */
export function spatula(): Part {
  const p = new Painter(12, 32);
  p.rect(5, 0, 3, 13, '#2a1a14');
  p.line(5, 1, 5, 12, '#5a3a28');
  for (const y of [3, 9]) p.set(6, y, '#c8ccd4');
  p.rect(5, 13, 2, 5, '#9aa0aa');
  p.rect(1, 18, 10, 13, '#c8d0dc');
  p.line(1, 18, 10, 18, '#f4f8ff');
  for (const x of [4, 7]) p.line(x, 21, x, 28, '#7a808a');
  p.line(1, 30, 10, 30, '#5a3a20'); // a little char on the edge
  p.outline(OUT);
  return { img: p.canvas(), px: 6, py: 2 };
}

function burgerSprite(): HTMLCanvasElement {
  const p = new Painter(15, 12);
  p.ellipse(7.5, 3.5, 6.5, 3.5, '#d8902c'); // top bun
  p.rect(1, 3, 13, 2, '#d8902c');
  p.rect(0, 5, 15, 1, '#5ab83a'); // lettuce
  p.rect(1, 6, 13, 1, '#ffc828'); // cheese, dripping
  p.set(4, 7, '#ffc828'), p.set(10, 7, '#ffc828');
  p.rect(1, 7, 13, 2, '#5a2a14'); // patty
  p.rect(1, 9, 13, 2, '#c8802a'); // bottom bun
  p.shade(0.2);
  for (const [x, y] of [[4, 2], [7, 1], [10, 2], [6, 3]]) p.set(x, y, '#f8e8b0'); // sesame
  p.outline(OUT);
  return p.canvas();
}

/** Red hot-rod convertible with flame decals, facing right, 86x34, wheels on the bottom edge. */
function ragtopSprite(paint = '#c81818'): HTMLCanvasElement {
  const p = new Painter(86, 34);
  const chrome = '#d8dce4', dark = darken(paint, 0.4);
  // long low body: trunk, cockpit dip, hood
  p.poly([[2, 15], [12, 12], [28, 12], [33, 8], [52, 8], [57, 13], [80, 15], [85, 19], [85, 27], [1, 27], [1, 18]], paint);
  p.rect(34, 9, 18, 5, '#3a2a2a'); // open cockpit
  p.rect(36, 4, 4, 7, '#5a3a30'); // seat back
  p.line(37, 4, 39, 4, lighten('#5a3a30', 0.2));
  p.rect(48, 6, 2, 4, '#141218'); // steering wheel
  p.line(57, 1, 62, 12, '#a8d8f0'); // raked windshield
  p.line(58, 1, 63, 12, '#e8f8ff');
  p.line(56, 1, 59, 1, chrome);
  p.line(2, 18, 84, 18, lighten(paint, 0.3));
  p.shade(0.2);
  // flame decal licking back from the front wheel arch
  for (let i = 0; i < 6; i++) {
    const y = 19 + i;
    p.line(70, y, 50 - i * 3 - (i % 2) * 4, y - 2, i % 2 ? '#ff8a20' : '#ffd040');
  }
  p.rect(81, 16, 4, 3, '#fff4c0'); // headlight
  p.rect(0, 15, 3, 3, '#e83020'); // tail light
  p.rect(0, 23, 9, 3, chrome), p.rect(77, 23, 9, 3, chrome); // bumpers
  p.line(6, 27, 80, 27, dark);
  for (const wx of [19, 68]) {
    p.ellipse(wx, 27, 7, 7, '#141218');
    p.ellipse(wx, 27, 3.8, 3.8, chrome);
    p.ellipse(wx, 27, 1.5, 1.5, '#5a5e66');
  }
  p.outline(OUT);
  return p.canvas();
}

/** Glowing grill grate that heats up under the victim of the finisher. */
function grateSprite(): HTMLCanvasElement {
  const p = new Painter(44, 6);
  p.rect(0, 0, 44, 2, '#2a2a30');
  for (let x = 1; x < 44; x += 4) p.rect(x, 2, 2, 4, '#3a3a42');
  for (let x = 2; x < 43; x += 4) p.set(x, 0, '#ff7a20');
  return p.canvas();
}

let IMG: { burger: HTMLCanvasElement; car: HTMLCanvasElement; carAlt: HTMLCanvasElement; grate: HTMLCanvasElement } | null = null;
const img = () => (IMG ??= { burger: burgerSprite(), car: ragtopSprite(), carAlt: ragtopSprite('#e8e0d0'), grate: grateSprite() });
/** The colour-swapped fighter in a mirror match drives the cream car. */
const carFor = (f: Fighter) => (f.side === 1 && f.opp?.ch.id === f.ch.id ? img().carAlt : img().car);

// ------------------------------------------------------------------ projectiles
/** Lobbed cheeseburger: arcs down under its own weight, trailing flame. */
export function updateBurger(pr: Projectile, f: Fight) {
  if (pr.t === 1) pr.vy = 1.3;
  pr.vy -= 0.035;
  f.particles.fire(pr.x - Math.sign(pr.vx) * 5, pr.y + 3, 1, 3);
  if (pr.t % 4 === 0) f.particles.smoke(pr.x - Math.sign(pr.vx) * 8, pr.y + 4, 1, '#4a4040');
  if (pr.y < 6) {
    pr.dead = true;
    f.particles.fire(pr.x, 4, 10, 6);
    f.particles.sparks(pr.x, 4, 8, '#ffc828');
    FX.sizzle();
  }
}
export function drawBurger(ctx: CanvasRenderingContext2D, pr: Projectile) {
  ctx.rotate(Math.sin(pr.t * 0.25) * 0.25);
  ctx.drawImage(img().burger, -7, -6);
}

/** The ragtop roars across the deck at wheel height, kicking up dust and exhaust. */
export function updateRagtop(pr: Projectile, f: Fight) {
  pr.y = 14;
  const back = pr.x - Math.sign(pr.vx) * 42;
  if (pr.t % 2 === 0) f.particles.smoke(back, 6, 1, '#5a5a62');
  if (pr.t % 3 === 0) f.particles.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 24, y: 1, vx: -pr.vx * 0.3, vy: rand(0.4, 1), grav: 0.1, life: 14, max: 14, color: '#a89878' });
}
export function drawRagtop(ctx: CanvasRenderingContext2D, pr: Projectile) {
  const d = Math.sign(pr.vx) || 1;
  ctx.scale(d, 1);
  // a little suspension bounce
  ctx.drawImage(carFor(pr.owner), -43, -20 + (pr.t % 6 < 3 ? 0 : -1));
}

// ------------------------------------------------------------------ specials
const burgerToss: Move = {
  id: 'proj_burger', prop: 'spatula',
  anim: A([
    [P(STANCE, { af: 30, ef: -60, ab: -40, eb: -90, t: -4, h: -4, lf: -28, kf: 26 }), 5],
    [P(STANCE, { af: 70, ef: -100, ab: -60, t: -12, h: -8, lf: -34, kf: 30, lb: 26, kb: 6 }), 4],
    [P(STANCE, { af: -130, ef: -20, ab: 30, eb: -30, t: 22, h: 6, lf: -44, kf: 44, lb: 30, kb: 8, pa: -40 }), 5],
    [P(STANCE, { af: -100, ef: -10, ab: 20, eb: -40, t: 18, lf: -40, kf: 40, lb: 28, kb: 8 }), 12],
    [STANCE, 8],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 11) {
      f.projectiles.push(new Projectile(self, 'burger', self.x + self.facing * 26, 60));
      self.projOut = true;
      f.sfx('whoosh', 1);
    }
  },
};

const ragtopRush: Move = {
  id: 'proj_ragtop',
  anim: A([
    // two fingers in the mouth, whistle for the car, then point it at the opponent
    [P(STANCE, { af: -150, ef: -150, t: -6, h: -12 }), 10],
    [P(STANCE, { af: -150, ef: -150, t: -8, h: -16 }), 8],
    [P(STANCE, { af: -96, ef: -2, ab: -20, eb: -70, t: 10, lf: -36, kf: 34, lb: 26, kb: 6 }), 20],
    [STANCE, 8],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 4) FX.whistleCall();
    if (fr === 18) {
      // it peels out from behind him and straight through his spot
      f.projectiles.push(new Projectile(self, 'ragtop', self.x - self.facing * 40, 14));
      self.projOut = true;
    }
  },
};

// Smash strokes: blade raised, then pressed flat down onto the opponent like a patty.
const smashKeys: [ReturnType<typeof P>, number][] = [];
for (let i = 0; i < 5; i++) {
  smashKeys.push([P(STANCE, { af: -170, ef: -40, ab: -60, eb: -80, t: -6, h: -6, lf: -36, kf: 36, lb: 28, kb: 8, pa: 60 }), 3]);
  smashKeys.push([P(STANCE, { af: -84, ef: -6, ab: -40, eb: -60, t: 24, h: 6, lf: -44, kf: 44, lb: 30, kb: 8, pa: 90 }), 3]);
}
const spatulaSmash: Move = {
  id: 'smash', prop: 'spatula',
  anim: A([
    [P(STANCE, { af: 20, ef: -110, t: -6 }), 5],
    ...smashKeys,
    [P(STANCE, { af: -80, ef: -10, t: 26, h: 8, lf: -44, kf: 44, lb: 30, kb: 8, pa: 90 }), 6],
    [STANCE, 10],
  ]),
  active: [5, 35],
  vx: (fr) => (fr >= 5 && fr < 30 ? 1.1 : 0),
  hit: { limb: 'prop', r: 10, dmg: 24, level: 'mid', effect: 'light', push: 1.2, stun: 14, rehit: 6, special: true },
  onFrame: (self, f, fr) => {
    // grease pops off the blade on every press
    if (fr >= 5 && fr < 35 && (fr - 5) % 6 === 3) {
      const hx = self.wx(self.skel.handF[0]) + self.facing * 10, hy = self.wy(self.skel.handF[1]);
      f.particles.sparks(hx, hy, 3, '#ffe080');
      f.particles.smoke(hx, hy + 4, 1, '#8a8088');
    }
  },
};

const specials: Special[] = [
  { name: 'Flame-Broiled Lob', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: burgerToss },
  { name: 'Ragtop Rush', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K', move: ragtopRush },
  { name: 'Smash Burger Flurry', cmd: [4, 6], btn: 'hp', mash: 'hp', text: 'MASH HP', move: spatulaSmash },
];

// ------------------------------------------------------------------ finisher
/**
 * Flat-Top Finale: he slams the spatula down, a grill grate glows up under the victim and the
 * flames roar until there's nothing left but charred bones. Then he seasons the pile.
 */
function flatTopFinale(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  w.propOverride = w.ch.props.spatula ?? null;
  if (t === 0) {
    D.gx = l.x;
    w.facing = l.x >= w.x ? 1 : -1;
  }
  if (t < 16) w.poseOverride = P(STANCE, { af: -175, ef: -30, ab: -60, t: -10, h: -8, pa: 40 });
  else if (t < 120) w.poseOverride = P(CROUCH, { af: -60, ef: -4, ab: -40, eb: -60, t: 36, pa: 90 });
  if (t === 16) {
    sfx.slash();
    f.shake(8);
    FX.flareUp();
    ps.add({ kind: 'img', img: img().grate, ix: 22, iy: 5, x: D.gx, y: 1, life: 260, max: 260, grav: 0, floor: false });
  }
  if (t >= 16 && t < 140) {
    const k = Math.min(1, (t - 16) / 80);
    for (let i = 0; i < 1 + k * 4; i++) ps.fire(D.gx + rand(-16, 16), rand(2, 10 + k * 60), 1, 3);
    if (t % 5 === 0) ps.smoke(D.gx + rand(-10, 10), rand(40, 80), 1, '#3a3034');
    if (t % 20 === 16) FX.sizzle();
    l.shake = 1 + Math.round(k * 3);
    l.tint = ['#1a0c08', k * 0.85];
    l.poseOverride = t % 12 < 6 ? P(HIT_HIGH, { af: -160, ab: -150 }) : P(DIZZY, { af: -140, ab: -120, h: -20 });
    if (t > 100) l.showBones = t % 6 < 3;
    if (t === 40) sfx.scream();
  }
  if (t === 140) {
    l.shake = 0;
    l.showBones = true;
    l.tint = null;
    f.collapse(l, true, '#2a1a14');
    FX.flareUp();
  }
  if (t >= 150 && t < 200) {
    // a generous shake of seasoning over the remains
    w.poseOverride = P(STANCE, { af: -120 + (t % 10 < 5 ? -12 : 12), ef: -30, ab: -40, eb: -90, t: 4 });
    if (t % 3 === 0) ps.add({ kind: 'spark', x: D.gx + rand(-10, 10), y: 50, vx: rand(-0.2, 0.2), vy: -0.4, grav: 0.05, life: 30, max: 30, color: t % 2 ? '#ffffff' : '#c83010' });
    if (t % 10 === 0) FX.shaker();
  }
  if (t === 205) say(FIERI_LINES.finisher, VOICE);
  if (t >= 205) {
    w.propOverride = null;
    w.poseOverride = P(VICTORY, { af: -168, ab: -160, eb: -20 });
    if (t % 4 === 0) ps.fire(w.x + rand(-14, 14), rand(0, 6), 1, 2);
  }
  return t >= 320;
}

// ------------------------------------------------------------------ round-one entrance
// Rolls up in the ragtop, vaults over the door, and the deck behind him bursts into flame.
const SEATED = P(STANCE, { t: -4, h: -6, lf: -80, kf: 70, lb: -76, kb: 74, af: -70, ef: -40, ab: -40, eb: -60 });
const HORNS = P(STANCE, { t: -8, h: -12, af: -165, ef: -20, ab: -150, eb: -30, lf: -26, kf: 12, lb: 24, kb: 4 });
const carX = (self: Fighter, f: Fight, t: number, home: number) => {
  const park = home - self.facing * 22;
  if (t <= 44) return lerp(offscreenX(self, f) - self.facing * 30, park, ease(t / 44));
  if (t <= 72) return park;
  return lerp(park, offscreenX(self, f) - self.facing * 40, ((t - 72) / 36) ** 2);
};

export const FIERI_INTRO: Intro = {
  line: FIERI_LINES.intro,
  speech: VOICE,
  speakAt: 84,
  dur: 150,
  update(self, f, t, home) {
    const cx = carX(self, f, t, home);
    if (t === 0) FX.engineRev();
    if (t < 50) {
      // in the driver's seat: the car body hides his legs
      self.x = cx - self.facing * 2;
      self.y = -5;
      self.hidden.add('legF').add('legB');
      self.poseOverride = SEATED;
      if (t % 3 === 0) f.particles.smoke(cx - self.facing * 44, 6, 1, '#5a5a62');
      if (t === 40) FX.skid();
    } else if (t < 64) {
      // vault over the door
      const k = (t - 50) / 14;
      self.hidden.clear();
      self.x = lerp(cx - self.facing * 2, home, k);
      self.y = Math.sin(k * Math.PI) * 30;
      self.poseOverride = P(CROUCH, { t: -10, af: -140, ab: -120 });
    } else {
      self.y = 0;
      if (t === 64) {
        f.sfx('land');
        f.particles.smoke(home, 2, 4, '#6a6470');
        FX.honk();
      }
      if (t === 74) {
        FX.flareUp();
        f.shake(3);
      }
      self.poseOverride = t < 74 ? P(CROUCH, { t: 14 }) : HORNS;
      if (t >= 74 && t < 140) {
        // a wall of flame flares up behind him
        const bx = home - self.facing * 22;
        for (let i = 0; i < 3; i++) f.particles.fire(bx + rand(-12, 12), rand(0, 20), 1, 3);
        if (t % 18 === 0) FX.sizzle();
      }
    }
  },
  draw(ctx, self, f, t, cam) {
    if (t > 110) return;
    const x = Math.round(carX(self, f, t, self.x) - cam);
    ctx.save();
    ctx.translate(x, FLOOR);
    ctx.scale(self.facing, 1);
    ctx.drawImage(carFor(self), -43, -34 + (t < 44 && t % 6 < 3 ? -1 : 0));
    ctx.restore();
  },
};

// ------------------------------------------------------------------ post-match portrait
export const FIERI_PORTRAIT: PortraitStyle = {
  back(p, c) {
    // the shades sit on the back of his head, behind the skull
    const s = c.look.shadesBack ?? '#1a1418';
    p.rect(20, 40, 9, 7, s);
    p.rect(21, 41, 7, 4, darken(s, 0.2));
    if (!c.beaten) p.set(22, 41, '#a8d8f0');
  },
  front(p, c) {
    const L = c.look;
    const g = c.geom;
    // frosted spikes standing up off the crown, darker at the roots
    const root = L.beardColor ?? darken(L.hair, 0.35);
    const spikes = [
      [[24, 40], [12, 22], [32, 30]], [[28, 32], [22, 10], [40, 26]], [[36, 28], [38, 2], [48, 24]],
      [[46, 24], [56, 4], [58, 24]], [[54, 22], [70, 8], [66, 28]], [[62, 26], [82, 18], [72, 34]], [[68, 32], [88, 34], [74, 40]],
    ];
    const tilt = c.beaten ? 6 : 0;
    c.sculpt((m) => { for (const s of spikes) m.poly(s.map(([x, y], i) => [x + (i === 1 ? tilt : 0), y + (i === 1 && c.beaten ? 6 : 0)]), '#fff'); }, L.hair, { soft: 2, bias: 0.15 });
    for (const [x, y] of [[26, 30], [36, 26], [48, 22], [60, 24], [68, 28]]) p.line(x, y, x + 2, y + 6, root);
    // goatee wrapped around the mouth and down the chin
    const [mx, my] = g.mouth;
    const bc = L.beardColor ?? L.hair;
    c.sculpt((m) => {
      m.poly([[mx - 9, my - 3], [mx + 12, my - 5], [mx + 13, my - 1], [mx + 8, my - 2], [mx - 7, my]], '#fff');
      m.poly([[mx - 9, my - 1], [mx - 6, my], [mx - 5, my + 7], [mx + 6, my + 6], [mx + 8, my], [mx + 11, my + 1], [mx + 8, my + 16], [mx - 2, my + 20], [mx - 9, my + 12]], '#fff');
    }, bc, { soft: 2 });
    for (let x = mx - 6; x < mx + 8; x += 3) p.line(x, my + 9, x - 1, my + 16, darken(bc, 0.4));
    // stud earring
    p.set(g.ear[0], g.ear[1] + 7, '#e8e8f0'), p.set(g.ear[0] + 1, g.ear[1] + 7, '#a8acb4');
    // flames licking up the shirt front
    const fl = L.flames ?? '#ff5a10';
    for (let i = 0; i < 8; i++) {
      // tongues of different heights that curl back toward the shoulders
      const x = 8 + i * 12.5, top = 106 - [4, 10, 2, 12, 6, 0, 9, 3][i], lean = i < 4 ? -4 : 4;
      p.poly([[x - 6, 121], [x - 3, 112], [x + lean, top], [x + 2, 112], [x + 6, 121]], fl);
      p.poly([[x - 3, 121], [x + lean / 2, top + 7], [x + 3, 121]], '#ffd040');
    }
  },
};

// ------------------------------------------------------------------ character
export function guyFieri(): CharDef {
  return {
    id: 'fieri', name: 'Guy Fieri', short: 'FIERI', title: 'The Flame-Grilled Fury', look: FIERI_LOOK, alt: FIERI_ALT,
    specials, voice: 125, props: { spatula: spatula() },
    finisher: { name: 'Flat-Top Finale', cmd: [4, 6, 6], btn: 'hk', text: 'B, F, F + HK (any range)', range: [0, 400] },
    fatality: flatTopFinale, intro: FIERI_INTRO, portrait: FIERI_PORTRAIT,
    quotes: [
      'THAT BEATDOWN WAS SEASONED TO PERFECTION, {L}.',
      'YOU GOT SEARED. EXTRA CRISPY ON THE EDGES.',
      'TURN UP THE HEAT AND THEY ALWAYS FOLD.',
      'ROLL THE TOP DOWN. IT SMELLS LIKE A WIN OUT HERE.',
      'TELL THE KITCHEN: ONE {L}, WELL DONE.',
    ],
    quotesVs: {
      bobross: 'NICE LITTLE TREES. I USED THEM FOR KINDLING.',
      lumpsum: 'KEEP THE CASH, BIG GUY. I GET PAID IN BURGERS.',
      tesla: 'YOUR COIL MAKES A DECENT GRILL LIGHTER.',
    },
  };
}
