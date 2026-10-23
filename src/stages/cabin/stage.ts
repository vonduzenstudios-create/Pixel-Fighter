import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng, Rng } from '../../core/rng';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import type { SongName } from '../../audio/music';
import type { Particles } from '../../game/particles';

// "Rail-Splitter Woods": a frontier clearing deep in an autumn forest at golden hour. A
// one-room log cabin sits back among the pines with smoke curling from its stone chimney
// and lamplight in the window, a split-rail fence zigzagging past the woodpile. The fighters
// scrap on the leaf-strewn trail between two old oaks, and the uppercut finish drops the
// loser into the ravine behind the cabin, onto a row of sharpened fence rails. Every layer
// is painted procedurally at load time.

const HZ = 120;
const FAR_P = 0.15, MID_P = 0.5;
const FAR_W = W + Math.ceil((STAGE_W - W) * FAR_P);
const MID_W = W + Math.ceil((STAGE_W - W) * MID_P);

// where the chimney top sits in the mid layer (smoke is animated from here)
const CHIMNEY = { x: 228, y: 98 };
const WINDOW = { x: 186, y: 136, w: 12, h: 9 };

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ painting helpers

/** A layered conifer: stacked drooping tiers of needles, lit on the sun side. */
function pine(p: Painter, x: number, base: number, h: number, col: Color, r: Rng, trunk: Color = '#4a2e1a') {
  const w = h * 0.36;
  p.rect(Math.round(x) - 1, base - Math.round(h * 0.18), 2, Math.round(h * 0.18) + 1, trunk);
  const tiers = Math.max(3, Math.round(h / 9));
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const ty = base - h * 0.14 - k * h * 0.86;
    const tw = w * (1 - k * 0.85);
    const th = (h * 0.86) / tiers + 4;
    for (let y = 0; y < th; y++) {
      const half = (tw * (y + 1)) / th;
      for (let dx = -half; dx <= half; dx++) {
        const yy = Math.round(ty - th + y + 1 + Math.abs(dx) * 0.18 * (y / th));
        const xx = Math.round(x + dx);
        let c: Color = col;
        if (dx < -half * 0.3 && bayer(xx, yy) < 0.6) c = lighten(col, 0.18);
        else if (dx > half * 0.4) c = darken(col, 0.22);
        if (y > th - 2) c = darken(col, 0.3);
        p.set(xx, yy, c);
      }
    }
  }
  if (r.next() < 0.5) p.set(Math.round(x), Math.round(base - h), lighten(col, 0.25));
}

/** A broad autumn hardwood: a stout trunk under a lumpy crown of orange, red or gold leaves. */
function hardwood(p: Painter, x: number, base: number, h: number, col: Color, r: Rng) {
  for (let y = base - h * 0.5; y <= base; y++) {
    const w = 2 + (y > base - 4 ? 1 : 0);
    for (let dx = -w; dx <= w; dx++) p.set(Math.round(x + dx), Math.round(y), dx < 0 ? '#3a2416' : '#5a3a22');
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, d = i < 4 ? 0.05 : 0.22;
    const bx = x + Math.cos(a) * h * d * 1.3, by = base - h * 0.66 + Math.sin(a) * h * d, br = h * r.range(0.17, 0.22);
    for (let y = Math.floor(by - br); y <= by + br; y++)
      for (let xx = Math.floor(bx - br); xx <= bx + br; xx++) {
        const dx = (xx + 0.5 - bx) / br, dy = (y + 0.5 - by) / br;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx * 0.6 - dy * 0.6;
        p.set(xx, y, l > 0.45 ? lighten(col, 0.25) : l < -0.35 ? (bayer(xx, y) < 0.5 ? darken(col, 0.3) : darken(col, 0.15)) : col);
      }
  }
}

/** A ridge of trees: a solid silhouette band topped with a ragged row of pines. */
function ridge(p: Painter, top: (x: number) => number, col: Color, bottom: number, step: number, hMin: number, hMax: number, r: Rng) {
  for (let x = 0; x < p.w; x++) for (let y = Math.floor(top(x)); y < bottom; y++) p.set(x, y, bayer(x, y) < 0.12 ? darken(col, 0.08) : col);
  for (let x = r.int(0, step); x < p.w + step; x += step + r.int(-2, 2)) pine(p, x, Math.floor(top(x)) + 3, r.int(hMin, hMax), col, r, darken(col, 0.2));
}

