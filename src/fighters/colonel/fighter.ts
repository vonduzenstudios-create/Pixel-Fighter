import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, HIT_HIGH, DIZZY } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import { lerp, offscreenX, type Intro } from '../../game/intro';
import type { PortraitStyle } from '../../gfx/portrait';
import { Painter, makeCanvas } from '../../gfx/painter';
import type { Part, PartSet } from '../../gfx/rig';
import { sfx } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { rand } from '../../core/rng';

// Colonel Cornelius Crisp: an original parody of the Southern fried-chicken gentleman. White suit,
// string tie, goatee and a walking cane. No restaurant names, logos, buckets, stripes or slogans.

const OUT = '#100810';

const CRISP_LOOK: Look = {
  skin: '#f0c4a0', hair: '#f2f0ea', eye: '#2a2a3a', shirt: '#fbfaf6', coat: '#ece8dc', tails: true,
  pants: '#ece8dc', boots: '#1a1418', hairStyle: 'slick', beard: 'goatee', mustache: true,
  necktie: '#141216', glasses: '#141216',
};
/** Palette swap for mirror matches: the black evening suit with a gold string tie. */
const CRISP_ALT: Look = { ...CRISP_LOOK, coat: '#22202a', pants: '#22202a', boots: '#6a3a1a', necktie: '#d8b040', glasses: '#6a4a20' };

// ------------------------------------------------------------------ props and sprites

function part(p: Painter, px: number, py: number): Part {
  p.outline(OUT);
  return { img: p.canvas(), px, py };
}

/** Lacquered walking cane with a gold knob; hangs down from the grip. */
export function cane(): Part {
  const p = new Painter(8, 34);
  p.rect(3, 2, 2, 29, '#3a2214');
  p.line(3, 3, 3, 30, '#6a4628');
  p.ellipse(4, 2, 2.5, 2.2, '#d8b040');
  p.set(3, 1, '#fff0a0');
  p.rect(3, 31, 2, 2, '#c8ccd4');
  return part(p, 4, 3);
}

/** Cast-iron skillet: handle at the grip, pan at the far end. */
export function skillet(): Part {
  const p = new Painter(14, 24);
  p.rect(6, 0, 2, 11, '#2a2a30');
  p.line(6, 1, 6, 10, '#4a4a54');
  p.ellipse(7, 17, 6, 5.5, '#26262c');
  p.ellipse(7, 17, 4.5, 4, '#e0a030');
  p.ellipse(6, 16, 2, 1.5, '#ffe080');
  p.line(1, 14, 3, 12, '#5a5a66');
  return part(p, 7, 2);
}

function paintDrumstick(p: Painter, bx: number, by: number, mx: number, my: number, rx: number, ry: number) {
  p.line(bx, by, mx, my, '#f0e6d2');
  p.ellipse(bx, by, 1.6, 1.6, '#f6eee0');
  p.ellipse(mx, my, rx, ry, '#c47422');
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = (i % 3) * 0.3 + 0.35;
    p.set(mx + Math.cos(a) * rx * r, my + Math.sin(a) * ry * r, i % 2 ? '#eaa848' : '#8a4410');
  }
}

/** A golden fried drumstick, lying flat (thrown). */
export function drumstick(): HTMLCanvasElement {
  const p = new Painter(16, 10);
  paintDrumstick(p, 2, 5, 9, 5, 5, 3.6);
  p.ellipse(2, 3.5, 1.4, 1.4, '#f6eee0');
  p.ellipse(2, 6.5, 1.4, 1.4, '#f6eee0');
  p.shade(0.18);
  p.outline(OUT);
  return p.canvas();
}

/** A drumstick held by the bone. */
export function drumstickHeld(): Part {
  const p = new Painter(10, 16);
  paintDrumstick(p, 5, 2, 5, 10, 3.8, 4.8);
  p.shade(0.18);
  return part(p, 5, 2);
}

let IMG: { stick: HTMLCanvasElement } | null = null;
const img = () => (IMG ??= { stick: drumstick() });

