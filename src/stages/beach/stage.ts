import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng, Rng } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { makeCanvas, Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import type { SongName } from '../../audio/music';
import { P, LIE } from '../../game/anims';
import type { Fight } from '../../game/fight';
import type { Particles } from '../../game/particles';
import type { PitLanding } from '../../game/stages';

// "Coral Cove": a sunny lagoon where the fighters slug it out ankle-deep in the surf. Waves
// break on the reef behind them and wash up past their feet, every step and landing throws up
// spray, and the uppercut finish knocks the loser out over the reef into a giant clam.
// Every layer is painted procedurally at load time.

const HZ = 112;
const FAR_W = W + Math.ceil((STAGE_W - W) * 0.15);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.5);
/** Screen y of the reef where the waves break, and of the back edge of the shallows. */
const REEF_Y = 156;
/** Frames from one breaking wave to the next. */
const WAVE = 320;
/** Top of the ankle-deep water drawn over the fighters' feet. */
const ANKLE = FLOOR - 4;
const TOWER_X = 70;
const RING_X = 318;
const ROPE: [number, number] = [150, 390];
const SPRAY = ['#ffffff', '#e0faff', '#a8ecf4', '#7ad8e8'];

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ painting helpers

/** A leaning palm: a ringed trunk curving up to a crown of drooping fronds and coconuts. */
function palm(p: Painter, x: number, base: number, h: number, lean: number, r: Rng) {
  let tx = x, ty = base;
  for (let i = 0; i <= h; i++) {
    const k = i / h;
    tx = x + lean * k * k * h * 0.5;
    ty = base - i;
    const w = 3 - k * 1.2;
    for (let dx = -w; dx <= w; dx++) p.set(Math.round(tx + dx), ty, dx < -w + 1.2 ? '#5a3a1a' : i % 4 === 0 ? '#6a4420' : dx > w - 1.2 ? '#b08048' : '#8a5e30');
  }
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI + (f / 6) * Math.PI + r.range(-0.15, 0.15);
    const len = r.range(16, 24);
    for (let s = 0; s <= len; s++) {
      const k = s / len;
      const fx = tx + Math.cos(a) * s, fy = ty + Math.sin(a) * s * 0.55 + k * k * 12;
      p.set(Math.round(fx), Math.round(fy), '#2a7a2a');
      p.set(Math.round(fx), Math.round(fy) - 1, '#4aa83a');
      if (s % 2 === 0 && s > 2) for (let l = 1; l < 5 - k * 3; l++) p.set(Math.round(fx + Math.cos(a) * l * 0.3), Math.round(fy) + l, l < 2 ? '#3a9a34' : '#1e6a24');
    }
  }
  for (const [cx, cy] of [[-2, 2], [2, 3], [0, 4]]) p.ellipse(tx + cx, ty + cy, 1.6, 1.6, '#5a3a14');
}

/** Rounded wet rocks with a sunlit top edge. */
function rocks(p: Painter, cx: number, base: number, r: Rng, n: number, big: number) {
  for (let i = 0; i < n; i++) {
    const rx = r.range(big * 0.4, big), ry = rx * r.range(0.6, 0.9);
    const x = cx + r.range(-big * 1.2, big * 1.2), y = base - ry * 0.6 + r.range(-2, 2);
    for (let yy = Math.floor(y - ry); yy <= y + ry; yy++)
      for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) {
        const dx = (xx + 0.5 - x) / rx, dy = (yy + 0.5 - y) / ry;
        if (dx * dx + dy * dy > 1 || yy > base) continue;
        const l = -dx * 0.5 - dy * 0.7;
        let c: Color = '#5a5a5e';
        if (l > 0.45) c = bayer(xx, yy) < (l - 0.45) * 3 ? '#9a968e' : '#7a7874';
        else if (l < -0.2) c = bayer(xx, yy) < 0.6 ? '#3a3a40' : '#4a4a50';
        if (yy > base - 3) c = mix(c, '#1a5a68', 0.4);
        p.set(xx, yy, c);
      }
  }
}

/** A gentle foam rim where something stands in the water. */
function foam(p: Painter, x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x++) {
    if (hash(x * 1.7) < 0.75) p.set(x, y, '#e8fcff');
    if (hash(x * 3.1) < 0.35) p.set(x, y + 1, '#b8eef4');
  }
}

// ------------------------------------------------------------------ layers

function sky(): HTMLCanvasElement {
  const p = new Painter(W, HZ + 2);
  const stops = ['#2a6ad0', '#3a86e0', '#5aa4ec', '#86c4f2', '#b8e0f4', '#f0f0d8'];
  for (let y = 0; y < HZ + 2; y++) {
    const t = Math.min(1, y / HZ) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // the sun with a dithered halo
  const sx = 196, sy = 34;
  for (let y = -26; y <= 26; y++)
    for (let x = -26; x <= 26; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= 9) p.set(sx + x, sy + y, d < 7 ? '#fffff0' : '#fff8b0');
      else if (d < 26 && ((26 - d) / 17) * 0.55 > bayer(sx + x, sy + y)) p.set(sx + x, sy + y, mix(p.get(sx + x, sy + y), '#fff4c0', 0.45));
    }
  return p.canvas();
}

