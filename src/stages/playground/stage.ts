import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { ac, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { P, LAUNCHED } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "Recess Yard": an elementary school playground on a sunny afternoon. A brick schoolhouse with
// paper cut-outs in the windows, a chain-link fence lined with kids cheering the fight from a safe
// distance, and a blacktop painted with hopscotch and four-square. Swings sway, the seesaw rocks,
// a tetherball winds itself round its pole and a red kickball rolls about underfoot. Everything is
// painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.5);
const GRASS = 146; // fence foot / where the kids stand
const CHIPS = 156; // top of the wood-chip bed under the equipment
const CURB = 170; // the blacktop starts below the curb
const BALL_R = 4;

/** Swing seats on the swing set: pivot x and chain length. */
const SWINGS = [{ x: 38, len: 44, ph: 0 }, { x: 64, len: 44, ph: 2.1 }, { x: 90, len: 44, ph: 4.0 }];
const SWING_TOP = 114;
const POLE = { x: 452, top: 104 };
const SAW = { x: 492, y: 158 };

interface Kid { x: number; y: number; skin: string; hair: string; shirt: string; legs: string; ph: number; tall: number; pony: boolean; sit?: boolean }

const SKINS = ['#f4d0b0', '#e0b088', '#c08860', '#8a5a3a', '#5a3a26', '#f0c8a0'];
const HAIRS = ['#2a1a10', '#141014', '#6a3a1a', '#d8a848', '#a04a20', '#3a2414'];
const SHIRTS = ['#e04040', '#3a7ae0', '#f0c020', '#40b060', '#a050d0', '#f08030', '#20b0b0', '#f070a0'];
const LEGS = ['#2a4a8a', '#3a3a48', '#6a4a2a', '#2a6a4a', '#8a2a3a'];

/** Static sky: bright afternoon gradient, the sun, far rooftops and treeline. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, 140, '#4a8ee0', '#c4e6ff', 8);
  // sun with a dithered glow
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < 70; x++) {
      const d = Math.hypot(x - 30, y - 22);
      if (d < 10) p.set(x, y, d < 8 ? '#fff8d0' : '#ffe890');
      else if (d < 26 && bayer(x, y) < (1 - (d - 10) / 16) * 0.5) p.set(x, y, lighten(p.get(x, y), 0.3));
    }
  // a far line of houses and trees
  const r = rng(1401);
  for (let x = 0; x < W; ) {
    const w = r.int(18, 30), top = r.int(86, 96);
    if (r.next() < 0.5) {
      p.rect(x, top, w, 40, '#8aa8c8');
      p.poly([[x - 2, top], [x + w + 2, top], [x + w / 2, top - 8]], '#7890b0');
    } else
      for (let k = 0; k < 3; k++) p.ellipse(x + w / 2 + r.range(-4, 4), top + r.range(-2, 4), w / 2, 9, '#7aa0a0');
    x += w + r.int(0, 6);
  }
  return p.canvas();
}

/** The schoolhouse at half parallax: red brick, decorated windows, doors, clock and a pennant. */
function school(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1409);
  const top = 46, base = 140;
  const x0 = 40, x1 = FAR_W - 40;
  // trees at either end
  for (const [tx, ty] of [[18, 70], [FAR_W - 22, 66], [x0 + 8, 80], [x1 - 6, 84]]) {
    p.rect(tx - 2, ty + 20, 5, base - ty - 20, '#5a3a20');
    for (let k = 0; k < 6; k++) {
      const cx = tx + r.range(-12, 12), cy = ty + r.range(-10, 14), rr = r.range(9, 14);
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++)
        for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
          const dx = (x - cx) / rr, dy = (y - cy) / rr, d = dx * dx + dy * dy;
          if (d > 1 || bayer(x, y) < (d - 0.8) * 4) continue;
          p.set(x, y, dy < -0.3 && dx < 0.3 ? '#6ac050' : d > 0.6 && bayer(x, y) < 0.5 ? '#2a7030' : '#40a040');
        }
    }
  }
  // brick wall
  for (let y = top; y < base; y++)
    for (let x = x0; x < x1; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      p.set(x, y, mortar ? '#c8a898' : darken('#b04a34', ((row * 7 + Math.floor((x + off) / 8) * 3) % 5) * 0.04));
    }
  // flat roof with a cap and a gutter
  p.rect(x0 - 4, top - 6, x1 - x0 + 8, 6, '#5a5a66');
  p.rect(x0 - 4, top - 6, x1 - x0 + 8, 1, '#8a8a96');
  p.rect(x0 - 4, top, x1 - x0 + 8, 1, '#3a3a44');
  // a stone base course
  p.rect(x0, base - 6, x1 - x0, 6, '#a8a098');
  p.rect(x0, base - 6, x1 - x0, 1, '#c8c0b8');
  // two rows of classroom windows with paper cut-outs taped inside
  const mid = (x0 + x1) / 2;
  for (const wy of [54, 92]) {
    for (let wx = x0 + 10; wx < x1 - 28; wx += 30) {
      if (Math.abs(wx + 11 - mid) < 26) continue; // room for the doors
      p.rect(wx - 1, wy - 1, 24, 22, '#e8e4dc');
      p.gradRect(wx, wy, 22, 20, '#8ac0e8', '#4a7aa8', 4);
      p.rect(wx + 10, wy, 2, 20, '#e8e4dc');
      p.rect(wx, wy + 9, 22, 2, '#e8e4dc');
      p.rect(wx - 2, wy + 21, 26, 2, '#c8c0b8'); // sill
      // cut-outs: a star, a flower, a sun, a handprint-ish blob
      const kind = r.int(0, 4), cx = wx + r.pick([4, 15]), cy = wy + r.pick([3, 13]);
      const c = r.pick(['#ffe040', '#ff6a8a', '#7ae060', '#ff9a30', '#a07aff']);
      if (kind === 0) p.poly([[cx, cy - 3], [cx + 1, cy], [cx + 4, cy], [cx + 2, cy + 2], [cx + 3, cy + 5], [cx, cy + 3], [cx - 3, cy + 5], [cx - 2, cy + 2], [cx - 4, cy], [cx - 1, cy]], c);
      else if (kind === 1) {
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) p.ellipse(cx + dx, cy + dy, 1.6, 1.6, c);
        p.set(cx, cy, '#fff4a0');
      } else if (kind === 2) {
        p.ellipse(cx, cy, 2.5, 2.5, '#ffd020');
        for (let a = 0; a < 8; a++) p.set(Math.round(cx + Math.cos(a * 0.785) * 4), Math.round(cy + Math.sin(a * 0.785) * 4), '#ffd020');
      } else {
        p.rect(cx - 2, cy - 1, 5, 4, c);
        for (let k = 0; k < 4; k++) p.set(cx - 2 + k + (k > 1 ? 1 : 0), cy - 2 - (k % 2), c);
      }
    }
  }
  // double doors under an arch, with a round wall clock above
  p.rect(mid - 20, 88, 40, base - 88, '#d8d0c4');
  p.ellipse(mid, 88, 20, 8, '#d8d0c4');
  p.rect(mid - 16, 94, 15, base - 94 - 6, '#2a6ab0');
  p.rect(mid + 1, 94, 15, base - 94 - 6, '#2a6ab0');
  for (const dx of [-14, 3]) p.rect(mid + dx, 98, 11, 12, '#a8d0f0');
  p.rect(mid - 3, 116, 2, 4, '#e8d070');
  p.rect(mid + 1, 116, 2, 4, '#e8d070');
  p.ellipse(mid, 70, 9, 9, '#3a3a44');
  p.ellipse(mid, 70, 7, 7, '#f4f0e8');
  for (let a = 0; a < 12; a++) p.set(Math.round(mid + Math.cos(a * 0.5236) * 6), Math.round(70 + Math.sin(a * 0.5236) * 6), '#3a3a44');
  p.line(mid, 70, mid, 65, '#141014');
  p.line(mid, 70, mid + 4, 71, '#141014');
  // a flagpole by the doors flying a striped school pennant
  const fx = mid + 36;
  p.rect(fx, 18, 2, base - 18, '#c8ccd4');
  p.ellipse(fx + 1, 17, 2, 2, '#e8d070');
  for (let y = 22; y < 36; y++) {
    const len = Math.round(28 * (1 - (y - 22) / 14) + 2);
    for (let x = 0; x < len; x++) p.set(fx + 2 + x, y + Math.round(Math.sin(x * 0.3) * 1.5), y < 27 ? '#2a5ad0' : y < 31 ? '#f4c020' : '#2a5ad0');
  }
  // bike rack and a few bikes by the wall
  for (let bx = x0 + 20; bx < x0 + 70; bx += 14) {
    p.ellipse(bx, base - 4, 4, 4, '#2a2a30');
    p.ellipse(bx, base - 4, 3, 3, '#a8a098');
    p.ellipse(bx + 9, base - 4, 4, 4, '#2a2a30');
    p.ellipse(bx + 9, base - 4, 3, 3, '#a8a098');
    p.line(bx, base - 4, bx + 5, base - 9, r.pick(['#e03030', '#30a0e0', '#40c040']));
    p.line(bx + 5, base - 9, bx + 9, base - 4, '#e03030');
  }
  return p.canvas();
}

