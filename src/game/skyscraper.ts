import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';
import type { Arena } from './stages';

// "The Data Spire": the roof of a black glass tower above a sleeping city, under a sky of
// falling green code. Every layer is painted procedurally at load time; the code rain,
// billboards, beacons and neon are animated at draw time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.3);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.6);
const RAIN_W = W + Math.ceil((STAGE_W - W) * 0.12);

// ------------------------------------------------------------------ glyphs
// 3x5 made-up symbols, pre-tinted from the bright "head" of a stream down to its faded tail.
const GLYPHS = 32;
const TINTS = ['#eafff0', '#7dffa6', '#2ed468', '#179a45', '#0c6a2e', '#06401c'];

function glyphAtlas(): HTMLCanvasElement {
  const p = new Painter(GLYPHS * 4, TINTS.length * 6);
  const r = rng(404);
  for (let g = 0; g < GLYPHS; g++) {
    const bits: boolean[] = [];
    for (let i = 0; i < 15; i++) bits.push(r.next() < 0.42);
    // give every symbol a spine so it reads as a character, not noise
    const spine = r.int(0, 3);
    for (let i = 0; i < 5; i++) {
      if (spine === 0) bits[i * 3 + 1] = true;
      if (spine === 1) bits[i * 3] = true;
      if (spine === 2) bits[i * 3 + 2] = true;
    }
    if (spine === 3) for (let x = 0; x < 3; x++) bits[x] = bits[6 + x] = true;
    TINTS.forEach((c, ti) => {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (bits[y * 3 + x]) p.set(g * 4 + x, ti * 6 + y, c);
    });
  }
  return p.canvas();
}

interface Column { x: number; speed: number; len: number; phase: number; seed: number }

function columns(seed: number, width: number, gap: number, density: number): Column[] {
  const r = rng(seed);
  const out: Column[] = [];
  for (let x = 1; x < width; x += gap)
    if (r.next() < density)
      out.push({ x, speed: r.range(0.35, 1.3), len: r.int(6, 22), phase: r.range(0, 4000), seed: r.int(0, 9999) });
  return out;
}

const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35);
  h ^= h >>> 13;
  return (Math.imul(h, 0x27d4eb2d) ^ (h >>> 15)) >>> 0;
};

// ------------------------------------------------------------------ painted layers
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, 170, '#000302', '#031a0d', 8);
  p.rect(0, 170, W, H - 170, '#031a0d');
  // city glow on the horizon
  for (let y = 110; y < 190; y++)
    for (let x = 0; x < W; x++) {
      const k = 1 - Math.abs(y - 165) / 55;
      if (k * 0.5 > bayer(x, y)) p.set(x, y, mix(p.get(x, y), '#0e4426', 0.5));
    }
  return p.canvas();
}

type Light = [number, number, number]; // x, y, blink phase

function far(lights: Light[]): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(51);
  let x = -6;
  while (x < FAR_W) {
    const w = r.int(12, 30), top = r.int(66, 140);
    p.rect(x, top, w, H - top, '#020b06');
    p.rect(x, top, 1, H - top, '#0b2a18');
    p.rect(x, top, w, 1, '#0b2a18');
    for (let wy = top + 4; wy < H; wy += 4)
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const n = r.next();
        if (n < 0.14) p.set(wx, wy, r.pick(['#1a6a38', '#2a8a4a', '#145a30']));
        else if (n < 0.6) p.set(wx, wy, '#04140a');
      }
    if (r.next() < 0.35) {
      const mx = x + Math.floor(w / 2), len = r.int(6, 18);
      p.rect(mx, top - len, 1, len, '#0b2a18');
      lights.push([mx, top - len, r.int(0, 120)]);
    }
    x += w + r.int(-2, 3);
  }
  return p.canvas();
}

interface Board { x: number; y: number; w: number; h: number; seed: number }

