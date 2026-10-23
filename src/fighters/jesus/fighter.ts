import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, BLOCK } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import type { Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import type { SetPainter } from '../../scenes/sets';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import { drawText } from '../../gfx/font';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { say } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Jesus: a warm, good-humoured pixel take on the carpenter from Nazareth. Long hair, a full beard,
// a cream homespun robe under a crimson mantle and plain leather sandals. He fights with miracles:
// a fish that multiplies in mid-air, a glide across the floor on a sheet of water, and a turned
// cheek that answers a hit with a blast of forgiveness. The finisher feeds the five thousand, all
// at once, onto the loser's head. Every line is original and nothing here mocks the faith.

const OUT = '#100810';
const GOLD = ['#fff6c8', '#ffe27a', '#f0c040', '#ffffff'];
const WATER = ['#e8f8ff', '#a8e0f8', '#58b0e8', '#ffffff'];

export const JESUS_LOOK: Look = {
  skin: '#c8946a', hair: '#5a3a22', eye: '#2a1a12', shirt: '#ece4d0', sash: '#a8202c',
  pants: '#ece4d0', boots: '#7a5230', hairStyle: 'long', beard: 'full',
  // the stock arms (robe sleeves) and hands stay; torso, head, legs and feet are repainted
  paint: { torso, head, thigh, shin, foot },
};
/** Palette swap for mirror matches: a white robe under a deep blue mantle. */
export const JESUS_ALT: Look = { ...JESUS_LOOK, shirt: '#f6f4ee', pants: '#f6f4ee', sash: '#2a4a9a', hair: '#3a2416', boots: '#5a3a20' };

// ------------------------------------------------------------------ body parts (Look.paint hooks; the builder outlines them)

const robe = (L: Look) => L.shirt;
const mantle = (L: Look) => L.sash ?? '#a8202c';
const ROPE = '#b89a5a';

function torso(p: Painter, L: Look) {
  // 28x42, hip pivot at (13,31), shoulders at y=7. Front (toward the opponent) is +x.
  p.data.fill(0); // the robe replaces the stock part entirely
  const S = robe(L), M = mantle(L);
  // the robe falls loose from the shoulders and flares a little toward the knee
  p.poly([[6, 22], [20, 22], [22.5, 41], [4, 41]], darken(S, 0.04));
  p.poly([[7, 31], [19, 31], [19.5, 20], [6.5, 20]], S);
  p.poly([[6, 23], [20, 23], [21.5, 12], [19.5, 6], [8, 5.5], [5, 10]], S);
  p.ellipse(13.5, 8, 7.5, 3.5, S);
  // a simple round neckline
  p.ellipse(17.5, 5.5, 2.5, 1.6, darken(L.skin, 0.1));
  // folds hanging from the rope belt
  for (const x of [11, 15, 18]) p.line(x, 24, x + 1, 40, darken(S, 0.12), true);
  p.line(4.5, 38, 22.5, 38, darken(S, 0.16), true);
  // rope belt with a knotted end hanging at the front
  p.rect(6.5, 21, 14, 1, ROPE);
  p.line(19, 22, 20, 27, ROPE);
  p.set(20, 28, darken(ROPE, 0.3));
  // the mantle: thrown over the back shoulder, across the chest and down past the front hip
  p.poly([[4.5, 6], [10, 4], [14, 7], [22, 21], [22.5, 30], [18, 30], [12, 16], [4.5, 14]], M);
  p.poly([[4, 13], [9, 14], [8, 32], [5, 34], [3.5, 26]], darken(M, 0.12)); // hanging down the back
  p.line(10, 5, 21, 23, lighten(M, 0.18), true);
  p.line(13, 12, 20.5, 28, darken(M, 0.25), true);
  p.line(6, 15, 6, 31, darken(M, 0.3), true);
  p.shade(0.18);
}

function head(p: Painter, L: Look) {
  // 24x44, neck pivot at (10,40); skull centred ~13px above the neck
  p.data.fill(0); // custom hair and beard replace the stock head
  const H = L.hair, skinD = darken(L.skin, 0.18), hl = lighten(H, 0.25);
  // long hair falling behind the head to the shoulders
  p.poly([[2.5, 22], [9, 19], [10, 31], [10.5, 43], [1.5, 43], [0.5, 32]], darken(H, 0.08));
  p.rect(8, 35, 5, 7, skinD);
  p.ellipse(11, 29, 5.5, 6.5, L.skin);
  p.ellipse(13, 33, 4, 3.5, L.skin);
  p.poly([[15, 28], [17.5, 30.5], [15, 31]], L.skin); // nose
  // crown of hair parted in the middle, swept back over the ear and down in front of the shoulder
  p.ellipse(10.5, 23.5, 6.8, 3.6, H);
  p.poly([[3.5, 23], [12, 21], [10, 25], [9.5, 31], [9, 38], [7, 42], [3, 41], [2.5, 30]], H);
  p.poly([[13, 20.5], [16.5, 22], [17, 25], [14.5, 23.5]], H); // the fringe at the brow
  // full beard joined to the moustache, trimmed to a soft point at the chin
  p.poly([[8.5, 29], [9.5, 34.5], [11.5, 39], [14.5, 40.5], [17, 38], [17.8, 33], [14, 33.5], [11, 31.5], [9.8, 28.5]], H);
  p.poly([[12.5, 32], [17.5, 31.3], [17.8, 33.2], [12.5, 33.8]], H);
  p.shade(0.18);
  // strands of lighter hair and a kind face: soft brow, warm eyes and a smile in the beard
  for (const [x0, y0, x1, y1] of [[6, 22, 4, 30], [9, 21, 7, 36], [11, 22, 9.5, 28], [5, 33, 6, 40]]) p.line(x0, y0, x1, y1, hl);
  for (const [x, y] of [[12, 36], [14, 38], [16, 36], [10, 33]]) p.set(x, y, hl);
  p.set(14, 28, L.eye ?? '#1a1010');
  p.set(13, 28, '#efe6dc');
  p.line(12, 26, 15, 25.5, darken(H, 0.1));
  p.set(12, 29, skinD);
  p.line(14, 35, 16, 35, '#7a3434');
  p.set(16.5, 34, '#7a3434');
}

function thigh(p: Painter, L: Look) {
  // 14x25, pivot at (7,3): a fold of the robe, not a trouser leg
  p.data.fill(0); // the robe replaces the stock part entirely
  const S = robe(L);
  p.capsule(7, 3, 6.4, 7, 20, 5.8, S);
  p.line(9, 4, 10, 22, darken(S, 0.12));
  p.shade(0.18);
}

function shin(p: Painter, L: Look) {
  // 12x25, pivot at (6,2): the robe falls to just above the ankle with a stitched hem
  p.data.fill(0); // the robe replaces the stock part entirely
  const S = robe(L);
  p.capsule(6, 6, 2.6, 6, 21, 2.2, L.skin);
  p.poly([[0, 0], [12, 0], [12, 16], [0, 16]], S);
  p.line(8, 1, 8.5, 15, darken(S, 0.12));
  p.rect(0, 14, 12, 1, darken(S, 0.2));
  p.shade(0.18);
}

function foot(p: Painter, L: Look) {
  // 16x10, pivot at (4,2): bare foot on a leather sandal with crossed straps
  p.data.fill(0); // the sandal replaces the stock part entirely
  p.poly([[1, 1], [7, 1], [13, 4.5], [13.5, 7], [1, 7]], L.skin);
  p.line(3, 2, 9, 6, L.boots);
  p.line(9, 3, 4, 6, L.boots);
  p.line(2, 1, 2, 5, L.boots);
  p.shade(0.15);
  p.rect(0, 7, 15, 2, L.boots);
  p.line(0, 8, 14, 8, darken(L.boots, 0.4));
}

// ------------------------------------------------------------------ sprites

/** A silver fish with a forked tail, pointing right. */
function fishSprite(): HTMLCanvasElement {
  const p = new Painter(16, 9);
  p.ellipse(8, 4.5, 6, 3.2, '#9ab8d0');
  p.ellipse(8, 5.5, 5, 1.8, '#e0ecf4'); // pale belly
  p.poly([[0, 1], [3.5, 4.5], [0, 8]], '#7a98b8');
  p.poly([[6, 1.5], [9, 0], [10, 2]], '#7a98b8'); // dorsal fin
  p.shade(0.25);
  p.set(12, 3, '#141018');
  p.line(10.5, 2.5, 10.5, 6, '#6a88a8'); // gill
  p.outline(OUT);
  return p.canvas();
}

/** A small round loaf of flat bread, scored on top. */
function loafSprite(): HTMLCanvasElement {
  const p = new Painter(12, 8);
  p.ellipse(6, 4.5, 5.5, 3.5, '#c88a44');
  p.ellipse(5.5, 3.5, 3.5, 1.8, '#e0a860');
  p.shade(0.25);
  p.line(3, 3, 8, 3, '#f4d8a0');
  p.outline(OUT);
  return p.canvas();
}

/** A clay cup, filled with water or wine. */
function cupSprite(fill: string): HTMLCanvasElement {
  const p = new Painter(7, 8);
  p.poly([[0, 1], [7, 1], [5.5, 6], [1.5, 6]], '#b06a3a');
  p.rect(2.5, 6, 2, 1, '#8a4a2a');
  p.rect(1, 7, 5, 1, '#8a4a2a');
  p.rect(1, 1, 5, 1, fill);
  p.shade(0.2);
  return p.canvas();
}

let SPR: { fish: HTMLCanvasElement; loaf: HTMLCanvasElement; water: HTMLCanvasElement; wine: HTMLCanvasElement } | null = null;
const spr = () => (SPR ??= { fish: fishSprite(), loaf: loafSprite(), water: cupSprite('#a8e0f8'), wine: cupSprite('#7a1030') });

/** Projectile drawing for the fish (origin at its centre): it swims, tail wagging. */
export function drawFish(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  ctx.scale(dir, 1);
  ctx.rotate(Math.sin(t * 0.5) * 0.18);
  ctx.drawImage(spr().fish, -8, -4);
}

/** Projectile drawing for the loaf (origin at its centre), spinning. */
export function drawBread(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  ctx.rotate(t * 0.2 * dir);
  ctx.drawImage(spr().loaf, -6, -4);
}

/** A burst of golden sparkles: the moment a miracle happens. */
export function miracle(f: Fight, x: number, y: number, n = 12, speed = 1.8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    f.particles.add({ kind: 'spark', x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 14, max: 14, size: i % 3 ? 1 : 2, color: GOLD[i % GOLD.length], floor: false });
  }
}