/** A horizontal log with a round cut end, used for the cabin walls and the woodpile. */
function log(p: Painter, x0: number, x1: number, y: number, rad: number, endLeft: boolean, endRight: boolean) {
  for (let x = x0; x <= x1; x++)
    for (let dy = -rad; dy <= rad; dy++) {
      const k = dy / rad;
      let c: Color = k < -0.5 ? '#b07a44' : k < 0.2 ? '#8a5a30' : k < 0.7 ? '#6e4424' : '#4a2c16';
      if (hash(x * 0.37 + y) < 0.08 && Math.abs(k) < 0.6) c = '#5a3a1e';
      p.set(x, y + dy, c);
    }
  const end = (cx: number) => {
    p.ellipse(cx, y, rad + 0.6, rad + 0.6, '#5a3a1e');
    p.ellipse(cx, y, rad - 0.4, rad - 0.4, '#d8b07a');
    p.ellipse(cx, y, rad * 0.45, rad * 0.45, '#c09060');
    p.set(cx, y, '#8a5a30');
  };
  if (endLeft) end(x0);
  if (endRight) end(x1);
}

/** The log cabin: notched log walls, a plank door, a lamplit window, a shake roof and a fieldstone chimney. */
function cabin(p: Painter, x: number, base: number) {
  const w = 76, wallH = 34, logR = 2;
  // fieldstone chimney on the right gable end, behind the roof
  for (let y = CHIMNEY.y; y <= base; y++)
    for (let xx = x + w - 4; xx < x + w + 8; xx++) {
      const row = Math.floor((y - CHIMNEY.y) / 4);
      const off = row % 2 ? 2 : 0;
      const mortar = (y - CHIMNEY.y) % 4 === 3 || (xx + off - x) % 5 === 0;
      const stone = hash(Math.floor((xx + off) / 5) * 7.3 + row * 3.1);
      p.set(xx, y, mortar ? '#5a5048' : mix('#8a8070', '#b0a490', stone));
    }
  p.rect(x + w - 5, CHIMNEY.y - 2, 14, 3, '#6a6058');
  // walls: stacked logs whose round ends poke past the corners
  for (let i = 0; i < wallH / (logR * 2 + 1); i++) {
    const y = base - logR - i * (logR * 2 + 1);
    log(p, x - 3, x + w + 3, y, logR, true, true);
    p.line(x - 3, y + logR + 1, x + w + 3, y + logR + 1, '#c8b890');
  }
  const top = base - wallH;
  // plank door with iron strap hinges
  const dx = x + 44, dw = 14, dh = 24;
  p.rect(dx - 1, base - dh - 1, dw + 2, dh + 1, '#3a2414');
  for (let xx = dx; xx < dx + dw; xx++) for (let y = base - dh; y < base; y++) p.set(xx, y, (xx - dx) % 4 === 3 ? '#4a2e18' : (xx - dx) % 4 === 0 ? '#8a6038' : '#74502c');
  p.rect(dx, base - dh + 4, dw - 3, 1, '#2a2a2a');
  p.rect(dx, base - 7, dw - 3, 1, '#2a2a2a');
  p.set(dx + dw - 3, base - 12, '#c8a040');
  // the window frame and cross; the warm glass is lit (and flickers) at draw time
  p.rect(WINDOW.x - 2, WINDOW.y - 2, WINDOW.w + 4, WINDOW.h + 4, '#3a2414');
  p.rect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, '#ffcc66');
  p.rect(WINDOW.x + WINDOW.w / 2, WINDOW.y, 1, WINDOW.h, '#3a2414');
  p.rect(WINDOW.x, WINDOW.y + 4, WINDOW.w, 1, '#3a2414');
  p.rect(WINDOW.x - 3, WINDOW.y + WINDOW.h + 2, WINDOW.w + 6, 2, '#6a4424');
  // gable triangle of boards under a steep cedar-shake roof
  const peakX = x + w / 2, peakY = top - 26;
  p.poly([[x, top], [peakX, peakY + 2], [x + w, top]], '#7a5030');
  for (let y = peakY; y < top; y += 3) p.line(x, y, x + w, y, '#5a3a20', true);
  const roof = (side: number) => {
    const ex = side < 0 ? x - 8 : x + w + 8;
    for (let k = 0; k <= 1; k += 0.01) {
      const rx = peakX + (ex - peakX) * k, ry = peakY + (top + 4 - peakY) * k;
      for (let d = 0; d < 6; d++) {
        const yy = Math.round(ry + d - 2);
        const row = Math.floor((d + k * 40) / 3);
        const shake = hash(Math.floor(rx / 3) + row * 13.7);
        let c: Color = mix('#5a4a3a', '#7e6650', shake);
        if (d === 0) c = '#a08a6a';
        if ((Math.round(k * 40) % 3) === 0 && d > 0) c = darken(c, 0.25);
        p.set(Math.round(rx), yy, c);
      }
    }
  };
  // fill the whole roof slope, then shade the shady right half
  for (let y = peakY; y <= top + 4; y++) {
    const k = (y - peakY) / (top + 4 - peakY);
    const l = peakX - (peakX - x + 8) * k, rr = peakX + (x + w + 8 - peakX) * k;
    for (let xx = Math.floor(l); xx <= rr; xx++) {
      const row = Math.floor((y - peakY) / 3);
      const shake = hash(Math.floor((xx + (row % 2) * 2) / 4) * 3.3 + row * 13.7);
      let c: Color = mix('#6a5440', '#8e7458', shake);
      if ((y - peakY) % 3 === 2) c = darken(c, 0.3);
      if (xx > peakX) c = darken(c, 0.15);
      p.set(xx, y, c);
    }
  }
  roof(-1);
  roof(1);
  p.line(x - 8, top + 4, x + w + 8, top + 4, '#3a2a1a');
  // a lantern hanging by the door and a rocking chair on the step
  p.rect(dx - 6, base - 20, 3, 4, '#ffd070');
  p.rect(dx - 6, base - 21, 3, 1, '#2a2a2a');
  p.line(x + 22, base - 1, x + 30, base - 1, '#4a2e18');
  p.line(x + 24, base - 1, x + 24, base - 12, '#5a3a20');
  p.line(x + 24, base - 12, x + 27, base - 14, '#5a3a20');
  p.line(x + 24, base - 6, x + 29, base - 6, '#6a4424');
  // a stone step at the door
  p.rect(dx - 3, base, dw + 6, 3, '#9a9080');
  p.rect(dx - 3, base, dw + 6, 1, '#c0b8a8');
}

