import type { CharDef } from '../../game/fighter';
import type { Look } from '../../chars/build';
import { A, P, STANCE, LAUNCHED, VICTORY } from '../../game/anims';
import type { Move, Special, Finisher } from '../../game/types';
import { Projectile } from '../../game/projectile';
import type { Fight } from '../../game/fight';
import { FLOOR } from '../../core/consts';
import { pxCircle } from '../../gfx/painter';
import { rand } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { say } from '../../audio/sfx';
import { lerp, offscreenX, type Intro } from '../../game/intro';
import type { PortraitStyle } from '../../gfx/portrait';

// Stephen Hawking: a cosmologist riding a jointed, rocket-assisted mech-chair.
// Everything here is self-contained so the shared fight code only needs a couple of hooks.

export const HAWKING_LOOK: Look = {
  skin: '#e8c0a0', hair: '#6a5040', eye: '#3a3020', shirt: '#b8c8e0', coat: '#2e3240', pants: '#3a3a44', boots: '#1a1a20',
  hairStyle: 'short', glasses: '#1a1418',
  chair: { frame: '#5a6274', accent: '#2a3a8a', glow: '#7ae8ff' },
};
export const HAWKING_ALT: Look = {
  ...HAWKING_LOOK, coat: '#4a2a3a', shirt: '#e0d8c0', pants: '#2a2a2a',
  chair: { frame: '#7a6a4a', accent: '#8a2a2a', glow: '#ffd060' },
};

// Original voice lines, spoken through the browser's speech synth like his famous voice computer.
export const HAWKING_LINES = {
  intro: 'Let us test the laws of physics.',
  finisher: 'You have crossed the event horizon.',
};
const VOICE = { pitch: 0.7, rate: 0.85 };

// ------------------------------------------------------------------ sounds
export const hsfx = {
  warp() {
    tone({ type: 'sine', freq: 900, to: 60, dur: 0.6, vol: 0.3 });
    tone({ type: 'triangle', freq: 220, to: 40, dur: 0.7, vol: 0.2 });
    noise({ dur: 0.5, vol: 0.12, type: 'bandpass', freq: 300, to: 1200, q: 3 });
  },
  thrust() {
    noise({ dur: 0.45, vol: 0.3, freq: 600, to: 2400, q: 1, attack: 0.03 });
    tone({ type: 'sawtooth', freq: 60, to: 140, dur: 0.4, vol: 0.1, filter: { type: 'lowpass', freq: 600 } });
  },
  radiate() {
    const c = ac();
    if (!c) return;
    for (let i = 0; i < 4; i++) tone({ type: 'square', freq: 440 * (1 + i * 0.5), to: 1760, dur: 0.12, vol: 0.06, at: c.currentTime + i * 0.04 });
    noise({ dur: 0.35, vol: 0.25, type: 'highpass', freq: 1800, to: 5000 });
  },
  collapse() {
    tone({ type: 'sine', freq: 40, to: 900, dur: 0.5, vol: 0.4 });
    noise({ dur: 0.8, vol: 0.5, freq: 2000, to: 80, attack: 0.01 });
  },
};

