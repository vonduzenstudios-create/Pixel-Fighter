import type { Look } from './build';
import { A, P, STANCE, CROUCH, VICTORY, LAUNCHED, DIZZY } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import type { Part, Pose } from '../gfx/rig';
import type { PortraitStyle } from '../gfx/portrait';
import { Projectile } from '../game/projectile';
import { Painter } from '../gfx/painter';
import { darken, lighten } from '../gfx/palette';
import { FLOOR } from '../core/consts';
import { rand } from '../core/rng';
import { say, sfx } from '../audio/sfx';
import { playCue } from '../audio/specials';
import { type Intro } from '../game/intro';

// Miss Cleo: a light-hearted pixel caricature of the late-night TV psychic. A tall wrapped head
// scarf, gold hoops and bangles, a purple caftan. She fights with a crystal ball, an old corded
// hotline receiver and a deck of tarot cards. Every line is original; no ad catchphrases or logos.

const OUT = '#100810';
const MIST = ['#b070f0', '#e0b0ff', '#7040c0', '#ffffff'];

export const CLEO_LOOK: Look = {
  skin: '#7a4a2e', hair: '#1a1010', eye: '#1e120c', shirt: '#f0c040', coat: '#6a2490', coatTrim: '#f0c040', tails: true,
  pants: '#6a2490', boots: '#2a1430', hat: 'headwrap', hatColor: '#e89a18', hatTrim: '#c8283c', hairStyle: 'short',
  earrings: '#f0c848', lips: '#9a2a40', bracers: '#f0c848',
};
/** Palette swap for mirror matches: a teal caftan under a hot pink wrap with silver jewellery. */
export const CLEO_ALT: Look = {
  ...CLEO_LOOK, coat: '#126a5c', pants: '#126a5c', coatTrim: '#e0e4f0', shirt: '#f4ecd8', hatColor: '#e0407a', hatTrim: '#f0d040',
  earrings: '#e0e4f0', bracers: '#e0e4f0', lips: '#b03050',
};

export const CLEO_LINES = {
  intro: 'The cards already told me how this ends, darling. Not well for you.',
  finisher: 'I see your future. It is very, very short.',
};
const VOICE = { pitch: 0.95, rate: 0.95, female: true };

// ------------------------------------------------------------------ sprites

function done(p: Painter, px: number, py: number): Part {
  p.outline(OUT);
  return { img: p.canvas(), px, py };
}

/** An old corded hotline receiver hanging off its coiled cord, held by the cord's end. */
export function phoneReceiver(): Part {
  const p = new Painter(12, 32);
  // coiled cord
  for (let y = 1; y < 20; y += 2) {
    p.line(4, y, 7, y + 1, '#1a1a20');
    p.set(5, y + 1, '#3a3a44');
  }
  // the handset: earpiece, grip and mouthpiece
  const c = '#c81e3c';
  p.rect(4, 20, 4, 10, c);
  p.ellipse(3.5, 21.5, 3, 2.2, c);
  p.ellipse(3.5, 28.5, 3, 2.2, c);
  p.set(2, 21, '#2a0810'), p.set(3, 22, '#2a0810');
  p.set(2, 28, '#2a0810'), p.set(3, 29, '#2a0810');
  p.line(7, 21, 7, 29, lighten(c, 0.35));
  p.shade(0.15);
  return done(p, 5, 0);
}

/** A glowing crystal ball, `r` pixels across, with a swirl of mist inside. */
function crystalBall(r: number, phase: number): HTMLCanvasElement {
  const n = r * 2 + 3;
  const p = new Painter(n, n);
  const c = r + 1;
  p.ellipse(c, c, r, r, '#5a3aa8');
  p.ellipse(c - r * 0.15, c - r * 0.15, r * 0.8, r * 0.8, '#8a68e0');
  p.ellipse(c - r * 0.3, c - r * 0.3, r * 0.45, r * 0.45, '#c8b0ff');
  // swirling mist: a spiral of pale pixels that turns with `phase`
  for (let i = 0; i < 18; i++) {
    const a = phase + i * 0.55, d = (i / 18) * r * 0.85;
    p.set(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.8, i % 3 ? '#e8d8ff' : '#ffffff');
  }
  p.ellipse(c - r * 0.45, c - r * 0.5, Math.max(1, r * 0.18), Math.max(1, r * 0.12), '#ffffff');
  p.outline('#2a1050');
  return p.canvas();
}

