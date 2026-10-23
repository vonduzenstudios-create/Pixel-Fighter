import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng, Rng } from '../../core/rng';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';

// "The Sporewood": a dusk forest of towering toadstools. The fighters brawl on a mossy
// fallen log that spans a bramble hollow, lit by glowing caps and drifting spores.
// Every layer is painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);

interface Glow { x: number; y: number; r: number; col: string; ph: number }

interface Shroom {
  cx: number; base: number; stemH: number; stemW: number; lean: number;
  rx: number; ry: number; cap: Color; stem: Color; spots?: Color; gill: Color;
}

/** A toadstool: tapered leaning stem, domed cap with a lip, gills underneath and optional spots. */
function shroom(p: Painter, r: Rng, m: Shroom) {
  const topX = m.cx + m.lean, topY = m.base - m.stemH;
  // stem, slightly bulbous at the foot
  p.capsule(m.cx, m.base, m.stemW * 0.75, topX, topY + m.ry * 0.3, m.stemW * 0.5, m.stem);
  p.ellipse(m.cx, m.base - 1, m.stemW * 0.95, m.stemW * 0.45, darken(m.stem, 0.08));
  // stem shading: darker toward the right, a few vertical fibre streaks
  const x0 = Math.floor(Math.min(m.cx, topX) - m.stemW), x1 = Math.ceil(Math.max(m.cx, topX) + m.stemW);
  for (let y = Math.floor(topY); y < m.base + m.stemW; y++) {
    const t = (y - topY) / Math.max(1, m.base - topY);
    const sx = topX + (m.cx - topX) * t;
    for (let x = x0; x <= x1; x++) {
      if (!p.alpha(x, y)) continue;
      if (x > sx + m.stemW * 0.2 && bayer(x, y) < 0.5) p.over(x, y, darken(m.stem, 0.22));
      else if (x < sx - m.stemW * 0.3 && bayer(x, y) < 0.35) p.over(x, y, lighten(m.stem, 0.18));
    }
  }
  // a ring (annulus) partway up the stem
  const ringY = topY + m.ry * 0.3 + m.stemH * 0.18;
  p.ellipse(topX + m.lean * -0.18, ringY, m.stemW * 0.85, 1.5, lighten(m.stem, 0.1));
  // gills: a flat dark band under the cap
  p.ellipse(topX, topY + m.ry * 0.25, m.rx * 0.92, m.ry * 0.3, m.gill);
  for (let i = -m.rx * 0.85; i < m.rx * 0.85; i += 2) p.line(topX, topY + m.ry * 0.12, topX + i, topY + m.ry * 0.42, darken(m.gill, 0.25));
  // domed cap (upper half of an ellipse, slightly flattened lip)
  for (let y = Math.floor(topY - m.ry); y <= topY + m.ry * 0.22; y++)
    for (let x = Math.floor(topX - m.rx - 1); x <= topX + m.rx + 1; x++) {
      const dx = (x + 0.5 - topX) / m.rx, dy = (y + 0.5 - topY) / m.ry;
      if (dx * dx + (dy < 0 ? dy * dy : dy * dy * 9) > 1) continue;
      // light from upper left
      const l = -dx * 0.5 - dy * 0.7;
      let c: Color = m.cap;
      if (l > 0.45 && bayer(x, y) < (l - 0.45) * 3) c = lighten(m.cap, 0.28);
      else if (l < -0.15 && bayer(x, y) < (-0.15 - l) * 2.2) c = darken(m.cap, 0.3);
      if (dy > 0.05) c = darken(m.cap, 0.38);
      p.set(x, y, c);
    }
  // highlight glint
  p.ellipse(topX - m.rx * 0.4, topY - m.ry * 0.55, Math.max(1, m.rx * 0.16), Math.max(1, m.ry * 0.12), lighten(m.cap, 0.5));
  // soft spots, scattered so none overlap the glint
  if (m.spots) {
    const n = Math.round(m.rx / 4);
    for (let i = 0; i < n; i++) {
      const a = r.range(-0.85, 0.85), bb = r.range(-0.9, -0.15);
      const sx = topX + a * m.rx * 0.85, sy = topY + bb * m.ry * 0.9;
      const sr = r.range(1, Math.max(1.5, m.rx * 0.12));
      p.ellipse(sx, sy, sr * 1.2, sr * 0.8, m.spots, true);
      p.set(sx - sr * 0.4, sy - sr * 0.3, lighten(m.spots, 0.4));
    }
  }
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(301);
  const stops = ['#0e0a24', '#1e1240', '#3a1c58', '#6a2e66', '#a8506a', '#e08a6a'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / 170) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W - 1), y = r.int(0, 90);
    p.set(x, y, r.next() < 0.25 ? '#fff6d0' : '#8a7ab0');
  }
  // twin moons: a big pale-mint one and a little lilac companion
  const mx = 70, my = 46;
  for (let y = -34; y <= 34; y++)
    for (let x = -34; x <= 34; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 18 && d < 32 && ((32 - d) / 14) * 0.45 > bayer(mx + x, my + y)) p.set(mx + x, my + y, mix(p.get(mx + x, my + y), '#7ad0b0', 0.3));
    }
  p.ellipse(mx, my, 17, 17, '#bfe8cf');
  p.ellipse(mx - 3, my - 3, 12, 12, '#d8f4e0');
  for (const [cx, cy, cr] of [[mx + 5, my + 4, 3], [mx - 6, my + 7, 2], [mx + 8, my - 6, 2]]) p.ellipse(cx, cy, cr, cr, '#a0d0b8');
  p.ellipse(108, 28, 5, 5, '#c8a8e8');
  p.ellipse(107, 27, 3, 3, '#e0ccf4');
  // long wispy clouds lit pink from below
  for (const [cy, x0, x1] of [[62, 20, 150], [74, 120, 250], [88, 0, 90], [96, 150, 256]])
    for (let x = x0; x < x1; x++)
      for (let k = 0; k < 3; k++) {
        const edge = Math.min(x - x0, x1 - x) / 20;
        if (bayer(x, cy + k) < Math.min(0.8, edge) * (k === 2 ? 0.9 : 0.5)) p.set(x, cy + k, k === 2 ? '#c06a7a' : '#4a2456');
      }
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(311);
  // distant mushroom silhouettes standing on soft rolling hills
  for (let i = 0; i < 9; i++) {
    const cx = 10 + i * 40 + r.int(-10, 10), base = 150;
    shroom(p, r, {
      cx, base, stemH: r.int(40, 70), stemW: r.int(3, 5), lean: r.int(-6, 6),
      rx: r.int(14, 24), ry: r.int(7, 11), cap: '#3a2460', stem: '#2e1e4c', gill: '#22163a',
    });
  }
  for (let x = 0; x < FAR_W; x++) {
    const hy = 138 + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.011 + 1) * 8;
    for (let y = Math.floor(hy); y < H; y++) p.set(x, y, '#24183e');
    p.set(x, Math.floor(hy), '#4a3468');
  }
  // haze over the far layer so it sits back in the dusk
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.25) p.set(x, y, mix(p.get(x, y), '#6a3a6a', 0.4));
  return p.canvas();
}

