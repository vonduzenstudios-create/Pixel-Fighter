import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK, VICTORY, HIT_HIGH, HIT_MID, LAUNCHED } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Ease, Move, Special } from '../../game/types';
import type { Pose, Part } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { css, darken, lighten } from '../../gfx/palette';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { say, sfx } from '../../audio/sfx';
import { ease, lerp, offscreenX, type Intro } from '../../game/intro';

// Laura Kroft: an original tomb-raiding adventurer. Copper hair in a choppy bob, brass goggles
// parked on her brow, a red neckerchief, an olive field jacket with the sleeves rolled, cargo
// trousers and tall lace-up boots. She carries a grappling line, a climbing pick and a satchel
// of cursed relics. Every line is original.

const OUT = '#100810';
const GOLD = '#e8b830';
const SAND = '#d8b878';
const ROPE = '#c8a868';
const STEEL = '#a8b0bc';

const GOGGLES = '#b08a3a';

/** Head part (24x44, face to the right): a choppy chin-length bob with a swept fringe, goggles on the brow. */
function paintHead(p: Painter, L: Look, gg: string) {
  const h = L.hair;
  // ragged ends hanging behind the jaw, over the ear
  p.poly([[3, 24], [9, 22], [10, 34], [8, 37.5], [6.5, 35], [4.5, 37], [2.5, 33.5], [2, 28]], h);
  p.ellipse(10.5, 23.5, 7, 4, h);
  // side-parted fringe swept down across the brow
  p.poly([[8, 20], [16.5, 21.5], [17.5, 25.5], [15.5, 24.5], [13.5, 26], [12, 24]], h);
  const hl = css(lighten(h, 0.35));
  p.line(6, 21, 12, 20, hl);
  p.line(13, 22, 16, 24, hl);
  p.line(3, 28, 4, 33, css(lighten(h, 0.2)));
  p.line(5, 34, 6, 36, css(darken(h, 0.3)));
  // strap round the head, lenses parked on the brow
  p.line(3, 25, 9, 22.5, css(darken(gg, 0.45)));
  p.ellipse(11.5, 21.5, 2.3, 2, gg);
  p.ellipse(15.2, 22.2, 2, 1.8, gg);
  p.set(11, 21, '#bfe6f0'), p.set(12, 21, '#6a9ab0');
  p.set(15, 22, '#bfe6f0');
  p.set(13, 22, css(darken(gg, 0.3)));
}

/** Torso part (28x42, shoulders at y=7): a neckerchief knotted at the throat, ends flicking down. */
function paintScarf(p: Painter, n: string) {
  p.poly([[11, 4], [20, 4.5], [21, 7], [12, 7.5]], n);
  p.poly([[18, 6], [21.5, 7], [20, 11.5], [17.5, 9]], css(darken(n, 0.15)));
  p.line(12, 6, 19, 6, css(darken(n, 0.3)));
}

export const KROFT_LOOK: Look = {
  skin: '#ecbc94', hair: '#b4461e', eye: '#2e6a3a', shirt: '#e8dcc0', coat: '#69703c', pants: '#4e3c2c',
  boots: '#4a2e1a', tallBoots: true, glove: '#5a3a22', belt: '#3a2618', buckle: '#c8a040', bandolier: '#8a5a2a',
  hairStyle: 'short', rolledSleeves: true, lips: '#a8484a', freckles: '#c8865e',
  paint: { head: (p, L) => paintHead(p, L, GOGGLES), torso: (p) => paintScarf(p, '#c4362a') },
};
/** Palette swap for mirror matches: night-raid slate with a mustard scarf. */
export const KROFT_ALT: Look = {
  ...KROFT_LOOK, coat: '#3c4a58', pants: '#2a2a32', hair: '#2a1a14', boots: '#1e1a1c', bandolier: '#5a4030',
  paint: { head: (p, L) => paintHead(p, L, '#9aa0aa'), torso: (p) => paintScarf(p, '#d8a830') },
};

export const KROFT_LINES = {
  intro: 'Mind your step. Everything down here is trapped, including me.',
  finisher: 'That relic belongs in my satchel. You belong in the sand.',
};
const VOICE = { pitch: 1.05, rate: 1.0, female: true };

