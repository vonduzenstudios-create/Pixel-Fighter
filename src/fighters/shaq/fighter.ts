import { DIGITS, type Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, DIZZY, VICTORY, WALK } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Finisher, Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import { FLOOR, GRAV, STAGE_W } from '../../core/consts';
import { Painter, pxLine } from '../../gfx/painter';
import { darken, lighten } from '../../gfx/palette';
import type { Part } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import { sfx, say } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { rand } from '../../core/rng';
import { ease, lerp, offscreenX, type Intro } from '../../game/intro';

// ------------------------------------------------------------------ Shaquille O'Neal (parody)
// A pixel caricature of the seven-foot basketball great: a head taller than everyone else,
// and every special is a basketball play. Plain jersey and shorts, no league or team marks.

const SCALE = 1.22;

export const SHAQ_LOOK: Look = {
  skin: '#6a3e26', hair: '#140e0c', eye: '#1a1010', shirt: '#f2f0ea', pants: '#f2f0ea', boots: '#1a1a22',
  socks: '#f2f0ea', hairStyle: 'bald', beard: 'vandyke', jersey: { color: '#f2f0ea', trim: '#d04a12', number: '34' },
  baggyShorts: true, wristband: '#f2f0ea', hiTops: '#d04a12',
};
/** Palette swap for mirror matches: the road uniform. */
export const SHAQ_ALT: Look = {
  ...SHAQ_LOOK, shirt: '#1c2e78', pants: '#1c2e78', boots: '#f2f0ea', hiTops: '#1c2e78', wristband: '#1c2e78',
  jersey: { color: '#1c2e78', trim: '#f0c020', number: '34' },
};

// Original lines (no quotes from interviews, ads or films).
export const SHAQ_LINES = {
  intro: 'Big man on the floor. Clear the lane!',
  finisher: 'Too big. Too strong. Nothing but net.',
};
const VOICE = { pitch: 0.55, rate: 0.9 };

// ------------------------------------------------------------------ the ball
const BALL = '#d8661a', BALL_HI = '#f4a050', BALL_LO = '#8a3a10', SEAM = '#2a1208', OUT = '#100810';

/**
 * Basketball centred on the origin, pixel by pixel so it stays crisp. `rot` turns the seams,
 * `squash` < 1 flattens it as it hits the floor.
 */
export function drawBasketball(ctx: CanvasRenderingContext2D, rot: number, squash = 1, r = 6) {
  const sx = 2 - squash, sy = squash;
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const u = x / sx, v = y / sy, d = Math.hypot(u, v);
      if (d > r + 0.9) continue;
      let col = OUT;
      if (d <= r) {
        // seams: one line through the middle, one across it, and two curved ones
        const a = u * c + v * s, b = -u * s + v * c;
        const seam = Math.abs(a) < 0.5 || Math.abs(b) < 0.5 || Math.abs(Math.abs(a) - (r * 0.55 + (b * b) / (r * 2.4))) < 0.5;
        col = seam ? SEAM : u + v < -r * 0.6 ? BALL_HI : u + v > r * 0.9 ? BALL_LO : BALL;
      }
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
}

/** The ball as a held prop: centred a few pixels past the palm. */
function ballProp(): Part {
  const p = new Painter(16, 16);
  p.ellipse(8, 8, 6, 6, BALL);
  p.line(2, 8, 14, 8, SEAM);
  p.line(8, 2, 8, 14, SEAM);
  p.line(4, 3, 4, 13, SEAM);
  p.shade(0.25);
  p.set(6, 5, BALL_HI);
  p.outline(OUT);
  return { img: p.canvas(), px: 8, py: 3 };
}
let BALL_PART: Part | null = null;
const ballPart = () => (BALL_PART ??= ballProp());

