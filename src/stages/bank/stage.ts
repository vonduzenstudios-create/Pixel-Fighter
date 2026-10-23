import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawText } from '../../gfx/font';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import type { SongName } from '../../audio/music';
import { P, LIE } from '../../game/anims';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "Fort Fortune Trust": the marble banking hall of a made-up old-money bank, after hours.
// Brass teller cages and green desk lamps line the counter, the great round vault door stands
// open in the back wall with gold stacked inside, chandeliers sway, a security camera sweeps
// the floor and the odd banknote flutters down from the mezzanine. The uppercut drops the
// loser through the floor into the deep vault: a soft landing in a mountain of gold coins,
// right up until the safe falls on them. Painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
/** The vault doorway in the far wall: centre and radius. */
const VAULT = { x: 160, y: 118, r: 34 };
/** Chandelier anchors on the mid layer. */
const CHANDELIERS = [70, 200, 330];
/** Teller windows on the mid layer, and the desk lamp under each. */
const WINDOWS = [40, 104, 168, 232, 296, 360];
/** Victim's rest height in the vault close-up. */
const REST = 150;
const SAFE = { x: 104, w: 58, h: 50 };
const SAFE_DROP = 70;
const SAFE_HIT = 84;

const MARBLE = '#e8dcc4';
const BRASS = '#d8a838';
const WOOD = '#5a2e1a';
const GOLD = ['#fff0a0', '#f0c848', '#d8a030', '#a87020'];

/** Cream marble with soft grey veins. */
function marble(p: Painter, x0: number, y0: number, w: number, h: number, base: Color, seed: number) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) p.set(x, y, bayer(x, y) < 0.12 ? darken(base, 0.05) : base);
  for (let v = 0; v < (w * h) / 900 + 1; v++) {
    let x = x0 + r.int(0, w), y = y0 + r.int(0, h);
    const dir = r.range(-0.6, 0.6);
    for (let k = 0; k < r.int(14, 40); k++) {
      x += Math.cos(dir + Math.sin(k * 0.4) * 0.8);
      y += Math.sin(dir + Math.sin(k * 0.4) * 0.8) + 0.3;
      if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) p.set(Math.round(x), Math.round(y), darken(base, 0.18 + (k % 3) * 0.04));
    }
  }
}

/** A fluted marble column with a square base and capital. */
function column(p: Painter, cx: number, top: number, bot: number, base: Color) {
  for (let y = top + 6; y < bot - 6; y++)
    for (let x = cx - 7; x <= cx + 7; x++) {
      const k = x - cx;
      let c: Color = base;
      if (Math.abs(k) % 3 === 0) c = darken(base, 0.12);
      if (k > 3) c = darken(c, 0.22);
      if (k < -4) c = lighten(c, 0.1);
      p.set(x, y, c);
    }
  p.rect(cx - 11, top, 23, 4, lighten(base, 0.05));
  p.rect(cx - 9, top + 4, 19, 2, darken(base, 0.15));
  p.rect(cx - 10, bot - 6, 21, 2, darken(base, 0.15));
  p.rect(cx - 11, bot - 4, 23, 4, lighten(base, 0.05));
}

