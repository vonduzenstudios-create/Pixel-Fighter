import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng, Rng } from '../../core/rng';
import { Painter, pxCircle } from '../../gfx/painter';
import { bayer, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { Arena } from '../../game/stages';

// "The Midnight Express": a brawl on the roof of a night train racing through mountain
// country at dusk. The scenery layers tile seamlessly and scroll on their own clock so the
// world keeps rushing past even when the fighters stand still. All painted at load time.

const HORIZON = 168;
const CAR_LEN = 196;
const CAR_GAP = 12;
const CARS = [-60, -60 + CAR_LEN + CAR_GAP, -60 + 2 * (CAR_LEN + CAR_GAP), -60 + 3 * (CAR_LEN + CAR_GAP)];
const POLE_SPAN = 192;
const GANTRY_EVERY = 840; // frames between overhead signal gantries

/** Seamless ridgeline: a sum of sines whose periods divide the tile width. */
function loopRidge(r: Rng, w: number, base: number, terms: [number, number][]): number[] {
  const ph = terms.map(() => r.range(0, Math.PI * 2));
  const out: number[] = [];
  for (let x = 0; x < w; x++) {
    let h = base;
    terms.forEach(([amp, k], i) => (h += amp * Math.sin((x / w) * Math.PI * 2 * k + ph[i])));
    out.push(h);
  }
  return out;
}

/** Draw a horizontally tiling layer scrolled left by `off` pixels. */
function tile(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, off: number) {
  const w = img.width;
  let x = -(((Math.round(off) % w) + w) % w);
  for (; x < W; x += w) ctx.drawImage(img, x, 0);
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(101);
  const stops = ['#090824', '#1c1440', '#3c1c4c', '#7a2c4a', '#c4523a', '#f0904a'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / HORIZON) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W - 1), y = r.int(0, 70);
    p.set(x, y, r.next() < 0.25 ? '#ffffff' : '#9a8ab8');
  }
  // a fat setting sun, banded like an old arcade sunset
  const sx = 64, sy = 150, sr = 30;
  for (let y = -sr - 12; y <= sr + 12; y++)
    for (let x = -sr - 12; x <= sr + 12; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > sr && d < sr + 12 && ((sr + 12 - d) / 12) * 0.5 > bayer(sx + x, sy + y)) p.set(sx + x, sy + y, mix(p.get(sx + x, sy + y), '#ffb060', 0.35));
    }
  for (let y = -sr; y <= sr; y++) {
    const band = sy + y > sy - 6 && (sy + y) % 6 < (sy + y - (sy - 6)) / 8;
    if (band) continue;
    const half = Math.sqrt(sr * sr - y * y);
    for (let x = Math.ceil(-half); x <= half; x++) p.set(sx + x, sy + y, mix('#ffe080', '#ff6a3a', (y + sr) / (sr * 2)));
  }
  // long thin clouds
  for (const [cy, x0, x1, c] of [[96, 10, 140, '#a84a52'], [104, 30, 190, '#8a3a50'], [80, 120, 250, '#5a2a4e'], [60, 160, 240, '#3a2048']] as const)
    for (let x = x0; x < x1; x++) for (let k = 0; k < 3; k++) if (bayer(x, cy + k) < (k === 1 ? 0.95 : 0.45)) p.set(x, cy + k, c);
  return p.canvas();
}

function mountains(): HTMLCanvasElement {
  const w = 512;
  const p = new Painter(w, H);
  const r = rng(113);
  const back = loopRidge(r, w, 124, [[16, 2], [10, 5], [5, 11], [2, 23]]);
  const front = loopRidge(r, w, 142, [[10, 3], [7, 7], [3, 17]]);
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(back[x]); y < H; y++) p.set(x, y, mix('#4a2850', '#7a3c58', Math.max(0, (y - back[x]) / 50) * (bayer(x, y) < 0.5 ? 1 : 0.6)));
    // snow on the tallest peaks catches the sunset
    if (back[x] < 112) for (let y = Math.floor(back[x]); y < back[x] + (112 - back[x]) * 0.6; y++) p.set(x, y, bayer(x, y) < 0.7 ? '#e8a890' : '#b07080');
    for (let y = Math.floor(front[x]); y < H; y++) p.set(x, y, bayer(x, y) < 0.15 ? '#3a2040' : '#2c1834');
    p.set(x, Math.floor(front[x]), '#6a3450');
  }
  return p.canvas();
}

