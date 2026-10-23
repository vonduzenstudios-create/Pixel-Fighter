import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rand, rng, Rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../gfx/palette';
import type { SongName } from '../audio/music';
import type { Particles } from './particles';

// "Buttercup Hills": a bright midday meadow of rolling green hills, palm groves and
// waterfalls spilling off grassy bluffs into a sparkling lake. The fighters scrap on a
// grassy ridge, and the uppercut finish knocks the loser off the edge into the rocky
// gorge at the foot of the falls. Every layer is painted procedurally at load time.

const HZ = 118;
const FAR_P = 0.15, MID_P = 0.5;
const FAR_W = W + Math.ceil((STAGE_W - W) * FAR_P);
const MID_W = W + Math.ceil((STAGE_W - W) * MID_P);

/** A waterfall column painted into a layer; the falling streaks are animated on top each frame. */
interface Fall { x: number; top: number; bot: number; w: number; par: number }

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ painting helpers

/**
 * A grassy hill range. top(x) gives the ridge line; the grass is lit along the ridge, darkens
 * with depth and has soft sweeping light bands, like wind combing through the meadow.
 */
function meadow(p: Painter, x0: number, x1: number, top: (x: number) => number, base: Color, bottom: number, seed: number) {
  const r = rng(seed);
  for (let x = x0; x < x1; x++) {
    const ty = Math.floor(top(x));
    const sweep = Math.sin(x * 0.045 + seed) * 0.5 + Math.sin(x * 0.013 + seed * 2) * 0.5;
    for (let y = ty; y < bottom; y++) {
      const d = y - ty;
      let c: Color = base;
      if (d < 2) c = lighten(base, 0.35);
      else if (d < 5) c = bayer(x, y) < 0.5 ? lighten(base, 0.2) : base;
      else {
        const k = Math.min(1, (d - 5) / 40);
        c = darken(base, k * 0.22);
        if (sweep > 0.35 && bayer(x, y) < (sweep - 0.35) * 0.9) c = lighten(c, 0.12);
        else if (sweep < -0.4 && bayer(x, y) < 0.35) c = darken(c, 0.1);
      }
      p.set(x, y, c);
    }
    // tufts poking above the ridge, and a scatter of flowers
    if (r.next() < 0.3) p.set(x, ty - 1, lighten(base, 0.3));
    if (r.next() < 0.05) {
      const fy = ty + r.int(4, Math.max(5, bottom - ty - 2));
      p.set(x, fy, r.pick(['#ffffff', '#ffe040', '#ff8ab8', '#b8a0ff']));
    }
  }
}

/** A tall curving palm: a ringed trunk and a crown of arching, drooping fronds. */
function palm(p: Painter, x: number, base: number, h: number, bend: number, r: Rng, s = 1) {
  let tx = x, ty = base;
  for (let i = 0; i <= h; i++) {
    const k = i / h;
    tx = x + Math.sin(k * Math.PI * 0.6) * bend;
    ty = base - i;
    const w = (2.6 - k * 1.1) * s;
    for (let dx = -w; dx <= w; dx++) {
      const edge = dx < -w + 1 ? '#6a4626' : dx > w - 1 ? '#c89a5a' : '#a07440';
      p.set(Math.round(tx + dx), ty, i % 5 === 0 || i % 5 === 1 ? darken(edge, 0.18) : edge);
    }
  }
  const fronds = 9;
  for (let f = 0; f < fronds; f++) {
    const a = -Math.PI * 1.05 + (f / (fronds - 1)) * Math.PI * 1.1 + r.range(-0.1, 0.1);
    const len = r.range(18, 26) * s;
    for (let i = 0; i <= len; i++) {
      const k = i / len;
      const fx = tx + Math.cos(a) * i, fy = ty + Math.sin(a) * i * 0.6 + k * k * 14 * s;
      p.set(Math.round(fx), Math.round(fy), '#1e7a2c');
      p.set(Math.round(fx), Math.round(fy) - 1, '#58c048');
      // leaflets hanging off the rib
      if (i > 2 && i % 2 === 0)
        for (let l = 1; l < (5 - k * 3) * s; l++) {
          p.set(Math.round(fx - Math.cos(a) * l * 0.2), Math.round(fy) + l, l < 2 ? '#3aa83a' : '#24862e');
        }
    }
  }
  p.ellipse(tx - 2, ty + 2, 1.7 * s, 1.7 * s, '#7a5220');
  p.ellipse(tx + 2, ty + 3, 1.7 * s, 1.7 * s, '#6a4418');
}

