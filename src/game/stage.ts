import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { makeCanvas, Painter } from '../gfx/painter';
import { bayer, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { Arena } from './stages';

// "The Thorn Gorge": a rickety plank bridge strung between stone towers over a pit of spikes,
// under a blood moon. Every layer is painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
const TORCH_X = [36, 184, 328, 476];

export function ridge(r: ReturnType<typeof rng>, w: number, base: number, amp: number, rough: number): number[] {
  // midpoint displacement ridgeline
  let n = 1;
  while (n < w) n *= 2;
  const h = new Array(n + 1).fill(0);
  h[0] = base + r.range(-amp, amp);
  h[n] = base + r.range(-amp, amp);
  for (let step = n; step > 1; step /= 2) {
    for (let i = 0; i < n; i += step) {
      const m = i + step / 2;
      h[m] = (h[i] + h[i + step]) / 2 + r.range(-1, 1) * amp * (step / n) * rough;
    }
  }
  return h.slice(0, w);
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(7);
  const stops = ['#07030f', '#1a0820', '#3a0c22', '#62161c', '#8a2a18'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / 165) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) {
      const c = f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i];
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = r.int(0, W - 1), y = r.int(0, 110);
    p.set(x, y, r.next() < 0.2 ? '#fff' : '#8a7a9a');
  }
  // blood moon with halo
  const mx = 188, my = 52;
  for (let y = -40; y <= 40; y++)
    for (let x = -40; x <= 40; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 22 && d < 38 && (38 - d) / 16 * 0.55 > bayer(mx + x, my + y)) p.set(mx + x, my + y, mix(p.get(mx + x, my + y), '#c03020', 0.35));
    }
  p.ellipse(mx, my, 21, 21, '#d84a30');
  p.ellipse(mx - 4, my - 4, 15, 15, '#e86a40');
  p.ellipse(mx - 6, my - 7, 7, 6, '#f08a58');
  for (const [cx, cy, cr] of [[mx + 6, my - 6, 4], [mx - 7, my + 6, 5], [mx + 9, my + 9, 3], [mx - 2, my - 12, 2.5]])
    p.ellipse(cx, cy, cr, cr, '#b83a26');
  // thin clouds over the moon
  for (const [cy, x0, x1] of [[48, 150, 236], [60, 166, 250], [44, 120, 190]])
    for (let x = x0; x < x1; x++) for (let k = 0; k < 2; k++) if (bayer(x, cy + k) < 0.75) p.set(x, cy + k, '#2a0c1c');
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(11);
  const h1 = ridge(r, FAR_W, 112, 28, 1.6);
  for (let x = 0; x < FAR_W; x++) for (let y = Math.floor(h1[x]); y < H; y++) p.set(x, y, '#2a0e22');
  // ruined spires on the far ridge
  for (const sx of [40, 150, 230, 300]) {
    const top = h1[Math.min(FAR_W - 1, sx)] - r.int(20, 34);
    p.poly([[sx - 4, h1[sx] + 2], [sx - 3, top + 6], [sx, top], [sx + 3, top + 6], [sx + 4, h1[sx] + 2]], '#22091c');
    p.set(sx, top + 10, '#e8a040');
  }
  const h2 = ridge(r, FAR_W, 140, 18, 1.4);
  for (let x = 0; x < FAR_W; x++) for (let y = Math.floor(h2[x]); y < H; y++) p.set(x, y, '#1a0816');
  // moonlit rims
  for (let x = 1; x < FAR_W; x++) {
    p.set(x, Math.floor(h1[x]), '#5a1c2c');
    p.set(x, Math.floor(h2[x]), '#3a1224');
  }
  return p.canvas();
}