/** Water splashing up around (x, y). */
export function splash(f: Fight, x: number, y: number, n: number, spread = 1) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-6, 6), y: y + rand(0, 2), vx: rand(-spread, spread), vy: rand(0.6, 2.2), grav: 0.14, life: 24, max: 24, size: rand(1, 2), color: WATER[i % WATER.length] });
}

/** Crumbs and scales flying off a loaf or fish that lands. */
export function crumbs(f: Fight, x: number, y: number, n: number, cols: string[]) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-1.4, 1.4), vy: rand(0.2, 2), grav: 0.12, life: 28, max: 28, size: 1, color: cols[i % cols.length] });
}

/** A halo ring over a point, in screen space. */
function drawHalo(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = '#f0c040';
  for (let k = 0; k < 18; k++) {
    const t = (k / 18) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(t) * 8), Math.round(y + Math.sin(t) * 2.5), 1, 1);
  }
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(Math.round(x - 4), Math.round(y - 2), 8, 1);
  ctx.globalAlpha = 1;
}

const headTop = (self: Fighter, cam: number): [number, number] => [self.wx(self.skel.headTop[0]) - cam, FLOOR - self.wy(self.skel.headTop[1])];
const handF = (self: Fighter, cam: number): [number, number] => [self.wx(self.skel.handF[0]) - cam, FLOOR - self.wy(self.skel.handF[1])];