/** A rounded bush of leaves with a lit top. */
function bush(p: Painter, cx: number, base: number, rx: number, r: Rng, col: Color = '#2e9a3a') {
  for (let i = 0; i < 5; i++) {
    const bx = cx + (i - 2) * rx * 0.4 + r.range(-1, 1), by = base - rx * 0.4 - Math.sin((i / 4) * Math.PI) * rx * 0.35, br = rx * r.range(0.4, 0.55);
    for (let y = Math.floor(by - br); y <= base; y++)
      for (let x = Math.floor(bx - br); x <= bx + br; x++) {
        const dx = (x + 0.5 - bx) / br, dy = (y + 0.5 - by) / br;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx * 0.4 - dy * 0.8;
        p.set(x, y, l > 0.5 ? lighten(col, 0.3) : l < -0.3 && bayer(x, y) < 0.5 ? darken(col, 0.25) : col);
      }
  }
}

/** A grassy-topped bluff of layered sandstone with a waterfall pouring off its lip. */
function bluff(p: Painter, x0: number, x1: number, top: number, bottom: number, grass: Color, rock: Color, falls: Fall[], fallX: number, fallW: number, par: number) {
  for (let x = x0; x <= x1; x++) {
    const edge = Math.min(x - x0, x1 - x);
    const ty = top + (edge < 6 ? 6 - edge : 0) + Math.round(Math.sin(x * 0.3) * 0.6);
    for (let y = ty; y < bottom; y++) {
      const band = Math.floor((y - top + Math.sin(x * 0.08) * 2) / 5);
      let c: Color = band % 2 ? rock : lighten(rock, 0.1);
      if (x - x0 < 3) c = lighten(c, 0.15);
      else if (x1 - x < 4) c = darken(c, 0.2);
      if (bayer(x, y) < 0.08) c = darken(c, 0.15);
      p.set(x, y, c);
    }
    // the grass cap droops over the edge in little points
    const drip = 3 + Math.round(hash(x * 0.7) * 3);
    for (let y = ty - 1; y < ty + drip; y++) p.set(x, y, y === ty - 1 ? lighten(grass, 0.35) : y < ty + 2 ? grass : darken(grass, 0.2));
  }
  // the waterfall column: pale core, deeper blue edges
  for (let y = top + 2; y < bottom; y++)
    for (let x = fallX; x < fallX + fallW; x++) {
      const e = Math.min(x - fallX, fallX + fallW - 1 - x);
      p.set(x, y, e === 0 ? '#5ab0e8' : e === 1 ? '#8ad0f4' : '#c8ecfc');
    }
  falls.push({ x: fallX, top: top + 2, bot: bottom, w: fallW, par });
}

// ------------------------------------------------------------------ layers

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops = ['#1e5ae0', '#2a76ec', '#4a94f4', '#74b4f8', '#a8d4fa', '#dcf0fc'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / HZ) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // high noon sun with a soft dithered halo
  const sx = 52, sy = 30;
  for (let y = -30; y <= 30; y++)
    for (let x = -30; x <= 30; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= 10) p.set(sx + x, sy + y, d < 8 ? '#fffff4' : '#fffac0');
      else if (d < 30 && ((30 - d) / 20) * 0.5 > bayer(sx + x, sy + y)) p.set(sx + x, sy + y, mix(p.get(sx + x, sy + y), '#fff8d0', 0.4));
    }
  return p.canvas();
}