/** Fat cumulus clouds on a wrap-around strip that drifts slowly overhead. */
function clouds(): HTMLCanvasElement {
  const CW = W * 2;
  const p = new Painter(CW, 80);
  const r = rng(907);
  for (let c = 0; c < 7; c++) {
    const cx = c * (CW / 7) + r.int(0, 30), cy = r.int(18, 64), sc = r.range(0.6, 1.2);
    const puffs: [number, number, number][] = [];
    for (let k = 0; k < 6; k++) puffs.push([cx + (k - 2.5) * 9 * sc + r.range(-3, 3), cy - Math.sin((k / 5) * Math.PI) * 8 * sc, r.range(6, 10) * sc]);
    for (const [px, py, pr] of puffs)
      for (let y = Math.floor(py - pr); y <= py + pr; y++)
        for (let x = Math.floor(px - pr); x <= px + pr; x++) {
          if (y > cy + 3 * sc) continue;
          const dx = x - px, dy = y - py;
          if (dx * dx + dy * dy > pr * pr) continue;
          const lit = -dx * 0.4 - dy * 0.8;
          const xx = ((x % CW) + CW) % CW;
          p.set(xx, y, y > cy + 1 ? '#c8d8e8' : lit > pr * 0.4 ? '#ffffff' : lit < -pr * 0.3 && bayer(xx, y) < 0.5 ? '#d0e0ee' : '#f0f6fa');
        }
  }
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(911);
  // open sea out to the horizon, deepening toward the reef
  for (let y = HZ; y < REEF_Y + 4; y++) {
    const t = (y - HZ) / (REEF_Y + 4 - HZ);
    for (let x = 0; x < FAR_W; x++) {
      let c = mix('#2a6cb8', '#1e88b8', t);
      const w = Math.sin(x * (0.2 - t * 0.12) + y * 1.7) + Math.sin(x * 0.05 + y * 0.9);
      if (w > 1.5 - t * 0.4) c = lighten(c, 0.18);
      else if (w < -1.4 && bayer(x, y) < 0.5) c = darken(c, 0.12);
      p.set(x, y, c);
    }
  }
  for (let x = 0; x < FAR_W; x++) p.set(x, HZ, '#a8d8f0');
  // a volcanic island with palms and a waterfall, far out to the left
  const ix = 70;
  for (let x = ix - 54; x <= ix + 54; x++) {
    const d = Math.abs(x - ix) / 54;
    const top = HZ - Math.round((1 - d * d) * 34 + Math.sin(x * 0.3) * 1.5);
    for (let y = top; y <= HZ; y++) {
      const lit = x < ix ? 0.2 : -0.2;
      let c: Color = y - top < 3 ? '#4a9a5a' : '#3a8050';
      if (lit < 0 && bayer(x, y) < 0.4) c = darken(c, 0.2);
      if (y > HZ - 4) c = '#d8c88a';
      p.set(x, y, c);
    }
  }
  for (let y = HZ - 26; y < HZ - 4; y++) p.set(ix + 8 + (y % 3 === 0 ? 1 : 0), y, '#d8f0ff');
  for (const [px, ph] of [[ix - 40, 9], [ix - 30, 12], [ix + 36, 10], [ix + 44, 8]]) {
    p.rect(px, HZ - 4 - ph, 1, ph, '#3a3020');
    for (let k = -3; k <= 3; k++) p.set(px + k, HZ - 4 - ph + (Math.abs(k) > 1 ? 1 : 0), '#2a6a34');
  }
  // a sea stack with an arch worn through it, to the right
  const ax = 238;
  for (let x = ax - 18; x <= ax + 18; x++) {
    const top = HZ - 28 + Math.round(Math.abs(x - ax) * 0.5 + Math.sin(x) * 1.2);
    for (let y = top; y <= HZ; y++) {
      if (Math.abs(x - ax + 2) < 6 && y > HZ - 12) continue;
      p.set(x, y, x < ax - 6 ? '#8a8a7a' : bayer(x, y) < 0.3 ? '#5a5a52' : '#6a6a60');
    }
  }
  for (let x = ax - 18; x <= ax + 18; x++) p.set(x, HZ - 28 + Math.round(Math.abs(x - ax) * 0.5 + Math.sin(x) * 1.2), '#3a8a3a');
  for (let i = 0; i < 30; i++) p.set(r.int(0, FAR_W), r.int(HZ + 2, REEF_Y), '#e8f8ff');
  return p.canvas();
}