function mid(lights: Light[], boards: Board[]): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(73);
  let x = -10, i = 0;
  while (x < MID_W) {
    const w = r.int(22, 46), top = r.int(100, 150);
    p.rect(x, top, w, H - top, '#010704');
    // horizontal window bands, some floors still working late
    for (let wy = top + 5; wy < H; wy += 6) {
      p.rect(x + 2, wy, w - 4, 2, '#03100a');
      for (let wx = x + 2; wx < x + w - 2; wx++) if (bayer(wx * 3, wy) < 0.4 && r.next() < 0.35) p.set(wx, wy, '#1d7a42');
    }
    // neon trim up the corners
    const trim = r.next() < 0.5 ? '#29d06a' : '#0f5a2e';
    p.rect(x, top, 1, H - top, trim);
    p.rect(x + w - 1, top, 1, H - top, darken(trim, 0.5));
    p.rect(x, top, w, 1, trim);
    // rooftop clutter
    const kind = r.int(0, 2);
    if (kind === 0) {
      const mx = x + r.int(4, w - 4), len = r.int(14, 30);
      p.rect(mx, top - len, 1, len, '#0c2416');
      p.line(mx - 3, top, mx, top - len + 6, '#0c2416');
      p.line(mx + 3, top, mx, top - len + 6, '#0c2416');
      lights.push([mx, top - len - 1, r.int(0, 120)]);
    } else if (kind === 1) {
      p.rect(x + 4, top - 8, 10, 8, '#04120a');
      p.rect(x + 5, top - 10, 8, 2, '#04120a');
    }
    if (i % 3 === 1 && w > 30) {
      const b = { x: x + 4, y: top + 8, w: w - 8, h: 14, seed: i };
      boards.push(b);
      p.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, '#0b3a20');
      p.rect(b.x, b.y, b.w, b.h, '#000');
    }
    x += w + r.int(4, 18);
    i++;
  }
  return p.canvas();
}

const MAST_X = 256;
const NEON = { x: 344, y: 118, w: 12, h: 44 };

