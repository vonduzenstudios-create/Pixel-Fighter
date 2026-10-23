import type { Look } from './build';
import { A, P, STANCE, CROUCH, HIT_HIGH, HIT_MID, DIZZY } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import type { Particle } from '../game/particles';
import { Projectile } from '../game/projectile';
import { Painter } from '../gfx/painter';
import type { Part } from '../gfx/rig';
import { PW, type PortraitStyle } from '../gfx/portrait';
import { rand } from '../core/rng';
import { sfx, say } from '../audio/sfx';
import { playCue } from '../audio/specials';
import type { Intro } from '../game/intro';

// David Blaine: an original pixel caricature of the deadpan street magician and endurance
// stuntman. Close-cropped hair, stubble, black tee. Fights with playing cards, levitation
// and the ice block he can stand inside for days. All lines are original.

const LOOK: Look = {
  skin: '#e2b48e', hair: '#16121a', eye: '#2a2018', shirt: '#1a1a20', pants: '#2c3448', boots: '#121014',
  hairStyle: 'short', stubble: '#4a3830', rolledSleeves: true, belt: '#0e0c10', buckle: '#8a8a94',
};
const ALT: Look = { ...LOOK, shirt: '#e8e6e0', pants: '#4a4a54', boots: '#3a2a20', belt: '#2a1a12' };

export const BLAINE_LINES = {
  intro: "Watch closely. You won't see how this ends.",
  finisher: 'And that... was your card.',
};
const VOICE = { pitch: 0.85, rate: 0.85 };

// ------------------------------------------------------------------ sprites
const ICE = '#bfe8ff';
const SUITS = ['#d01828', '#141018'];

function cardImg(back: boolean): HTMLCanvasElement {
  const p = new Painter(7, 10);
  p.rect(0, 0, 7, 10, '#101018');
  if (back) {
    p.rect(1, 1, 5, 8, '#b01828');
    for (let y = 1; y < 9; y++) p.set(1 + ((y + 1) % 5), y, '#f0d8d8');
  } else {
    p.rect(1, 1, 5, 8, '#f8f6f0');
    p.set(2, 4, SUITS[0]), p.set(4, 4, SUITS[0]);
    p.rect(2, 5, 3, 1, SUITS[0]);
    p.set(3, 6, SUITS[0]);
    p.set(1, 1, SUITS[0]);
    p.set(5, 8, SUITS[0]);
  }
  return p.canvas();
}

/** A translucent block of ice that stands over a fighter, bottom-centred. */
function iceImg(): HTMLCanvasElement {
  const w = 38, h = 86;
  const p = new Painter(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
      const streak = (x + y * 2) % 23 < 2 && x > 4 && x < w - 6;
      if (edge) p.set(x, y, '#e8f8ff', 230);
      else if (streak) p.set(x, y, '#ffffff', 150);
      else p.set(x, y, (x * 7 + y * 3) % 11 < 5 ? '#9ad4f4' : '#bfe8ff', 95);
    }
  // frosted top and a few trapped bubbles
  for (let x = 2; x < w - 2; x++) p.set(x, 2 + (x % 3 === 0 ? 1 : 0), '#ffffff', 220);
  for (const [x, y] of [[9, 20], [27, 34], [14, 60], [24, 70], [30, 12]]) p.set(x, y, '#ffffff', 200);
  return p.canvas();
}

let IMG: { face: HTMLCanvasElement; back: HTMLCanvasElement; ice: HTMLCanvasElement } | null = null;
const img = () => (IMG ??= { face: cardImg(false), back: cardImg(true), ice: iceImg() });

/** A single card pinched between the fingers, for the reveal. */
function cardProp(): Part {
  const p = new Painter(9, 14);
  p.rect(1, 2, 7, 10, '#101018');
  p.rect(2, 3, 5, 8, '#f8f6f0');
  p.set(3, 6, SUITS[0]), p.set(5, 6, SUITS[0]);
  p.rect(3, 7, 3, 1, SUITS[0]);
  p.set(4, 8, SUITS[0]);
  return { img: p.canvas(), px: 4, py: 1 };
}

/** Spinning card projectile: flips between face and back as it turns. */
export function drawCard(ctx: CanvasRenderingContext2D, t: number) {
  const s = Math.cos(t * 0.7);
  ctx.scale(Math.max(0.2, Math.abs(s)), 1);
  ctx.rotate(Math.sin(t * 0.35) * 0.4);
  ctx.drawImage(s > 0 ? img().face : img().back, -3, -5);
}