// ------------------------------------------------------------------ poses

/** Arms open at his sides, palms out: a welcome. */
const OPEN: Pose = P(STANCE, { t: 0, h: -4, af: -40, ef: -20, ab: 40, eb: -20, lf: -10, kf: 8, lb: 10, kb: 4 });
/** Both hands raised to the sky. */
const BLESS: Pose = P(STANCE, { t: -6, h: -14, af: -150, ef: -20, ab: -140, eb: -25, lf: -10, kf: 8, lb: 10, kb: 4 });
/** Gliding over water: upright, feet together, arms held a little out for balance. */
const GLIDE: Pose = P(STANCE, { t: 4, h: -2, af: -70, ef: -10, ab: 60, eb: -10, lf: -4, kf: 6, lb: 4, kb: 4 });
/** Head turned away, offering the other cheek, hands folded calmly in front. */
const CHEEK: Pose = P(STANCE, { t: -6, h: 32, af: -20, ef: -100, ab: -10, eb: -105, lf: -10, kf: 8, lb: 10, kb: 4 });
/** Raising a cup in a toast. */
const TOAST: Pose = P(STANCE, { t: 2, h: -6, af: -128, ef: -40, ab: -30, eb: -100, lf: -10, kf: 8, lb: 10, kb: 4 });

