import type { Look } from './build';
import { A, P, STANCE, CROUCH, VICTORY, DIZZY, FALL } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import type { Particle } from '../game/particles';
import { Projectile } from '../game/projectile';
import { lerp, offscreenX, type Intro } from '../game/intro';
import type { PortraitStyle } from '../gfx/portrait';
import { Painter } from '../gfx/painter';
import { darken, lighten } from '../gfx/palette';
import { FX } from '../audio/specials';
import { sfx } from '../audio/sfx';
import { rand } from '../core/rng';

// Buster Giggleby: an original overgrown-kid fighter. Propeller beanie, striped sweater, short pants
// and knee socks; he fights with his toys, his bicycle and a full-blown tantrum. His laugh is a
// three-step giggle that ends in a snort. All lines are original.

const OUT = '#100810';

export const BUSTER_LOOK: Look = {
  skin: '#f2c6a0', hair: '#c8602a', eye: '#2a3a6a', shirt: '#2a9a58', stripes: '#f0c828', pants: '#3a5ab0',
  boots: '#e8e4dc', hat: 'beanie', hatColor: '#d83030', hatTrim: '#2a6ad8', hairStyle: 'mop',
  shorts: true, kneeSocks: '#f4f2ec', freckles: '#b86a40', belt: '#6a3a1a', buckle: '#e8c848',
};
/** Palette swap for mirror matches: the purple-and-orange Saturday sweater. */
export const BUSTER_ALT: Look = {
  ...BUSTER_LOOK, shirt: '#6a3aa8', stripes: '#f08a28', pants: '#2a2a34', hatColor: '#2a9a58', hatTrim: '#f08a28',
  boots: '#d83030', kneeSocks: '#f0c828', hair: '#e8c070',
};

const STREAMERS = ['#ff4a8a', '#f0c828', '#4ad0ff', '#7ae05a'];

// ------------------------------------------------------------------ sprites

function flip(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const x = o.getContext('2d')!;
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(c, 0, 0);
  return o;
}

/** Wind-up tin robot, two waddle frames. Origin (8, 11), feet on row 19. */
function tinRobot(step: 0 | 1): HTMLCanvasElement {
  const p = new Painter(16, 20);
  const tin = '#b8c0c8', dark = '#6a7480';
  // legs: one forward, one back
  const [a, b] = step ? [14, 15] : [15, 14];
  p.rect(4, a, 3, 19 - a, dark);
  p.rect(9, b, 3, 19 - b, dark);
  p.rect(3, 18, 5, 2, '#3a4048');
  p.rect(8, 18, 5, 2, '#3a4048');
  p.rect(1, 9, 2, 4, dark);
  p.rect(3, 7, 10, 8, tin);
  p.rect(5, 9, 6, 4, '#d83030');
  p.set(6, 10, '#f0c828'), p.set(9, 11, '#f0c828'), p.set(7, 12, '#ffffff');
  // swinging front arm
  if (step) p.rect(12, 7, 3, 2, tin);
  else p.rect(12, 10, 3, 2, tin);
  p.rect(4, 1, 8, 6, lighten(tin, 0.1));
  p.rect(7, 3, 5, 2, '#202830');
  p.set(8, 3, '#ff4040'), p.set(10, 3, '#ff4040');
  p.line(6, 0, 6, 0, '#d83030');
  p.shade(0.2);
  p.outline(OUT);
  return p.canvas();
}