/** The back wall: coffered ceiling, marble wall, three arched windows onto the night city. */
function hall(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(2401);
  marble(p, 0, 0, W, H, '#d8cab0', 2403);
  // coffered ceiling
  p.rect(0, 0, W, 16, '#3a2414');
  for (let x = 2; x < W; x += 20) {
    p.rect(x, 2, 16, 11, '#5a3a20');
    p.rect(x + 2, 4, 12, 7, '#2a1a0e');
    p.set(x + 8, 7, BRASS);
  }
  p.rect(0, 16, W, 2, BRASS);
  p.rect(0, 18, W, 1, '#7a5420');
  // arched windows with the skyline behind
  for (const wx of [24, 128, 232]) {
    const x0 = wx - 16, x1 = wx + 16, top = 44, bot = 120;
    for (let y = top; y < bot; y++)
      for (let x = x0; x <= x1; x++) {
        const arch = y < top + 16 && Math.hypot(x - wx, y - (top + 16)) > 16;
        if (arch) continue;
        p.set(x, y, mix('#0a0c26', '#2a2048', (y - top) / (bot - top)));
      }
    // towers with lit windows
    for (let bx = x0; bx <= x1; ) {
      const bw = r.int(5, 9), bh = r.int(20, 50);
      for (let y = bot - bh; y < bot; y++)
        for (let x = bx; x < Math.min(x1 + 1, bx + bw); x++) {
          const win = (x - bx) % 3 === 1 && (y - (bot - bh)) % 4 === 2 && bayer(x * 3, y) < 0.45;
          if (y > top + 14 || Math.hypot(x - wx, y - (top + 16)) <= 16) p.set(x, y, win ? '#ffd870' : '#14122a');
        }
      bx += bw + 1;
    }
    // mullions and a brass frame
    p.rect(wx, top, 1, bot - top, '#4a3a22');
    p.rect(x0, top + 40, x1 - x0 + 1, 1, '#4a3a22');
    for (let y = top - 2; y < bot + 2; y++)
      for (let x = x0 - 2; x <= x1 + 2; x++) {
        const d = Math.hypot(x - wx, y - (top + 16));
        const edge = y < top + 16 ? d > 16 && d <= 18 : (x < x0 || x > x1) && y < bot;
        if (edge) p.set(x, y, BRASS);
      }
    p.rect(x0 - 4, bot, x1 - x0 + 9, 3, lighten('#d8cab0', 0.08));
  }
  return p.canvas();
}

