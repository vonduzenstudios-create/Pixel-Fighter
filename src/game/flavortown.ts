import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';

// "Flavortown": a main street at sundown where every building is shaped like food and everything
// is on fire. A flame-painted chrome diner sits in the middle, grill braziers roar at both ends,
// the barbecue shack smokes and embers drift everywhere. The backdrops are painted at load time;
// the flames, smoke, neon and embers are animated every frame.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.2);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.5);
const MID_GROUND = 168;
/** World x of the two grill braziers at the ends of the street, and the diner's span. */
const BRAZIERS = [22, STAGE_W - 22];
const BRAZIER_TOP = FLOOR - 30;
const DINER_X0 = 150, DINER_X1 = 362, DINER_TOP = 104;
const SMOKER_X = 248;

// house colours: hot-rod red, flame orange, mustard, chrome and neon teal
const RED = '#d01c1c', ORANGE = '#ff7a10', MUSTARD = '#ffd030', CHROME = '#c8d0d8', NEON = '#40f0e0';

/** Pixel flame tongues along a baseline, for decals and static fire (hot core at the bottom). */
function flameDecal(p: Painter, x0: number, x1: number, base: number, h: number, seed: number, cols: Color[] = ['#ffe040', ORANGE, RED]) {
  const r = rng(seed);
  for (let x = x0; x < x1; x += r.int(5, 8)) {
    const fh = h * r.range(0.6, 1), lean = r.range(2, 5);
    cols.forEach((c, i) => {
      const k = 1 - i * 0.28;
      p.poly([[x - 3 * k, base], [x + lean * 1.4, base - fh * k], [x + 4 * k, base]], c);
    });
  }
}

function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops = ['#2a0e3a', '#521a4e', '#8a2450', '#c8402e', '#f07a1e', '#ffb840'];
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / 150) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // a fat setting sun, sliced by heat bands
  const sx = 128, sy = 122;
  for (let y = -44; y <= 0; y++)
    for (let x = -44; x <= 44; x++) {
      if (x * x + y * y > 44 * 44) continue;
      const band = y > -22 && (y + 60) % 7 < 2 + Math.floor((y + 22) / 8);
      if (band) continue;
      p.set(sx + x, sy + y, y < -30 ? '#fff0a0' : y < -14 ? '#ffd860' : '#ffb030');
    }
  // streaky dusk clouds
  const r = rng(911);
  for (let i = 0; i < 12; i++) {
    const cx = r.int(-10, W + 10), cy = r.int(10, 70), w = r.int(30, 70);
    for (let x = -w / 2; x < w / 2; x++) {
      p.set(cx + x, cy, '#a03a5a');
      if (Math.abs(x) < w / 3) p.set(cx + x, cy + 1, '#7a2048');
      if (Math.abs(x) < w / 4 && bayer(cx + x, cy) < 0.5) p.set(cx + x, cy - 1, '#d8607a');
    }
  }
  return p.canvas();
}