/** Red bicycle with a white basket. Origin (20, 16) is the rider's hip; wheels touch row 48. */
function bicycle(spin: 0 | 1): HTMLCanvasElement {
  const p = new Painter(62, 56);
  const frame = '#d02828', tire = '#1a1820', chrome = '#d8dce4';
  const wheel = (cx: number, cy: number) => {
    for (let y = -10; y <= 10; y++)
      for (let x = -10; x <= 10; x++) {
        const d = Math.hypot(x, y);
        if (d <= 9.3 && d >= 7.2) p.set(cx + x, cy + y, tire);
      }
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4 + (spin * Math.PI) / 8;
      p.line(cx - Math.cos(a) * 7, cy - Math.sin(a) * 7, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, chrome);
    }
    p.ellipse(cx, cy, 1.6, 1.6, '#6a7078');
  };
  wheel(6, 39);
  wheel(50, 39);
  // chain and chainring
  p.line(30, 40, 6, 39, '#4a4a52');
  p.ellipse(30, 40, 3.2, 3.2, '#8a9098');
  // frame: seat tube, chain stays, top and down tubes, fork
  const tube = (x0: number, y0: number, x1: number, y1: number) => {
    p.line(x0, y0, x1, y1, frame);
    p.line(x0, y0 + 1, x1, y1 + 1, darken(frame, 0.25));
  };
  tube(21, 18, 30, 39);
  tube(30, 39, 6, 38);
  tube(21, 20, 6, 38);
  tube(22, 22, 46, 21);
  tube(30, 38, 46, 23);
  p.line(46, 20, 50, 39, chrome);
  p.line(47, 20, 51, 39, darken(chrome, 0.3));
  // stem, handlebar and grips
  p.line(46, 21, 48, 7, chrome);
  p.line(43, 6, 50, 6, chrome);
  p.rect(41, 5, 3, 3, '#202020');
  p.rect(49, 5, 3, 3, '#202020');
  p.rect(46, 3, 3, 2, '#f0c828'); // bell
  // seat
  p.rect(15, 15, 11, 3, '#2a2028');
  p.line(16, 15, 24, 15, '#4a3a48');
  // wicker basket hanging off the bars
  p.rect(51, 8, 9, 8, '#f0ead8');
  for (let y = 9; y < 16; y += 2) p.line(52, y, 59, y, '#c8b890');
  for (let x = 53; x < 60; x += 3) p.line(x, 9, x, 15, '#c8b890');
  p.line(50, 8, 60, 8, '#a89870');
  // a daisy poking out of the basket
  p.set(55, 6, '#7ae05a'), p.set(55, 7, '#7ae05a');
  p.set(54, 5, '#ffffff'), p.set(56, 5, '#ffffff'), p.set(55, 4, '#ffffff'), p.set(55, 5, '#f0c828');
  p.outline(OUT);
  return p.canvas();
}

let SPR: { robot: HTMLCanvasElement[][]; bike: HTMLCanvasElement[][] } | null = null;
function spr() {
  if (!SPR) {
    const r = [tinRobot(0), tinRobot(1)], b = [bicycle(0), bicycle(1)];
    // index 0 faces right, 1 faces left
    SPR = { robot: [r, r.map(flip)], bike: [b, b.map(flip)] };
  }
  return SPR;
}
const side = (dir: number) => (dir === 1 ? 0 : 1);

/** Called from Projectile.draw for the 'robot' kind (context already at the robot's centre). */
export function drawTinRobot(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  const step = (t >> 3) % 2;
  const img = spr().robot[side(dir)][step];
  const bob = step ? -1 : 0;
  ctx.drawImage(img, dir === 1 ? -8 : -7, -11 + bob);
  // the wind-up key on its back, turning
  const kx = -dir * 9, w = [3, 1, 3, 1][(t >> 2) % 4];
  ctx.fillStyle = OUT;
  ctx.fillRect(kx - (dir === 1 ? 2 : 0), -5 + bob, 3, 1);
  ctx.fillStyle = '#f0c828';
  ctx.fillRect(kx - dir * 2 - Math.floor(w / 2), -8 + bob, w, 7);
}

// ------------------------------------------------------------------ props that follow the fighter

/**
 * A sprite pinned in the world (the bicycle, the toy box), drawn with the particles. Re-pin it every
 * frame; if the move gets interrupted it simply runs out of life and disappears.
 */
const pins = new WeakMap<Fight, Map<string, Particle>>();
function pin(f: Fight, key: string, img: HTMLCanvasElement, x: number, y: number, ix: number, iy: number, life = 10) {
  let m = pins.get(f);
  if (!m) pins.set(f, (m = new Map()));
  let p = m.get(key);
  if (!p || p.life <= 0 || !f.particles.list.includes(p)) {
    f.particles.add({ kind: 'img', img, x, y, ix, iy, life, max: life, grav: 0, floor: false, rot: 0 });
    p = f.particles.list[f.particles.list.length - 1];
    m.set(key, p);
  }
  Object.assign(p, { img, x, y, ix, iy, life, vx: 0, vy: 0, rot: 0 });
}
function unpin(f: Fight, key: string) {
  const p = pins.get(f)?.get(key);
  if (p) p.life = 0;
  pins.get(f)?.delete(key);
}