/** Far layer: the vault wall with its great round door swung open, columns either side. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(2417);
  const { x: vx, y: vy, r: vr } = VAULT;
  // a darker marble wall section around the vault
  marble(p, vx - 70, 40, 140, 150, '#b8a688', 2419);
  p.rect(vx - 70, 38, 140, 3, BRASS);
  // the doorway: a steel ring around a lit interior full of gold
  for (let y = vy - vr - 6; y <= vy + vr + 6; y++)
    for (let x = vx - vr - 6; x <= vx + vr + 6; x++) {
      const d = Math.hypot(x - vx, y - vy);
      if (d <= vr) {
        const back = y < vy + 10 ? mix('#3a3428', '#6a5a38', (y - (vy - vr)) / (vr + 10)) : '#4a3a20';
        p.set(x, y, back);
      } else if (d <= vr + 6) p.set(x, y, d < vr + 2 ? '#3a3a42' : x - vx + (y - vy) < 0 ? '#9a9aa8' : '#6a6a78');
    }
  // shelves of gold bars and money bags inside
  for (const sy of [vy - 14, vy + 4, vy + 22]) {
    p.rect(vx - vr + 6, sy + 6, vr * 2 - 12, 2, '#2a2218');
    for (let x = vx - vr + 8; x < vx + vr - 8; x += 6) {
      const d = Math.abs(x - vx) / vr;
      if (Math.sqrt(1 - Math.min(1, d * d)) * vr < Math.abs(sy - vy) + 4) continue;
      p.rect(x, sy + 2, 5, 4, GOLD[2]);
      p.rect(x + 1, sy + 2, 3, 1, GOLD[0]);
      if (r.next() < 0.5) { p.rect(x + 1, sy - 1, 4, 3, GOLD[1]); p.set(x + 2, sy - 1, GOLD[0]); }
    }
  }
  p.ellipse(vx - 14, vy + 30, 6, 5, '#8a7a50'); // money bags on the floor
  p.ellipse(vx + 12, vy + 31, 5, 4, '#7a6a44');
  p.rect(vx - 15, vy + 24, 3, 2, '#5a4a30');
  // the door itself, swung open to the right: a thick steel disc seen side-on
  const dx = vx + vr + 18;
  p.ellipse(dx, vy, 12, vr + 4, '#7a7a88');
  p.ellipse(dx - 2, vy, 9, vr + 1, '#a0a0b0');
  for (let k = -3; k <= 3; k++) p.rect(dx - 9, vy + k * 9, 3, 2, '#c8c8d4'); // locking bolts
  // spoked wheel on the door face
  p.ellipse(dx, vy, 4, 10, '#5a5a66');
  for (let a = 0; a < 6; a++) {
    const t = (a / 6) * Math.PI * 2;
    p.line(dx, vy, dx + Math.round(Math.cos(t) * 3), vy + Math.round(Math.sin(t) * 13), '#d8d8e0');
  }
  // hinge
  p.rect(vx + vr + 4, vy - 20, 6, 8, '#4a4a54');
  p.rect(vx + vr + 4, vy + 12, 6, 8, '#4a4a54');
  // columns framing the vault wall
  for (const cx of [vx - 92, vx + 92]) column(p, cx, 40, 190, '#e0d4ba');
  // a plain floor line behind the counter
  p.rect(0, 186, FAR_W, H - 186, '#6a5440');
  p.shade(0.1, 1, -1);
  p.outline('#2a1c10');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  drawText(ctx, 'FORT FORTUNE TRUST', vx, 50, '#f0c848', { align: 'center', outline: '#3a2410' });
  return cv;
}

/** Mid layer: the long teller counter with brass cages, plaques and green desk lamps. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const top = 118, counter = 150;
  // brass cage work above the counter
  for (const wx of WINDOWS) {
    const x0 = wx - 26, x1 = wx + 26;
    // marble piers between windows
    marble(p, x0, top - 8, 6, counter - top + 8, MARBLE, wx);
    marble(p, x1 - 5, top - 8, 6, counter - top + 8, MARBLE, wx + 1);
    // arched grille
    for (let x = x0 + 8; x < x1 - 6; x += 4) {
      const d = Math.abs(x - wx) / 20;
      const ty = top + Math.round((1 - Math.sqrt(Math.max(0, 1 - d * d))) * 8);
      p.rect(x, ty, 1, counter - ty, BRASS);
    }
    for (let x = x0 + 6; x < x1 - 5; x++) {
      const d = Math.abs(x - wx) / 21;
      p.set(x, top - 1 + Math.round((1 - Math.sqrt(Math.max(0, 1 - d * d))) * 8), lighten(BRASS, 0.2));
      p.set(x, counter - 18, BRASS);
    }
    // the transaction slot
    p.rect(wx - 8, counter - 6, 17, 6, '#1a1008');
    // brass name plaque
    p.rect(wx - 7, top - 12, 15, 4, BRASS);
    p.rect(wx - 6, top - 11, 13, 2, '#7a5420');
  }
  // cornice along the top of the screen
  p.rect(0, top - 16, MID_W, 4, MARBLE);
  p.rect(0, top - 12, MID_W, 2, darken(MARBLE, 0.25));
  // the counter: marble top over panelled dark wood
  p.rect(0, counter, MID_W, 4, lighten(MARBLE, 0.05));
  p.rect(0, counter + 4, MID_W, 1, darken(MARBLE, 0.3));
  for (let y = counter + 5; y < 188; y++)
    for (let x = 0; x < MID_W; x++) {
      const panel = (x % 32 < 2 || (y - counter - 5) % 30 < 2) ? darken(WOOD, 0.3) : (x % 32 === 3 || (y - counter - 5) % 30 === 3) ? lighten(WOOD, 0.15) : WOOD;
      p.set(x, y, bayer(x, y) < 0.1 ? darken(panel, 0.1) : panel);
    }
  p.rect(0, 186, MID_W, 2, BRASS);
  // green banker's lamps on the counter
  for (const wx of WINDOWS) {
    const lx = wx + 16;
    p.rect(lx, counter - 2, 6, 2, BRASS);
    p.rect(lx + 2, counter - 7, 1, 5, BRASS);
    p.poly([[lx - 2, counter - 7], [lx + 1, counter - 11], [lx + 7, counter - 11], [lx + 8, counter - 7]], '#1e7a40');
    p.rect(lx - 2, counter - 7, 11, 1, '#0e4a22');
  }
  p.shade(0.12, 1, -1);
  p.outline('#1e120a');
  return p.canvas();
}

/** The banking-hall floor: diamond-check marble, velvet ropes and sacks of cash at either end. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  // velvet rope stanchions along the back of the floor
  const posts = [30, 80, 130, 382, 432, 482];
  for (let i = 0; i < posts.length; i++) {
    const x = posts[i];
    p.rect(x - 1, FLOOR - 20, 3, 20, BRASS);
    p.ellipse(x, FLOOR - 21, 2, 2, lighten(BRASS, 0.2));
    p.rect(x - 4, FLOOR - 2, 9, 2, darken(BRASS, 0.2));
    const nx = posts[i + 1];
    if (nx && nx - x < 100)
      for (let k = 0; k <= nx - x; k++) {
        const sag = Math.round(Math.sin((k / (nx - x)) * Math.PI) * 6);
        p.rect(x + k, FLOOR - 18 + sag, 1, 2, k % 5 ? '#9a1428' : '#c02038');
      }
  }
  // money sacks and a stack of cash bricks at each end
  for (const [sx, dir] of [[10, 1], [STAGE_W - 10, -1]]) {
    p.ellipse(sx, FLOOR - 7, 8, 7, '#a8925a');
    p.rect(sx - 2, FLOOR - 16, 5, 3, '#7a6438');
    // a dollar sign stencilled on the sack
    ['.###', '#.#.', '.##.', '..##', '###.'].forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.set(sx - 2 + i, FLOOR - 10 + j, '#2a5a2a')));
    p.rect(sx, FLOOR - 11, 1, 7, '#2a5a2a');
    for (let k = 0; k < 4; k++) {
      const bx = sx + dir * 12 + (dir > 0 ? 0 : -12);
      p.rect(bx, FLOOR - 4 - k * 4, 12, 4, '#4a8a4a');
      p.rect(bx + 5, FLOOR - 4 - k * 4, 2, 4, '#e8e0c0');
    }
  }
  p.shade(0.15, 1, -1);
  p.outline('#1a0e08');
  // polished floor: black and cream diamonds with a soft reflection band
  for (let y = FLOOR; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const u = Math.floor((x + (y - FLOOR) * 1.6) / 16), v = Math.floor((x - (y - FLOOR) * 1.6 + 1000) / 16);
      let c: Color = (u + v) % 2 ? '#e8dcc4' : '#2a2430';
      if (y === FLOOR) c = '#fff4dc';
      if (y > FLOOR + 1 && y < FLOOR + 4 && bayer(x, y) < 0.35) c = lighten(c, 0.2);
      if (y > FLOOR + 12 && bayer(x, y) < (y - FLOOR - 12) / 40) c = darken(c, 0.35);
      p.set(x, y, c);
    }
  // brass inlay border and the bank's star at centre
  p.rect(0, FLOOR + 6, STAGE_W, 1, BRASS);
  for (let x = 236; x < 276; x++) {
    const d = Math.abs(x - 256) / 20;
    const h = Math.round((1 - d) * 4);
    for (let y = FLOOR + 3 - h; y <= FLOOR + 3 + h; y++) if (y > FLOOR) p.set(x, y, d < 0.3 ? GOLD[0] : BRASS);
  }
  return p.canvas();
}

/** The deep vault: walls of deposit boxes over a mountain of coin, and the last robber. */
function vault(bones: PartSet): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(2459);
  p.gradRect(0, 0, W, H, '#2a2620', '#0a0806', 8);
  // safe-deposit boxes floor to ceiling
  for (let y = 0; y < 170; y += 12)
    for (let x = (y / 12) % 2 ? -10 : 0; x < W; x += 20) {
      const shade = 1 - y / 220;
      p.rect(x, y, 19, 11, mix('#3a3428', '#8a7a58', shade * 0.8));
      p.rect(x + 1, y + 1, 17, 1, mix('#4a4232', '#b0a078', shade * 0.8));
      p.rect(x + 8, y + 4, 3, 3, mix('#2a2218', BRASS, shade));
      p.set(x + 9, y + 5, '#1a1208');
      if (r.next() < 0.08) p.rect(x + 1, y + 2, 17, 8, '#0e0a06'); // a box hanging open
    }
  // a spotlight from the hole in the ceiling
  p.rect(98, 0, 60, 6, '#fff0c8');
  for (let y = 6; y < 200; y++) {
    const half = 30 + (y - 6) * 0.22;
    for (let x = Math.floor(128 - half); x < 128 + half; x++) {
      const edge = 1 - Math.abs(x - 128) / half;
      if (bayer(x, y) < edge * 0.28 * (1 - y / 300)) p.set(x, y, mix(p.get(x, y), '#ffe8a0', 0.35));
    }
  }
  // the coin mountain
  for (let x = 0; x < W; x++) {
    const top = Math.round(REST - 6 + Math.abs(x - 128) * 0.28 + Math.sin(x * 0.2) * 2 + Math.sin(x * 0.05) * 3);
    for (let y = Math.max(top, 0); y < H; y++) {
      const g = (x * 7 + y * 13) % 5;
      let c: Color = g === 0 ? GOLD[0] : g < 3 ? GOLD[1] : GOLD[2];
      if (y > top + 30 && bayer(x, y) < (y - top - 30) / 40) c = GOLD[3];
      if (y === top) c = GOLD[0];
      p.set(x, y, c);
    }
  }
  // gold bar stacks and fat money bags half buried
  for (const [bx, by] of [[20, 186], [214, 184]]) {
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 3 - row; k++) {
        const x = bx + k * 10 + row * 5, y = by - row * 5;
        p.rect(x, y, 10, 5, GOLD[2]);
        p.rect(x + 1, y, 8, 1, GOLD[0]);
        p.rect(x + 9, y + 1, 1, 4, GOLD[3]);
      }
  }
  for (const [mx, my] of [[64, 178], [188, 180]]) {
    p.ellipse(mx, my, 9, 8, '#a8925a');
    p.rect(mx - 2, my - 10, 5, 3, '#7a6438');
    p.rect(mx - 1, my - 4, 3, 7, '#2a5a2a');
  }
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // a robber who never made it back out
  ctx.save();
  ctx.translate(40, 172);
  drawRig(ctx, bones, fk(P(LIE, { rot: -100, af: -130, ab: 50, lf: -30, kf: 50, h: 20 })));
  ctx.restore();
  return cv;
}

