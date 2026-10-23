import type { Look, LookPainters } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, DIZZY, VICTORY, FALL } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import type { Part, Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { Color, darken, lighten } from '../../gfx/palette';
import { rand } from '../../core/rng';
import { say, sfx } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { lerp, type Intro } from '../../game/intro';
import { FLOOR } from '../../core/consts';

// Allison Wonderland: an original fighter inspired by the 1865 Lewis Carroll book (public domain).
// Her look is her own, not any film's: a crimson pinafore dress with a chessboard sash, white
// pantalettes, black-and-white striped stockings, copper-gold waves and a big crimson bow. She
// fights with a growth potion, a rabbit hole and a deck of marching card guards. Every line is original.

const OUT = '#100810';
const CRIMSON = '#b01830';
const LACE = '#f4ece0';

/** Colours the overlays need beyond the Look: dress, bow, sash squares and stocking stripes. */
function trim(L: Look) {
  const alt = L.shirt !== CRIMSON;
  return {
    dress: L.shirt,
    bow: alt ? '#3a8a40' : CRIMSON,
    sashA: '#141018',
    sashB: alt ? '#90d070' : '#f0ece4',
    stripe: alt ? '#3a8a40' : '#141018',
    buckle: '#e8c050',
  };
}

// ------------------------------------------------------------------ outfit painting

/** Paint a shape only where the part is still empty (hair behind the head). */
function under(p: Painter, draw: (m: Painter) => void) {
  const m = new Painter(p.w, p.h);
  draw(m);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (m.alpha(x, y) && !p.alpha(x, y)) p.set(x, y, m.get(x, y));
}

/** Her dress, sleeves, stockings, waves and bow, painted onto the generic builder's parts (Look.paint). */
const PAINT: LookPainters = {
  torso(t, L) {
    // a bell skirt from the waist to above the knee, chessboard sash and a lace hem
    const c = trim(L), dressD = darken(c.dress, 0.25), dressL = lighten(c.dress, 0.2);
    t.poly([[5.5, 21], [21, 21], [25.5, 39], [22, 41], [4, 41], [0.5, 39]], c.dress);
    for (const x of [5, 9, 13, 17, 21]) t.line(x + 1, 25, x - 0.5 + (x - 13) * 0.25, 39, dressD); // pleats
    t.line(6, 22, 3, 37, dressL);
    t.rect(1, 39, 24, 2, LACE);
    for (let x = 1; x < 25; x += 3) t.set(x, 41, LACE); // scalloped lace
    for (let x = 6; x < 21; x += 2) for (let y = 21; y < 24; y++) t.set(x + ((y - 21) % 2), y, ((x >> 1) + y) % 2 ? c.sashA : c.sashB);
    t.ellipse(8, 22.5, 2.5, 2, c.bow); // sash bow at the back
    t.set(19, 13, c.buckle); // pocket-watch chain glint
    t.line(19, 14, 16, 20, darken(c.buckle, 0.2));
  },
  head(h, L) {
    // copper waves down past the shoulders and a big bow on top
    const c = trim(L);
    under(h, (m) => {
      m.poly([[1, 25], [8, 22], [9.5, 34], [8, 43], [4, 44], [0, 40], [1, 33]], L.hair);
      m.ellipse(3, 40, 2.5, 3, L.hair);
    });
    const hl = lighten(L.hair, 0.3), hd = darken(L.hair, 0.25);
    for (const [x, y] of [[2, 28], [3, 32], [2, 36], [4, 40], [6, 30], [6, 35]]) h.set(x, y, (x + y) % 3 ? hl : hd);
    h.poly([[11, 22], [17.5, 23.5], [17, 26], [13, 25]], L.hair); // side-swept fringe
    h.line(7, 21, 13, 21, hl);
    h.ellipse(7, 19.5, 3.2, 2.4, c.bow);
    h.ellipse(13, 19, 3.2, 2.4, c.bow);
    h.ellipse(10, 20.5, 1.6, 1.6, darken(c.bow, 0.25));
    h.set(6, 19, lighten(c.bow, 0.35));
    h.set(12, 18, lighten(c.bow, 0.35));
  },
  upperArm(ua, L) {
    // a puffed lace cap sleeve over a bare arm
    ua.capsule(6, 6, 4, 6, 15, 3.4, L.skin);
    ua.ellipse(6, 5, 5.5, 5, LACE);
    ua.line(1, 9, 11, 9, trim(L).dress);
    ua.line(3, 3, 5, 1, '#ffffff');
  },
  foreArm(fa, L) {
    // bare forearm and hand
    for (let y = 0; y < fa.h; y++) for (let x = 0; x < fa.w; x++) if (fa.alpha(x, y)) fa.set(x, y, OUT, 0);
    fa.capsule(6, 3, 3.6, 6, 12, 3.1, L.skin);
    fa.line(4, 4, 4, 11, darken(L.skin, 0.15));
    fa.ellipse(6, 16, 3.6, 3.6, L.skin);
    fa.line(4, 18, 8, 18, darken(L.skin, 0.3));
  },
  thigh(th, L) {
    // white pantalettes with a swinging panel of the skirt over the top
    const c = trim(L);
    th.poly([[0, 0], [14, 0], [14, 11], [7, 12.5], [0, 11]], c.dress);
    th.line(2, 2, 1, 10, lighten(c.dress, 0.2));
    th.line(10, 2, 11, 10, darken(c.dress, 0.25));
    th.line(0, 11, 14, 11, LACE);
    th.line(1, 19, 13, 19, darken(LACE, 0.15)); // pantalette frill at the knee
  },
  shin(sh, L) {
    // striped stockings
    const c = trim(L);
    for (let y = 3; y < 16; y += 3) sh.line(0, y, 12, y + 0.5, c.stripe, true), sh.line(0, y + 1, 12, y + 1.5, c.stripe, true);
    sh.rect(2, 16, 8, 1, c.stripe);
  },
  foot(ft, L) {
    // buckled Mary Janes
    ft.line(4, 1, 7, 3, '#2a2028');
    ft.set(6, 2, trim(L).buckle);
    ft.line(2, 2, 6, 2, lighten(L.boots, 0.3));
  },
};

export const ALLISON_LOOK: Look = {
  skin: '#f4d0b0', hair: '#e0a040', eye: '#2a6a50', shirt: CRIMSON, pants: LACE, boots: '#1a1018',
  hairStyle: 'long', freckles: '#d89a78', lips: '#c0505a', paint: PAINT,
};
/** Palette swap for mirror matches: a violet dress with a grass-green sash and chestnut hair. */
export const ALLISON_ALT: Look = { ...ALLISON_LOOK, shirt: '#5a2a8a', hair: '#7a4020', eye: '#5a3a20' };

// ------------------------------------------------------------------ props and sprites

/** A little glass potion bottle with a paper tag on a string, gripped by the neck. */
export function potionBottle(): Part {
  const p = new Painter(10, 17);
  p.rect(3, 0, 4, 2, '#b88a50'); // cork
  p.rect(3.5, 2, 3, 3, '#9ad0e0');
  p.ellipse(5, 10.5, 4.5, 5.5, '#9ad0e0');
  p.ellipse(5, 12, 3.6, 3.8, '#c03070'); // the potion
  p.set(3, 8, '#ffffff');
  p.set(3, 9, '#e8f8ff');
  p.shade(0.15);
  p.rect(6, 6, 4, 3, '#f0e4c0'); // tag
  p.set(7, 7, '#5a3020');
  p.set(8, 7, '#5a3020');
  p.outline(OUT);
  return { img: p.canvas(), px: 5, py: 3 };
}

/** Teacup on its saucer, held upright on the palm. */
function teacup(): Part {
  const p = new Painter(14, 10);
  p.rect(0, 7, 14, 2, '#f4f0e8'); // saucer
  p.poly([[2, 1], [11, 1], [10, 6], [3, 6]], '#f4f0e8');
  p.rect(2, 1, 9, 1, '#3a6ab8'); // blue rim
  p.rect(4, 3, 5, 1, '#3a6ab8');
  p.ellipse(12, 3.5, 1.8, 1.8, '#f4f0e8');
  p.set(12, 3, OUT);
  p.rect(3, 0, 7, 1, '#8a4a20'); // tea
  p.shade(0.12);
  p.outline(OUT);
  return { img: p.canvas(), px: 7, py: 11 };
}

const SUITS: [string, Color][] = [['heart', '#c81828'], ['spade', '#141018'], ['diamond', '#c81828'], ['club', '#141018']];

function pip(p: Painter, kind: string, cx: number, cy: number, s: number, c: Color) {
  if (kind === 'heart') {
    p.ellipse(cx - s * 0.5, cy - s * 0.3, s * 0.6, s * 0.6, c);
    p.ellipse(cx + s * 0.5, cy - s * 0.3, s * 0.6, s * 0.6, c);
    p.poly([[cx - s * 1.1, cy - s * 0.1], [cx + s * 1.1, cy - s * 0.1], [cx, cy + s * 1.1]], c);
  } else if (kind === 'spade') {
    p.ellipse(cx - s * 0.5, cy + s * 0.25, s * 0.6, s * 0.6, c);
    p.ellipse(cx + s * 0.5, cy + s * 0.25, s * 0.6, s * 0.6, c);
    p.poly([[cx - s * 1.1, cy + s * 0.1], [cx + s * 1.1, cy + s * 0.1], [cx, cy - s * 1.1]], c);
    p.poly([[cx, cy + s * 0.4], [cx - s * 0.5, cy + s * 1.2], [cx + s * 0.5, cy + s * 1.2]], c);
  } else if (kind === 'diamond') {
    p.poly([[cx, cy - s], [cx + s * 0.75, cy], [cx, cy + s], [cx - s * 0.75, cy]], c);
  } else {
    for (const [dx, dy] of [[0, -0.55], [-0.6, 0.25], [0.6, 0.25]]) p.ellipse(cx + dx * s, cy + dy * s, s * 0.5, s * 0.5, c);
    p.rect(cx - 0.5, cy, 1.5, s * 1.1, c);
  }
}

/** A playing-card guard marching to the right with a halberd levelled: two walking frames. */
function cardGuard(suit: number, step: number): HTMLCanvasElement {
  const p = new Painter(30, 32);
  const [kind, col] = SUITS[suit % SUITS.length];
  // legs and feet (behind the card)
  const a = step ? 2 : -2;
  p.line(9, 22, 9 - a, 30, OUT);
  p.line(14, 22, 14 + a, 30, OUT);
  p.rect(8 - a, 30, 4, 2, OUT);
  p.rect(13 + a, 30, 4, 2, OUT);
  // the halberd: a long shaft with an axe head
  p.line(4, 15, 29, 13, '#7a4a20');
  p.poly([[24, 9], [29, 11], [29, 15], [25, 17], [26, 13]], '#c8ccd8');
  p.set(28, 12, '#ffffff');
  // card body
  p.rect(3, 6, 15, 18, '#f4f0e4');
  p.rect(3, 6, 15, 1, darken('#f4f0e4', 0.15));
  pip(p, kind, 10.5, 15, 3.6, col);
  pip(p, kind, 6, 9.5, 1.3, col);
  pip(p, kind, 15, 20.5, 1.3, col);
  // head poking out of the top with a little crown band
  p.ellipse(10.5, 3.5, 3.4, 3.4, '#f0c8a0');
  p.rect(7, 0, 7, 2, col === '#141018' ? '#3a3a48' : '#e8c050');
  p.set(13, 3, OUT);
  // hand on the shaft
  p.ellipse(18.5, 14, 1.6, 1.6, '#f0c8a0');
  p.outline(OUT);
  return p.canvas();
}

/** The Ace of Spades, sharpened along its bottom edge like a guillotine blade. */
function aceBlade(): HTMLCanvasElement {
  const p = new Painter(36, 50);
  p.rect(1, 1, 34, 42, '#f4f0e4');
  pip(p, 'spade', 18, 20, 10, '#141018');
  p.ellipse(18, 20, 2, 2, '#f4f0e4');
  pip(p, 'spade', 6, 6, 2, '#141018');
  p.rect(4, 9, 1, 3, '#141018');
  pip(p, 'spade', 30, 37, 2, '#141018');
  // the steel edge
  p.poly([[1, 42], [35, 42], [35, 46], [18, 49], [1, 46]], '#b8bcc8');
  p.line(1, 43, 35, 43, '#e8ecf4');
  p.line(3, 46, 33, 46, '#ffffff');
  p.shade(0.1);
  p.outline(OUT);
  return p.canvas();
}

/** A rabbit hole in the floor: dark mouth with a lip of turned-up earth. */
function holeSprite(): HTMLCanvasElement {
  const p = new Painter(32, 9);
  p.ellipse(16, 4.5, 15, 4.2, '#6a4a28');
  p.ellipse(16, 4.5, 12.5, 3, '#080408');
  p.line(5, 2, 10, 1, '#8a6a40');
  p.line(22, 1, 27, 2, '#8a6a40');
  p.outline(OUT);
  return p.canvas();
}

/** Falling bric-a-brac for the entrance: a pocket watch, a teacup and a playing card. */
function trinkets(): HTMLCanvasElement[] {
  const watch = new Painter(9, 11);
  watch.rect(4, 0, 1, 2, '#c8a040');
  watch.ellipse(4.5, 6, 4, 4, '#e8c050');
  watch.ellipse(4.5, 6, 3, 3, '#f8f4e8');
  watch.line(4, 6, 4, 4, OUT);
  watch.line(4, 6, 6, 6, OUT);
  watch.outline(OUT);
  const cup = new Painter(9, 7);
  cup.poly([[0, 0], [7, 0], [6, 5], [1, 5]], '#f4f0e8');
  cup.rect(0, 0, 7, 1, '#3a6ab8');
  cup.ellipse(8, 2, 1.2, 1.5, '#f4f0e8');
  cup.outline(OUT);
  const card = new Painter(8, 11);
  card.rect(0, 0, 8, 11, '#f4f0e4');
  pip(card, 'heart', 4, 5, 2, '#c81828');
  card.outline(OUT);
  return [watch.canvas(), cup.canvas(), card.canvas()];
}

const makeSprites = () => ({
  guards: SUITS.map((_, s) => [cardGuard(s, 0), cardGuard(s, 1)]),
  ace: aceBlade(),
  hole: holeSprite(),
  trinkets: trinkets(),
  cup: teacup(),
});
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

function hole(f: Fight, x: number, life = 34) {
  f.particles.add({ kind: 'img', img: spr().hole, ix: 16, iy: 4, x, y: 0, vx: 0, vy: 0, grav: 0, life, max: life, floor: false, rot: 0, vrot: 0 });
  f.particles.sparks(x, 3, 6, '#6a4a28');
  f.particles.smoke(x, 2, 2, '#8a7050');
}

// ------------------------------------------------------------------ the card guard projectile

/** Per-projectile state for marching guards. */
const guardState = new WeakMap<Projectile, { suit: number; dir: number; gone: number }>();
let nextSuit = 0;
const gs = (p: Projectile) => {
  let s = guardState.get(p);
  if (!s) guardState.set(p, (s = { suit: nextSuit++ % SUITS.length, dir: Math.sign(p.vx) || 1, gone: 0 }));
  return s;
};

/** Marches along the floor; after it lands its blow it turns on its heel and marches home. */
export function updateCardGuard(p: Projectile, f: Fight) {
  const s = gs(p);
  p.y = 16;
  if (p.t % 8 === 0) f.particles.dust(p.x - s.dir * 4, 1, '#a89878');
  if (p.spent) {
    s.gone++;
    p.vx = -s.dir * 2.6;
    if (s.gone > 40) p.dead = true;
  }
}

export function drawCardGuard(ctx: CanvasRenderingContext2D, p: Projectile) {
  const s = gs(p);
  const facing = Math.sign(p.vx) || s.dir;
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(spr().guards[s.suit][(p.t >> 3) % 2], -12, -14 + ((p.t >> 2) % 2));
}

// ------------------------------------------------------------------ poses

/** Hands holding the skirt out, one foot tucked behind: a curtsy. */
const CURTSY: Pose = P(STANCE, { t: 10, h: 14, af: -24, ef: -20, ab: 28, eb: -30, lf: -6, kf: 34, lb: 34, kb: 46, ff: 10, fb: 20, ry: 4 });
/** Skirt ballooning, arms up: drifting down the rabbit hole. */
const FLOAT: Pose = P(STANCE, { t: -4, h: -12, af: -150, ef: -30, ab: -130, eb: -40, lf: -10, kf: 24, lb: 8, kb: 30, ff: 30, fb: 30 });
const FLOAT2: Pose = P(FLOAT, { af: -135, ef: -50, ab: -145, eb: -20, lf: -4, kf: 30, lb: 2, kb: 20 });
/** Arm out straight, pointing her verdict at the opponent; the other hand on her hip. */
const POINT: Pose = P(STANCE, { t: -6, h: -8, af: -92, ef: -4, ab: 30, eb: -100, lf: -10, kf: 6, lb: 14, kb: 4 });
/** Teacup raised to her lips, the saucer hand under it. */
const SIP: Pose = P(STANCE, { t: -2, h: -10, af: -20, ef: -140, ab: -40, eb: -90, lf: -10, kf: 6, lb: 12, kb: 4, pa: 160 });
const HOLD_CUP: Pose = P(STANCE, { t: 2, h: -4, af: -40, ef: -60, ab: -40, eb: -90, lf: -10, kf: 6, lb: 12, kb: 4, pa: 100 });

// ------------------------------------------------------------------ specials

const cardGuards: Move = {
  id: 'proj_cardguard',
  anim: A([
    // fans a deck out in front of her, then flings it to the floor where it stands up and marches
    [P(STANCE, { af: -60, ef: -90, ab: -50, eb: -100, t: -4, h: -6 }), 6],
    [P(STANCE, { af: -150, ef: -10, ab: -40, eb: -60, t: -10, h: -10, lf: -14, kf: 10 }), 4],
    [P(STANCE, { af: -70, ef: -4, ab: 10, eb: -40, t: 18, h: 4, lf: -40, kf: 40, lb: 30, kb: 8 }), 12, 'out'],
    [STANCE, 6],
  ]),
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 4) for (let i = 0; i < 6; i++) f.particles.add({ kind: 'spark', x: self.x + self.facing * 10, y: 60, vx: rand(-1, 1), vy: rand(0.5, 1.5), life: 14, max: 14, color: i % 2 ? '#f4f0e4' : '#c81828' });
    if (fr === 11) {
      f.projectiles.push(new Projectile(self, 'cardguard', self.x + self.facing * 26, 16));
      self.projOut = true;
      f.particles.dust(self.x + self.facing * 26, 4, '#a89878');
    }
  },
};

