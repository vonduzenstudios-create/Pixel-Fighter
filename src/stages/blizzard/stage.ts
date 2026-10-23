import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng, Rng } from '../../core/rng';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import { ridge } from '../gorge/stage';

// "The Howling Pass": a frozen stone ledge spanning an ice crevasse high in the mountains,
// in the middle of a ferocious blizzard. Wind gusts swing the snow from a drift to a sideways
// torrent and now and then whip up a near whiteout. The backdrops are painted procedurally
// at load time; the snow, wind and lantern are animated every frame.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.2);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.5);
const LANTERN_X = 300;
const LANTERN_TOP = FLOOR - 62;
const HUT_X = 250;

/** Wind strength 0..1: a restless base with rolling gusts and a big surge every few seconds. */
export function gust(t: number): number {
  const base = 0.38 + 0.18 * Math.sin(t * 0.011) + 0.1 * Math.sin(t * 0.037 + 2);
  const surge = Math.pow(Math.max(0, Math.sin(t * 0.0065 + 1.3)), 6);
  return Math.max(0, Math.min(1, base + surge * 0.8));
}

/** A snow-laden pine: stacked drooping tiers, white along the top of each bough. */
function pine(p: Painter, cx: number, base: number, h: number, w: number, col: Color, snow: Color) {
  p.rect(cx - 1, base - h * 0.2, 3, h * 0.2, darken(col, 0.4));
  const tiers = Math.max(3, Math.round(h / 12));
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const ty = base - h * 0.15 - t * h * 0.8, tw = w * (1 - t * 0.85), th = h * 0.28;
    p.poly([[cx - tw, ty], [cx, ty - th], [cx + tw, ty]], col);
    // drooping bough tips
    p.poly([[cx - tw, ty], [cx - tw * 0.6, ty - 2], [cx - tw * 0.8, ty + 2]], col);
    p.poly([[cx + tw, ty], [cx + tw * 0.6, ty - 2], [cx + tw * 0.8, ty + 2]], col);
    // snow caps on the upper edges of the tier
    for (let k = 0; k <= 12; k++) {
      const f = k / 12;
      const lx = cx - tw + (tw * f), ly = ty - th * f;
      const rx = cx + tw - (tw * f);
      p.set(lx, ly, snow);
      p.set(lx + 1, ly, snow);
      p.set(rx, ly, mix(snow, col, 0.35));
    }
    p.rect(cx - tw * 0.7, ty - 1, tw * 1.4, 1, snow);
  }
  p.set(cx, base - h * 0.95 - h * 0.1, snow);
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops = ['#1a2030', '#28324a', '#3a4862', '#56677e', '#7a8ca0', '#a4b4c4'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / 160) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // heavy rolling storm clouds, darker on their bellies
  const r = rng(503);
  for (let i = 0; i < 26; i++) {
    const cx = r.int(-20, W + 20), cy = r.int(8, 90), rx = r.int(18, 46), ry = r.int(6, 14);
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1 || bayer(cx + x, cy + y) > (1 - d) * 1.6) continue;
        p.set(cx + x, cy + y, y > ry * 0.3 ? '#1c2232' : y < -ry * 0.5 ? '#4a5870' : '#30394e');
      }
  }
  // a weak sun smeared behind the clouds
  for (let y = -26; y <= 26; y++)
    for (let x = -26; x <= 26; x++) {
      const d = Math.sqrt(x * x + y * y) / 26;
      if (d < 1 && (1 - d) * 0.45 > bayer(190 + x, 52 + y)) p.set(190 + x, 52 + y, mix(p.get(190 + x, 52 + y), '#d8e0e8', 0.35));
    }
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(517);
  // two ranges of jagged peaks with snowfields, the nearer one darker
  for (const [base, amp, col, snowCol, seed] of [[92, 38, '#58687e', '#d0dae6', 0], [122, 28, '#3a4a60', '#b8c6d6', 1]] as const) {
    const h = ridge(rng(521 + seed), FAR_W, base, amp, 1.3);
    for (let x = 0; x < FAR_W; x++) {
      const top = Math.floor(h[x]);
      for (let y = top; y < H; y++) {
        // snow lies on the upper slopes and where the ridge faces left (lit side)
        const slope = h[Math.min(FAR_W - 1, x + 1)] - h[x];
        const snowy = y - top < 10 + slope * 6 || (slope < 0 && bayer(x, y) < 0.4 && y - top < 26);
        p.set(x, y, snowy ? snowCol : bayer(x, y) < 0.15 ? lighten(col, 0.1) : col);
      }
      p.set(x, top, '#e8eef4');
    }
  }
  // forest line at the foot
  for (let i = 0; i < 40; i++) pine(p, r.int(0, FAR_W), 150 + r.int(-2, 4), r.int(12, 20), r.int(4, 6), '#2e3e4a', '#a8b8c8');
  for (let x = 0; x < FAR_W; x++) for (let y = 150; y < H; y++) p.set(x, y, bayer(x, y) < 0.3 ? '#9aaabb' : '#8a9aac');
  // thick haze: the storm swallows the distance
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.4) p.set(x, y, mix(p.get(x, y), '#a0b0c0', 0.4));
  return p.canvas();
}