/** Pins the bike under the rider's hips and throws streamers off the handlebars. */
function rideBike(self: Fighter, f: Fight, t: number) {
  const hipY = self.y + self.G;
  const imgs = spr().bike[side(self.facing)];
  pin(f, 'bike' + self.side, imgs[(t >> 1) % 2], self.x, hipY, self.facing === 1 ? 20 : 41, 16);
  if (t % 2 === 0) {
    const bx = self.x + self.facing * 25, by = hipY + 11;
    for (const s of [0, 1])
      f.particles.add({ kind: 'spark', x: bx + self.facing * s * 8, y: by, vx: -self.facing * rand(0.6, 1.4), vy: rand(-0.4, 0.3), life: 9, max: 9, color: STREAMERS[(t + s) % 4], floor: false, size: 2 });
  }
}

/** He hops off and the empty bike rolls away behind him, then vanishes. */
function ditchBike(self: Fighter, f: Fight) {
  unpin(f, 'bike' + self.side);
  const img = spr().bike[side(self.facing)][0];
  f.particles.add({ kind: 'img', img, ix: self.facing === 1 ? 20 : 41, iy: 48, x: self.x, y: 1, vx: -self.facing * 1.6, vy: 1.6, grav: 0.2, rot: 0, vrot: 0, life: 80, max: 80, bounce: 0.3, floor: true });
}

// ------------------------------------------------------------------ poses

// Pedalling: the feet swap around the crank while he hunches over the bars.
const RIDE = { t: 22, h: -14, af: -66, ef: -18, ab: -58, eb: -22 };
const RIDE_A = P(STANCE, { ...RIDE, lf: -80, kf: 70, ff: 10, lb: -40, kb: 95, fb: 30 });
const RIDE_B = P(STANCE, { ...RIDE, lb: -80, kb: 70, fb: 10, lf: -40, kf: 95, ff: 30 });
/** Hands on his belly, leaning back to laugh. */
const GIGGLE = P(STANCE, { t: -14, h: -22, af: 20, ef: -125, ab: 30, eb: -115, lf: -16, kf: 10, lb: 14, kb: 6 });
const GIGGLE2 = P(GIGGLE, { t: -8, h: -14 });
/** Arms flung up, one knee raised. */
const TANTRUM_A = P(STANCE, { t: 10, h: 14, af: -175, ef: -25, ab: -30, eb: -20, lf: -62, kf: 70, ff: 0, lb: 10, kb: 6 });
const TANTRUM_B = P(STANCE, { t: 16, h: -10, af: -40, ef: -20, ab: -175, eb: -25, lb: -55, kb: 65, fb: 0, lf: -12, kf: 6 });

const robotToss: Move = {
  id: 'proj_robot',
  anim: A([
    [P(STANCE, { t: 16, h: 6, af: -50, ef: -50, ab: -40, eb: -60 }), 4],
    // kneel and wind the key: elbows working back and forth
    [P(CROUCH, { t: 36, h: 8, af: -35, ef: -40, ab: -25, eb: -60 }), 4],
    [P(CROUCH, { t: 36, h: 8, af: -25, ef: -70, ab: -40, eb: -30 }), 3],
    [P(CROUCH, { t: 36, h: 8, af: -35, ef: -40, ab: -25, eb: -60 }), 3],
    [P(CROUCH, { t: 36, h: 8, af: -25, ef: -70, ab: -40, eb: -30 }), 3],
    // set it down and let go
    [P(CROUCH, { t: 30, h: 0, af: -75, ef: -5, ab: -60, eb: -10 }), 8],
    [STANCE, 7],
  ]),
  onFrame: (self, f, fr) => {
    const key = 'held' + self.side;
    if (fr >= 2 && fr < 17) {
      const hx = self.wx(self.skel.handF[0]), hy = self.wy(self.skel.handF[1]);
      pin(f, key, spr().robot[side(self.facing)][0], hx + self.facing * 2, hy, self.facing === 1 ? 8 : 7, 16, 4);
      if (fr % 3 === 0) f.particles.sparks(hx - self.facing * 6, hy + 4, 1, '#f0c828');
    }
    if (fr === 17) {
      unpin(f, key);
      f.projectiles.push(new Projectile(self, 'robot', self.x + self.facing * 24, 9));
      self.projOut = true;
    }
  },
};