function mid(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(323);
  const caps: [Color, Color][] = [['#2a8a8c', '#bff0e0'], ['#7a3a9a', '#f0c8ff'], ['#c8702a', '#ffe0a0'], ['#3a5aa8', '#c8d8ff']];
  for (let i = 0; i < 7; i++) {
    const cx = 20 + i * 58 + r.int(-12, 12), base = 186;
    const [cap, spots] = caps[i % caps.length];
    const rx = r.int(18, 30), stemH = r.int(55, 95);
    const lean = r.int(-10, 10);
    shroom(p, r, { cx, base, stemH, stemW: r.int(4, 7), lean, rx, ry: Math.round(rx * 0.5), cap, stem: '#c8b8a8', spots, gill: '#e8c890' });
    // gills glow faintly at dusk
    glows.push({ x: cx + lean, y: base - stemH + rx * 0.15, r: rx * 0.8, col: spots as string, ph: i * 1.7 });
  }
  // hanging vines with little bell flowers
  for (let i = 0; i < 9; i++) {
    const vx = r.int(0, MID_W), len = r.int(20, 70);
    for (let y = 0; y < len; y++) p.set(vx + Math.round(Math.sin(y * 0.2 + i) * 1.5), y, y % 5 === 0 ? '#3a6a3a' : '#2a4a2e');
    p.ellipse(vx + Math.round(Math.sin(len * 0.2 + i) * 1.5), len + 1, 2, 2, '#e8a0d0');
  }
  // undergrowth: ferns and moss mounds along the base
  for (let x = 0; x < MID_W; x++) {
    const hy = 180 + Math.sin(x * 0.07) * 3 + Math.sin(x * 0.23) * 2;
    for (let y = Math.floor(hy); y < H; y++) p.set(x, y, bayer(x, y) < 0.3 ? '#1e3a2a' : '#162a20');
    p.set(x, Math.floor(hy), '#3a6a40');
  }
  for (let i = 0; i < 26; i++) {
    const fx = r.int(0, MID_W), fy = 184 + r.int(-2, 2), h = r.int(6, 12);
    for (let k = 0; k < 5; k++) p.line(fx, fy, fx + (k - 2) * 3, fy - h + Math.abs(k - 2) * 2, '#2e5a36');
  }
  return p.canvas();
}