// ------------------------------------------------------------------ poses (facing right)
const SHAQ_STANCE = P(STANCE, { t: 12, h: -2, lf: -26, kf: 26, lb: 22, kb: 6 });
const CHEST_PASS = P(STANCE, { t: 4, af: -60, ef: -95, ab: -50, eb: -100 });
const ARMS_UP = P(STANCE, { t: -4, h: -10, af: -172, ef: -14, ab: -166, eb: -20 });
const HANG = P(STANCE, { t: -6, h: -6, af: -176, ef: -4, ab: -170, eb: -6, lf: -8, kf: 24, lb: 10, kb: 30, ff: 30, fb: 30 });

// ------------------------------------------------------------------ specials
const bouncePass: Move = {
  id: 'proj_bball',
  anim: A([
    [P(CHEST_PASS, { t: -2, h: -4 }), 8],
    [P(STANCE, { t: 24, h: -6, af: -76, ef: -4, ab: -70, eb: -8, lf: -42, kf: 42, lb: 28, kb: 8 }), 10],
    [P(STANCE, { t: 18, af: -70, ef: -12, ab: -60, eb: -20 }), 10],
    [SHAQ_STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 0) self.propOverride = ballPart();
    if (fr === 9) {
      self.propOverride = null;
      const b = new Projectile(self, 'bball', self.x + self.facing * 30, 48);
      b.vy = -1.5;
      f.projectiles.push(b);
      self.projOut = true;
      f.sfx('whoosh', 1);
    }
  },
};

/** Lifting off for the dunk; the shockwave plays once per jump. */
const slammed = new WeakSet<Fighter>();

const backboardBreaker: Move = {
  id: 'backboard', air: true,
  anim: A([
    [P(CROUCH, { af: -110, ef: -60, ab: -100, eb: -60 }), 3],
    [P(STANCE, { t: -6, h: -14, af: -176, ef: -8, ab: -168, eb: -12, lf: -80, kf: 100, lb: 10, kb: 30 }), 14],
    [P(STANCE, { t: -18, h: -16, af: -205, ef: -30, ab: -198, eb: -34, lf: -60, kf: 90, lb: 20, kb: 40 }), 6],
    [P(STANCE, { t: 34, h: 12, af: -55, ef: -4, ab: -50, eb: -8, lf: -50, kf: 70, lb: 20, kb: 50 }), 6],
    // ride the slam all the way down
    [P(STANCE, { t: 30, h: 10, af: -40, ef: -4, ab: -36, eb: -8, lf: -40, kf: 60, lb: 16, kb: 40 }), 40],
  ]),
  // the dunk comes down on top of them: an overhead, so crouch-blocking will not save you
  active: [17, 60],
  hit: { limb: 'handF', r: 12, dmg: 115, level: 'overhead', effect: 'knockdown', push: 2, stun: 26, special: true, sfx: 'heavy' },
  onFrame: (self, f, fr) => {
    if (fr === 0) {
      self.propOverride = ballPart();
      slammed.delete(self);
    }
    if (fr === 2) {
      self.vy = 6.2;
      self.y = 1;
    }
    // drift toward the opponent, but bring the ball down on them rather than sailing over
    if (fr >= 2 && self.airborne) {
      const gap = self.facing * (self.opp.x - self.x) - 34;
      self.vx = self.facing * Math.max(0, Math.min(2.2, gap * 0.12));
    }
    if (fr > 2 && fr < 20 && fr % 2 === 0) f.particles.sparks(self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1]), 1, '#fff2c0');
    // touchdown: the floor shakes
    if (fr > 6 && !slammed.has(self) && self.y + self.vy - (f.stage.gravity ?? GRAV) <= 0) {
      slammed.add(self);
      self.propOverride = null;
      f.shake(5);
      for (const d of [-1, 1]) for (let i = 0; i < 4; i++) f.particles.smoke(self.x + d * (8 + i * 6), 2, 1, '#8a7a6a');
    }
  },
};

