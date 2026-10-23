import { H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { noise, tone } from '../audio/audio';
import { Painter } from '../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { Particles } from './particles';
import type { SongName } from '../audio/music';

// "The Echo Cathedral": a gothic nave at evening. Tall lancet windows of geometric stained glass
// throw coloured shafts of light across a marble floor, a rose window glows over the pipe organ,
// candle stands flicker between the clustered piers and a row of oak pews lines the back.
// The uppercut drops the loser through a floor grate into the organ's pipe chamber below, onto
// a rack of broken tin pipes; nothing sacred is touched. Painted procedurally at load time.

const BASE = 168; // where the back wall meets the floor
const PIERS = [6, 72, 138, 204, 308, 374, 440, 506];
/** Lancet windows: centre x in deck px, between the piers. */
const WINDOWS = [39, 105, 171, 341, 407, 473];
const WIN_TOP = 34, WIN_BOT = 124, WIN_HALF = 14;
const ROSE = { x: 256, y: 40, r: 26 };
const ORGAN = { x0: 214, x1: 298, top: 72 };
const CANDLES = [22, 88, 154, 220, 292, 358, 424, 490];
const CHANDELIERS = [{ x: 105, len: 30, ph: 0 }, { x: 256, len: 14, ph: 2.1 }, { x: 407, len: 30, ph: 4.2 }];

const STONE = '#6a6270';
const GLASS = ['#c02838', '#2848c0', '#e0a020', '#2a9050', '#8030a0', '#20a0c0'];

/** Is (x, y) inside a pointed (equilateral) lancet arch of half-width hw, springing at y0, centred on cx? */
function inLancet(x: number, y: number, cx: number, hw: number, y0: number) {
  if (Math.abs(x + 0.5 - cx) > hw) return false;
  if (y >= y0) return true;
  // two circles of radius 2hw centred on the opposite jambs
  const dy = y + 0.5 - y0;
  return Math.hypot(x + 0.5 - (cx - hw), dy) <= hw * 2 && Math.hypot(x + 0.5 - (cx + hw), dy) <= hw * 2;
}

/** Dressed stone blocks with dithered weathering. */
function ashlar(p: Painter, x0: number, x1: number, y0: number, y1: number, base: Color) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const row = Math.floor(y / 9), off = row % 2 ? 11 : 0;
      const mortar = y % 9 === 8 || (x + off) % 22 === 21;
      const tone_ = ((row * 7 + Math.floor((x + off) / 22) * 5) % 4) * 0.05;
      let c: Color = mortar ? darken(base, 0.45) : darken(base, tone_);
      if (!mortar && bayer(x, y) < 0.08) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
}

