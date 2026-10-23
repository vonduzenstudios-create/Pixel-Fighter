import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng } from '../../core/rng';
import { sfx } from '../../audio/sfx';
import { FX } from '../../audio/specials';
import { drawText } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { PitLanding } from '../../game/stages';

// "The Inferno": a fine-dining restaurant kitchen in the middle of dinner service, running far
// too hot. A brick wood-fired oven roars on the back wall under a big neon sign, line cooks toss
// flaming pans along the range, heat lamps glow over the pass, and the grill stations at both
// ends of the floor flare up every few seconds. The uppercut finish drops the loser through the
// floor onto the cellar's giant charcoal grill, where they are plated under a silver cloche.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
/** Top of the cook line's range, in the mid layer. */
const RANGE_TOP = 150;
/** The wood-fired oven's mouth in the far layer. */
const OVEN = { x: FAR_W >> 1, y: 148, rx: 22, ry: 26 };
/** Line cooks behind the range (mid-layer x) and the burners their pans sit on. */
const COOKS = [64, 196, 330];
/** World x of the two charbroiler stations at the ends of the floor. */
const GRILLS = [34, STAGE_W - 34];
const GRILL_TOP = FLOOR - 30;
/** The pass: a steel shelf under heat lamps in the middle of the floor. */
const PASS_X0 = 176, PASS_X1 = 336, PASS_TOP = FLOOR - 56;
const LAMPS = [196, 236, 276, 316];

// house colours: ember red, flame orange, brass, brushed steel and the neon sign's hot pink
const RED = '#c81810', ORANGE = '#ff7010', BRASS = '#e8b040', STEEL = '#b8c0c8', NEON = '#ff4060';