// ------------------------------------------------------------------ specials

const loavesAndFishes: Move = {
  id: 'proj_jesusFish',
  anim: A([
    // gather the fish from the basket at his hip, then a gentle overhand toss
    [P(STANCE, { af: 30, ef: -60, ab: -40, eb: -100, t: 10, h: 4 }), 7],
    [P(STANCE, { af: -160, ef: -30, ab: -30, eb: -90, t: -6, h: -8, lf: -30, kf: 30, lb: 24, kb: 8 }), 4],
    [P(STANCE, { af: -96, ef: -4, ab: -20, eb: -80, t: 18, h: -4, lf: -40, kf: 40, lb: 30, kb: 8 }), 12],
    [STANCE, 6],
  ]),
  sounds: { frames: { 1: 'inhale', 8: 'whoosh' } },
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 9) {
      f.projectiles.push(new Projectile(self, 'jesusFish', self.x + self.facing * 22, 54));
      self.projOut = true;
    }
  },
};

/** Forgiveness: the counter. A bright open palm that sends the attacker tumbling away. */
const forgiveness: Move = {
  id: 'forgiveness',
  anim: A([
    [P(CHEEK, { h: -10 }), 3],
    [P(STANCE, { af: -90, ef: -4, ab: 30, eb: -30, t: 22, h: -8, lf: -40, kf: 40, lb: 30, kb: 8 }), 5, 'out'],
    [P(STANCE, { af: -88, ef: -6, ab: 30, eb: -30, t: 20, h: -6, lf: -40, kf: 40, lb: 30, kb: 8 }), 12],
    [P(OPEN, {}), 10],
    [STANCE, 6],
  ]),
  active: [3, 12],
  vx: (fr) => (fr < 8 ? 2.4 : 0),
  hit: { limb: 'handF', r: 12, dmg: 115, level: 'mid', effect: 'knockdown', push: 4.5, stun: 24, special: true },
  sounds: { frames: { 0: 'cheekBoing', 3: 'graceSwell' }, impact: 'graceBurst', blocked: 'graceBurst' },
  onFrame: (self, f, fr) => {
    if (fr === 0) f.particles.sparks(self.x + self.facing * 4, 76, 6, '#ffffff');
    if (fr === 4) miracle(f, self.x + self.facing * 26, 56, 16, 2.4);
  },
};