/** One lancet window: lead quarries in a diamond lattice, a central quatrefoil medallion, a stone frame. */
function lancet(p: Painter, cx: number, seed: number) {
  const r = rng(seed);
  const hues = [r.pick(GLASS), r.pick(GLASS), r.pick(GLASS)];
  const midY = (WIN_TOP + WIN_BOT) / 2 + 6;
  for (let y = WIN_TOP - WIN_HALF * 2; y < WIN_BOT; y++)
    for (let x = cx - WIN_HALF - 3; x <= cx + WIN_HALF + 3; x++) {
      const inside = inLancet(x, y, cx, WIN_HALF, WIN_TOP);
      const frame = !inside && inLancet(x, y, cx, WIN_HALF + 3, WIN_TOP + 1);
      if (frame) {
        p.set(x, y, x < cx ? '#8a8290' : '#4a4452');
        continue;
      }
      if (!inside) continue;
      const u = x - cx, v = y - WIN_TOP;
      // central mullion and a transom bar
      if (Math.abs(u + 0.5) < 1 || y === WIN_TOP + 4) {
        p.set(x, y, '#2a2430');
        continue;
      }
      const dm = Math.hypot(u + 0.5, y + 0.5 - midY);
      const lobe = Math.min(...[[0, -6], [0, 6], [-6, 0], [6, 0]].map(([ox, oy]) => Math.hypot(u + 0.5 - ox, y + 0.5 - midY - oy)));
      let c: Color;
      if (lobe < 6 || dm < 6) {
        // the quatrefoil: a gold ring around a bright centre
        if (Math.abs(lobe - 5.5) < 0.8 && dm > 5) c = '#1a141c';
        else c = dm < 3 ? '#fff0b0' : dm < 5 ? '#f0c040' : hues[1];
      } else {
        const a = Math.floor((u + v) / 6), b = Math.floor((u - v + 600) / 6);
        const lead = (u + v + 600) % 6 === 0 || (u - v + 600) % 6 === 0;
        if (lead) c = '#1a141c';
        else {
          const k = (a * 3 + b * 5 + seed) % 7;
          c = k < 3 ? hues[0] : k < 5 ? hues[2] : k === 5 ? '#e8e0d0' : hues[1];
          if (Math.abs(u) > WIN_HALF - 3) c = hues[2]; // border strip
        }
      }
      // brighter toward the top where the evening sky is, with a glassy dither
      const glow = 0.15 + (1 - v / (WIN_BOT - WIN_TOP)) * 0.15;
      if (typeof c !== 'string' || c !== '#1a141c') c = bayer(x, y) < glow ? lighten(c, 0.3) : c;
      p.set(x, y, c);
    }
  // sill
  p.rect(cx - WIN_HALF - 4, WIN_BOT, WIN_HALF * 2 + 9, 3, '#8a8290');
  p.rect(cx - WIN_HALF - 4, WIN_BOT + 3, WIN_HALF * 2 + 9, 1, '#2a2430');
}

/** The rose window: petals radiating from a gold boss, in rings of jewel glass. */
function rose(p: Painter) {
  const { x: cx, y: cy, r: R } = ROSE;
  for (let y = cy - R - 4; y <= cy + R + 4; y++)
    for (let x = cx - R - 4; x <= cx + R + 4; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > R + 4) continue;
      if (d > R) {
        p.set(x, y, dy < 0 ? '#8a8290' : '#4a4452');
        continue;
      }
      const a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const n = 12, seg = (a / (Math.PI * 2)) * n, f = seg - Math.floor(seg), petal = Math.floor(seg);
      let c: Color;
      if (d < 4) c = d < 2 ? '#fff0b0' : '#f0c040';
      else if (Math.abs(d - 4.5) < 0.8 || Math.abs(d - 13) < 0.8 || Math.abs(d - R + 1) < 1) c = '#1a141c';
      else if (d < 13) {
        // inner petals: rounded tips, alternating colours
        const tip = 4 + 9 * Math.sin(f * Math.PI);
        c = d < tip ? (petal % 2 ? '#c02838' : '#2848c0') : '#1a141c';
        if (Math.abs(f - 0.5) < 0.06) c = '#1a141c';
      } else {
        // outer ring: pointed lights with a small roundel between each pair
        if (f < 0.07 || f > 0.93) c = '#1a141c';
        else if (Math.abs(f - 0.5) < 0.18 && d > 16) c = petal % 3 === 0 ? '#e0a020' : petal % 3 === 1 ? '#2a9050' : '#8030a0';
        else c = petal % 2 ? '#2848c0' : '#20a0c0';
      }
      if (c !== '#1a141c' && bayer(x, y) < 0.2) c = lighten(c, 0.3);
      p.set(x, y, c);
    }
}