/** Puffy white clouds on a wrap-around strip that drifts overhead. */
function clouds(): HTMLCanvasElement {
  const CW = W * 2;
  const p = new Painter(CW, 90);
  const r = rng(1201);
  for (let c = 0; c < 8; c++) {
    const cx = c * (CW / 8) + r.int(0, 24), cy = r.int(20, 76), sc = r.range(0.5, 1.15);
    for (let k = 0; k < 7; k++) {
      const px = cx + (k - 3) * 8 * sc + r.range(-2, 2), py = cy - Math.sin((k / 6) * Math.PI) * 9 * sc, pr = r.range(5, 10) * sc;
      for (let y = Math.floor(py - pr); y <= py + pr; y++)
        for (let x = Math.floor(px - pr); x <= px + pr; x++) {
          if (y > cy + 3 * sc) continue;
          const dx = x - px, dy = y - py;
          if (dx * dx + dy * dy > pr * pr) continue;
          const xx = ((x % CW) + CW) % CW;
          const lit = -dx * 0.3 - dy * 0.8;
          p.set(xx, y, y > cy + 1 ? '#d4e4f4' : lit > pr * 0.45 ? '#ffffff' : lit < -pr * 0.3 && bayer(xx, y) < 0.5 ? '#dce8f6' : '#f4f8fc');
        }
    }
  }
  return p.canvas();
}

function far(falls: Fall[]): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1213);
  // a sparkling lake along the horizon
  for (let y = HZ; y < H; y++)
    for (let x = 0; x < FAR_W; x++) {
      let c: Color = mix('#4aa0e8', '#2a7ad0', Math.min(1, (y - HZ) / 30));
      if (Math.sin(x * 0.4 + y * 2.3) + Math.sin(x * 0.07 + y) > 1.6) c = '#d8f4ff';
      p.set(x, y, c);
    }
  // hazy blue-green hills far away
  meadow(p, 0, FAR_W, (x) => 104 + Math.sin(x * 0.025) * 8 + Math.sin(x * 0.061 + 2) * 4, '#6ab890', HZ + 8, 1);
  // two flat-topped bluffs, each with a slender waterfall
  bluff(p, 40, 86, 74, HZ + 4, '#6ac080', '#c8a888', falls, 58, 5, FAR_P);
  bluff(p, 222, 262, 82, HZ + 4, '#6ac080', '#c8a888', falls, 236, 4, FAR_P);
  // nearer, greener hill band
  meadow(p, 0, FAR_W, (x) => 120 + Math.sin(x * 0.04 + 1) * 6 + Math.sin(x * 0.11) * 2, '#58b860', 150, 3);
  for (let i = 0; i < 14; i++) {
    const x = r.int(0, FAR_W);
    bush(p, x, 124 + Math.round(Math.sin(x * 0.04 + 1) * 6), r.int(3, 5), r, '#3a9a50');
  }
  // haze so the far layer sits back in the bright air
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.3) p.set(x, y, mix(p.get(x, y), '#bfe2f4', 0.35));
  return p.canvas();
}

function mid(falls: Fall[]): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1229);
  // a tall bluff on the right with the big falls dropping into a pool
  bluff(p, 236, 300, 62, 168, '#48b848', '#c09068', falls, 254, 12, MID_P);
  // the pool, with a foam rim at the base of the falls
  for (let y = 160; y < 172; y++)
    for (let x = 214; x < 332; x++) {
      const dx = (x - 270) / 58, dy = (y - 166) / 6;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, Math.sin(x * 0.5 + y * 2) > 0.8 ? '#c8f0ff' : y < 163 ? '#4aa8e8' : '#3a90d8');
    }
  // rolling hills in front of everything, in two shades of green
  meadow(p, 0, MID_W, (x) => 140 + Math.sin(x * 0.022) * 14 + Math.sin(x * 0.05 + 1) * 5, '#46b040', H, 7);
  // carve the pool back out of the front hill so the falls land in it
  for (let y = 150; y < 172; y++)
    for (let x = 222; x < 324; x++) {
      const dx = (x - 270) / 50, dy = (y - 170) / 14;
      if (dx * dx + dy * dy <= 1 && y >= 160) p.set(x, y, Math.sin(x * 0.5 + y * 2) > 0.8 ? '#c8f0ff' : '#3a94da');
    }
  meadow(p, 0, MID_W, (x) => 172 + Math.sin(x * 0.03 + 2) * 6 + Math.sin(x * 0.09) * 2, '#3aa038', H, 9);
  // palm groves on the crests
  for (const [x, h, b] of [[24, 46, 6], [44, 38, -5], [140, 52, 8], [196, 40, -6], [356, 50, 7], [378, 36, -4]]) {
    const base = Math.round(140 + Math.sin(x * 0.022) * 14 + Math.sin(x * 0.05 + 1) * 5) + 2;
    palm(p, x, base, h, b, r, 0.9);
  }
  for (let i = 0; i < 10; i++) {
    const x = r.int(0, MID_W);
    bush(p, x, Math.round(172 + Math.sin(x * 0.03 + 2) * 6) + 3, r.int(5, 8), r);
  }
  return p.canvas();
}