function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(23);
  // gorge cliffs and rock pinnacles rising from the dark
  for (let i = 0; i < 14; i++) {
    const cx = r.int(0, MID_W), w = r.int(10, 26), top = r.int(110, 160);
    const pts = [[cx - w, H], [cx - w * 0.6, top + 20], [cx - w * 0.25, top + 4], [cx, top], [cx + w * 0.3, top + 8], [cx + w * 0.7, top + 24], [cx + w, H]];
    p.poly(pts, '#120610');
    for (let y = top; y < H; y++)
      for (let x = cx - w; x < cx + w; x++) {
        if (!p.alpha(x, y)) continue;
        if (x < cx - w * 0.2 && bayer(x, y) < 0.3) p.set(x, y, '#2a0e1c');
      }
  }
  // fog band
  for (let y = 150; y < 200; y++)
    for (let x = 0; x < MID_W; x++) {
      const k = 1 - Math.abs(y - 175) / 25;
      if (k * 0.55 > bayer(x, y)) p.set(x, y, mix(p.alpha(x, y) ? p.get(x, y) : [40, 14, 30], '#4a1a2c', 0.6));
    }
  // hanging chains with cages
  for (const cx of [60, 210, 330]) {
    const len = r.int(40, 90);
    for (let y = 0; y < len; y++) if (y % 3 !== 2) p.set(cx, y, '#3a3036');
    p.rect(cx - 5, len, 11, 16, '#2a2028');
    for (let x = cx - 5; x <= cx + 5; x += 2) p.line(x, len, x, len + 15, '#4a4048');
    p.rect(cx - 6, len, 13, 1, '#5a5058');
    p.rect(cx - 6, len + 15, 13, 1, '#5a5058');
    p.ellipse(cx, len + 7, 2, 2, '#c8bca0'); // a skull in the cage
  }
  return p.canvas();
}

function bridge(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(31);
  // abyss under the bridge with spike tips catching moonlight
  p.rect(0, FLOOR + 10, STAGE_W, H - FLOOR - 10, '#06020a');
  for (let x = 0; x < STAGE_W; x += r.int(5, 9)) {
    const hgt = r.int(5, 12);
    p.poly([[x - 2.5, H], [x, H - hgt], [x + 2.5, H]], '#2a2430');
    p.set(x, H - hgt, '#b0a8b8');
    p.set(x, H - hgt + 1, '#6a6070');
  }
  // towers with torch sconces behind the fighters
  for (const tx of TORCH_X) {
    p.rect(tx - 9, 128, 18, FLOOR - 128, '#3a3440');
    for (let y = 128; y < FLOOR; y += 6)
      for (let x = tx - 9; x < tx + 9; x += 9) p.rect(x + ((y / 6) % 2 ? 4 : 0), y, 1, 6, '#26222c');
    for (let y = 134; y < FLOOR; y += 6) p.rect(tx - 9, y, 18, 1, '#26222c');
    p.rect(tx - 11, 124, 22, 5, '#4a4452');
    p.poly([[tx - 11, 124], [tx - 7, 116], [tx + 7, 116], [tx + 11, 124]], '#4a4452');
    p.rect(tx - 2, 146, 5, 6, '#2a1a10'); // sconce
    p.rect(tx - 3, 145, 7, 2, '#5a4030');
  }
  p.shade(0.15);
  // rope and chain railing between towers
  for (let i = 0; i < TORCH_X.length - 1; i++) {
    const a = TORCH_X[i] + 9, b = TORCH_X[i + 1] - 9;
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      const sag = Math.sin(t * Math.PI) * 10;
      p.set(x, Math.round(160 + sag), '#6a4a2a');
      p.set(x, Math.round(161 + sag), '#3a2814');
      if (x % 3 === 0) p.set(x, Math.round(176 + sag * 0.8), '#5a5060');
    }
  }
  // plank deck
  let x = 0;
  while (x < STAGE_W) {
    const w = r.int(7, 11);
    const base = r.pick(['#5e3c22', '#6a4428', '#553620', '#634026']);
    p.rect(x, FLOOR, w, 7, base);
    p.rect(x, FLOOR, w, 1, lighten(base, 0.25));
    p.rect(x, FLOOR + 6, w, 1, darken(base, 0.45));
    p.rect(x + w - 1, FLOOR, 1, 7, darken(base, 0.55));
    p.set(x + 2, FLOOR + 3, '#2a1a10');
    p.set(x + w - 3, FLOOR + 3, '#2a1a10');
    if (r.next() < 0.25) p.rect(x + r.int(1, 4), FLOOR + r.int(2, 4), 2, 1, darken(base, 0.3));
    x += w;
  }
  // support beams under the deck
  p.rect(0, FLOOR + 7, STAGE_W, 3, '#2a1a12');
  for (let bx = 0; bx < STAGE_W; bx += 32) {
    p.line(bx, FLOOR + 10, bx + 16, FLOOR + 22, '#22140c');
    p.line(bx + 32, FLOOR + 10, bx + 16, FLOOR + 22, '#22140c');
  }
  return p.canvas();
}