/** A zigzag split-rail fence: rails stacked crosswise where each panel meets the next. */
function railFence(p: Painter, x0: number, x1: number, base: number) {
  const panel = 22;
  for (let x = x0, i = 0; x < x1; x += panel, i++) {
    const zig = i % 2 ? -3 : 3;
    for (let rail = 0; rail < 4; rail++) {
      const y0 = base - 3 - rail * 4 + zig, y1 = base - 3 - rail * 4 - zig;
      p.line(x, y0, x + panel, y1, '#9a7a54');
      p.line(x, y0 + 1, x + panel, y1 + 1, '#5a4028');
    }
    // the crossing stack of rail ends at every joint
    p.rect(x - 1, base - 18 + zig, 3, 18 - zig, '#6a4c30');
    p.set(x - 1, base - 18 + zig, '#b89a6e');
  }
}

/** A stacked cord of split firewood with its cut faces showing. */
function woodpile(p: Painter, x: number, base: number, cols: number, rows: number) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols - (r % 2); c++) {
      const cx = x + c * 5 + (r % 2) * 2.5 + 2, cy = base - 2 - r * 4;
      p.ellipse(cx, cy, 2.6, 2.2, '#4a2c16');
      p.ellipse(cx, cy, 1.8, 1.5, hash(cx * 1.7 + cy) < 0.5 ? '#d8b07a' : '#c49a64');
      p.set(Math.round(cx), Math.round(cy), '#9a6a3a');
    }
}