/** The safe that drops on the victim. */
function safe(): HTMLCanvasElement {
  const { w, h } = SAFE;
  const p = new Painter(w, h + 4);
  p.rect(0, 0, w, h, '#3a4a42');
  p.rect(2, 2, w - 4, h - 4, '#4a5e54');
  p.rect(5, 5, w - 10, h - 12, '#3e5048');
  p.rect(2, 2, w - 4, 1, '#6a8478');
  // dial and handle
  p.ellipse(w / 2 - 6, h / 2 - 3, 7, 7, '#c8c8d0');
  p.ellipse(w / 2 - 6, h / 2 - 3, 5, 5, '#2a2a30');
  p.set(w / 2 - 6, h / 2 - 8, '#ffffff');
  p.rect(w / 2 + 8, h / 2 - 8, 3, 12, BRASS);
  // gold pinstripe and stubby feet
  p.rect(5, h - 6, w - 10, 1, BRASS);
  p.rect(3, h, 6, 4, '#1a1e1c');
  p.rect(w - 9, h, 6, 4, '#1a1e1c');
  p.outline('#0a0e0c');
  const cv = p.canvas();
  drawText(cv.getContext('2d')!, 'FORT', w / 2, h - 13, '#f0c848', { align: 'center' });
  return cv;
}