const turnTheCheek: Move = {
  id: 'othercheek',
  anim: A([[P(CHEEK, { h: 10 }), 4], [CHEEK, 24], [P(CHEEK, { h: 26 }), 14], [STANCE, 8]]),
  counter: { from: 3, to: 42, move: forgiveness },
  sounds: { frames: { 1: 'graceHum' } },
  onFrame: (self, f, fr) => {
    // a soft glow around him while the offer stands
    if (fr >= 3 && fr < 42 && fr % 5 === 0) f.particles.add({ kind: 'spark', x: self.x + rand(-12, 12), y: rand(30, 80), vy: rand(0.3, 0.8), life: 18, max: 18, size: 1, color: GOLD[fr % GOLD.length], floor: false });
  },
};

const walkOnWater: Move = {
  id: 'waterwalk',
  anim: A([
    [P(STANCE, { t: 0, h: -6, af: -50, ef: -20, ab: 40, eb: -20 }), 6],
    [P(GLIDE, { ry: -3 }), 8],
    [P(GLIDE, { ry: -4, t: 6 }), 8],
    [P(GLIDE, { ry: -3 }), 8],
    [P(OPEN, {}), 6],
    [STANCE, 6],
  ]),
  active: [6, 30],
  vx: (fr) => (fr >= 6 && fr < 30 ? 3.8 : fr < 34 ? 1.2 : 0),
  hit: { limb: 'body', r: 13, dmg: 90, level: 'mid', effect: 'knockdown', push: 3, stun: 20, special: true },
  sounds: { frames: { 2: 'waterGlide', 18: 'waterGlide' }, impact: ['splashHit', 'thud'], blocked: 'splashHit' },
  onFrame: (self, f, fr) => {
    // the floor turns to still water under his feet as he glides
    if (fr >= 4 && fr < 32) {
      splash(f, self.x - self.facing * 6, 1, 2, 0.6);
      if (fr % 6 === 0) f.particles.add({ kind: 'smoke', x: self.x - self.facing * 10, y: 1, vx: -self.facing * 0.4, vy: 0.05, life: 20, max: 20, size: 2, color: '#c8ecff', floor: false });
    }
    if (fr === 6) splash(f, self.x, 2, 10, 1.4);
  },
};

const specials: Special[] = [
  { name: 'Loaves and Fishes', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: loavesAndFishes },
  { name: 'Walk on Water', cmd: [4, 6], btn: 'hk', text: 'B, F + HK', move: walkOnWater },
  { name: 'Turn the Other Cheek', cmd: [2, 1, 4], btn: 'hp', text: 'D, DB, B + HP (counter)', move: turnTheCheek },
];

// ------------------------------------------------------------------ intro

export const JESUS_LINES = {
  intro: 'Blessed are the peacemakers. I am about to make some peace.',
  finisher: 'There is plenty for everyone. Have seconds.',
};
const VOICE = { pitch: 0.9, rate: 0.9 };

/**
 * Round 1 entrance: he strolls in across a sheet of water, steps onto dry floor, lifts a cup of
 * water that blushes into wine, and raises it in a toast.
 */