const bikeDash: Move = {
  id: 'bikedash',
  anim: A([
    [P(STANCE, { t: -6, h: -10, af: -150, ef: -20, ab: -60 }), 4],
    [P(CROUCH, { ...RIDE }), 4],
    ...Array.from({ length: 7 }, (_, i): [typeof RIDE_A, number] => [i % 2 ? RIDE_B : RIDE_A, 4]),
    // skid, hop off
    [P(STANCE, { t: -12, h: -16, af: -150, ef: -10, ab: -140, eb: -10, lf: -40, kf: 30, lb: 20, kb: 10 }), 6],
    [STANCE, 8],
  ]),
  active: [8, 36],
  vx: (fr) => (fr >= 8 && fr < 36 ? 4.2 : fr >= 36 && fr < 40 ? 1.5 : 0),
  hit: { limb: 'kneeF', r: 15, dmg: 95, level: 'mid', effect: 'knockdown', push: 3, stun: 22, special: true },
  onFrame: (self, f, fr) => {
    if (fr >= 4 && fr < 36) rideBike(self, f, fr);
    if (fr === 4) f.particles.smoke(self.x, 4, 4, '#c8c0b0');
    if (fr === 36) {
      ditchBike(self, f);
      f.particles.smoke(self.x, 2, 4, '#8a8478');
    }
  },
};

const tantrum: Move = {
  id: 'tantrum',
  anim: A([
    [P(STANCE, { t: -10, h: -24, af: -170, ef: -10, ab: -165, eb: -10 }), 6],
    ...Array.from({ length: 8 }, (_, i): [typeof TANTRUM_A, number] => [i % 2 ? TANTRUM_B : TANTRUM_A, 4]),
    // sulk
    [P(STANCE, { t: 22, h: 26, af: 10, ef: -10, ab: 15, eb: -10 }), 10],
    [STANCE, 6],
  ]),
  active: [6, 38],
  vx: (fr) => (fr >= 6 && fr < 38 ? 1.1 : 0),
  hit: { limb: 'body', r: 20, dmg: 26, level: 'mid', effect: 'light', push: 1.3, stun: 14, rehit: 7, special: true },
  onFrame: (self, f, fr) => {
    // tears flying off both sides of his face
    if (fr >= 4 && fr < 40 && fr % 3 === 0) {
      const hx = self.wx(self.skel.headTop[0]), hy = self.wy(self.skel.headTop[1]) - 8;
      for (const d of [-1, 1]) f.particles.add({ kind: 'spark', x: hx, y: hy, vx: d * rand(0.8, 1.6), vy: rand(0.6, 1.4), life: 18, max: 18, color: '#80c8ff', grav: 0.12, floor: false, size: 1 });
    }
    if (fr % 12 === 10) f.shake(2);
  },
};