const NEAR_PALMS: [number, number, number][] = [[16, 120, 14], [210, 104, -12], [470, 126, -16]];

function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1237);
  for (const [x, h, b] of NEAR_PALMS) palm(p, x, FLOOR + 2, h, b, r, 1.35);
  // boulders and bushes along the back edge of the ridge
  for (const x of [96, 330, 400]) {
    const rx = r.int(8, 12), ry = rx * 0.7;
    for (let y = Math.floor(FLOOR - ry * 1.6); y <= FLOOR; y++)
      for (let xx = Math.floor(x - rx); xx <= x + rx; xx++) {
        const dx = (xx + 0.5 - x) / rx, dy = (y + 0.5 - (FLOOR - ry * 0.6)) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const l = -dx * 0.5 - dy * 0.7;
        p.set(xx, y, l > 0.45 ? '#e0d4bc' : l < -0.25 ? (bayer(xx, y) < 0.5 ? '#8a7a68' : '#9a8a74') : '#bcae96');
      }
  }
  for (const x of [60, 150, 270, 360, 440]) bush(p, x, FLOOR + 1, r.int(9, 13), r);
  // the ridge: thick grass on top of warm layered earth with pebbles and roots
  for (let x = 0; x < STAGE_W; x++) {
    const lip = FLOOR + 3 + Math.round(Math.sin(x * 0.2) * 1 + hash(x) * 2);
    for (let y = FLOOR; y < H; y++) {
      let c: Color;
      if (y < lip - 1) c = y === FLOOR ? '#9ae868' : y < FLOOR + 2 ? '#6ad048' : '#48b03a';
      else if (y < lip + 1) c = '#2a7a2a';
      else {
        // soft horizontal strata that wave gently, darkening toward the bottom
        const band = Math.floor((y - FLOOR + Math.sin(x * 0.05) * 2.5) / 6);
        c = ['#b06a34', '#9a5a2c', '#a8642e', '#8a4e26'][band % 4];
        c = darken(c, (y - FLOOR) / 80);
        if (bayer(x, y) < 0.1) c = lighten(c, 0.12);
      }
      p.set(x, y, c);
    }
  }
  // pebbles and dangling roots in the earth
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, STAGE_W), y = r.int(FLOOR + 8, H - 2);
    p.ellipse(x, y, r.range(1, 2.2), r.range(0.8, 1.4), r.pick(['#d8c8a8', '#c0a888', '#e8dcc4']));
    p.set(x - 1, y - 1, '#f4ecdc');
  }
  for (let i = 0; i < 26; i++) {
    let x = r.int(0, STAGE_W), y = FLOOR + 5;
    const len = r.int(4, 12);
    for (let k = 0; k < len; k++) {
      p.set(x, y, '#5a3a1a');
      y++;
      if (r.next() < 0.4) x += r.pick([-1, 1]);
    }
  }
  // grass blades and flowers standing on the ridge
  for (let x = 0; x < STAGE_W; x++) {
    if (r.next() < 0.45) p.set(x, FLOOR - 1, '#7ad858');
    if (r.next() < 0.18) p.set(x, FLOOR - 2, '#58c040');
    if (r.next() < 0.03) {
      const col = r.pick(['#ffffff', '#ffe040', '#ff6aa0', '#a890ff']);
      p.set(x, FLOOR - 4, col);
      p.set(x - 1, FLOOR - 4, col);
      p.set(x + 1, FLOOR - 4, col);
      p.set(x, FLOOR - 5, col);
      p.set(x, FLOOR - 3, '#ffd030');
      p.set(x, FLOOR - 2, '#3a9a30');
    }
  }
  return p.canvas();
}