export const JESUS_INTRO: Intro = {
  line: JESUS_LINES.intro,
  speech: VOICE,
  speakAt: 104,
  dur: 180,
  update(self, f, t, home) {
    if (t <= 60) {
      self.x = lerp(offscreenX(self, f), home, t / 60);
      self.poseOverride = null;
      if (t === 0) self.setAnim(A([[P(GLIDE, { lf: -14, kf: 12, lb: 12, kb: 8 }), 9], [P(GLIDE, { lf: 8, kf: 10, lb: -12, kb: 14 }), 9]], true));
      if (t % 3 === 0) splash(f, self.x - self.facing * 4, 1, 1, 0.4);
      if (t % 18 === 0) playCue('waterGlide');
    } else if (t < 78) {
      self.poseOverride = OPEN;
    } else {
      self.poseOverride = TOAST;
      if (t === 90) {
        playCue('wineTurn');
        const [x, y] = [self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1])];
        miracle(f, x, y + 6, 10, 1.2);
      }
    }
  },
  draw(ctx, self, f, t, cam) {
    if (t <= 66) {
      // the shimmer of water he walks on, fading as he reaches his mark
      const a = t < 60 ? 0.55 : 0.55 * (1 - (t - 60) / 6);
      const x0 = Math.min(offscreenX(self, f), self.x) - cam, x1 = Math.max(offscreenX(self, f), self.x) - cam;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#58b0e8';
      ctx.fillRect(Math.round(x0 - 12), FLOOR - 1, Math.round(x1 - x0 + 24), 3);
      ctx.fillStyle = '#e8f8ff';
      for (let x = Math.round(x0 - 12); x < x1 + 12; x += 7) if ((x + t) % 14 < 7) ctx.fillRect(x, FLOOR - 1, 3, 1);
      ctx.globalAlpha = 1;
    }
    if (t >= 78) {
      const [hx, hy] = handF(self, cam);
      ctx.drawImage(t < 90 ? spr().water : spr().wine, Math.round(hx - 3), Math.round(hy - 9));
    }
    if (t >= 90) {
      const [x, y] = headTop(self, cam);
      drawHalo(ctx, x, y - 9, Math.min(1, (t - 90) / 20) * (0.8 + Math.sin(t * 0.2) * 0.2));
    }
  },
};

// ------------------------------------------------------------------ finisher

const FEED_GOAL = 5000;
interface Food { x: number; y: number; vy: number; vx: number; rot: number; vr: number; fish: boolean }
interface Pile { x: number; y: number; rot: number; fish: boolean }

/** Height of the pile of food over world x, given its peak. */
const pileAt = (D: any, x: number) => D.peak * Math.exp(-(((x - D.lx) / 34) ** 2));

/**
 * Feeding of the Five Thousand: he raises a basket to the sky, and loaves and fishes pour down on
 * the loser until they are buried under a hill of lunch. A counter ticks up to 5,000 served, and
 * one last fish flops on the summit.
 */
function feedFiveThousand(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  if (t === 0) {
    D.lx = l.x;
    D.food = [] as Food[];
    D.pile = [] as Pile[];
    D.peak = 0;
    D.served = 0;
    D.glow = 0;
    w.poseOverride = OPEN;
  }
  w.vx = 0;
  l.vx = 0;
  if (t === 12) {
    w.poseOverride = BLESS;
    playCue(['graceSwell', 'graceHum']);
  }
  D.glow = t < 230 ? Math.min(1, D.glow + 0.03) : Math.max(0, D.glow - 0.03);
  // the rain of food: slow at first, then a downpour
  if (t >= 30 && t < 200) {
    const n = t < 60 ? (t % 6 === 0 ? 1 : 0) : t < 110 ? 1 : 2;
    for (let i = 0; i < n; i++)
      D.food.push({ x: D.lx + rand(-40, 40), y: 240 + rand(0, 40), vy: -rand(1, 2), vx: rand(-0.3, 0.3), rot: rand(0, 6), vr: rand(-0.2, 0.2), fish: rand() < 0.5 });
    if (t % 12 === 0) playCue('foodPatter');
  }
  for (const it of D.food as Food[]) {
    it.vy -= 0.12;
    it.y += it.vy;
    it.x += it.vx;
    it.rot += it.vr;
    const top = pileAt(D, it.x);
    if (it.y <= top + 2) {
      it.vy = 0;
      D.pile.push({ x: it.x, y: top + rand(-1, 2), rot: it.rot, fish: it.fish });
      D.peak = Math.min(96, D.peak + 0.34);
      D.served = Math.min(FEED_GOAL, D.served + 17 + Math.floor(rand(0, 7)));
    }
  }
  D.food = (D.food as Food[]).filter((it) => it.vy !== 0);
  // the loser looks up, then vanishes under the pile
  if (t >= 30 && t < 90) l.poseOverride = P(STANCE, { t: -12, h: -30, af: -150, ef: -30, ab: -140, eb: -30 });
  if (D.peak > 70) l.alpha = 0;
  if (t === 200) D.served = FEED_GOAL;
  if (t === 214) {
    playCue('fishFlop');
    D.flop = 0;
  }
  if (D.flop != null) D.flop++;
  if (t === 240) {
    w.poseOverride = OPEN;
    say(JESUS_LINES.finisher, VOICE);
  }
  if (t === 236) playCue('wineTurn');
  if (t === 300) w.poseOverride = P(OPEN, { t: 14, h: 18 }); // a small bow
  return t >= 360;
}

