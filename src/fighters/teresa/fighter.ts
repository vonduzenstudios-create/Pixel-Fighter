import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, LAUNCHED } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import type { Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import type { SetPainter } from '../../scenes/sets';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { say } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Mother Teresa: an affectionate pixel caricature of the tiny nun from Calcutta. White cotton sari
// with the three blue border stripes, a veil over the head and sandals. She fights with kindness,
// mostly: bread for the hungry, a firm "tough love" shove and a prayer circle that glows. The
// finisher sends the loser gently to heaven. Every line is original and nothing mocks her faith.

const OUT = '#100810';
const GOLD = ['#fff6c8', '#ffe27a', '#f0c040', '#ffffff'];

export const TERESA_LOOK: Look = {
  skin: '#d6a47e', hair: '#8a8478', eye: '#3a2a20', shirt: '#f2f0e8', coatTrim: '#2c5cc0',
  pants: '#f2f0e8', boots: '#7a5230', hairStyle: 'short',
  // the stock arms and hands stay; torso, head, legs and feet are repainted as sari, veil and sandals
  paint: { torso, head, thigh, shin, foot },
};
/** Palette swap for mirror matches: an undyed cream sari with saffron borders. */
export const TERESA_ALT: Look = { ...TERESA_LOOK, shirt: '#e8dcc0', pants: '#e8dcc0', coatTrim: '#d07a18', boots: '#4a3424' };

// ------------------------------------------------------------------ body parts (Look.paint hooks; the builder outlines them)

const sari = (L: Look) => L.shirt;
const stripe = (L: Look) => L.coatTrim ?? '#2c5cc0';

/** A sari border: one broad blue stripe with a thin one either side, along a polyline. */
function border(p: Painter, pts: number[][], c: string, dy = 1) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    p.line(x0, y0, x1, y1, c, true);
    p.line(x0, y0 + dy, x1, y1 + dy, c, true);
    p.line(x0, y0 + dy * 3, x1, y1 + dy * 3, c, true);
  }
}

function torso(p: Painter, L: Look) {
  // 28x42, hip pivot at (13,31), shoulders at y=7. Front (toward the opponent) is +x.
  p.data.fill(0); // the sari replaces the stock part entirely
  const S = sari(L), B = stripe(L);
  // the wrapped skirt flares a little below the waist
  p.poly([[6, 22], [20, 22], [22.5, 41], [4, 41]], darken(S, 0.04));
  p.poly([[7, 31], [19, 31], [19.5, 20], [6.5, 20]], S);
  p.poly([[6, 23], [20, 23], [21.5, 12], [19.5, 6], [8, 5.5], [5, 10]], S);
  p.ellipse(13.5, 8, 7.5, 3.5, S);
  // pleats down the front of the skirt
  for (const x of [15, 18]) p.line(x, 26, x + 1.5, 40, darken(S, 0.12), true);
  border(p, [[4, 38], [22.5, 38]], B);
  // the pallu: the loose end thrown from the front hip up over the back shoulder
  p.poly([[21, 25], [22, 19], [9, 4.5], [5, 6], [4.5, 12]], lighten(S, 0.02));
  border(p, [[21.5, 22], [7, 6]], B, 1);
  p.line(20, 27, 4.5, 13, darken(S, 0.14), true);
  p.shade(0.18);
  // the small crucifix pinned at the shoulder
  p.line(16, 7, 16, 11, '#3a3440');
  p.line(15, 8, 17, 8, '#3a3440');
}