/** Back wall: soot-dark tile, the hood, hanging copper and the great brick oven. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(2203);
  // tiled wall, glowing hotter toward the floor
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) {
      const grout = y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 6) % 12 === 0;
      const heat = Math.max(0, (y - 30) / 150);
      let c: Color = mix(grout ? '#1a0a0a' : '#3a1614', '#a03018', heat * (grout ? 0.25 : 0.5));
      if (!grout && bayer(x, y) < 0.15) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
  // the extraction hood across the top, ducts climbing out of frame
  for (const dx of [40, FAR_W - 56]) {
    p.rect(dx, 0, 16, 10, '#5a5e66');
    for (let y = 2; y < 10; y += 3) p.rect(dx, y, 16, 1, '#3a3e46');
  }
  p.poly([[0, 10], [FAR_W, 10], [FAR_W, 22], [FAR_W - 10, 32], [10, 32], [0, 22]], '#6a7078');
  p.rect(0, 10, FAR_W, 2, '#9aa2aa');
  for (let x = 14; x < FAR_W - 14; x += 6) p.rect(x, 24, 4, 5, '#3a3e46');
  p.rect(10, 31, FAR_W - 20, 1, '#2a2e34');
  // the oven: a brick dome on a plinth with a chimney into the hood
  const { x: ox, y: oy } = OVEN;
  p.rect(ox - 8, 32, 16, 50, '#5a2418');
  for (let y = 34; y < 82; y += 4) p.rect(ox - 8 + (y % 8 ? 0 : 4), y, 1, 4, '#2a0e08');
  for (let y = -60; y <= 0; y++)
    for (let x = -58; x <= 58; x++) {
      const d = (x * x) / (58 * 58) + (y * y) / (60 * 60);
      if (d > 1) continue;
      const row = Math.floor((y + 60) / 5);
      const grout = (y + 60) % 5 === 0 || (x + 60 + (row % 2) * 5) % 10 === 0;
      let c: Color = grout ? '#2a0e08' : (row + Math.floor((x + 60) / 10)) % 3 === 0 ? '#8a3420' : '#a8442a';
      c = mix(c, '#ff8040', Math.max(0, 0.4 - d * 0.4) * (y > -30 ? 1 : 0.4));
      if (d > 0.88) c = darken(c, 0.35);
      p.set(ox + x, oy + y, c);
    }
  // the mouth (fire is drawn live) with a stone arch and a brass plate
  for (let y = -OVEN.ry; y <= 0; y++)
    for (let x = -OVEN.rx - 4; x <= OVEN.rx + 4; x++) {
      const d = (x * x) / ((OVEN.rx + 4) ** 2) + (y * y) / ((OVEN.ry + 4) ** 2);
      if (d <= 1) p.set(ox + x, oy + y, (x + y) % 4 === 0 ? '#c8b8a0' : '#9a8a78');
    }
  for (let y = -OVEN.ry; y <= 0; y++)
    for (let x = -OVEN.rx; x <= OVEN.rx; x++) if ((x * x) / OVEN.rx ** 2 + (y * y) / OVEN.ry ** 2 <= 1) p.set(ox + x, oy + y, '#140404');
  p.rect(ox - 70, oy, 140, 30, '#4a3a34');
  p.rect(ox - 70, oy, 140, 2, '#8a7a70');
  for (let x = ox - 66; x < ox + 66; x += 12) p.rect(x, oy + 6, 10, 20, '#3a2a24');
  // stacked firewood beside the oven
  for (const side of [-1, 1])
    for (let row = 0; row < 4; row++)
      for (let k = 0; k < 4 - (row >> 1); k++) {
        const lx = ox + side * (80 + k * 7 + (row % 2) * 3), ly = oy + 24 - row * 6;
        p.ellipse(lx, ly, 3, 3, '#6a4020');
        p.ellipse(lx, ly, 1, 1, '#c89060');
      }
  // pot rails either side, hung with copper pans
  for (const [x0, x1] of [[8, ox - 74], [ox + 74, FAR_W - 8]]) {
    p.rect(x0, 54, x1 - x0, 2, '#7a7068');
    for (let x = x0 + 8; x < x1 - 6; x += r.int(13, 18)) {
      const pr = r.int(5, 8), len = r.int(6, 14);
      p.line(x, 56, x, 56 + len, '#5a5048');
      const cy = 56 + len + pr;
      p.ellipse(x, cy, pr, pr, '#b85a28');
      p.ellipse(x - 1, cy - 1, pr - 2, pr - 2, '#d87a40');
      p.set(x - pr + 2, cy - pr + 3, '#ffd0a0');
      if (r.next() < 0.5) p.rect(x + pr - 1, cy - 1, 6, 2, '#5a3020');
    }
  }
  return p.canvas();
}

interface Glow { x: number; y: number; r: number; col: string; ph: number }

/** The cook line: a long range with oven doors, knobs and burner grates. */
function mid(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(2251);
  // the range: brushed steel with oven doors and a row of knobs
  p.rect(0, RANGE_TOP, MID_W, H - RANGE_TOP, '#8a929a');
  for (let y = RANGE_TOP; y < H; y++) for (let x = 0; x < MID_W; x++) if (bayer(x, y) < 0.18) p.set(x, y, '#9aa2aa');
  p.rect(0, RANGE_TOP - 3, MID_W, 3, '#2a2a30');
  p.rect(0, RANGE_TOP, MID_W, 2, '#d8dee4');
  for (let x = 8; x < MID_W; x += 10) p.ellipse(x, RANGE_TOP + 6, 2, 2, '#2a2a30');
  for (let x = 4; x < MID_W - 40; x += 66) {
    p.rect(x, RANGE_TOP + 12, 58, 26, '#6a7078');
    p.rect(x + 2, RANGE_TOP + 14, 54, 2, '#c8ced4');
    p.rect(x + 12, RANGE_TOP + 20, 34, 10, '#2a1410');
    p.rect(x + 12, RANGE_TOP + 20, 34, 1, '#ff8040');
    glows.push({ x: x + 29, y: RANGE_TOP + 25, r: 14, col: '#ff6020', ph: r.range(0, 6) });
  }
  // the burner grates the cooks' pans sit on
  for (const cx of COOKS)
    for (const d of [-18, 18]) {
      p.rect(cx + d - 9, RANGE_TOP - 4, 18, 2, '#1a1a1e');
      for (let k = -8; k <= 8; k += 4) p.rect(cx + d + k, RANGE_TOP - 6, 1, 3, '#1a1a1e');
    }
  return p.canvas();
}