// ------------------------------------------------------------------ sounds
const vary = (a = 0.06) => 1 + (Math.random() * 2 - 1) * a;
const now = () => ac()?.currentTime ?? 0;
const SND = {
  /** Rope twirled overhead before the throw. */
  ropeWhirl() {
    const t = now();
    for (let i = 0; i < 3; i++) noise({ dur: 0.1, vol: 0.12, type: 'bandpass', freq: 500, to: 1400, q: 3, at: t + i * 0.09 });
    tone({ type: 'triangle', freq: 180 * vary(), to: 320, dur: 0.25, vol: 0.04 });
  },
  /** The hook leaving the hand: a fast fwip with a metal ring. */
  hookFire() {
    noise({ dur: 0.16, vol: 0.2, type: 'highpass', freq: 1800, to: 5200, q: 2 });
    tone({ type: 'sine', freq: 2600 * vary(), dur: 0.18, vol: 0.04 });
  },
  /** Prongs biting in. */
  hookClank() {
    tone({ type: 'square', freq: 1500 * vary(), to: 900, dur: 0.08, vol: 0.08, filter: { type: 'bandpass', freq: 2200, q: 4 } });
    tone({ type: 'sine', freq: 3300 * vary(), dur: 0.2, vol: 0.04 });
    noise({ dur: 0.06, vol: 0.16, freq: 900, to: 300 });
  },
  /** Winch ratchet while she hauls the line in. */
  reel() {
    const t = now();
    for (let i = 0; i < 6; i++) noise({ dur: 0.02, vol: 0.14, type: 'bandpass', freq: 2600 + i * 120, q: 6, at: t + i * 0.05 });
  },
  /** An eerie three-note chime when a relic wakes up. */
  idolChime() {
    [0, 3, 7].forEach((n, i) => tone({ type: 'sine', freq: 660 * Math.pow(2, n / 12) * vary(0.01), dur: 0.5 - i * 0.1, vol: 0.05, attack: 0.02 }));
    tone({ type: 'triangle', freq: 1320, to: 1250, dur: 0.6, vol: 0.02, attack: 0.1 });
  },
  /** Stone grinding under the floor. */
  stoneRumble() {
    tone({ type: 'triangle', freq: 48 * vary(), to: 40, dur: 0.4, vol: 0.2 });
    noise({ dur: 0.4, vol: 0.14, freq: 320, to: 140, q: 2 });
  },
  /** Spikes bursting up through the flagstones. */
  spikeBurst() {
    noise({ dur: 0.12, vol: 0.3, type: 'bandpass', freq: 1400, to: 400, q: 1.5 });
    tone({ type: 'sawtooth', freq: 220 * vary(), to: 70, dur: 0.14, vol: 0.1, filter: { type: 'lowpass', freq: 1400 } });
    sfx.crunch();
  },
  /** Climbing pick striking: a bright clink over a chunk. */
  pickClink() {
    tone({ type: 'square', freq: 2100 * vary(), to: 1700, dur: 0.06, vol: 0.06, filter: { type: 'bandpass', freq: 2600, q: 5 } });
    tone({ type: 'sine', freq: 4200 * vary(), dur: 0.12, vol: 0.025 });
    noise({ dur: 0.05, vol: 0.12, freq: 1200, to: 500 });
  },
  /** Effortful hup from the adventurer. */
  hup() {
    tone({ type: 'sawtooth', freq: 420 * vary(), to: 330, dur: 0.12, vol: 0.06, filter: { type: 'bandpass', freq: 1100, q: 3 } });
    noise({ dur: 0.08, vol: 0.05, type: 'bandpass', freq: 1800, q: 2 });
  },
  /** The curse: a low choir-like drone with a shimmer on top. */
  curseDrone() {
    tone({ type: 'sawtooth', freq: 73, to: 69, dur: 1.4, vol: 0.07, attack: 0.3, filter: { type: 'lowpass', freq: 500 } });
    tone({ type: 'sawtooth', freq: 110, to: 104, dur: 1.4, vol: 0.05, attack: 0.3, filter: { type: 'lowpass', freq: 700 } });
    tone({ type: 'sine', freq: 1760, to: 1660, dur: 1.2, vol: 0.02, attack: 0.4 });
  },
  /** Sand pouring away. */
  sandHiss() {
    noise({ dur: 0.6, vol: 0.14, type: 'highpass', freq: 2600, to: 1800, attack: 0.1 });
  },
};

// ------------------------------------------------------------------ sprites
/** Climbing pick: ash handle with a steel head, gripped near the butt. */
export function climbingPick(): Part {
  const p = new Painter(18, 32);
  p.rect(8, 0, 3, 27, '#8a5a30');
  p.line(8, 1, 8, 26, '#b07a48');
  p.rect(8, 6, 3, 4, '#3a2618'); // leather grip wrap
  // pick on one side, adze on the other
  p.poly([[3, 24], [15, 24], [17, 30], [11, 28], [7, 28], [1, 26]], STEEL);
  p.poly([[13, 25], [17, 31], [15, 27]], '#d8e0e8');
  p.line(2, 25, 15, 25, '#e8f0f8');
  p.shade(0.15);
  p.outline(OUT);
  return { img: p.canvas(), px: 9, py: 2 };
}