function forest(): HTMLCanvasElement {
  const w = 512;
  const p = new Painter(w, H);
  const r = rng(127);
  const hill = loopRidge(r, w, 160, [[6, 2], [4, 5], [2, 13]]);
  for (let x = 0; x < w; x++) for (let y = Math.floor(hill[x]); y < H; y++) p.set(x, y, '#1a1024');
  // pines along the hill, wrapped so the tile stays seamless
  for (let x = 0; x < w; x += r.int(5, 11)) {
    const hgt = r.int(12, 26), base = hill[x] + 2;
    for (let k = 0; k < 3; k++) {
      const top = base - hgt + k * (hgt / 4), wid = 3 + k * 2;
      for (const dx of [0, -w, w]) p.poly([[x + dx - wid, top + hgt / 3], [x + dx, top], [x + dx + wid, top + hgt / 3]], '#1a1024');
    }
    for (const dx of [0, -w]) p.set(x + dx, base - hgt, '#3a2440');
  }
  // a lit farmhouse window here and there
  for (const hx of [90, 300, 430]) {
    const y = Math.floor(hill[hx]) + 3;
    p.rect(hx, y, 3, 2, '#f0b050');
  }
  return p.canvas();
}

/** Embankment and fields right beside the line, smeared by speed. */
function ground(): HTMLCanvasElement {
  const w = 256;
  const p = new Painter(w, H);
  const r = rng(131);
  p.rect(0, HORIZON + 4, w, H - HORIZON - 4, '#120c18');
  for (let i = 0; i < 70; i++) {
    const y = r.int(HORIZON + 6, FLOOR + 6), len = r.int(10, 50), x = r.int(0, w - 1);
    const c = r.pick(['#24182a', '#2c1c30', '#1c1422', '#3a2230']);
    for (let k = 0; k < len; k++) p.set((x + k) % w, y, c);
  }
  // sunset glint streaks on the rails of the parallel track
  for (let x = 0; x < w; x++) {
    p.set(x, FLOOR - 6, bayer(x, 0) < 0.6 ? '#8a5a50' : '#5a3a40');
    if (x % 9 < 6) p.set(x, FLOOR - 3, '#2a1c26');
  }
  return p.canvas();
}

/** Telegraph poles with sagging wires; one pole per tile so the wires wrap cleanly. */
function poles(): HTMLCanvasElement {
  const w = POLE_SPAN;
  const p = new Painter(w, H);
  const px = 30;
  p.rect(px - 1, 52, 3, FLOOR - 52, '#0c0810');
  p.rect(px - 12, 58, 25, 2, '#0c0810');
  p.rect(px - 9, 70, 19, 2, '#0c0810');
  for (const ix of [-11, -5, 5, 11]) p.rect(px + ix, 55, 1, 3, '#2a3040');
  for (const ix of [-8, 8]) p.rect(px + ix, 67, 1, 3, '#2a3040');
  p.set(px - 1, 52, '#3a2a3a');
  for (const [y0, sag] of [[56, 14], [56, 13], [68, 12]]) {
    for (let x = 0; x < w; x++) {
      const u = (((x - px) % w) + w) % w / w;
      p.set(x, Math.round(y0 + Math.sin(u * Math.PI) * sag), '#100c16');
    }
  }
  return p.canvas();
}