// ------------------------------------------------------------------ specials
const hole: Move = {
  id: 'proj_hole',
  anim: A([
    [P(STANCE, { af: -150, ef: -40, ab: -40, t: -4, h: -8 }), 8],
    [P(STANCE, { af: -96, ef: -2, ab: -20, eb: -60, t: 14, h: -4 }), 12],
    [P(STANCE, { af: -90, ef: -10, t: 10 }), 10],
    [STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr < 8) f.particles.add({ kind: 'spark', x: self.wx(self.skel.handF[0]) + rand(-6, 6), y: self.wy(self.skel.handF[1]) + rand(-6, 6), life: 8, max: 8, color: '#a070ff', floor: false });
    if (fr === 10) {
      f.projectiles.push(new Projectile(self, 'hole', self.x + self.facing * 26, 46));
      self.projOut = true;
      hsfx.warp();
    }
  },
};

export const hawkingSpecials: Special[] = [
  { name: 'Singularity', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: hole },
  {
    name: 'Rocket Chair', cmd: [4, 6], btn: 'k', text: 'B, F + K',
    move: {
      id: 'rocketchair',
      anim: A([
        [P(STANCE, { t: -14, h: -6, af: -40, ef: -30, ab: -20, eb: -40, lf: -50, kf: 70, lb: -30, kb: 60 }), 8],
        [P(STANCE, { t: 22, h: 8, af: -70, ef: -10, ab: -50, eb: -20, lf: -60, kf: 80, lb: -40, kb: 70 }), 20],
        [P(STANCE, { t: 10, lf: -30, kf: 40 }), 10],
        [STANCE, 6],
      ]),
      active: [8, 28],
      vx: (fr) => (fr >= 8 && fr < 28 ? 5.2 : fr < 34 ? 1 : 0),
      hit: { limb: 'body', r: 14, dmg: 95, level: 'mid', effect: 'knockdown', push: 2, stun: 20, special: true },
      onFrame: (self, f, fr) => {
        if (fr === 6) hsfx.thrust();
        if (fr >= 6 && fr < 30) {
          const bx = self.x - self.facing * 16;
          f.particles.fire(bx, 22, 2, 2);
          if (fr % 3 === 0) f.particles.smoke(bx - self.facing * 6, 20, 1, '#4a4a58');
        }
      },
    },
  },
  {
    name: 'Hawking Radiation', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P',
    move: {
      id: 'radiation',
      anim: A([
        [P(STANCE, { t: 18, h: 10, af: -40, ef: -100, ab: -40, eb: -100 }), 8],
        [P(STANCE, { t: -12, h: -16, af: -160, ef: -10, ab: -150, eb: -10 }), 14],
        [P(STANCE, { t: -8, h: -10, af: -150, ef: -20, ab: -140, eb: -20 }), 10],
        [STANCE, 10],
      ]),
      active: [8, 20],
      hit: { limb: 'body', r: 30, dmg: 100, level: 'mid', effect: 'launch', push: 1.5, stun: 24, special: true, sfx: 'zap' },
      onFrame: (self, f, fr) => {
        if (fr === 8) hsfx.radiate();
        if (fr >= 8 && fr < 22) {
          const r = 6 + (fr - 8) * 2.4;
          for (let i = 0; i < 10; i++) {
            const a = rand(0, Math.PI * 2);
            f.particles.add({ kind: 'spark', x: self.x + Math.cos(a) * r, y: 44 + Math.sin(a) * r, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6, life: 6, max: 6, color: fr % 2 ? '#fff4c0' : '#ffd040', floor: false });
          }
        }
      },
    },
  },
];

export const HAWKING_FINISHER: Finisher = { name: 'Event Horizon', cmd: [2, 4, 6], btn: 'hp', text: 'D, B, F + HP (any range)', range: [0, 400] };

// ------------------------------------------------------------------ finisher
// A black hole opens behind the loser and stretches them into spaghetti, then
// evaporates and spits out the leftover bones.
export function runHawkingFatality(fight: Fight, tt: number, tick: () => void, done: () => void) {
  const w = fight.winner!, l = fight.loser!;
  const D = fight.fatal!.data;
  const away = l.x >= w.x ? 1 : -1;
  if (tt === 0) {
    D.hx = Math.max(30, Math.min(482, l.x + away * 52));
    D.hy = 50;
    D.r = 0;
  }
  w.poseOverride = tt < 20 ? P(STANCE, { af: -150, ef: -40, t: -4 }) : P(STANCE, { af: -100, ef: -4, ab: -20, eb: -60, t: 12, h: -6 });
  if (tt === 20) hsfx.warp();
  if (tt >= 20 && tt < 175) D.r = Math.min(16, D.r + 0.6);
  if (tt >= 40 && tt < 160) {
    const k = (tt - 40) / 120;
    l.poseOverride = P(LAUNCHED, { rot: -away * k * 540, af: -170 + rand(-20, 20), ab: -150 + rand(-20, 20) });
    l.x += (D.hx - l.x) * (0.01 + k * 0.06);
    l.y += (D.hy - 30 - l.y) * 0.05;
    l.stretch = 1 + k * k * 1.8;
    l.tint = ['#3a1060', k * 0.6];
    if (tt % 3 === 0) fight.particles.blood(l.x, l.y + 40, away, 2, 0.8);
    if (tt === 50) fight.sfx('scream');
    if (tt % 30 === 0) hsfx.warp();
  }
  // everything nearby spirals into the hole
  for (const p of fight.particles.list) {
    if (tt < 20 || tt > 175 || p.kind === 'img') continue;
    const dx = D.hx - p.x, dy = D.hy - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 90) {
      p.vx += (dx / d) * 0.25 - (dy / d) * 0.15;
      p.vy += (dy / d) * 0.25 + (dx / d) * 0.15;
      if (d < 6) p.life = 0;
    }
  }
  if (tt === 160) {
    l.alpha = 0;
    l.stretch = 1;
    fight.shake(8);
    fight.sfx('thud');
  }
  if (tt >= 175) D.r = Math.max(0, D.r - 1);
  if (tt === 190) {
    hsfx.collapse();
    fight.shake(16);
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 4);
      fight.particles.add({ kind: 'spark', x: D.hx, y: D.hy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 24, max: 24, color: i % 3 ? '#fff4c0' : '#a070ff', floor: false });
    }
    fight.spawnParts(l, l.bones, 3, 5);
  }
  if (tt === 215) say(HAWKING_LINES.finisher, VOICE);
  if (tt === 220) {
    w.poseOverride = VICTORY;
  }
  tick();
  if (tt >= 320) done();
}