// ------------------------------------------------------------------ layers

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops = ['#2a3a5a', '#4a4a6a', '#7a5a6a', '#b8705a', '#e8964a', '#f8c060', '#fce49a'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / HZ) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // the low sun sinking behind the far ridge, with a wide dithered glow
  const sx = 196, sy = 98;
  for (let y = -44; y <= 44; y++)
    for (let x = -44; x <= 44; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= 11) p.set(sx + x, sy + y, d < 9 ? '#fffbe0' : '#ffe8a0');
      else if (d < 44 && ((44 - d) / 33) * 0.6 > bayer(sx + x, sy + y)) p.set(sx + x, sy + y, mix(p.get(sx + x, sy + y), '#ffe0a0', 0.45));
    }
  // long thin streaks of sunset cloud
  const r = rng(2201);
  for (let c = 0; c < 9; c++) {
    const cx = r.int(-20, W), cy = r.int(14, 80), len = r.int(30, 70);
    for (let i = 0; i < len; i++) {
      const th = 1 + Math.round(Math.sin((i / len) * Math.PI) * 2);
      for (let k = 0; k < th; k++) p.set(cx + i, cy + k, k === 0 ? (cy < 50 ? '#c88a8a' : '#ffc890') : cy < 50 ? '#8a6278' : '#e89a70');
    }
  }
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(2213);
  // three ridges of forest stepping forward out of the golden haze
  ridge(p, (x) => 96 + Math.sin(x * 0.02) * 8 + Math.sin(x * 0.07 + 1) * 3, '#a0889a', H, 7, 8, 16, r);
  ridge(p, (x) => 110 + Math.sin(x * 0.03 + 2) * 7 + Math.sin(x * 0.09) * 3, '#76707e', H, 6, 10, 18, r);
  ridge(p, (x) => 124 + Math.sin(x * 0.025 + 4) * 6, '#4e5a5a', H, 5, 12, 22, r);
  // a low bank of mist lying in the valley
  for (let y = 112; y < 140; y++)
    for (let x = 0; x < FAR_W; x++) {
      const a = 1 - Math.abs(y - 124) / 14;
      if (a * 0.55 > bayer(x, y) && p.alpha(x, y)) p.set(x, y, mix(p.get(x, y), '#f0c8a0', 0.45));
    }
  return p.canvas();
}

function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(2229);
  // a dark wall of pines ringing the clearing
  ridge(p, (x) => 132 + Math.sin(x * 0.04) * 4, '#2a3e30', H, 6, 22, 46, r);
  for (let i = 0; i < 9; i++) {
    const x = r.int(0, MID_W);
    if (Math.abs(x - 190) < 60) continue;
    hardwood(p, x, 156, r.int(28, 40), r.pick(['#d0602a', '#e8a030', '#b83a20', '#d88a2a']), r);
  }
  // the clearing: a sunlit meadow of long dry grass
  for (let x = 0; x < MID_W; x++) {
    const ty = 152 + Math.round(Math.sin(x * 0.05) * 1.5);
    for (let y = ty; y < H; y++) {
      const d = y - ty;
      let c: Color = d < 1 ? '#e8c870' : mix('#b89a48', '#6a6a30', Math.min(1, d / 30));
      if (bayer(x, y) < 0.15) c = darken(c, 0.12);
      if (hash(x * 3.1) < 0.4 && d < 3 && bayer(x, y) < 0.5) c = '#f0d888';
      p.set(x, y, c);
    }
    if (hash(x * 1.9) < 0.35) p.set(x, ty - 1, '#d8b860');
  }
  // the cabin, woodpile and fence
  cabin(p, 154, 154);
  woodpile(p, 112, 156, 7, 4);
  railFence(p, 0, 140, 164);
  railFence(p, 250, MID_W, 166);
  // the chopping stump with an axe bitten into it
  p.ellipse(132, 162, 6, 2, '#d8b07a');
  p.rect(126, 162, 13, 5, '#6a4424');
  p.ellipse(132, 162, 4, 1.2, '#c09060');
  p.line(134, 161, 142, 150, '#a07a48');
  p.poly([[131, 158], [136, 158], [135, 163], [131, 162]], '#a8acb4');
  p.line(131, 158, 131, 162, '#e0e4ea');
  // tall pines framing the cabin
  for (const [x, h] of [[96, 70], [300, 78], [330, 58], [20, 64], [372, 72]]) pine(p, x, 160, h, '#1e3426', r);
  return p.canvas();
}