/** The skyline: food-shaped towers in hazy silhouette. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(923);
  const sil = '#5a1c3a', lit = '#ffb050';
  // plain blocks with lit windows behind the food buildings
  for (let x = 0; x < FAR_W; x += r.int(18, 30)) {
    const w = r.int(14, 26), top = r.int(108, 140);
    p.rect(x, top, w, H - top, darken(sil, 0.15));
    for (let wy = top + 4; wy < 170; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r.next() < 0.45) p.rect(wx, wy, 2, 3, lit);
  }
  // a burger dome
  const bx = 46;
  p.ellipse(bx, 112, 26, 18, '#c87a30');
  p.rect(bx - 26, 112, 52, 40, '#c87a30');
  p.rect(bx - 28, 118, 56, 5, '#4a2414');
  p.rect(bx - 27, 116, 54, 2, '#e8c030');
  p.rect(bx - 28, 114, 56, 2, '#40a030');
  for (let k = 0; k < 7; k++) p.set(bx - 14 + k * 5, 102 + (k % 2) * 3, '#fff0c0');
  // a hot dog riding a rooftop
  const hx = 128;
  p.rect(hx - 14, 120, 28, 50, darken(sil, 0.05));
  p.capsule(hx - 26, 112, 5, hx + 26, 112, 5, '#e8a050');
  p.capsule(hx - 30, 108, 4, hx + 30, 108, 4, '#c8402a');
  for (let x = -26; x < 26; x += 4) p.set(hx + x, 106 + (x / 4) % 2, MUSTARD);
  // a taco water tower on stilts
  const tx = 196;
  for (const d of [-12, -4, 4, 12]) p.line(tx + d, 150, tx + d * 0.6, 112, '#3a1428');
  p.line(tx - 12, 132, tx + 12, 132, '#3a1428');
  // the shell: the top half of a disc, with a darker crisp edge
  for (let y = -16; y <= 0; y++)
    for (let x = -20; x <= 20; x++) {
      const d = (x * x) / 400 + (y * y) / 256;
      if (d <= 1) p.set(tx + x, 108 + y, d > 0.8 ? '#c88a20' : '#e8b040');
    }
  for (let x = -18; x < 18; x += 3) p.ellipse(tx + x, 95 + Math.abs(x) * 0.2, 2, 3, '#40b030');
  for (let x = -16; x < 16; x += 6) p.set(tx + x, 98, RED);
  // a giant chili pepper spire, curling at the tip
  const cx = 268;
  for (let y = 0; y < 72; y++) {
    const w = 7 * Math.sin((y / 72) * Math.PI * 0.9 + 0.2);
    const ox = Math.sin(y * 0.05) * 5;
    p.rect(cx + ox - w, 150 - y, w * 2, 1, y > 50 ? '#e02020' : '#c01818');
    if (w > 2) p.set(cx + ox - w + 1, 150 - y, '#ff6050');
  }
  p.rect(cx - 2, 74, 4, 6, '#2a8a20');
  p.rect(cx - 6, 79, 12, 2, '#2a8a20');
  // smokestacks puffing from the grill district
  for (const sx of [94, 236]) p.rect(sx, 96, 5, 60, darken(sil, 0.2));
  // heat haze
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.45) p.set(x, y, mix(p.get(x, y), '#c04a50', 0.45));
  p.gradRect(0, 160, FAR_W, H - 160, '#7a2a40', '#5a1a30', 3);
  return p.canvas();
}

interface Glow { x: number; y: number; r: number; col: string; ph: number }

const SHOPS: [number, number, string, Color, Color][] = [
  [6, 86, 'WINGS', '#7a2a1a', ORANGE],
  [96, 166, 'TACOS', '#2a6a5a', MUSTARD],
  [216, 296, 'BBQ', '#4a2a1a', RED],
  [306, 380, 'PIE', '#5a2a5a', '#ff70b0'],
];

/** Main-street storefronts with striped awnings and neon signs. */
function mid(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(941);
  const tops: number[] = [];
  for (const [x0, x1, , wall, trim] of SHOPS) {
    const top = MID_GROUND - r.int(46, 52);
    tops.push(top);
    p.rect(x0, top, x1 - x0, MID_GROUND - top, wall);
    // brick hints
    for (let y = top + 2; y < MID_GROUND; y += 4) for (let x = x0 + ((y >> 2) % 2) * 3; x < x1; x += 6) if (bayer(x, y) < 0.3) p.rect(x, y, 4, 1, darken(wall, 0.25));
    p.rect(x0 - 2, top - 3, x1 - x0 + 4, 3, darken(wall, 0.4));
    // striped awning
    for (let x = x0; x < x1; x++) {
      const c = Math.floor((x - x0) / 6) % 2 ? '#f4e8d8' : trim;
      p.rect(x, MID_GROUND - 34, 1, 7, c);
      if ((x - x0) % 6 === 3) p.set(x, MID_GROUND - 27, c);
    }
    // lit shop window
    p.rect(x0 + 6, MID_GROUND - 24, x1 - x0 - 26, 18, '#ffcc70');
    p.rect(x0 + 6, MID_GROUND - 24, x1 - x0 - 26, 2, '#fff0c0');
    p.rect(x1 - 16, MID_GROUND - 22, 10, 22, darken(wall, 0.5));
    glows.push({ x: (x0 + x1) / 2 - 6, y: MID_GROUND - 15, r: 28, col: '#ffb060', ph: r.range(0, 6) });
    glows.push({ x: (x0 + x1) / 2, y: top + 6, r: 22, col: typeof trim === 'string' ? trim : ORANGE, ph: r.range(0, 6) });
  }
  // the barbecue shack's big black smoker out front
  p.capsule(SMOKER_X - 14, MID_GROUND - 12, 7, SMOKER_X + 12, MID_GROUND - 12, 7, '#2a2a30');
  p.rect(SMOKER_X + 10, MID_GROUND - 40, 4, 26, '#2a2a30');
  for (const d of [-10, 8]) p.rect(SMOKER_X + d, MID_GROUND - 6, 2, 6, '#2a2a30');
  p.rect(SMOKER_X - 10, MID_GROUND - 14, 18, 1, '#ff6020');
  // street lamps
  for (const lx of [92, 210, 300]) {
    p.rect(lx, MID_GROUND - 48, 2, 48, '#2a1a24');
    p.rect(lx - 3, MID_GROUND - 51, 8, 3, '#ffe8a0');
    glows.push({ x: lx + 1, y: MID_GROUND - 49, r: 18, col: '#ffe0a0', ph: r.range(0, 6) });
  }
  p.rect(0, MID_GROUND, MID_W, H - MID_GROUND, '#3a1a24');
  p.rect(0, MID_GROUND, MID_W, 1, '#6a3040');
  // dusk haze over it all
  for (let y = 0; y < H; y++)
    for (let x = 0; x < MID_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.2) p.set(x, y, mix(p.get(x, y), '#8a3048', 0.4));
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  for (const [i, [x0, x1, name, , trim]] of SHOPS.entries()) {
    drawText(ctx, name, (x0 + x1) / 2 - 2, tops[i] + 3, NEON, { align: 'center', outline: darken(trim, 0.5) });
  }
  return cv;
}