/** The fence line behind the kids: a grass bank and chain-link with steel posts. */
function fence(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const top = 118;
  for (let y = 136; y < CHIPS + 4; y++)
    for (let x = 0; x < STAGE_W; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#4aa040' : (x * 7 + y * 3) % 11 === 0 ? '#70c858' : '#58b048');
  for (let y = top; y < GRASS + 2; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const k1 = (x + y) % 6, k2 = (x - y + 600) % 6;
      if (k1 === 0 || k2 === 0) p.set(x, y, y < top + 2 ? '#b8bcc8' : '#9aa0ac', 220);
    }
  p.rect(0, top, STAGE_W, 2, '#c8ccd4');
  for (let x = 6; x < STAGE_W; x += 48) {
    p.rect(x, top - 2, 3, GRASS + 2 - top + 2, '#a8acb8');
    p.rect(x, top - 2, 1, GRASS + 2 - top + 2, '#d8dce4');
    p.rect(x - 1, top - 3, 5, 2, '#c8ccd4');
  }
  return p.canvas();
}

/** Equipment, wood chips and the painted blacktop the fighters stand on. */
function yard(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1423);
  // wood chips
  for (let y = CHIPS; y < CURB; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const n = (x * 13 + y * 7 + ((x * y) % 5)) % 9;
      p.set(x, y, n < 2 ? '#8a5a30' : n < 4 ? '#c08850' : n === 4 ? '#5a3a1c' : '#a8703c');
    }
  // concrete curb
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, CURB, '#e0dcd4');
    p.set(x, CURB + 1, '#c0bcb4');
    p.set(x, CURB + 2, '#8a8680');
  }
  // blacktop with a little speckle, fading darker toward the camera
  for (let y = CURB + 3; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      let c: Color = mix('#4a4a52', '#34343c', (y - CURB) / (H - CURB));
      const n = (x * 31 + y * 17) % 23;
      if (n === 0) c = lighten(c, 0.15);
      else if (n === 7) c = darken(c, 0.15);
      p.set(x, y, c);
    }
  const paint = (x: number, y: number, c: Color) => {
    if (y > CURB + 2 && bayer(x, y) > 0.08) p.set(x, y, c);
  };
  const box = (x0: number, y0: number, w: number, h: number, c: Color) => {
    for (let x = x0; x <= x0 + w; x++) { paint(x, y0, c); paint(x, y0 + h, c); }
    for (let y = y0; y <= y0 + h; y++) { paint(x0, y, c); paint(x0 + w, y, c); }
  };
  // hopscotch, seen at a slope: 1, 2, 3-4, 5, 6-7, 8, home
  const hx = 30, hy = 214;
  const cells: [number, number, number][] = [[0, 0, 1], [0, -8, 1], [-1, -16, 2], [0, -24, 1], [-1, -32, 2], [0, -40, 1]];
  for (const [ox, oy, n] of cells) for (let k = 0; k < n; k++) box(hx + (ox + k) * 16 + (oy * -0.4), hy + oy, 16, 8, '#f4f0e8');
  // four-square on the right, colour-blocked corners
  const fx = 390, fy = 182;
  const fc = ['#e04848', '#3a7ae0', '#f0c020', '#40b060'];
  fc.forEach((c, i) => {
    const cx = fx + (i % 2) * 40, cy = fy + Math.floor(i / 2) * 18;
    for (let y = cy + 2; y < cy + 16; y += 3) for (let x = cx + 3; x < cx + 37; x += 3) paint(x, y, darken(c, 0.35));
  });
  box(fx, fy, 80, 36, '#f4f0e8');
  for (let y = fy; y <= fy + 36; y++) paint(fx + 40, y, '#f4f0e8');
  for (let x = fx; x <= fx + 80; x++) paint(x, fy + 18, '#f4f0e8');
  // a painted sun in the middle of the yard
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    paint(Math.round(256 + Math.cos(a) * 22), Math.round(196 + Math.sin(a) * 7), '#f0c020');
    if (Math.floor(a * 1.91) % 2 === 0) paint(Math.round(256 + Math.cos(a) * 30), Math.round(196 + Math.sin(a) * 10), '#f0c020');
  }
  // a chalk drawing: a stick-figure sun-face and a heart
  for (let a = 0; a < Math.PI * 2; a += 0.08) paint(Math.round(140 + Math.cos(a) * 6), Math.round(206 + Math.sin(a) * 3), '#ff9ad0');
  paint(138, 205, '#ff9ad0');
  paint(142, 205, '#ff9ad0');
  for (let x = -2; x <= 2; x++) paint(140 + x, 207 + (Math.abs(x) < 2 ? 1 : 0), '#ff9ad0');
  for (const [dx, dy] of [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]]) paint(330 + dx, 210 + dy, '#a8e8ff');

  // --- the equipment, standing in the wood chips ---
  const steel = (x0: number, y0: number, x1: number, y1: number, c: Color) => {
    p.line(x0, y0, x1, y1, c);
    p.line(x0 + 1, y0, x1 + 1, y1, darken(c, 0.3));
  };
  // swing set: an A-frame each end and a top bar (chains and seats are drawn live)
  for (const ax of [20, 108]) {
    steel(ax - 8, CHIPS + 8, ax, SWING_TOP, '#d83a3a');
    steel(ax + 8, CHIPS + 8, ax, SWING_TOP, '#d83a3a');
  }
  p.rect(18, SWING_TOP - 2, 94, 3, '#3a6ad0');
  p.rect(18, SWING_TOP - 2, 94, 1, '#7aa0f0');
  // slide: a ladder, a platform with a roof, and a long yellow chute down toward the blacktop
  const sx = 150;
  for (const lx of [sx, sx + 12]) steel(lx, CHIPS + 10, lx, 100, '#3a6ad0');
  for (let y = 104; y < CHIPS + 8; y += 7) p.rect(sx, y, 13, 2, '#9aa0ac');
  p.rect(sx - 2, 98, 24, 4, '#3a6ad0');
  p.rect(sx - 2, 98, 24, 1, '#7aa0f0');
  for (const lx of [sx - 2, sx + 20]) p.rect(lx, 78, 2, 20, '#3a6ad0');
  p.poly([[sx - 6, 80], [sx + 26, 80], [sx + 10, 68]], '#f08030');
  p.poly([[sx - 6, 80], [sx + 10, 80], [sx + 10, 68]], '#ff9a50');
  for (let i = 0; i <= 56; i++) {
    const x = sx + 22 + i, y = 100 + Math.round(i * 0.95 - Math.sin((i / 56) * Math.PI) * 6);
    p.rect(x, y - 1, 1, 6, i % 8 === 0 ? '#e8b020' : '#f8d040');
    p.set(x, y - 2, '#fff090');
    p.set(x, y + 5, '#b88010');
  }
  steel(sx + 52, CHIPS + 10, sx + 52, 128, '#9aa0ac');
  // jungle gym: a cube of bars with a ladder face and monkey bars across the top
  const jx = 290, jw = 90, jt = 100;
  for (let x = jx; x <= jx + jw; x += 18) {
    steel(x, CHIPS + 10, x, jt, '#40a050');
    steel(x + 8, CHIPS + 2, x + 8, jt - 8, '#2a7a3a');
  }
  for (let y = jt; y < CHIPS + 6; y += 14) p.rect(jx, y, jw + 2, 2, '#40a050');
  for (let y = jt - 8; y < CHIPS; y += 14) p.rect(jx + 8, y, jw + 2, 1, '#2a7a3a');
  for (let x = jx; x <= jx + jw; x += 6) p.line(x, jt, x + 8, jt - 8, '#80d070');
  // tetherball pole and its concrete foot (ball and rope are drawn live)
  p.rect(POLE.x - 1, POLE.top, 3, CURB - POLE.top + 6, '#c8ccd4');
  p.rect(POLE.x - 1, POLE.top, 1, CURB - POLE.top + 6, '#f0f0f8');
  p.ellipse(POLE.x, CURB + 6, 6, 2, '#a8a49c');
  // seesaw fulcrum (the plank is drawn live)
  p.poly([[SAW.x - 6, SAW.y + 8], [SAW.x + 6, SAW.y + 8], [SAW.x, SAW.y - 2]], '#f0c020');
  p.poly([[SAW.x, SAW.y + 8], [SAW.x + 6, SAW.y + 8], [SAW.x, SAW.y - 2]], '#c89810');
  // dropped things: a lunchbox, a jump rope, a sweater
  p.rect(236, CHIPS + 4, 10, 7, '#e04040');
  p.rect(239, CHIPS + 2, 4, 2, '#3a3a44');
  for (let i = 0; i < 40; i++) p.set(250 + i, CHIPS + 10 + Math.round(Math.sin(i * 0.3) * 2), i < 3 || i > 36 ? '#f0f0f0' : '#ff4a9a');
  p.poly([[384, CHIPS + 9], [400, CHIPS + 6], [404, CHIPS + 11], [388, CHIPS + 13]], '#3a8ad0');
  // a scatter of chips spilled onto the curb
  for (let i = 0; i < 40; i++) p.set(r.int(0, STAGE_W), CURB + r.int(-1, 4), '#a8703c');
  return p.canvas();
}