// Post up: turn your back, then back the opponent down with elbows and hip bumps.
const BUMP_OUT = P(STANCE, { t: -16, h: 8, rx: -3, ab: 78, eb: -14, af: 12, ef: -70, lf: -30, kf: 30, lb: 30, kb: 10 });
const BUMP_IN = P(STANCE, { t: 14, h: -4, rx: 1, ab: 46, eb: -30, af: 20, ef: -60, lf: -16, kf: 26, lb: 16, kb: 16 });
const postUp: Move = {
  id: 'postup',
  anim: A([
    [P(STANCE, { t: 0, ab: 40, eb: -30, af: 20, ef: -60 }), 5],
    ...[0, 1, 2, 3, 4].flatMap((): [typeof STANCE, number][] => [[BUMP_OUT, 4], [BUMP_IN, 4]]),
    [SHAQ_STANCE, 8],
  ]),
  active: [5, 45],
  vx: (fr) => (fr >= 5 && fr < 45 ? 1.1 : 0),
  hit: { limb: 'handB', r: 11, dmg: 24, level: 'mid', effect: 'light', push: 1.6, stun: 14, rehit: 8, special: true },
  onFrame: (self, f, fr) => {
    // face away from the man you are backing down; endMove turns him round again
    self.facing = (-self.moveDir) as 1 | -1;
    if (fr >= 5 && fr < 45 && (fr - 5) % 8 === 2) {
      f.shake(1);
      f.particles.smoke(self.x - self.moveDir * 6, 2, 1, '#8a7a6a');
    }
  },
};

export const SHAQ_SPECIALS: Special[] = [
  { name: 'Bounce Pass', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: bouncePass },
  { name: 'Backboard Breaker', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP', move: backboardBreaker },
  { name: 'Post-Up Bully', cmd: [4, 6], btn: 'lp', mash: 'lp', text: 'MASH LP', move: postUp },
];

export const SHAQ_FINISHER: Finisher = { name: 'Rim Wrecker', cmd: [4, 2, 6], btn: 'hp', text: 'B, D, F + HP (close)', range: [0, 90] };

// ------------------------------------------------------------------ finisher
// A hoop drops from the rafters. He hoists the loser overhead like a ball, rises up and stuffs
// them through the rim, which they do not fit through. Then he hangs on the rim until the
// backboard gives way.

/** Rim height above the floor. */
const RIM = 118;

const glass = (f: Fight, x: number, y: number, n: number) => {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-14, 14), y: y + rand(-4, 16), vx: rand(-2.2, 2.2), vy: rand(-0.5, 2.5), grav: 0.18, life: 70, max: 70, color: i % 3 ? '#d8f0ff' : '#ffffff', size: i % 4 ? 1 : 2, floor: true });
};

/** Put the loser, curled up like a ball, just above the winner's hands. */
function carry(w: Fighter, l: Fighter, t: number) {
  const hx = w.wx((w.skel.handF[0] + w.skel.handB[0]) / 2), hy = w.wy(Math.min(w.skel.handF[1], w.skel.handB[1]));
  l.poseOverride = P(TUCK, { rot: 180 + t * 6 * w.facing });
  l.x = hx;
  l.y = Math.max(1, hy + 6 - 40 * (l.ch.scale ?? 1));
  l.vy = 0;
}