/** Drink Me: a gulp of potion, she shoots up to giant size, stomps, and shrinks back down. */
const GROW = 1.6;
const drinkMe: Move = {
  id: 'drinkme', prop: 'bottle',
  anim: A([
    [P(STANCE, { af: -150, ef: -110, ab: -40, eb: -90, t: -6, h: -8 }), 6],
    [P(STANCE, { af: -170, ef: -150, ab: -30, eb: -80, t: -14, h: -28 }), 8],
    [P(STANCE, { af: -100, ef: -60, ab: -110, eb: -40, t: -6, h: -6, lf: -30, kf: 20, lb: 24, kb: 8 }), 14],
    // knee up high...
    [P(STANCE, { af: -80, ef: -40, ab: -120, eb: -40, t: -12, h: -6, lf: -110, kf: 80, ff: -10, lb: 12, kb: 6 }), 8, 'in'],
    // ...and down
    [P(STANCE, { af: -60, ef: -30, ab: -100, eb: -50, t: 18, h: 6, lf: -50, kf: 10, ff: 0, lb: 26, kb: 10 }), 4, 'out'],
    [P(STANCE, { af: -60, ef: -30, ab: -100, eb: -50, t: 18, h: 6, lf: -50, kf: 10, ff: 0, lb: 26, kb: 10 }), 10],
    [P(CROUCH, { t: 14 }), 12],
    [STANCE, 6],
  ]),
  active: [38, 46],
  vx: (fr) => (fr >= 14 && fr < 28 ? 0.9 : 0),
  hit: { limb: 'toeF', r: 14, dmg: 115, level: 'overhead', effect: 'knockdown', push: 3, stun: 22, special: true },
  onFrame: (self, f, fr) => {
    self.sizeBy = self.move;
    if (fr >= 14 && fr < 28) self.size = 1 + (GROW - 1) * ((fr - 13) / 14);
    if (fr >= 56 && fr < 66) self.size = GROW - (GROW - 1) * ((fr - 55) / 10);
    if (fr >= 66) self.size = 1;
    if (fr >= 14 && fr < 28 && fr % 3 === 0) f.particles.sparks(self.x + rand(-14, 14), rand(20, 90), 1, fr % 2 ? '#ff80c0' : '#ffffff');
    if (fr === 38) {
      f.shake(10);
      for (const d of [-1, 1]) f.particles.smoke(self.x + self.facing * 30 + d * 10, 2, 5, '#b8a890');
      f.particles.dust(self.x + self.facing * 30, 10);
    }
    if (fr >= 56 && fr < 66 && fr % 2 === 0) f.particles.sparks(self.x + rand(-10, 10), rand(20, 70), 1, '#c0e0ff');
  },
};