/** Kids crowd the fence; a few watch from the top of the jungle gym and the slide platform. */
function kids(): Kid[] {
  const r = rng(1433);
  const out: Kid[] = [];
  const add = (x: number, y: number, sit = false) =>
    out.push({ x, y, skin: r.pick(SKINS), hair: r.pick(HAIRS), shirt: r.pick(SHIRTS), legs: r.pick(LEGS), ph: r.range(0, 1000), tall: r.int(0, 3), pony: r.next() < 0.45, sit });
  for (let x = 10; x < STAGE_W - 6; x += r.int(11, 19)) if (x < 140 || x > 210) add(x, GRASS + r.int(0, 3));
  add(300, 100, true);
  add(326, 100, true);
  add(360, 100, true);
  add(158, 98);
  return out;
}

/** A school bell clattering for the end of recess. */
function schoolBell() {
  const c = ac();
  if (!c) return;
  for (let i = 0; i < 34; i++) {
    const at = c.currentTime + i * 0.038;
    tone({ type: 'square', freq: 1480, to: 1460, dur: 0.05, vol: 0.05, at, filter: { type: 'bandpass', freq: 1800, q: 4 } });
    tone({ type: 'sine', freq: 2960, dur: 0.06, vol: 0.04, at });
  }
}

export class PlaygroundStage {
  name = 'RECESS YARD';
  blurb = 'NO RUNNING. NO FIGHTING. NO RULES';
  song: SongName = 'playground';
  sky = sky();
  school = school();
  fence = fence();
  yard = yard();
  crowd = kids();
  pit: HTMLCanvasElement;
  pitLanding: PitLanding;
  /** How hard the kids are cheering right now; jumps on every hit and fades. */
  cheer = 0;
  hp: number[] = [];
  /** Extra sway in the swings from the shock of big hits. */
  rattle = 0;
  /** The red kickball: x in world px, y as height above the floor. */
  ball = { x: 256, y: 0, vx: 0, vy: 0, spin: 0 };