/** The pipe organ: a carved oak case with three towers of polished pipes, and its console. */
function organ(p: Painter) {
  const { x0, x1, top } = ORGAN;
  // case
  for (let y = top + 10; y < BASE; y++)
    for (let x = x0; x < x1; x++) p.set(x, y, x === x0 || x === x1 - 1 ? '#1e120a' : (x * 7 + y * 3) % 29 === 0 ? '#3a2416' : '#4a2e1a');
  // pipes: silver with a lit left edge and a dark mouth; tallest in the middle of each tower
  const towers: [number, number, number][] = [[x0 + 4, 24, top + 26], [x0 + 30, 24, top], [x0 + 56, 24, top + 26]];
  for (const [tx, tw, ttop] of towers) {
    // pointed crown over the tower
    p.poly([[tx - 2, ttop + 2], [tx + tw + 2, ttop + 2], [tx + tw / 2, ttop - 8]], '#3a2416');
    p.set(Math.round(tx + tw / 2), ttop - 9, '#d8b050');
    const n = 6;
    for (let i = 0; i < n; i++) {
      const px = tx + i * 4, mid = Math.abs(i - (n - 1) / 2);
      const pTop = ttop + 4 + Math.round(mid * mid * 2), mouth = BASE - 40 - Math.round(mid * 3);
      for (let y = pTop; y < BASE - 30; y++)
        for (let k = 0; k < 3; k++) p.set(px + k, y, k === 0 ? '#e8ecf0' : k === 1 ? '#a8acb8' : '#5a5e6a');
      p.rect(px, pTop, 3, 1, '#f8fbff');
      p.rect(px, mouth, 3, 2, '#141018'); // the mouth
      p.set(px + 1, mouth - 1, '#141018');
    }
    p.rect(tx - 2, BASE - 30, tw + 4, 2, '#d8b050'); // gilt band
  }
  // console: a raised bench, two keyboards and stop knobs
  p.rect(x0 + 18, BASE - 26, x1 - x0 - 36, 14, '#2a1a0e');
  p.rect(x0 + 20, BASE - 24, x1 - x0 - 40, 2, '#f0ece0');
  p.rect(x0 + 20, BASE - 20, x1 - x0 - 40, 2, '#f0ece0');
  for (let x = x0 + 21; x < x1 - 20; x += 3) {
    p.set(x, BASE - 24, '#141014');
    p.set(x, BASE - 20, '#141014');
  }
  for (let k = 0; k < 6; k++) {
    p.set(x0 + 22 + k * 2, BASE - 28, k % 2 ? '#c02838' : '#f0ece0');
    p.set(x1 - 23 - k * 2, BASE - 28, k % 2 ? '#f0ece0' : '#c02838');
  }
}