/** Thrown drumstick: spinning, shedding crumbs. */
export function drawDrumstick(ctx: CanvasRenderingContext2D, t: number, vx: number) {
  ctx.rotate(t * 0.45 * (Math.sign(vx) || 1));
  ctx.drawImage(img().stick, -8, -5);
}

/** Hot grease: a golden blob in flight, a burning puddle once it lands. */
export function drawGrease(ctx: CanvasRenderingContext2D, t: number, landed: boolean) {
  if (!landed) {
    ctx.fillStyle = '#7a4a10';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillRect(-3, -4, 6, 8);
    ctx.fillStyle = '#e8a830';
    ctx.fillRect(-3, -2, 6, 4);
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(-2, -2, 2, 1);
    return;
  }
  const w = 13;
  ctx.fillStyle = '#5a3008';
  ctx.fillRect(-w, 2, w * 2, 2);
  ctx.fillStyle = '#d89020';
  ctx.fillRect(-w + 2, 1, w * 2 - 4, 2);
  ctx.fillStyle = '#fff0a0';
  for (let i = -w + 3; i < w - 2; i += 5) if ((i + t) % 3 === 0) ctx.fillRect(i, 1, 2, 1);
  // little licks of flame
  for (let i = -w + 2; i < w - 1; i += 4) {
    const h = 3 + ((i * 7 + t) % 5);
    ctx.fillStyle = '#ff7010';
    ctx.fillRect(i, 1 - h, 2, h);
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(i, 1 - Math.ceil(h / 2), 1, Math.ceil(h / 2));
  }
}

/** Spice and flour drifting down. */
function season(f: Fight, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-10, 10), y: y + rand(-2, 2), vx: rand(-0.3, 0.3), vy: rand(-0.6, -0.1), grav: 0.02, life: 40, max: 40,
      color: ['#f4ecd8', '#f4ecd8', '#c8501c', '#3a2a20'][i % 4], floor: true });
}

function crumbs(f: Fight, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x, y, vx: rand(-1.4, 1.4), vy: rand(0.2, 1.8), grav: 0.12, life: 50, max: 50, color: i % 2 ? '#c47422' : '#eaa848', floor: true });
}

// ------------------------------------------------------------------ poses (facing right)

/** Leaning on the cane: front hand on the knob, cane planted ahead of the front foot. */
const ON_CANE = P(STANCE, { t: 10, h: -4, af: -32, ef: -12, pa: 44, ab: -40, eb: -95 });
const CANE_UP = P(STANCE, { t: -12, h: -8, af: -205, ef: -25, ab: -20, eb: -60, pa: 0, lf: -12, kf: 18, lb: 22, kb: 6 });
const CANE_DOWN = P(STANCE, { t: 26, h: 4, af: -70, ef: -6, ab: 20, eb: -50, pa: 0, lf: -48, kf: 48, lb: 34, kb: 6 });
const CANE_SIDE = P(STANCE, { t: 18, h: -2, af: -98, ef: -4, ab: 30, eb: -40, pa: -12, lf: -40, kf: 40, lb: 30, kb: 8 });
const CANE_HOOK = P(STANCE, { t: -4, h: -10, af: -128, ef: -10, ab: 10, eb: -70, pa: -60, lf: -30, kf: 30, lb: 26, kb: 10 });
/** Arm crooked back to the mouth for a bite. */
const BITE = P(STANCE, { t: 4, h: 12, af: -6, ef: -164, ab: -30, eb: -80 });
const HOLD_STICK = P(STANCE, { t: 2, h: 0, af: -45, ef: -95, ab: -30, eb: -80 });

// ------------------------------------------------------------------ specials

const drumstickToss: Move = {
  id: 'proj_drumstick',
  anim: A([
    // reach into the coat, wind up sidearm, whip it out with the hips
    [P(STANCE, { t: 4, h: 2, af: 20, ef: -40, ab: -30, eb: -110 }), 5],
    [P(STANCE, { t: -10, h: -8, af: 70, ef: -95, ab: -60, eb: -90, lf: -14, kf: 20, lb: 24, kb: 4 }), 7],
    [P(STANCE, { t: 24, h: -6, af: -96, ef: -2, ab: 30, eb: -30, lf: -44, kf: 44, lb: 32, kb: 8 }), 8],
    [P(STANCE, { t: 28, h: -2, af: -50, ef: -20, ab: 34, eb: -30, lf: -44, kf: 44, lb: 32, kb: 8 }), 8],
    [STANCE, 7],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 14) {
      f.projectiles.push(new Projectile(self, 'drumstick', self.x + self.facing * 24, 56));
      self.projOut = true;
      f.sfx('whoosh');
    }
  },
};

