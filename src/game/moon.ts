import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng, Rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, darken, lighten, mix } from '../gfx/palette';
import type { SongName } from '../audio/music';
import { ridge } from './stage';

// "The Sea of Silence": a dusty crater floor on the moon with the Earth hanging overhead,
// an abandoned lander and a research dome. Gravity is about half normal, so jumps and
// juggles float. Every layer is painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.2);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.5);
const DOME_X = 392;
const DOME_LIGHTS: [number, number][] = [[DOME_X - 22, 164], [DOME_X - 8, 154], [DOME_X + 8, 154], [DOME_X + 22, 164]];
const LANDER_X = 118;

/** Lit-from-the-right planet Earth: oceans, noisy continents, cloud bands and an atmosphere rim. */
function earth(p: Painter, cx: number, cy: number, R: number, seed: number) {
  const r = rng(seed);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) blobs.push([r.range(-1, 1), r.range(-0.8, 0.8), r.range(0.18, 0.42)]);
  const clouds: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) clouds.push([r.range(-1, 1), r.range(-0.9, 0.9), r.range(0.1, 0.22)]);
  // atmosphere glow
  for (let y = -R - 6; y <= R + 6; y++)
    for (let x = -R - 6; x <= R + 6; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > R && d < R + 6 && ((R + 6 - d) / 6) * 0.6 > bayer(cx + x, cy + y)) p.set(cx + x, cy + y, mix(p.get(cx + x, cy + y), '#3a7ad8', 0.5));
    }
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const nx = x / R, ny = y / R;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      // fake sphere mapping so features squash toward the limb
      const z = Math.sqrt(1 - d2);
      const ux = nx / (0.6 + z * 0.4), uy = ny / (0.6 + z * 0.4);
      let land = 0;
      for (const [bx, by, br] of blobs) {
        const dx = (ux - bx) / br, dy = (uy - by) / (br * 0.7);
        land = Math.max(land, 1 - (dx * dx + dy * dy));
      }
      let c = land > 0.05 ? (Math.abs(ny) > 0.82 ? '#e8f0f8' : land > 0.5 ? '#6a7a3a' : '#3a7a3a') : land > -0.15 ? '#2a68b8' : '#1a4a98';
      let cl = 0;
      for (const [bx, by, br] of clouds) {
        const dx = (ux - bx) / (br * 2.2), dy = (uy - by) / br;
        cl = Math.max(cl, 1 - (dx * dx + dy * dy));
      }
      if (cl > 0 && cl * 1.4 > bayer(cx + x, cy + y)) c = '#f0f4fa';
      // terminator: sun from the right
      const light = nx * 0.85 - ny * 0.3 + z * 0.45;
      let col = mix(c, c, 0);
      if (light < 0.05) col = darken(c, light < -0.25 ? 0.92 : bayer(cx + x, cy + y) < 0.5 ? 0.85 : 0.6);
      else if (light > 0.85) col = lighten(c, 0.15);
      p.set(cx + x, cy + y, col);
    }
}

function stars(p: Painter, r: Rng, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    const x = r.int(0, w - 1), y = r.int(0, h - 1);
    const k = r.next();
    p.set(x, y, k < 0.12 ? '#ffffff' : k < 0.4 ? '#a8b0d0' : '#5a6080');
    if (k < 0.03) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, '#6a7098');
  }
}

/** Crater: dark bowl with a lit far rim and a shadowed near rim (sun from the right). */
function crater(p: Painter, cx: number, cy: number, rx: number, ry: number, base: string) {
  p.ellipse(cx, cy, rx + 1, ry + 1, lighten(base, 0.18), true);
  p.ellipse(cx, cy, rx, ry, darken(base, 0.35), true);
  p.ellipse(cx - rx * 0.25, cy + ry * 0.15, rx * 0.75, ry * 0.7, darken(base, 0.15), true);
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = (x - cx) / rx;
    const yy = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - t * t)));
    if (t < 0) p.over(x, yy, darken(base, 0.5));
  }
  p.over(Math.round(cx + rx), Math.round(cy), lighten(base, 0.35));
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(101);
  p.gradRect(0, 0, W, H, '#000004', '#0a0a1c', 6);
  stars(p, r, W, 150, 160);
  // a faint band of the galaxy
  for (let x = 0; x < W; x++)
    for (let y = 0; y < 150; y++) {
      const d = Math.abs(y - (20 + x * 0.35));
      if (d < 14 && (1 - d / 14) * 0.35 > bayer(x, y) && r.next() < 0.5) p.set(x, y, mix(p.get(x, y), '#3a3858', 0.6));
    }
  earth(p, 66, 50, 22, 5);
  return p.canvas();
}