/** The uppercut finish: down the cliff into the rocky gorge where the falls hit the river. */
function gorge(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1249);
  p.gradRect(0, 0, W, H, '#6ab4f0', '#2a6aa8', 8);
  // sheer gorge walls with grass rims, closing in toward the bottom
  for (let y = 0; y < H; y++) {
    const L = 40 + y * 0.18 + Math.sin(y * 0.06) * 8 + Math.sin(y * 0.21) * 3;
    const R = 46 + y * 0.16 + Math.sin(y * 0.05 + 2) * 9;
    for (let x = 0; x < W; x++) {
      if (x >= L && x < W - R) continue;
      const band = Math.floor((y + Math.sin(x * 0.1) * 3) / 7) % 2;
      let c: Color = band ? '#a8784e' : '#b88858';
      const e = x < L ? L - x : x - (W - R);
      if (e < 3) c = x < L ? darken(c, 0.25) : lighten(c, 0.12);
      if (bayer(x, y) < 0.1) c = darken(c, 0.15);
      p.set(x, y, c);
    }
  }
  for (let x = 0; x < W; x++) if (x < 44 || x > W - 48) for (let y = 0; y < 4 + hash(x) * 3; y++) p.set(x, y, y < 1 ? '#9ae868' : '#48b03a');
  // ferns clinging to the walls
  for (let i = 0; i < 12; i++) {
    const side = i % 2, y = r.int(20, 150), x = side ? W - 50 - y * 0.16 : 42 + y * 0.18;
    for (let k = 0; k < 5; k++) p.line(x, y, x + (side ? -1 : 1) * r.int(4, 9), y - 4 + k * 2, '#3a9a3a');
  }
  // the falls pouring down the back of the gorge
  for (let y = 0; y < 190; y++)
    for (let x = 104; x < 152; x++) {
      const e = Math.min(x - 104, 151 - x);
      let c: Color = e < 2 ? '#6ab8ec' : '#cceefc';
      if (hash(x * 3.1) < 0.35 && ((y + x * 7) % 23) < 12) c = '#ffffff';
      p.set(x, y, c);
    }
  // churning river and white water along the bottom
  for (let y = 182; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c: Color = y < 190 ? '#ffffff' : '#3a8ad0';
      if (y >= 190 && Math.sin(x * 0.35 + y * 1.9) > 0.6) c = '#a8dcf8';
      p.set(x, y, c);
    }
  // jagged rocks jutting out of the water; the centre one catches the falling loser
  const rocksAt: [number, number, number][] = [[20, 40, 12], [58, 52, 10], [92, 34, 9], [128, 58, 11], [168, 36, 9], [200, 50, 12], [238, 42, 11]];
  for (const [x, h, w] of rocksAt) {
    const lean = r.range(-3, 3);
    p.poly([[x - w, 200], [x - w * 0.3, 200 - h * 0.6], [x + lean, 200 - h], [x + w * 0.4, 200 - h * 0.5], [x + w, 200]], '#7a7068');
    p.poly([[x - w, 200], [x - w * 0.3, 200 - h * 0.6], [x + lean, 200 - h], [x - 1, 200]], '#9a9084');
    p.line(x + lean, 200 - h, x - w * 0.3, 200 - h * 0.6, '#c8beb0');
    for (let xx = x - w; xx <= x + w; xx++) if (hash(xx * 1.3) < 0.7) p.set(xx, 200, '#ffffff');
  }
  return p.canvas();
}