/** Rabbit Hole: dives into a hole in the floor and bursts out under the opponent with a rising kick. */
const rabbitHole: Move = {
  id: 'rabbithole',
  anim: A([
    [P(CROUCH, { af: -150, ef: -20, ab: -140, eb: -20, t: 20 }), 5],
    [P(TUCK, { t: 30, af: -170, ef: 0, ab: -170, eb: 0, ry: 10 }), 4],
    [P(TUCK, { t: 30, af: -170, ef: 0, ab: -170, eb: 0, ry: 40 }), 18],
    // bursts up out of the floor, front foot leading
    [P(STANCE, { t: -18, h: -10, af: -170, ef: -10, ab: -60, eb: -40, lf: -160, kf: 10, ff: -30, lb: 10, kb: 20, ry: 6 }), 4, 'out'],
    [P(STANCE, { t: -22, h: -10, af: -170, ef: -10, ab: -60, eb: -40, lf: -165, kf: 0, ff: -30, lb: 10, kb: 20 }), 10],
    [P(CROUCH, { t: 14 }), 6],
    [STANCE, 6],
  ]),
  invisible: [8, 27],
  active: [27, 37],
  hit: { limb: 'toeF', r: 10, dmg: 95, level: 'mid', effect: 'launch', lift: [7.5, 1.2], push: 1, stun: 22, special: true },
  onFrame: (self, f, fr) => {
    if (fr === 5) hole(f, self.x, 30);
    if (fr === 15) {
      // tunnel under to the opponent's feet, staying on this side of them
      const o = self.opp;
      const side = o.x >= self.x ? 1 : -1;
      self.x = Math.max(20, Math.min(f.sw - 20, o.x - side * 12));
      self.facing = side;
      self.moveDir = side;
    }
    if (fr >= 16 && fr < 27 && fr % 2 === 0) f.particles.sparks(self.x + rand(-6, 6), 2, 1, '#6a4a28');
    if (fr === 22) hole(f, self.x, 24);
  },
};