function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(929);
  // a sand spit on the left with a pair of palms
  for (let x = 0; x < 96; x++) {
    const top = 146 - Math.round(Math.sqrt(Math.max(0, 1 - Math.pow(x / 96, 2))) * 8);
    for (let y = top; y < REEF_Y; y++) p.set(x, y, y - top < 1 ? '#fff4c8' : bayer(x, y) < 0.15 ? '#c8b070' : '#e0c888');
    foam(p, x, x, REEF_Y - 1);
  }
  palm(p, 26, 142, 34, 0.6, r);
  palm(p, 54, 142, 26, -0.5, r);
  // a beach umbrella and a deck chair on the spit
  p.rect(76, 124, 1, 20, '#e0e0e0');
  for (let x = -11; x <= 11; x++) {
    const yy = 124 - Math.round(Math.sqrt(1 - (x / 12) ** 2) * 5);
    for (let y = yy; y <= 125; y++) p.set(76 + x, y, Math.floor((x + 12) / 4) % 2 ? '#ffffff' : '#e83a5a');
  }
  p.line(66, 144, 72, 136, '#8a5a30');
  p.line(70, 144, 66, 140, '#8a5a30');
  p.line(68, 141, 74, 141, '#3a8ad8');
  // a wooden pier on pilings out to the right, a thatched tiki hut at its end
  const PX0 = 236;
  for (let px = PX0; px < MID_W; px += 14) {
    p.rect(px, 128, 3, REEF_Y - 128, '#5a3a1e');
    p.rect(px, 128, 1, REEF_Y - 128, '#7a5430');
    foam(p, px - 1, px + 3, REEF_Y - 1);
  }
  p.rect(PX0 - 4, 124, MID_W - PX0 + 4, 4, '#a07440');
  p.rect(PX0 - 4, 124, MID_W - PX0 + 4, 1, '#c89a60');
  for (let x = PX0 - 4; x < MID_W; x += 5) p.set(x, 126, '#6a4420');
  for (let px = PX0; px < MID_W; px += 14) p.rect(px, 116, 1, 8, '#7a5430');
  p.rect(PX0 - 4, 116, MID_W - PX0 + 4, 1, '#7a5430');
  const hx = 330;
  p.rect(hx - 18, 100, 36, 24, '#8a5a2a');
  for (let y = 100; y < 124; y += 3) p.rect(hx - 18, y, 36, 1, '#6a4420');
  p.rect(hx - 6, 108, 12, 16, '#2a1a0c');
  p.rect(hx - 14, 104, 6, 6, '#ffe080');
  p.rect(hx + 8, 104, 6, 6, '#ffe080');
  p.poly([[hx - 26, 102], [hx, 84], [hx + 26, 102]], '#c8a050');
  for (let x = hx - 26; x <= hx + 26; x += 2) p.line(x, 102, x + 1, 105 + (x % 3), '#a8803a');
  for (let y = 88; y < 102; y += 4) p.line(hx - (102 - y) * 1.4, y, hx + (102 - y) * 1.4, y, '#a8803a');
  // a surfboard propped by the door
  p.ellipse(hx + 21, 112, 2, 10, '#ff7a30');
  p.rect(hx + 21, 103, 1, 18, '#ffffff');
  return p.canvas();
}

/** The lagoon floor: shallow turquoise water over rippled sand, with the props standing in it. */
function ground(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(947);
  for (let y = REEF_Y; y < H; y++) {
    const t = (y - REEF_Y) / (H - REEF_Y);
    for (let x = 0; x < STAGE_W; x++) {
      // sand shows more clearly the shallower the water gets
      const water = mix('#1e9cb4', '#5ad8d4', t);
      const ripple = Math.sin(x * 0.11 + Math.sin(y * 0.35) * 2 + y * 0.6);
      let sand: Color = ripple > 0.55 ? '#f0e0a8' : ripple < -0.6 ? '#c8b07a' : '#e0cc94';
      let c = mix(water, sand, 0.15 + t * 0.4);
      if (bayer(x, y) < 0.07) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
  }
  // the reef lip: a dark band of coral heads under the breaking surf
  for (let x = 0; x < STAGE_W; x++)
    for (let y = REEF_Y; y < REEF_Y + 5; y++) if (hash(x * 0.37 + y * 9.1) < 0.5 - (y - REEF_Y) * 0.1) p.set(x, y, mix('#1a6a80', '#2a4a5a', hash(x)));
  // shells, starfish and pebbles under the water up front
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, STAGE_W), y = r.int(180, H - 2), k = r.next();
    const tint = (c: string) => mix(c, '#5ad8d4', 0.3);
    if (k < 0.12) {
      const c = tint(r.pick(['#ff7a4a', '#ff5a7a', '#ffb040']));
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2 - Math.PI / 2;
        for (let s = 0; s < 3; s++) p.set(Math.round(x + Math.cos(ang) * s), Math.round(y + Math.sin(ang) * s * 0.6), c);
      }
    } else if (k < 0.35) {
      p.ellipse(x, y, 2, 1.2, tint('#f8e8e0'));
      p.set(x - 1, y, tint('#d8a8a0'));
      p.set(x + 1, y, tint('#d8a8a0'));
    } else p.rect(x, y, r.int(1, 2), 1, tint(r.pick(['#8a8478', '#a89c88', '#6a7068'])));
  }
  // a rocky outcrop on the right with a tide pool and a palm, deeper water foaming round it
  rocks(p, 452, 176, r, 9, 13);
  foam(p, 424, 482, 176);
  palm(p, 446, 160, 40, -0.7, r);
  // the lifeguard tower, legs braced in the water
  const tx = TOWER_X, base = 174;
  for (const s of [-1, 1]) {
    p.line(tx + s * 14, base, tx + s * 9, 120, '#e8e0d0');
    p.line(tx + s * 15, base, tx + s * 10, 120, '#c8c0b0');
  }
  p.line(tx - 12, 160, tx + 12, 136, '#c8c0b0');
  p.line(tx + 12, 160, tx - 12, 136, '#c8c0b0');
  foam(p, tx - 17, tx - 12, base);
  foam(p, tx + 12, tx + 17, base);
  for (let k = 0; k < 7; k++) p.rect(tx + 16 - k * 1, base - 4 - k * 7, 6, 1, '#b8b0a0');
  p.rect(tx - 16, 118, 32, 3, '#c8c0b0');
  p.rect(tx - 15, 96, 30, 22, '#f0ece0');
  p.rect(tx - 15, 108, 30, 4, '#e83a3a');
  p.rect(tx - 11, 99, 22, 8, '#2a5a7a');
  p.rect(tx - 11, 99, 22, 1, '#8ac8e8');
  p.poly([[tx - 20, 97], [tx, 86], [tx + 20, 97]], '#e83a3a');
  p.line(tx - 20, 97, tx + 20, 97, '#a82020');
  p.rect(tx + 12, 70, 1, 18, '#a8a8a8');
  // a life ring hung on the rail
  p.ellipse(tx - 20, 126, 4, 4, '#ff6a3a');
  p.ellipse(tx - 20, 126, 2, 2, '#000', true);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) p.set(tx - 20 + dx, 126 + dy, '#ffffff');
  for (let y = 124; y <= 128; y++) for (let x = tx - 22; x <= tx - 18; x++) if ((x - tx + 20) ** 2 + (y - 126) ** 2 < 4) p.set(x, y, [0, 0, 0], 0);
  // the rope line's anchor posts
  for (const x of ROPE) {
    p.rect(x - 1, 158, 3, 12, '#7a5430');
    p.rect(x - 1, 158, 1, 12, '#a07440');
    foam(p, x - 3, x + 3, 170);
  }
  return p.canvas();
}