function roof(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(97);
  const steel = '#25302a', dark = '#141c18';
  // back parapet rail
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, FLOOR - 16, '#3a4a42');
    p.set(x, FLOOR - 15, dark);
    if (x % 18 === 0) p.rect(x, FLOOR - 16, 2, 16, steel);
  }
  // lattice antenna mast in the middle of the roof
  for (let y = 36; y < FLOOR; y++) {
    const half = 2 + ((y - 36) / (FLOOR - 36)) * 9;
    p.set(Math.round(MAST_X - half), y, steel);
    p.set(Math.round(MAST_X + half), y, steel);
    if ((y - 36) % 12 === 0) p.line(MAST_X - half, y, MAST_X + half, y, steel);
  }
  for (let y = 36; y < FLOOR - 12; y += 12) {
    const h0 = 2 + ((y - 36) / (FLOOR - 36)) * 9, h1 = 2 + ((y + 12 - 36) / (FLOOR - 36)) * 9;
    p.line(MAST_X - h0, y, MAST_X + h1, y + 12, dark);
    p.line(MAST_X + h0, y, MAST_X - h1, y + 12, dark);
  }
  p.rect(MAST_X, 22, 1, 14, steel);
  // water tank on stilts
  const tx = 96;
  for (const lx of [tx - 13, tx - 4, tx + 4, tx + 13]) p.rect(lx, FLOOR - 40, 2, 40, dark);
  p.line(tx - 13, FLOOR - 4, tx + 13, FLOOR - 30, dark);
  p.line(tx + 13, FLOOR - 4, tx - 13, FLOOR - 30, dark);
  p.rect(tx - 16, FLOOR - 70, 32, 30, '#1e2823');
  for (let x = tx - 16; x < tx + 16; x += 4) p.rect(x, FLOOR - 70, 1, 30, '#161e1a');
  for (const by of [FLOOR - 64, FLOOR - 50]) p.rect(tx - 16, by, 32, 1, '#38463e');
  p.poly([[tx - 18, FLOOR - 70], [tx, FLOOR - 82], [tx + 18, FLOOR - 70]], '#1a221e');
  // stairwell hut with a lit door
  p.rect(14, FLOOR - 40, 40, 40, '#1c2420');
  p.rect(12, FLOOR - 43, 44, 3, '#2c3832');
  p.rect(30, FLOOR - 28, 12, 28, '#0a120e');
  p.rect(32, FLOOR - 26, 8, 8, '#2a8a4a');
  p.rect(33, FLOOR - 25, 6, 6, '#5ae08a');
  // air-con units with fan grills
  for (const [ax, aw, ah] of [[168, 36, 20], [404, 30, 24]]) {
    p.rect(ax, FLOOR - ah, aw, ah, '#26302b');
    p.rect(ax, FLOOR - ah, aw, 1, '#3e4c44');
    const cx = ax + aw / 2, cy = FLOOR - ah / 2 - 1, rr = Math.min(aw, ah) / 2 - 3;
    p.ellipse(cx, cy, rr, rr, '#121a16');
    for (let k = -rr; k <= rr; k += 2) p.line(cx - rr, cy + k, cx + rr, cy + k, '#26302b', true);
  }
  // satellite dish
  p.rect(462, FLOOR - 18, 2, 18, dark);
  p.ellipse(458, FLOOR - 26, 10, 7, '#2e3a34');
  p.ellipse(459, FLOOR - 27, 8, 5, '#1a2420');
  p.line(458, FLOOR - 26, 466, FLOOR - 32, steel);
  // neon sign frame (tubes are lit at draw time)
  p.rect(NEON.x - 2, NEON.y - 2, NEON.w + 4, NEON.h + 4, '#141c18');
  p.rect(NEON.x, NEON.y, NEON.w, NEON.h, '#040806');
  for (const lx of [NEON.x, NEON.x + NEON.w - 2]) p.rect(lx, NEON.y + NEON.h + 2, 2, FLOOR - NEON.y - NEON.h - 2, dark);
  p.shade(0.18);
  // concrete deck
  for (let x = 0; x < STAGE_W; x++) {
    for (let y = FLOOR; y < FLOOR + 6; y++) p.set(x, y, bayer(x, y) < 0.2 ? '#323c37' : '#2a332e');
    p.set(x, FLOOR, '#4a5c52');
    if (x % 24 === 0) p.rect(x, FLOOR + 1, 1, 5, '#1a201d');
  }
  // rain puddles catching the green glow
  for (let i = 0; i < 9; i++) {
    const px = r.int(10, STAGE_W - 30), pw = r.int(8, 20);
    for (let x = px; x < px + pw; x++) for (let y = FLOOR + 2; y < FLOOR + 5; y++) if (bayer(x, y) < 0.7) p.set(x, y, '#0d2e1c');
    p.rect(px + 2, FLOOR + 2, Math.floor(pw / 3), 1, '#2f8a52');
  }
  // parapet lip and the tower's face dropping away below
  p.rect(0, FLOOR + 6, STAGE_W, 1, '#56685e');
  p.rect(0, FLOOR + 7, STAGE_W, 3, '#1a201d');
  p.rect(0, FLOOR + 10, STAGE_W, H - FLOOR - 10, '#030806');
  for (let x = 0; x < STAGE_W; x += 8) p.rect(x, FLOOR + 10, 1, H - FLOOR - 10, '#0c1a12');
  for (let y = FLOOR + 13; y < H; y += 5)
    for (let x = 2; x < STAGE_W; x += 8) {
      const n = r.next();
      p.rect(x, y, 5, 2, n < 0.2 ? '#1d6a3a' : n < 0.25 ? '#3ac06a' : '#06120c');
    }
  return p.canvas();
}

// ------------------------------------------------------------------ the stage
export class SkyscraperStage implements Arena {
  name = 'THE DATA SPIRE';
  song: SongName = 'spire';
  atlas = glyphAtlas();
  sky = sky();
  farLights: Light[] = [];
  midLights: Light[] = [];
  boards: Board[] = [];
  far = far(this.farLights);
  mid = mid(this.midLights, this.boards);
  roof = roof();
  rainBack = columns(5, RAIN_W, 5, 0.85);
  rainFront = columns(9, W + 160, 23, 0.6);
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  glyph(ctx: CanvasRenderingContext2D, g: number, tint: number, x: number, y: number, s = 1) {
    ctx.drawImage(this.atlas, (g % GLYPHS) * 4, Math.min(tint, TINTS.length - 1) * 6, 3, 5, x, y, 3 * s, 5 * s);
  }