function rimWrecker(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const away = l.x >= w.x ? 1 : -1;
  if (tt === 0) {
    D.away = away;
    D.hx = Math.max(60, Math.min((fight.stage.width ?? STAGE_W) - 60, l.x + away * 20));
    D.off = 160;
    D.wob = 0;
    D.net = 0;
    D.broken = false;
    playCue('buzzer');
  }
  const a = D.away as 1 | -1;
  // the hoop lowers from the rafters, wobbles when hit, and the net stretches under load
  D.off = tt < 30 ? 160 * (1 - ease(tt / 30)) : 0;
  D.wob *= 0.93;
  D.net *= 0.9;
  if (tt === 28) playCue('rimRattle');
  w.vx = 0;

  if (tt < 30) {
    // walk up to the dazed loser
    w.poseOverride = null;
    if (tt === 0) w.setAnim(WALK);
    w.x += (l.x - a * 20 - w.x) * 0.12;
  } else if (tt < 44) {
    // scoop them up and hoist them overhead
    if (tt === 30) {
      w.poseOverride = CROUCH;
      fight.sfx('grunt', w.ch.voice);
    }
    if (tt === 36) w.poseOverride = ARMS_UP;
    if (tt >= 36) carry(w, l, tt);
    if (tt === 40) sfx.scream();
  } else if (tt < 70) {
    // gather, then rise toward the rim
    if (tt === 44) {
      D.x0 = w.x;
      w.poseOverride = P(CROUCH, { af: -170, ef: -14, ab: -164, eb: -20, t: 10 });
      playCue('squeak');
    }
    if (tt >= 48) {
      const k = (tt - 48) / 22;
      w.poseOverride = P(ARMS_UP, { lf: -70, kf: 90, lb: 20, kb: 40, af: -186, ab: -180 });
      w.x = lerp(D.x0, D.hx - a * 16, ease(k));
      w.y = Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.5) * 34 + 1;
      w.vy = 0;
      if (tt === 48) playCue(['heave', 'crowd']);
    }
    carry(w, l, tt);
  } else if (tt < 84) {
    // the slam: arms come down and drive the loser into the hoop
    const k = Math.min(1, (tt - 70) / 6);
    w.poseOverride = P(STANCE, { t: 10 + k * 20, h: 6, af: -176 + k * 60, ef: -6, ab: -170 + k * 60, eb: -8, lf: -20, kf: 40, lb: 10, kb: 40 });
    w.y = 34 + 1;
    w.vy = 0;
    l.poseOverride = P(TUCK, { rot: 180 });
    l.x = D.hx;
    const hipTo = RIM - 20 - (tt - 70) * 2.5;
    l.y = Math.max(1, hipTo - 40 * (l.ch.scale ?? 1));
    l.vy = 0;
    l.stretch = lerp(1, 0.45, (tt - 70) / 8);
    if (tt === 74) {
      D.wob = 4;
      D.net = 8;
      fight.shake(10);
      playCue(['rimRattle', 'swish', 'boneCrack']);
      sfx.hit(true);
      fight.particles.blood(D.hx, RIM, 0, 40, 1.4);
      fight.particles.blood(D.hx, RIM - 4, a, 20, 2);
    }
    if (tt > 74 && tt % 2 === 0) fight.particles.blood(D.hx + rand(-4, 4), RIM - 10, rand(-0.6, 0.6), 4, 0.8);
    if (tt === 82) {
      // squeezed out the bottom of the net in pieces
      l.stretch = 1;
      fight.explode(l);
      l.alpha = 0;
      sfx.blood();
      sfx.crunch();
    }
  } else if (D.drop == null) {
    // hang on the rim, swinging, until the backboard gives way
    const sw = Math.sin((tt - 84) * 0.18) * Math.max(0, 1 - (tt - 84) / 60);
    w.poseOverride = P(HANG, { t: -6 + sw * 14, lf: -8 + sw * 20, lb: 10 + sw * 20 });
    w.x = D.hx - a * 7;
    w.y = Math.max(1, RIM - w.G + w.skel.handF[1]);
    w.vy = 0;
    if (tt === 90) playCue('crowd');
    if (tt === 104) {
      D.broken = true;
      D.wob = 6;
      fight.shake(14);
      playCue(['shatter', 'metalCrash', 'shatter']);
      glass(fight, D.hx + a * 8, RIM + 10, 46);
    }
    if (tt === 128) {
      D.drop = tt;
      w.poseOverride = P(TUCK, { af: -150, ef: -30, ab: -140, eb: -30, lf: -40, kf: 60, lb: -20, kb: 60 });
    }
  } else if (D.land == null) {
    // free fall (the fighter's own physics drops him)
    if (w.y <= 0) {
      D.land = tt;
      w.poseOverride = CROUCH;
      fight.shake(16);
      playCue('bigStomp');
      sfx.thud();
      for (let i = 0; i < 10; i++) fight.particles.smoke(w.x + rand(-26, 26), 2, 1, '#8a7a6a');
    }
  } else {
    const t = tt - D.land;
    if (t === 14) w.poseOverride = P(VICTORY, { ab: -150, eb: -30 });
    if (t === 20) say(SHAQ_LINES.finisher, VOICE);
    if (t === 24) playCue('crowd');
    return t >= 150;
  }
  if (l.alpha > 0 && tt < 30) l.poseOverride = DIZZY;
  return false;
}