/** A line cook from the chest up: white jacket, apron and a tall toque, lit red from below. */
function cook(seed: number): HTMLCanvasElement {
  const p = new Painter(24, 52);
  const r = rng(seed);
  const skin = ['#e0b090', '#a86a40', '#7a4a2a', '#f0c8a0'][r.int(0, 3)];
  p.rect(9, 0, 8, 2, '#f0f0f0');
  p.ellipse(13, 6, 6, 5, '#f8f8f8');
  p.rect(8, 8, 10, 4, '#e0e0e0');
  p.ellipse(13, 15, 4, 5, skin);
  p.rect(11, 19, 4, 3, darken(skin, 0.2));
  p.poly([[2, 52], [4, 24], [12, 21], [22, 24], [24, 52]], '#e8e8ec');
  p.rect(12, 24, 1, 28, '#b8b8c0');
  for (const y of [28, 34, 40]) p.set(15, y, '#3a3a40');
  p.rect(5, 38, 16, 14, '#3a2a2a');
  p.shade(0.25, 0, -1);
  return p.canvas();
}

/** One of the charbroiler stations at the ends of the floor: steel cabinet and an iron grate. */
function grillStation(p: Painter, cx: number) {
  p.rect(cx - 32, GRILL_TOP, 64, FLOOR - GRILL_TOP, '#7a828a');
  for (let y = GRILL_TOP; y < FLOOR; y++) for (let x = cx - 32; x < cx + 32; x++) if (bayer(x, y) < 0.2) p.set(x, y, '#8a929a');
  p.rect(cx - 34, GRILL_TOP - 2, 68, 3, '#c8ced4');
  p.rect(cx - 28, GRILL_TOP + 8, 56, 16, '#5a6068');
  p.rect(cx - 26, GRILL_TOP + 10, 52, 1, '#9aa2aa');
  for (let x = cx - 24; x < cx + 24; x += 8) p.ellipse(x + 4, GRILL_TOP + 5, 2, 2, '#1a1a1e');
  p.rect(cx - 30, GRILL_TOP - 5, 60, 3, '#1a1414');
  for (let x = cx - 28; x < cx + 28; x += 4) p.rect(x, GRILL_TOP - 6, 2, 1, '#3a2a28');
}