/** Static nave: vault, piers, windows, rose, organ, a row of oak pews and the marble floor. */
function nave(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(2201);
  // the vault high above, fading into darkness
  for (let y = 0; y < BASE; y++)
    for (let x = 0; x < STAGE_W; x++) p.set(x, y, mix('#141018', STONE, Math.min(1, y / 90)));
  ashlar(p, 0, STAGE_W, 22, BASE, STONE);
  // a pointed arcade running across the top of the wall, one arch per bay
  for (let i = 0; i < PIERS.length - 1; i++) {
    const a = PIERS[i], b = PIERS[i + 1], cx = (a + b) / 2, hw = (b - a) / 2 - 4;
    for (let y = 0; y < 40; y++)
      for (let x = a; x < b; x++) {
        if (inLancet(x, y, cx, hw, 30)) continue;
        if (inLancet(x, y, cx, hw + 2, 31)) p.set(x, y, '#8a8290');
        else p.set(x, y, mix('#0e0a12', '#2a2430', y / 40));
      }
  }
  WINDOWS.forEach((x, i) => lancet(p, x, 2211 + i * 13));
  // the rose window on a plain stone field above the organ
  rose(p);
  // the organ case in the central bay
  organ(p);
  // clustered piers: a fat core with slim shafts either side, and a capital at the springing
  for (const px of PIERS) {
    for (let y = 0; y < BASE; y++)
      for (let k = -6; k <= 6; k++) {
        const shaft = Math.abs(k) > 3;
        const t = shaft ? (Math.abs(k) - 4) / 2 : (k + 3) / 6;
        let c: Color = mix('#9a92a0', '#3a3440', t);
        if (shaft && Math.abs(k) === 6) c = '#2a2430';
        if (y > 30 && y % 40 === 0) c = darken(c, 0.3); // shaft rings
        p.set(px + k, y, darken(c, Math.max(0, (40 - y) / 60)));
      }
    p.rect(px - 8, 28, 17, 3, '#a8a0b0');
    p.rect(px - 7, 31, 15, 2, '#5a5260');
    p.rect(px - 8, BASE - 8, 17, 8, '#5a5260'); // plinth
    p.rect(px - 8, BASE - 8, 17, 1, '#8a8290');
  }
  // memorial plaques with made-up scratches of text under the outer windows
  for (const x of [39, 473]) {
    p.rect(x - 9, 132, 18, 10, '#2a2430');
    p.rect(x - 8, 133, 16, 8, '#b8b0a0');
    for (let k = 0; k < 3; k++) for (let i = 0; i < 12; i += r.int(1, 3)) p.set(x - 6 + i, 135 + k * 2, '#5a5248');
  }
  // the marble floor: big checker slabs in perspective, polished
  const vx = STAGE_W / 2;
  for (let y = BASE; y < H; y++) {
    const s = 0.5 + (0.5 * (y - BASE)) / (H - BASE);
    const row = Math.floor((y - BASE) / (5 + (y - BASE) * 0.28));
    for (let x = 0; x < STAGE_W; x++) {
      const u = (x - vx) / s, col = Math.floor(u / 26);
      const seam = col !== Math.floor((x + 1 - vx) / s / 26);
      let c: Color = (col + row) % 2 ? '#d8d0c8' : '#3a3440';
      if ((col * 7 + row * 3) % 5 === 0 && (col + row) % 2) c = '#c8bca8'; // a warmer slab here and there
      if (seam) c = darken(c, 0.25);
      if (Math.sin(u * 0.15 + y * 0.6 + col) > 0.93) c = mix(c, '#8a8290', 0.5); // veining
      const sheen = Math.max(0, 1 - Math.abs(y - 204) / 12);
      if (bayer(x, y) < sheen * 0.3) c = lighten(c, 0.12);
      if (y < BASE + 8 && bayer(x, y) < (BASE + 8 - y) / 10) c = darken(c, 0.4);
      p.set(x, y, c);
    }
  }
  // a crimson runner along the aisle the fighters stand on
  for (let y = 186; y < 210; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const edge = y === 186 || y === 209, trim = y === 188 || y === 207;
      p.set(x, y, edge ? '#3a0a10' : trim ? '#d8a840' : bayer(x, y) < 0.1 ? '#6a1018' : '#801620');
    }
  return p.canvas();
}

/** A row of oak pews behind the aisle, seen from the side: high backs with carved bench ends. */
function pews(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const top = BASE - 18, seat = BASE + 6;
  const runs = [[14, 196], [316, 498]];
  for (const [x0, x1] of runs) {
    // the back rail and panel
    for (let y = top; y < seat; y++)
      for (let x = x0; x < x1; x++) {
        const c = y === top ? '#8a5a32' : y === top + 1 ? '#6a4024' : (x - x0) % 30 === 0 ? '#2a160c' : (x * 3 + y * 11) % 31 === 0 ? '#3a2214' : '#4e2e1a';
        p.set(x, y, c);
      }
    // seat edge and legs
    p.rect(x0, seat, x1 - x0, 2, '#6a4024');
    p.rect(x0, seat + 2, x1 - x0, 1, '#1e120a');
    for (let x = x0 + 4; x < x1; x += 30) p.rect(x, seat + 3, 2, 6, '#2a160c');
    // carved bench ends with a trefoil finial
    for (const ex of [x0 - 3, x1 - 3]) {
      p.rect(ex, top - 2, 6, seat - top + 11, '#5a3620');
      p.rect(ex, top - 2, 1, seat - top + 11, '#8a5a32');
      p.ellipse(ex + 3, top - 4, 3, 3, '#5a3620');
      p.ellipse(ex + 1, top - 2, 2, 2, '#5a3620');
      p.ellipse(ex + 5, top - 2, 2, 2, '#5a3620');
      p.set(ex + 2, top - 5, '#8a5a32');
    }
    // a hymnal or two left on the rail
    for (let x = x0 + 20; x < x1 - 10; x += 47) {
      p.rect(x, top - 3, 6, 3, '#2a3a6a');
      p.rect(x, top - 3, 6, 1, '#d8c890');
    }
  }
  return p.canvas();
}