// Big near toadstools whose stems frame the fight; caps glow and pulse.
const NEAR = [
  { cx: 22, stemH: 128, rx: 44, cap: '#c04a9a', spots: '#ffe0f4', lean: 6 },
  { cx: 190, stemH: 110, rx: 34, cap: '#2a9a8a', spots: '#d0fff0', lean: -4 },
  { cx: 340, stemH: 140, rx: 50, cap: '#6a40b0', spots: '#e8d0ff', lean: 8 },
  { cx: 492, stemH: 118, rx: 40, cap: '#d08030', spots: '#fff0b8', lean: -6 },
];
function deck(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(337);
  // the hollow under the log: dark with pale thorn tips poking up
  p.rect(0, FLOOR + 12, STAGE_W, H - FLOOR - 12, '#0a0612');
  for (let x = 0; x < STAGE_W; x += r.int(4, 8)) {
    const h = r.int(4, 10);
    p.poly([[x - 2, H], [x + r.range(-1, 1), H - h], [x + 2, H]], '#2a1e2c');
    p.set(x, H - h, '#d8c8b0');
  }
  for (const n of NEAR) {
    shroom(p, r, { cx: n.cx, base: FLOOR + 4, stemH: n.stemH, stemW: 9, lean: n.lean, rx: n.rx, ry: Math.round(n.rx * 0.45), cap: n.cap, stem: '#e0d0bc', spots: n.spots, gill: '#f0d8a8' });
  }
  p.shade(0.12);
  // the fallen log: rounded bark body with moss on top
  for (let x = 0; x < STAGE_W; x++) {
    for (let y = FLOOR; y < FLOOR + 14; y++) {
      const t = (y - FLOOR) / 14;
      let c: Color = t < 0.3 ? '#6a4a30' : t < 0.7 ? '#523822' : '#3a2616';
      if ((x * 7 + (y >> 1) * 3) % 23 === 0) c = darken(c, 0.3); // bark grooves
      if (bayer(x, y) < 0.12) c = lighten(c, 0.12);
      p.set(x, y, c);
    }
    // bark plates
    if (x % 13 === 0) p.line(x, FLOOR + 4, x + 3, FLOOR + 12, '#2e1e12');
  }
  // moss blanket with tufts and tiny flowers
  for (let x = 0; x < STAGE_W; x++) {
    const m = 2 + Math.round(Math.sin(x * 0.17) + Math.sin(x * 0.53));
    for (let k = 0; k < m + 1; k++) p.set(x, FLOOR + k, k === 0 ? '#8ad070' : k < 2 ? '#5aa04a' : '#3a7a3a');
    if (r.next() < 0.12) p.set(x, FLOOR - 1, '#6ab858');
    if (r.next() < 0.015) p.set(x, FLOOR - 1, r.pick(['#ffe070', '#ff9ad0', '#a0e0ff']));
  }
  // shelf fungi stepping down the log's side
  for (let x = 12; x < STAGE_W; x += r.int(30, 60)) {
    const y = FLOOR + r.int(6, 10), w = r.int(4, 7);
    p.ellipse(x, y, w, 2, '#e8b060');
    p.rect(x - w, y, w * 2, 1, '#a06a30');
  }
  // little clusters of glowing caps sitting on the moss
  for (let i = 0; i < 9; i++) {
    const gx = 30 + i * 56 + r.int(-14, 14);
    const col = r.pick(['#7affd8', '#ffb8f0', '#b8f070']);
    for (let k = 0; k < 3; k++) {
      const x = gx + k * 4 - 4, h = r.int(3, 6);
      p.rect(x, FLOOR - h, 1, h, '#e8e0d0');
      p.ellipse(x + 0.5, FLOOR - h, 2.5, 1.6, col);
      p.set(x, FLOOR - h - 1, lighten(col, 0.6));
    }
    glows.push({ x: gx, y: FLOOR - 5, r: 12, col, ph: i * 2.3 });
  }
  for (const n of NEAR) glows.push({ x: n.cx + n.lean, y: FLOOR + 4 - n.stemH, r: n.rx, col: n.spots, ph: n.cx * 0.1 });
  return p.canvas();
}