function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(113);
  const h1 = ridge(r, FAR_W, 136, 22, 1.8);
  for (let x = 0; x < FAR_W; x++)
    for (let y = Math.floor(h1[x]); y < H; y++) {
      // sunlit slopes face right: lighter where the ridge descends to the right
      const slope = (h1[Math.min(FAR_W - 1, x + 1)] ?? h1[x]) - h1[x];
      const c = slope > 0.6 ? '#5a5a66' : slope < -0.6 ? '#2a2a34' : '#40404c';
      p.set(x, y, y - h1[x] < 6 ? c : '#34343e');
    }
  for (let x = 0; x < FAR_W; x++) p.set(x, Math.floor(h1[x]), '#7a7a88');
  for (let i = 0; i < 10; i++) crater(p, r.int(0, FAR_W), r.int(150, 172), r.int(4, 9), r.int(1, 2), '#34343e');
  return p.canvas();
}

function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(127);
  // a nearer crater wall
  const h2 = ridge(r, MID_W, 166, 12, 1.4);
  for (let x = 0; x < MID_W; x++)
    for (let y = Math.floor(h2[x]); y < H; y++) p.set(x, y, bayer(x, y) < 0.15 ? '#54545e' : '#4a4a54');
  for (let x = 0; x < MID_W; x++) {
    p.set(x, Math.floor(h2[x]), '#8a8a96');
    p.set(x, Math.floor(h2[x]) + 1, '#6a6a76');
  }
  for (let i = 0; i < 12; i++) crater(p, r.int(0, MID_W), r.int(176, 190), r.int(5, 12), r.int(1, 3), '#4a4a54');
  // radio dish on a tripod
  const dx = 250, dy = Math.floor(h2[250]);
  p.line(dx, dy, dx - 5, dy - 14, '#8a8a90');
  p.line(dx, dy, dx + 5, dy - 14, '#8a8a90');
  p.line(dx, dy - 14, dx, dy - 20, '#8a8a90');
  p.poly([[dx - 9, dy - 28], [dx + 7, dy - 18], [dx + 4, dy - 15], [dx - 10, dy - 24]], '#c8c8d0');
  p.line(dx - 9, dy - 28, dx + 7, dy - 18, '#f0f0f8');
  p.line(dx - 2, dy - 22, dx + 3, dy - 27, '#8a8a90');
  return p.canvas();
}

function ground(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(131);
  // research dome with a ribbed shell and an airlock
  p.ellipse(DOME_X, 174, 32, 24, '#a8acb8');
  for (let y = 174; y < FLOOR; y++) for (let x = DOME_X - 33; x <= DOME_X + 33; x++) p.set(x, y, '#000', 0);
  for (let y = 150; y < 174; y++)
    for (let x = DOME_X - 32; x <= DOME_X + 32; x++) if (p.alpha(x, y) && (x - DOME_X) % 9 === 0) p.set(x, y, '#80848e');
  p.rect(DOME_X - 34, 172, 68, 4, '#6a6e78');
  p.rect(DOME_X - 34, 176, 68, FLOOR - 176, '#585c66');
  p.rect(DOME_X - 6, 180, 12, FLOOR - 180, '#2a2c34');
  p.rect(DOME_X - 5, 181, 10, 3, '#4a8ac8');
  p.rect(DOME_X + 14, 184, 14, 6, '#2a2c34');
  p.rect(DOME_X + 15, 185, 12, 4, '#e0c060');
  // abandoned lander: gold-foil descent stage on splayed legs
  const lx = LANDER_X, ly = FLOOR;
  for (const s of [-1, 1]) {
    p.line(lx + s * 10, ly - 22, lx + s * 20, ly - 2, '#9a9aa2');
    p.line(lx + s * 8, ly - 14, lx + s * 20, ly - 2, '#7a7a82');
    p.rect(lx + s * 20 - 3, ly - 2, 7, 2, '#b0b0b8');
  }
  p.poly([[lx - 13, ly - 30], [lx + 13, ly - 30], [lx + 11, ly - 16], [lx - 11, ly - 16]], '#c89a30');
  for (let y = ly - 30; y < ly - 16; y++)
    for (let x = lx - 13; x <= lx + 13; x++) if (p.alpha(x, y) && bayer(x * 3, y * 5) < 0.25) p.set(x, y, '#e8c060');
  p.poly([[lx - 9, ly - 46], [lx + 7, ly - 46], [lx + 11, ly - 38], [lx + 9, ly - 30], [lx - 9, ly - 30], [lx - 11, ly - 38]], '#b8b8c0');
  p.rect(lx - 4, ly - 42, 5, 4, '#1a1a24');
  p.set(lx - 3, ly - 42, '#6a8ab8');
  p.line(lx + 4, ly - 46, lx + 8, ly - 54, '#9a9aa2');
  p.rect(lx + 6, ly - 56, 5, 2, '#c8c8d0');
  // a plain banner on a pole, stiff with no air to move it
  const fx = 196;
  p.rect(fx, FLOOR - 40, 1, 40, '#c8c8d0');
  p.rect(fx + 1, FLOOR - 40, 16, 1, '#c8c8d0');
  p.rect(fx + 1, FLOOR - 39, 16, 10, '#d84a30');
  p.ellipse(fx + 9, FLOOR - 34, 3, 3, '#f0e0a0');
  p.ellipse(fx + 10, FLOOR - 35, 2.5, 2.5, '#d84a30');
  p.shade(0.18, 1, -1);
  // dusty regolith floor
  for (let y = FLOOR; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const t = (y - FLOOR) / (H - FLOOR);
      const c = mix('#8a8a92', '#4a4a52', t);
      p.set(x, y, bayer(x, y) < 0.12 ? darken(c, 0.12) : bayer(x + 1, y + 2) > 0.94 ? lighten(c, 0.15) : c);
    }
  p.rect(0, FLOOR, STAGE_W, 1, '#b4b4bc');
  for (let i = 0; i < 26; i++) {
    const rx = r.int(4, 16);
    crater(p, r.int(0, STAGE_W), r.int(FLOOR + 5, H - 3), rx, Math.max(1, rx * 0.22), '#7a7a82');
  }
  // rocks and boot prints
  for (let i = 0; i < 40; i++) {
    const x = r.int(0, STAGE_W), y = r.int(FLOOR + 2, H - 2);
    p.rect(x, y, r.int(1, 3), 1, '#5a5a62');
    p.set(x + 1, y - 1, '#a8a8b0');
  }
  for (let x = 20; x < STAGE_W; x += r.int(12, 22)) {
    const y = FLOOR + 3 + ((x / 7) % 2 ? 2 : 0);
    p.rect(x, y, 3, 1, '#6a6a72');
    p.rect(x + 1, y + 1, 2, 1, '#6a6a72');
  }
  return p.canvas();
}

