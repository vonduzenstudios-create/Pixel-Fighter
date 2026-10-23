import type { Look } from './build';
import { A, P, STANCE, CROUCH, VICTORY, DIZZY, WALK } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import { Projectile, type ProjKind } from '../game/projectile';
import { FLOOR, W } from '../core/consts';
import { Painter } from '../gfx/painter';
import { Color, darken, lighten } from '../gfx/palette';
import { rand } from '../core/rng';
import { say } from '../audio/sfx';
import { playCue } from '../audio/specials';
import { lerp, offscreenX, type Intro } from '../game/intro';
import type { PortraitStyle } from '../gfx/portrait';

// An affectionate caricature of the khaki-clad Australian wildlife showman: sun-bleached hair,
// open-collar khaki shirt with the sleeves rolled, short shorts, slouched socks and work boots.
// He never throws a punch he doesn't have to: his specials whistle up his animal mates.
// The summoned animals are projectiles that hit once and then head home (sturdy projectiles).

const OUT = '#100810';

const IRWIN_LOOK: Look = {
  skin: '#dca070', hair: '#e2bc66', eye: '#3a5a7a', shirt: '#bca674', pants: '#9a8658', boots: '#5a3a22',
  socks: '#d4ccb6', hairStyle: 'short', openCollar: true, rolledSleeves: true, shortPants: true, belt: '#4a3220', buckle: '#c8b070',
};
const IRWIN_ALT: Look = { ...IRWIN_LOOK, shirt: '#7a8a58', pants: '#56643e', socks: '#8a8a7a', hair: '#c89c50', boots: '#2a2018' };

// Original lines. Kokoro clips in public/voices (src/audio/voicelines.json).
export const IRWIN_LINES = {
  intro: 'Easy, mate. She only bites when I ask her to.',
  finisher: 'Good girl! She was hungry, that one.',
};
const VOICE = { pitch: 1.05, rate: 1.1 };