function head(p: Painter, L: Look) {
  // 24x44, neck pivot at (10,40); skull centred ~13px above the neck
  p.data.fill(0); // the sari replaces the stock part entirely
  const S = sari(L), B = stripe(L), skinD = darken(L.skin, 0.18);
  // the veil hanging behind the head, down past the shoulders
  p.poly([[2, 22], [9, 19], [10, 30], [11, 43], [1, 43], [0.5, 32]], darken(S, 0.06));
  p.rect(8, 35, 5, 7, skinD);
  p.ellipse(11, 29, 5.5, 6.5, L.skin);
  p.ellipse(13, 33, 4, 3.5, L.skin);
  p.poly([[15, 28], [17.5, 30.5], [15, 31]], L.skin); // nose
  // veil over the crown, framing the face, tucked under at the jaw
  p.poly([[3, 21], [7, 18], [12, 17.5], [16, 19.5], [17, 23], [14, 22.5], [10, 23.5], [8.5, 27], [8.5, 33], [10, 38], [11.5, 43], [2, 43], [1, 30]], S);
  border(p, [[16.5, 22], [13.5, 21.5], [10.5, 22.5], [9, 25], [8.8, 31], [10, 36], [11.5, 41]], B, -1);
  p.shade(0.18);
  // a kind, lined face: crow's feet, a furrowed brow and laugh lines
  p.set(14, 28, L.eye ?? '#1a1010');
  p.set(13, 28, '#e8e0d8');
  p.line(12, 26, 15, 26, darken(L.skin, 0.35));
  p.line(12, 25, 14, 24.5, skinD);
  p.set(12, 29, skinD);
  p.set(12, 30, skinD);
  p.line(14, 31, 15, 33, skinD);
  p.line(13, 34, 15, 34, '#7a3a34');
  p.set(16, 33, skinD);
}

function thigh(p: Painter, L: Look) {
  // 14x25, pivot at (7,3): a fold of the sari skirt, not a trouser leg
  p.data.fill(0); // the sari replaces the stock part entirely
  const S = sari(L);
  p.capsule(7, 3, 6.4, 7, 20, 5.8, S);
  p.line(9, 4, 10, 22, darken(S, 0.12));
  p.shade(0.18);
}

function shin(p: Painter, L: Look) {
  // 12x25, pivot at (6,2): the skirt falls to the ankle and ends in the blue border
  p.data.fill(0); // the sari replaces the stock part entirely
  const S = sari(L), B = stripe(L);
  p.capsule(6, 6, 2.6, 6, 21, 2.2, L.skin);
  p.poly([[0, 0], [12, 0], [12, 18], [0, 18]], S);
  p.line(8, 1, 8.5, 17, darken(S, 0.12));
  p.rect(0, 13, 12, 1, B);
  p.rect(0, 15, 12, 2, B);
  p.shade(0.18);
}

function foot(p: Painter, L: Look) {
  // 16x10, pivot at (4,2): bare foot on a plain leather sandal
  p.data.fill(0); // the sari replaces the stock part entirely
  p.poly([[1, 1], [7, 1], [13, 4.5], [13.5, 7], [1, 7]], L.skin);
  p.line(4, 3, 9, 5, L.boots);
  p.line(4, 4, 9, 6, L.boots);
  p.shade(0.15);
  p.rect(0, 7, 15, 2, L.boots);
  p.line(0, 8, 14, 8, darken(L.boots, 0.4));
}

// ------------------------------------------------------------------ sprites

/** A round country loaf with a scored crust. */
function loafSprite(): HTMLCanvasElement {
  const p = new Painter(14, 11);
  p.ellipse(7, 6, 6.5, 4.5, '#c07a34');
  p.ellipse(6.5, 4.5, 4.5, 2.5, '#d8964a');
  p.shade(0.25);
  for (const x of [4, 7, 10]) p.line(x, 3, x + 1.5, 6, '#f0d098');
  p.outline(OUT);
  return p.canvas();
}

/** One white feather. */
function featherSprite(): HTMLCanvasElement {
  const p = new Painter(6, 14);
  p.poly([[3, 0], [5.5, 4], [5, 10], [3, 13], [1, 10], [0.5, 4]], '#ffffff');
  p.line(3, 1, 3, 13, '#c8ccd8');
  p.shade(0.15);
  return p.canvas();
}

let SPR: { loaf: HTMLCanvasElement; feather: HTMLCanvasElement } | null = null;
const spr = () => (SPR ??= { loaf: loafSprite(), feather: featherSprite() });

/** Projectile drawing for the 'loaf' kind (origin at its centre). */
export function drawLoaf(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  ctx.rotate(t * 0.22 * dir);
  ctx.drawImage(spr().loaf, -7, -5);
}

/** Crumbs flaking off a flying loaf, or bursting from one that lands. */
export function crumbs(f: Fight, x: number, y: number, n: number, spread = 0.6) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-spread, spread) * 2, vy: rand(0.2, 1.8), grav: 0.12, life: 30, max: 30, size: 1, color: i % 3 ? '#c07a34' : '#f0d098' });
}