/** The hoop: backboard, strut and the back of the rim behind the fighters, the front of the rim and net in front. */
function drawHoop(ctx: CanvasRenderingContext2D, fight: Fight, cam: number, front: boolean) {
  const D = fight.fatal?.data;
  if (!D || D.hx == null) return;
  const a: number = D.away;
  const x = Math.round(D.hx - cam), y = Math.round(FLOOR - RIM - D.off + Math.sin(fight.t * 0.9) * D.wob);
  const px = (c: string, X: number, Y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(X), Math.round(Y), w, h);
  };
  const rimPt = (k: number) => [x + Math.cos(k) * 9, y + Math.sin(k) * 2.5];
  if (!front) {
    // strut up into the rafters
    const bx = x + a * 12;
    px('#4a4a54', bx + a * 6 - 1, y - 200, 3, 186);
    px('#6a6a78', bx + a * 6, y - 200, 1, 186);
    // backboard, seen three-quarters on
    if (!D.broken) {
      px(OUT, bx - 16, y - 23, 33, 27);
      px('#e8f2f8', bx - 15, y - 22, 31, 25);
      px('#c8dce8', bx - 15, y - 22, 31, 4);
      px('#d04a12', bx - 7, y - 14, 15, 1);
      px('#d04a12', bx - 7, y - 14, 1, 11);
      px('#d04a12', bx + 7, y - 14, 1, 11);
      for (let i = 0; i < 4; i++) px('#ffffff', bx - 12 + i * 3, y - 19 + i * 2, 2, 1);
    } else {
      // empty frame with a few teeth of glass left in it
      px('#3a3a44', bx - 16, y - 23, 33, 2);
      px('#3a3a44', bx - 16, y + 2, 33, 2);
      px('#3a3a44', bx - 16, y - 23, 2, 27);
      px('#3a3a44', bx + 15, y - 23, 2, 27);
      for (const [dx, dy, h] of [[-13, -21, 4], [-9, -21, 2], [6, -21, 5], [12, 0, -3], [-4, 1, -2]]) px('#d8f0ff', bx + dx, y + dy, 2, Math.abs(h));
    }
    px('#8a8a96', x + a * 7, y - 1, 6 * a, 2);
  }
  // rim: back half behind, front half in front
  ctx.fillStyle = '#e05a14';
  for (let i = 0; i < 48; i++) {
    const k = (i / 48) * Math.PI * 2;
    if (Math.sin(k) > 0 !== front) continue;
    const [rx, ry] = rimPt(k);
    px(front ? '#e05a14' : '#a03c0c', rx, ry);
    if (front) px('#ff9a40', rx, ry - 1);
  }
  // net: white cords from the rim down to a narrower hem, crossing each other
  const len = 12 + D.net;
  for (let i = 0; i <= 6; i++) {
    const k = Math.PI - (i / 6) * Math.PI * (front ? -1 : 1);
    const [tx, ty] = rimPt(k);
    const bxp = x + Math.cos(k) * 5, byp = y + len + Math.sin(k) * 1.5;
    ctx.fillStyle = front ? '#f4f4f0' : '#a8a8a0';
    pxLine(ctx, tx, ty + 1, bxp + (i % 2 ? 2 : -2), byp);
  }
}