  /** Falling streams of symbols, snapped to a character grid like an old terminal. */
  rain(ctx: CanvasRenderingContext2D, cols: Column[], ox: number, t: number, dim: number, s = 1) {
    const cell = 6 * s;
    for (const c of cols) {
      const sx = Math.round(c.x - ox);
      if (sx < -4 * s || sx > W) continue;
      const span = H + (c.len + 4) * cell;
      const headRow = Math.floor((((t * c.speed + c.phase) * s) % span) / cell) - 2;
      for (let k = 0; k < c.len; k++) {
        const row = headRow - k;
        const y = row * cell;
        if (y < -cell || y > H) continue;
        const f = k / c.len;
        const tint = k === 0 ? 0 : k < 3 ? 1 : f < 0.45 ? 2 : f < 0.7 ? 3 : f < 0.9 ? 4 : 5;
        const h = hash(c.seed, row);
        // most symbols hold still; a few keep mutating, and the head always does
        const g = k === 0 ? hash(h, t >> 2) : h % 9 === 0 ? hash(h, t >> 4) : h;
        this.glyph(ctx, g, tint + dim, sx, y, s);
      }
    }
  }

  blink(ctx: CanvasRenderingContext2D, lights: Light[], ox: number, t: number, col: string) {
    for (const [x, y, ph] of lights) {
      if ((t + ph) % 120 > 50) continue;
      const sx = Math.round(x - ox);
      if (sx < -3 || sx > W + 3) continue;
      ctx.fillStyle = col;
      ctx.fillRect(sx, y, 1, 1);
      if ((t + ph) % 120 < 20) {
        ctx.globalAlpha = 0.35;
        ctx.fillRect(sx - 1, y, 3, 1);
        ctx.fillRect(sx, y - 1, 1, 3);
        ctx.globalAlpha = 1;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    this.rain(ctx, this.rainBack, camX * 0.12, t, 1);
    const fo = Math.round(camX * 0.3), mo = Math.round(camX * 0.6);
    ctx.drawImage(this.far, -fo, 0);
    this.blink(ctx, this.farLights, fo, t, '#d83030');
    ctx.drawImage(this.mid, -mo, 0);
    this.blink(ctx, this.midLights, mo, t + 40, '#ff4a3a');
    // billboards scroll columns of symbols
    for (const b of this.boards) {
      const bx = b.x - mo;
      if (bx > W || bx + b.w < 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, b.y, b.w, b.h);
      ctx.clip();
      for (let cx = 0; cx < b.w; cx += 4) {
        const off = Math.floor(t / (6 + ((cx + b.seed) % 5)));
        for (let ry = -1; ry < 3; ry++) {
          const g = hash(b.seed * 31 + cx, ry - off);
          this.glyph(ctx, g, ry === 2 ? 1 : 3, bx + cx + 1, b.y + ry * 6 + ((t * 0.3) % 6) + 1);
        }
      }
      ctx.restore();
    }
    const ro = Math.round(camX);
    ctx.drawImage(this.roof, -ro, 0);
    // aircraft beacon on the mast
    const on = t % 90 < 45;
    ctx.fillStyle = on ? '#ff3a2a' : '#5a1010';
    ctx.fillRect(MAST_X - ro - 1, 20, 3, 2);
    if (on) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,60,40,0.12)';
      for (const rr of [10, 6]) ctx.fillRect(MAST_X - ro - rr, 21 - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    // flickering neon sign: a column of big glowing symbols
    const nx = NEON.x - ro;
    if (nx > -NEON.w - 20 && nx < W + 20) {
      const dead = hash(t >> 3, 77) % 23 === 0;
      for (let i = 0; i < 4; i++) this.glyph(ctx, 3 + i * 5, dead && i === 2 ? 5 : 1, nx + 3, NEON.y + 2 + i * 11, 2);
      if (!dead) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(60,255,120,0.07)';
        ctx.fillRect(nx - 8, NEON.y - 6, NEON.w + 16, NEON.h + 12);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** A few big, close streams of code drifting in front of the fighters, plus the odd glitch. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.globalAlpha = 0.16;
    this.rain(ctx, this.rainFront, camX * 0.3 - 20, t, 1, 2);
    ctx.globalAlpha = 1;
    if (t % 340 < 3) {
      const y = 30 + (hash(Math.floor(t / 340), 3) % 150), h = 4 + (hash(Math.floor(t / 340), 5) % 8);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(ctx.canvas, 0, y, W, h, (t % 2 ? 3 : -4), y, W, h);
      ctx.fillStyle = 'rgba(80,255,140,0.10)';
      ctx.fillRect(0, y, W, h);
      ctx.restore();
    }
  }

  /** Close-up for the stage finish: a long drop down the tower onto a rooftop antenna farm. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(131);
    p.gradRect(0, 0, W, H, '#000302', '#04200f', 8);
    // baked code rain in the gap between the towers
    for (let x = 2; x < W; x += 5) {
      if (r.next() < 0.3) continue;
      const len = r.int(4, 16), head = r.int(0, 36);
      for (let k = 0; k < len; k++) {
        const y = (head - k) * 6;
        if (y < 0) continue;
        const ti = Math.min(5, 1 + Math.floor((k / len) * 5));
        const g = hash(x, k);
        const c = darken(TINTS[ti], 0.35);
        for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (hash(g, gy * 3 + gx) % 5 < 2) p.set(x + gx, y + gy, c);
      }
    }
    // tower faces on both sides, narrowing as they fall away below
    for (const side of [-1, 1]) {
      for (let y = 0; y < H; y++) {
        const edge = 58 - y * 0.12;
        for (let i = 0; i < edge; i++) {
          const x = side < 0 ? i : W - 1 - i;
          const col = Math.floor(i / 7), floor = Math.floor(y / 8);
          const win = i % 7 > 1 && y % 8 > 2;
          const lit = hash(col * 13 + (side + 2), floor) % 6 === 0;
          p.set(x, y, win ? (lit ? '#1d7a42' : '#04140a') : '#010805');
        }
        const ex = side < 0 ? Math.floor(edge) : W - 1 - Math.floor(edge);
        p.set(ex, y, '#29d06a');
      }
    }
    // green haze rising from the streets
    for (let y = 120; y < H; y++)
      for (let x = 0; x < W; x++) {
        const k = (y - 120) / 104;
        if (k * 0.35 > bayer(x, y)) p.set(x, y, mix(p.get(x, y), '#1a6a38', 0.35));
      }
    // the rooftop below, bristling with antennas and lightning rods
    p.rect(30, 200, W - 60, H - 200, '#141c18');
    p.rect(30, 200, W - 60, 1, '#3a4a42');
    for (let row = 0; row < 3; row++) {
      const baseY = 200 + row * 8, hgt = 30 + row * 8;
      for (let sx = 38 + row * 6; sx < W - 34; sx += 13 - row * 2) {
        const h = hgt + r.int(-8, 6);
        const col = row === 2 ? '#7a8a82' : row === 1 ? '#56645c' : '#3a4640';
        p.poly([[sx - 2, baseY + 4], [sx, baseY - h + 4], [sx + 2, baseY + 4]], col);
        p.line(sx, baseY - h + 5, sx - 1, baseY + 2, lighten(col, 0.35));
        if (r.next() < 0.4) for (let k = 0; k < 6; k++) p.set(sx + r.int(-1, 1), baseY - h + 5 + k + r.int(0, 3), k < 3 ? '#a01010' : '#600808');
      }
    }
    // the rod in the middle that catches the falling fighter
    p.poly([[124, 214], [128, 146], [132, 214]], '#6a7a72');
    p.line(127, 150, 126, 212, '#a8c0b4');
    const cv = p.canvas();
    // a previous challenger who also went over the edge
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[70, 190, -95, 1], [190, 196, 150, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -110, ab: 50, lf: -30, kf: 70, h: 30 })));
      ctx.restore();
    }
    return cv;
  }
}