/** A tarot card, face out: gold border, a star or a moon on deep blue. */
function tarotCard(kind: number): HTMLCanvasElement {
  const p = new Painter(9, 13);
  p.rect(0, 0, 9, 13, '#f0d060');
  p.rect(1, 1, 7, 11, kind % 2 ? '#1c2a6a' : '#5a1a6a');
  if (kind % 2) {
    // star
    p.line(4, 3, 4, 9, '#fff4b0');
    p.line(2, 6, 6, 6, '#fff4b0');
    p.set(3, 5, '#fff4b0'), p.set(5, 7, '#fff4b0'), p.set(5, 5, '#fff4b0'), p.set(3, 7, '#fff4b0');
  } else {
    // crescent moon
    p.ellipse(4, 6, 2.5, 2.5, '#f0e8c8');
    p.ellipse(5.2, 5.4, 2, 2, '#5a1a6a');
  }
  p.line(2, 10, 6, 10, '#f0d060');
  p.outline(OUT);
  return p.canvas();
}

let SPR: { balls: HTMLCanvasElement[]; cards: HTMLCanvasElement[]; held: HTMLCanvasElement } | null = null;
const spr = () =>
  (SPR ??= {
    balls: Array.from({ length: 8 }, (_, i) => crystalBall(6, (i / 8) * Math.PI * 2)),
    cards: [0, 1, 2, 3].map(tarotCard),
    held: crystalBall(4, 0),
  });

/** Projectile drawing for the 'crystal' kind (called from projectile.ts, origin at its centre). */
export function drawCrystal(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  const b = spr().balls[Math.floor(((t * dir) / 3) % 8 + 8) % 8];
  ctx.drawImage(b, -8, -8);
}

/** A puff of glittering psychic mist. */
function mist(f: Fight, x: number, y: number, n: number, spread = 1) {
  for (let i = 0; i < n; i++)
    f.particles.add({
      kind: 'spark', x: x + rand(-6, 6), y: y + rand(-4, 4), vx: rand(-spread, spread), vy: rand(0.2, 1.4),
      life: 40, max: 40, size: i % 3 ? 1 : 2, color: MIST[i % MIST.length], floor: false,
    });
}

/** A tarot card flung out of the hand, spinning. */
function flingCard(f: Fight, x: number, y: number, dir: number, i: number) {
  f.particles.add({
    kind: 'img', img: spr().cards[i % 4], ix: 4, iy: 6, x, y, vx: dir * rand(2.4, 3.6), vy: rand(-0.4, 1.6), grav: 0.06,
    rot: rand(-0.5, 0.5), vrot: dir * rand(0.15, 0.35), life: 34, max: 34,
  });
}

// ------------------------------------------------------------------ poses (facing right)

/** Both hands cupped forward around an invisible crystal ball. */
const GAZE: Pose = P(STANCE, { t: 10, h: 10, af: -70, ef: -60, ab: -55, eb: -75, lf: -14, kf: 10, lb: 16, kb: 6 });
/** Hands waving over the ball, fingers spread. */
const WAVE_L: Pose = P(STANCE, { t: 4, h: 4, af: -110, ef: -40, ab: -60, eb: -90, lf: -14, kf: 10, lb: 16, kb: 6 });
const WAVE_R: Pose = P(STANCE, { t: 4, h: 4, af: -70, ef: -90, ab: -100, eb: -50, lf: -14, kf: 10, lb: 16, kb: 6 });
/** Pointing at the opponent, the other hand on the hip: "you there". */
const POINT: Pose = P(STANCE, { t: 2, h: -6, af: -95, ef: -4, ab: 30, eb: -110, lf: -10, kf: 6, lb: 12, kb: 4 });
/** One hand to the temple, eyes shut: receiving a vision. */
const VISION: Pose = P(STANCE, { t: -4, h: -14, af: -150, ef: -110, ab: -90, eb: -30, lf: -12, kf: 8, lb: 14, kb: 6 });
/** Both arms raised to the heavens. */
const SUMMON: Pose = P(STANCE, { t: -8, h: -18, af: -165, ef: -15, ab: -150, eb: -20, lf: -16, kf: 10, lb: 18, kb: 6 });