function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(541);
  // a snowy slope rising to the right
  const slope = (x: number) => 176 - x * 0.03 + Math.sin(x * 0.04) * 4 + Math.sin(x * 0.013) * 6;
  // a stone shelter hut half buried in the drifts, one window lit
  const hb = Math.floor(slope(HUT_X));
  p.rect(HUT_X - 22, hb - 26, 44, 26, '#4a4a54');
  for (let y = hb - 26; y < hb; y += 5)
    for (let x = HUT_X - 22 + ((y / 5) % 2) * 4; x < HUT_X + 22; x += 8) p.rect(x, y, 7, 4, bayer(x, y) < 0.5 ? '#5a5a66' : '#545460');
  p.poly([[HUT_X - 28, hb - 25], [HUT_X, hb - 44], [HUT_X + 28, hb - 25]], '#3a2e2a');
  p.poly([[HUT_X - 30, hb - 24], [HUT_X, hb - 46], [HUT_X + 30, hb - 24], [HUT_X + 24, hb - 28], [HUT_X, hb - 41], [HUT_X - 24, hb - 28]], '#e4ecf4');
  p.rect(HUT_X + 10, hb - 52, 6, 12, '#3e3e48');
  p.rect(HUT_X + 9, hb - 53, 8, 2, '#e4ecf4');
  p.rect(HUT_X - 12, hb - 20, 10, 8, '#ffc860');
  p.rect(HUT_X - 12, hb - 17, 10, 1, '#5a3a20');
  p.rect(HUT_X - 8, hb - 20, 1, 8, '#5a3a20');
  p.rect(HUT_X + 6, hb - 18, 8, 18, '#3a2818');
  // pines along the slope, bent away from the wind
  for (let i = 0; i < 16; i++) {
    const x = 6 + i * 24 + r.int(-8, 8);
    if (Math.abs(x - HUT_X) < 34) continue;
    const s = r.int(0, 1);
    pine(p, x, Math.floor(slope(x)) + 2, s ? r.int(40, 60) : r.int(26, 38), s ? r.int(10, 14) : r.int(7, 10), '#22323c', '#dfe8f0');
  }
  for (let x = 0; x < MID_W; x++) {
    const top = Math.floor(slope(x));
    for (let y = top; y < H; y++) p.set(x, y, bayer(x, y) < 0.2 ? '#b8c6d4' : y - top < 2 ? '#eef4fa' : '#ccd8e4');
  }
  // drift mounds around the hut
  p.ellipse(HUT_X - 18, hb, 16, 6, '#e0e8f0');
  p.ellipse(HUT_X + 24, hb + 1, 12, 5, '#e0e8f0');
  // some haze so it sits behind the ledge
  for (let y = 0; y < H; y++)
    for (let x = 0; x < MID_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.3) p.set(x, y, mix(p.get(x, y), '#b4c2d0', 0.45));
  return p.canvas();
}