const specials: Special[] = [
  { name: 'Card Guard March', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: cardGuards },
  { name: 'Drink Me', cmd: [4, 6], btn: 'hk', mash: 'hk', text: 'B, F + HK or MASH HK', move: drinkMe },
  { name: 'Rabbit Hole', cmd: [2, 1, 4], btn: 'lk', text: 'D, DB, B + LK', move: rabbitHole },
];

// ------------------------------------------------------------------ intro

export const ALLISON_LINES = {
  intro: 'Down the hole and straight into a fight. How curious!',
  finisher: 'Guards! Cut the deck!',
};
const VOICE = { pitch: 1.25, rate: 1.0, female: true };

/** Round 1 entrance: she drifts down from the top of the screen, skirt billowing, with a teacup, a pocket watch and a card tumbling beside her. */
export const ALLISON_INTRO: Intro = {
  line: ALLISON_LINES.intro,
  speech: VOICE,
  speakAt: 92,
  dur: 160,
  update(self, f, t, home) {
    if (t === 0) {
      self.x = home;
      self.setAnim(A([[FLOAT, 14], [FLOAT2, 14]], true));
      playCue('fallWhistle');
    }
    if (t < 64) {
      self.poseOverride = null;
      self.y = lerp(240, 0, (t / 64) ** 0.8);
      if (t % 10 === 0) {
        const tr = spr().trinkets;
        f.particles.add({ kind: 'img', img: tr[(t / 10) % 3], ix: 4, iy: 5, x: self.x + rand(-40, 40), y: 236, vx: rand(-0.3, 0.3), vy: -2.2, grav: 0.02, rot: rand(-1, 1), vrot: rand(-0.12, 0.12), life: 200, max: 200, floor: true, bounce: 0.3 });
      }
    } else if (t < 70) {
      self.y = 0;
      self.poseOverride = P(CROUCH, { t: 16, af: -110, ab: -100 });
      if (t === 64) {
        f.particles.dust(self.x, 6);
        sfx.land();
      }
    } else if (t < 120) self.poseOverride = CURTSY;
    else self.poseOverride = POINT;
    if (t === 72) playCue('teaClink');
  },
};