// ------------------------------------------------------------------ specials

const crystalRoll: Move = {
  id: 'proj_crystal',
  anim: A([
    // crouch and bowl it along the floor
    [P(CROUCH, { t: 30, h: -10, af: 30, ef: -20, ab: -60, eb: -90 }), 8],
    [P(CROUCH, { t: 34, h: -12, af: -70, ef: -4, ab: -20, eb: -60, lf: -90, kf: 120 }), 4, 'out'],
    [P(CROUCH, { t: 30, h: -10, af: -80, ef: -6, ab: 10, eb: -50, lf: -90, kf: 120 }), 12],
    [STANCE, 6],
  ]),
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr < 8 && fr % 2 === 0) mist(f, self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1]), 2, 0.5);
    if (fr === 10) {
      f.projectiles.push(new Projectile(self, 'crystal', self.x + self.facing * 20, 8));
      self.projOut = true;
    }
  },
};

// twirl the receiver round on its cord overhead, then whip it out at full stretch
const twirl: [Pose, number, 'lin'?][] = [];
for (let i = 0; i < 4; i++)
  twirl.push([P(STANCE, { af: -175, ef: -10, ab: 25, eb: -100, t: -6, h: -8, pa: -90 - i * 180 }), 4, 'lin']);

const hotline: Move = {
  id: 'hotline', prop: 'phone',
  anim: A([
    [P(STANCE, { af: -175, ef: -10, ab: 25, eb: -100, t: -6, h: -8, pa: 0 }), 4],
    ...twirl,
    [P(STANCE, { af: -90, ef: -2, ab: 30, eb: -90, t: 18, h: 4, lf: -42, kf: 42, lb: 30, kb: 8, pa: -6 }), 4, 'out'],
    [P(STANCE, { af: -86, ef: -2, ab: 30, eb: -90, t: 20, h: 4, lf: -42, kf: 42, lb: 30, kb: 8, pa: 4 }), 12],
    [STANCE, 8],
  ]),
  active: [21, 28],
  vx: (fr) => (fr >= 18 && fr < 24 ? 1.4 : 0),
  hit: { limb: 'prop', r: 9, dmg: 105, level: 'mid', effect: 'knockdown', push: 2.4, stun: 22, special: true },
  whoosh: true,
  onFrame: (self, f, fr) => {
    if (fr === 26 && self.hits > 0) mist(f, self.opp.x, 50, 8, 1.4);
  },
};

// a flurry of swipes, each one flicking a tarot card out of the deck
const swipes: [Pose, number][] = [];
for (let i = 0; i < 6; i++)
  swipes.push([
    i % 2
      ? P(STANCE, { af: -55, ef: -60, ab: -100, eb: -8, t: 18, h: 2, lf: -40, kf: 40, lb: 30, kb: 8 })
      : P(STANCE, { af: -100, ef: -8, ab: -55, eb: -60, t: 14, h: 0, lf: -40, kf: 40, lb: 30, kb: 8 }),
    4,
  ]);

const tarotFlurry: Move = {
  id: 'tarot',
  anim: A([[VISION, 5], ...swipes, [P(POINT, { t: 8 }), 8], [STANCE, 8]]),
  active: [5, 29],
  vx: (fr) => (fr >= 5 && fr < 29 ? 1.2 : 0),
  hit: { limb: 'handF', r: 12, dmg: 24, level: 'mid', effect: 'light', push: 1.2, stun: 14, rehit: 6, special: true },
  onFrame: (self, f, fr) => {
    if (fr >= 5 && fr < 29 && fr % 4 === 1) {
      const s = self.skel, h = fr % 8 === 1 ? s.handF : s.handB;
      flingCard(f, self.wx(h[0]), self.wy(h[1]), self.facing, fr);
    }
    if (fr === 30) mist(f, self.x + self.facing * 24, 60, 10);
  },
};