export function drawHawkingFatality(ctx: CanvasRenderingContext2D, fight: Fight, cam: number) {
  const D = fight.fatal!.data;
  if (!D.r) return;
  const x = Math.round(D.hx - cam), y = FLOOR - D.hy, t = fight.t;
  const r = D.r;
  // accretion disc: two tilted rings of hot matter
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + t * 0.12;
    const rr = r + 4 + (i % 3);
    ctx.fillStyle = i % 4 === 0 ? '#fff4c0' : i % 2 ? '#ff8a20' : '#a050ff';
    ctx.fillRect(Math.round(x + Math.cos(a) * rr * 1.6), Math.round(y + Math.sin(a) * rr * 0.45), 2, 1);
  }
  ctx.fillStyle = '#7a3ad0';
  pxCircle(ctx, x, y, r + 1.5);
  ctx.fillStyle = '#000000';
  pxCircle(ctx, x, y, r);
  // front half of the disc passes in front of the hole
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI + t * 0.12;
    const s = Math.sin(a);
    if (s < 0) continue;
    ctx.fillStyle = i % 2 ? '#ffb040' : '#fff4c0';
    ctx.fillRect(Math.round(x + Math.cos(a) * (r + 4) * 1.6), Math.round(y + s * (r + 4) * 0.45), 2, 1);
  }
}

/** Small swirling black hole used by the Singularity projectile. */
export function drawMiniHole(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.3;
    ctx.fillStyle = i % 3 === 0 ? '#fff4c0' : i % 2 ? '#ff8a20' : '#a050ff';
    ctx.fillRect(Math.round(Math.cos(a) * 9), Math.round(Math.sin(a) * 4), 2, 1);
  }
  ctx.fillStyle = '#7a3ad0';
  pxCircle(ctx, 0, 0, 6);
  ctx.fillStyle = '#000';
  pxCircle(ctx, 0, 0, 4.5);
}