// ------------------------------------------------------------------ finisher

interface Guard {
  x: number;
  to: number;
  dir: number;
  suit: number;
  front: boolean;
}

/**
 * Cut the Deck: a herald's fanfare calls the card guards, who march in from both sides and
 * box the loser in. The Ace of Spades drops out of the sky like a guillotine blade. Allison takes tea.
 */
function cutTheDeck(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  const neck = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) });
  if (t === 0) {
    D.dir = w.facing;
    // give the guards room either side of the loser
    D.guards = [-62, -36, 36, 62].map((dx, i): Guard => ({
      x: dx < 0 ? f.camX - 30 - i * 20 : f.camX + 286 + (i - 2) * 20,
      to: l.x + dx,
      dir: dx < 0 ? 1 : -1,
      suit: i,
      front: false,
    }));
    D.ace = { y: 300, vy: 0, stuck: false };
    playCue('fanfare');
  }
  const dir = D.dir as number;
  // step back from the loser so the guards can fall in
  if (t < 30 && Math.abs(l.x - w.x) < 90) w.x = Math.max(20, Math.min(f.sw - 20, w.x - dir * 1.5));
  if (t < 20) w.poseOverride = P(STANCE, { t: -4, h: -12, af: -170, ef: -20, ab: 20, eb: -40 });
  else if (t < 150) w.poseOverride = POINT;
  if (t === 24) say(ALLISON_LINES.finisher, VOICE);
  l.poseOverride = t < 118 ? ((t >> 4) % 2 ? DIZZY : P(DIZZY, { t: 8, h: 30 })) : l.poseOverride;

  for (const g of D.guards as Guard[]) {
    const marchIn = t >= 20 && t < 110;
    const marchOut = t >= 230;
    if (marchIn) g.x += Math.sign(g.to - g.x) * Math.min(2.2, Math.abs(g.to - g.x));
    if (marchOut) g.x -= g.dir * 2.4;
  }
  if (t >= 20 && t < 110 && t % 8 === 0) playCue('cardMarch');
  if (t === 110) playCue('drumRoll');

  // the Ace falls
  const A_ = D.ace;
  if (t >= 120 && !A_.stuck) {
    A_.vy -= 0.9;
    A_.y += A_.vy;
    if (!D.chopped && A_.y < neck().y + 2) {
      D.chopped = t;
      const n = neck();
      l.hidden.add('head');
      ps.chunk(l.parts.head.img, l.parts.head.px, l.parts.head.py, n.x, n.y, dir * 1.4, 6.5, 0.3 * dir);
      ps.blood(n.x, n.y, -dir, 40, 1.5);
      ps.blood(n.x, n.y, dir, 40, 1.5);
      ps.flash(n.x, n.y, 14);
      playCue('cardBlade');
      sfx.blood();
      f.shake(12);
    }
    if (A_.y <= 8) {
      A_.y = 8;
      A_.stuck = true;
      f.shake(6);
      sfx.thud();
      ps.dust(l.x, 6);
    }
  }
  if (D.chopped && t > D.chopped && t < D.chopped + 90) {
    const n = neck();
    ps.blood(n.x, n.y + 2, rand(-0.6, 0.6), 3, 1.6);
    if (t % 18 === 0) sfx.blood();
  }
  if (D.chopped && t === D.chopped + 70) {
    l.poseOverride = null;
    l.setState('fall', FALL);
    l.vy = 1.5;
    l.y = 1;
    l.vx = -dir * 0.4;
    sfx.thud();
  }
  // the guards present arms, then Allison takes her tea
  if (t >= 150 && t < 290) {
    w.propOverride = spr().cup;
    w.poseOverride = t < 180 || t > 250 ? HOLD_CUP : SIP;
    if (t === 182) playCue('teaClink');
    if (t % 6 === 0) ps.add({ kind: 'smoke', x: w.x + dir * 6, y: 74 + rand(-2, 2), vx: rand(-0.1, 0.1), vy: 0.5, life: 30, max: 30, size: 1, color: '#f0f0f0' });
  }
  if (t === 260) {
    w.propOverride = null;
    w.poseOverride = CURTSY;
    playCue('applause');
  }
  if (t === 300) w.poseOverride = VICTORY;
  return t >= 330;
}