const greaseLob: Move = {
  id: 'proj_grease', prop: 'skillet',
  anim: A([
    // dip the skillet low, then scoop it up and over to fling the hot grease
    [P(CROUCH, { t: 30, h: -10, af: 30, ef: -20, ab: -40, eb: -100 }), 8],
    [P(STANCE, { t: -6, h: -10, af: -150, ef: -12, ab: 10, eb: -60, lf: -30, kf: 30, lb: 24, kb: 8 }), 6],
    [P(STANCE, { t: -10, h: -12, af: -178, ef: -10, ab: 20, eb: -60, lf: -30, kf: 30, lb: 24, kb: 8 }), 10],
    [STANCE, 8],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 11) {
      const p = new Projectile(self, 'grease', self.x + self.facing * 16, 66);
      p.vy = 2.6;
      f.projectiles.push(p);
      self.projOut = true;
      f.sfx('whoosh');
    }
  },
};

const caneThrashing: Move = {
  id: 'canethrash', prop: 'cane',
  anim: A([
    [CANE_UP, 6],
    [CANE_DOWN, 4],
    [P(CANE_UP, { af: -170 }), 3],
    [CANE_SIDE, 4],
    [P(CANE_UP, { af: -180, t: -4 }), 3],
    [CANE_DOWN, 4],
    [P(CANE_SIDE, { af: -110 }), 3],
    [CANE_HOOK, 6],
    [P(CANE_HOOK, { af: -110, pa: -40 }), 6],
    [ON_CANE, 9],
  ]),
  active: [6, 36],
  vx: (fr) => (fr >= 4 && fr < 30 ? 2 : 0),
  hit: { limb: 'prop', r: 9, dmg: 24, level: 'mid', effect: 'light', push: 0.6, stun: 14, rehit: 6, special: true, sfx: 'heavy' },
  whoosh: true,
  onFrame: (self, f, fr) => {
    if (fr >= 6 && fr < 30 && fr % 7 === 6) f.sfx('whoosh');
    // the crook catches them and yanks them back in close
    if (fr === 33 && self.hits > 0 && !self.opp.airborne) {
      self.opp.x -= self.facing * 10;
      f.particles.sparks(self.opp.x, 60, 6, '#d8b040');
      playCue('caneTap');
    }
  },
};