/** The carriage roofs the fight happens on, plus the tops of the lit windows below. */
function carriages(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(149);
  for (const cx of CARS) {
    const x0 = cx, x1 = cx + CAR_LEN;
    // body below the roof line
    p.rect(x0, FLOOR + 5, CAR_LEN, H - FLOOR - 5, '#5a1820');
    p.rect(x0, FLOOR + 9, CAR_LEN, 2, '#c09040');
    p.rect(x0, FLOOR + 11, CAR_LEN, 1, '#6a4a20');
    for (let wx = x0 + 10; wx + 14 < x1 - 6; wx += 20) {
      p.rect(wx - 1, FLOOR + 15, 16, H - FLOOR - 15, '#2a0c10');
      p.rect(wx, FLOOR + 16, 14, H - FLOOR - 16, '#f0b860');
      p.rect(wx, FLOOR + 16, 14, 2, '#fff0b0');
      if (r.next() < 0.3) p.rect(wx + r.int(2, 8), FLOOR + 19, 4, H - FLOOR - 19, '#a06838'); // a passenger's silhouette
    }
    // curved roof: deck, eave, rain gutter
    p.rect(x0 + 2, FLOOR, CAR_LEN - 4, 3, '#4a4a5a');
    p.rect(x0, FLOOR + 2, CAR_LEN, 3, '#3a3a48');
    p.rect(x0 + 2, FLOOR, CAR_LEN - 4, 1, '#9a8a98');
    p.rect(x0, FLOOR + 4, CAR_LEN, 1, '#1e1c26');
    for (let x = x0 + 6; x < x1 - 4; x += 8) p.set(x, FLOOR + 3, '#5a5a6a');
    // roof vents and a lamp housing, kept low so nobody trips on them
    for (let vx = x0 + 30; vx < x1 - 20; vx += 48) {
      p.rect(vx, FLOOR - 2, 10, 2, '#2e2e3a');
      p.rect(vx, FLOOR - 2, 10, 1, '#6a6a7a');
    }
    // end handrails
    for (const ex of [x0 + 3, x1 - 4]) {
      p.rect(ex, FLOOR - 7, 1, 7, '#22202a');
      p.rect(ex - 1, FLOOR - 7, 3, 1, '#6a6070');
    }
    // sunset rim light from the left
    for (let y = FLOOR; y < H; y++) p.set(x0, y, lighten(p.get(x0, y), 0.3));
  }
  // gangway plates between cars, flush with the roofs
  for (const cx of CARS) {
    const gx = cx + CAR_LEN;
    p.rect(gx, FLOOR, CAR_GAP, 2, '#2e2c36');
    p.rect(gx, FLOOR, CAR_GAP, 1, '#6a6070');
    for (let y = FLOOR + 2; y < H; y++)
      for (let x = gx; x < gx + CAR_GAP; x++) p.set(x, y, (y >> 1) % 2 ? '#14121a' : '#24202a');
  }
  return p.canvas();
}

/** The view from the trackside ditch, for the uppercut stage finish. */
function trackside(bones: PartSet): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(163);
  p.gradRect(0, 0, W, H, '#1a1030', '#06040a', 8);
  // the train thundering overhead: undercarriage, wheels, sparks
  p.rect(0, 0, W, 30, '#100c14');
  p.rect(0, 30, W, 3, '#3a3040');
  for (let x = 8; x < W; x += 34) {
    p.ellipse(x + 10, 40, 9, 9, '#1c1820');
    p.ellipse(x + 10, 40, 6, 6, '#3a3442');
    p.ellipse(x + 10, 40, 2, 2, '#6a6070');
    for (let k = 0; k < 3; k++) p.set(x + 10 + r.int(-12, 12), 50 + r.int(0, 4), '#ffc040');
  }
  for (let x = 0; x < W; x++) p.set(x, 30, bayer(x, 0) < 0.5 ? '#c09040' : '#6a4a20'); // the gold stripe, blurred
  p.rect(0, 50, W, 2, '#8a8090'); // rail
  p.rect(0, 52, W, 4, '#2a2028');
  // gravel embankment sloping down to the fence
  for (let y = 56; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y - 56) / (H - 56);
      if (bayer(x * 3 + y, y) < 0.18 * (1 - k)) p.set(x, y, '#3a3040');
      else if (bayer(x, y * 5) < 0.06) p.set(x, y, '#5a5060');
    }
  // iron railings with spear tips; one bar sits right where the victim lands (x = 128)
  p.rect(0, 160, W, 3, '#2a2432');
  p.rect(0, 200, W, 3, '#2a2432');
  for (let bx = 128 % 14; bx < W; bx += 14) {
    p.rect(bx - 1, 150, 3, H - 150, '#3a3442');
    p.set(bx - 1, 150, '#7a7088');
    p.poly([[bx - 3, 151], [bx + 0.5, 140], [bx + 4, 151]], '#5a5262');
    p.set(bx, 141, '#c8c0d0');
    if (r.next() < 0.35) for (let k = 0; k < 5; k++) p.set(bx, 143 + k + r.int(0, 2), k < 2 ? '#a01010' : '#600808');
  }
  const cv = p.canvas();
  // earlier passengers who took the same shortcut
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  for (const [x, y, rot, flip] of [[44, 176, -95, 1], [212, 182, -80, -1]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    drawRig(ctx, bones, fk(P(LIE, { rot, af: -110, ab: 50, lf: -30, kf: 60, h: 30 })));
    ctx.restore();
  }
  return cv;
}