function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(563);
  // the crevasse under the ledge: deep blue ice falling away into black
  p.gradRect(0, FLOOR + 10, STAGE_W, H - FLOOR - 10, '#2a4a6a', '#060c18', 4);
  for (let x = 0; x < STAGE_W; x += r.int(5, 9)) {
    const h = r.int(5, 12);
    p.poly([[x - 2, H], [x + r.range(-1, 1), H - h], [x + 2, H]], '#5a8ab0');
    p.set(x, H - h, '#d8f0ff');
  }
  // big frozen pines framing the ends of the ledge
  for (const [x, h, w] of [[14, 150, 40], [498, 140, 38], [176, 96, 24]] as const) pine(p, x, FLOOR + 2, h, w, '#1a2a32', '#f0f6fc');
  p.shade(0.1);
  // the lantern post
  p.rect(LANTERN_X - 1, LANTERN_TOP, 3, FLOOR - LANTERN_TOP, '#3a2a1e');
  p.rect(LANTERN_X - 1, LANTERN_TOP, 14, 2, '#3a2a1e');
  p.rect(LANTERN_X - 2, LANTERN_TOP - 1, 16, 1, '#f0f6fc');
  // the ledge: stone slab with a cracked face, a thick crust of snow and hanging icicles
  for (let x = 0; x < STAGE_W; x++) {
    for (let y = FLOOR; y < FLOOR + 12; y++) {
      const t = (y - FLOOR) / 12;
      let c: Color = t < 0.35 ? '#6a7080' : t < 0.75 ? '#525866' : '#3a3e4a';
      if ((x * 5 + y * 11) % 37 === 0) c = darken(c, 0.35);
      if (bayer(x, y) < 0.1) c = lighten(c, 0.15);
      p.set(x, y, c);
    }
    if (x % 29 === 0) p.line(x, FLOOR + 3, x + r.int(-3, 3), FLOOR + 11, '#2a2e38');
  }
  for (let x = 0; x < STAGE_W; x++) {
    const d = 3 + Math.round(Math.sin(x * 0.09) * 1.2 + Math.sin(x * 0.31));
    for (let k = -1; k < d; k++) p.set(x, FLOOR + k, k < 1 ? '#ffffff' : k < d - 1 ? '#e2eaf4' : '#b0c0d4');
    if (r.next() < 0.08) p.set(x, FLOOR - 2, '#f4f8fc');
  }
  // icicles of varying length dripping from the slab's underside
  for (let x = 2; x < STAGE_W; x += r.int(2, 6)) {
    const len = r.next() < 0.2 ? r.int(8, 16) : r.int(2, 6);
    for (let k = 0; k < len; k++) {
      const w = Math.max(0, Math.round((1 - k / len) * 1.6));
      for (let j = -w; j <= w; j++) p.set(x + j, FLOOR + 12 + k, j < 0 || k === 0 ? '#e8f8ff' : '#8ac0e0');
    }
  }
  // snow drifts heaped against the trees and post
  for (const x of [26, 190, LANTERN_X, 486]) p.ellipse(x, FLOOR - 1, r.int(10, 16), 3, '#f4f8fc');
  return p.canvas();
}

interface Flake { x: number; y: number; d: number; s: number }