export const BUSTER_SPECIALS: Special[] = [
  { name: 'Wind-Up Walker', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: robotToss },
  { name: 'Streamer Bike Dash', cmd: [4, 6], btn: 'k', text: 'B, F + K', move: bikeDash },
  { name: 'Tantrum Flail', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP', move: tantrum },
];

// ------------------------------------------------------------------ round 1 entrance

const entry = new WeakMap<Fighter, { face: 1 | -1; x0: number }>();

/** Rides in on the bike ringing the bell, skids, ditches it and giggles. */
export const BUSTER_INTRO: Intro = {
  line: 'Ready or not, here I come! Hee hoo hoo!',
  speech: { pitch: 1.5, rate: 1.15 },
  speakAt: 76,
  dur: 150,
  update(self, f, t, home) {
    if (t === 0 || !entry.has(self)) entry.set(self, { face: self.facing, x0: offscreenX(self, f) });
    const E = entry.get(self)!;
    self.facing = E.face;
    if (t <= 50) {
      self.x = lerp(E.x0, home - E.face * 12, t / 50);
      self.poseOverride = (t >> 2) % 2 ? RIDE_B : RIDE_A;
      rideBike(self, f, t);
      if (t === 4 || t === 34) FX.bikeBell();
      if (t % 12 === 0) FX.pedal();
    } else if (t < 62) {
      // skid to a stop, leaning back
      self.x = lerp(home - E.face * 12, home, (t - 50) / 12);
      self.poseOverride = P(RIDE_A, { t: 4, h: -20 });
      rideBike(self, f, 0);
      f.particles.smoke(self.x - self.facing * 18, 2, 1, '#a89c88');
      if (t === 51) sfx.roll();
    } else {
      if (t === 62) {
        ditchBike(self, f);
        sfx.jump();
      }
      self.poseOverride = t < 70 ? P(STANCE, { t: -6, af: -160, ab: -150 }) : t < 132 ? ((t >> 3) % 2 ? GIGGLE : GIGGLE2) : null;
      if (t === 72) FX.giggle();
    }
  },
};

// ------------------------------------------------------------------ finisher

/** The toy box and its spring, redrawn every frame. Origin (17, 89) sits on the floor. */
let BOX: HTMLCanvasElement | null = null;
function drawToyBox(dir: number, crank: number, spring: number, shake: number) {
  BOX ??= document.createElement('canvas');
  BOX.width = 34;
  BOX.height = 90;
  const c = BOX.getContext('2d')!;
  c.clearRect(0, 0, 34, 90);
  c.save();
  if (dir === -1) {
    c.translate(34, 0);
    c.scale(-1, 1);
  }
  const R = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const sx = shake ? (Math.random() < 0.5 ? -1 : 1) * shake : 0;
  // spring and glove
  if (spring > 0) {
    const top = 72 - spring;
    for (let y = 72; y > top; y -= 3) {
      const wob = Math.round(Math.sin(y * 0.5) * 0.5);
      R(13 + sx + wob, y - 1, 9, 2, OUT);
      R(14 + sx + wob, y - 1, 7, 1, '#d8dce4');
    }
    // the glove, punching up and toward the loser
    const gx = 12 + sx, gy = top - 10;
    R(gx - 1, gy - 1, 14, 12, OUT);
    R(gx, gy, 12, 10, '#d02020');
    R(gx + 1, gy + 1, 6, 3, '#ff6a5a');
    R(gx + 9, gy + 3, 3, 4, '#a01010');
    R(gx + 2, gy + 9, 8, 2, '#f4f0e4');
  }
  // the box: bright panels with a star, lid hinged at the back
  const bx = 6 + sx;
  R(bx - 1, 71, 24, 19, OUT);
  R(bx, 72, 22, 17, '#2a6ad8');
  R(bx, 72, 11, 17, '#f0c828');
  R(bx + 3, 78, 5, 5, '#d83030');
  R(bx + 14, 77, 5, 5, '#ffffff');
  R(bx + 16, 76, 1, 7, '#ffffff');
  R(bx + 13, 79, 7, 1, '#ffffff');
  if (spring > 0) {
    R(bx - 2, 58, 3, 14, OUT);
    R(bx - 1, 59, 1, 12, '#d83030');
  } else {
    R(bx - 2, 68, 26, 4, OUT);
    R(bx - 1, 69, 24, 2, '#d83030');
  }
  // the crank on the side facing the winner
  const ax = bx - 2, ay = 80;
  const hx = ax - 2 + Math.cos(crank) * 4, hy = ay + Math.sin(crank) * 4;
  R(ax - 1, ay - 1, 3, 3, '#8a9098');
  R(Math.min(ax, hx), Math.min(ay, hy), Math.abs(hx - ax) + 1, Math.abs(hy - ay) + 1, '#c8ccd4');
  R(hx - 2, hy - 1, 3, 3, '#d83030');
  c.restore();
  return BOX;
}

/**
 * Jack-in-the-Box Surprise: he cranks a toy box while it plays its little tune, the lid flies open
 * and a spring-loaded boxing glove uppercuts the loser's head clean off. Then he giggles about it.
 */
function busterFatality(f: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = f.particles;
  const neck = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) });
  if (tt === 0) {
    D.dir = w.facing;
    D.spring = 0;
  }
  const dir = D.dir as 1 | -1;
  const bx = l.x - dir * 12;
  if (tt < 20) w.x += (l.x - dir * 44 - w.x) * 0.2;
  else w.x = l.x - dir * 44;
  if (tt < 20) {
    w.poseOverride = (tt >> 3) % 2 ? GIGGLE : GIGGLE2;
    if (tt === 4) FX.giggle();
  }
  if (tt === 20) {
    ps.smoke(bx, 10, 8, '#e8e0d0');
    ps.sparks(bx, 14, 10, STREAMERS[0]);
    FX.popIn();
  }
  if (tt >= 20 && tt < 118) {
    // crank: the arm goes round and round
    const a = tt * 0.35;
    w.poseOverride = P(STANCE, { t: 22, h: 6, af: -55 + Math.sin(a) * 30, ef: -30 + Math.cos(a) * 25, ab: -30, eb: -60, lf: -30, kf: 30 });
    l.poseOverride = (tt >> 4) % 2 ? DIZZY : P(DIZZY, { t: 8, h: 30 });
    if (tt === 26) FX.musicBox();
    if (tt % 8 === 0) FX.tinTick();
  }
  if (tt >= 118 && tt < 124) {
    D.spring = Math.min(56, D.spring + 12);
    if (tt === 118) {
      FX.boing();
      w.poseOverride = P(STANCE, { t: -18, h: -24, af: -170, ef: -10, ab: -160, eb: -10 });
    }
  }
  if (tt === 122) {
    const n = neck();
    l.hidden.add('head');
    ps.chunk(l.parts.head.img, l.parts.head.px, l.parts.head.py, n.x, n.y, dir * 1.6, 9, 0.35 * dir);
    ps.blood(n.x, n.y, dir, 60, 1.6);
    ps.flash(n.x, n.y, 16);
    sfx.hit(3);
    sfx.blood();
    f.shake(12);
  }
  if (tt > 122 && tt < 200) {
    const n = neck();
    ps.blood(n.x, n.y + 2, rand(-0.5, 0.5), 3, 1.7);
    if (tt % 18 === 0) sfx.blood();
    // the spring wobbles as it settles
    D.spring = 46 + Math.sin(tt * 0.6) * 10 * Math.max(0, 1 - (tt - 122) / 60);
    l.poseOverride = P(DIZZY, { t: -6, af: 20, ab: 30 });
  }
  if (tt === 200) {
    l.poseOverride = null;
    l.setState('fall', FALL);
    l.vy = 1.5;
    l.y = 1;
    l.vx = dir * 0.5;
    sfx.thud();
  }
  if (tt >= 140 && tt < 290) {
    // jumping for joy, then the giggle
    w.poseOverride = tt < 210 ? ((tt >> 3) % 2 ? VICTORY : P(VICTORY, { af: -140, ab: -150, eb: -20, lf: -50, kf: 70 })) : (tt >> 3) % 2 ? GIGGLE : GIGGLE2;
    if (tt === 150) FX.bikeBell();
    if (tt === 214) FX.giggle();
  }
  if (tt >= 20 && tt < 290) {
    const shake = tt > 60 && tt < 118 ? Math.floor((tt - 60) / 20) : 0;
    pin(f, 'toybox', drawToyBox(dir, tt * 0.35, D.spring, shake), bx, 0, 17, 89);
  }
  if (tt === 290) {
    unpin(f, 'toybox');
    ps.smoke(bx, 10, 8, '#e8e0d0');
  }
  return tt >= 300;
}