// Post-match taunts. {L} is replaced with the loser's short name.
export const HAWKING_QUOTES = [
  'Gravity always wins, {L}. I simply help it along.',
  'I ran the numbers. You never stood a chance.',
  'The universe tends toward disorder. So did your defense.',
];
export const HAWKING_QUOTES_VS: Record<string, string> = {
  tesla: 'Brilliant ideas, Tesla. Shame about the follow-through.',
};

// ------------------------------------------------------------------ round-one entrance
// Rockets in from off screen on the chair's thrusters, touches down, and runs a quick systems check.
export const HAWKING_INTRO: Intro = {
  line: HAWKING_LINES.intro,
  speech: VOICE,
  speakAt: 70,
  dur: 130,
  update(self, f, t, home) {
    if (t <= 40) {
      const k = t / 40;
      self.x = lerp(offscreenX(self, f), home, k);
      self.y = Math.sin(k * Math.PI) * 40 + (1 - k) * 10;
      self.poseOverride = P(STANCE, { t: 14, h: 4, af: -70, ef: -10, ab: -50, eb: -20, lf: -60, kf: 80, lb: -40, kb: 70 });
      if (t === 0) hsfx.thrust();
      if (t === 20) hsfx.thrust();
      const bx = self.x - self.facing * 16;
      f.particles.fire(bx, self.y + 22, 2, 2);
      if (t % 3 === 0) f.particles.smoke(bx, self.y + 18, 1, '#4a4a58');
    } else {
      self.y = 0;
      if (t === 41) {
        f.sfx('thud');
        f.shake(4);
        f.particles.smoke(self.x, 2, 6, '#6a6470');
      }
      // console flicker, then a raised hand
      self.poseOverride = t < 66 ? P(STANCE, { t: 10, af: -40, ef: -60 }) : P(STANCE, { t: -4, h: -8, af: -160, ef: -30 });
      if (t >= 46 && t < 66 && t % 4 === 0) {
        const a = rand(0, Math.PI * 2);
        f.particles.add({ kind: 'spark', x: self.x + Math.cos(a) * 18, y: 40 + Math.sin(a) * 12, life: 10, max: 10, color: '#7ae8ff', floor: false });
      }
      if (t === 66) hsfx.radiate();
    }
  },
};

// ------------------------------------------------------------------ post-match portrait
export const HAWKING_PORTRAIT: PortraitStyle = {
  front(p, c) {
    // thick-rimmed glasses over both eyes, with a glint
    const fr = c.look.glasses ?? '#1a1418';
    const lens = (x: number, y: number, w: number) => {
      p.rect(x - w, y - 5, w * 2 + 1, 2, fr);
      p.rect(x - w, y + 4, w * 2 + 1, 2, fr);
      p.rect(x - w, y - 5, 2, 11, fr);
      p.rect(x + w - 1, y - 5, 2, 11, fr);
      if (!c.beaten) p.set(x - w + 3, y - 2, '#ffffff');
    };
    const [ax, ay] = c.geom.eyeA, [bx, by] = c.geom.eyeB;
    lens(ax, ay, 7);
    lens(bx, by, 6);
    p.rect(ax + 7, Math.min(ay, by) - 3, bx - 6 - ax - 7, 2, fr);
    p.rect(c.geom.ear[0] + 4, ay - 4, ax - 7 - c.geom.ear[0] - 4, 2, fr);
    if (c.beaten) p.line(bx - 4, by - 3, bx + 3, by + 3, '#e8f4ff');
  },
};

export function hawking(): CharDef {
  return {
    id: 'hawking', name: 'Stephen Hawking', short: 'HAWKING', title: 'Spacetime Bender', look: HAWKING_LOOK, alt: HAWKING_ALT,
    specials: hawkingSpecials, voice: 120, props: {}, finisher: HAWKING_FINISHER, intro: HAWKING_INTRO, portrait: HAWKING_PORTRAIT,
    quotes: HAWKING_QUOTES, quotesVs: HAWKING_QUOTES_VS,
  };
}