/** A hot rod with a flame paint job, parked by the diner. */
function hotRod(p: Painter, x: number, base: number) {
  p.poly([[x, base - 6], [x + 4, base - 14], [x + 30, base - 15], [x + 40, base - 22], [x + 58, base - 22], [x + 66, base - 14], [x + 80, base - 12], [x + 82, base - 5], [x, base - 4]], RED);
  p.poly([[x + 42, base - 21], [x + 56, base - 21], [x + 62, base - 14], [x + 38, base - 14]], '#2a3a4a');
  p.line(x + 48, base - 21, x + 48, base - 14, '#a8b0b8');
  flameDecal(p, x + 4, x + 40, base - 6, 9, 977, ['#ffe040', ORANGE]);
  // chrome grille, exhaust pipes and fat tyres
  p.rect(x + 78, base - 13, 4, 7, CHROME);
  for (let k = 0; k < 3; k++) p.rect(x + 22 + k * 5, base - 5, 3, 2, CHROME);
  for (const wx of [x + 16, x + 66]) {
    p.ellipse(wx, base - 4, 7, 7, '#141418');
    p.ellipse(wx, base - 4, 3, 3, CHROME);
  }
}

/** The near street: the flame-painted chrome diner, the braziers and a checker plaza to fight on. */
function deck(glows: Glow[], bulbs: number[][]): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(967);
  // the diner: a rounded stainless car with a red flame band
  for (let x = DINER_X0; x < DINER_X1; x++) {
    const edge = Math.min(x - DINER_X0, DINER_X1 - 1 - x);
    const round = edge < 10 ? Math.round(10 - Math.sqrt(100 - (10 - edge) ** 2)) : 0;
    for (let y = DINER_TOP + round; y < FLOOR; y++) {
      const k = y - DINER_TOP;
      let c: Color = k < 6 ? '#e8eef4' : k % 5 === 0 ? '#9aa4ae' : bayer(x, y) < 0.2 ? '#d8dee4' : CHROME;
      if (k > 54) c = RED;
      p.set(x, y, c);
    }
  }
  p.rect(DINER_X0 + 4, DINER_TOP + 52, DINER_X1 - DINER_X0 - 8, 2, '#ffffff');
  flameDecal(p, DINER_X0 + 4, DINER_X1 - 8, FLOOR, 30, 983);
  // a row of warm windows with booth-lamp light
  for (let x = DINER_X0 + 14; x < DINER_X1 - 30; x += 26) {
    p.rect(x, DINER_TOP + 18, 20, 22, '#ffd080');
    p.rect(x, DINER_TOP + 18, 20, 3, '#fff4d0');
    p.rect(x, DINER_TOP + 33, 20, 7, '#c06030');
    p.rect(x + 9, DINER_TOP + 18, 2, 22, '#9aa4ae');
    glows.push({ x: x + 10, y: DINER_TOP + 28, r: 22, col: '#ffc070', ph: r.range(0, 6) });
  }
  // the door
  p.rect(DINER_X1 - 26, DINER_TOP + 14, 16, FLOOR - DINER_TOP - 14, '#5a1010');
  p.rect(DINER_X1 - 23, DINER_TOP + 18, 10, 14, '#ffd080');
  // the rooftop sign board on chrome legs; its marquee bulbs are lit every frame
  const sx0 = DINER_X0 + 30, sx1 = DINER_X1 - 30, sy0 = 58, sy1 = 92;
  for (const lx of [sx0 + 16, sx1 - 18]) p.rect(lx, sy1, 3, DINER_TOP - sy1, '#7a8088');
  p.rect(sx0, sy0, sx1 - sx0, sy1 - sy0, '#1a0a14');
  p.rect(sx0 + 2, sy0 + 2, sx1 - sx0 - 4, sy1 - sy0 - 4, RED);
  p.rect(sx0 + 4, sy0 + 4, sx1 - sx0 - 8, sy1 - sy0 - 8, '#2a0a12');
  for (let x = sx0 + 3; x < sx1 - 2; x += 6) bulbs.push([x, sy0 + 1], [x, sy1 - 2]);
  for (let y = sy0 + 7; y < sy1 - 4; y += 6) bulbs.push([sx0 + 1, y], [sx1 - 2, y]);
  // a big arrow sign pointing at the door
  const ax = DINER_X1 + 14;
  p.rect(ax + 18, 70, 3, FLOOR - 70, '#5a5058');
  p.poly([[ax, 60], [ax + 40, 60], [ax + 40, 52], [ax + 58, 70], [ax + 40, 88], [ax + 40, 80], [ax, 80]], MUSTARD);
  p.poly([[ax + 3, 63], [ax + 37, 63], [ax + 37, 58], [ax + 52, 70], [ax + 37, 82], [ax + 37, 77], [ax + 3, 77]], RED);
  glows.push({ x: ax + 28, y: 70, r: 34, col: '#ff6030', ph: 0 });
  hotRod(p, 46, FLOOR);
  // the grill braziers: iron bowls on three legs, filled with coals
  for (const bx of BRAZIERS) {
    for (const d of [-8, 0, 8]) p.line(bx + d * 0.4, BRAZIER_TOP + 8, bx + d, FLOOR, '#2a2228');
    p.poly([[bx - 14, BRAZIER_TOP], [bx + 14, BRAZIER_TOP], [bx + 9, BRAZIER_TOP + 10], [bx - 9, BRAZIER_TOP + 10]], '#3a3038');
    p.rect(bx - 15, BRAZIER_TOP - 1, 30, 2, '#6a6070');
    for (let k = -12; k < 12; k += 3) p.set(bx + k, BRAZIER_TOP - 2, k % 2 ? '#ff6020' : '#ffd040');
  }
  // the plaza: red and cream checker tiles under a chrome curb
  for (let y = FLOOR; y < H; y++) {
    const row = y - FLOOR;
    const size = 6 + Math.floor(row / 6);
    for (let x = 0; x < STAGE_W; x++) {
      const skew = Math.floor((x - STAGE_W / 2) * (row / 60) + x);
      let c: Color = (Math.floor(skew / 12) + Math.floor(row / size)) % 2 ? '#e8dcc0' : '#b81818';
      if (bayer(x, y) < 0.12) c = darken(c, 0.12);
      if (row > 16) c = mix(c, '#200810', (row - 16) / 14);
      p.set(x, y, c);
    }
  }
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, FLOOR, '#ffffff');
    p.set(x, FLOOR + 1, CHROME);
    p.set(x, FLOOR + 2, '#7a8088');
  }
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  drawText(ctx, 'FLAVORTOWN', (sx0 + sx1) / 2, sy0 + 9, MUSTARD, { align: 'center', outline: '#5a0a0a', grad: ['#fff0a0', ORANGE] });
  drawText(ctx, 'DINER', (sx0 + sx1) / 2, sy0 + 20, NEON, { align: 'center' });
  drawText(ctx, 'EAT', ax + 20, 67, '#ffffff', { align: 'center' });
  drawText(ctx, 'OPEN LATE', DINER_X0 + 50, DINER_TOP + 6, '#5a1010', { align: 'center' });
  return cv;
}