// ------------------------------------------------------------------ effects
const overlays = new WeakMap<Fighter, Particle>();

/** Keep the ice block standing over the fighter; it melts away a few frames after this stops being called. */
function holdIce(self: Fighter, f: Fight) {
  let o = overlays.get(self);
  if (!o || o.life <= 0 || !f.particles.list.includes(o)) {
    f.particles.add({ kind: 'img', img: img().ice, ix: 19, iy: 84, x: self.x, y: 0, grav: 0, floor: false, life: 3, max: 3 });
    o = f.particles.list[f.particles.list.length - 1];
    overlays.set(self, o);
  }
  o.x = self.x;
  o.life = 3;
  if (Math.random() < 0.3) f.particles.add({ kind: 'smoke', x: self.x + rand(-18, 18), y: rand(2, 10), vx: rand(-0.3, 0.3), vy: 0.2, life: 24, max: 24, color: '#e0f4ff', size: 2, floor: false });
}

/** Burst the ice: shards and frost fly out from the block. */
function shatterIce(self: Fighter, f: Fight, force = 1) {
  const o = overlays.get(self);
  if (o) o.life = 0;
  overlays.delete(self);
  for (let i = 0; i < 34; i++)
    f.particles.add({
      kind: 'spark', x: self.x + rand(-16, 16), y: rand(4, 82), vx: rand(-2.4, 2.4) * force, vy: rand(0.5, 3) * force,
      life: rand(20, 40), max: 40, color: i % 3 ? ICE : '#ffffff', size: i % 4 ? 1 : 2, grav: 0.16, floor: true,
    });
  for (let i = 0; i < 8; i++) f.particles.smoke(self.x + rand(-14, 14), rand(10, 70), 1, '#e8f6ff');
}

/** A card flicked off the fingertips as a flourish. */
function flourish(f: Fight, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'img', img: Math.random() < 0.5 ? img().face : img().back, ix: 3, iy: 5, x, y, vx: rand(-1.2, 1.2), vy: rand(1, 2.6), rot: 0, vrot: rand(-0.3, 0.3), grav: 0.12, life: 70, max: 70, floor: true, bounce: 0.1 });
}

const handF = (s: Fighter) => ({ x: s.wx(s.skel.handF[0]), y: s.wy(s.skel.handF[1]) });

// ------------------------------------------------------------------ poses
/** Arms folded tight across the chest, chin down: holding still inside the ice. */
const FROZEN = P(STANCE, { t: 2, h: 8, af: -40, ef: -150, ab: -30, eb: -155, lf: -8, kf: 8, lb: 8, kb: 4 });
/** Hovering: legs hanging loose, toes pointed, arms drifting out to the sides. */
const FLOAT = P(STANCE, { t: 0, h: -4, af: -30, ef: -20, ab: 30, eb: -20, lf: -4, kf: 12, ff: 40, lb: 8, kb: 18, fb: 40 });
const FLOAT2 = P(FLOAT, { af: -42, ab: 40, h: -8, kf: 18, kb: 12 });
/** Dropping heel-first out of the levitation. */
const STOMP = P(STANCE, { t: 12, h: 6, af: -150, ef: -20, ab: -140, eb: -20, lf: -64, kf: 8, ff: 10, lb: -30, kb: 60 });
/** Deck held out, about to fan. */
const DECK = P(STANCE, { t: 6, h: -2, af: -84, ef: -30, ab: -40, eb: -110 });

// ------------------------------------------------------------------ specials
const pickACard: Move = {
  id: 'proj_card',
  anim: A([
    [P(STANCE, { af: 40, ef: -120, ab: -40, eb: -100, t: -4, h: -4 }), 7],
    [P(STANCE, { af: -96, ef: -2, ab: -30, eb: -110, t: 18, h: -6, lf: -36, kf: 36, lb: 24, kb: 8 }), 9],
    [P(STANCE, { af: -88, ef: -12, t: 12 }), 10],
    [STANCE, 6],
  ]),
  sounds: { frames: { 1: 'cardRiffle', 8: 'cardFlick' } },
  onFrame: (self, f, fr) => {
    if (fr === 9) {
      f.projectiles.push(new Projectile(self, 'card', self.x + self.facing * 22, 56));
      self.projOut = true;
    }
  },
};