function drawFinisher(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!D?.guards) return;
  const s = spr();
  const groundY = FLOOR;
  const t = f.fatal!.t;
  for (const g of D.guards as Guard[]) {
    if (g.front !== front) continue;
    const moving = (t >= 20 && t < 110 && Math.abs(g.to - g.x) > 0.5) || t >= 230;
    const facing = t >= 230 ? -g.dir : g.dir;
    const img = s.guards[g.suit][moving ? (t >> 3) % 2 : 0];
    ctx.save();
    ctx.translate(Math.round(g.x - cam), groundY);
    ctx.scale(facing * 2, 2);
    // present arms: the halberd tips up while the Ace falls
    if (t >= 112 && t < 230) {
      ctx.translate(0, -16);
      ctx.rotate(-0.35);
      ctx.translate(0, 16);
    }
    ctx.drawImage(img, -12, -32 + (moving ? (t >> 2) % 2 : 0));
    ctx.restore();
  }
  if (front && t >= 120) {
    const A_ = D.ace;
    const x = Math.round((f.loser?.x ?? 0) - cam);
    ctx.drawImage(s.ace, x - 18, Math.round(groundY - A_.y - 48));
  }
}

// ------------------------------------------------------------------ portrait

export const ALLISON_PORTRAIT: PortraitStyle = {
  back(p, c) {
    // long copper waves falling behind the shoulders
    const h = c.look.hair;
    c.sculpt((m) => m.ellipse(50, 40, 34, 30, '#fff'), h, { soft: 7 });
    c.sculpt((m) => m.poly([[18, 44], [42, 52], [46, 116], [26, 118], [10, 104], [12, 70]], '#fff'), h, { soft: 4 });
    const hl = lighten(h, 0.3);
    for (let y = 56; y < 112; y += 8) {
      p.line(16, y, 24, y + 4, hl);
      p.line(24, y + 4, 32, y, hl);
    }
  },
  front(p, c) {
    const g = c.geom, L = c.look;
    const bow = trim(L).bow;
    // side-swept fringe
    c.sculpt((m) => m.poly([[42, 22], [80, 30], [78, 40], [64, 35], [50, 38], [42, 34]], '#fff'), L.hair, { soft: 3 });
    p.line(50, 26, 76, 32, lighten(L.hair, 0.35));
    // the big bow on top
    c.sculpt((m) => {
      m.ellipse(38, 14, 12, 8, '#fff');
      m.ellipse(62, 12, 12, 8, '#fff');
    }, bow, { soft: 3 });
    c.sculpt((m) => m.ellipse(50, 15, 5, 5, '#fff'), darken(bow, 0.2), { soft: 2 });
    p.line(32, 10, 40, 9, lighten(bow, 0.4));
    p.line(58, 8, 66, 8, lighten(bow, 0.4));
    if (L.lips && !c.beaten) {
      const [mx, my] = g.mouth;
      p.line(mx - 5, my + 1, mx + 2, my, L.lips);
    }
  },
};

export function allison(): CharDef {
  return {
    id: 'allison', name: 'Allison Wonderland', short: 'ALLISON', title: 'The Girl Who Fell Through', look: ALLISON_LOOK, alt: ALLISON_ALT,
    specials, voice: 300, props: { bottle: potionBottle() }, intro: ALLISON_INTRO, portrait: ALLISON_PORTRAIT,
    finisher: { name: 'Cut the Deck', cmd: [4, 6, 4, 6], btn: 'hp', text: 'B, F, B, F + HP (any range)', range: [0, 400] },
    fatality: cutTheDeck,
    fatalityDraw: drawFinisher,
  };
}