export class ChurchStage {
  name = 'THE ECHO CATHEDRAL';
  blurb = 'HUSH. THE ORGANIST IS PLAYING';
  song: SongName = 'church';
  stakeColor = '#c8ccd8';
  nave = nave();
  pews = pews();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  /** Through the floor grate into the organ's pipe chamber: brick vault, wind trunks, a rack of snapped pipes. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(2261);
    p.gradRect(0, 0, W, H, '#2a1e1a', '#0a0608', 8);
    // brick walls of the undercroft, narrowing toward the bottom
    for (let y = 0; y < H; y++) {
      const wall = 28 + (y / H) * 22;
      for (let x = 0; x < W; x++) {
        if (x > wall && x < W - wall) continue;
        const row = Math.floor(y / 5), off = row % 2 ? 6 : 0;
        const mortar = y % 5 === 4 || (x + off) % 12 === 11;
        p.set(x, y, mortar ? '#2a1a16' : darken('#7a3a2a', ((row * 3 + Math.floor((x + off) / 12)) % 4) * 0.07 + (y / H) * 0.45));
      }
    }
    // wooden wind trunks crossing the chamber, feeding air to the pipes above
    for (const [y, x0, x1] of [[46, 0, 120], [78, 150, W], [112, 0, 90]]) {
      p.rect(x0, y, x1 - x0, 8, '#5a3620');
      p.rect(x0, y, x1 - x0, 1, '#8a5a32');
      p.rect(x0, y + 7, x1 - x0, 1, '#1e120a');
      for (let x = x0 + 6; x < x1; x += 22) p.rect(x, y + 2, 2, 4, '#2a160c');
    }
    // a leather bellows on the left wall, its ribs showing
    p.poly([[30, 130], [62, 124], [62, 160], [30, 154]], '#6a3a20');
    for (let k = 0; k < 4; k++) p.line(30, 134 + k * 6, 62, 129 + k * 8, '#3a1e10');
    p.rect(26, 128, 4, 30, '#3a2214');
    // the broken grate above, candle light spilling through
    for (let x = 0; x < W; x++) {
      const hole = x > 90 && x < 166;
      if (!hole) {
        p.rect(x, 0, 1, 10, (x >> 3) % 2 ? '#d8d0c8' : '#3a3440');
        p.set(x, 10, '#141018');
      }
    }
    for (let x = 92; x < 166; x += 10) p.line(x, 0, x + r.int(-6, 6), r.int(8, 16), '#5a5660'); // bent grate bars
    for (let y = 10; y < 186; y++) {
      const half = 40 + (y - 10) * 0.2;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) {
        const edge = 1 - Math.abs(x - 128) / half;
        p.set(x, y, mix(p.get(x, y), '#ffd890', edge * 0.13 * (1 - y / 250)));
      }
    }
    // the chamber floor: a rack of old organ pipes, snapped off into jagged tin points
    p.gradRect(28, 194, W - 56, H - 194, '#3a2a22', '#140c0a', 4);
    for (let row = 0; row < 3; row++) {
      const baseY = 196 + row * 9;
      for (let sx = 38 + row * 6; sx < W - 40; sx += 15 - row * 2) {
        const h = 34 + row * 10 + r.int(-8, 8);
        const col = row === 2 ? '#c8ccd8' : row === 1 ? '#8a8e9a' : '#5a5e6a';
        const cut = r.next() < 0.5 ? 1 : -1;
        for (let k = 0; k < h; k++) {
          const t = k / h, y = baseY + 24 - k;
          for (let i = 0; i < 4; i++) {
            // a slanted break across the top of each pipe
            if (t > 0.85 && (cut > 0 ? i : 3 - i) > (1 - t) / 0.15 * 4) continue;
            p.set(sx + i, y, i === 0 ? lighten(col, 0.3) : i === 3 ? darken(col, 0.4) : col);
          }
          if (k === Math.round(h * 0.3)) p.rect(sx, y, 4, 2, '#141018'); // pipe mouth
        }
      }
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[66, 184, -94, 1], [196, 188, -80, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -100, ab: 40, lf: -30, kf: 70, h: 30 })));
      ctx.restore();
    }
    return cv;
  }

  /** On landing the broken pipes catch the wind: a great sour organ groan, and dust from the vault. */
  pitTick(p: Particles, it: number) {
    if (it === 1) {
      for (const [f, v] of [[55, 0.09], [58.3, 0.08], [82.4, 0.06], [110, 0.05], [116.5, 0.04]]) {
        tone({ type: 'sawtooth', freq: f, to: f * 0.94, dur: 2.4, vol: v, attack: 0.08, filter: { type: 'lowpass', freq: 900, to: 300 } });
        tone({ type: 'sine', freq: f * 2, to: f * 1.9, dur: 2.2, vol: v * 0.6, attack: 0.1 });
      }
      noise({ dur: 2, vol: 0.12, type: 'bandpass', freq: 600, to: 200, q: 1.5, attack: 0.05 });
      p.smoke(128, 20, 14, '#8a7a6a');
    }
    if (it < 90 && it % 5 === 0) p.smoke(100 + Math.random() * 56, 12, 1, '#a89888');
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const dx = -Math.round(camX);
    ctx.drawImage(this.nave, dx, 0);
    // the glass breathes a little as clouds pass outside
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.06 + Math.sin(t * 0.011) * 0.03;
    for (const wx of [...WINDOWS, ROSE.x]) {
      const x = wx + dx;
      if (x < -40 || x > W + 40) continue;
      const cy = wx === ROSE.x ? ROSE.y : (WIN_TOP + WIN_BOT) / 2;
      const g = ctx.createRadialGradient(x, cy, 4, x, cy, 46);
      g.addColorStop(0, `rgba(255,220,170,${pulse})`);
      g.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 46, cy - 46, 92, 92);
    }
    ctx.restore();
    this.drawOrganist(ctx, dx, t);
    this.drawCandles(ctx, dx, t);
    ctx.drawImage(this.pews, dx, 0);
    this.drawChandeliers(ctx, dx, t);
  }

  /** The organist, seen from behind at the console, swaying to the music; nobody distracts them. */
  drawOrganist(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const x = 256 + dx;
    if (x < -20 || x > W + 20) return;
    const sway = Math.round(Math.sin(t * 0.06) * 1.5), y = BASE - 22;
    ctx.fillStyle = '#1e1a28';
    ctx.fillRect(x - 5 + sway, y - 12, 10, 14); // robe
    ctx.fillRect(x - 6 + sway, y - 8, 12, 8);
    ctx.fillStyle = '#c0c0c8';
    ctx.fillRect(x - 3 + sway, y - 19, 6, 6); // grey head of hair
    ctx.fillStyle = '#e8c8a8';
    // hands flicking over the keys
    ctx.fillRect(x - 8 + (Math.floor(t / 7) % 3), y - 2, 2, 1);
    ctx.fillRect(x + 5 + (Math.floor(t / 5) % 3), y - 2 - (Math.floor(t / 11) % 2) * 4, 2, 1);
    ctx.fillStyle = '#2a1a0e';
    ctx.fillRect(x - 9, y + 2, 18, 3); // bench
  }

  /** Iron candle stands along the wall, each with a few flickering tapers and a warm pool of light. */
  drawCandles(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    for (let i = 0; i < CANDLES.length; i++) {
      const x = CANDLES[i] + dx;
      if (x < -30 || x > W + 30) continue;
      const by = BASE - 14;
      ctx.fillStyle = '#1a1418';
      ctx.fillRect(x, by - 26, 1, 26); // stem
      ctx.fillRect(x - 3, by - 1, 7, 2); // foot
      ctx.fillRect(x - 6, by - 26, 13, 1); // branch
      for (let k = -1; k <= 1; k++) {
        const cx = x + k * 6, h = 6 - Math.abs(k) * 2;
        ctx.fillStyle = '#f0e8d0';
        ctx.fillRect(cx, by - 26 - h, 1, h);
        const fl = Math.sin(t * 0.4 + i * 3 + k) > 0.3 ? 1 : 0;
        ctx.fillStyle = '#ffd860';
        ctx.fillRect(cx, by - 29 - h - fl, 1, 2 + fl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx, by - 28 - h, 1, 1);
      }
      const flick = 0.85 + Math.sin(t * 0.33 + i * 1.7) * 0.08 + Math.sin(t * 0.81 + i) * 0.07;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, by - 32, 1, x, by - 32, 26);
      g.addColorStop(0, `rgba(255,170,80,${0.3 * flick})`);
      g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 26, by - 58, 52, 52);
      ctx.restore();
    }
  }

  /** Iron ring chandeliers hanging from the vault, swaying gently on long chains. */
  drawChandeliers(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    for (const C of CHANDELIERS) {
      const a = Math.sin(t * 0.017 + C.ph) * 0.06;
      const ax = C.x + dx;
      const bx = Math.round(ax + Math.sin(a) * C.len), by = Math.round(Math.cos(a) * C.len);
      if (bx < -30 || bx > W + 30) continue;
      ctx.strokeStyle = '#1a1418';
      ctx.beginPath();
      ctx.moveTo(ax + 0.5, 0);
      ctx.lineTo(bx + 0.5, by);
      ctx.stroke();
      ctx.fillStyle = '#1a1418';
      ctx.fillRect(bx - 12, by, 25, 2);
      ctx.fillRect(bx - 1, by - 3, 3, 8);
      for (let k = -2; k <= 2; k++) {
        const cx = bx + k * 6;
        ctx.fillStyle = '#f0e8d0';
        ctx.fillRect(cx, by - 4, 1, 4);
        ctx.fillStyle = Math.sin(t * 0.5 + k * 2 + C.ph) > 0 ? '#ffe070' : '#ffb040';
        ctx.fillRect(cx, by - 6, 1, 2);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by - 4, 2, bx, by - 4, 34);
      g.addColorStop(0, 'rgba(255,190,100,0.22)');
      g.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - 34, by - 38, 68, 68);
      ctx.restore();
    }
  }

  /** Coloured shafts of light slanting from the windows to the floor, with dust drifting through them. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const dx = -Math.round(camX);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    WINDOWS.forEach((wx, i) => {
      const x = wx + dx;
      if (x < -120 || x > W + 60) return;
      const col = GLASS[(i * 2 + 1) % GLASS.length];
      const [rr, gg, bb] = [1, 3, 5].map((k) => parseInt(col.slice(k, k + 2), 16));
      const a = 0.11 + Math.sin(t * 0.011 + i) * 0.03;
      const g = ctx.createLinearGradient(0, WIN_TOP, 0, H);
      g.addColorStop(0, `rgba(${rr},${gg},${bb},${a})`);
      g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - WIN_HALF, WIN_TOP + 10);
      ctx.lineTo(x + WIN_HALF, WIN_TOP + 10);
      ctx.lineTo(x + WIN_HALF + 62, H);
      ctx.lineTo(x - WIN_HALF + 40, H);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
    // dust motes catching the light
    ctx.fillStyle = 'rgba(255,240,210,0.5)';
    for (let i = 0; i < 30; i++) {
      const x = ((i * 97 + Math.sin(t * 0.008 + i) * 20 - camX * 1.05) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = 40 + ((i * 61 + t * (0.05 + (i % 4) * 0.02)) % 150);
      if (Math.sin(t * 0.05 + i * 1.3) > -0.2) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}
