import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng } from '../../core/rng';
import { makeCanvas, Painter, pxLine } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { noise } from '../../audio/audio';
import type { SongName } from '../../audio/music';
import { P, LIE } from '../../game/anims';
import type { Arena } from '../../game/stages';

// "The Drowned Galleon": a storm-beaten ghost ship rolling on a night sea. The sky and sea
// are composed into a buffer each frame and blitted in tilted columns so the horizon rocks,
// while the deck (and everyone standing on it) bobs up and down.

const PAD = 12; // spare rows above and below the background so it can tilt
const BH = H + PAD * 2;
const HZ = 112 + PAD; // horizon row inside the background buffer
const SEA_H = BH - HZ;
const TW = 256; // sea texture tile width
const FAR_W = W + Math.ceil((STAGE_W - W) * 0.15);
const MOON_X = 66, MOON_Y = 38 + PAD;
const LIGHTHOUSE = [214, HZ - 47];
const MASTS = [[96, 34, 42, 34], [256, 14, 58, 46], [420, 40, 40, 32]]; // x, yard y, yard half-width, sail drop
const LANTERNS = [40, 172, 340, 468];
const LANTERN_Y = 148;
const STERN = 50;
const BOW = 470;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Back rail height at a deck x: flat amidships, sweeping up toward the bow. */
const railTop = (x: number) => (x < BOW ? 172 : 172 - Math.pow((x - BOW) / (STAGE_W - BOW), 1.6) * 26);

function sky(): HTMLCanvasElement {
  const p = new Painter(W, BH);
  const r = rng(101);
  const stops = ['#04050c', '#0a0f20', '#141c34', '#232a44', '#3a3c56', '#55506a'];
  for (let y = 0; y < BH; y++) {
    const t = Math.min(1, y / HZ) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  for (let i = 0; i < 60; i++) p.set(r.int(0, W - 1), r.int(0, HZ - 50), r.next() < 0.2 ? '#fff' : '#6a7090');
  // pale moon with a dithered halo
  for (let y = -34; y <= 34; y++)
    for (let x = -34; x <= 34; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 13 && d < 32 && ((32 - d) / 19) * 0.5 > bayer(MOON_X + x, MOON_Y + y))
        p.set(MOON_X + x, MOON_Y + y, mix(p.get(MOON_X + x, MOON_Y + y), '#8a90a8', 0.3));
    }
  p.ellipse(MOON_X, MOON_Y, 13, 13, '#c8ccb8');
  p.ellipse(MOON_X - 2, MOON_Y - 2, 10, 10, '#e4e6d6');
  for (const [cx, cy, cr] of [[MOON_X + 4, MOON_Y - 3, 3], [MOON_X - 5, MOON_Y + 4, 2.5], [MOON_X + 5, MOON_Y + 6, 2]])
    p.ellipse(cx, cy, cr, cr, '#b0b4a2');
  // storm clouds, rim-lit where they face the moon
  const cloud = (cx: number, cy: number, w: number, h: number) => {
    const puffs = Array.from({ length: 6 }, () => [cx + r.range(-w / 2, w / 2), cy + r.range(-h / 3, h / 3), r.range(w * 0.2, w * 0.4), r.range(h * 0.5, h)]);
    const near = Math.max(0, 1 - Math.hypot(cx - MOON_X, cy - MOON_Y) / 110);
    for (const [x, y, rx, ry] of puffs) p.ellipse(x, y - 1, rx, ry, mix('#1c2238', '#7a7e90', near));
    for (const [x, y, rx, ry] of puffs) p.ellipse(x, y, rx, ry, '#0d1120');
  };
  cloud(MOON_X + 14, MOON_Y + 10, 60, 7);
  for (let i = 0; i < 8; i++) cloud(r.int(-10, W + 10), r.int(PAD + 4, HZ - 34), r.int(40, 90), r.int(5, 10));
  // low murk along the horizon
  for (let y = HZ - 12; y < HZ; y++)
    for (let x = 0; x < W; x++) if ((y - HZ + 12) / 12 * 0.6 > bayer(x, y)) p.set(x, y, '#2a2c40');
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, BH);
  // rocky island with a lighthouse, and a couple of sea stacks
  const isl = (x0: number, x1: number, hgt: number) => {
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const h = Math.sin(t * Math.PI) * hgt + Math.sin(x * 0.7) * 1.5;
      for (let y = Math.floor(HZ - h); y <= HZ; y++) p.set(x, y, '#0b0f18');
      p.set(x, Math.floor(HZ - h), '#2a3044');
    }
  };
  isl(160, 262, 16);
  isl(36, 60, 9);
  isl(270, 288, 6);
  const [lx, ly] = LIGHTHOUSE;
  for (let y = ly + 3; y < HZ - 12; y++) {
    const half = 2 + (y - ly) / 14;
    for (let x = Math.floor(lx - half); x <= lx + half; x++)
      p.set(x, y, Math.floor((y - ly) / 5) % 2 ? '#3c3c4a' : '#4a2428');
  }
  p.rect(lx - 3, ly - 1, 7, 4, '#1a1a22');
  p.rect(lx - 2, ly, 5, 2, '#ffe8a0');
  p.poly([[lx - 3, ly - 1], [lx, ly - 4], [lx + 3, ly - 1]], '#1a1a22');
  return p.canvas();
}