/** The near floor: grill stations, the pass with its heat lamps, and red quarry tile. */
function deck(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  for (const gx of GRILLS) grillStation(p, gx);
  // the pass: a steel shelf on legs, plates waiting under the lamps
  for (const lx of [PASS_X0 + 4, PASS_X1 - 7]) p.rect(lx, PASS_TOP, 3, FLOOR - PASS_TOP, '#6a7078');
  p.rect(PASS_X0 + 4, FLOOR - 20, PASS_X1 - PASS_X0 - 8, 2, '#6a7078');
  for (let x = PASS_X0 + 14; x < PASS_X1 - 20; x += 14)
    for (let k = 0; k < 4; k++) p.rect(x, FLOOR - 22 - k * 2, 10, 2, k % 2 ? '#d8d8dc' : '#f0f0f4');
  p.rect(PASS_X0, PASS_TOP, PASS_X1 - PASS_X0, 4, '#c8ced4');
  p.rect(PASS_X0, PASS_TOP, PASS_X1 - PASS_X0, 1, '#f0f4f8');
  p.rect(PASS_X0, PASS_TOP + 4, PASS_X1 - PASS_X0, 1, '#4a5058');
  const r = rng(2287);
  for (const lx of LAMPS) {
    // the plate under each lamp: a seared steak with greens, or a dome of something fancy
    const px = lx + r.int(-4, 4);
    p.ellipse(px, PASS_TOP - 1, 9, 2, '#f8f8f8');
    if (r.next() < 0.6) {
      p.ellipse(px - 1, PASS_TOP - 3, 5, 2, '#6a2a14');
      for (let k = -3; k <= 3; k += 3) p.set(px + k, PASS_TOP - 3, '#2a0e06');
      p.rect(px + 4, PASS_TOP - 3, 2, 1, '#40a030');
    } else {
      p.ellipse(px, PASS_TOP - 3, 4, 3, '#e8c060');
      p.set(px - 1, PASS_TOP - 5, '#c81810');
    }
    // the heat lamp itself, hung on a long cord from the ceiling
    p.rect(lx, 0, 1, PASS_TOP - 40, '#1a1414');
    p.poly([[lx - 7, PASS_TOP - 30], [lx + 8, PASS_TOP - 30], [lx + 4, PASS_TOP - 40], [lx - 3, PASS_TOP - 40]], '#a01a14');
    p.rect(lx - 7, PASS_TOP - 31, 15, 1, '#e04030');
    p.rect(lx - 5, PASS_TOP - 30, 11, 1, '#ffd080');
    glows.push({ x: lx, y: PASS_TOP - 20, r: 26, col: '#ff8a30', ph: r.range(0, 6) });
  }
  // the ticket rail strung under the lamps, crowded with orders
  p.rect(PASS_X0 + 6, PASS_TOP - 27, PASS_X1 - PASS_X0 - 12, 1, '#a8b0b8');
  for (let x = PASS_X0 + 10; x < PASS_X1 - 14; x += r.int(9, 14)) {
    const h = r.int(8, 12);
    for (let y = 0; y < h; y++) p.rect(x, PASS_TOP - 26 + y, 6, 1, y % 3 === 1 ? '#c8c0b0' : '#f0ead8');
    if (r.next() < 0.3) p.rect(x + 1, PASS_TOP - 26 + h - 3, 4, 1, RED);
  }
  // the order bell
  p.ellipse(PASS_X1 - 16, PASS_TOP - 3, 4, 3, BRASS);
  p.rect(PASS_X1 - 17, PASS_TOP - 7, 2, 2, '#fff0a0');
  // red and black quarry tile, glossy with grease near the fighters
  for (let y = FLOOR; y < H; y++) {
    const row = y - FLOOR;
    const size = 5 + Math.floor(row / 5);
    for (let x = 0; x < STAGE_W; x++) {
      const skew = Math.floor((x - STAGE_W / 2) * (row / 50) + x);
      const grout = skew % 14 === 0 || row % size === 0;
      let c: Color = grout ? '#1a0806' : (Math.floor(skew / 14) + Math.floor(row / size)) % 2 ? '#8a2014' : '#2a0e0c';
      if (!grout && bayer(x, y) < 0.1) c = lighten(c, 0.15);
      if (row > 14) c = mix(c, '#100404', (row - 14) / 14);
      p.set(x, y, c);
    }
  }
  // a floor drain in the middle
  p.ellipse(STAGE_W / 2, FLOOR + 10, 9, 3, '#3a3a40');
  for (let k = -6; k <= 6; k += 3) p.rect(STAGE_W / 2 + k, FLOOR + 8, 1, 4, '#141418');
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, FLOOR, '#e0e4e8');
    p.set(x, FLOOR + 1, '#7a828a');
  }
  return p.canvas();
}