/** A ring of golden light expanding outward from (x, y). */
function haloRing(f: Fight, x: number, y: number, n = 14, speed = 2.2) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    f.particles.add({ kind: 'spark', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 16, max: 16, size: 2, color: GOLD[i % GOLD.length], floor: false });
  }
}

/** A halo ring above a fighter's head, in screen space. */
function drawHalo(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  ctx.globalAlpha = a;
  ctx.fillStyle = '#f0c040';
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(t) * 7), Math.round(y + Math.sin(t) * 2), 1, 1);
  }
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(Math.round(x - 3), Math.round(y - 2), 6, 1);
  ctx.globalAlpha = 1;
}

const headTop = (self: Fighter, cam: number): [number, number] => [self.wx(self.skel.headTop[0]) - cam, FLOOR - self.wy(self.skel.headTop[1])];

// ------------------------------------------------------------------ poses

/** Palms pressed together in front of the chest, head bowed. */
const PRAY: Pose = P(STANCE, { t: 4, h: 12, af: -28, ef: -112, ab: -24, eb: -116, lf: -10, kf: 8, lb: 10, kb: 4 });
/** Down on one knee, praying. */
const KNEEL_PRAY: Pose = P(CROUCH, { t: 4, h: 14, af: -28, ef: -114, ab: -24, eb: -118, lf: -88, kf: 92, lb: 6, kb: 96 });
/** Hands raised to the sky. */
const BLESS: Pose = P(STANCE, { t: -6, h: -12, af: -150, ef: -20, ab: -140, eb: -25, lf: -10, kf: 8, lb: 10, kb: 4 });
/** A small bow. */
const BOW: Pose = P(PRAY, { t: 22, h: 20 });

// ------------------------------------------------------------------ specials