const RISE = 30;
const levitation: Move = {
  id: 'levitate', air: true,
  anim: A([
    [P(STANCE, { t: 4, af: -20, ab: 20 }), 6],
    [FLOAT, 12], [FLOAT2, 12],
    [P(STANCE, { t: -6, h: -10, af: -160, ef: -20, ab: -150, eb: -20, lf: -40, kf: 70, lb: -20, kb: 60 }), 4],
    [STOMP, 40],
  ]),
  active: [RISE + 4, 90],
  hit: { limb: 'toeF', r: 9, dmg: 100, level: 'overhead', effect: 'knockdown', push: 2, stun: 22, special: true, sfx: 'heavy' },
  sounds: { frames: { 1: 'levitate', [RISE]: 'inhale', [RISE + 4]: 'whoosh' }, impact: ['boneCrack', 'stomp'] },
  onFrame: (self, f, fr) => {
    if (fr < RISE) {
      // hold the hover height directly; the fight's gravity is cancelled each frame
      const k = fr / RISE;
      const target = 38 * k * k * (3 - 2 * k) + Math.sin(fr * 0.3) * 1.2;
      self.vy = target - self.y;
      self.vx = 0.5 * self.moveDir;
      if (fr % 3 === 0) f.particles.add({ kind: 'spark', x: self.x + rand(-8, 8), y: self.y + rand(-2, 2), vy: -0.4, life: 14, max: 14, color: fr % 2 ? '#ffffff' : '#d8c8ff', floor: false });
      if (fr === RISE / 2) playCue('levitate');
    } else if (fr < RISE + 4) {
      self.vy = 0.3;
      self.vx = 0;
    } else if (fr === RISE + 4) {
      self.vy = -1.5;
      self.vx = 2.8 * self.moveDir;
    }
  },
};

const ICE_FROM = 4, ICE_TO = 48;
const iceBurst: Move = {
  id: 'iceburst',
  anim: A([
    [P(STANCE, { t: -8, h: -10, af: -140, ef: -10, ab: -120, eb: -10, lf: -30, kf: 30, lb: 26, kb: 6 }), 4],
    [P(STANCE, { t: -10, h: -12, af: -120, ef: -4, ab: -100, eb: -4, lf: -30, kf: 30, lb: 26, kb: 6 }), 12],
    [STANCE, 10],
  ]),
  active: [0, 10],
  hit: { limb: 'body', r: 34, dmg: 105, level: 'mid', effect: 'launch', push: 2, stun: 26, special: true },
  sounds: { frames: { 0: ['iceShatter', 'iceCrack'] }, impact: ['iceShatter', 'boneCrack'], blocked: 'iceCrack' },
  onFrame: (self, f, fr) => {
    if (fr === 0) {
      shatterIce(self, f, 1.4);
      f.shake(6);
    }
  },
};

const iceBlock: Move = {
  id: 'iceblock',
  anim: A([
    [FROZEN, ICE_FROM],
    [FROZEN, 22],
    [P(FROZEN, { h: 10, t: 4 }), ICE_TO - ICE_FROM - 22],
    [P(STANCE, { t: -4, h: -6, af: -70, ab: -50 }), 10],
    [STANCE, 6],
  ]),
  counter: { from: ICE_FROM, to: ICE_TO, move: iceBurst },
  sounds: { frames: { 0: 'freeze', 24: 'iceCrack' } },
  onFrame: (self, f, fr) => {
    if (fr >= ICE_FROM && fr < ICE_TO) holdIce(self, f);
    if (fr === ICE_TO) {
      shatterIce(self, f, 0.5);
      playCue('iceCrack');
    }
  },
};