export class BlizzardStage {
  name = 'THE HOWLING PASS';
  blurb = 'A MOUNTAIN LEDGE IN A WHITEOUT';
  song: SongName = 'blizzard';
  sky = sky();
  far = far();
  mid = mid();
  deck = deck();
  pit: HTMLCanvasElement;
  back: Flake[] = [];
  front: Flake[] = [];
  lastT = -1;
  lastCam = 0;
  /** Accumulated wind travel, for the streams of snow blown along the ground. */
  drift = 0;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
    const r = rng(577);
    for (let i = 0; i < 640; i++) this.back.push({ x: r.range(0, W), y: r.range(0, H), d: r.pick([0.3, 0.5, 0.75, 1]), s: r.range(0.7, 1.3) });
    for (let i = 0; i < 150; i++) this.front.push({ x: r.range(0, W), y: r.range(0, H), d: r.range(1.3, 1.9), s: r.range(0.7, 1.3) });
  }

  /** Looking down into the ice crevasse for the uppercut stage finish. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r: Rng = rng(589);
    p.gradRect(0, 0, W, H, '#5a88b0', '#0a1424', 9);
    // sheer blue ice walls with glassy streaks
    for (let y = 0; y < H; y++) {
      const L = 40 + Math.sin(y * 0.04) * 12 + Math.sin(y * 0.15) * 4, R = 38 + Math.sin(y * 0.05 + 1) * 14;
      for (let x = 0; x < L; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#4a7aa0' : x > L - 3 ? '#9ad0f0' : '#2e5476');
      for (let x = W - Math.floor(R); x < W; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#4a7aa0' : x < W - R + 3 ? '#9ad0f0' : '#2e5476');
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2, x = side ? W - r.int(8, 34) : r.int(8, 34), y = r.int(0, 200), len = r.int(10, 30);
      p.line(x, y, x + (side ? -2 : 2), y + len, '#c8ecff');
    }
    // a field of jagged ice spikes at the bottom
    for (let row = 0; row < 3; row++) {
      const baseY = 186 + row * 14, hgt = 34 + row * 6;
      for (let sx = -4 + row * 8; sx < W + 8; sx += 15 - row * 2) {
        const h = hgt + r.int(-8, 8), bend = r.range(-3, 3);
        const col = row === 2 ? '#a8d8f4' : row === 1 ? '#6aa0c8' : '#3a6890';
        p.poly([[sx - 5, baseY + 20], [sx + bend, baseY - h + 20], [sx + 5, baseY + 20]], col);
        p.line(sx + bend, baseY - h + 21, sx - 3, baseY + 18, '#eaf8ff');
      }
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // earlier victims, frosted over
    for (const [x, y, rot, flip] of [[64, 178, -95, 1], [194, 184, -75, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -120, ab: 40, lf: -40, kf: 60, h: 30 })));
      ctx.restore();
    }
    // a dusting of frost over them
    ctx.fillStyle = 'rgba(230,246,255,0.8)';
    for (let i = 0; i < 90; i++) ctx.fillRect(Math.round(r.range(36, 222)), Math.round(r.range(160, 196)), 1, 1);
    return cv;
  }

  /** Advance the snow once per frame (draw can be called from any scene). */
  step(camX: number, t: number) {
    const dt = this.lastT < 0 ? 1 : Math.max(0, Math.min(3, t - this.lastT));
    const dc = this.lastT < 0 ? 0 : camX - this.lastCam;
    this.lastT = t;
    this.lastCam = camX;
    if (dt === 0 && dc === 0) return;
    const g = gust(t);
    const vx = -(2 + g * 8), vy = 0.9 + (1 - g) * 0.5;
    this.drift += -vx * dt;
    const move = (f: Flake) => {
      f.x += (vx * f.d * f.s + Math.sin(t * 0.05 + f.y * 0.1) * 0.3) * dt - dc * f.d;
      f.y += vy * f.d * f.s * dt + Math.sin(t * 0.03 + f.x) * 0.2 * g;
      if (f.x < -6) f.x += W + 12;
      if (f.x > W + 6) f.x -= W + 12;
      if (f.y > H) (f.y -= H + 4), (f.x = Math.random() * (W + 12) - 6);
    };
    for (const f of this.back) move(f);
    for (const f of this.front) move(f);
  }

  /** A flake, stretched into a streak when the wind is screaming. */
  flake(ctx: CanvasRenderingContext2D, f: Flake, g: number, size: number) {
    const len = Math.round(g * 5 * f.d);
    const x = Math.round(f.x), y = Math.round(f.y);
    const sz = f.s > 1.15 ? size + 1 : size;
    ctx.fillRect(x, y, sz + len, sz);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.step(camX, t);
    const g = gust(t);
    ctx.drawImage(this.sky, 0, 0);
    ctx.drawImage(this.far, -Math.round(camX * 0.2), 0);
    ctx.fillStyle = 'rgba(220,230,240,0.55)';
    for (const f of this.back) if (f.d < 0.6) this.flake(ctx, f, g, 1);
    ctx.drawImage(this.mid, -Math.round(camX * 0.5), 0);
    // the hut window flickers warmly through the storm
    const hx = HUT_X - 7 - Math.round(camX * 0.5);
    const hy = 176 - HUT_X * 0.03 + Math.sin(HUT_X * 0.04) * 4 + Math.sin(HUT_X * 0.013) * 6 - 16;
    this.halo(ctx, hx, hy, 14, '255,200,110', 0.22 + 0.06 * Math.sin(t * 0.21) * Math.sin(t * 0.07));
    ctx.fillStyle = 'rgba(235,242,250,0.75)';
    for (const f of this.back) if (f.d >= 0.6) this.flake(ctx, f, g, 1);
    ctx.fillStyle = `rgba(200,212,228,${(0.08 + g * 0.22).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    this.lantern(ctx, LANTERN_X + dx, t, g);
  }

  halo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${rgb},${Math.max(0, a)})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
    ctx.globalCompositeOperation = 'source-over';
  }

  /** An iron lantern on a hook, swinging harder as the gusts build. */
  lantern(ctx: CanvasRenderingContext2D, px: number, t: number, g: number) {
    if (px < -40 || px > W + 40) return;
    const ang = Math.sin(t * 0.07) * (0.12 + g * 0.5) - g * 0.35;
    const hx = px + 11, hy = LANTERN_TOP + 2;
    const lx = hx + Math.sin(ang) * 12, ly = hy + Math.cos(ang) * 12;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, hy);
    ctx.lineTo(lx + 0.5, ly);
    ctx.stroke();
    const x = Math.round(lx), y = Math.round(ly);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(x - 3, y, 7, 2);
    ctx.fillRect(x - 3, y + 9, 7, 2);
    ctx.fillStyle = '#ffd070';
    ctx.fillRect(x - 2, y + 2, 5, 7);
    ctx.fillStyle = '#fff4c0';
    ctx.fillRect(x, y + 4, 1, 3);
    this.halo(ctx, x + 0.5, y + 5, 26, '255,190,90', 0.3 + 0.05 * Math.sin(t * 0.3));
  }

  /** Big near flakes, ground drifts and the whiteout veil, all in front of the fighters. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const g = gust(t);
    // snow streaming low along the ledge
    ctx.fillStyle = 'rgba(240,246,252,0.35)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 97 - this.drift * 1.3 - camX) % (W + 80) + W + 80) % (W + 80) - 40;
      const y = FLOOR - 2 - (i % 4) * 3 + Math.sin(t * 0.05 + i) * 1.5;
      ctx.fillRect(Math.round(x), Math.round(y), 20 + Math.round(g * 40), 2);
    }
    ctx.fillStyle = 'rgba(250,252,255,0.9)';
    for (const f of this.front) this.flake(ctx, f, g, 2);
    // whiteout: during the strongest gusts the storm nearly swallows the screen
    const w = Math.max(0, g - 0.55) / 0.45;
    if (w > 0) {
      ctx.fillStyle = `rgba(222,232,244,${(w * 0.42).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      // racing bands of blown snow
      ctx.fillStyle = `rgba(245,250,255,${(w * 0.3).toFixed(3)})`;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 131 - this.drift * 2.2) % (W + 160) + W + 160) % (W + 160) - 120;
        const y = (i * 37 + Math.sin(t * 0.02 + i) * 14) % H;
        ctx.fillRect(Math.round(x), Math.round(y), 120, 6 + (i % 3) * 4);
      }
    }
  }
}