/** The cellar under the kitchen floor: a red-hot charcoal pit with a giant grill grate. */
function cellar(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(2311);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const grout = y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0;
      const heat = Math.max(0, (y - 30) / 130);
      let c: Color = mix(grout ? '#120606' : '#341210', '#e04010', heat * (grout ? 0.3 : 0.6));
      if (!grout && bayer(x, y) < 0.2) c = darken(c, 0.2);
      p.set(x, y, c);
    }
  // the trap door they fell through, a square of kitchen light far above
  p.rect(98, 0, 60, 6, '#ffd8a0');
  p.rect(96, 6, 64, 2, '#3a3a40');
  for (let y = 8; y < 40; y++) for (let x = 98; x < 158; x++) if (bayer(x, y) < 0.3 * (1 - (y - 8) / 32)) p.set(x, y, mix(p.get(x, y), '#ffd8a0', 0.25));
  // meat hooks on a rail and strings of garlic
  p.rect(0, 18, W, 2, '#4a4048');
  for (const hx of [22, 52, 206, 236]) {
    p.line(hx, 20, hx, 30, '#6a6068');
    p.line(hx, 30, hx + 3, 34, '#6a6068');
    p.line(hx + 3, 34, hx, 36, '#6a6068');
  }
  for (const gx of [80, 176]) {
    p.line(gx, 20, gx, 60, '#a08050');
    for (let y = 26; y < 60; y += 6) p.ellipse(gx + (y % 12 ? 2 : -2), y, 3, 3, '#f0e8d8');
  }
  // a chalkboard: tonight's special
  p.rect(186, 52, 52, 30, '#5a3a20');
  p.rect(188, 54, 48, 26, '#1a2420');
  // the grill: glowing coals under a grate seen from just above it
  for (let y = 132; y < 160; y++)
    for (let x = 0; x < W; x++) {
      const k = (y - 132) / 28;
      const coal = bayer(x, y) < 0.5 ? '#ff9030' : r.next() < 0.3 ? '#ffe070' : '#c02a08';
      p.set(x, y, mix('#4a0a04', coal, 0.4 + k * 0.6));
    }
  for (let y = 134; y < 160; y += 4) p.rect(0, y, W, y > 148 ? 2 : 1, '#1a1214');
  for (let x = 4; x < W; x += 24) p.line(x, 160, x + (x - W / 2) * 0.1, 132, '#2a2024');
  // the grill box below
  for (let y = 160; y < H; y++)
    for (let x = 0; x < W; x++) p.set(x, y, y < 163 ? '#6a6a72' : bayer(x, y) < 0.15 ? '#1a1a20' : '#2a2a30');
  for (let x = 14; x < W; x += 30) {
    p.rect(x, 176, 16, 4, '#140806');
    p.rect(x, 178, 16, 2, '#ff6020');
  }
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  drawText(ctx, 'TONIGHT', 212, 57, '#f0f0e0', { align: 'center' });
  drawText(ctx, 'SPECIAL', 212, 66, BRASS, { align: 'center' });
  return cv;
}

/** The serving cloche for the cellar finish: a big polished dome with a handle, 152 by 66. */
function clocheArt(): HTMLCanvasElement {
  const p = new Painter(152, 66);
  const cx = 76, base = 62;
  for (let dy = -54; dy <= 0; dy++)
    for (let dx = -72; dx <= 72; dx++) {
      const d = (dx * dx) / (72 * 72) + (dy * dy) / (54 * 54);
      if (d > 1) continue;
      const sheen = dx / 72 + dy / 54;
      let col: Color = sheen < -0.9 ? '#ffffff' : sheen < -0.5 ? '#e0e6ec' : sheen < 0.2 ? '#b8c0c8' : '#7a828c';
      col = mix(col, '#ff6020', Math.max(0, (dy + 20) / 60) * 0.3);
      if (d > 0.93) col = darken(col, 0.3);
      p.set(cx + dx, base + dy, col);
    }
  p.rect(0, base - 1, 152, 4, '#5a6068');
  p.rect(cx - 6, 0, 12, 8, STEEL);
  p.rect(cx - 4, 2, 3, 2, '#e8eef4');
  return p.canvas();
}

interface Ember { x: number; y: number; vx: number; vy: number; life: number; max: number }
interface Puff { x: number; y: number; r: number; life: number; vx: number }

const hexA = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** How hard the grill stations are flaring: a steady burn with a big whoosh every few seconds. */
export function flare(t: number, i: number): number {
  const ph = (t + i * 150) % 300;
  return ph < 46 ? Math.sin((ph / 46) * Math.PI) : 0;
}

/** Where each cook's pan is in its toss (0 at rest), on a staggered loop. */
function toss(t: number, i: number): number {
  const ph = (t + i * 47) % 110;
  return ph < 24 ? Math.sin((ph / 24) * Math.PI) : 0;
}

export class InfernoStage {
  name = 'THE INFERNO';
  blurb = 'DINNER SERVICE, AND THE KITCHEN IS ON FIRE';
  song: SongName = 'inferno';
  far = far();
  midGlows: Glow[] = [];
  mid = mid(this.midGlows);
  cooks = COOKS.map((_, i) => cook(2270 + i * 7));
  glows: Glow[] = [];
  deck = deck(this.glows);
  pit = cellar();
  pitLanding: PitLanding;
  embers: Ember[] = [];
  puffs: Puff[] = [];
  lastT = -1;
  /** The silver cloche's drop in the cellar finish (y is its offset above where it lands). */
  cloche = { y: -100, vy: 0, landed: false };
  clocheArt = clocheArt();