export class Stage implements Arena {
  name = 'THE THORN GORGE';
  blurb = 'UPPERCUT THEM INTO THE SPIKES';
  song = 'fight' as const;
  sky = sky();
  far = far();
  mid = mid();
  bridge = bridge();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(77);
    p.gradRect(0, 0, W, H, '#1a0814', '#050208', 8);
    // shaft walls
    const L = ridge(r, H, 34, 14, 2), R = ridge(r, H, 34, 14, 2);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < L[y]; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#2c1220' : '#1c0a16');
      for (let x = W - Math.floor(R[y]); x < W; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#2c1220' : '#1c0a16');
    }
    // light shafts from the gorge mouth
    for (let y = 0; y < 170; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - 110 - y * 0.25);
        if (d < 18 && (1 - d / 18) * 0.25 * (1 - y / 170) > bayer(x, y)) p.set(x, y, mix(p.get(x, y), '#a04030', 0.4));
      }
    // spike field
    for (let row = 0; row < 3; row++) {
      const baseY = 186 + row * 14, hgt = 34 + row * 6;
      for (let sx = -4 + row * 7; sx < W + 8; sx += 15 - row * 2) {
        const h = hgt + r.int(-6, 6);
        const col = row === 2 ? '#7a7280' : row === 1 ? '#5a5462' : '#3e3a46';
        p.poly([[sx - 4, baseY + 20], [sx, baseY - h + 20], [sx + 4, baseY + 20]], col);
        p.line(sx, baseY - h + 21, sx - 2, baseY + 18, lighten(col, 0.3));
        if (r.next() < 0.45) for (let k = 0; k < 6; k++) p.set(sx + r.int(-1, 1), baseY - h + 21 + k + r.int(0, 3), k < 3 ? '#a01010' : '#600808');
      }
    }
    const cv = p.canvas();
    // old skeletons left impaled on the spikes
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[52, 172, -100, 1], [196, 178, -70, -1], [130, 190, 160, 1]]) {
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
    ctx.drawImage(this.mid, -Math.round(camX * 0.55), 0);
    ctx.drawImage(this.bridge, -Math.round(camX), 0);
    // flickering torch flames with glow
    for (const tx of TORCH_X) {
      const sx = tx - Math.round(camX);
      if (sx < -30 || sx > W + 30) continue;
      const fl = Math.sin(t * 0.3 + tx) * 1.5 + Math.sin(t * 0.71 + tx * 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,110,30,0.07)';
      for (const rr of [26, 18, 11]) ctx.fillRect(sx - rr, 140 - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
      const h = 9 + fl;
      ctx.fillStyle = '#c02808';
      ctx.fillRect(sx - 3, 145 - h * 0.7, 7, h * 0.7);
      ctx.fillStyle = '#ff8a18';
      ctx.fillRect(sx - 2, 145 - h, 5, h * 0.8);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(sx - 1, 145 - h * 0.6, 3, h * 0.45);
      ctx.fillRect(sx + Math.round(fl * 0.5), 145 - h - 1, 1, 2);
    }
  }

  /** Foreground mist drifting in front of the fighters. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.fillStyle = 'rgba(90,30,50,0.10)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 97 + t * 0.2 - camX * 1.2) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.fillRect(Math.round(x), FLOOR + 2 - (i % 3) * 3, 60, 6);
    }
  }
}