function seaTexture(): HTMLCanvasElement {
  const p = new Painter(TW * 2, SEA_H);
  const r = rng(202);
  const periods = [16, 32, 64, 128];
  // rows are grouped into swells that get taller toward the viewer; each swell has a lit crest
  let y = 0;
  while (y < SEA_H) {
    const d = y / (SEA_H - 1);
    const bh = 1 + Math.floor(d * d * 7);
    const per = periods[Math.min(periods.length - 1, Math.floor(d * periods.length))];
    const ph = r.range(0, Math.PI * 2);
    const lo = mix('#1a2638', '#040c14', d), hi = mix('#3a5068', '#6a90a8', d);
    for (let k = 0; k < bh && y + k < SEA_H; k++) {
      const yy = y + k;
      for (let x = 0; x < TW; x++) {
        const v = Math.sin((x / per) * Math.PI * 2 + ph) + 0.4 * Math.sin((x / per) * Math.PI * 6 + ph * 2);
        let c: Color = k / bh * 0.5 > bayer(x, yy) ? darken(lo, 0.3) : lo;
        if (k === 0 && v > 0.6) c = v > 1 ? hi : mix(lo, hi, 0.5);
        else if (k === 1 && v > 1.05 && bayer(x, yy) < 0.5) c = mix(lo, hi, 0.4);
        if (r.next() < 0.002 * d) c = '#a8c0d0';
        p.set(x, yy, c);
        p.set(x + TW, yy, c);
      }
    }
    y += bh;
  }
  return p.canvas();
}