// ------------------------------------------------------------------ round-one entrance
const entry = new WeakMap<Fighter, { x0: number; ball: number[] | null }>();

/** Dribbles in from the edge, palms the ball, spins it on one finger, then tosses it into the crowd. */
export const SHAQ_INTRO: Intro = {
  line: SHAQ_LINES.intro,
  speech: VOICE,
  speakAt: 80,
  dur: 160,
  update(self, f, t, home) {
    if (t === 0 || !entry.has(self)) entry.set(self, { x0: offscreenX(self, f), ball: null });
    const E = entry.get(self)!;
    if (t <= 60) {
      if (t === 0) self.setAnim(WALK);
      self.poseOverride = null;
      self.x = lerp(E.x0, home, t / 60);
      // the bounce lands every 12 frames
      if (t % 12 === 6) playCue('dribble');
      if (t % 20 === 0) playCue('squeak');
    } else if (t < 72) {
      self.poseOverride = P(CROUCH, { t: 14, af: -80, ef: -30 });
      self.propOverride = ballPart();
    } else if (t < 136) {
      self.propOverride = null;
      self.poseOverride = P(SHAQ_STANCE, { t: 0, h: -12, af: -178, ef: -4, ab: 30, eb: -60 });
      if (t % 10 === 0) f.particles.sparks(self.wx(self.skel.handF[0]), self.wy(self.skel.handF[1]) + 10, 1, '#fff2c0');
    } else if (t === 136) {
      // over the shoulder, into the stands
      const hx = self.wx(self.skel.handF[0]), hy = self.wy(self.skel.handF[1]) + 8;
      E.ball = [hx, hy, -self.facing * 2.4, 4.2];
      self.poseOverride = P(STANCE, { t: -10, h: -10, af: -200, ef: -40, ab: 20, eb: -50 });
      playCue('whoosh');
    } else if (t > 150) self.poseOverride = P(VICTORY, { ab: -160, eb: -20 });
    if (E.ball) {
      E.ball[0] += E.ball[2];
      E.ball[1] += E.ball[3];
      E.ball[3] -= 0.18;
    }
  },
  draw(ctx, self, f, t, cam) {
    const E = entry.get(self);
    if (!E) return;
    let x: number, y: number, rot = t * 0.3, sq = 1;
    if (t <= 60) {
      // dribbling beside the front hand
      const ph = ((t + 6) % 12) / 12;
      x = self.wx(self.skel.handF[0] + 6);
      y = 7 + Math.abs(Math.sin(ph * Math.PI)) * (self.wy(self.skel.handF[1]) - 12);
      if (y < 9) sq = 0.75;
    } else if (t >= 72 && t < 136) {
      // spinning on one fingertip
      x = self.wx(self.skel.handF[0]);
      y = self.wy(self.skel.handF[1]) + 9;
      rot = t * 0.9;
    } else if (E.ball) {
      [x, y] = E.ball;
    } else return;
    ctx.save();
    ctx.translate(Math.round(x - cam), Math.round(FLOOR - y));
    drawBasketball(ctx, rot, sq);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ post-match portrait
/** Jersey number in k-sized pixels. `mirror` paints it back to front, for the loser's flipped portrait. */
const ptDigits = (p: Painter, n: string, x: number, y: number, k: number, c: string, mirror = false) =>
  [...(mirror ? [...n].reverse().join('') : n)].forEach((d, i) => {
    const g = DIGITS[d];
    if (g)
      for (let j = 0; j < 15; j++)
        if (g[j] === '1') p.rect(x + i * 4 * k + (mirror ? 2 - (j % 3) : j % 3) * k, y + Math.floor(j / 3) * k, k, k, c);
  });

export const SHAQ_PORTRAIT: PortraitStyle = {
  skip: { hair: true, beard: true, clothes: true },
  back(p, c) {
    const L = c.look, j = L.jersey!;
    // broad bare shoulders under a tank top
    c.sculpt((m) => m.poly([[-4, 121], [-2, 102], [14, 92], [36, 88], [68, 89], [92, 94], [106, 104], [108, 121]], '#fff'), L.skin, { soft: 7, into: c.skin });
    c.sculpt((m) => m.poly([[20, 121], [26, 100], [38, 92], [53, 106], [68, 92], [80, 100], [86, 121]], '#fff'), j.color, { soft: 4 });
    for (const [x0, y0, x1, y1] of [[26, 100], [38, 92]].map(([x, y], i) => [x, y, i ? 53 : 20, i ? 106 : 121]))
      p.line(x0, y0, x1, y1, j.trim), p.line(x0 + 1, y0, x1 + 1, y1, j.trim);
    for (const [x0, y0, x1, y1] of [[80, 100, 86, 121], [68, 92, 53, 106]]) p.line(x0, y0, x1, y1, j.trim), p.line(x0 - 1, y0, x1 - 1, y1, j.trim);
    ptDigits(p, j.number, 43, 111, 2, j.trim, c.beaten);
  },
  front(p, c) {
    const L = c.look, g = c.geom, hair = L.hair;
    // shine on the shaved scalp
    if (!c.beaten) p.line(44, 22, 56, 20, lighten(L.skin, 0.45)), p.line(46, 23, 52, 22, lighten(L.skin, 0.3));
    // thin mustache running into a short chin beard
    p.poly([[g.mouth[0] - 7, g.mouth[1] - 6], [g.mouth[0] + 8, g.mouth[1] - 7], [g.mouth[0] + 9, g.mouth[1] - 4], [g.mouth[0] - 7, g.mouth[1] - 3]], hair);
    c.sculpt((m) => m.poly([[g.chin[0] - 7, g.chin[1] - 10], [g.chin[0] + 9, g.chin[1] - 11], [g.chin[0] + 6, g.chin[1] + 2], [g.chin[0] - 5, g.chin[1] + 2]], '#fff'), hair, { soft: 2 });
    p.line(g.mouth[0] - 7, g.mouth[1] - 3, g.chin[0] - 7, g.chin[1] - 10, hair);
    if (c.beaten) for (let i = 0; i < 3; i++) p.set(40 + i * 9, 28 + (i % 2) * 3, darken(L.skin, 0.5));
  },
};

// ------------------------------------------------------------------ win-screen taunts
export const SHAQ_QUOTES = [
  'I POSTED YOU UP, {L}. THEN I POSTED YOU DOWN.',
  'YOU CAN NOT STOP WHAT YOU CAN NOT SEE OVER.',
  'FREE THROWS ARE HARD. YOU WERE EASY.',
  'MOVE YOUR FEET, LOSE YOUR SEAT. YOU LOST BOTH.',
];
export const SHAQ_TAUNTS_VS: Record<string, string> = {
  lincoln: 'NICE HAT, MR PRESIDENT. I STILL SEE OVER IT.',
  brucelee: 'GOOD FEET, LITTLE DRAGON. BIGGER IS BETTER.',
  ali: 'YOU FLOAT, CHAMP. I JUST STAND HERE AND YOU BOUNCE OFF.',
};

export function shaqDef(): CharDef {
  return {
    id: 'shaq', name: "Shaquille O'Neal", short: 'SHAQ', title: 'The Big Diesel', look: SHAQ_LOOK, alt: SHAQ_ALT,
    specials: SHAQ_SPECIALS, voice: 80, props: { bball: ballPart() }, scale: SCALE,
    finisher: SHAQ_FINISHER, fatality: rimWrecker, fatalityDraw: drawHoop,
    intro: SHAQ_INTRO, portrait: SHAQ_PORTRAIT, quotes: SHAQ_QUOTES, quotesVs: SHAQ_TAUNTS_VS,
  };
}