const OAKS = [14, 150, 372, 500];

function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(2237);
  // huge old oak trunks rising out of frame, with bark furrows and a sunlit edge
  for (const ox of OAKS) {
    for (let y = 0; y <= FLOOR + 2; y++) {
      const flare = y > FLOOR - 16 ? (y - (FLOOR - 16)) * 0.7 : 0;
      const w = 11 + flare + Math.sin(y * 0.05 + ox) * 1;
      for (let dx = -w; dx <= w; dx++) {
        const k = dx / w;
        let c: Color = k < -0.6 ? '#e0a060' : k < -0.2 ? '#7a5434' : k < 0.5 ? '#5a3a24' : '#34200f';
        const furrow = Math.sin(dx * 0.9 + Math.sin(y * 0.12 + ox) * 2) > 0.6;
        if (furrow && k > -0.6) c = darken(c, 0.35);
        p.set(Math.round(ox + dx), y, c);
      }
    }
    // roots snaking off along the ground
    for (const s of [-1, 1])
      for (let i = 0; i < 22; i++) {
        const rx = ox + s * (12 + i), ry = FLOOR - 4 + Math.round(i * 0.25 + Math.sin(i * 0.5) * 1);
        p.rect(rx, ry, 1, 4 - Math.floor(i / 7), i % 3 ? '#5a3a24' : '#7a5434');
      }
    // a shelf mushroom and a knot hole
    p.ellipse(ox + 9, FLOOR - 50, 5, 1.6, '#e8d4a8');
    p.ellipse(ox + 9, FLOOR - 49, 5, 1, '#a8885a');
    p.ellipse(ox - 3, FLOOR - 78, 2.4, 3.2, '#1a0e06');
  }
  // ferns and leaf piles along the back edge of the trail
  for (let i = 0; i < 16; i++) {
    const fx = r.int(0, STAGE_W);
    if (OAKS.some((o) => Math.abs(o - fx) < 20)) continue;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI, len = r.int(7, 12);
      for (let j = 0; j < len; j++) {
        const xx = fx + Math.cos(a) * j, yy = FLOOR - Math.sin(-a) * j * 0.8 + (j * j) / len * 0.6;
        p.set(Math.round(xx), Math.round(yy), j < len / 2 ? '#3a7a32' : '#5a9a3a');
        if (j % 2 === 0) p.set(Math.round(xx), Math.round(yy) + 1, '#2a5a26');
      }
    }
  }
  // the trail: packed dirt with ruts, strewn with fallen leaves, over dark loam
  for (let x = 0; x < STAGE_W; x++)
    for (let y = FLOOR; y < H; y++) {
      const d = y - FLOOR;
      let c: Color;
      if (d === 0) c = '#c89a5a';
      else if (d < 3) c = bayer(x, y) < 0.5 ? '#a87a44' : '#9a6c3a';
      else {
        c = mix('#7a5432', '#3a2414', Math.min(1, (d - 3) / 22));
        if (Math.abs(d - 9 - Math.sin(x * 0.03) * 2) < 1) c = darken(c, 0.2);
        if (bayer(x, y) < 0.08) c = lighten(c, 0.12);
      }
      p.set(x, y, c);
    }
  // fallen leaves: little two-pixel flecks in fall colours, thickest along the trail edges
  for (let i = 0; i < 520; i++) {
    const x = r.int(0, STAGE_W), y = FLOOR - 1 + Math.floor(Math.pow(r.next(), 1.6) * (H - FLOOR));
    const col = r.pick(['#e05a20', '#f0a028', '#c03018', '#e8c040', '#a85a20']);
    p.set(x, y, col);
    if (r.next() < 0.6) p.set(x + 1, y, darken(col, 0.2));
  }
  // pebbles and an acorn or two
  for (let i = 0; i < 40; i++) {
    const x = r.int(0, STAGE_W), y = r.int(FLOOR + 4, H - 2);
    p.ellipse(x, y, r.range(1, 2), r.range(0.7, 1.2), r.pick(['#a89a88', '#8a7e70', '#c0b4a0']));
  }
  return p.canvas();
}