/** The uppercut finish drops the loser into the basement's bubbling cauldron of ghost-pepper chili. */
function cauldron(bones: PartSet): [HTMLCanvasElement, HTMLCanvasElement] {
  const p = new Painter(W, H);
  const r = rng(991);
  // soot-black brick, lit orange from below by the fire
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const grout = y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0;
      const heat = Math.max(0, (y - 40) / 140);
      let c: Color = mix(grout ? '#140808' : '#3a1810', '#c04010', heat * (grout ? 0.3 : 0.55));
      if (!grout && bayer(x, y) < 0.2) c = darken(c, 0.2);
      p.set(x, y, c);
    }
  // the fire's glow rising up the wall behind the pot
  for (let y = 110; y < 160; y++)
    for (let x = 0; x < W; x++) if ((y - 110) / 50 > bayer(x, y) + 0.2) p.set(x, y, mix(p.get(x, y), '#ff7a30', 0.35));
  // heavy chains the cauldron hangs from, and strings of dried chillies
  for (const cx of [30, 226]) for (let y = 0; y < 150; y += 4) p.rect(cx + (y % 8 ? 0 : -1), y, y % 8 ? 2 : 4, 3, '#4a4048');
  for (const [rx, len] of [[64, 60], [196, 46], [110, 30]] as const) {
    p.line(rx, 0, rx, len, '#6a5030');
    for (let y = 6; y < len; y += 5) {
      p.poly([[rx - 3, y], [rx, y + 7], [rx + 1, y]], '#c01818');
      p.poly([[rx + 3, y + 2], [rx + 1, y + 9], [rx, y + 2]], '#e02a20');
    }
  }
  // a warning plaque
  p.rect(140, 34, 50, 22, '#2a2a30');
  p.rect(142, 36, 46, 18, MUSTARD);
  const bg = p.canvas();
  const bctx = bg.getContext('2d')!;
  bctx.imageSmoothingEnabled = false;
  drawText(bctx, 'EXTRA', 165, 38, '#5a0a0a', { align: 'center' });
  drawText(bctx, 'HOT', 165, 46, '#5a0a0a', { align: 'center' });
  // a previous challenger slumped over the rim, done for
  bctx.save();
  bctx.translate(212, 166);
  bctx.scale(-1, 1);
  drawRig(bctx, bones, fk(P(LIE, { rot: -40, af: -160, ab: -140, lf: -30, kf: 50, h: 18 })));
  bctx.restore();
  // the cauldron front: red chili with beans and pepper bits, a black iron belly, flames licking it
  const f = new Painter(W, H);
  for (let x = 0; x < W; x++) {
    const sy = 158 + Math.round(Math.sin(x * 0.17) * 1.5 + Math.sin(x * 0.05));
    for (let y = sy; y < 172; y++) f.set(x, y, y === sy ? '#ff6a40' : bayer(x, y) < 0.3 ? '#d02818' : '#a01410');
  }
  for (let i = 0; i < 46; i++) {
    const bx = r.int(4, W - 4), by = r.int(160, 169);
    const k = r.int(0, 2);
    if (k === 0) f.ellipse(bx, by, r.int(1, 3), 1, '#ff8a60');
    else if (k === 1) f.rect(bx, by, 2, 1, '#4a1008');
    else f.rect(bx, by, 2, 1, '#40a030');
  }
  for (let y = 172; y < H; y++) {
    const t = (y - 172) / (H - 172);
    for (let x = 0; x < W; x++) {
      const rim = Math.abs(x - W / 2) / (W / 2);
      let c: Color = y < 176 ? '#5a5a66' : bayer(x, y) < 0.15 + rim * 0.3 ? '#1a1a20' : '#2a2a32';
      if (y >= 176 && rim > 0.9) c = mix(c, '#ff6020', 0.3);
      c = mix(c, '#ff5010', t * t * 0.35);
      f.set(x, y, c);
    }
  }
  f.rect(0, 172, W, 1, '#9a9aa8');
  for (let x = 12; x < W; x += 28) f.ellipse(x, 182, 2, 2, '#5a5a66');
  flameDecal(f, -6, W + 6, H, 26, 997);
  return [bg, f.canvas()];
}