const specials: Special[] = [
  { name: 'Crystal Ball Roll', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: crystalRoll },
  { name: 'Hotline Lash', cmd: [4, 6], btn: 'hp', text: 'B, F + HP', move: hotline },
  { name: 'Tarot Flurry', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP', move: tarotFlurry },
];

// ------------------------------------------------------------------ intro

/** Round 1 entrance: she materialises out of a cloud of purple mist gazing into her ball, the hotline rings, and she points. */
export const CLEO_INTRO: Intro = {
  line: CLEO_LINES.intro,
  speech: VOICE,
  speakAt: 76,
  dur: 160,
  update(self, f, t, home) {
    self.x = home;
    if (t === 0) {
      self.alpha = 0;
      playCue('mysticChime');
    }
    if (t < 40) {
      self.alpha = Math.min(1, t / 36);
      self.poseOverride = SUMMON;
      if (t % 2 === 0) mist(f, self.x + rand(-14, 14), rand(4, 70), 3, 0.6);
    } else if (t < 70) {
      self.alpha = 1;
      self.poseOverride = GAZE;
      if (t === 40) playCue('crystalHum');
      if (t % 4 === 0) mist(f, self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1]) + 4, 1, 0.3);
    } else if (t < 120) {
      self.poseOverride = t < 76 ? VISION : POINT;
      if (t === 70) playCue('phoneRing');
    } else self.poseOverride = (t >> 3) % 2 ? WAVE_L : WAVE_R;
  },
  draw(ctx, self, _f, t, cam) {
    // the little ball between her hands while she reads it
    if (t >= 40 && t < 72) {
      const s = self.skel;
      const x = Math.round((self.wx(s.handF[0]) + self.wx(s.handB[0])) / 2 - cam);
      const y = Math.round(FLOOR - (self.wy(s.handF[1]) + self.wy(s.handB[1])) / 2 - 4);
      ctx.drawImage(spr().held, x - 5, y - 5);
    }
  },
};

// ------------------------------------------------------------------ finisher

const R = 38;
/** Height of the ball's centre once it sits on its stand (about the trapped loser's hips). */
const REST = 42;

/**
 * Final Reading: a giant crystal ball drops over the loser and lifts them off their feet. Cleo
 * reads it, the mist inside turns red, the loser comes apart in a swirl and the ball fills up,
 * cracks and bursts all over the stage. Then she draws one last card.
 */