export class TrainStage implements Arena {
  name = 'THE MIDNIGHT EXPRESS';
  song = 'train' as const;
  sky = sky();
  mountains = mountains();
  forest = forest();
  ground = ground();
  poles = poles();
  cars = carriages();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = trackside(bones);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    // each layer = its own travel speed * time + parallax against the camera
    tile(ctx, this.mountains, t * 0.12 + camX * 0.15);
    tile(ctx, this.forest, t * 0.9 + camX * 0.35);
    tile(ctx, this.ground, t * 7 + camX * 0.8);
    tile(ctx, this.poles, t * 5.5 + camX * 0.7);
    this.drawSmoke(ctx, camX, t);
    ctx.drawImage(this.cars, -Math.round(camX), 0);
    // windows flicker as the carriages pass under trackside lamps
    if (t % 90 < 3) {
      ctx.fillStyle = 'rgba(255,230,160,0.12)';
      ctx.fillRect(0, FLOOR + 14, W, H - FLOOR - 14);
    }
  }

  /** Locomotive smoke streaming back over the roofs from beyond the right edge. */
  drawSmoke(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const life = 200;
    for (let i = 0; i < 26; i++) {
      const age = (t * 1.3 + i * (life / 26)) % life;
      const x = STAGE_W + 40 - age * 3.2 - camX + Math.sin(i * 7.3) * 6;
      const y = 92 - age * 0.32 + Math.sin(age * 0.05 + i) * 4;
      const rr = 5 + age * 0.08;
      if (x < -rr || x > W + rr) continue;
      const a = 0.55 * (1 - age / life);
      ctx.fillStyle = `rgba(${36 + (i % 3) * 8},${28 + (i % 3) * 6},${40 + (i % 3) * 8},${a})`;
      pxCircle(ctx, x, y, rr);
    }
  }

  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    // wind streaks and cinders
    for (let i = 0; i < 9; i++) {
      const x = (((W + 80) - ((t * (9 + (i % 4)) + i * 131 + camX * 1.1) % (W + 80))) | 0) - 40;
      const y = 20 + ((i * 53) % 170);
      ctx.fillStyle = 'rgba(255,240,230,0.13)';
      ctx.fillRect(x, y, 18 + (i % 3) * 8, 1);
    }
    for (let i = 0; i < 6; i++) {
      const x = (((W + 20) - ((t * (5 + i) + i * 97) % (W + 20))) | 0) - 10;
      const y = 60 + ((i * 37 + Math.floor(t / 3)) % 120);
      ctx.fillStyle = i % 2 ? '#ffb040' : '#ff6020';
      ctx.fillRect(x, y, 1, 1);
    }
    this.drawGantry(ctx, t);
  }

  /** A signal gantry spans the line every so often and whips past in front of everyone. */
  drawGantry(ctx: CanvasRenderingContext2D, t: number) {
    const phase = t % GANTRY_EVERY;
    const x = Math.round(W + 40 - phase * 9);
    if (x < -60) return;
    ctx.fillStyle = '#08060c';
    ctx.fillRect(x, 26, 10, H - 26);
    ctx.fillRect(x - 40, 22, 60, 8);
    ctx.fillStyle = '#1a1620';
    for (let y = 32; y < H; y += 8) {
      ctx.fillRect(x + 1, y, 8, 1);
      ctx.fillRect(x + 1 + ((y >> 3) % 2) * 6, y, 2, 8);
    }
    // signal lamps
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(x - 30, 24, 3, 3);
    ctx.fillStyle = '#30ff70';
    ctx.fillRect(x - 18, 24, 3, 3);
  }
}