const dailyBread: Move = {
  id: 'proj_loaf',
  anim: A([
    // underhand toss, the way you would pass a loaf down a breadline
    [P(STANCE, { af: 40, ef: -30, ab: -30, eb: -100, t: 14, h: 2, lf: -30, kf: 40, lb: 24, kb: 10 }), 8],
    [P(STANCE, { af: -50, ef: -10, ab: -20, eb: -90, t: 6, h: -4, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
    [P(STANCE, { af: -115, ef: -8, ab: -10, eb: -80, t: -4, h: -8, lf: -36, kf: 36, lb: 26, kb: 6 }), 12],
    [STANCE, 6],
  ]),
  sounds: { frames: { 1: 'inhale', 9: 'whoosh' } },
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 10) {
      f.projectiles.push(new Projectile(self, 'loaf', self.x + self.facing * 22, 48));
      self.projOut = true;
    }
  },
};

const toughLove: Move = {
  id: 'toughlove',
  anim: A([
    // gather both palms at the chest, then a firm two-handed shove
    [P(STANCE, { af: -10, ef: -130, ab: -5, eb: -135, t: -6, h: 4, lf: -16, kf: 14, lb: 18, kb: 6 }), 8],
    [P(STANCE, { af: -88, ef: -6, ab: -82, eb: -10, t: 26, h: -6, lf: -46, kf: 44, lb: 34, kb: 6 }), 4, 'out'],
    [P(STANCE, { af: -86, ef: -8, ab: -80, eb: -12, t: 28, h: -4, lf: -46, kf: 44, lb: 34, kb: 6 }), 12],
    [STANCE, 8],
  ]),
  active: [9, 15],
  vx: (fr) => (fr >= 6 && fr < 12 ? 2.6 : 0),
  hit: { limb: 'handF', r: 9, dmg: 105, level: 'mid', effect: 'knockdown', push: 4.5, stun: 22, special: true },
  sounds: { frames: { 1: 'inhale', 8: 'palmShove' }, impact: ['blessBell', 'glovePop'], blocked: 'glovePop' },
  onFrame: (self, f, fr) => {
    if (fr === 9) f.particles.sparks(self.x + self.facing * 28, 54, 6, '#fff6c8');
    if (fr === 10 && self.hits > 0) haloRing(f, self.opp.x, 54, 12, 1.8);
  },
};

const prayerCircle: Move = {
  id: 'prayercircle',
  anim: A([[P(PRAY, { h: 4 }), 6], [P(PRAY, { t: 0, h: 16 }), 15], [P(PRAY, { t: 2, h: 10 }), 15], [P(BLESS, {}), 6], [STANCE, 8]]),
  active: [6, 36],
  hit: { limb: 'body', r: 25, dmg: 28, level: 'mid', effect: 'light', push: 1.2, stun: 16, rehit: 8, special: true },
  sounds: { frames: { 1: 'haloHum', 9: 'chime', 17: 'chime', 25: 'chime', 33: 'chime', 37: 'blessBell' }, impact: 'chime', blocked: 'chime' },
  onFrame: (self, f, fr) => {
    if (fr >= 6 && fr < 36 && fr % 8 === 6) haloRing(f, self.x + self.facing * 4, 46);
    if (fr >= 6 && fr < 36 && fr % 3 === 0) {
      // motes of light drifting up around her
      f.particles.add({ kind: 'spark', x: self.x + rand(-18, 18), y: rand(10, 60), vy: rand(0.4, 1), life: 22, max: 22, size: 1, color: GOLD[fr % GOLD.length], floor: false });
    }
  },
};

const specials: Special[] = [
  { name: 'Daily Bread', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: dailyBread },
  { name: 'Tough Love', cmd: [4, 6], btn: 'hp', text: 'B, F + HP', move: toughLove },
  { name: 'Prayer Circle', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP', move: prayerCircle },
];

// ------------------------------------------------------------------ intro

export const TERESA_LINES = {
  intro: 'I have come to help. You will need it.',
  finisher: 'Go with God. He is expecting you.',
};
const VOICE = { pitch: 1.1, rate: 0.85, female: true };

/** Round 1 entrance: shuffles in with small steps, presses her palms together and bows under a halo. */
export const TERESA_INTRO: Intro = {
  line: TERESA_LINES.intro,
  speech: VOICE,
  speakAt: 78,
  dur: 150,
  update(self, f, t, home) {
    if (t <= 56) {
      self.x = lerp(offscreenX(self, f), home, t / 56);
      self.poseOverride = null;
      if (t === 0) self.setAnim(A([[P(STANCE, { t: 14, h: 6, lf: -18, kf: 16, lb: 12, kb: 8 }), 7], [P(STANCE, { t: 14, h: 6, lf: 6, kf: 10, lb: -16, kb: 18 }), 7]], true));
    } else if (t < 72) {
      self.poseOverride = PRAY;
      if (t === 56) playCue('blessBell');
    } else if (t < 100) {
      self.poseOverride = BOW;
    } else {
      self.poseOverride = PRAY;
      if (t === 100) {
        playCue('chime');
        haloRing(f, self.x, 70, 16, 1.4);
      }
    }
  },
  draw(ctx, self, _f, t, cam) {
    if (t < 56) return;
    const [x, y] = headTop(self, cam);
    drawHalo(ctx, x, y - 4, Math.min(1, (t - 56) / 20) * (0.8 + Math.sin(t * 0.2) * 0.2));
  },
};

// ------------------------------------------------------------------ finisher

/**
 * Heavenly Send-Off: she kneels and prays, a beam of light comes down on the loser, and they float
 * up out of the stage wearing a halo. A single white feather drifts back down.
 */
function sendOff(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  if (t === 0) {
    D.lx = l.x;
    D.beam = 0;
    D.halo = 0;
    D.lift = 0;
    w.poseOverride = PRAY;
  }
  w.vx = 0;
  l.vx = 0;
  if (t === 8) w.poseOverride = KNEEL_PRAY;
  if (t === 10) playCue(['blessBell', 'haloHum']);
  // the beam opens over the loser
  if (t >= 14 && t < 200) D.beam = Math.min(1, D.beam + 0.04);
  if (t >= 200) D.beam = Math.max(0, D.beam - 0.03);
  if (t === 40) playCue(['harpGliss', 'haloHum']);
  if (t >= 40) {
    // limp and serene, they drift upward faster and faster
    D.halo = Math.min(1, D.halo + 0.05);
    D.lift = 0.15 + (t - 40) * 0.012;
    l.poseOverride = P(LAUNCHED, { t: -6, h: 10, af: -120, ef: -10, ab: -100, eb: -10, lf: -10, kf: 30, lb: 10, kb: 40 });
    l.tint = ['#fff6c8', Math.min(0.35, (t - 40) / 80)];
    l.y = Math.max(l.y, 0) + D.lift;
    l.vy = 0;
    if (t % 4 === 0) f.particles.add({ kind: 'spark', x: l.x + rand(-10, 10), y: l.y + rand(10, 60), vy: -0.6, life: 20, max: 20, size: 1, color: GOLD[t % GOLD.length], floor: false });
    if (l.y > 300) l.alpha = 0;
  } else {
    l.y = 0;
    l.vy = 0;
  }
  if (t === 70) playCue('haloHum');
  if (t === 96) say(TERESA_LINES.finisher, VOICE);
  if (t === 150) playCue('harpGliss');
  if (t === 190) {
    w.poseOverride = BLESS;
    f.particles.add({ kind: 'img', img: spr().feather, ix: 3, iy: 7, x: D.lx, y: 200, vx: 0.3, vy: -0.5, grav: 0, rot: 0.4, vrot: 0.02, life: 400, max: 400, floor: true });
    D.feather = f.particles.list[f.particles.list.length - 1];
  }
  const fe = D.feather;
  if (fe) {
    // sway side to side on the way down
    fe.vx = Math.sin(t * 0.07) * 0.6;
    fe.rot = Math.sin(t * 0.07) * 0.6;
    fe.vrot = 0;
  }
  if (t === 236) w.poseOverride = BOW;
  if (t === 262) {
    w.poseOverride = PRAY;
    playCue('blessBell');
  }
  return t >= 320;
}

function drawSendOff(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!D || D.lx == null) return;
  const x = Math.round(D.lx - cam);
  if (!front && D.beam > 0) {
    // a soft column of light from above, brightest at its core
    for (const [w, a] of [[30, 0.1], [20, 0.12], [10, 0.16]] as const) {
      ctx.globalAlpha = a * D.beam;
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(x - w, 0, w * 2, FLOOR);
    }
    ctx.globalAlpha = 0.25 * D.beam;
    ctx.fillRect(x - 34, FLOOR - 2, 68, 4);
    ctx.globalAlpha = 1;
  }
  if (front && D.halo > 0) {
    const l = f.loser;
    if (l && l.alpha > 0) {
      const [hx, hy] = headTop(l, cam);
      drawHalo(ctx, hx, hy - 4, D.halo);
    }
  }
}

export const TERESA_PORTRAIT: PortraitStyle = {
  skip: { hair: true },
  back(p, c) {
    // the veil falling behind the head to the shoulders
    c.sculpt((m) => m.poly([[18, 26], [44, 12], [72, 16], [82, 30], [60, 40], [44, 60], [46, 110], [14, 116], [10, 70]], '#fff'), darken(c.look.shirt, 0.05), { soft: 5 });
  },
  front(p, c) {
    const L = c.look, g = c.geom, B = stripe(L);
    // veil over the crown with the blue border framing the face
    c.sculpt((m) => m.poly([[22, 30], [34, 14], [58, 10], [80, 20], [84, 34], [70, 32], [54, 34], [44, 42], [40, 60], [44, 80], [50, 104], [20, 112], [14, 70]], '#fff'), L.shirt, { soft: 4 });
    const edge = [[83, 32], [70, 29], [54, 31], [43, 39], [38, 58], [41, 80], [47, 104]];
    // one broad stripe at the hem of the veil, then two thin ones further back
    for (const off of [0, 1, 2, 5, 8]) for (let i = 0; i + 1 < edge.length; i++) p.line(edge[i][0] - off, edge[i][1] - off * 0.6, edge[i + 1][0] - off, edge[i + 1][1] - off * 0.6, B);
    // deep laugh lines, crow's feet and a lined brow
    const d = darken(L.skin, 0.25);
    const [ax, ay] = g.eyeA;
    p.line(ax - 8, ay - 1, ax - 5, ay + 1, d);
    p.line(ax - 8, ay + 3, ax - 5, ay + 3, d);
    p.line(54, g.browY - 5, 70, g.browY - 6, d);
    const [nx, ny] = g.nostril;
    p.line(nx - 2, ny + 3, g.mouth[0] - 4, g.mouth[1] + 2, d);
    if (!c.beaten) p.line(g.mouth[0] - 5, g.mouth[1] - 1, g.mouth[0] - 3, g.mouth[1] - 2, d); // a small smile
    // the crucifix pin at the shoulder
    p.line(70, 104, 70, 113, '#3a3440');
    p.line(67, 107, 73, 107, '#3a3440');
  },
};

/** Select-screen set: a whitewashed mission wall with a blue band, an arched sunny window and marigolds. */
export const MISSION_SET: SetPainter = (g) => {
  const { u } = g;
  g.r(0, 0, g.w, g.floor, '#e8e4d8');
  for (let y = 0; y < g.floor; y += 6 * u) g.r(0, y, g.w, u * 0.5, '#dcd6c6');
  // blue dado band, like the sari's border
  g.r(0, g.floor - 7 * u, g.w, 2 * u, '#2c5cc0');
  g.r(0, g.floor - 4 * u, g.w, u, '#2c5cc0');
  // arched window with warm light coming through
  const wx = g.w * 0.24, ww = 9 * u, wy = 4 * u, wh = 14 * u;
  g.r(wx - u, wy + 2 * u, ww + 2 * u, wh, '#8a7a66');
  g.r(wx, wy + 3 * u, ww, wh - u, '#ffe8a8');
  g.r(wx + u, wy + u, ww - 2 * u, 2 * u, '#8a7a66');
  g.r(wx + 2 * u, wy + 2 * u, ww - 4 * u, u, '#ffe8a8');
  g.r(wx + ww / 2 - u * 0.5, wy + 2 * u, u, wh, '#8a7a66');
  g.ctx.save();
  g.ctx.globalAlpha = 0.18;
  g.ctx.fillStyle = '#fff0b0';
  g.ctx.beginPath();
  g.ctx.moveTo(wx, wy + wh);
  g.ctx.lineTo(wx + ww, wy + wh);
  g.ctx.lineTo(wx + ww + 10 * u, g.h);
  g.ctx.lineTo(wx + 6 * u, g.h);
  g.ctx.fill();
  g.ctx.restore();
  // clay pot of marigolds
  const px = g.w * 0.8;
  g.r(px - 3 * u, g.floor - 5 * u, 6 * u, 5 * u, '#b0603a');
  g.r(px - 3 * u, g.floor - 5 * u, 6 * u, u, '#c87a4a');
  for (const [dx, dy] of [[-2, -8], [0, -10], [2, -8], [-1, -12], [1, -6]]) {
    g.r(px + dx * u, g.floor + (dy + 2) * u, u * 0.5, (-dy - 6) * u + u, '#3a7a30');
    g.r(px + (dx - 0.5) * u, g.floor + dy * u, 2 * u, 2 * u, (dx + dy) % 2 ? '#f0a020' : '#f07818');
  }
  // terracotta tiles
  g.r(0, g.floor, g.w, g.h - g.floor, '#b8704a');
  for (let x = 0; x < g.w; x += 8 * u) g.r(x, g.floor, u * 0.5, g.h - g.floor, '#9a5a3a');
  for (let y = g.floor + 4 * u; y < g.h; y += 4 * u) g.r(0, y, g.w, u * 0.5, '#9a5a3a');
  g.r(0, g.floor, g.w, u, '#d8d0c0');
};

export function teresa(): CharDef {
  return {
    id: 'teresa', name: 'Mother Teresa', short: 'TERESA', title: 'The Saint of the Streets', look: TERESA_LOOK, alt: TERESA_ALT,
    specials, voice: 250, props: {}, scale: 0.92, intro: TERESA_INTRO, portrait: TERESA_PORTRAIT,
    selectSet: MISSION_SET,
    finisher: { name: 'Heavenly Send-Off', cmd: [6, 2, 6], btn: 'lp', text: 'F, D, F + LP (any range)', range: [0, 400] },
    fatality: sendOff, fatalityDraw: drawSendOff,
    quotes: [
      'I WILL PRAY FOR YOU, {L}. YOU NEED IT MORE THAN MOST.',
      'KINDNESS IS FREE. SO WAS THAT BEATING.',
      'SIT. REST. I WILL FETCH YOU SOME SOUP AND A SPLINT.',
      'I FORGIVE YOU. MY ELBOWS DO NOT.',
      'SMALL THINGS WITH GREAT LOVE. AND ONE BIG SHOVE.',
    ],
    quotesVs: {
      oprah: 'YOU GIVE AWAY CARS. I GIVE SECOND CHANCES. THIS WAS NOT ONE.',
      lumpsum: 'MONEY CANNOT BUY YOU A BETTER BLOCK.',
      ramsay: 'SUCH LANGUAGE. GO WASH YOUR MOUTH OUT WITH MY SOUP.',
      joan: 'A FELLOW SAINT. A SLOWER ONE.',
    },
  };
}