interface Ember { x: number; y: number; vx: number; vy: number; life: number; max: number }
interface Puff { x: number; y: number; r: number; life: number }

const hexA = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** How hard the braziers are roaring: a steady burn with a big flare-up every few seconds. */
export function flare(t: number, i: number): number {
  const ph = (t + i * 140) % 280;
  return ph < 50 ? Math.sin((ph / 50) * Math.PI) : 0;
}

export class FlavortownStage {
  name = 'FLAVORTOWN';
  blurb = 'A MAIN STREET COOKED EXTRA CRISPY';
  song: SongName = 'flavortown';
  sky = sky();
  far = far();
  midGlows: Glow[] = [];
  mid = mid(this.midGlows);
  glows: Glow[] = [];
  bulbs: number[][] = [];
  deck = deck(this.glows, this.bulbs);
  pit: HTMLCanvasElement;
  pitFront: HTMLCanvasElement;
  embers: Ember[] = [];
  puffs: Puff[] = [];
  lastT = -1;

  constructor(bones: PartSet) {
    [this.pit, this.pitFront] = cauldron(bones);
  }

  /** Advance embers and smoke once per frame (draw can be called from any scene). */
  step(t: number) {
    const dt = this.lastT < 0 ? 1 : Math.max(0, Math.min(3, t - this.lastT));
    this.lastT = t;
    for (let k = 0; k < dt; k++) {
      // embers spit from the braziers (lots more on a flare-up) and drift up off the diner's flames
      BRAZIERS.forEach((bx, i) => {
        const n = 0.35 + flare(t, i) * 2.5;
        for (let j = 0; j < Math.floor(n + Math.random()); j++)
          this.embers.push({ x: bx + (Math.random() - 0.5) * 20, y: BRAZIER_TOP - 6, vx: (Math.random() - 0.5) * 0.8, vy: -0.8 - Math.random() * 1.6, life: 0, max: 60 + Math.random() * 80 });
      });
      if (Math.random() < 0.3)
        this.embers.push({ x: DINER_X0 + Math.random() * (DINER_X1 - DINER_X0), y: FLOOR - 20, vx: (Math.random() - 0.5) * 0.4, vy: -0.4 - Math.random() * 0.6, life: 0, max: 90 + Math.random() * 60 });
      if (t % 9 === 0 && k === 0) this.puffs.push({ x: SMOKER_X + 12, y: MID_GROUND - 42, r: 2, life: 0 });
      for (const e of this.embers) {
        e.life++;
        e.x += e.vx + Math.sin((e.life + e.y) * 0.08) * 0.25;
        e.y += e.vy;
        e.vy *= 0.995;
      }
      this.embers = this.embers.filter((e) => e.life < e.max && e.y > -4);
      for (const s of this.puffs) {
        s.life++;
        s.y -= 0.35;
        s.x += 0.15 + s.life * 0.003;
        s.r += 0.06;
      }
      this.puffs = this.puffs.filter((s) => s.life < 200);
      if (this.embers.length > 400) this.embers.splice(0, this.embers.length - 400);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.step(t);
    ctx.drawImage(this.sky, 0, 0);
    ctx.drawImage(this.far, -Math.round(camX * 0.2), 0);
    const mx = -Math.round(camX * 0.5);
    ctx.drawImage(this.mid, mx, 0);
    // barbecue smoke rolling off the shack's smoker
    for (const s of this.puffs) {
      const a = 0.45 * (1 - s.life / 200);
      ctx.fillStyle = `rgba(70,50,60,${a.toFixed(3)})`;
      const r = Math.round(s.r);
      ctx.fillRect(Math.round(s.x + mx - r), Math.round(s.y - r), r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.midGlows) this.glow(ctx, g.x + mx, g.y, g.r, g.col, 0.14 + 0.05 * Math.sin(t * 0.06 + g.ph));
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    // flames roaring up behind the diner's roofline
    for (let x = DINER_X0 + 6; x < DINER_X1 - 6; x += 12) this.fire(ctx, x + dx, DINER_TOP + 4, 7, 14 + 6 * Math.sin(x * 1.3), t, x);
    ctx.drawImage(this.deck, dx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const sx = g.x + dx;
      if (sx < -g.r * 2 || sx > W + g.r * 2) continue;
      // the arrow sign buzzes on and off
      const a = g.ph === 0 ? (Math.floor(t / 20) % 4 === 3 ? 0.05 : 0.28) : 0.16 + 0.05 * Math.sin(t * 0.05 + g.ph);
      this.glow(ctx, sx, g.y, g.r, g.col, a);
    }
    ctx.globalCompositeOperation = 'source-over';
    // chasing marquee bulbs round the sign
    this.bulbs.forEach(([bx, by], i) => {
      const on = (i + Math.floor(t / 6)) % 3 !== 0;
      ctx.fillStyle = on ? '#fff4a0' : '#7a5020';
      ctx.fillRect(bx + dx, by, 1, 1);
    });
    // the braziers, with a big flare-up now and then
    BRAZIERS.forEach((bx, i) => {
      const sx = bx + dx, f = flare(t, i);
      if (sx < -40 || sx > W + 40) return;
      this.fire(ctx, sx, BRAZIER_TOP, 13, 22 + f * 50, t, i * 31);
      ctx.globalCompositeOperation = 'lighter';
      this.glow(ctx, sx, BRAZIER_TOP - 10, 46 + f * 30, '#ff7020', 0.3 + f * 0.25 + 0.04 * Math.sin(t * 0.4));
      ctx.globalCompositeOperation = 'source-over';
    });
    // a warm firelight wash that pulses with the flare-ups
    const wash = (flare(t, 0) + flare(t, 1)) * 0.06;
    if (wash > 0) {
      ctx.fillStyle = `rgba(255,110,30,${wash.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawEmbers(ctx, camX, false);
  }

  /** Embers drift in front of the fighters too. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number) {
    this.drawEmbers(ctx, camX, true);
  }

  drawEmbers(ctx: CanvasRenderingContext2D, camX: number, front: boolean) {
    this.embers.forEach((e, i) => {
      if ((i % 3 === 0) !== front) return;
      const k = e.life / e.max;
      ctx.fillStyle = k < 0.3 ? '#fff0a0' : k < 0.65 ? '#ffa030' : '#c83a18';
      ctx.fillRect(Math.round(e.x - camX), Math.round(e.y), 1, front && k < 0.5 ? 2 : 1);
    });
  }

  /** A flickering pixel bonfire: hot white core, yellow, orange and a ragged red edge. */
  fire(ctx: CanvasRenderingContext2D, cx: number, base: number, half: number, h: number, t: number, seed: number) {
    const cols = ['#c81810', '#ff6a10', '#ffc830', '#fff4c0'];
    for (let i = -half; i <= half; i++) {
      const env = 1 - (i / (half + 1)) ** 2;
      const n = 0.65 + 0.2 * Math.sin(t * 0.31 + i * 1.7 + seed) + 0.15 * Math.sin(t * 0.73 + i * 0.9 + seed * 2);
      const hh = h * env * n;
      cols.forEach((c, k) => {
        const lh = Math.round(hh * (1 - k * 0.24));
        if (lh <= 0 || (k > 0 && Math.abs(i) > half * (1 - k * 0.22))) return;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(cx + i), Math.round(base - lh), 1, lh);
      });
      // tongues of flame breaking off the tips
      if (Math.sin(t * 0.5 + i * 2.3 + seed) > 0.7) {
        ctx.fillStyle = cols[1];
        ctx.fillRect(Math.round(cx + i), Math.round(base - hh - 3 - ((t + i * 5) % 6)), 1, 2);
      }
    }
  }

  glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, Math.max(0, a)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }
}