function drawFeeding(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!D || D.lx == null) return;
  const x = Math.round(D.lx - cam);
  if (!front) {
    if (D.glow > 0) {
      // light pouring down from an opening in the sky
      for (const [w, a] of [[54, 0.08], [38, 0.1], [20, 0.14]] as const) {
        ctx.globalAlpha = a * D.glow;
        ctx.fillStyle = '#fff2c0';
        ctx.fillRect(x - w, 0, w * 2, FLOOR);
      }
      ctx.globalAlpha = 1;
    }
    return;
  }
  const s = spr();
  const put = (img: HTMLCanvasElement, sx: number, sy: number, rot: number) => {
    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.rotate(rot);
    ctx.drawImage(img, -Math.floor(img.width / 2), -Math.floor(img.height / 2));
    ctx.restore();
  };
  // the pile itself: a dark mound underneath so no gaps show, then every loaf and fish that landed
  if (D.peak > 0) {
    ctx.fillStyle = '#8a5a2a';
    for (let dx = -70; dx <= 70; dx++) {
      const h = pileAt(D, D.lx + dx) - 3;
      if (h > 0) ctx.fillRect(x + dx, Math.round(FLOOR - h), 1, Math.ceil(h));
    }
  }
  for (const it of D.pile as Pile[]) put(it.fish ? s.fish : s.loaf, it.x - cam, FLOOR - it.y, it.rot);
  for (const it of D.food as Food[]) put(it.fish ? s.fish : s.loaf, it.x - cam, FLOOR - it.y, it.rot);
  // one last fish flopping on the summit
  if (D.flop != null) {
    const k = D.flop, hop = k < 60 ? Math.abs(Math.sin(k * 0.35)) * 6 * (1 - k / 60) : 0;
    put(s.fish, x, FLOOR - D.peak - 5 - hop, k < 60 ? Math.sin(k * 0.7) * 0.8 : 0.2);
  }
  if (D.served > 0) {
    drawText(ctx, `${Math.floor(D.served).toLocaleString('en-US')} SERVED`, x, Math.max(18, FLOOR - D.peak - 30), D.served >= FEED_GOAL ? '#ffe27a' : '#ffffff', { align: 'center', outline: '#3a2010' });
  }
}

export const JESUS_PORTRAIT: PortraitStyle = {
  back(p) {
    // a soft gold halo behind the head
    for (let y = 0; y < 60; y++)
      for (let x = 10; x < 96; x++) {
        const d = Math.hypot((x - 50) / 1.15, y - 34);
        if (d > 34 && d < 38) p.set(x, y, d < 35.5 ? '#fff6c8' : '#f0c040');
      }
  },
  front(p, c) {
    const L = c.look, M = mantle(L);
    // the mantle over the shoulder, across the chest
    c.sculpt((m) => m.poly([[20, 120], [24, 100], [44, 92], [70, 98], [96, 120]], '#fff'), M, { soft: 4 });
    p.line(40, 100, 70, 120, darken(M, 0.3));
    p.line(30, 104, 52, 120, lighten(M, 0.2));
    // a kind, crinkle-eyed look
    const d = darken(L.skin, 0.22);
    const [ax, ay] = c.geom.eyeA;
    p.line(ax - 8, ay + 1, ax - 5, ay + 2, d);
  },
};