/** The uppercut finish: down the leafy ravine behind the cabin onto a row of sharpened rails. */
function ravine(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(2249);
  p.gradRect(0, 0, W, H, '#e8a050', '#2a1a20', 9);
  // steep earthen walls overgrown with roots, closing in toward the bottom
  for (let y = 0; y < H; y++) {
    const L = 36 + y * 0.2 + Math.sin(y * 0.07) * 7 + Math.sin(y * 0.23) * 3;
    const R = 40 + y * 0.18 + Math.sin(y * 0.05 + 2) * 8;
    for (let x = 0; x < W; x++) {
      if (x >= L && x < W - R) continue;
      const band = (Math.floor((y + Math.sin(x * 0.12) * 3) / 6) % 3 + 3) % 3;
      let c: Color = ['#6a4628', '#5a3a20', '#74502c'][band];
      const e = x < L ? L - x : x - (W - R);
      if (e < 3) c = x < L ? darken(c, 0.3) : lighten(c, 0.15);
      if (bayer(x, y) < 0.1) c = darken(c, 0.2);
      p.set(x, y, c);
    }
  }
  // pines leaning over the rim, black against the sunset
  for (let i = 0; i < 6; i++) pine(p, i < 3 ? 6 + i * 14 : W - 8 - (i - 3) * 14, 18 + r.int(-3, 3), r.int(26, 40), '#1a1a1c', r, '#141414');
  // dangling roots and a few clinging ferns
  for (let i = 0; i < 22; i++) {
    const side = i % 2, y0 = r.int(10, 160);
    let x = side ? W - 42 - y0 * 0.18 : 38 + y0 * 0.2, y = y0;
    const len = r.int(6, 16);
    for (let k = 0; k < len; k++) {
      p.set(Math.round(x), y, '#3a2414');
      y++;
      if (r.next() < 0.4) x += side ? -1 : 1;
    }
  }
  // a creek bed of dead leaves and rocks at the bottom
  for (let y = 188; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c: Color = mix('#4a2e1a', '#2a1a10', (y - 188) / 36);
      if (hash(x * 1.3 + y * 7.1) < 0.18) c = r.pick(['#a8401a', '#c87a20', '#8a2a14']);
      p.set(x, y, c);
    }
  // sharpened split rails driven into the creek bed; the centre one catches the falling loser
  const rails: [number, number][] = [[52, 30], [74, 40], [96, 34], [128, 52], [158, 36], [182, 42], [206, 30]];
  for (const [x, h] of rails) {
    const lean = r.range(-2, 2);
    const top = 196 - h;
    p.poly([[x - 3, 200], [x - 3 + lean, top + 6], [x + lean, top], [x + 3 + lean, top + 6], [x + 3, 200]], '#7a5a38');
    p.poly([[x - 3, 200], [x - 3 + lean, top + 6], [x + lean, top], [x + lean, 200]], '#a8845a');
    p.line(x + lean, top, x + 3 + lean, top + 6, '#d8b888');
    for (let y = top + 10; y < 200; y += 5) p.set(Math.round(x + lean * ((200 - y) / h)) + 1, y, '#5a3e24');
  }
  return p.canvas();
}

interface Leaf { x: number; y: number; ph: number; spd: number; col: string }

export class CabinStage {
  name = 'RAIL-SPLITTER WOODS';
  blurb = 'A LOG CABIN IN THE AUTUMN WOODS';
  song: SongName = 'cabin';
  stakeColor = '#a8845a';
  sky = sky();
  far = far();
  mid = mid();
  deck = deck();
  pit = ravine();
  leaves: Leaf[] = [];