  constructor() {
    this.pit = this.buildPit();
    this.pitLanding = this.makeLanding();
  }

  reset() {
    this.cheer = 0;
    this.rattle = 0;
    this.hp = [];
    this.ball = { x: 256, y: 0, vx: 0, vy: 0, spin: 0 };
  }

  update(f: Fight) {
    f.f.forEach((ft, i) => {
      const was = this.hp[i] ?? ft.hp;
      if (ft.hp < was) {
        this.cheer = Math.min(1, this.cheer + 0.35 + (was - ft.hp) / 200);
        this.rattle = Math.min(1, this.rattle + (was - ft.hp) / 150);
      }
      this.hp[i] = ft.hp;
    });
    this.cheer *= 0.985;
    this.rattle *= 0.99;
    const b = this.ball;
    for (const ft of f.f) {
      if (ft.alpha <= 0 || ft.state === 'thrown') continue;
      // walking into the ball nudges it along
      const hb = ft.hurtbox();
      if (b.y < hb[3] && b.y + BALL_R * 2 > hb[1] && b.x > hb[0] - BALL_R && b.x < hb[2] + BALL_R) {
        const dir = b.x < (hb[0] + hb[2]) / 2 ? -1 : 1;
        b.x = dir < 0 ? hb[0] - BALL_R : hb[2] + BALL_R;
        b.vx = dir * Math.max(Math.abs(b.vx) * 0.6, 1.2);
      }
      // a punch or kick that reaches it boots it across the yard
      const sp = ft.strikePoint();
      if (sp && Math.hypot(sp.x - b.x, sp.y - (b.y + BALL_R)) < sp.hit.r + BALL_R + 3) {
        b.vx = ft.facing * (3 + sp.hit.dmg / 20);
        b.vy = ft.move?.id === 'uppercut' ? 8 : 2 + sp.hit.dmg / 30;
        sfx.thud();
      }
    }
    for (const pr of f.projectiles)
      if (!pr.dead && Math.abs(pr.x - b.x) < pr.r + BALL_R && Math.abs(pr.y - b.y) < pr.r + BALL_R * 2) {
        b.vx = Math.sign(pr.vx) * 4;
        b.vy = 3;
      }
    b.vy -= 0.25;
    b.x += b.vx;
    b.y += b.vy;
    b.spin += b.vx / BALL_R;
    if (b.y <= 0) {
      b.y = 0;
      if (b.vy < -1.5) b.vy = -b.vy * 0.55;
      else b.vy = 0;
      b.vx *= 0.97;
    }
    if (b.x < BALL_R + 4) { b.x = BALL_R + 4; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > STAGE_W - BALL_R - 4) { b.x = STAGE_W - BALL_R - 4; b.vx = -Math.abs(b.vx) * 0.6; }
  }