/** Select-screen set: a hillside by a lake at golden hour, a fishing boat and a basket of bread. */
export const LAKESIDE_SET: SetPainter = (g) => {
  const { u, ctx } = g;
  const sky = ['#f8c070', '#f8d488', '#f8e4a8', '#fff0c8'];
  for (let i = 0; i < sky.length; i++) g.r(0, (g.floor * 0.55 * i) / sky.length, g.w, (g.floor * 0.55) / sky.length + 1, sky[i]);
  // the low sun and a lake that catches it
  g.r(g.w * 0.62, g.floor * 0.3, 6 * u, 6 * u, '#fff8e0');
  g.r(0, g.floor * 0.55, g.w, g.floor * 0.45, '#5a98c0');
  for (let k = 0; k < 6; k++) g.r(g.w * 0.6 + ((k * 3) % 5) * u, g.floor * 0.6 + k * 2 * u, (4 - (k % 3)) * u, u * 0.6, '#fff0b8');
  for (let k = 0; k < 10; k++) g.r((k * 37 + (g.t >> 3)) % g.w, g.floor * 0.7 + (k % 4) * 2 * u, 3 * u, u * 0.5, '#8ac0e0');
  // far hills
  g.r(0, g.floor * 0.5, g.w * 0.4, g.floor * 0.06, '#8a9a60');
  g.r(g.w * 0.75, g.floor * 0.48, g.w * 0.25, g.floor * 0.08, '#7a8a58');
  // a little fishing boat with a furled sail
  const bx = g.w * 0.18, by = g.floor * 0.8;
  g.r(bx, by, 10 * u, 2 * u, '#6a4024');
  g.r(bx + u, by + 2 * u, 8 * u, u, '#4a2a16');
  g.r(bx + 5 * u, by - 9 * u, u * 0.6, 9 * u, '#4a2a16');
  g.r(bx + 3 * u, by - 8 * u, 2 * u, 7 * u, '#f0e8d0');
  // grassy shore with wildflowers
  g.r(0, g.floor, g.w, g.h - g.floor, '#6a9a40');
  g.r(0, g.floor, g.w, u, '#8ab850');
  for (let k = 0; k < 14; k++) g.r((k * 53) % g.w, g.floor + ((k * 7) % 5 + 1) * u, u, u, k % 2 ? '#f8f0f0' : '#f0d040');
  // a wicker basket of loaves and two fish
  const kx = g.w * 0.8, ky = g.floor + 2 * u;
  g.r(kx - 2 * u, ky - 2 * u, 2 * u, u * 1.5, '#c88a44');
  g.r(kx, ky - 2.5 * u, 2 * u, u * 1.5, '#e0a860');
  g.r(kx + u, ky - 1.8 * u, 3 * u, u, '#9ab8d0');
  g.r(kx - 3 * u, ky - u, 7 * u, 3 * u, '#a8783a');
  for (let k = 0; k < 7; k++) g.r(kx - 3 * u + k * u, ky - u, u * 0.5, 3 * u, '#7a5226');
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#fff0b0';
  ctx.fillRect(0, 0, g.w, g.h);
  ctx.restore();
};

export function jesus(): CharDef {
  return {
    id: 'jesus', name: 'Jesus', short: 'JESUS', title: 'The Carpenter of Nazareth', look: JESUS_LOOK, alt: JESUS_ALT,
    specials, voice: 120, props: {}, intro: JESUS_INTRO, portrait: JESUS_PORTRAIT,
    selectSet: LAKESIDE_SET, homeStage: 'heaven',
    finisher: { name: 'Feeding of the Five Thousand', cmd: [4, 2, 6], btn: 'lp', text: 'B, D, F + LP (any range)', range: [0, 400] },
    fatality: feedFiveThousand, fatalityDraw: drawFeeding,
  };
}