  constructor() {
    const r = rng(2251);
    for (let i = 0; i < 18; i++)
      this.leaves.push({ x: r.int(0, STAGE_W), y: r.int(0, H), ph: r.range(0, 6.28), spd: r.range(0.25, 0.5), col: r.pick(['#e05a20', '#f0a028', '#c03018', '#e8c040']) });
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    // a few crows flapping home across the sunset
    for (let i = 0; i < 3; i++) {
      const x = W + 20 - ((t * (0.2 + i * 0.05) + i * 110) % (W + 60)), y = 40 + i * 11 + Math.sin(t * 0.025 + i) * 3;
      const up = Math.sin(t * 0.18 + i * 2) > 0;
      ctx.fillStyle = '#2a1a22';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - (up ? 1 : -1), 2, 1);
      ctx.fillRect(Math.round(x) + 2, Math.round(y) - (up ? 1 : -1), 2, 1);
    }
    ctx.drawImage(this.far, -Math.round(camX * FAR_P), 0);
    const mx = -Math.round(camX * MID_P);
    ctx.drawImage(this.mid, mx, 0);
    // lamplight flickering in the cabin window
    const fl = 0.75 + Math.sin(t * 0.21) * 0.1 + Math.sin(t * 0.53) * 0.08;
    ctx.fillStyle = `rgba(255,${Math.round(150 + fl * 60)},70,${fl.toFixed(2)})`;
    ctx.fillRect(WINDOW.x + mx, WINDOW.y, WINDOW.w / 2, 4);
    ctx.fillRect(WINDOW.x + WINDOW.w / 2 + 1 + mx, WINDOW.y, WINDOW.w / 2 - 1, 4);
    ctx.fillRect(WINDOW.x + mx, WINDOW.y + 5, WINDOW.w / 2, WINDOW.h - 5);
    ctx.fillRect(WINDOW.x + WINDOW.w / 2 + 1 + mx, WINDOW.y + 5, WINDOW.w / 2 - 1, WINDOW.h - 5);
    // woodsmoke curling up from the chimney and drifting off with the breeze
    for (let i = 0; i < 9; i++) {
      const age = ((t * 0.5 + i * 14) % 126) / 126;
      const sx = CHIMNEY.x + 2 + mx + age * 26 + Math.sin(age * 7 + i) * 3, sy = CHIMNEY.y - 3 - age * 70;
      const s = 2 + age * 6;
      ctx.fillStyle = `rgba(200,190,190,${(0.55 * (1 - age)).toFixed(2)})`;
      ctx.fillRect(Math.round(sx - s / 2), Math.round(sy - s / 2), Math.round(s), Math.round(s * 0.8));
    }
    ctx.drawImage(this.deck, -Math.round(camX), 0);
    // shafts of low sunlight slanting through the trees
    ctx.fillStyle = 'rgba(255,220,140,0.07)';
    for (let i = 0; i < 4; i++) {
      const bx = i * 140 + 40 - Math.round(camX * 0.8) + Math.sin(t * 0.01 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 18, 0);
      ctx.lineTo(bx - 40, FLOOR);
      ctx.lineTo(bx - 70, FLOOR);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Autumn leaves tumbling down and fireflies winking on as the sun sets. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (const l of this.leaves) {
      const y = (l.y + t * l.spd) % (H + 10) - 5;
      const wx = l.x + Math.sin(t * 0.03 + l.ph) * 14 + t * 0.15;
      const x = Math.round(((wx - camX * 1.1) % (STAGE_W + 20) + STAGE_W + 20) % (STAGE_W + 20) - 10);
      if (x < -3 || x > W + 3) continue;
      const flip = Math.sin(t * 0.12 + l.ph) > 0;
      ctx.fillStyle = l.col;
      ctx.fillRect(x, Math.round(y), flip ? 2 : 1, flip ? 1 : 2);
    }
    for (let i = 0; i < 8; i++) {
      const glow = Math.sin(t * 0.06 + i * 2.3);
      if (glow < 0.3) continue;
      const wx = (i * 67 + Math.sin(t * 0.008 + i) * 30) % STAGE_W;
      const x = Math.round(wx - camX * 1.05), y = Math.round(150 + Math.sin(t * 0.017 + i * 1.3) * 18);
      if (x < -2 || x > W + 2) continue;
      ctx.fillStyle = glow > 0.8 ? '#fffcb0' : '#d8f070';
      ctx.fillRect(x, y, 1, 1);
      if (glow > 0.8) {
        ctx.fillStyle = 'rgba(240,255,140,0.35)';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    }
  }

  /** Dead leaves stirred up around the rails after the landing. */
  pitTick(p: Particles, it: number) {
    if (it % 5 === 0) p.smoke(128 + rand(-50, 50), H - 30 + rand(-2, 4), 1, '#8a5a30');
  }
}