  constructor(_bones: PartSet) {
    this.pitLanding = this.makeLanding();
  }

  /** Advance embers and steam once per frame (draw can be called from any scene). */
  step(t: number) {
    const dt = this.lastT < 0 ? 1 : Math.max(0, Math.min(3, t - this.lastT));
    this.lastT = t;
    for (let k = 0; k < dt; k++) {
      GRILLS.forEach((gx, i) => {
        const n = 0.3 + flare(t, i) * 3;
        for (let j = 0; j < Math.floor(n + Math.random()); j++)
          this.embers.push({ x: gx + (Math.random() - 0.5) * 50, y: GRILL_TOP - 8, vx: (Math.random() - 0.5) * 0.8, vy: -0.7 - Math.random() * 1.5, life: 0, max: 60 + Math.random() * 80 });
        if (Math.random() < 0.06) this.puffs.push({ x: gx + (Math.random() - 0.5) * 40, y: GRILL_TOP - 10, r: 2, life: 0, vx: 0.1 });
      });
      for (const e of this.embers) {
        e.life++;
        e.x += e.vx + Math.sin((e.life + e.y) * 0.08) * 0.25;
        e.y += e.vy;
        e.vy *= 0.995;
      }
      this.embers = this.embers.filter((e) => e.life < e.max && e.y > -4);
      for (const s of this.puffs) {
        s.life++;
        s.y -= 0.4;
        s.x += s.vx + Math.sin(s.life * 0.05) * 0.2;
        s.r += 0.08;
      }
      this.puffs = this.puffs.filter((s) => s.life < 150);
      if (this.embers.length > 400) this.embers.splice(0, this.embers.length - 400);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.step(t);
    const fx = -Math.round(camX * 0.25);
    ctx.drawImage(this.far, fx, 0);
    // the oven's fire, and its glow on the back wall
    this.fire(ctx, OVEN.x + fx, OVEN.y, OVEN.rx - 4, 16 + 3 * Math.sin(t * 0.07), t, 5);
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, OVEN.x + fx, OVEN.y - 10, 70, '#ff6020', 0.22 + 0.05 * Math.sin(t * 0.11));
    ctx.globalCompositeOperation = 'source-over';
    this.drawSign(ctx, OVEN.x + fx, t);
    const mx = -Math.round(camX * 0.55);
    this.drawCooks(ctx, mx, t);
    ctx.drawImage(this.mid, mx, 0);
    this.drawPans(ctx, mx, t);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.midGlows) this.glow(ctx, g.x + mx, g.y, g.r, g.col, 0.16 + 0.05 * Math.sin(t * 0.06 + g.ph));
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const sx = g.x + dx;
      if (sx < -g.r * 2 || sx > W + g.r * 2) continue;
      this.glow(ctx, sx, g.y, g.r, g.col, 0.2 + 0.04 * Math.sin(t * 0.05 + g.ph));
    }
    ctx.globalCompositeOperation = 'source-over';
    // the grill stations, flaring up now and then
    GRILLS.forEach((gx, i) => {
      const sx = gx + dx, f = flare(t, i);
      if (sx < -60 || sx > W + 60) return;
      this.fire(ctx, sx, GRILL_TOP - 5, 26, 8 + f * 52, t, i * 37);
      ctx.globalCompositeOperation = 'lighter';
      this.glow(ctx, sx, GRILL_TOP - 14, 50 + f * 34, '#ff7020', 0.24 + f * 0.3 + 0.04 * Math.sin(t * 0.4));
      ctx.globalCompositeOperation = 'source-over';
    });
    for (const s of this.puffs) {
      const a = 0.35 * (1 - s.life / 150);
      ctx.fillStyle = `rgba(90,70,70,${a.toFixed(3)})`;
      const r = Math.round(s.r);
      ctx.fillRect(Math.round(s.x + dx - r), Math.round(s.y - r), r * 2, r * 2);
    }
    // the whole kitchen glows hotter with every flare-up
    const wash = 0.04 + (flare(t, 0) + flare(t, 1)) * 0.07;
    ctx.fillStyle = `rgba(255,90,20,${wash.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    this.drawEmbers(ctx, camX, false);
  }

  drawFront(ctx: CanvasRenderingContext2D, camX: number) {
    this.drawEmbers(ctx, camX, true);
  }

  /** The restaurant's neon sign over the oven; one letter keeps shorting out. */
  drawSign(ctx: CanvasRenderingContext2D, x: number, t: number) {
    if (x < -80 || x > W + 80) return;
    const buzz = Math.floor(t / 7) % 23 === 0 || Math.floor(t / 5) % 41 === 0;
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, x, 46, 54, NEON, buzz ? 0.08 : 0.22);
    ctx.globalCompositeOperation = 'source-over';
    drawText(ctx, 'THE', x, 36, buzz ? '#6a2030' : '#ffd0d8', { align: 'center', outline: '#3a0810' });
    drawText(ctx, 'INFERNO', x, 46, NEON, { align: 'center', outline: '#3a0810', grad: ['#ffe0e8', NEON], scale: 1 });
  }

  /** Line cooks working the range, each with a pan in each hand's reach. */
  drawCooks(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    COOKS.forEach((cx, i) => {
      const sx = cx + mx;
      if (sx < -30 || sx > W + 30) return;
      const bob = Math.round(Math.sin(t * 0.09 + i * 2) * 1 + toss(t, i) * -2);
      ctx.drawImage(this.cooks[i], sx - 12, RANGE_TOP - 52 + 4 + bob);
      // arms out to the pans
      const lift = Math.round(toss(t, i) * 8);
      ctx.fillStyle = '#d8d8dc';
      ctx.fillRect(sx - 14, RANGE_TOP - 20 + bob, 6, 3);
      ctx.fillRect(sx + 8, RANGE_TOP - 20 + bob - lift, 6, 3);
    });
  }

  /** Pans on the burners: gas flames under each, and a flaming toss now and then. */
  drawPans(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    COOKS.forEach((cx, i) => {
      for (const d of [-18, 18]) {
        const sx = cx + d + mx;
        if (sx < -30 || sx > W + 30) continue;
        const tossing = d > 0 ? toss(t, i) : 0;
        const lift = Math.round(tossing * 10);
        // the gas ring's blue and orange lick
        for (let k = -7; k <= 7; k += 2) {
          const h = 2 + Math.round(1.5 + Math.sin(t * 0.6 + k + i) * 1.5);
          ctx.fillStyle = (k + t) % 6 < 3 ? '#4080ff' : '#ff9030';
          ctx.fillRect(sx + k, RANGE_TOP - 5 - h, 1, h);
        }
        const py = RANGE_TOP - 9 - lift;
        ctx.fillStyle = '#1a1a1e';
        ctx.fillRect(sx - 9, py, 18, 3);
        ctx.fillRect(sx - 8, py + 3, 16, 1);
        ctx.fillStyle = '#6a6e76';
        ctx.fillRect(sx + (d < 0 ? -18 : 9), py, 9, 1);
        ctx.fillStyle = '#c87a30';
        ctx.fillRect(sx - 6, py - 1, 12, 1);
        if (tossing > 0.05) {
          // the food arcs up out of the pan and the pan bursts into flame
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = k % 2 ? '#e8a040' : '#5a9a30';
            ctx.fillRect(sx - 5 + k * 3, py - 2 - Math.round(tossing * (8 + k * 2)), 2, 2);
          }
          this.fire(ctx, sx, py, 8, 6 + tossing * 26, t, i * 13 + d);
        }
      }
    });
  }

  drawEmbers(ctx: CanvasRenderingContext2D, camX: number, front: boolean) {
    this.embers.forEach((e, i) => {
      if ((i % 3 === 0) !== front) return;
      const k = e.life / e.max;
      ctx.fillStyle = k < 0.3 ? '#fff0a0' : k < 0.65 ? '#ffa030' : '#c83a18';
      ctx.fillRect(Math.round(e.x - camX), Math.round(e.y), 1, front && k < 0.5 ? 2 : 1);
    });
  }

  /** The uppercut finish: onto the cellar grill, seared, then plated under a silver cloche. */
  makeLanding(): PitLanding {
    const REST = 148;
    const c = this.cloche;
    return {
      rest: REST,
      length: 200,
      pose: P(LIE, { rot: -90, h: 4, af: -170, ef: -20, ab: 20, lf: -10, kf: 20, lb: 10, kb: 10 }),
      land: (f) => {
        c.y = -100;
        c.vy = 0;
        c.landed = false;
        sfx.thud();
        FX.sizzle();
        f.shake(8);
        f.pitParticles.sparks(128, REST, 30, '#ffd040');
        f.pitParticles.smoke(128, REST - 6, 10, '#c8c0b8');
      },
      tick: (f, it) => {
        const ps = f.pitParticles;
        if (!c.landed) {
          if (it % 3 === 0) ps.smoke(128 + (Math.random() - 0.5) * 50, REST - 8, 1, '#b8b0a8');
          if (it % 7 === 0) ps.sparks(128 + (Math.random() - 0.5) * 60, REST + 4, 2, '#ffd040');
          if (it === 24 || it === 48) FX.sizzle();
          if (it === 34) sfx.scream();
        }
        if (it >= 72 && !c.landed) {
          // the cloche drops from the trap door and slams down over them
          c.vy += 0.9;
          c.y += c.vy;
          if (c.y >= 0) {
            c.y = 0;
            c.landed = true;
            FX.panClang();
            f.shake(12);
            ps.sparks(60, 162, 10, '#ffffff');
            ps.sparks(196, 162, 10, '#ffffff');
          }
        }
        if (c.landed && it % 5 === 0) ps.smoke(Math.random() < 0.5 ? 58 : 198, 158, 1, '#e8e4e0');
        if (it === 118) sfx.bell();
      },
      victim: (l, it) => {
        // writhing on the grate, charring a little more every frame until the lid comes down
        const j = it < 60 ? Math.sin(it * 0.8) * (1 - it / 70) * 24 : 0;
        l.poseOverride = P(LIE, { rot: -90, h: 4, af: -170 + j, ef: -20 - j * 0.4, ab: 20 - j, lf: -10 + j * 0.5, kf: 20 + Math.abs(j) * 0.4, lb: 10, kb: 10 });
        l.computePose();
        l.tint = ['#2a0c04', Math.min(0.55, it * 0.008)];
        return 0;
      },
      draw: (ctx, it) => {
        // flames licking up through the grate in front of them
        for (let x = 6; x < W; x += 18) this.fire(ctx, x, 162, 5, 8 + 4 * Math.sin(it * 0.3 + x), it, x);
        if (it < 72) return;
        const y = Math.round(c.y);
        // the cloche, polished and glowing with the coals' light
        ctx.drawImage(this.clocheArt, 128 - 76, 164 + y - 62);
        if (c.landed && it > 104) drawText(ctx, 'ORDER UP!', 116, 84, BRASS, { align: 'center', outline: '#3a0808', grad: ['#fff0a0', ORANGE], scale: 2 });
      },
    };
  }

  /** A flickering pixel fire: hot white core, yellow, orange and a ragged red edge. */
  fire(ctx: CanvasRenderingContext2D, cx: number, base: number, half: number, h: number, t: number, seed: number) {
    const cols = [RED, ORANGE, '#ffc830', '#fff4c0'];
    for (let i = -half; i <= half; i++) {
      const env = 1 - (i / (half + 1)) ** 2;
      const n = 0.65 + 0.2 * Math.sin(t * 0.31 + i * 1.7 + seed) + 0.15 * Math.sin(t * 0.73 + i * 0.9 + seed * 2);
      const hh = h * env * n;
      cols.forEach((c, k) => {
        const lh = Math.round(hh * (1 - k * 0.24));
        if (lh <= 0 || (k > 0 && Math.abs(i) > half * (1 - k * 0.22))) return;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(cx + i), Math.round(base - lh), 1, lh);
      });
      if (Math.sin(t * 0.5 + i * 2.3 + seed) > 0.7) {
        ctx.fillStyle = cols[1];
        ctx.fillRect(Math.round(cx + i), Math.round(base - hh - 3 - ((t + i * 5) % 6)), 1, 2);
      }
    }
  }

  glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, Math.max(0, a)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }
}