/** Deep space with a big Earth, used for the launch finish. */
function space(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(149);
  p.gradRect(0, 0, W, H, '#000002', '#04040e', 4);
  stars(p, r, W, H, 260);
  earth(p, 128, 92, 46, 5);
  return p.canvas();
}

export class MoonStage {
  name = 'SEA OF SILENCE';
  blurb = 'LOW GRAVITY  -  UPPERCUT THEM INTO ORBIT';
  song: SongName = 'moon';
  gravity = 0.19;
  pit = null;
  space = space();
  sky = sky();
  far = far();
  mid = mid();
  ground = ground();
  twinkle: [number, number][] = [];

  constructor() {
    const r = rng(157);
    for (let i = 0; i < 24; i++) this.twinkle.push([r.int(0, W - 1), r.int(0, 140)]);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    for (let i = 0; i < this.twinkle.length; i++) {
      const [x, y] = this.twinkle[i];
      const k = Math.sin(t * 0.05 + i * 2.3);
      if (k < 0.3) continue;
      ctx.fillStyle = k > 0.85 ? '#ffffff' : '#9098c0';
      ctx.fillRect(x, y, 1, 1);
      if (k > 0.92) {
        ctx.fillStyle = '#5a6088';
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    }
    // a satellite creeping across the sky
    const sx = ((t * 0.12) % (W + 40)) - 20, sy = 24 + Math.sin(t * 0.002) * 6;
    ctx.fillStyle = '#c8c8d0';
    ctx.fillRect(Math.round(sx), Math.round(sy), 2, 1);
    ctx.fillStyle = '#3a5a9a';
    ctx.fillRect(Math.round(sx) - 2, Math.round(sy), 2, 1);
    ctx.fillRect(Math.round(sx) + 2, Math.round(sy), 2, 1);
    if ((t >> 4) % 4 === 0) {
      ctx.fillStyle = '#ff4030';
      ctx.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 1);
    }
    ctx.drawImage(this.far, -Math.round(camX * 0.2), 0);
    ctx.drawImage(this.mid, -Math.round(camX * 0.5), 0);
    ctx.drawImage(this.ground, -Math.round(camX), 0);
    // blinking dome beacons and the lander's antenna light
    DOME_LIGHTS.forEach(([x, y], i) => {
      if (((t >> 5) + i) % 4 !== 0) return;
      ctx.fillStyle = 'rgba(255,200,80,0.18)';
      ctx.fillRect(x - Math.round(camX) - 2, y - 2, 5, 5);
      ctx.fillStyle = '#ffe080';
      ctx.fillRect(x - Math.round(camX), y, 1, 1);
    });
    if (t % 90 < 8) {
      ctx.fillStyle = '#40ff60';
      ctx.fillRect(LANDER_X + 8 - Math.round(camX), FLOOR - 57, 1, 1);
    }
  }

  /** Slow dust motes hanging in the thin air in front of the fighters. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.fillStyle = 'rgba(200,200,220,0.35)';
    for (let i = 0; i < 18; i++) {
      const x = ((i * 53 + t * 0.07 - camX * 1.1) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = FLOOR - 4 - ((i * 37 + t * 0.03 * (1 + (i % 3))) % 90);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}