export class HillsStage {
  name = 'BUTTERCUP HILLS';
  blurb = 'ROLLING HILLS, PALMS AND WATERFALLS';
  song: SongName = 'hills';
  stakeColor = '#9a9084';
  falls: Fall[] = [];
  sky = sky();
  clouds = clouds();
  far = far(this.falls);
  mid = mid(this.falls);
  deck = deck();
  pit = gorge();

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    const cw = this.clouds.width, cx = -Math.round((t * 0.08 + camX * 0.06) % cw);
    ctx.drawImage(this.clouds, cx, 0);
    ctx.drawImage(this.clouds, cx + cw, 0);
    const fx = -Math.round(camX * FAR_P);
    ctx.drawImage(this.far, fx, 0);
    this.animateFalls(ctx, camX, t, FAR_P);
    // a pair of gulls gliding across the far hills
    for (let i = 0; i < 3; i++) {
      const x = ((t * (0.25 + i * 0.07) + i * 120) % (W + 40)) - 20, y = 50 + i * 14 + Math.sin(t * 0.03 + i) * 4;
      const up = Math.sin(t * 0.15 + i * 2) > 0;
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - (up ? 1 : 0), 2, 1);
      ctx.fillRect(Math.round(x) + 1, Math.round(y) - (up ? 1 : 0), 2, 1);
    }
    ctx.drawImage(this.mid, -Math.round(camX * MID_P), 0);
    this.animateFalls(ctx, camX, t, MID_P);
    // a faint rainbow in the spray at the foot of the big falls
    const rx = 270 - Math.round(camX * MID_P);
    if (rx > -60 && rx < W + 60) {
      const cols = ['rgba(255,80,80,0.18)', 'rgba(255,190,60,0.18)', 'rgba(255,255,90,0.16)', 'rgba(80,220,90,0.16)', 'rgba(80,140,255,0.16)', 'rgba(150,90,230,0.14)'];
      ctx.lineWidth = 1;
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(rx, 172, 40 - i, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      });
    }
    ctx.drawImage(this.deck, -Math.round(camX), 0);
  }

  /** Falling streaks of white water and churning foam on every waterfall in a layer. */
  animateFalls(ctx: CanvasRenderingContext2D, camX: number, t: number, par: number) {
    for (const f of this.falls) {
      if (f.par !== par) continue;
      const sx = f.x - Math.round(camX * par);
      if (sx + f.w < 0 || sx > W) continue;
      ctx.fillStyle = '#ffffff';
      for (let c = 1; c < f.w - 1; c++) {
        const speed = 1.6 + hash(c + f.x) * 0.8, len = 4 + Math.floor(hash(c * 2.7 + f.x) * 6);
        const span = f.bot - f.top;
        for (let k = 0; k < 2; k++) {
          const y = f.top + ((t * speed + hash(c * 5.3 + k) * span) % span);
          ctx.fillRect(sx + c, Math.round(y), 1, Math.min(len, f.bot - y));
        }
      }
      // foam boiling where it lands
      for (let i = 0; i < f.w + 6; i++) {
        const fy = f.bot - 2 - Math.abs(Math.sin(t * 0.2 + i * 1.7)) * 3;
        ctx.fillStyle = i % 3 ? '#ffffff' : '#d8f4ff';
        ctx.fillRect(sx - 3 + i, Math.round(fy), 1, 2);
      }
    }
  }

  /** Butterflies flitting about and grass swaying in the foreground. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const cols = ['#ffe040', '#ff8ab8', '#ffffff', '#8ad0ff'];
    for (let i = 0; i < 6; i++) {
      const ph = t * 0.01 + i * 1.9;
      const wx = ((i * 97 + Math.sin(ph) * 40 + t * 0.2) % STAGE_W + STAGE_W) % STAGE_W;
      const x = Math.round(wx - camX * 1.05), y = Math.round(150 + Math.sin(ph * 1.6 + i) * 22 + Math.sin(t * 0.07 + i) * 3);
      if (x < -4 || x > W + 4) continue;
      const flap = Math.sin(t * 0.5 + i * 2) > 0;
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(x - 2, y - (flap ? 1 : 0), 2, flap ? 2 : 1);
      ctx.fillRect(x + 1, y - (flap ? 1 : 0), 2, flap ? 2 : 1);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x, y - 1, 1, 2);
    }
    // tall grass blades along the very front edge, swaying in the breeze
    for (let i = 0; i < 48; i++) {
      const wx = i * 11 + Math.floor(hash(i) * 6);
      const x = Math.round(wx - camX * 1.25);
      const xx = ((x % (STAGE_W + 40)) + STAGE_W + 40) % (STAGE_W + 40) - 20;
      if (xx < -6 || xx > W + 6) continue;
      const h = 6 + Math.floor(hash(i * 3.3) * 8), sway = Math.sin(t * 0.04 + i * 0.7) * 2;
      for (let k = 0; k < h; k++) {
        ctx.fillStyle = k < h * 0.3 ? '#9ae868' : '#3aa038';
        ctx.fillRect(Math.round(xx + sway * (1 - k / h)), H - h + k, 1, 1);
      }
    }
  }

  /** Spray from the falls drifting up around the rocks after the landing. */
  pitTick(p: Particles, it: number) {
    if (it % 3 === 0) p.smoke(128 + rand(-60, 60), H - 196 + rand(-2, 4), 1, '#e8f8ff');
  }
}