/** A squat golden idol with jade eyes. Original design: no real artefact. */
function idolImg(glow: boolean): HTMLCanvasElement {
  const p = new Painter(12, 14);
  const g = glow ? '#ffe070' : GOLD;
  p.rect(2, 11, 8, 3, darken(g, 0.25)); // plinth
  p.ellipse(6, 8.5, 3.5, 3, g); // body
  p.ellipse(6, 4, 4.5, 3.8, g); // big head
  p.poly([[2, 1], [4, 0], [5, 2]], g);
  p.poly([[10, 1], [8, 0], [7, 2]], g);
  p.shade(0.25);
  p.set(4, 4, glow ? '#a0ffb0' : '#2a8a4a');
  p.set(8, 4, glow ? '#a0ffb0' : '#2a8a4a');
  p.line(5, 6, 7, 6, darken(g, 0.45));
  p.set(4, 2, '#fff8d0');
  p.outline(OUT);
  return p.canvas();
}

/** A row of stone spikes on a cracked plinth, base at the bottom row. */
function spikesImg(): HTMLCanvasElement {
  const p = new Painter(30, 30);
  const S = '#9a9080', D = darken(S, 0.35);
  for (const [x, h] of [[3, 16], [8, 24], [14, 29], [20, 23], [25, 17]]) {
    p.poly([[x - 2.5, 29], [x, 29 - h], [x + 2.5, 29]], S);
    p.line(x, 29 - h + 2, x + 1, 28, D);
  }
  p.shade(0.25);
  for (const [x, h] of [[8, 24], [14, 29]]) p.set(x, 29 - h + 1, '#d8d0c0');
  p.outline(OUT);
  return p.canvas();
}

const makeImgs = () => ({ idol: idolImg(false), idolGlow: idolImg(true), spikes: spikesImg() });
let IMG: ReturnType<typeof makeImgs> | null = null;
const img = () => (IMG ??= makeImgs());

/** Pixel rope from (x0,y0) to (x1,y1) in screen space, with a little sag. */
function drawRope(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag = 4) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = Math.round(x0 + (x1 - x0) * k), y = Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag);
    ctx.fillStyle = OUT;
    ctx.fillRect(x, y + 1, 1, 1);
    ctx.fillStyle = i % 4 < 2 ? ROPE : css(darken(ROPE, 0.25));
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Three-pronged grappling hook, pointing along +x. */
function drawHook(ctx: CanvasRenderingContext2D, dir: number) {
  ctx.save();
  ctx.scale(dir, 1);
  ctx.fillStyle = OUT;
  ctx.fillRect(-4, -2, 7, 4);
  ctx.fillRect(1, -5, 4, 10);
  ctx.fillStyle = STEEL;
  ctx.fillRect(-3, -1, 6, 2); // shank
  ctx.fillRect(2, -4, 2, 2); // upper prong
  ctx.fillRect(2, 2, 2, 2); // lower prong
  ctx.fillRect(4, -1, 1, 2); // front prong
  ctx.fillStyle = '#e8f0f8';
  ctx.fillRect(-2, -1, 3, 1);
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles: grappling hook + cursed idol
/** Frames the hook flies out before it gives up and reels back (about 130 px). */
const HOOK_REACH = 19;
const IDOL_WARN = 10;
const IDOL_UP = 18;

interface KState {
  phase: 'out' | 'latched' | 'back' | 'fly' | 'warn' | 'up' | 'down';
  /** Frame the phase started. */
  at: number;
  dir: number;
  wasSpent: boolean;
}
const STATE = new WeakMap<Projectile, KState>();
const st = (p: Projectile) => {
  let s = STATE.get(p);
  if (!s) STATE.set(p, (s = { phase: p.kind === 'hook' ? 'out' : 'fly', at: 0, dir: p.owner.facing, wasSpent: p.spent }));
  return s;
};
const go = (s: KState, p: Projectile, phase: KState['phase']) => ((s.phase = phase), (s.at = p.t));

const handOf = (f: Fighter) => ({ x: f.wx(f.skel.handF[0]), y: f.wy(f.skel.handF[1]) });

export function updateKroft(p: Projectile, f: Fight) {
  const s = st(p);
  const o = p.owner, d = o.opp, ps = f.particles;
  const justSpent = p.spent && !s.wasSpent;
  s.wasSpent = p.spent;
  if (p.kind === 'hook') {
    const holding = o.move === grapple;
    switch (s.phase) {
      case 'out':
        p.x += p.vx;
        if (!holding || p.t >= HOOK_REACH) {
          p.spent = true;
          go(s, p, 'back');
        } else if (justSpent) {
          // the fight resolved the hit: only a clean hit on a grounded foe snags them
          SND.hookClank();
          ps.sparks(p.x, p.y, 5, '#e8f0f8');
          if (d.state === 'hitstun' && !d.airborne && f.phase === 'fight') {
            go(s, p, 'latched');
            SND.reel();
          } else go(s, p, 'back');
        }
        break;
      case 'latched': {
        // haul them in hand over hand, then meet them with both boots
        const tx = o.x + o.facing * 30;
        const step = Math.max(-7, Math.min(7, tx - d.x));
        d.x += step;
        d.vx = 0;
        d.stun = Math.max(d.stun, 8);
        p.x = d.x - o.facing * 6;
        p.y = 50;
        if ((p.t - s.at) % 6 === 0) ps.smoke(d.x - o.facing * 8, 2, 1, '#8a7a6a');
        const lt = p.t - s.at;
        if (!holding || d.state !== 'hitstun') p.dead = true;
        else if (Math.abs(tx - d.x) < 3 || lt > 24) {
          o.startMove(hookKick, f);
          p.dead = true;
        }
        break;
      }
      case 'back': {
        const h = handOf(o);
        const dx = h.x - p.x, dy = h.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 11) p.dead = true;
        else {
          p.x += (dx / dist) * 10;
          p.y += (dy / dist) * 10;
        }
        break;
      }
    }
  } else {
    // the idol: lobbed in an arc, then wakes up the floor where it lands
    switch (s.phase) {
      case 'fly':
        p.vy -= 0.24;
        p.x += p.vx;
        p.y += p.vy;
        if (p.t % 3 === 0) ps.add({ kind: 'spark', x: p.x, y: p.y, vx: 0, vy: 0, life: 10, max: 10, color: p.t % 6 ? '#ffe070' : '#ffffff', floor: false });
        if (p.y <= 6) {
          p.y = 12;
          p.vx = p.vy = 0;
          p.level = 'low';
          p.effect = 'launch';
          p.dmg = 85;
          p.r = 13;
          p.sturdy = true;
          p.spent = true; // harmless while the floor rumbles
          s.wasSpent = true;
          go(s, p, 'warn');
          SND.idolChime();
          SND.stoneRumble();
          ps.sparks(p.x, 4, 8, GOLD);
        }
        break;
      case 'warn':
        if (p.t % 2 === 0) ps.smoke(p.x + rand(-14, 14), 2, 1, '#8a7a6a');
        f.shake(1);
        if (p.t - s.at >= IDOL_WARN) {
          p.spent = false;
          s.wasSpent = false;
          go(s, p, 'up');
          SND.spikeBurst();
          ps.sparks(p.x, 6, 14, '#b8b0a0');
          for (const k of [-1, 1]) ps.smoke(p.x + k * 12, 2, 4, '#a89878');
        }
        break;
      case 'up':
        if (justSpent) {
          sfx.blood();
          ps.blood(p.x, 20, s.dir, 14, 1.2);
        }
        if (p.t - s.at >= IDOL_UP) {
          p.spent = true;
          go(s, p, 'down');
        }
        break;
      case 'down':
        if (p.t - s.at > 12) p.dead = true;
        break;
    }
  }
  if (p.t > 200 || p.x < -60 || p.x > 580) p.dead = true;
}