const hexA = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export class MushroomStage {
  name = 'THE SPOREWOOD';
  blurb = 'GIANT TOADSTOOLS AT DUSK';
  song: SongName = 'mushroom';
  sky = sky();
  far = far();
  midGlows: Glow[] = [];
  deckGlows: Glow[] = [];
  mid = mid(this.midGlows);
  deck = deck(this.deckGlows);
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  /** Close-up of the bramble hollow for the uppercut stage finish. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(377);
    p.gradRect(0, 0, W, H, '#1c1030', '#06040a', 8);
    // root-tangled walls
    for (let y = 0; y < H; y++) {
      const L = 30 + Math.sin(y * 0.05) * 10 + Math.sin(y * 0.17) * 4, R = 30 + Math.sin(y * 0.04 + 2) * 12;
      for (let x = 0; x < L; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#2a1c2a' : '#1a1020');
      for (let x = W - Math.floor(R); x < W; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#2a1c2a' : '#1a1020');
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2, y0 = r.int(10, 170);
      const x0 = side ? W - 30 : 30, x1 = side ? W - r.int(60, 110) : r.int(60, 110);
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        p.ellipse(x0 + (x1 - x0) * t, y0 + Math.sin(t * 3) * 8 + t * 20, 2 - t, 2 - t, '#3a2a22');
      }
    }
    // glowing caps on the walls light the hollow
    for (let i = 0; i < 12; i++) {
      const side = i % 2, x = side ? W - r.int(26, 40) : r.int(26, 40), y = r.int(20, 170);
      const col = r.pick(['#7affd8', '#ffb8f0', '#b8f070']);
      for (let yy = -10; yy <= 10; yy++)
        for (let xx = -10; xx <= 10; xx++) {
          const d = Math.sqrt(xx * xx + yy * yy) / 10;
          if (d < 1 && (1 - d) * 0.35 > bayer(x + xx, y + yy)) p.set(x + xx, y + yy, mix(p.get(x + xx, y + yy), col, 0.35));
        }
      p.ellipse(x, y, 4, 2, col);
      p.rect(x - 4, y + 1, 8, 1, darken(col, 0.4));
    }
    // a bed of bone-pale thorns
    for (let row = 0; row < 3; row++) {
      const baseY = 186 + row * 14, hgt = 32 + row * 6;
      for (let sx = -4 + row * 7; sx < W + 8; sx += 15 - row * 2) {
        const h = hgt + r.int(-6, 6), bend = r.range(-4, 4);
        const col = row === 2 ? '#8a7a6a' : row === 1 ? '#6a5a4c' : '#4a3e36';
        p.poly([[sx - 4, baseY + 20], [sx + bend, baseY - h + 20], [sx + 4, baseY + 20]], col);
        p.line(sx + bend, baseY - h + 21, sx - 2, baseY + 18, lighten(col, 0.3));
        // bramble stems tangling between thorns
        p.line(sx - 6, baseY + 10 + r.int(-4, 4), sx + 6, baseY + 6 + r.int(-4, 4), '#2a3a22');
      }
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[60, 176, -95, 1], [190, 182, -75, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -120, ab: 40, lf: -40, kf: 60, h: 30 })));
      ctx.restore();
    }
    return cv;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    // slow spores rising between the far and mid layers
    ctx.fillStyle = 'rgba(255,240,200,0.5)';
    for (let i = 0; i < 24; i++) {
      const x = ((i * 53 + Math.sin(t * 0.01 + i) * 12 - camX * 0.4) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = H - ((t * (0.12 + (i % 5) * 0.03) + i * 37) % (H + 20));
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const mx = -Math.round(camX * 0.55);
    ctx.drawImage(this.mid, mx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.midGlows) this.glow(ctx, g.x + mx, g.y, g.r, g.col, 0.14 + 0.08 * Math.sin(t * 0.03 + g.ph));
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.deckGlows) {
      const sx = g.x + dx;
      if (sx < -g.r * 2 || sx > W + g.r * 2) continue;
      this.glow(ctx, sx, g.y, g.r, g.col, 0.2 + 0.12 * Math.sin(t * 0.045 + g.ph));
    }
    ctx.globalCompositeOperation = 'source-over';
    // fireflies wandering over the log
    for (let i = 0; i < 10; i++) {
      const ph = t * 0.012 + i * 2.1;
      const x = ((i * 61 + Math.sin(ph) * 30 + dx) % STAGE_W + STAGE_W) % STAGE_W;
      const y = 140 + Math.sin(ph * 1.7 + i) * 26;
      const on = Math.sin(t * 0.08 + i * 3) > -0.2;
      if (!on || x > W) continue;
      ctx.fillStyle = 'rgba(220,255,120,0.25)';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      ctx.fillStyle = '#f0ffa0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /** Soft round halo, added on top with 'lighter' blending. */
  glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, Math.max(0, a)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }

  /** Puffs of spores drifting in front of the fighters. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 14; i++) {
      const x = ((i * 89 + t * 0.25 - camX * 1.2) % (W + 60) + W + 60) % (W + 60) - 30;
      const y = 120 + ((i * 29 + Math.sin(t * 0.02 + i) * 10) % 80);
      ctx.fillStyle = i % 3 ? 'rgba(200,255,220,0.35)' : 'rgba(255,190,240,0.35)';
      ctx.fillRect(Math.round(x), Math.round(y), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    ctx.fillStyle = 'rgba(120,80,160,0.08)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 113 + t * 0.15 - camX * 1.2) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.fillRect(Math.round(x), FLOOR + 1 - (i % 3) * 3, 70, 6);
    }
  }
}