// ------------------------------------------------------------------ portrait

/** Win-screen extras: the propeller beanie, sweater stripes and freckles. */
export const BUSTER_PORTRAIT: PortraitStyle = {
  skip: { hat: true },
  front(p, c) {
    const L = c.look;
    const ang = c.beaten ? -0.19 : 0;
    const rot = (pts: number[][]) => pts.map(([x, y]) => [52 + (x - 52) * Math.cos(ang) - (y - 30) * Math.sin(ang), 30 + (x - 52) * Math.sin(ang) + (y - 30) * Math.cos(ang)]);
    // sweater stripes across the shoulders
    for (let y = 98; y < 120; y += 7)
      for (let x = 0; x < 104; x++)
        for (const yy of [y, y + 1, y + 2]) if (p.alpha(x, yy) && !c.skin[yy * 104 + x] && yy > 92) p.set(x, yy, darken(L.stripes ?? '#f0c828', (x % 13 === 0 ? 0.2 : 0) + (yy === y + 2 ? 0.15 : 0)));
    // freckles over the cheek and nose
    if (L.freckles) for (const [x, y] of [[58, 60], [62, 58], [66, 61], [70, 58], [61, 64], [73, 62], [56, 63]]) p.set(x, y, L.freckles), p.set(x + 1, y, darken(L.freckles, 0.2));
    // the beanie
    const hc = L.hatColor ?? '#d83030', h2 = L.hatTrim ?? '#2a6ad8';
    c.sculpt((m) => m.poly(rot([[24, 36], [26, 20], [38, 9], [52, 6], [66, 9], [78, 20], [80, 36]]), '#fff'), hc, { soft: 5, bias: 0.1 });
    c.sculpt((m) => m.poly(rot([[24, 36], [26, 20], [38, 9], [45, 7], [42, 36]]), '#fff'), h2, { soft: 3, bias: 0.1 });
    c.sculpt((m) => m.poly(rot([[60, 7], [66, 9], [78, 20], [80, 36], [63, 36]]), '#fff'), '#f0c828', { soft: 3, bias: 0.1 });
    c.sculpt((m) => m.poly(rot([[72, 31], [98, 33], [95, 39], [72, 38]]), '#fff'), h2, { soft: 2, bias: 0.2 });
    const band = rot([[24, 35], [80, 35]]);
    p.line(band[0][0], band[0][1], band[1][0], band[1][1], darken(hc, 0.4));
    // propeller: stem and two blades (one snapped when he loses)
    const [st, sb] = rot([[52, 0], [52, 6]]);
    p.line(st[0], st[1], sb[0], sb[1], '#c8ccd4');
    p.line(st[0] + 1, st[1], sb[0] + 1, sb[1], '#8a9098');
    const blades = c.beaten ? rot([[44, 1], [60, 1], [62, 4]]) : rot([[36, 1], [68, 1]]);
    for (let i = 0; i + 1 < blades.length; i++) {
      const [a, b] = [blades[i], blades[i + 1]];
      p.line(a[0], a[1], b[0], b[1], '#f0c828');
      p.line(a[0], a[1] + 1, b[0], b[1] + 1, darken('#f0c828', 0.25));
    }
    if (!c.beaten) p.set(40, 1, '#ffffff');
  },
};