function finalReading(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  if (t === 0) {
    D.dir = w.facing;
    D.bx = l.x;
    D.by = 260;
    D.red = 0;
    D.cracks = [] as number[][];
    D.spin = 0;
    playCue('mysticChime');
  }
  const dir = D.dir as 1 | -1;
  // step back to make room
  if (t < 20 && (l.x - w.x) * dir < 72) w.x = Math.max(20, Math.min(f.sw - 20, w.x - dir * 2.5));
  if (t < 30) w.poseOverride = SUMMON;
  if (t === 10) say(CLEO_LINES.finisher, VOICE);
  // the ball comes down out of the sky
  if (t >= 20 && D.by > REST) {
    D.by = Math.max(REST, D.by - 6);
    if (D.by === REST) {
      playCue(['glassThud', 'crystalHum']);
      f.shake(8);
      ps.smoke(D.bx, 2, 8, '#a890d0');
    }
  }
  D.bx = l.x;
  // trapped inside: floated up and turned slowly round
  if (D.by === REST && !D.burst) {
    l.y = Math.min(6, l.y + 0.3);
    D.spin += 0.8 + Math.max(0, t - 90) * 0.06;
    l.poseOverride = P(t < 80 ? DIZZY : LAUNCHED, { rot: -D.spin });
  }
  if (t >= 40 && t < 160) {
    w.poseOverride = (t >> 3) % 2 ? WAVE_L : WAVE_R;
    if (t % 3 === 0) mist(f, D.bx + rand(-R, R) * 0.7, D.by + rand(-R, R) * 0.7, 1, 0.3);
    if (t % 30 === 0) playCue('crystalHum');
  }
  if (t >= 90 && t < 160) D.red = Math.min(0.55, D.red + 0.008);
  // the vision ends badly
  if (t === 160) {
    D.burst = true;
    playCue(['glassThud', 'splat']);
    sfx.blood();
    for (const n of ['torso', 'head', 'armF', 'armB', 'legF', 'legB'] as const) l.hidden.add(n);
    l.alpha = 0;
    w.poseOverride = VISION;
  }
  if (t >= 160 && t < 200) D.red = Math.min(0.95, D.red + 0.03);
  if (t === 170 || t === 182 || t === 192) {
    D.cracks.push([rand(-0.6, 0.6), rand(0.6, 1)]);
    playCue('glassCrack');
  }
  if (t === 210) {
    // burst: glass, gore and everything that was inside it
    D.gone = true;
    playCue(['shatter', 'glassThud']);
    sfx.crunch();
    f.shake(14);
    const s = l.skel, Pt = l.parts;
    const parts: [Part, [number, number]][] = [
      [Pt.torso, s.hip], [Pt.head, s.neck], [Pt.uarm, s.shF], [Pt.farm, s.elbowF], [Pt.uarmB, s.shB], [Pt.farmB, s.elbowB],
      [Pt.thigh, s.hipF], [Pt.shin, s.kneeF], [Pt.foot, s.ankleF], [Pt.thighB, s.hipB], [Pt.shinB, s.kneeB], [Pt.footB, s.ankleB],
    ];
    for (const [part] of parts)
      ps.chunk(part.img, part.px, part.py, D.bx + rand(-10, 10), D.by + rand(-10, 10), rand(-4, 4), rand(2, 6), rand(-0.5, 0.5));
    ps.blood(D.bx, D.by, -1, 60, 2);
    ps.blood(D.bx, D.by, 1, 60, 2);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), v = rand(1.5, 4.5);
      ps.add({ kind: 'spark', x: D.bx + Math.cos(a) * R * 0.8, y: D.by + Math.sin(a) * R * 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, grav: 0.18, life: 60, max: 60, size: i % 3 ? 1 : 2, color: i % 2 ? '#d8e8ff' : '#a890e0', bounce: 0.3 });
    }
    mist(f, D.bx, D.by, 30, 2);
  }
  if (t > 210 && t < 260 && t % 4 === 0) ps.blood(D.bx + rand(-16, 16), 2, rand(-1, 1), 2, 0.8);
  // one last card: she flips it up toward the camera
  if (t >= 240) {
    w.poseOverride = t < 270 ? P(POINT, { af: -150, ef: -20 }) : P(VICTORY, { ab: -150, eb: -20 });
    if (t === 246) playCue(['cardFlick', 'mysticChime']);
  }
  return t >= 330;
}