const crispSpecials: Special[] = [
  { name: 'Drumstick Toss', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: drumstickToss },
  { name: 'Hot Grease Fling', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P (burns the floor)', move: greaseLob },
  { name: 'Gentleman\'s Thrashing', cmd: [4, 6], btn: 'hp', mash: 'hp', text: 'B, F + HP or MASH HP', move: caneThrashing },
];

// ------------------------------------------------------------------ finisher

/** A browned copy of a body part for the crumble. */
function fried(src: HTMLCanvasElement, k: number): HTMLCanvasElement {
  const [c, x] = makeCanvas(src.width, src.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = `rgba(110,52,10,${k})`;
  x.fillRect(0, 0, src.width, src.height);
  x.fillStyle = 'rgba(234,168,72,0.8)';
  for (let yy = 0; yy < src.height; yy += 3) for (let xx = (yy * 5) % 4; xx < src.width; xx += 4) x.fillRect(xx, yy, 1, 1);
  return c;
}

/** Extra Crispy: seasons the loser, a geyser of fryer oil erupts beneath them, and they crumble into crunchy bits. */
function extraCrispy(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  if (tt === 0) D.dir = w.facing;
  if (tt < 18) {
    w.x += (l.x - D.dir * 32 - w.x) * 0.2;
    w.propOverride = w.ch.props.cane ?? null;
    w.poseOverride = ON_CANE;
  } else if (tt < 62) {
    // shakes a tin of seasoning over their head
    w.propOverride = null;
    const up = (tt >> 2) % 2;
    w.poseOverride = P(STANCE, { t: 4, h: -8, af: -150 + up * 14, ef: -40 - up * 12, ab: -40, eb: -95 });
    l.poseOverride = DIZZY;
    if (tt % 3 === 0) season(fight, l.x, 96, 3);
    if (tt % 8 === 2) playCue('shaker');
    l.tint = ['#f4ecd8', Math.min(0.55, (tt - 18) / 60)];
  } else if (tt < 140) {
    if (tt === 62) {
      // cane stomp: the fryer opens up beneath them
      w.propOverride = w.ch.props.cane ?? null;
      w.poseOverride = P(ON_CANE, { t: 18, af: -10, pa: 20 });
      playCue(['caneTap', 'sizzle', 'flameBurst']);
      fight.shake(10);
    }
    if (tt === 72) w.poseOverride = P(ON_CANE, { t: -6, h: -12 });
    const k = (tt - 62) / 78;
    for (let i = 0; i < 3; i++) ps.fire(l.x + rand(-14, 14), rand(0, 20 + k * 70), 1, 4);
    if (tt % 2 === 0) ps.add({ kind: 'spark', x: l.x + rand(-16, 16), y: rand(0, 12), vx: 0, vy: rand(0.6, 1.4), grav: 0, life: 18, max: 18, color: '#ffe080', floor: false });
    if (tt % 4 === 0) ps.smoke(l.x + rand(-10, 10), rand(40, 90), 1, '#5a4a3a');
    if (tt % 10 === 0) playCue('sizzle');
    const golden = k < 0.5;
    l.tint = golden ? ['#d08a2c', 0.3 + k] : ['#4a2008', 0.4 + (k - 0.5) * 0.9];
    l.shake = 2;
    l.poseOverride = tt % 12 < 6 ? P(HIT_HIGH, { af: -160, ab: -150, ef: -30, eb: -30 }) : P(DIZZY, { af: -140, ab: -120, h: -20 });
    if (tt === 74) sfx.scream();
  } else if (tt === 140) {
    // crumbles into crunchy pieces
    const P2: PartSet = l.parts;
    const s = l.skel;
    const list: [Part, [number, number]][] = [
      [P2.head, s.neck], [P2.torso, s.hip], [P2.uarm, s.shF], [P2.farm, s.elbowF], [P2.uarmB, s.shB], [P2.farmB, s.elbowB],
      [P2.thigh, s.hipF], [P2.shin, s.kneeF], [P2.foot, s.ankleF], [P2.thighB, s.hipB], [P2.shinB, s.kneeB], [P2.footB, s.ankleB],
    ];
    for (const [pt, at] of list) ps.chunk(fried(pt.img, 0.82), pt.px, pt.py, l.wx(at[0]), l.wy(at[1]), rand(-1.2, 1.2), rand(0.2, 1.6), rand(-0.2, 0.2));
    for (let i = 0; i < 6; i++) crumbs(fight, l.x + rand(-10, 10), rand(10, 80), 8);
    ps.blood(l.x, 50, 1, 30, 1.2);
    ps.blood(l.x, 50, -1, 30, 1.2);
    l.alpha = 0;
    l.tint = null;
    l.shake = 0;
    playCue(['crunch', 'thud']);
    fight.shake(8);
  } else if (tt < 290) {
    if (tt < 150 && tt % 3 === 0) ps.smoke(l.x + rand(-12, 12), rand(0, 30), 1, '#5a4a3a');
    // a drumstick for the road
    if (tt === 168) w.propOverride = (w.ch.props.drumstick as Part) ?? null;
    if (tt >= 168) {
      const bite = tt >= 200 && tt < 260 && (tt - 200) % 24 < 8;
      w.poseOverride = bite ? BITE : HOLD_STICK;
      if (bite && (tt - 200) % 24 === 2) {
        playCue('bite');
        crumbs(fight, w.wx(w.skel.handF[0]), w.wy(w.skel.handF[1]), 6);
      }
    } else w.poseOverride = P(ON_CANE, { h: -6 });
  }
  return tt >= 290;
}

// ------------------------------------------------------------------ entrance

export const CRISP_INTRO: Intro = {
  line: "Evening, friend. I'll have you golden brown by suppertime.",
  speech: { pitch: 0.8, rate: 0.85 },
  speakAt: 92,
  dur: 180,
  update(self, f, t, home) {
    if (t <= 54) {
      // a stately stroll, tapping the cane every other step
      self.propOverride = self.ch.props.cane ?? null;
      self.x = lerp(offscreenX(self, f), home, t / 54);
      const st = Math.floor(t / 9) % 2;
      self.poseOverride = P(ON_CANE, st ? { lf: -26, kf: 16, lb: 22, kb: 22, af: -40, pa: 52 } : { lf: 10, kf: 26, lb: -14, kb: 14 });
      if (t % 18 === 0) playCue('caneTap');
    } else if (t < 88) {
      // twirls the cane
      self.propOverride = self.ch.props.cane ?? null;
      self.poseOverride = P(STANCE, { t: 2, h: -6, af: -92, ef: -6, ab: -40, eb: -95, pa: (t - 54) * 32 });
      if (t === 56 || t === 70) f.sfx('whoosh');
    } else if (t < 100) {
      self.poseOverride = ON_CANE;
      if (t === 88) playCue('caneTap');
    } else {
      // and a bite of his own cooking
      self.propOverride = (self.ch.props.drumstick as Part) ?? null;
      const bite = t >= 112 && t < 150 && (t - 112) % 18 < 7;
      self.poseOverride = bite ? BITE : HOLD_STICK;
      if (bite && (t - 112) % 18 === 2) {
        playCue('bite');
        crumbs(f, self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1]), 4);
      }
    }
  },
};