// ------------------------------------------------------------------ definition

export function buster(): CharDef {
  return {
    id: 'buster', name: 'Buster Giggleby', short: 'BUSTER', title: 'The Overgrown Kid', look: BUSTER_LOOK, alt: BUSTER_ALT,
    specials: BUSTER_SPECIALS, voice: 210, props: {}, intro: BUSTER_INTRO, portrait: BUSTER_PORTRAIT,
    finisher: { name: 'Jack-in-the-Box Surprise', cmd: [6, 4, 2], btn: 'lk', text: 'F, B, D + LK (close)', range: [0, 90] },
    fatality: busterFatality,
    quotes: [
      'I WIN! I WIN! I WIN! NO TAKE-BACKSIES, {L}!',
      'FINDERS KEEPERS. YOU LOST YOUR TEETH, I FOUND THEM.',
      'YOU HAVE TO SAY "UNCLE" NOW. THOSE ARE THE RULES.',
      'MY ROBOT SAYS YOU NEED A NAP.',
      'RECESS IS OVER, {L}. YOU GO SIT IN THE CORNER.',
    ],
    quotesVs: {
      bobross: 'I COLOURED OUTSIDE THE LINES ON YOUR FACE. HEE HOO!',
      hawking: 'I HAVE WHEELS TOO, BUT MINE HAVE STREAMERS.',
      lincoln: 'YOUR HAT IS TALLER BUT MINE HAS A PROPELLER.',
    },
  };
}