function drawFinal(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!D || D.by == null) return;
  const t = f.fatal!.t;
  // the last card, held up over her head
  if (front && t >= 248 && f.winner) {
    const w = f.winner, s = w.skel;
    const x = Math.round(w.wx(s.handF[0]) - cam), y = Math.round(FLOOR - w.wy(s.handF[1]));
    const k = Math.min(1, (t - 248) / 10);
    ctx.save();
    ctx.translate(x, y - 10);
    ctx.scale(Math.max(0.1, k) * 2, 2);
    ctx.drawImage(spr().cards[(t >> 4) % 2 ? 1 : 3], -4, -6);
    ctx.restore();
  }
  if (D.gone) return;
  const x = Math.round(D.bx - cam), y = Math.round(FLOOR - D.by);
  ctx.save();
  if (!front) {
    // the dark, misty inside of the ball
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#3a1a70';
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // its gold claw stand on the floor, once it has landed
    if (D.by <= REST) {
      ctx.fillStyle = OUT;
      ctx.fillRect(x - 15, FLOOR - 7, 30, 7);
      ctx.fillStyle = '#c89a30';
      ctx.fillRect(x - 14, FLOOR - 6, 28, 5);
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(x - 12, FLOOR - 6, 24, 1);
    }
  } else {
    // red rising inside the glass
    if (D.red > 0) {
      ctx.globalAlpha = D.red;
      ctx.fillStyle = '#a00818';
      ctx.beginPath();
      ctx.arc(x, y, R - 1, 0, Math.PI * 2);
      ctx.fill();
    }
    // swirling mist streaks
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 1 ? '#ffffff' : D.red > 0.3 ? '#ff6070' : '#c8a0ff';
      ctx.beginPath();
      ctx.arc(x, y, R * (0.45 + i * 0.17), t * 0.08 + i * 2, t * 0.08 + i * 2 + 1.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    // glass rim, highlights and cracks
    ctx.strokeStyle = '#2a1050';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#c8b8ff';
    ctx.beginPath();
    ctx.arc(x, y, R - 2, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 15, y - 17, 4, 3);
    ctx.fillRect(x - 10, y - 20, 2, 2);
    ctx.strokeStyle = '#ffffff';
    for (const [a, len] of D.cracks as number[][]) {
      let cx = x + Math.cos(a - Math.PI / 2) * R, cy = y + Math.sin(a - Math.PI / 2) * R;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) {
        cx += (x - cx) * 0.25 * len + (k % 2 ? 3 : -3);
        cy += (y - cy) * 0.25 * len;
        ctx.lineTo(Math.round(cx), Math.round(cy));
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ portrait

export const CLEO_PORTRAIT: PortraitStyle = {
  skip: { hair: true },
  front(p, c) {
    const g = c.geom, L = c.look;
    const wrap = L.hatColor ?? '#e89a18', trim = L.hatTrim ?? '#c8283c';
    const tilt = c.beaten ? 4 : 0;
    // the tall wrapped scarf, knotted at the back
    c.sculpt((m) => m.poly([[26, 50], [22, 30], [28, 12], [42, 2 + tilt], [62, 0 + tilt], [78, 8 + tilt], [84, 26], [82, 40], [60, 36], [40, 40]], '#fff'), wrap, { soft: 6, bias: 0.1 });
    c.sculpt((m) => m.ellipse(24, 40, 9, 9, '#fff'), darken(wrap, 0.1), { soft: 4 });
    c.sculpt((m) => m.poly([[18, 44], [28, 46], [26, 66], [16, 62]], '#fff'), darken(wrap, 0.18), { soft: 3 });
    // folds in the trim colour
    for (const [x0, y0, x1, y1] of [[28, 38, 70, 6], [36, 40, 82, 18], [48, 37, 83, 30], [30, 22, 52, 4]]) {
      p.line(x0, y0, x1, y1 + tilt, trim);
      p.line(x0, y0 + 1, x1, y1 + 1 + tilt, darken(trim, 0.3));
    }
    for (const [x, y] of [[44, 14], [60, 12], [70, 24], [40, 28], [56, 26]]) p.set(x, y + tilt, lighten(wrap, 0.45));
    // gold hoop earring
    const [ex, ey] = g.ear, gold = L.earrings ?? '#f0c848';
    for (let a = 0; a < Math.PI * 2; a += 0.25) p.set(ex + Math.cos(a) * 5, ey + 12 + Math.sin(a) * 6, gold);
    p.set(ex - 3, ey + 8, '#ffffff');
    // lipstick
    if (L.lips && !c.beaten) {
      const [mx, my] = g.mouth;
      p.line(mx - 8, my + 1, mx + 3, my, L.lips);
      p.line(mx - 6, my + 2, mx + 2, my + 2, darken(L.lips, 0.2));
    }
  },
};

export function cleo(): CharDef {
  return {
    id: 'cleo', name: 'Miss Cleo', short: 'CLEO', title: 'The Hotline Psychic', look: CLEO_LOOK, alt: CLEO_ALT,
    specials, voice: 200, props: { phone: phoneReceiver() }, intro: CLEO_INTRO, portrait: CLEO_PORTRAIT,
    finisher: { name: 'Final Reading', cmd: [6, 4, 2], btn: 'hp', text: 'F, B, D + HP (any range)', range: [0, 400] },
    fatality: finalReading,
    fatalityDraw: drawFinal,
    quotes: [
      'THE CARDS SAID YOU WOULD LOSE, {L}. THE CARDS ARE NEVER WRONG.',
      'I SAW THAT COMING. I SEE EVERYTHING COMING.',
      'YOUR READING IS OVER. NEXT CALLER, PLEASE.',
      'THE FIRST BEATING IS ON THE HOUSE, DARLING.',
    ],
    quotesVs: {
      blaine: 'CARD TRICKS? CHILD, MY CARDS TELL THE FUTURE.',
      oprah: 'I PREDICTED YOUR GIVEAWAY. I PREDICTED THIS TOO.',
      hawking: 'YOU STUDY THE STARS. I READ THEM.',
    },
  };
}