export function drawKroft(ctx: CanvasRenderingContext2D, p: Projectile) {
  const s = st(p);
  if (p.kind === 'hook') {
    // ctx is at the hook; the rope runs back to her front hand
    const h = handOf(p.owner);
    const hx = Math.round(h.x - p.x), hy = Math.round(p.y - h.y);
    drawRope(ctx, hx, hy, 0, 0, s.phase === 'latched' ? 1 : 3);
    drawHook(ctx, s.phase === 'back' ? -s.dir : s.dir);
    return;
  }
  const I = img();
  if (s.phase === 'fly') {
    ctx.rotate(Math.sin(p.t * 0.4) * 0.5);
    ctx.drawImage(I.idol, -6, -7);
    return;
  }
  // on the floor: ctx is p.y (12) above the deck
  ctx.save();
  ctx.translate(0, p.y);
  const lt = p.t - s.at;
  if (s.phase === 'warn') {
    // the idol sinks into a glowing glyph ring
    ctx.fillStyle = lt % 4 < 2 ? '#ffe070' : '#c89020';
    for (let a = 0; a < 12; a++) ctx.fillRect(Math.round(Math.cos(a * 0.52) * 14), Math.round(Math.sin(a * 0.52) * 2) - 1, 2, 1);
    ctx.beginPath();
    ctx.rect(-8, -20, 16, 20);
    ctx.clip();
    ctx.drawImage(I.idolGlow, -6, -14 + Math.round((lt / IDOL_WARN) * 12));
  } else {
    const k = s.phase === 'up' ? Math.min(1, lt / 4) : Math.max(0, 1 - lt / 10);
    const h = Math.round(30 * k);
    // cracked flagstones round the base
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(-17, -1, 34, 2);
    ctx.fillStyle = '#6a5e50';
    for (const x of [-15, -8, 5, 12]) ctx.fillRect(x, -2, 3, 1);
    if (h > 0) ctx.drawImage(I.spikes, 0, 0, 30, h, -15, -h, 30, h);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ poses
/** Rope twirling overhead. */
const TWIRL_A: Pose = P(STANCE, { t: -4, h: -8, af: -170, ef: -50, ab: -30, eb: -90 });
const TWIRL_B: Pose = P(STANCE, { t: -4, h: -8, af: -150, ef: -10, ab: -30, eb: -90 });
/** Arm thrown out after the hook. */
const CAST: Pose = P(STANCE, { af: -92, ef: -4, ab: -30, eb: -80, t: 18, h: -4, lf: -42, kf: 40, lb: 30, kb: 8 });
/** Leaning back, hauling the line in. */
const HAUL_A: Pose = P(STANCE, { t: -10, h: 4, af: -80, ef: -70, ab: -70, eb: -20, lf: -10, kf: 30, lb: 34, kb: 10 });
const HAUL_B: Pose = P(STANCE, { t: -14, h: 6, af: -60, ef: -90, ab: -90, eb: -10, lf: -6, kf: 26, lb: 38, kb: 12 });
/** One hand on the hip, the other giving a two-finger salute off the goggles. */
const SALUTE: Pose = P(STANCE, { t: 0, h: -6, af: -150, ef: -140, ab: 30, eb: -120, lf: -14, kf: 10, lb: 14, kb: 4 });
/** Hanging off the rope with both hands. */
const HANG: Pose = P(STANCE, { t: -6, h: -10, af: -172, ef: -6, ab: -166, eb: -8, lf: -30, kf: 50, lb: 10, kb: 30, ff: 30, fb: 30 });
/** Holding the idol up overhead in both hands. */
const RAISE: Pose = P(STANCE, { t: -8, h: -14, af: -168, ef: -24, ab: -160, eb: -30, lf: -16, kf: 12, lb: 16, kb: 4 });

// ------------------------------------------------------------------ specials
/** D, DF, F + P: grappling hook. A clean hit reels them in to a two-boot drop kick. */
const grapple: Move = {
  id: 'proj_hook',
  anim: A([
    [TWIRL_A, 3], [TWIRL_B, 3], [TWIRL_A, 2],
    [CAST, 3, 'out'],
    [CAST, 14],
    [HAUL_A, 6], [HAUL_B, 6], [HAUL_A, 6], [HAUL_B, 6],
    [STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 8) {
      const h = handOf(self);
      f.projectiles.push(new Projectile(self, 'hook', h.x + self.facing * 4, h.y));
      self.projOut = true;
    }
  },
  sounds: { frames: { 0: SND.ropeWhirl, 8: SND.hookFire, 24: SND.reel } },
};

const hookKick: Move = {
  id: 'hookkick', air: true,
  anim: A([
    [P(CROUCH, { af: -60, ab: -40 }), 2],
    [P(STANCE, { t: -40, h: 10, lf: -100, kf: 4, ff: -30, lb: -86, kb: 14, fb: -30, af: -20, ef: -40, ab: 30, eb: -20 }), 16],
    [TUCK, 20],
  ]),
  active: [2, 16],
  hit: { limb: 'toeF', r: 9, dmg: 75, level: 'mid', effect: 'knockdown', push: 3.5, stun: 22, special: true, sfx: 'heavy' },
  onFrame: (self, _f, fr) => {
    if (fr === 1) {
      self.vy = 3.6;
      self.y = 1;
      self.vx = 1.2 * self.facing;
    }
  },
  sounds: { frames: { 0: SND.hup }, impact: SND.hookClank },
};

/** D, DB, B + P: lob a cursed idol at their feet. Where it lands, stone spikes burst out of the floor (block low). */
const idolToss: Move = {
  id: 'proj_idol',
  anim: A([
    [P(STANCE, { af: 40, ef: -30, ab: -40, eb: -90, t: 14, h: -2, lf: -30, kf: 40, lb: 24, kb: 10 }), 8],
    [P(STANCE, { af: -60, ef: -10, ab: 10, eb: -40, t: 6, h: -6, lf: -40, kf: 40, lb: 30, kb: 8 }), 3],
    [P(STANCE, { af: -140, ef: -8, ab: 20, eb: -30, t: -8, h: -12, lf: -36, kf: 36, lb: 26, kb: 6 }), 12],
    [STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 9) {
      const p = new Projectile(self, 'idol', self.x + self.facing * 16, 56);
      // aim the lob at the opponent's feet: flight time from 56 px up to the floor
      const dist = Math.max(40, Math.min(170, Math.abs(self.opp.x - self.x)));
      const vy = 3.4, T = (vy + Math.sqrt(vy * vy + 2 * 0.24 * 50)) / 0.24;
      p.vy = vy;
      p.vx = (dist / T) * self.facing;
      // it sails harmlessly over them: the trap is the threat
      p.spent = true;
      f.projectiles.push(p);
      self.projOut = true;
    }
  },
  sounds: { frames: { 1: SND.idolChime, 9: SND.hup } },
};

// overhand pick chops, alternating high and low
const chops: [Pose, number, Ease?][] = [];
for (let i = 0; i < 4; i++) {
  chops.push([P(STANCE, { af: -200, ef: -30, ab: -40, eb: -90, t: -10, h: -8, lf: -30, kf: 30 }), 3]);
  chops.push([P(STANCE, { af: i % 2 ? -50 : -80, ef: -4, ab: -20, eb: -100, t: i % 2 ? 34 : 24, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 }), 4, 'out']);
}
/** B, F + HP or MASH HP: a flurry of climbing-pick chops. */
const pickFlurry: Move = {
  id: 'pickflurry', prop: 'pick',
  anim: A([[P(STANCE, { af: -160, ef: -60, t: -6 }), 5], ...chops, [P(STANCE, { af: -60, ef: -4, t: 30, h: 8, lf: -45, kf: 45 }), 8], [STANCE, 8]]),
  active: [5, 33],
  vx: (fr) => (fr >= 5 && fr < 33 ? 1.1 : 0),
  hit: { limb: 'prop', r: 9, dmg: 26, level: 'mid', effect: 'light', push: 0.8, stun: 14, rehit: 7, special: true, sfx: 'slash' },
  onFrame: (self, f, fr) => {
    if (fr >= 5 && fr < 33 && (fr - 5) % 7 === 4 && self.hits > 0) f.particles.sparks(self.opp.x - self.facing * 6, rand(40, 70), 4, '#e8f0f8');
  },
  sounds: { frames: { 0: SND.hup, 8: 'whoosh', 15: 'whoosh', 22: 'whoosh', 29: 'whoosh' }, impact: SND.pickClink, blocked: SND.pickClink },
};

const specials: Special[] = [
  { name: 'Grappling Line', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: grapple },
  { name: 'Cursed Idol', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P (spike trap: block low)', move: idolToss },
  { name: 'Pick Flurry', cmd: [4, 6], btn: 'hp', mash: 'hp', text: 'B, F + HP or MASH HP', move: pickFlurry },
];

// ------------------------------------------------------------------ intro
const ANCHOR_H = 196;
const ROPE_LEN = 104;
const swing = new WeakMap<Fighter, { ax: number; hand: { x: number; y: number }; up: number }>();

/** Round 1 entrance: swings in on a rope from the rafters, drops into a crouch, pulls the line down and salutes. */
export const KROFT_INTRO: Intro = {
  line: KROFT_LINES.intro,
  speech: VOICE,
  speakAt: 84,
  dur: 150,
  update(self, f, t, home) {
    const dir = self.facing;
    if (t === 0) {
      const off = offscreenX(self, f);
      swing.set(self, { ax: home - dir * 24, hand: { x: off, y: 160 }, up: 0 });
      SND.ropeWhirl();
    }
    const S = swing.get(self)!;
    if (t <= 40) {
      // a pendulum arc from off screen, low point just short of her mark
      const th = ((-78 + 100 * ease(t / 40)) * Math.PI) / 180;
      S.hand = { x: S.ax + Math.sin(th) * ROPE_LEN * dir, y: ANCHOR_H - Math.cos(th) * ROPE_LEN };
      self.x = S.hand.x - dir * 4;
      self.y = Math.max(0, S.hand.y - 92);
      self.poseOverride = P(HANG, { lf: -30 - Math.sin(th) * 40, lb: 10 - Math.sin(th) * 30 });
      if (t === 20) noise({ dur: 0.5, vol: 0.1, type: 'bandpass', freq: 700, to: 300, q: 1.5 });
    } else if (t <= 48) {
      // lets go and drops onto her mark
      const k = (t - 40) / 8;
      self.x = lerp(S.hand.x - dir * 4, home, k);
      self.y = Math.max(0, lerp(S.hand.y - 92, 0, k * k));
      self.poseOverride = P(TUCK, { af: -150, ab: -140 });
      if (t === 48) {
        sfx.land();
        f.particles.smoke(self.x, 2, 6, '#8a7a6a');
      }
    } else if (t < 62) {
      self.y = 0;
      self.poseOverride = P(CROUCH, { af: -20, ef: -60, ab: 20, eb: -40 });
    } else if (t < 80) {
      // yanks the line down out of the rafters
      self.poseOverride = (t >> 2) % 2 ? HAUL_A : P(STANCE, { af: -170, ef: -20, ab: -30, eb: -90 });
      S.up = Math.min(1, (t - 62) / 12);
      if (t === 64) SND.reel();
    } else {
      self.poseOverride = t < 120 ? SALUTE : P(STANCE, { af: -60, ef: -100, ab: 30, eb: -120 });
      if (t === 84) f.particles.sparks(self.wx(self.skel.headTop[0] + 4), self.wy(self.skel.headTop[1] + 4), 4, '#fff2c0');
    }
  },
  draw(ctx, self, _f, t, cam) {
    const S = swing.get(self);
    if (!S || t > 80) return;
    const ax = Math.round(S.ax - cam), ay = FLOOR - ANCHOR_H;
    if (t <= 40) drawRope(ctx, ax, ay - 60, Math.round(S.hand.x - cam), FLOOR - Math.round(S.hand.y), 0);
    else {
      // the loose line swings, then whips up out of sight
      const end = FLOOR - lerp(ANCHOR_H - ROPE_LEN, ANCHOR_H + 40, S.up);
      drawRope(ctx, ax, ay - 60, ax + Math.round(Math.sin(t * 0.3) * 6 * (1 - S.up)), Math.round(end), 0);
    }
  },
};

// ------------------------------------------------------------------ finisher
/**
 * Curse of the Idol: she holds the golden idol up, its jade eyes light, and a stream of gold drains the
 * loser to sand. The flesh pours away into a dune at their feet until only the skeleton stands, then
 * that crumbles too.
 */
function curseOfTheIdol(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  if (t === 0) {
    D.dir = w.facing;
    D.pile = 0;
  }
  const dir = D.dir as 1 | -1;
  if (t < 24 && (l.x - w.x) * dir < 64) w.x = Math.max(20, Math.min(f.sw - 20, w.x - dir * 2.5));
  if (t < 30) w.poseOverride = P(STANCE, { af: -100 - t * 2, ef: -60, ab: -40, eb: -90 });
  else if (t < 190) w.poseOverride = RAISE;
  if (t === 30) SND.idolChime();
  if (t === 40) SND.curseDrone();
  if (t >= 40 && t < 150) {
    const k = (t - 40) / 110;
    l.tint = [SAND, Math.min(0.85, k * 1.1)];
    l.shake = 1 + Math.round(k * 2);
    l.poseOverride = t % 10 < 5 ? P(HIT_HIGH, { af: -150, ef: -60, ab: -120, eb: -40 }) : P(HIT_MID, { af: -130, ef: -80, ab: -100 });
    // sand streams off them and piles up round their feet
    if (t % 2 === 0)
      for (let i = 0; i < 2 + Math.floor(k * 4); i++)
        ps.add({ kind: 'spark', x: l.x + rand(-10, 10), y: rand(10, 80), vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.4), grav: 0.12, life: 40, max: 40, size: i % 3 ? 1 : 2, color: i % 2 ? SAND : '#b89858', floor: true });
    D.pile = Math.min(14, k * 14);
    if (t === 80) sfx.scream();
    if (t % 30 === 0) SND.sandHiss();
    if (t === 120) SND.curseDrone();
  }
  if (t === 150) {
    // the last of the flesh pours away: only the bones are left standing
    l.showBones = true;
    l.tint = null;
    l.shake = 0;
    l.poseOverride = P(LAUNCHED, { t: -4, h: -10, rot: 0, af: -40, ef: -10, ab: -30, lf: -8, kf: 10, lb: 8, kb: 8 });
    SND.sandHiss();
    sfx.thud();
    for (let i = 0; i < 40; i++) ps.add({ kind: 'spark', x: l.x + rand(-14, 14), y: rand(6, 90), vx: rand(-1.2, 1.2), vy: rand(0, 1.2), grav: 0.15, life: 50, max: 50, size: 2, color: i % 2 ? SAND : '#c8a868', floor: true });
  }
  if (t === 176) {
    f.collapse(l, true, SAND);
    l.showBones = false;
    D.pile = 18;
  }
  if (t >= 190) {
    w.poseOverride = t < 210 ? P(STANCE, { af: -60, ef: -110, ab: 30, eb: -110, t: 10 }) : SALUTE;
    if (t === 196) SND.reel();
    if (t === 214) say(KROFT_LINES.finisher, VOICE);
  }
  return t >= 320;
}

function curseDraw(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const F = f.fatal;
  if (!F || !f.winner || !f.loser) return;
  const D = F.data, t = F.t, w = f.winner, l = f.loser;
  if (!front) {
    // the dune at the loser's feet
    const h = Math.round(D.pile ?? 0);
    if (h > 0) {
      const x = Math.round(l.x - cam);
      for (let y = 0; y < h; y++) {
        const half = Math.round((h - y) * 1.8 + 2);
        ctx.fillStyle = y === h - 1 ? css(lighten(SAND, 0.2)) : y % 3 === 0 ? css(darken(SAND, 0.12)) : SAND;
        ctx.fillRect(x - half, FLOOR - y - 1, half * 2, 1);
      }
    }
    return;
  }
  if (t < 30 || t >= 190) return;
  // the idol in her raised hands, and the golden stream it pulls out of them
  const hx = Math.round(w.wx(w.skel.handF[0]) - cam), hy = FLOOR - Math.round(w.wy(w.skel.handF[1]));
  const glow = t >= 40 && t < 150;
  ctx.drawImage(glow && t % 6 < 3 ? img().idolGlow : img().idol, hx - 6, hy - 13);
  if (glow) {
    const lx = Math.round(l.x - cam), ly = FLOOR - 56;
    for (let i = 0; i < 3; i++) {
      const n = 24;
      let px = hx, py = hy - 8;
      ctx.fillStyle = i === 0 ? '#fff4c0' : i === 1 ? '#ffd040' : '#a0ffb0';
      for (let k = 1; k <= n; k++) {
        const x = Math.round(hx + ((lx - hx) * k) / n + rand(-2, 2)), y = Math.round(hy - 8 + ((ly - hy + 8) * k) / n + Math.sin(k * 0.8 + t * 0.4 + i) * 3);
        ctx.fillRect(Math.min(px, x), Math.min(py, y), Math.abs(x - px) + 1, 1);
        px = x;
        py = y;
      }
    }
  }
}

// ------------------------------------------------------------------ post-match portrait
export const KROFT_PORTRAIT: PortraitStyle = {
  back(_p, c) {
    // choppy chin-length hair behind the jaw
    c.sculpt((m) => m.poly([[18, 34], [46, 24], [50, 84], [44, 92], [38, 86], [32, 94], [24, 86], [18, 90], [16, 62]], '#fff'), c.look.hair, { soft: 3 });
  },
  front(p, c) {
    const L = c.look, g = c.geom;
    // a side-swept fringe falling across the brow
    c.sculpt((m) => m.poly([[40, 22], [70, 26], [84, 38], [80, 46], [74, 40], [66, 42], [58, 36], [46, 36]], '#fff'), L.hair, { soft: 2 });
    const hl = lighten(L.hair, 0.35);
    for (let i = 0; i < 4; i++) p.line(44 + i * 8, 24 + i, 54 + i * 8, 32 + i * 2, hl);
    // goggles parked on the brow over the fringe
    const alt = L.coat === KROFT_ALT.coat;
    const gg = alt ? '#9aa0aa' : GOGGLES;
    p.line(28, 40, 44, 31, darken(gg, 0.5));
    p.line(28, 41, 44, 32, darken(gg, 0.5));
    for (const [x, y] of [[52, 29], [68, 31]]) {
      c.sculpt((m) => m.ellipse(x, y, 7, 5, '#fff'), gg, { soft: 1 });
      c.sculpt((m) => m.ellipse(x, y, 4.5, 3, '#fff'), '#6aa8c0', { soft: 1 });
      p.set(x - 2, y - 1, '#e8f8ff'), p.set(x - 1, y - 1, '#e8f8ff');
    }
    p.line(59, 30, 61, 30, darken(gg, 0.3));
    // freckles and a lip tint (or a split lip for the loser)
    for (const [x, y] of [[62, 56], [66, 58], [70, 55], [58, 58], [73, 59]]) p.set(x, y, L.freckles ?? '#c8865e');
    const [mx, my] = g.mouth;
    p.line(mx - 6, my, mx + 4, my, c.beaten ? '#7a2020' : L.lips ?? '#a8484a');
    // neckerchief knotted at the throat
    const n = alt ? '#d8a830' : '#c4362a';
    c.sculpt((m) => m.poly([[34, 96], [70, 92], [76, 102], [38, 106]], '#fff'), n, { soft: 2 });
    c.sculpt((m) => m.poly([[62, 98], [74, 100], [70, 116], [62, 110]], '#fff'), darken(n, 0.1), { soft: 1 });
  },
};

export function kroft(): CharDef {
  return {
    id: 'kroft', name: 'Laura Kroft', short: 'KROFT', title: 'The Relic Hunter', look: KROFT_LOOK, alt: KROFT_ALT,
    specials, voice: 250, props: { pick: climbingPick() }, intro: KROFT_INTRO, portrait: KROFT_PORTRAIT,
    finisher: { name: 'Curse of the Idol', cmd: [4, 6, 4], btn: 'hp', text: 'B, F, B + HP (any range)', range: [0, 400] },
    fatality: curseOfTheIdol, fatalityDraw: curseDraw,
    quotes: [
      'X MARKS THE SPOT, {L}. THE SPOT WAS YOUR JAW.',
      'I HAVE SURVIVED SEVEN CURSES AND ONE VERY BAD MAP. YOU WERE NUMBER EIGHT.',
      'EVERY RUIN HAS A TRAP. TODAY, THE RUIN WAS YOU.',
      'MIND THE LOOSE FLAGSTONE. AH. TOO LATE.',
    ],
    quotesVs: {
      kingtut: 'YOUR TOMB WAS EASIER TO CRACK THAN YOUR GUARD, PHARAOH.',
      irwin: 'YOU WRESTLE CROCODILES. I DODGE TEMPLE SNAKES. CLOSE, BUT NOT THE SAME.',
      joan: 'A FELLOW WOMAN OF ACTION. SADLY FOR YOU, I PACKED A PICK.',
    },
  };
}