  /** The finish close-up: looking down into the big sandbox at the edge of the yard. */
  buildPit(): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1451);
    p.gradRect(0, 0, W, 40, '#5a9ae8', '#b8e0ff', 4);
    // the fence and the school wall beyond, seen up close
    for (let y = 18; y < 52; y++)
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
        p.set(x, y, y % 4 === 3 || (x + off) % 8 === 7 ? '#c8a898' : darken('#b04a34', ((row * 7 + Math.floor((x + off) / 8) * 3) % 5) * 0.04));
      }
    p.rect(0, 16, W, 3, '#5a5a66');
    for (let y = 52; y < 70; y++) for (let x = 0; x < W; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#4aa040' : '#58b048');
    for (let y = 30; y < 70; y++)
      for (let x = 0; x < W; x++) if ((x + y) % 7 === 0 || (x - y + 700) % 7 === 0) p.set(x, y, '#a8acb8');
    p.rect(0, 30, W, 2, '#c8ccd4');
    // the sandbox: a chunky timber frame and a big bed of sand
    p.rect(0, 66, W, 10, '#a86a34');
    p.rect(0, 66, W, 2, '#d8964c');
    p.rect(0, 75, W, 1, '#5a3418');
    for (let x = 0; x < W; x += 40) p.rect(x, 66, 1, 10, '#6a4020');
    for (let y = 76; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ripple = Math.sin(x * 0.11 + y * 0.4) + Math.sin(x * 0.05 - y * 0.2);
        let c: Color = mix('#e8cc8a', '#d4b070', (y - 76) / (H - 76));
        if (ripple > 1.4) c = lighten(c, 0.12);
        else if (ripple < -1.5) c = darken(c, 0.1);
        if (bayer(x, y) < 0.06) c = darken(c, 0.12);
        p.set(x, y, c);
      }
    for (let x = 0; x < W; x++) for (let y = 76; y < 82; y++) if (bayer(x, y) < (82 - y) / 7) p.set(x, y, darken(p.get(x, y), 0.25)); // frame shadow
    // a sandcastle with towers, crenellations and a lolly-stick flag
    const cx = 44, cy = 150;
    p.rect(cx - 18, cy - 14, 36, 16, '#d0a860');
    p.rect(cx - 18, cy - 14, 36, 2, '#e8c880');
    for (const tx of [cx - 22, cx + 12]) {
      p.rect(tx, cy - 28, 10, 30, '#c89c58');
      p.rect(tx, cy - 28, 3, 30, '#e0bc78');
      for (let k = 0; k < 10; k += 4) p.rect(tx + k, cy - 31, 2, 3, '#c89c58');
    }
    p.rect(cx - 6, cy - 26, 12, 14, '#d0a860');
    for (let k = -6; k < 6; k += 4) p.rect(cx + k, cy - 29, 2, 3, '#d0a860');
    p.ellipse(cx, cy - 2, 4, 5, '#8a6a3a');
    p.rect(cx, cy - 44, 1, 18, '#c8a070');
    p.poly([[cx + 1, cy - 44], [cx + 10, cy - 41], [cx + 1, cy - 38]], '#e04040');
    p.ellipse(cx, cy + 4, 28, 4, '#c09858');
    // moat ring
    for (let a = 0; a < Math.PI * 2; a += 0.02) p.set(Math.round(cx + Math.cos(a) * 30), Math.round(cy + 4 + Math.sin(a) * 6), '#b08848');
    // a bucket upside down beside the castle, a spade stuck in the sand, a toy dump truck
    p.poly([[196, 140], [216, 140], [212, 124], [200, 124]], '#3a7ae0');
    p.rect(200, 124, 12, 2, '#6aa0f0');
    p.rect(196, 138, 20, 2, '#2a5ab0');
    p.line(226, 150, 236, 116, '#6a4a2a');
    p.poly([[220, 152], [232, 154], [230, 164], [222, 162]], '#e04040');
    p.rect(176, 186, 26, 9, '#f0c020');
    p.poly([[176, 186], [190, 178], [194, 186]], '#e8a820');
    p.rect(202, 182, 12, 13, '#e04040');
    p.rect(205, 184, 6, 4, '#a8d0f0');
    for (const wx of [182, 208]) {
      p.ellipse(wx, 196, 4, 4, '#2a2a30');
      p.ellipse(wx, 196, 1.5, 1.5, '#a8a8b0');
    }
    // footprints and a few stray toys in the sand
    for (let i = 0; i < 12; i++) {
      const fx = 80 + i * 9 + r.int(-2, 2), fy = 200 + (i % 2) * 6;
      p.ellipse(fx, fy, 2, 1, darken('#d8b878', 0.15));
    }
    p.ellipse(94, 110, 5, 5, '#ff7ab0'); // a rubber ball
    p.ellipse(92, 108, 1.5, 1.5, '#ffc0d8');
    p.poly([[150, 96], [160, 96], [158, 100], [152, 100]], '#40b060'); // a sieve
    p.ellipse(155, 96, 5, 1.5, '#60d080');
    return p.canvas();
  }

  /** Landing for the uppercut finish: head-first into the sandbox, then a bucket to the boot. */
  makeLanding(): PitLanding {
    const REST = 132;
    const SURF = 124; // where the sand swallows them at the waist, screen y
    const BUCKET_AT = 64, BONK = 82, BELL = 128;
    let feet = { x: 128, y: 0 };
    return {
      pose: P(LAUNCHED, { rot: 180 }),
      rest: REST,
      length: 220,
      land: (f) => {
        sfx.thud();
        sfx.land();
        f.shake(8);
        for (let i = 0; i < 40; i++) {
          const a = rand(Math.PI * 0.05, Math.PI * 0.95), s = rand(1, 3.6);
          f.pitParticles.add({ kind: 'spark', x: 128 + rand(-10, 10), y: H - SURF, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 40, max: 40, color: rand() < 0.5 ? '#e8cc8a' : '#c8a060', size: rand(1, 2), grav: 0.12, floor: false });
        }
        f.pitParticles.smoke(128, H - SURF, 10, '#e8d8b0');
      },
      tick: (f, it) => {
        if (it < BONK && it % 9 === 0) f.pitParticles.smoke(128 + rand(-16, 16), H - SURF + 2, 1, '#e8d8b0');
        if (it === BONK) {
          sfx.hit(1);
          sfx.ow();
          f.shake(3);
          f.pitParticles.sparks(feet.x, H - feet.y + 6, 10, '#fff6a0');
        }
        if (it === BELL) schoolBell();
      },
      victim: (l, it) => {
        // legs kicking wildly in the air, slowing after the bucket lands, then a last twitch
        const k = it < BONK ? 1 : it < BONK + 30 ? 0.35 : Math.max(0, Math.sin(it * 0.15)) > 0.95 ? 0.4 : 0;
        const j = Math.sin(it * 0.9) * 26 * k, j2 = Math.sin(it * 0.9 + 1.7) * 26 * k;
        l.poseOverride = P(LAUNCHED, { rot: 180, t: 0, h: 0, af: -170, ef: 0, ab: -170, eb: 0, lf: -18 + j, kf: 20 + Math.abs(j) * 0.6, lb: 18 + j2, kb: 20 + Math.abs(j2) * 0.6 });
        l.computePose();
        // put the hips just under the sand, settling a little deeper over the first moments
        const s = l.skel;
        const lift = SURF + 4 + Math.min(12, it) * 0.5 - REST + l.G;
        const top = s.heelF[1] < s.toeF[1] ? s.heelF : s.toeF;
        feet = { x: 128 + ((s.heelF[0] + s.toeF[0]) / 2) * l.facing, y: REST + lift - l.G + top[1] };
        return lift;
      },
      draw: (ctx, it) => {
        mound(ctx, this.pit, 128, SURF + 8);
        // the bucket that comes tumbling out of the sky and lands on the upturned boot
        if (it >= BUCKET_AT) {
          const e = Math.min(1, (it - BUCKET_AT) / (BONK - BUCKET_AT));
          const bx = feet.x, by = -20 + (feet.y - 6 + 20) * e * e; // bucket centre sits 6px above the sole
          const tilt = it < BONK ? (1 - e) * 2.5 : 0;
          ctx.save();
          ctx.translate(Math.round(bx), Math.round(by));
          ctx.rotate(Math.PI + tilt);
          ctx.fillStyle = '#e04040';
          ctx.beginPath();
          ctx.moveTo(-7, -6);
          ctx.lineTo(7, -6);
          ctx.lineTo(5, 6);
          ctx.lineTo(-5, 6);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ff7070';
          ctx.fillRect(-7, -7, 14, 2);
          ctx.fillStyle = '#a02020';
          ctx.fillRect(3, -5, 2, 10);
          ctx.restore();
          // stars circling the dazed boot
          if (it >= BONK)
            for (let k = 0; k < 4; k++) {
              const a = it * 0.12 + (k * Math.PI) / 2;
              const x = Math.round(bx + Math.cos(a) * 12), y = Math.round(by - 12 + Math.sin(a) * 4);
              ctx.fillStyle = k % 2 ? '#fff6a0' : '#ffd040';
              ctx.fillRect(x - 1, y, 3, 1);
              ctx.fillRect(x, y - 1, 1, 3);
            }
        }
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    // clouds drifting slowly across
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 97 + t * 0.05 * (1 + i * 0.3) - camX * 0.2) % (W + 80) + W + 80) % (W + 80) - 40;
      const y = 14 + i * 9;
      for (const [dx, dy, rr] of [[0, 0, 8], [10, -4, 10], [22, 0, 8], [11, 3, 9]]) {
        ctx.beginPath();
        ctx.ellipse(Math.round(x + dx), y + dy, rr, rr * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.drawImage(this.school, -Math.round(camX * 0.5), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.fence, dx, 0);
    for (const k of this.crowd) if (!k.sit && k.y >= GRASS) this.drawKid(ctx, k, dx, t);
    ctx.drawImage(this.yard, dx, 0);
    this.drawSwings(ctx, dx, t);
    this.drawTether(ctx, dx, t);
    this.drawSeesaw(ctx, dx, t);
    for (const k of this.crowd) if (k.sit || k.y < GRASS) this.drawKid(ctx, k, dx, t);
    this.drawBall(ctx, dx);
  }

  /** Empty swings swaying on their chains; a big hit sets them rattling. */
  drawSwings(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    for (const s of SWINGS) {
      const a = Math.sin(t * 0.035 + s.ph) * (0.12 + this.rattle * 0.5);
      const px = s.x + dx;
      if (px < -60 || px > W + 60) continue;
      const ex = px + Math.sin(a) * s.len, ey = SWING_TOP + Math.cos(a) * s.len;
      ctx.fillStyle = '#9aa0ac';
      for (let k = 0; k < s.len; k += 2) {
        const f = k / s.len;
        ctx.fillRect(Math.round(px - 4 + (ex - px) * f), Math.round(SWING_TOP + (ey - SWING_TOP) * f), 1, 1);
        ctx.fillRect(Math.round(px + 4 + (ex - px) * f), Math.round(SWING_TOP + (ey - SWING_TOP) * f), 1, 1);
      }
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(Math.round(ex) - 6, Math.round(ey), 13, 3);
      ctx.fillStyle = '#4a4a54';
      ctx.fillRect(Math.round(ex) - 6, Math.round(ey), 13, 1);
    }
  }

  /** The tetherball winding round its pole, the rope shortening as it wraps. */
  drawTether(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const x = POLE.x + dx;
    if (x < -40 || x > W + 40) return;
    const cyc = (t % 480) / 480;
    const len = 26 * (1 - cyc * 0.7);
    const a = t * 0.08;
    const bx = x + Math.cos(a) * len, by = POLE.top + 4 + len * 0.7 + Math.sin(a) * len * 0.25;
    const front = Math.sin(a) > 0;
    const drawBall = () => {
      ctx.strokeStyle = '#e8e4dc';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, POLE.top + 2);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = '#f0c020';
      ctx.beginPath();
      ctx.arc(Math.round(bx), Math.round(by), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff090';
      ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 2, 1);
    };
    // wraps of rope already around the pole
    ctx.fillStyle = '#e8e4dc';
    for (let k = 0; k < cyc * 10; k++) ctx.fillRect(x - 1, POLE.top + 2 + k * 2, 3, 1);
    if (!front) drawBall();
    ctx.fillStyle = '#c8ccd4';
    ctx.fillRect(x - 1, POLE.top, 3, 4);
    if (front) drawBall();
  }

  /** The seesaw rocking on its own, nudged by the wind. */
  drawSeesaw(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const x = SAW.x + dx;
    if (x < -40 || x > W + 40) return;
    const a = Math.sin(t * 0.02) * 0.22;
    ctx.save();
    ctx.translate(x, SAW.y - 2);
    ctx.rotate(a);
    ctx.fillStyle = '#3a7ae0';
    ctx.fillRect(-26, -2, 52, 3);
    ctx.fillStyle = '#7aa0f0';
    ctx.fillRect(-26, -2, 52, 1);
    ctx.fillStyle = '#d83a3a';
    for (const hx of [-20, 18]) ctx.fillRect(hx, -6, 2, 4);
    ctx.restore();
  }

  /** The kickball, with a band that turns as it rolls and a shadow on the blacktop. */
  drawBall(ctx: CanvasRenderingContext2D, dx: number) {
    const b = this.ball;
    const x = Math.round(b.x + dx), y = Math.round(FLOOR - b.y - BALL_R);
    if (x < -10 || x > W + 10) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - BALL_R + 1, FLOOR, BALL_R * 2 - 1, 1);
    ctx.fillStyle = '#d83030';
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a01818';
    const bx = Math.round(Math.sin(b.spin) * (BALL_R - 1));
    ctx.fillRect(x + bx, y - BALL_R + 1, 1, BALL_R * 2 - 1);
    ctx.fillStyle = '#ff8080';
    ctx.fillRect(x - 2, y - 2, 2, 1);
  }

  /** One kid: they bob and chat when it is quiet and jump up and down cheering on the big hits. */
  drawKid(ctx: CanvasRenderingContext2D, k: Kid, dx: number, t: number) {
    const x = Math.round(k.x + dx);
    if (x < -10 || x > W + 10) return;
    const excited = this.cheer > 0.15 && Math.sin(k.ph) * 0.5 + 0.5 < this.cheer + 0.3;
    const hop = excited ? Math.round(Math.abs(Math.sin(t * 0.25 + k.ph)) * 3 * Math.min(1, this.cheer * 2)) : 0;
    const bob = Math.sin(t * 0.06 + k.ph) > 0.8 ? 1 : 0;
    const legH = k.sit ? 0 : 5 + k.tall;
    const foot = k.y - hop;
    const hip = foot - legH;
    // legs (or dangling feet for the sitters)
    ctx.fillStyle = k.legs;
    if (k.sit) {
      ctx.fillRect(x - 3, hip, 2, 4 + (Math.sin(t * 0.1 + k.ph) > 0 ? 1 : 0));
      ctx.fillRect(x + 1, hip, 2, 4 + (Math.sin(t * 0.1 + k.ph) > 0 ? 0 : 1));
    } else {
      ctx.fillRect(x - 3, hip, 2, legH);
      ctx.fillRect(x + 1, hip, 2, legH);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(x - 3, foot - 1, 2, 1);
      ctx.fillRect(x + 1, foot - 1, 2, 1);
    }
    // shirt
    const top = hip - 7 + bob;
    ctx.fillStyle = k.shirt;
    ctx.fillRect(x - 3, top, 7, 7 - bob);
    // arms: up and waving when cheering, otherwise at their sides
    ctx.fillStyle = k.skin;
    if (excited) {
      const w = Math.sin(t * 0.3 + k.ph) > 0 ? 1 : 0;
      ctx.fillRect(x - 5 - w, top - 4, 2, 5);
      ctx.fillRect(x + 4 + w, top - 4, 2, 5);
    } else {
      ctx.fillRect(x - 4, top + 1, 1, 5);
      ctx.fillRect(x + 4, top + 1, 1, 5);
    }
    // head and hair
    const hy = top - 6;
    ctx.fillRect(x - 2, hy, 5, 5);
    ctx.fillStyle = k.hair;
    ctx.fillRect(x - 2, hy - 1, 5, 2);
    if (k.pony) ctx.fillRect(x + 3, hy, 1, 4);
    ctx.fillStyle = '#141014';
    ctx.fillRect(x - 1, hy + 2, 1, 1);
    ctx.fillRect(x + 1, hy + 2, 1, 1);
    if (excited) ctx.fillRect(x, hy + 4, 1, 1); // an open-mouthed "OOOH!"
  }

  /** Dandelion fluff and a stray paper airplane floating across the front. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 16; i++) {
      const sp = 0.2 + (i % 4) * 0.07;
      const x = ((i * 71 + t * sp - camX * (0.9 + (i % 3) * 0.1)) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = 60 + ((i * 37) % 120) + Math.sin(t * 0.03 + i) * 6;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (i % 3 === 0) ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 1, 1);
    }
    const cyc = t % 900;
    if (cyc < 300) {
      const x = -20 + cyc * 1.0 - camX * 0.1, y = 50 + Math.sin(cyc * 0.04) * 10 + cyc * 0.08;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x - 4, y - 3);
      ctx.lineTo(x - 2, y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c8d0e0';
      ctx.fillRect(Math.round(x - 2), Math.round(y), 8, 1);
    }
  }
}

/** The heap of sand the victim is planted in: the sandbox floor is repainted over everything below
 *  the waist, then a little crater heap rings the hole they went in by. */