// ------------------------------------------------------------------ animal sprites
/** Paints in a fixed design grid scaled up by k, so the animals can be sized to the fighters. */
class Scaled {
  p: Painter;
  constructor(w: number, h: number, public k: number) {
    this.p = new Painter(Math.ceil(w * k), Math.ceil(h * k));
  }
  private s = (pts: number[][]) => pts.map(([x, y]) => [x * this.k, y * this.k]);
  poly(pts: number[][], c: Color) { this.p.poly(this.s(pts), c); }
  ellipse(x: number, y: number, rx: number, ry: number, c: Color) { this.p.ellipse(x * this.k, y * this.k, rx * this.k, ry * this.k, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: Color) {
    const k = this.k;
    for (let o = 0; o < Math.max(1, Math.round(k - 0.3)); o++) this.p.line(x0 * k, y0 * k + o, x1 * k, y1 * k + o, c);
  }
  rect(x: number, y: number, w: number, h: number, c: Color) { this.p.rect(Math.round(x * this.k), Math.round(y * this.k), Math.ceil(w * this.k), Math.ceil(h * this.k), c); }
  /** A detail pixel: grows to a small block at larger scales. */
  set(x: number, y: number, c: Color) { this.rect(x, y, 1, 1, c); }
  shade(a: number) { this.p.shade(a); }
  outline(c: Color) { this.p.outline(c); }
  canvas() { return this.p.canvas(); }
}

/** Animal sizes relative to their design grids. */
const CROC_K = 1.6, ROO_K = 1.9;

function crocImg(open: boolean, step: number): HTMLCanvasElement {
  // 44x16, facing right, snout at the right edge, belly on the bottom row
  const p = new Scaled(44, 16, CROC_K);
  const G = '#4a6a2c', D = darken(G, 0.3), B = '#b8b070';
  for (const [x, o] of step ? [[12, 1], [27, -1]] : [[12, -1], [27, 1]]) {
    p.poly([[x - 2, 9], [x + 2, 9], [x + 3 + o, 14], [x - 1 + o, 14]], D);
    p.rect(x - 2 + o, 14, 5, 1, D);
  }
  p.poly([[0, 10], [4, 8], [14, 6], [14, 12], [4, 11]], G);
  p.ellipse(20, 9, 8, 4, G);
  p.line(13, 12, 27, 12, B);
  if (open) {
    p.poly([[29, 8], [42, 2], [43, 12], [29, 10]], '#c85a5a');
    p.poly([[26, 6], [33, 5], [42, 1], [43, 3], [34, 8], [26, 9]], G);
    p.poly([[26, 10], [34, 10], [43, 11], [43, 13], [26, 13]], G);
    p.line(28, 12, 42, 12, B);
  } else {
    p.poly([[26, 6], [34, 6], [43, 9], [43, 11], [26, 12]], G);
    p.line(28, 11, 42, 11, B);
  }
  p.ellipse(29, 5, 2, 1.5, G);
  for (let x = 6; x < 28; x += 3) p.set(x, x < 14 ? 7 : 5, lighten(G, 0.25));
  p.shade(0.2);
  if (open) {
    p.line(30, 9, 42, 3, '#3a1414');
    for (const [x, y] of [[36, 6], [39, 4], [41, 3]]) p.set(x, y, '#f4f0e0');
    for (const [x, y] of [[34, 9], [37, 10], [40, 10]]) p.set(x, y, '#f4f0e0');
  } else {
    p.line(28, 10, 42, 10, D);
    for (const x of [31, 34, 37, 40]) p.set(x, x % 2 ? 9 : 11, '#f4f0e0');
  }
  p.set(29, 4, '#e8d040');
  p.set(30, 4, '#101010');
  p.set(42, 7, '#101010');
  p.outline(OUT);
  return p.canvas();
}

type RooFrame = 'crouch' | 'leap' | 'kick';
function rooImg(fr: RooFrame): HTMLCanvasElement {
  // 26x34, facing right, feet on the bottom row
  const p = new Scaled(26, 34, ROO_K);
  const F = '#b0784a', L = '#e4c090', D = darken(F, 0.3);
  p.poly([[9, 24], [12, 26], [2, 33], [0, 32]], F);
  if (fr === 'crouch') {
    p.ellipse(11, 25, 5, 4, F);
    p.poly([[8, 29], [20, 30], [20, 33], [7, 33]], D);
  } else if (fr === 'leap') {
    p.ellipse(10, 24, 5, 4, F);
    p.poly([[6, 26], [10, 25], [5, 33], [1, 33]], D);
  } else {
    p.ellipse(13, 23, 5, 4, F);
    p.poly([[14, 20], [25, 21], [25, 24], [14, 26]], D);
  }
  p.poly([[8, 14], [14, 10], [17, 14], [16, 25], [9, 28], [6, 22]], F);
  p.poly([[13, 14], [16, 15], [15, 24], [11, 26]], L);
  p.poly([[13, 6], [13, 0], [15, 5]], F);
  p.poly([[15, 5], [16, 0], [17, 5]], F);
  p.ellipse(16, 8, 3.5, 3, F);
  p.poly([[17, 6], [23, 8], [22, 10], [17, 10]], F);
  const reach = fr === 'kick' ? 0 : 2;
  p.line(16, 15, 20, 17 + reach, F);
  p.line(16, 16, 20, 18 + reach, F);
  p.shade(0.2);
  p.line(14, 1, 14, 4, L);
  p.set(18, 7, '#101010');
  p.set(22, 8, '#201010');
  p.set(9, 30, darken(F, 0.15));
  p.outline(OUT);
  return p.canvas();
}

/** One jaw of the giant croc in the finisher: vertical, tip at the top, pivot at (10, 55). */
function bigJaw(eye: boolean): HTMLCanvasElement {
  const p = new Painter(24, 58);
  const G = '#466428', D = darken(G, 0.35);
  for (let y = 8; y < 50; y += 5) p.poly([[17, y], [21, y + 2], [17, y + 4]], '#f4f0e0');
  p.poly([[2, 57], [18, 57], [17, 16], [13, 2], [7, 2], [3, 16]], G);
  p.ellipse(10, 4, 3.5, 2.5, lighten(G, 0.1));
  if (eye) p.ellipse(5, 44, 3, 4, G);
  // armoured scutes: rows of dark-edged plates down the snout
  for (let y = 14; y < 54; y += 5) {
    p.line(4, y, 16, y, D);
    for (let x = 6 + ((y / 5) % 2) * 3; x < 16; x += 5) p.line(x, y - 4, x, y, D);
  }
  p.ellipse(10, 6, 4.5, 3, lighten(G, 0.15));
  p.line(17, 10, 18, 56, '#c8c080');
  p.shade(0.22);
  p.set(9, 3, D);
  p.set(12, 3, D);
  if (eye) {
    p.set(5, 43, '#e8d040');
    p.set(5, 42, '#101010');
  }
  p.outline(OUT);
  return p.canvas();
}

const makeImgs = () => ({
  croc: [crocImg(false, 0), crocImg(false, 1), crocImg(true, 0), crocImg(true, 1)],
  roo: { crouch: rooImg('crouch'), leap: rooImg('leap'), kick: rooImg('kick') },
  jawUp: bigJaw(true), jawDown: bigJaw(false),
});
let IMG: ReturnType<typeof makeImgs> | null = null;
const img = () => (IMG ??= makeImgs());

/** Croc sprite: snapping jaws every 8 frames, legs stepping every 5. */
const crocFrame = (t: number, snap = true) => img().croc[(snap && t % 16 < 6 ? 2 : 0) + (Math.floor(t / 5) % 2)];

// ------------------------------------------------------------------ summoned animals
export const ANIMALS = new Set<ProjKind>(['croc', 'roo', 'snake']);

interface AnimalState {
  dir: number;
  /** Frames since it hit (or was blocked) and started heading home. */
  gone: number;
  /** Roo kick timer. */
  kick: number;
}
const STATE = new WeakMap<Projectile, AnimalState>();
const st = (p: Projectile) => {
  let s = STATE.get(p);
  if (!s) STATE.set(p, (s = { dir: p.owner.facing, gone: 0, kick: 0 }));
  return s;
};

const HOP = 24;
/** Height of the roo's centre (its hitbox) above its feet. */
const ROO_H = 26;
const SNAKE_WARN = 18;

export function updateAnimal(p: Projectile, f: Fight) {
  const s = st(p);
  const ps = f.particles;
  if (p.spent) s.gone++;
  switch (p.kind) {
    case 'croc': {
      // bursts out of the dirt, scuttles along the floor snapping, and dives back under once it bites
      p.y = 5;
      if (p.t === 1) ps.sparks(p.x, 4, 8, '#6a5038');
      if (!p.spent) {
        p.x += p.vx;
        if (p.t % 4 === 0) ps.smoke(p.x - s.dir * 50, 2, 1, '#7a6a50');
      } else {
        if (s.gone % 3 === 0) ps.smoke(p.x - s.dir * 20, 2, 2, '#7a6a50');
        if (s.gone > 14) p.dead = true;
      }
      break;
    }
    case 'roo': {
      // bounds in from behind its keeper, then drives both feet in when it gets close
      const ph = (p.t % HOP) / HOP;
      if (!p.spent && s.kick === 0 && Math.abs(p.owner.opp.x - p.x) < 44 && Math.sign(p.owner.opp.x - p.x) === s.dir) s.kick = 14;
      if (s.kick > 0) {
        s.kick--;
        p.y = ROO_H + 4;
        p.x += p.vx * 1.4;
      } else {
        p.y = ROO_H + Math.sin(ph * Math.PI) * 24;
        p.x += p.vx;
        if (p.t % HOP === 0) {
          playCue('hopThump');
          ps.smoke(p.x, 2, 2, '#9a8a6a');
        }
        if (p.t % HOP === 1) playCue('rooSpring');
      }
      break;
    }
    case 'snake': {
      // rustles under the floor, rears up under the opponent, then slides back down its hole
      const up = p.t - SNAKE_WARN;
      if (up < 0) {
        p.y = -40;
        if (p.t % 2 === 0) ps.sparks(p.x + rand(-6, 6), 2, 1, p.t % 4 ? '#5a7a30' : '#7a6040');
      } else {
        if (up === 0) {
          ps.sparks(p.x, 4, 10, '#6a5038');
          ps.smoke(p.x, 2, 3, '#7a6a50');
        }
        // after it strikes it stays reared up a moment, swaying, before it slides home
        const sink = p.spent ? Math.max(0, s.gone - 16) * 3 : up > 34 ? (up - 34) * 3 : 0;
        p.y = Math.min(48, 4 + up * 6) - sink;
        if (p.y < -4) p.dead = true;
      }
      break;
    }
  }
  if (p.t > 300 || p.x < -60 || p.x > 580) p.dead = true;
}

export function drawAnimal(ctx: CanvasRenderingContext2D, p: Projectile) {
  const s = st(p);
  // ctx is at the animal's centre; the floor is p.y below it
  ctx.save();
  ctx.beginPath();
  ctx.rect(-90, -140, 180, 140 + p.y + 1);
  ctx.clip();
  ctx.scale(s.dir, 1);
  switch (p.kind) {
    case 'croc': {
      const rise = p.t < 8 ? (8 - p.t) * 3 : 0;
      const sink = p.spent ? s.gone * 2 : 0;
      ctx.drawImage(crocFrame(p.t, !p.spent), -36 * CROC_K, p.y - 15 * CROC_K + rise + sink);
      break;
    }
    case 'roo': {
      const R = img().roo;
      const fr = s.kick > 0 ? R.kick : (p.t % HOP) / HOP < 0.18 || (p.t % HOP) / HOP > 0.85 ? R.crouch : R.leap;
      ctx.drawImage(fr, -14 * ROO_K, ROO_H - 34 * ROO_K);
      break;
    }
    case 'snake': {
      if (p.y < -30) break;
      // carpet-python bands swaying up from the hole, head reared toward the opponent
      const top = -2;
      for (let y = p.y; y > top; y--) {
        const k = (p.y - y) / Math.max(1, p.y - top);
        const x = Math.round(Math.sin(y * 0.3 + p.t * 0.25) * 3 * (0.4 + k));
        const band = Math.floor((y + p.t * 0.3) / 3) % 3;
        ctx.fillStyle = OUT;
        ctx.fillRect(x - 4, Math.round(y), 8, 1);
        ctx.fillStyle = band === 0 ? '#5a4420' : band === 1 ? '#c8a040' : '#8a6a2a';
        ctx.fillRect(x - 3, Math.round(y), 6, 1);
        if (band === 1) (ctx.fillStyle = '#e8d080'), ctx.fillRect(x - 2, Math.round(y), 1, 1);
      }
      const hx = Math.round(Math.sin(top * 0.3 + p.t * 0.25) * 3 * 1.4);
      ctx.fillStyle = OUT;
      ctx.fillRect(hx - 4, top - 7, 13, 8);
      ctx.fillStyle = '#8a6a2a';
      ctx.fillRect(hx - 3, top - 6, 11, 6);
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(hx - 2, top - 6, 6, 2);
      ctx.fillStyle = '#e8d040';
      ctx.fillRect(hx + 3, top - 4, 2, 2);
      ctx.fillStyle = '#101010';
      ctx.fillRect(hx + 4, top - 4, 1, 2);
      ctx.fillRect(hx + 7, top - 2, 1, 1);
      if (p.t % 10 < 4) {
        ctx.fillStyle = '#d02828';
        ctx.fillRect(hx + 9, top - 2, 4, 1);
        ctx.fillRect(hx + 13, top - 3, 1, 1);
        ctx.fillRect(hx + 13, top - 1, 1, 1);
      }
      break;
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ specials
const WHISTLE = P(STANCE, { af: -125, ef: -115, ab: -30, eb: -100, t: -4, h: -12 });
const POINT = P(STANCE, { af: -95, ef: -4, ab: -30, eb: -60, t: 14, h: -2, lf: -40, kf: 40, lb: 30, kb: 8 });

function summon(kind: ProjKind, at: number, place: (self: Fighter) => [number, number], anim: Move['anim']): Move {
  return {
    id: 'proj_' + kind,
    anim,
    onFrame: (self, f, fr) => {
      if (fr === at) {
        const [x, y] = place(self);
        f.projectiles.push(new Projectile(self, kind, x, y));
        self.projOut = true;
      }
    },
  };
}

const irwinSpecials: Special[] = [
  {
    // whistles, points, and a saltwater croc bursts out of the ground in front of him (block low)
    name: 'Croc Rush', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P',
    move: summon('croc', 12, (s) => [s.x + s.facing * 24, 5], A([
      [WHISTLE, 10],
      [POINT, 8],
      [POINT, 12],
      [STANCE, 6],
    ])),
  },
  {
    // a kangaroo bounds in over his shoulder and boots whoever is in front
    name: 'Roo Boot', cmd: [4, 6], btn: 'k', text: 'B, F + K',
    move: summon('roo', 10, (s) => [s.x - s.facing * 20, ROO_H], A([
      [WHISTLE, 8],
      [P(STANCE, { af: -170, ef: -20, ab: -30, eb: -60, t: -8, h: -8 }), 8],
      [POINT, 12],
      [STANCE, 6],
    ])),
  },
  {
    // knocks on the floor and a carpet python rears up under the opponent (block low)
    name: 'Python Ambush', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P',
    move: summon('snake', 9, (s) => [s.x + s.facing * Math.max(30, Math.min(150, Math.abs(s.opp.x - s.x))), -40], A([
      [P(STANCE, { af: -150, ef: -30, t: -6, h: -8 }), 8],
      [P(CROUCH, { af: -40, ef: -10, t: 34, h: 6 }), 8],
      [P(CROUCH, { af: -40, ef: -10, t: 34, h: 6 }), 14],
      [STANCE, 8],
    ])),
  },
];

// ------------------------------------------------------------------ finisher
// Big Girl's Supper: he whistles up a giant croc that rises out of the ground, swallows the
// loser whole and, after a good chew, spits the bones back out.
const JAW_SCALE = 1.4;

function supper(f: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = f.particles;
  if (tt === 0) {
    D.cx = l.x;
    D.rise = -90;
    D.open = 0;
  }
  w.poseOverride = tt < 26 ? WHISTLE : tt < 200 ? P(CROUCH, { af: -95, ef: -5, ab: -30, eb: -60, t: 20, h: -14 }) : P(VICTORY, { ab: -150, eb: -20 });
  if (tt === 4) playCue('callWhistle');
  if (tt >= 26 && tt < 60) {
    // the ground starts to churn under the loser
    if (tt % 3 === 0) ps.smoke(D.cx + rand(-14, 14), 2, 1, '#7a6a50');
    if (tt % 4 === 0) ps.sparks(D.cx + rand(-10, 10), 3, 2, '#6a5038');
    if (tt % 10 === 0) playCue('rustle');
    f.shake(2);
    l.poseOverride = tt % 12 < 6 ? DIZZY : P(DIZZY, { h: 30, t: 8 });
  }
  if (tt === 40) playCue('bellow');
  if (tt >= 60 && tt < 72) {
    // up it comes, mouth wide open
    D.rise = lerp(-90, 0, (tt - 60) / 10);
    D.open = 0.5;
    l.y = lerp(0, 18, (tt - 60) / 12);
    l.poseOverride = P(DIZZY, { af: -160, ab: -150, t: -10, h: -30 });
  }
  if (tt === 60) {
    playCue('crocHiss');
    f.shake(10);
    ps.sparks(D.cx, 4, 24, '#6a5038');
    ps.smoke(D.cx, 4, 10, '#7a6a50');
    f.sfx('scream');
  }
  if (tt >= 84 && tt < 88) D.open = 0.5 * (1 - (tt - 84) / 4);
  if (tt === 88) {
    D.open = 0;
    l.alpha = 0;
    l.y = 0;
    l.poseOverride = null;
    playCue('jawSnap');
    f.sfx('crunch');
    f.shake(12);
    ps.blood(D.cx, 50, 1, 14, 1.2);
    ps.blood(D.cx, 50, -1, 14, 1.2);
  }
  if (tt > 88 && tt < 140) {
    // a good long chew
    D.rise = Math.sin((tt - 88) * 0.4) * 3;
    if (tt % 12 === 0) {
      playCue('jawSnap');
      D.open = 0.08;
    } else D.open = Math.max(0, D.open - 0.02);
    if (tt === 120) playCue('gulp');
  }
  if (tt >= 140 && tt < 160) D.rise = lerp(0, -90, (tt - 140) / 20);
  if (tt >= 172 && tt < 182) {
    D.rise = lerp(-90, -30, (tt - 172) / 10);
    D.open = 0.3;
  }
  if (tt === 182) {
    playCue('burp');
    l.x = D.cx;
    f.spawnParts(l, l.bones, 2.5, 4);
    ps.blood(D.cx, 20, 1, 8, 0.8);
  }
  if (tt >= 196 && tt < 216) {
    D.rise = lerp(-30, -90, (tt - 196) / 20);
    D.open = Math.max(0, D.open - 0.03);
  }
  if (tt === 214) say(IRWIN_LINES.finisher, VOICE);
  return tt >= 320;
}

function drawSupper(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!front || !D || D.rise == null || D.rise <= -88) return;
  const I = img();
  const x = Math.round(D.cx - cam), base = FLOOR + 6 - D.rise * JAW_SCALE;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, FLOOR + 1);
  ctx.clip();
  const gap = 12 * JAW_SCALE;
  if (D.open > 0.02) {
    // the pink inside of the mouth
    ctx.fillStyle = '#a03a40';
    ctx.beginPath();
    ctx.moveTo(x - gap / 2, base);
    ctx.lineTo(x - gap / 2 - Math.sin(D.open) * 70, base - Math.cos(D.open) * 70);
    ctx.lineTo(x + gap / 2 + Math.sin(D.open) * 70, base - Math.cos(D.open) * 70);
    ctx.lineTo(x + gap / 2, base);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(x + side * gap / 2, base);
    ctx.rotate(side * D.open);
    ctx.scale(-side * JAW_SCALE, JAW_SCALE);
    ctx.drawImage(side < 0 ? I.jawUp : I.jawDown, -10, -55);
    ctx.restore();
  }
  ctx.restore();
  // churned-up mud ring at the base
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(x - 26, FLOOR - 2, 52, 3);
  ctx.fillStyle = '#7a6a50';
  for (let i = -24; i <= 24; i += 6) ctx.fillRect(x + i, FLOOR - 3 - ((i / 6 + f.t) % 2), 3, 2);
}

// ------------------------------------------------------------------ round-one entrance
// Creeps in on tiptoe with a croc trailing him, gets a snap at his heels, hops clear and
// waves her off with a grin.
const CREEP = A(WALK.keys.map(([p, d]) => [P(p, { t: 30, h: -18, af: -70, ef: -40, ab: -40, eb: -60 }), d + 2]), true);
const crocAt = (self: Fighter, t: number, home: number, f: Fight) =>
  t <= 46 ? lerp(offscreenX(self, f), home, t / 46) - self.facing * 60 : t < 72 ? home - self.facing * 60 : home - self.facing * (60 + (t - 72) * 3);

export const IRWIN_INTRO: Intro = {
  line: IRWIN_LINES.intro,
  speech: VOICE,
  speakAt: 78,
  dur: 150,
  update(self, f, t, home) {
    if (t <= 46) {
      if (t === 0) self.setAnim(CREEP);
      self.x = lerp(offscreenX(self, f), home, t / 46);
      if (t % 10 === 0) playCue('scuttle');
    } else if (t < 56) {
      self.x = home;
      self.poseOverride = P(STANCE, { t: 24, h: 30, af: -60, ef: -50 }); // glances back
    } else if (t < 70) {
      if (t === 56) {
        playCue('jawSnap');
        f.sfx('ow');
      }
      const k = (t - 56) / 14;
      self.y = Math.sin(k * Math.PI) * 18;
      self.poseOverride = P(STANCE, { t: -10, h: -10, af: -160, ef: -20, ab: -150, eb: -20, lf: -50, kf: 70, lb: 10, kb: 60 });
    } else {
      self.y = 0;
      if (t === 70) f.sfx('land');
      if (t === 74) playCue('crocHiss');
      self.poseOverride = t < 110 ? P(STANCE, { t: -2, h: 20, ab: -100, eb: -4, af: -30, ef: -80 }) : P(VICTORY, { af: -140, ef: -40 });
    }
  },
  draw(ctx, self, f, t, cam) {
    const x = crocAt(self, t, self.x, f);
    const leaving = t >= 72;
    ctx.save();
    ctx.translate(Math.round(x - cam), FLOOR);
    ctx.scale(leaving ? -self.facing : self.facing, 1);
    ctx.drawImage(t >= 52 && t < 60 ? img().croc[2] : crocFrame(t, false), -36 * CROC_K, -15 * CROC_K);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ post-match portrait
const IRWIN_PORTRAIT: PortraitStyle = {
  front(p, c) {
    if (c.beaten) return;
    // the enormous grin
    const [mx, my] = c.geom.mouth;
    p.rect(mx - 6, my - 2, 12, 4, '#f4f0e8');
    p.line(mx - 7, my - 3, mx + 6, my - 3, '#6a2a24');
    p.line(mx - 6, my + 2, mx + 5, my + 2, '#6a2a24');
    for (const x of [mx - 3, mx, mx + 3]) p.set(x, my - 1, '#d8d0c4');
    p.set(mx - 8, my - 4, '#8a4a30');
    p.set(mx + 7, my - 4, '#8a4a30');
  },
};

export function irwin(): CharDef {
  return {
    id: 'irwin', name: 'Steve Irwin', short: 'IRWIN', title: 'The Croc Wrangler', look: IRWIN_LOOK, alt: IRWIN_ALT,
    specials: irwinSpecials, voice: 150, props: {}, intro: IRWIN_INTRO, portrait: IRWIN_PORTRAIT,
    finisher: { name: "Big Girl's Supper", cmd: [4, 4, 6], btn: 'hk', text: 'B, B, F + HK (any range)', range: [0, 400] },
    fatality: supper,
    fatalityDraw: drawSupper,
    quotes: [
      'NEVER CORNER A CROC, MATE. OR ME.',
      'SHE WAS ONLY PLAYING, {L}. YOU SHOULD SEE HER CRANKY.',
      'GORGEOUS DAY FOR IT! SHAME ABOUT YOUR FOOTWORK.',
      'EVERY CREATURE DESERVES RESPECT. EVEN YOU, {L}.',
    ],
    quotesVs: { bobross: 'LOVELY LITTLE CRITTERS IN YOUR TREES, MATE. MINE BITE BACK.' },
  };
}