export class BankStage {
  name = 'FORT FORTUNE TRUST';
  blurb = 'NO WITHDRAWALS AFTER CLOSING';
  song: SongName = 'bank';
  hall = hall();
  far = far();
  mid = mid();
  deck = deck();
  safe = safe();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = vault(bones);
  }

  pitLanding: PitLanding = {
    rest: REST,
    length: 210,
    pose: P(LIE, { rot: -90, af: -140, ef: -20, ab: -120, eb: -30, lf: 10, kf: 20 }),
    land: (f) => {
      sfx.kaching();
      sfx.crunch();
      this.coinBurst(f, 30, 3.5);
    },
    tick: (f, it) => this.vaultStep(f, it),
    draw: (ctx, it) => this.vaultDraw(ctx, it),
    victim: (l, it) => {
      // swimming happily in the coins, then the legs kick under the safe
      const j = it < SAFE_HIT ? Math.sin(it * 0.25) * 25 : it < SAFE_HIT + 60 ? Math.sin(it * 1.3) * (1 - (it - SAFE_HIT) / 60) * 35 : 0;
      l.poseOverride = P(LIE, { rot: -90, af: -140 + j, ef: -20, ab: -120 - j, eb: -30, lf: 10 + j * 0.6, kf: 20 + Math.abs(j) * 0.6, lb: -j * 0.5, kb: 15 });
      l.computePose();
      return Math.min(7, it * 0.12);
    },
  };

  coinBurst(f: Fight, n: number, force: number) {
    for (let i = 0; i < n; i++)
      f.pitParticles.add({ kind: 'spark', x: 128 + rand(-30, 30), y: H - REST + rand(0, 6), vx: rand(-1.4, 1.4) * force * 0.5, vy: rand(1, force), life: 50, max: 50, color: GOLD[i % 3], size: rand(0, 1) < 0.5 ? 2 : 1, grav: 0.14, floor: false });
  }

  vaultStep(f: Fight, it: number) {
    if (it < SAFE_DROP && it % 14 === 0) {
      sfx.kaching();
      this.coinBurst(f, 4, 2);
    }
    if (it === SAFE_DROP) sfx.whoosh(2);
    if (it === SAFE_HIT) {
      sfx.thud();
      sfx.hit(2);
      sfx.crunch();
      f.shake(12);
      this.coinBurst(f, 40, 4.5);
      f.pitParticles.blood(128, H - REST, -1, 30, 1.4);
      f.pitParticles.blood(128, H - REST, 1, 30, 1.4);
    }
    if (it === SAFE_HIT + 30) sfx.kaching();
    // banknotes come fluttering down after the dust settles
    if (it > SAFE_HIT && it % 5 === 0)
      f.pitParticles.add({ kind: 'mist', x: rand(40, 216), y: H + 4, vx: rand(-0.4, 0.4), vy: -rand(0.3, 0.7), life: 120, max: 120, color: rand(0, 1) < 0.5 ? '#7aba6a' : '#5a9a4a', size: 3, grav: 0, floor: false });
  }

  vaultDraw(ctx: CanvasRenderingContext2D, it: number) {
    // coins lapping over the victim as they sink in, tapering into the pile
    for (let x = 84; x < 172; x++) {
      const d = (x - 128) / 44;
      const y = Math.round(REST - 8 + d * d * 15 + Math.sin(x * 0.7 + it * 0.1) * 1.2);
      for (let yy = y; yy < REST + 8; yy++) {
        const g = (x * 7 + yy * 13) % 5;
        ctx.fillStyle = yy === y || g === 0 ? GOLD[0] : g < 3 ? GOLD[1] : GOLD[2];
        ctx.fillRect(x, yy, 1, 1);
      }
    }
    if (it < SAFE_DROP) return;
    // the safe falls from the hole above and lands on them
    const k = Math.min(1, (it - SAFE_DROP) / (SAFE_HIT - SAFE_DROP));
    const bottom = REST + 6;
    const y0 = -SAFE.h - 10, y1 = bottom - SAFE.h;
    const y = Math.round(y0 + (y1 - y0) * k * k);
    if (it < SAFE_HIT) {
      // its shadow growing on the coins
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`;
      ctx.fillRect(SAFE.x + 6 - Math.round((1 - k) * 4), REST + 2, SAFE.w - 12 + Math.round((1 - k) * 8), 3);
    }
    const sq = it >= SAFE_HIT && it < SAFE_HIT + 4 ? 3 : 0; // a squash on impact
    ctx.drawImage(this.safe, SAFE.x - sq, y + sq, SAFE.w + sq * 2, SAFE.h + 4 - sq);
    if (it > SAFE_HIT) {
      // blood seeping out across the gold
      const w = Math.min(46, (it - SAFE_HIT) * 0.5);
      ctx.fillStyle = '#9a0810';
      ctx.fillRect(Math.round(SAFE.x - w * 0.4), bottom + 3, Math.round(SAFE.w + w * 0.8), 2);
      ctx.fillStyle = '#c01018';
      ctx.fillRect(Math.round(SAFE.x - w * 0.25), bottom + 3, Math.round(SAFE.w + w * 0.5), 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.hall, 0, 0);
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    // gold glinting in the open vault
    const fx = VAULT.x - Math.round(camX * 0.25);
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.03 + i * 2.3) % 6;
      if (ph > 1) continue;
      const gx = fx - 24 + ((i * 23) % 48), gy = VAULT.y - 12 + ((i * 17) % 34);
      ctx.fillStyle = '#ffffff';
      const s = ph < 0.5 ? 1 : 2;
      ctx.fillRect(gx - s, gy, s * 2 + 1, 1);
      ctx.fillRect(gx, gy - s, 1, s * 2 + 1);
    }
    const mx = -Math.round(camX * 0.55);
    // chandeliers hang in front of the far wall, swaying a little
    for (const cx0 of CHANDELIERS) {
      const sw = Math.sin(t * 0.02 + cx0) * 2;
      const cx = Math.round(cx0 + mx + sw);
      if (cx < -30 || cx > W + 30) continue;
      ctx.fillStyle = '#7a5420';
      ctx.fillRect(Math.round(cx0 + mx + sw * 0.3), 0, 1, 40);
      ctx.fillStyle = BRASS;
      ctx.fillRect(cx - 14, 40, 29, 2);
      ctx.fillRect(cx - 9, 46, 19, 2);
      ctx.fillRect(cx - 1, 38, 3, 14);
      ctx.fillStyle = '#e8f0ff';
      for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * 6, 42, 1, 3 + ((k + 2) % 2)); // crystals
      for (let k = -3; k <= 3; k++) {
        const fl = Math.sin(t * 0.3 + k * 1.7 + cx0) > 0.3 ? 1 : 0;
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(cx + k * 4, 37 - fl, 1, 2 + fl); // candle flames
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,220,140,0.05)';
      for (const rr of [26, 16]) ctx.fillRect(cx - rr, 42 - rr * 0.6, rr * 2, rr * 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(this.mid, mx, 0);
    // desk lamps glow on the marble
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(160,255,170,0.06)';
    for (const wx of WINDOWS) {
      const lx = wx + 19 + mx;
      if (lx < -20 || lx > W + 20) continue;
      ctx.fillRect(lx - 8, 140, 16, 10);
      ctx.fillRect(lx - 4, 142, 8, 8);
    }
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // a security camera on the far column, sweeping back and forth with its red light
    const camSx = Math.round(VAULT.x - 92 - camX * 0.25);
    const pan = Math.sin(t * 0.012);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(camSx - 1, 52, 3, 4);
    ctx.fillStyle = '#d8d8e0';
    ctx.fillRect(camSx - 4 + Math.round(pan * 3), 56, 9, 4);
    ctx.fillStyle = '#4a4a54';
    ctx.fillRect(camSx + (pan > 0 ? 5 : -5) + Math.round(pan * 3), 57, 1, 2);
    if (Math.floor(t / 30) % 2) {
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(camSx + Math.round(pan * 3), 57, 1, 1);
    }
  }

  /** Banknotes fluttering down from the mezzanine, and a sheen sliding along the polished floor. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 4; i++) {
      const cyc = 700 + i * 130;
      const ph = (t + i * 311) % cyc;
      if (ph > 460) continue;
      const wx = ((i * 137 + 60) % STAGE_W);
      const x = Math.round(wx - camX + Math.sin(ph * 0.04 + i) * 14);
      const y = Math.round(-6 + ph * 0.42);
      if (x < -10 || x > W + 10 || y > FLOOR + 2) continue;
      const flip = Math.abs(Math.sin(ph * 0.09 + i));
      const w = Math.max(1, Math.round(7 * flip));
      ctx.fillStyle = flip > 0.5 ? '#7aba6a' : '#4a8a3a';
      ctx.fillRect(x - (w >> 1), y, w, 3);
      if (w > 4) {
        ctx.fillStyle = '#d8ecc8';
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }
    const sheen = ((t * 0.8 - camX) % (W + 120) + W + 120) % (W + 120) - 60;
    ctx.fillStyle = 'rgba(255,250,230,0.08)';
    ctx.fillRect(Math.round(sheen), FLOOR + 1, 30, 3);
    ctx.fillRect(Math.round(sheen) + 8, FLOOR + 4, 14, 2);
  }
}