// ------------------------------------------------------------------ portrait

const CRISP_PORTRAIT: PortraitStyle = {
  front(p, c) {
    const g = c.geom, hair = c.look.hair;
    // neat white goatee under the lip
    c.sculpt((m) => {
      m.ellipse(g.mouth[0] - 2, g.mouth[1] + 9, 8, 8, '#fff');
      m.poly([[g.mouth[0] - 8, g.mouth[1] + 8], [g.mouth[0] + 4, g.mouth[1] + 8], [g.chin[0] + 2, g.chin[1] + 6], [g.chin[0] - 3, g.chin[1] + 4]], '#fff');
    }, hair, { soft: 2 });
    if (!c.beaten) p.line(g.mouth[0] - 5, g.mouth[1] + 1, g.mouth[0] + 5, g.mouth[1], '#6a2a2a');
    // thick black-rimmed glasses
    const fr = c.look.glasses ?? '#141216';
    const lens = (x: number, y: number, w: number) => {
      p.rect(x - w, y - 5, w * 2 + 1, 2, fr);
      p.rect(x - w, y + 4, w * 2 + 1, 2, fr);
      p.rect(x - w, y - 5, 2, 11, fr);
      p.rect(x + w - 1, y - 5, 2, 11, fr);
      if (!c.beaten) p.set(x - w + 3, y - 2, '#ffffff');
    };
    const [ax, ay] = g.eyeA, [bx, by] = g.eyeB;
    lens(ax, ay, 7);
    lens(bx, by, 6);
    p.rect(ax + 7, Math.min(ay, by) - 3, bx - 6 - ax - 7, 2, fr);
    p.rect(g.ear[0] + 4, ay - 4, ax - 7 - g.ear[0] - 4, 2, fr);
    if (c.beaten) p.line(ax - 5, ay - 3, ax + 4, ay + 3, '#e8f4ff');
  },
};

export function colonelCrisp(): CharDef {
  return {
    id: 'colonel', name: 'Colonel Crisp', short: 'CRISP', title: 'The Fried Gentleman', look: CRISP_LOOK, alt: CRISP_ALT,
    specials: crispSpecials, voice: 95, props: { cane: cane(), skillet: skillet(), drumstick: drumstickHeld() },
    finisher: { name: 'Extra Crispy', cmd: [4, 2, 6], btn: 'hp', text: 'B, D, F + HP (close)', range: [0, 90] },
    fatality: extraCrispy,
    intro: CRISP_INTRO,
    portrait: CRISP_PORTRAIT,
  };
}