const specials: Special[] = [
  { name: 'Pick a Card', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: pickACard },
  { name: 'Levitation Drop', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K', move: levitation },
  { name: 'Ice Block', cmd: [2, 5, 2], btn: 'hp', text: 'D, D + HP (counter)', move: iceBlock },
];

// ------------------------------------------------------------------ finisher
// Fifty-Two Pickup: the whole deck leaves his hand, circles the loser like a swarm of razors,
// tightens, and bursts outward with everything it cut loose. He holds up the last card.
interface Orbit { p: Particle; a: number; h: number; s: number }
let CARD: Part | null = null;

function blaineFatality(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  if (tt === 0) {
    D.dir = l.x >= w.x ? 1 : -1;
    D.cards = [] as Orbit[];
  }
  const cards: Orbit[] = D.cards;
  if (tt < 24) {
    w.x += (l.x - D.dir * 52 - w.x) * 0.15;
    w.poseOverride = DECK;
    l.poseOverride = DIZZY;
  }
  if (tt === 20) playCue('cardRiffle');
  if (tt >= 24 && tt < 56 && cards.length < 32) {
    // deal the deck out, two cards a frame
    const h = handF(w);
    for (let i = 0; i < 2; i++) {
      ps.add({ kind: 'img', img: i ? img().back : img().face, ix: 3, iy: 5, x: h.x, y: h.y, rot: 0, grav: 0, floor: false, life: 9999, max: 9999 });
      cards.push({ p: ps.list[ps.list.length - 1], a: rand(0, Math.PI * 2), h: rand(8, 82), s: rand(0.12, 0.2) * (i ? 1 : -1) });
    }
    if (tt % 4 === 0) playCue('cardFlick');
    w.poseOverride = P(DECK, { af: tt % 6 < 3 ? -96 : -76, ef: -10 });
  }
  if (tt >= 24 && tt < 150) {
    const k = Math.min(1, (tt - 24) / 30);
    const r = 34 - Math.max(0, tt - 60) * 0.16;
    for (const c of cards) {
      c.a += c.s;
      const tx = l.x + Math.cos(c.a) * r, ty = c.h + Math.sin(c.a * 2) * 4;
      c.p.x += (tx - c.p.x) * (0.08 + k * 0.5);
      c.p.y += (ty - c.p.y) * (0.08 + k * 0.5);
      c.p.rot = c.a * 2;
    }
    if (tt >= 56) w.poseOverride = P(STANCE, { t: 2, h: 4, af: -100 + Math.sin(tt * 0.3) * 20, ef: -40, ab: -40, eb: -100 });
  }
  if (tt >= 60 && tt < 150) {
    // the cards start to bite
    l.poseOverride = P(tt % 12 < 6 ? HIT_HIGH : HIT_MID, { af: rand(-170, 20), ab: rand(-170, 20), h: rand(-20, 20) });
    l.shake = 2;
    if (tt % 5 === 0) {
      const y = rand(14, 80), dx = rand(-1, 1);
      ps.blood(l.x + dx * 8, y, Math.sign(dx) || 1, 6, 1.2);
      playCue('cardSlice');
    }
    if (tt === 70) sfx.scream();
    if (tt % 20 === 0) sfx.blood();
  }
  if (tt === 150) {
    // the swarm explodes outward and takes him apart
    for (const c of cards) {
      const a = Math.atan2(c.p.y - 44, c.p.x - l.x);
      c.p.vx = Math.cos(a) * rand(2, 4);
      c.p.vy = Math.sin(a) * rand(1, 3) + 1.5;
      c.p.grav = 0.08;
      c.p.vrot = rand(-0.4, 0.4);
      c.p.floor = true;
      c.p.bounce = 0.1;
      c.p.life = c.p.max = 260;
    }
    fight.spawnParts(l, l.parts, 3.2, 4.5);
    l.alpha = 0;
    ps.blood(l.x, 50, 1, 60, 2);
    ps.blood(l.x, 50, -1, 60, 2);
    ps.mist(l.x, 50, D.dir, 20);
    fight.shake(14);
    sfx.blood();
    sfx.slash();
    playCue('cardSlice');
  }
  if (tt === 150) w.poseOverride = P(STANCE, { t: -4, h: -2, af: -60, ef: -95 });
  if (tt === 185) {
    // the reveal
    w.propOverride = CARD ??= cardProp();
    w.poseOverride = P(STANCE, { t: -2, h: -4, af: -150, ef: -40, ab: -30, eb: -100 });
    const h = handF(w);
    ps.sparks(h.x, h.y, 10, '#ffffff');
    sfx.sparkle();
  }
  if (tt === 195) say(BLAINE_LINES.finisher, VOICE);
  return tt >= 320;
}

// ------------------------------------------------------------------ round-one entrance
// Already standing in the ice when the round opens. It cracks, bursts, he shakes off the frost
// and flicks a card into the air.
export const BLAINE_INTRO: Intro = {
  line: BLAINE_LINES.intro,
  speech: VOICE,
  speakAt: 92,
  dur: 150,
  update(self, f, t, home) {
    self.x = home;
    if (t < 58) {
      self.poseOverride = P(FROZEN, { h: 8 + (t > 30 ? Math.sin(t * 1.3) * 2 : 0) });
      holdIce(self, f);
      if (t === 0) playCue('freeze');
      if (t === 22 || t === 40 || t === 50) {
        playCue('iceCrack');
        f.particles.sparks(self.x + rand(-14, 14), rand(20, 70), 4, ICE);
      }
    } else if (t === 58) {
      shatterIce(self, f, 1.2);
      playCue(['iceShatter', 'iceCrack']);
      f.shake(5);
      self.poseOverride = P(STANCE, { t: -8, h: -10, af: -140, ef: -10, ab: -120, eb: -10 });
    } else if (t < 84) {
      // shrug off the cold: shoulders roll, breath steams
      self.poseOverride = P(STANCE, { t: 6, h: 4 + Math.sin(t * 0.8) * 4, af: -60 + Math.sin(t * 0.9) * 10, ef: -100, ab: -40, eb: -110 });
      if (t % 8 === 0) {
        const n = self.wx(self.skel.neck[0]) + self.facing * 6;
        f.particles.smoke(n, self.wy(self.skel.neck[1]) + 6, 1, '#f0f8ff');
      }
    } else if (t < 120) {
      self.poseOverride = P(STANCE, { t: 2, h: -4, af: -150, ef: -30, ab: -40, eb: -100 });
      if (t === 86) {
        const h = handF(self);
        flourish(f, h.x, h.y, 3);
        playCue('cardRiffle');
      }
    } else self.poseOverride = DECK;
  },
};

// ------------------------------------------------------------------ post-match portrait
const PORTRAIT: PortraitStyle = {
  front(p, c) {
    // five o'clock shadow over the jaw and lip, dithered into the skin
    const g = c.geom;
    const sh = c.look.stubble ?? '#4a3830';
    for (let y = g.mouth[1] - 7; y <= g.chin[1] + 3; y++)
      for (let x = g.ear[0] + 10; x <= g.noseTip[0] + 2; x++) {
        if (!c.skin[y * PW + x] || (x + y) % 2) continue;
        const nearJaw = y > g.mouth[1] + 2 || (y < g.mouth[1] - 1 && x > g.mouth[0] - 10);
        if (nearJaw && (x * 7 + y * 13) % 5 < 3) p.set(x, y, sh);
      }
    if (!c.beaten) {
      // the card he just pulled, held up by the chin
      const x0 = 82, y0 = 78;
      p.rect(x0, y0, 15, 21, '#101018');
      p.rect(x0 + 1, y0 + 1, 13, 19, '#f8f6f0');
      p.rect(x0 + 4, y0 + 7, 3, 3, SUITS[0]);
      p.rect(x0 + 8, y0 + 7, 3, 3, SUITS[0]);
      p.rect(x0 + 5, y0 + 10, 5, 2, SUITS[0]);
      p.rect(x0 + 6, y0 + 12, 3, 2, SUITS[0]);
      p.set(x0 + 2, y0 + 2, SUITS[0]);
      p.set(x0 + 12, y0 + 18, SUITS[0]);
      p.rect(x0 - 3, y0 + 14, 5, 7, c.look.skin);
      p.rect(x0 - 3, y0 + 14, 5, 1, '#100810');
    }
  },
};

export function blaine(): CharDef {
  return {
    id: 'blaine', name: 'David Blaine', short: 'BLAINE', title: 'The Street Illusionist', look: LOOK, alt: ALT,
    specials, voice: 120, props: {}, intro: BLAINE_INTRO, portrait: PORTRAIT,
    finisher: { name: 'Fifty-Two Pickup', cmd: [4, 6, 2], btn: 'lp', text: 'B, F, D + LP (close)', range: [0, 90] },
    fatality: blaineFatality,
    quotes: [
      'PICK A CARD, {L}. ANY CARD. THEY ALL SAY YOU LOST.',
      'I STOOD IN ICE FOR THREE DAYS. YOUR PUNCHES WERE NOT EVEN COLD.',
      'THE REAL TRICK WAS MAKING YOUR DEFENSE DISAPPEAR.',
      'I HELD MY BREATH LONGER THAN YOU HELD YOUR GUARD.',
    ],
    quotesVs: {
      tesla: 'I HAVE STOOD INSIDE A MILLION VOLTS. YOUR LITTLE COIL TICKLES.',
      hawking: 'I MADE GRAVITY DISAPPEAR TOO, PROFESSOR. NO MATH REQUIRED.',
      bobross: 'NO ACCIDENT THERE. I PLANNED EVERY BIT OF IT.',
    },
  };
}