/** A wrap-around tile of sunlight caustics, added over the sandy bottom. */
function caustics(): HTMLCanvasElement {
  const TW = 64, TH = 24;
  const [cv, ctx] = makeCanvas(TW, TH);
  const k = (Math.PI * 2) / TW, q = (Math.PI * 2) / TH;
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const v = Math.sin(x * k * 2 + Math.sin(y * q) * 1.8) + Math.sin(y * q * 2 + Math.sin(x * k * 3) * 1.6) + Math.sin((x * k + y * q) * 1);
      const a = Math.abs(v) < 0.22 ? 0.32 : Math.abs(v) < 0.45 ? 0.14 : 0;
      if (!a) continue;
      ctx.fillStyle = `rgba(220,255,250,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  return cv;
}

// ------------------------------------------------------------------ the giant clam finish

/** Screen y of the sea surface in the finish close-up. */
const SURF = 62;
const HINGE: [number, number] = [86, 190];
const CLAM_CX = 132, CLAM_RX = 46;

function clamPit(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(971);
  p.gradRect(0, 0, W, SURF, '#4a9ae8', '#c0e8f8', 6);
  // the cove far behind, the sun glinting on the water
  for (let x = 0; x < W; x++) {
    const top = SURF - 6 - Math.round(Math.max(0, Math.sin(x * 0.02 + 0.6)) * 16 + Math.sin(x * 0.2));
    if (x > 150) continue;
    for (let y = top; y < SURF; y++) p.set(x, y, y - top < 2 ? '#5aaa5a' : '#3a8a4a');
  }
  // underwater: bright near the surface, deep blue at the reef
  for (let y = SURF; y < H; y++) {
    const t = (y - SURF) / (H - SURF);
    for (let x = 0; x < W; x++) {
      let c = mix('#3ac8d8', '#0e5a8a', t);
      if (bayer(x, y) < 0.06) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
  }
  // light shafts slanting down from the surface
  for (const rx of [40, 120, 200])
    for (let y = SURF; y < 190; y++)
      for (let x = 0; x < W; x++) {
        const w = 8 + (y - SURF) * 0.07, d = Math.abs(x - rx - (y - SURF) * 0.3);
        if (d < w && (1 - d / w) * 0.3 * (1 - (y - SURF) / 128) > bayer(x, y)) p.set(x, y, mix(p.get(x, y), '#a8f0f0', 0.35));
      }
  // the surface seen from below: a bright rippling band
  for (let x = 0; x < W; x++) {
    const sy = SURF + Math.round(Math.sin(x * 0.15) * 1.2);
    p.set(x, sy, '#e8ffff');
    p.set(x, sy + 1, '#90e8f0');
  }
  // sandy floor
  for (let x = 0; x < W; x++) {
    const sy = Math.round(206 + Math.sin(x * 0.04) * 3 + Math.sin(x * 0.17));
    for (let y = sy; y < H; y++) p.set(x, y, y === sy ? '#f0e0a0' : bayer(x, y) < 0.3 ? '#b8a070' : '#d0b880');
  }
  // coral: branching fingers, brain-coral domes and fan corals along the reef
  const branch = (x: number, y: number, len: number, ang: number, c: string, d: number) => {
    for (let s = 0; s < len; s++) {
      const bx = Math.round(x + Math.cos(ang) * s), by = Math.round(y - Math.sin(ang) * s);
      p.rect(bx, by, 2, 1, s === len - 1 ? lighten(c, 0.35) : c);
      p.set(bx + 1, by, lighten(c, 0.15));
    }
    if (d > 0) {
      const ex = x + Math.cos(ang) * len, ey = y - Math.sin(ang) * len;
      branch(ex, ey, len * 0.7, ang + 0.5, c, d - 1);
      branch(ex, ey, len * 0.7, ang - 0.45, c, d - 1);
    }
  };
  for (const [cx, c] of [[18, '#ff6a8a'], [62, '#ff9a3a'], [214, '#c86ae0'], [242, '#ff6a8a'], [190, '#ffb84a']] as [number, string][])
    branch(cx, 206, r.int(9, 14), Math.PI / 2 + r.range(-0.2, 0.2), c, 2);
  for (const [cx, rr, c] of [[40, 9, '#a8c040'], [228, 7, '#d8a040'], [176, 6, '#80c0a0']] as [number, number, string][]) {
    p.ellipse(cx, 206, rr, rr * 0.8, c);
    for (let k = -rr; k < rr; k += 2) for (let y = -rr; y < 0; y++) if (Math.sin((k + y) * 1.3) > 0.4) p.over(cx + k, 206 + y * 0.8, darken(c, 0.3));
  }
  for (const fx of [100, 150]) {
    for (let a = 0; a < 9; a++) {
      const ang = Math.PI * (0.25 + (a / 8) * 0.5);
      for (let s = 0; s < 24; s++) p.set(Math.round(fx + Math.cos(ang) * s), Math.round(206 - Math.sin(ang) * s), s % 3 ? '#8a3aa0' : '#b85ac8');
    }
  }
  // schools of little fish
  for (const [sx, sy, c] of [[30, 100, '#ffe040'], [200, 126, '#50b0ff']] as [number, number, string][])
    for (let i = 0; i < 9; i++) {
      const fx = sx + r.int(0, 30), fy = sy + r.int(0, 14);
      p.rect(fx, fy, 3, 2, c);
      p.set(fx + 3, fy, darken(c, 0.3));
      p.set(fx + 3, fy + 1, darken(c, 0.3));
      p.set(fx, fy, '#101010');
    }
  // the soft purple flesh inside the clam, seen when it gapes
  const [hx, hy] = HINGE;
  for (let y = hy - 20; y <= hy; y++)
    for (let x = hx + 4; x <= CLAM_CX + CLAM_RX - 4; x++) {
      const dx = (x - CLAM_CX) / (CLAM_RX - 4), dy = (y - hy) / 20;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, bayer(x, y) < 0.2 ? '#6a3a98' : Math.sin(x * 0.5 + y) > 0.8 ? '#3ab8b0' : '#4a2878');
    }
  return p.canvas();
}

/** The clam's lower shell with its frilled mantle and a pearl, drawn over the victim lying in it. */
function clamFront(): HTMLCanvasElement {
  const p = new Painter(W, H);
  // fluted lower shell, fluted, with a frilled purple-and-teal mantle and a pearl
  const [hx, hy] = HINGE;
  for (let y = hy; y <= hy + 18; y++)
    for (let x = hx; x <= CLAM_CX + CLAM_RX; x++) {
      const dx = (x - CLAM_CX) / CLAM_RX, dy = (y - hy) / 18;
      if (dx * dx + dy * dy > 1) continue;
      const flute = Math.sin(Math.atan2(y - hy + 4, x - hx) * 26);
      let c: Color = flute > 0.3 ? '#e8e0cc' : flute < -0.5 ? '#9a9080' : '#c8c0aa';
      if (dy > 0.75 && bayer(x, y) < 0.5) c = darken(c, 0.25);
      p.set(x, y, c);
    }
  for (let x = hx + 2; x <= CLAM_CX + CLAM_RX - 2; x++) {
    const w = Math.round(Math.sin(x * 0.7) * 1.2);
    p.set(x, hy - 1 + w, '#3ad0c0');
    p.set(x, hy + w, '#6a3aa8');
    p.set(x, hy + 1 + w, '#4a2a88');
    if (x % 6 === 0) p.set(x, hy - 2 + w, '#80f0e0');
  }
  p.ellipse(CLAM_CX + 24, hy - 3, 3, 3, '#f8f4ff');
  p.set(CLAM_CX + 23, hy - 4, '#ffffff');
  p.set(CLAM_CX + 25, hy - 2, '#c8c0e0');
  return p.canvas();
}

/** The clam's upper shell, drawn rotated about the hinge so it can gape and snap shut. */
function clamLid(): HTMLCanvasElement {
  const LW = CLAM_CX + CLAM_RX - HINGE[0] + 4, LH = 30;
  const p = new Painter(LW, LH);
  const ox = 2, base = LH - 3, cx = CLAM_CX - HINGE[0] + ox;
  for (let y = 0; y <= base; y++)
    for (let x = ox; x < LW; x++) {
      const dx = (x - cx) / CLAM_RX, dy = (base - y) / 24;
      if (dx * dx + dy * dy > 1) continue;
      const flute = Math.sin(Math.atan2(base - y + 4, x - ox) * 26);
      const l = -dx * 0.3 + dy * 0.7;
      let c: Color = flute > 0.3 ? '#f4ecd8' : flute < -0.5 ? '#a89c88' : '#d4ccb4';
      if (l > 0.7 && bayer(x, y) < 0.5) c = lighten(c, 0.15);
      p.set(x, y, c);
    }
  // frilled mantle along the lid's lip
  for (let x = ox + 2; x < LW - 3; x++) {
    const w = Math.round(Math.sin(x * 0.7 + 1) * 1.2);
    p.set(x, base + 1 + w, '#6a3aa8');
    p.set(x, base + w, '#3ad0c0');
  }
  return p.canvas();
}

const splashSound = (big: number) => {
  noise({ dur: 0.18 + big * 0.25, vol: 0.12 + big * 0.12, type: 'bandpass', freq: 1500, to: 400, q: 0.7, attack: 0.005 });
  noise({ dur: 0.3 + big * 0.3, vol: 0.06 + big * 0.1, type: 'lowpass', freq: 900, to: 150 });
  if (big > 0.5) tone({ type: 'sine', freq: 180, to: 60, dur: 0.3, vol: 0.2 });
};

interface Foot { x: number; wet: boolean; moving: boolean }
interface Ring { x: number; age: number; size: number }

export class BeachStage {
  name = 'CORAL COVE';
  blurb = 'ANKLE-DEEP SURF AND A HUNGRY CLAM';
  song: SongName = 'beach';
  sky = sky();
  clouds = clouds();
  far = far();
  mid = mid();
  ground = ground();
  caustics = caustics();
  pit = clamPit();
  shell = clamFront();
  lid = clamLid();
  feet: Foot[] = [];
  rings: Ring[] = [];
  prev = new Map<object, { x: number; y: number; vy: number; struck: boolean }>();
  lastSound = -1;
  lastY = -100;

  /** The uppercut finish: the loser sails out over the reef, splashes down and lands in a giant clam. */
  pitLanding: PitLanding = {
    rest: HINGE[1] - 12,
    length: 170,
    pose: P(LIE, { rot: -90, af: -40, ab: 30, lf: 10, kf: 30, lb: -10, kb: 40 }),
    fall: (f, y) => this.clamFall(f.pitParticles, y),
    land: (f) => this.clamStep(f.pitParticles, 0),
    tick: (f, it) => this.clamStep(f.pitParticles, it),
    draw: (ctx, it) => this.clamDraw(ctx, it),
    drawFall: (ctx) => this.clamDraw(ctx, -1),
  };

  reset() {
    this.feet = [];
    this.rings = [];
    this.prev.clear();
  }

  /** Watch the fighters: splashes when they land, spray as they wade and from low kicks. */
  update(f: Fight) {
    this.feet = [];
    for (const ft of f.f) {
      const pv = this.prev.get(ft) ?? { x: ft.x, y: ft.y, vy: 0, struck: false };
      const dx = ft.x - pv.x, vy = ft.y - pv.y;
      const sp = ft.alpha > 0 ? ft.strikePoint() : null;
      if (ft.alpha > 0 && ft.state !== 'thrown') {
        if (ft.y === 0 && pv.y > 0) {
          const big = Math.min(1, -pv.vy / 7);
          this.splash(f.particles, ft.x, 0.6 + big, 0);
          this.rings.push({ x: ft.x, age: 0, size: 1 + big });
          splashSound(big);
        }
        if (ft.y < 2 && Math.abs(dx) > 0.6 && f.t % 7 === 0) this.splash(f.particles, ft.x, 0.35, -Math.sign(dx));
        // a low kick or sweep cuts through the water and sprays it forward
        if (sp && sp.y < 16 && !pv.struck) {
          this.splash(f.particles, sp.x, 0.9, ft.facing);
          splashSound(0.2);
        }
        this.feet.push({ x: ft.x, wet: ft.y < 10, moving: Math.abs(dx) > 0.4 });
      }
      this.prev.set(ft, { x: ft.x, y: ft.y, vy, struck: !!sp });
    }
    for (const pr of f.projectiles) if (!pr.dead && pr.y < 14 && f.t % 3 === 0) this.splash(f.particles, pr.x, 0.3, -Math.sign(pr.vx));
    for (const r of this.rings) r.age++;
    this.rings = this.rings.filter((r) => r.age < 40);
  }

  /** Throw up droplets; dir 0 sprays both ways, otherwise mostly toward dir. */
  splash(ps: Particles, x: number, force: number, dir: number) {
    const n = Math.round(6 + force * 14);
    for (let i = 0; i < n; i++) {
      const life = rand(20, 40);
      ps.add({
        kind: 'spark', x: x + rand(-6, 6), y: 1,
        vx: (dir ? dir * rand(0.3, 2.4) : rand(-2, 2)) * force, vy: rand(1, 3.6) * force,
        life, max: life, color: SPRAY[Math.floor(Math.random() * SPRAY.length)], size: Math.random() < 0.25 ? 2 : 1, grav: 0.2, floor: true,
      });
    }
  }

  /** Surf breaking on the reef and the odd gull, keyed to frame numbers so redraws stay quiet. */
  sounds(t: number) {
    if (t === this.lastSound) return;
    this.lastSound = t;
    if (t % WAVE === 0) {
      noise({ dur: 1.6, vol: 0.09, type: 'lowpass', freq: 700, to: 140, attack: 0.25 });
      noise({ dur: 0.9, vol: 0.05, type: 'bandpass', freq: 2200, to: 800, q: 0.5, attack: 0.15 });
    }
    if (t % WAVE === 120) noise({ dur: 1.2, vol: 0.05, type: 'highpass', freq: 2500, to: 4000, attack: 0.4 });
    const c = ac();
    if (c && t % 900 === 450)
      for (let i = 0; i < 3; i++) tone({ type: 'triangle', freq: 1500 - i * 60, to: 950, dur: 0.18, vol: 0.035, at: c.currentTime + i * 0.22, attack: 0.03 });
  }

  /** The current breaker: how far along the cycle we are (0..1). */
  phase(t: number) {
    return (t % WAVE) / WAVE;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.sounds(t);
    ctx.drawImage(this.sky, 0, 0);
    const cw = this.clouds.width, cx = -Math.floor(((t * 0.06 + camX * 0.05) % cw + cw) % cw);
    ctx.drawImage(this.clouds, cx, 0);
    ctx.drawImage(this.clouds, cx + cw, 0);
    // a couple of gulls wheeling overhead
    for (let i = 0; i < 2; i++) {
      const gx = Math.round(((t * (0.25 + i * 0.1) + i * 140) % (W + 60)) - 30 - camX * 0.1 * (i + 1)) % (W + 60);
      const gy = Math.round(40 + i * 18 + Math.sin(t * 0.02 + i * 2) * 8);
      const up = ((t >> 3) + i) % 3 === 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(gx - 1, gy, 3, 1);
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(gx - 3, gy - (up ? 2 : 0), 2, 1);
      ctx.fillRect(gx + 2, gy - (up ? 2 : 0), 2, 1);
      ctx.fillRect(gx - 2, gy - (up ? 1 : 0), 1, 1);
      ctx.fillRect(gx + 2, gy - (up ? 1 : 0), 1, 1);
    }
    const fx = -Math.round(camX * 0.15);
    ctx.drawImage(this.far, fx, 0);
    // a sailboat creeping along the horizon
    const bx = Math.round(((t * 0.05) % (FAR_W + 40)) - 20) + fx;
    ctx.fillStyle = '#f8f8f0';
    for (let k = 0; k < 7; k++) ctx.fillRect(bx + 1, HZ - 9 + k, Math.ceil(k * 0.7) + 1, 1);
    ctx.fillStyle = '#e84a3a';
    ctx.fillRect(bx - 2, HZ - 1, 9, 2);
    // sun glitter on the open sea
    ctx.fillStyle = '#fffff0';
    for (let i = 0; i < 26; i++) {
      if (hash(i * 7 + (t >> 3)) > 0.6) continue;
      const y = HZ + 2 + Math.floor(hash(i * 3.3) * (REEF_Y - HZ - 6));
      const spread = 4 + (y - HZ) * 0.5;
      ctx.fillRect(Math.round(196 + (hash(i * 11 + (t >> 4)) - 0.5) * spread * 2), y, 1 + ((y - HZ) >> 4), 1);
    }
    ctx.drawImage(this.mid, -Math.round(camX * 0.5), 0);
    this.drawBreaker(ctx, camX, t);
    ctx.drawImage(this.ground, -Math.round(camX), 0);
    // caustic light dancing on the sandy bottom
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, REEF_Y + 8, W, H - REEF_Y - 8);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const tw = this.caustics.width, th = this.caustics.height;
    for (let layer = 0; layer < 2; layer++) {
      const ox = -(((camX + (layer ? -t * 0.15 : t * 0.22)) % tw) + tw) % tw;
      ctx.globalAlpha = layer ? 0.5 : 0.7;
      for (let y = REEF_Y + 8 + (layer ? 11 : 0); y < H; y += th) for (let x = ox - (layer ? 20 : 0); x < W; x += tw) ctx.drawImage(this.caustics, Math.round(x), y);
    }
    ctx.restore();
    // the rope line of floats and the bobbing swim ring
    const rx0 = ROPE[0] - Math.round(camX);
    for (let x = ROPE[0] + 6; x < ROPE[1] - 3; x += 8) {
      const sx = x - Math.round(camX);
      if (sx < -4 || sx > W + 4) continue;
      const by = 166 + Math.round(Math.sin(t * 0.04 + x * 0.12) * 1.2);
      ctx.fillStyle = '#d8d0b0';
      ctx.fillRect(sx, by + 1, 8, 1);
      ctx.fillStyle = ((x - ROPE[0]) / 8) % 2 < 1 ? '#ff4a3a' : '#ffffff';
      ctx.fillRect(sx + 2, by, 4, 2);
      ctx.fillStyle = 'rgba(232,252,255,0.6)';
      ctx.fillRect(sx + 1, by + 2, 6, 1);
    }
    ctx.fillStyle = '#d8d0b0';
    ctx.fillRect(rx0 - 1, 167, 2, 1);
    const ringX = RING_X - Math.round(camX), ringY = 180 + Math.round(Math.sin(t * 0.03) * 1.5);
    if (ringX > -12 && ringX < W + 12) {
      ctx.fillStyle = 'rgba(10,80,100,0.3)';
      ctx.fillRect(ringX - 9, ringY + 3, 18, 2);
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        ctx.fillStyle = Math.floor(a / 4) % 2 ? '#ffffff' : '#ff3a7a';
        ctx.fillRect(Math.round(ringX + Math.cos(ang) * 8), Math.round(ringY + Math.sin(ang) * 3), 2, 2);
      }
      ctx.fillStyle = 'rgba(232,252,255,0.7)';
      ctx.fillRect(ringX - 9, ringY + 3, 3, 1);
      ctx.fillRect(ringX + 6, ringY + 3, 3, 1);
    }
    this.drawWash(ctx, camX, t, false);
  }

  /** The wave cresting and crashing on the reef, then rolling white water. */
  drawBreaker(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const k = this.phase(t);
    const wx = camX * 0.6;
    for (let x = 0; x < W; x++) {
      const wobble = Math.sin((x + wx) * 0.09) * 1.5 + Math.sin((x + wx) * 0.23 + t * 0.03);
      // the swell lifts, the crest feathers white and pitches over, then flattens into foam
      const rise = k < 0.25 ? Math.sin((k / 0.25) * Math.PI * 0.5) * 6 : k < 0.4 ? 6 * (1 - (k - 0.25) / 0.15) : 0;
      const top = Math.round(REEF_Y - 2 - rise + wobble);
      ctx.fillStyle = '#2a96c0';
      ctx.fillRect(x, top, 1, REEF_Y + 3 - top);
      const white = k > 0.12 && k < 0.6;
      ctx.fillStyle = white && hash(x + wx * 0.1 + Math.floor(t / 4)) < 0.85 ? '#ffffff' : '#b8eef8';
      ctx.fillRect(x, top, 1, white ? 2 + Math.round(rise * 0.4) : 1);
      if (k > 0.25 && k < 0.5 && hash(x * 1.3 + Math.floor(t / 3)) < 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(x, top - Math.round(hash(x + t) * 8 * (1 - (k - 0.25) / 0.25)), 1, 1);
      }
    }
  }

  /** The sheet of white water washing in across the shallows; the near rows draw over the fighters' feet. */
  drawWash(ctx: CanvasRenderingContext2D, camX: number, t: number, front: boolean) {
    const k = this.phase(t);
    if (k < 0.35) return;
    const u = (k - 0.35) / 0.65;
    const y = Math.round(REEF_Y + 4 + (1 - (1 - u) * (1 - u)) * (H - REEF_Y));
    if (front !== y >= ANKLE) return;
    const a = (1 - u) * 0.9;
    for (let x = 0; x < W; x++) {
      const wy = y + Math.round(Math.sin((x + camX) * 0.07 + t * 0.02) * 2 + Math.sin((x + camX) * 0.19) * 1);
      if (hash(x + camX + Math.floor(t / 6) * 0.37) > 0.8 - u * 0.4) continue;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, wy, 1, 1);
      ctx.fillStyle = `rgba(200,244,250,${a * 0.6})`;
      ctx.fillRect(x, wy + 1, 1, 1);
    }
  }

  /** Ankle-deep water over the fighters' feet, rings rippling out round them, and the near wash. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.fillStyle = 'rgba(90,216,212,0.5)';
    ctx.fillRect(0, ANKLE + 1, W, H - ANKLE - 1);
    ctx.fillStyle = 'rgba(180,244,240,0.55)';
    ctx.fillRect(0, ANKLE, W, 1);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash(i * 5.7 + Math.floor(t / 10)) * W);
      ctx.fillRect(x, ANKLE + (i % 3 === 0 ? 2 : 0), 2 + (i % 3), 1);
    }
    const ring = (x: number, r: number, a: number) => {
      ctx.fillStyle = `rgba(240,255,255,${a})`;
      for (let s = 0; s < 24; s++) {
        const ang = (s / 24) * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(FLOOR + Math.sin(ang) * r * 0.2), 1, 1);
      }
    };
    for (const f of this.feet) {
      if (!f.wet) continue;
      const x = f.x - camX;
      for (let k = 0; k < 2; k++) {
        const ph = ((t + k * 22) % (f.moving ? 26 : 44)) / (f.moving ? 26 : 44);
        ring(x, 7 + ph * 12, 0.75 * (1 - ph));
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(Math.round(x) - 6, ANKLE, 12, 1);
    }
    for (const r of this.rings) ring(r.x - camX, 6 + r.age * 0.9 * r.size, 0.9 * (1 - r.age / 40));
    this.drawWash(ctx, camX, t, true);
  }

  /** Bubbles rising from somewhere under the water. */
  bubbles(p: Particles, x: number, yy: number, n: number) {
    for (let i = 0; i < n; i++) {
      const life = rand(40, 90);
      p.add({ kind: 'spark', x: x + rand(-6, 6), y: H - yy, vx: rand(-0.2, 0.2), vy: rand(0.4, 1.1), life, max: life, color: Math.random() < 0.5 ? '#d8faff' : '#90e0f0', size: Math.random() < 0.3 ? 2 : 1, grav: -0.01, floor: false });
    }
  }

  /** Breaking the surface on the way down, trailing bubbles below it. */
  clamFall(p: Particles, y: number) {
    if (this.lastY < SURF && y >= SURF) {
      splashSound(1);
      for (let i = 0; i < 40; i++) {
        const life = rand(25, 50);
        p.add({ kind: 'spark', x: 128 + rand(-10, 10), y: H - SURF, vx: rand(-2.4, 2.4), vy: rand(1.5, 5), life, max: life, color: SPRAY[i % 4], size: i % 3 ? 1 : 2, grav: 0.2, floor: false });
      }
      this.bubbles(p, 128, SURF + 10, 14);
    }
    if (y > SURF && Math.random() < 0.5) this.bubbles(p, 128, y - 30, 1);
    this.lastY = y;
  }

  clamStep(p: Particles, it: number) {
    this.lastY = -100;
    if (it === 0) this.bubbles(p, 128, HINGE[1] - 20, 10);
    if (it === 20) {
      sfx.crunch();
      sfx.thud();
      tone({ type: 'sine', freq: 90, to: 40, dur: 0.4, vol: 0.4 });
    }
    if (it >= 20 && it < 60 && it % 3 === 0) {
      p.blood(CLAM_CX + CLAM_RX - 4, H - HINGE[1] + 2, 1, 3, 0.4);
      p.blood(HINGE[0] + 30, H - HINGE[1] + 2, -1, 2, 0.4);
      const life = rand(30, 50);
      p.add({ kind: 'mist', x: CLAM_CX + rand(-36, 36), y: H - HINGE[1] + rand(0, 4), vx: rand(-0.3, 0.3), vy: rand(0.1, 0.4), life, max: life, color: Math.random() < 0.5 ? '#a01020' : '#c02030', size: rand(1, 3), floor: false });
    }
    if (it > 20 && it % 5 === 0) this.bubbles(p, CLAM_CX + rand(-30, 30), HINGE[1] - 4, 1);
  }

  /** Lid angle in radians: gaping, then snapping shut, then slowly chewing. */
  lidAngle(it: number) {
    if (it < 14) return 1.05 + Math.sin(Math.max(0, it) * 0.4) * 0.04;
    if (it < 20) return 1.05 * (1 - (it - 14) / 6) + 0.04;
    const c = (it - 20) % 40;
    return c < 6 ? 0.04 + Math.sin((c / 6) * Math.PI) * 0.12 : 0.04;
  }

  clamDraw(ctx: CanvasRenderingContext2D, it: number) {
    ctx.drawImage(this.shell, 0, 0);
    ctx.save();
    ctx.translate(HINGE[0], HINGE[1]);
    ctx.rotate(-this.lidAngle(it));
    ctx.drawImage(this.lid, -2, -(this.lid.height - 3));
    ctx.restore();
    // everything below the surface takes on the water's tint, and the blood clouds it red
    ctx.fillStyle = 'rgba(40,170,200,0.18)';
    ctx.fillRect(0, SURF + 2, W, H - SURF - 2);
    if (it > 20) {
      ctx.fillStyle = `rgba(170,10,20,${Math.min(0.2, (it - 20) * 0.004)})`;
      ctx.fillRect(0, SURF + 2, W, H - SURF - 2);
    }
    ctx.fillStyle = 'rgba(232,255,255,0.8)';
    for (let x = 0; x < W; x += 3) ctx.fillRect(x, SURF + Math.round(Math.sin(x * 0.15 + it * 0.1)), 2, 1);
  }
}