function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H + 8);
  const r = rng(404);
  // masts with tattered sails
  for (const [mx, yy, hw, drop] of MASTS) {
    p.rect(mx - 3, 0, 7, FLOOR, '#3a2616');
    p.rect(mx - 3, 0, 1, FLOOR, '#5a3c24');
    p.rect(mx + 3, 0, 1, FLOOR, '#24160c');
    for (let y = 6; y < FLOOR; y += 30) p.rect(mx - 4, y, 9, 2, '#1e1c1c');
    p.poly([[mx - hw, yy + 1], [mx - hw + 4, yy - 1], [mx + hw - 4, yy - 1], [mx + hw, yy + 1], [mx + hw - 4, yy + 4], [mx - hw + 4, yy + 4]], '#4a301c');
    const holes = Array.from({ length: 3 }, () => [mx + r.range(-hw * 0.6, hw * 0.6), yy + r.range(12, drop - 10), r.range(3, 7)]);
    const jag = Array.from({ length: hw * 2 }, () => r.int(-8, 3));
    for (let x = mx - hw + 3; x < mx + hw - 3; x++) {
      const t = (x - (mx - hw)) / (hw * 2);
      const bottom = yy + 4 + drop - Math.abs(t - 0.5) * 18 + jag[x - (mx - hw)] + (jag[x - (mx - hw)] < -6 ? -6 : 0);
      for (let y = yy + 4; y < bottom; y++) {
        if (holes.some(([hx, hy, hr]) => Math.hypot(x - hx, (y - hy) * 1.3) < hr)) continue;
        const billow = Math.sin(t * Math.PI) * 0.25 + (y - yy) / drop * 0.2;
        let c = mix('#6a6252', '#24201a', billow + t * 0.3);
        if ((x - mx + 200) % 11 === 0) c = darken(c, 0.25);
        if (bayer(x, y) < 0.12) c = darken(c, 0.15);
        p.set(x, y, c);
      }
    }
  }
  // crow's nest on the main mast
  p.rect(240, 10, 33, 8, '#3a2616');
  p.rect(240, 10, 33, 1, '#6a4428');
  for (let x = 241; x < 273; x += 4) p.rect(x, 11, 1, 6, '#24160c');
  // shrouds with ratlines
  for (const [mx, , , ] of MASTS)
    for (const side of [-1, 1]) {
      const bx = Math.max(STERN + 4, Math.min(STAGE_W - 8, mx + side * 58));
      for (const o of [0, 5]) p.line(mx, 6, bx + o * side, railTop(bx), '#1c160e');
      for (let y = 30; y < 168; y += 9) {
        const t = (y - 6) / (railTop(bx) - 6);
        p.line(mx + (bx - mx) * t, y, mx + (bx + 5 * side - mx) * t, y, '#1c160e');
      }
    }
  // stern castle with lit cabin windows
  p.rect(0, 124, STERN, FLOOR - 124, '#3c2818');
  for (let y = 128; y < FLOOR; y += 5) p.rect(0, y, STERN, 1, '#2a1a10');
  p.rect(0, 120, STERN + 4, 4, '#6a4428');
  for (let x = 2; x < STERN; x += 6) p.rect(x, 112, 2, 8, '#4a301c');
  p.rect(0, 110, STERN + 4, 2, '#6a4428');
  for (const wx of [8, 28]) {
    p.rect(wx, 140, 10, 12, '#1a100a');
    p.rect(wx + 1, 141, 8, 10, '#d8a048');
    p.rect(wx + 1, 141, 8, 2, '#f0d080');
    p.rect(wx + 4, 141, 1, 10, '#3a2010');
    p.rect(wx + 1, 145, 8, 1, '#3a2010');
  }
  p.rect(STERN, 124, 3, FLOOR - 124, '#24160c');
  // back rail (bulwark) with open gun ports that show the sea behind
  const ports = [126, 214, 298, 384];
  for (let x = STERN; x < STAGE_W; x++) {
    const top = Math.round(railTop(x));
    for (let y = top; y < FLOOR; y++) {
      if (ports.some((px) => x >= px && x < px + 10 && y >= 180 && y < 188)) continue;
      let c = (y - top) % 5 === 4 ? '#24160c' : '#3a2616';
      if ((x * 7 + Math.floor((y - top) / 5) * 13) % 37 === 0) c = '#24160c';
      p.set(x, y, c);
    }
    p.set(x, top, '#7a5230');
    p.set(x, top + 1, '#5a3a22');
    p.set(x, top + 2, '#2a1a10');
  }
  for (const px of ports) {
    p.rect(px - 1, 179, 12, 1, '#1a100a');
    p.rect(px - 1, 188, 12, 1, '#5a3a22');
  }
  // lantern posts
  for (const lx of LANTERNS) {
    const base = Math.round(railTop(lx));
    p.rect(lx - 7, LANTERN_Y - 16, 3, base - LANTERN_Y + 16, '#4a301c');
    p.rect(lx - 7, LANTERN_Y - 16, 1, base - LANTERN_Y + 16, '#6a4428');
    p.rect(lx - 7, LANTERN_Y - 16, 9, 2, '#4a301c');
  }
  // ship's wheel
  p.rect(70, 178, 5, FLOOR - 178, '#4a301c');
  p.rect(70, 178, 1, FLOOR - 178, '#6a4428');
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    p.line(72, 172, 72 + Math.cos(ang) * 12, 172 + Math.sin(ang) * 12, '#5a3a20');
  }
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    p.set(72 + Math.cos(ang) * 8, 172 + Math.sin(ang) * 8, '#7a5230');
    p.set(72 + Math.cos(ang) * 9, 172 + Math.sin(ang) * 9, '#4a301c');
  }
  p.ellipse(72, 172, 2, 2, '#8a6038');
  // barrels, a crate and a coil of rope
  const barrel = (bx: number, by: number) => {
    for (let y = 0; y < 15; y++) {
      const half = 5 + Math.sin((y / 14) * Math.PI) * 1.5;
      for (let x = -half; x <= half; x++) {
        const t = (x + half) / (half * 2);
        p.set(bx + x, by - 15 + y, mix('#7a5230', '#2a1a10', t * 0.9));
      }
    }
    for (const hy of [2, 12]) p.rect(bx - 6, by - 15 + hy, 13, 1, '#2a2a2e');
  };
  barrel(112, FLOOR);
  barrel(125, FLOOR);
  barrel(118, FLOOR - 15);
  barrel(396, FLOOR);
  p.rect(366, FLOOR - 16, 18, 16, '#5a4028');
  p.rect(366, FLOOR - 16, 18, 1, '#7a5a38');
  p.line(366, FLOOR - 16, 383, FLOOR - 1, '#3a2818');
  p.line(383, FLOOR - 16, 366, FLOOR - 1, '#3a2818');
  for (const [rx, ry] of [[7, 2], [6, 2], [5, 2]].map(([a, b], i) => [a, b + i * 0]))
    for (let a = 0; a < 40; a++) p.set(230 + Math.cos((a / 40) * Math.PI * 2) * rx, FLOOR - 3 + Math.sin((a / 40) * Math.PI * 2) * ry, '#8a7a50');
  // deck planks (long boards, rain-slick highlights)
  let x = 0;
  while (x < STAGE_W) {
    const w = r.int(26, 52);
    const base = r.pick(['#4a3220', '#523822', '#46301e', '#4e3420']);
    p.rect(x, FLOOR, w, 7, base);
    p.rect(x, FLOOR, w, 1, lighten(base, 0.3));
    p.rect(x, FLOOR + 6, w, 1, darken(base, 0.45));
    p.rect(x + w - 1, FLOOR, 1, 7, darken(base, 0.55));
    for (let k = 0; k < 3; k++) p.rect(x + r.int(2, w - 6), FLOOR + r.int(2, 4), r.int(2, 5), 1, lighten(base, 0.15));
    x += w;
  }
  // hull below the deck: strakes, a heavy wale, cannon muzzles and barnacles
  for (let y = FLOOR + 7; y < H + 8; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const k = y - FLOOR - 7;
      let c = k % 4 === 0 ? '#3a2414' : k % 4 === 3 ? '#160c06' : '#28180c';
      if (k >= 2 && k < 5) c = k === 2 ? '#2a2a2a' : '#141210';
      if (bayer(x, y) < 0.06) c = '#3a4430';
      p.set(x, y, c);
    }
  for (let cx = 30; cx < STAGE_W; cx += 56) {
    p.rect(cx - 5, FLOOR + 12, 11, 9, '#100804');
    p.ellipse(cx + 0.5, FLOOR + 16.5, 3.5, 3.5, '#4a4a52');
    p.ellipse(cx + 0.5, FLOOR + 16.5, 2, 2, '#050404');
  }
  return p.canvas();
}