function mound(ctx: CanvasRenderingContext2D, pit: HTMLCanvasElement, cx: number, cy: number) {
  ctx.drawImage(pit, cx - 28, cy, 56, H - cy, cx - 28, cy, 56, H - cy);
  for (let y = cy - 9; y <= cy + 12; y++) {
    const dy = (y - cy) / (y < cy ? 9 : 12);
    const half = 30 * Math.sqrt(Math.max(0, 1 - dy * dy)) + (y >= cy ? 4 : 0);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const dx = (x - cx) / Math.max(1, half);
      if (Math.abs(dx) > 0.75 && bayer(x, y) < (Math.abs(dx) - 0.75) * 4) continue;
      if (dy > 0.5 && bayer(x, y) < (dy - 0.5) * 2) continue;
      let c = '#e0c482';
      if (y < cy - 3 && dx < 0.4) c = '#fbe8b8'; // sunlit crest
      else if (dx > 0.4) c = bayer(x, y) < 0.5 ? '#b89454' : '#c8a464'; // shadow side
      else if (y > cy + 3 && bayer(x, y) < 0.3) c = '#d4b474';
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // the dark lip of the hole
  ctx.fillStyle = '#a07c48';
  ctx.fillRect(cx - 10, cy - 4, 20, 2);
  ctx.fillStyle = '#8a6a3a';
  ctx.fillRect(cx - 8, cy - 3, 16, 1);
}