export class BoatStage implements Arena {
  name = 'THE DROWNED GALLEON';
  song: SongName = 'boat';
  sky = sky();
  far = far();
  sea = seaTexture();
  deck = deck();
  pit: HTMLCanvasElement;
  buf = makeCanvas(W, BH);
  lastSound = -1;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  bob(t: number) {
    return Math.round(Math.sin(t * 0.021) * 2.5);
  }
  roll(t: number) {
    return Math.sin(t * 0.017) * 0.05;
  }
  /** Lightning strength at frame t: a double flash every ten seconds or so. */
  flash(t: number) {
    const c = t % 620;
    return c < 4 ? 1 : c >= 8 && c < 11 ? 0.6 : 0;
  }

  /** Thunder and wave crashes, keyed to frame numbers so redraws of the same frame stay silent. */
  sounds(t: number) {
    if (t === this.lastSound) return;
    this.lastSound = t;
    if (t % 620 === 30) {
      noise({ dur: 2.4, vol: 0.32, type: 'lowpass', freq: 320, to: 50, attack: 0.06 });
      noise({ dur: 0.5, vol: 0.14, type: 'lowpass', freq: 1400, to: 200 });
    }
    if (t % 260 === 2) noise({ dur: 0.8, vol: 0.1, type: 'bandpass', freq: 1600, to: 500, q: 0.6, attack: 0.1 });
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.sounds(t);
    const [BUF, B] = this.buf;
    const bob = this.bob(t), roll = this.roll(t), fl = this.flash(t);
    B.drawImage(this.sky, 0, 0);
    if (fl) {
      // forked bolt somewhere over the sea
      let bx = 30 + hash(Math.floor(t / 620)) * 190, by = PAD;
      B.fillStyle = '#e8f0ff';
      while (by < HZ - 6) {
        const nx = bx + (hash(by + t) - 0.5) * 14, ny = by + 6 + hash(by * 3) * 6;
        pxLine(B, bx, by, nx, ny);
        bx = nx;
        by = ny;
      }
      B.fillStyle = `rgba(200,210,255,${0.35 * fl})`;
      B.fillRect(0, 0, W, HZ);
    }
    B.drawImage(this.far, -Math.round(camX * 0.15), 0);
    // sweeping lighthouse beam
    const lx = LIGHTHOUSE[0] - Math.round(camX * 0.15), ly = LIGHTHOUSE[1];
    const ang = t * 0.025, len = Math.abs(Math.cos(ang)) * 70, dir = Math.cos(ang) > 0 ? 1 : -1;
    B.globalCompositeOperation = 'lighter';
    for (let i = 2; i < len; i += 2) {
      const half = 1 + i * 0.12;
      B.fillStyle = `rgba(255,230,160,${0.16 * (1 - i / 70)})`;
      B.fillRect(lx + dir * i, Math.round(ly - half), 2, Math.round(half * 2));
    }
    B.fillStyle = `rgba(255,230,160,${0.25 + Math.abs(Math.cos(ang)) * 0.4})`;
    B.fillRect(lx - 3, ly - 2, 7, 5);
    B.globalCompositeOperation = 'source-over';
    // the sea: each row scrolls at its own speed (closer rows faster) and wobbles
    for (let y = 0; y < SEA_H; y++) {
      const d = y / (SEA_H - 1);
      const ox = camX * (0.15 + 0.8 * d) + t * (0.12 + 0.45 * d) + Math.sin(t * 0.03 + y * 0.4) * d * 3;
      B.drawImage(this.sea, Math.floor(((ox % TW) + TW) % TW), y, W, 1, 0, HZ + y, W, 1);
    }
    // glittering moon path on the water
    B.fillStyle = 'rgba(220,228,215,0.75)';
    for (let y = 1; y < SEA_H; y += 2) {
      const d = y / SEA_H;
      if (hash(y * 13 + (t >> 3)) > 0.55) continue;
      const wx = MOON_X + Math.sin(y * 0.7 + t * 0.05) * (2 + d * 16);
      B.fillRect(Math.round(wx), HZ + y, 1 + Math.floor(d * 4), 1);
    }
    if (fl) {
      B.fillStyle = `rgba(200,210,255,${0.2 * fl})`;
      B.fillRect(0, HZ, W, SEA_H);
    }
    // blit in tilted columns: the horizon rolls against the ship
    const top = -PAD - Math.round(bob * 1.5);
    for (let x = 0; x < W; x += 4) ctx.drawImage(BUF, x, 0, 4, BH, x, top + Math.round(roll * (x + 2 - W / 2)), 4, BH);

    ctx.drawImage(this.deck, -Math.round(camX), bob);
    // swinging ghost-lanterns
    const swing = Math.round(-roll * 60);
    for (const lx0 of LANTERNS) {
      const sx = lx0 - Math.round(camX), y = LANTERN_Y + bob;
      if (sx < -30 || sx > W + 30) continue;
      const fx = sx + swing;
      ctx.fillStyle = '#1a140c';
      pxLine(ctx, sx, y - 14, fx, y - 5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(110,255,170,0.06)';
      for (const rr of [24, 16, 10]) ctx.fillRect(fx - rr, y - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
      const fk = Math.sin(t * 0.37 + lx0) + Math.sin(t * 0.91 + lx0 * 2);
      ctx.fillStyle = '#3a3428';
      ctx.fillRect(fx - 3, y - 5, 7, 1);
      ctx.fillRect(fx - 3, y + 3, 7, 1);
      ctx.fillStyle = fk > 0.6 ? '#c8ffd8' : '#6ae8a0';
      ctx.fillRect(fx - 2, y - 4, 5, 7);
      ctx.fillStyle = '#e8fff0';
      ctx.fillRect(fx, y - 2 + (fk > 0 ? 0 : 1), 1, 3);
      ctx.fillStyle = '#2a2418';
      ctx.fillRect(fx - 3, y - 4, 1, 7);
      ctx.fillRect(fx + 3, y - 4, 1, 7);
    }
  }

  /** Rain, wave spray over the hull and lightning washing over everything. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.fillStyle = 'rgba(170,190,225,0.35)';
    for (let i = 0; i < 70; i++) {
      const x = ((hash(i) * W - t * 2 - camX * 1.2) % W + W) % W;
      const y = ((hash(i + 99) * H + t * (5 + (i % 3))) % (H + 10)) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      ctx.fillRect(Math.round(x - 1), Math.round(y + 2), 1, 2);
    }
    const c = t % 260;
    if (c < 44) {
      const k = c / 44, sx = 30 + hash(Math.floor(t / 260) + 7) * 190;
      ctx.fillStyle = `rgba(200,222,238,${0.8 * (1 - k)})`;
      for (let i = 0; i < 28; i++) {
        const spread = (i - 14) * 2.4 * (0.4 + k);
        const hgt = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (26 + (i % 5) * 7) * (1 - Math.abs(i - 14) / 18);
        ctx.fillRect(Math.round(sx + spread + Math.sin(i * 3.1) * 3), Math.round(H - 4 - hgt), 2, 2);
      }
      ctx.fillStyle = `rgba(160,190,210,${0.4 * (1 - k)})`;
      ctx.fillRect(Math.round(sx - 30), H - 5, 60, 5);
    }
    const fl = this.flash(t);
    if (fl) {
      ctx.fillStyle = `rgba(210,220,255,${0.22 * fl})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Under the waves: a wreck, an upturned anchor where the victim lands, and the bones of earlier crews. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(303);
    p.gradRect(0, 0, W, H, '#14465c', '#020710', 10);
    for (let y = 0; y < 6; y++) for (let x = 0; x < W; x++) if (0.6 * (1 - y / 6) > bayer(x, y) && Math.sin(x * 0.3 + y) > -0.2) p.set(x, y, '#6aa8bc');
    // light shafts from the surface
    for (const rx of [30, 110, 196])
      for (let y = 0; y < 180; y++)
        for (let x = 0; x < W; x++) {
          const w = 9 + y * 0.06, d = Math.abs(x - rx - y * 0.35);
          if (d < w && (1 - d / w) * 0.24 * (1 - y / 180) > bayer(x, y)) p.set(x, y, mix(p.get(x, y), '#7ac0cc', 0.35));
        }
    // a shark circling in the gloom
    p.ellipse(186, 64, 22, 5, '#0a2230');
    p.poly([[164, 64], [154, 56], [158, 64], [154, 72]], '#0a2230');
    p.poly([[184, 60], [190, 50], [196, 60]], '#0a2230');
    p.poly([[194, 67], [198, 74], [202, 67]], '#0a2230');
    p.set(202, 63, '#2a5060');
    // small fish
    for (let i = 0; i < 14; i++) {
      const fx = 30 + r.int(0, 80), fy = 90 + r.int(0, 30);
      p.rect(fx, fy, 3, 1, '#2a6474');
      p.set(fx + 3, fy, '#1a4a58');
    }
    // the wreck: a broken hull, ribs and splintered mast stumps
    p.poly([[0, H], [0, 168], [40, 158], [86, 170], [104, H]], '#0c1416');
    for (let y = 164; y < H; y += 6) p.line(0, y, 100, y + 3, '#16201e');
    for (let rx = 160; rx < 246; rx += 11) for (let k = 0; k < 30; k++) p.set(rx + Math.sin(k / 30 * 1.6) * 8, 198 - k, '#1a1612');
    for (const [mx, top] of [[42, 120], [214, 150], [238, 166]]) p.poly([[mx - 3, 200], [mx - 3, top + 6], [mx - 1, top], [mx + 1, top + 4], [mx + 3, top + 1], [mx + 3, 200]], '#2a2016');
    // upturned anchor: its shank is the spike the victim lands on
    p.rect(127, 142, 2, 58, '#5a5a66');
    p.rect(126, 152, 4, 48, '#4a4a56');
    p.rect(126, 152, 1, 48, '#6a6a78');
    p.rect(118, 158, 20, 3, '#4a4a56');
    p.rect(118, 158, 20, 1, '#6a6a78');
    p.poly([[110, 194], [114, 186], [128, 198], [142, 186], [146, 194], [128, 204]], '#3a3a46');
    // seabed sand and kelp
    for (let x = 0; x < W; x++) {
      const sy = Math.round(200 + Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2);
      for (let y = sy; y < H; y++) p.set(x, y, y === sy ? '#4a4a3a' : bayer(x, y) < 0.25 ? '#2a2c24' : '#1c1e18');
    }
    for (const kx of [12, 70, 96, 150, 178, 226, 248]) {
      const len = r.int(30, 70);
      for (let k = 0; k < len; k++) p.set(kx + Math.sin(k * 0.25 + kx) * 3, 202 - k, k % 7 < 5 ? '#1a4830' : '#24603e');
    }
    for (let i = 0; i < 18; i++) {
      const bx = r.int(10, W - 10), by = r.int(20, 190), br = r.range(0.8, 2);
      p.ellipse(bx, by, br, br, '#4a8aa0');
      p.set(bx - 1, by - 1, '#a0d0e0');
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[64, 196, -90, 1], [196, 194, -84, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -110, ab: 30, lf: -30, kf: 50, h: 20 })));
      ctx.restore();
    }
    return cv;
  }
}
