import { H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { drawText } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "Street Magic City": a downtown corner after dark, where a street magician draws a crowd. Brick
// walk-ups with fire escapes over a pawn shop, a magic and novelty store, a 24-hour deli and an old
// theater with a chasing-bulb marquee. Neon buzzes and flickers and bleeds into the wet street, steam
// rolls out of a manhole, a card sharp works three cards on a folding table, and the crowd on the
// sidewalk gasps at every big hit (one of them is quietly levitating). Painted procedurally at load.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.5);
const SIGN = 100; // top of the shop-sign band
const STORE = 118; // top of the storefronts
const WALK = 160; // building base / back of the sidewalk
const CURB = 178; // the street starts below the curb
const ALLEY = [236, 278];
const LAMPS = [100, 404];
const MANHOLE = { x: 182, y: 190 };
const TABLE = { x: 336, y: 172 };

interface Building { x0: number; x1: number; roof: number; brick: string; escape: boolean }
const BUILDINGS: Building[] = [
  { x0: 0, x1: 98, roof: 40, brick: '#6a3a2a', escape: true },
  { x0: 98, x1: ALLEY[0], roof: 22, brick: '#5a2228', escape: false },
  { x0: ALLEY[1], x1: 404, roof: 48, brick: '#8a6a4a', escape: true },
  { x0: 404, x1: STAGE_W, roof: 30, brick: '#5a5a66', escape: false },
];

interface Person {
  x: number; y: number; skin: string; hair: string; coat: string; legs: string; ph: number; tall: number;
  hat: 0 | 1 | 2; prop?: 'cam' | 'flash' | 'float' | 'dealer';
}

const SKINS = ['#f4d0b0', '#e0b088', '#c08860', '#8a5a3a', '#5a3a26', '#f0c8a0'];
const HAIRS = ['#2a1a10', '#141014', '#6a3a1a', '#d8a848', '#a04a20', '#8a8a8a'];
const COATS = ['#3a3a4a', '#6a2a2a', '#2a4a6a', '#5a4a2a', '#2a5a4a', '#4a2a5a', '#7a6a5a', '#a03a3a', '#1a1a22'];
const LEGS = ['#1a1a2a', '#2a3a5a', '#3a3a3a', '#4a3a2a'];

/** A cheap deterministic hash in 0..1, for flicker that does not touch the game's random stream. */
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Static sky: night gradient, stars, a crescent moon and the far skyline. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1601);
  p.gradRect(0, 0, W, 130, '#080818', '#3a1c48', 10);
  for (let i = 0; i < 50; i++) p.set(r.int(0, W - 1), r.int(0, 70), r.next() < 0.3 ? '#ffffff' : '#8a88b0');
  // crescent moon
  for (let y = 6; y < 40; y++)
    for (let x = 180; x < 220; x++) {
      const d = Math.hypot(x - 200, y - 22), cut = Math.hypot(x - 206, y - 18);
      if (d < 10 && cut > 9) p.set(x, y, d < 8.5 ? '#f4ecd0' : '#c8c0a8');
      else if (d < 20 && bayer(x, y) < (1 - (d - 10) / 10) * 0.2) p.set(x, y, lighten(p.get(x, y), 0.12));
    }
  // far towers with a few lit windows and a spire
  for (let x = 0; x < W; ) {
    const w = r.int(14, 26), top = r.int(50, 90);
    p.rect(x, top, w, H - top, '#1c1830');
    for (let wy = top + 4; wy < 140; wy += 5)
      for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r.next() < 0.18) p.set(wx, wy, r.next() < 0.6 ? '#c8a050' : '#6a8ab0');
    if (r.next() < 0.25) p.line(x + w / 2, top, x + w / 2, top - 12, '#1c1830');
    x += w + r.int(0, 3);
  }
  return p.canvas();
}

/** The mid city at half parallax: taller blocks of lit windows, a water tower and a billboard. */
function city(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1613);
  for (let x = -4; x < FAR_W; ) {
    const w = r.int(26, 44), top = r.int(30, 70);
    const c = r.pick(['#2a2238', '#24203a', '#30263a', '#1e1c30']);
    p.rect(x, top, w, H - top, c);
    p.rect(x, top, w, 2, lighten(c, 0.12));
    p.rect(x + w - 2, top, 2, H - top, darken(c, 0.3));
    for (let wy = top + 6; wy < 170; wy += 8)
      for (let wx = x + 3; wx < x + w - 5; wx += 6) {
        const lit = r.next() < 0.35;
        p.rect(wx, wy, 3, 4, lit ? r.pick(['#e8c070', '#f0d890', '#a8c8e8']) : darken(c, 0.3));
      }
    x += w + r.int(2, 8);
  }
  // water tower on a roof
  const wx = 60, wy = 30;
  p.rect(wx - 9, wy, 18, 14, '#5a3a28');
  for (let k = 0; k < 18; k += 3) p.rect(wx - 9 + k, wy, 1, 14, '#4a2e20');
  p.poly([[wx - 11, wy], [wx + 11, wy], [wx, wy - 8]], '#3a2a20');
  for (const lx of [-8, -2, 4, 8]) p.line(wx + lx, wy + 14, wx + lx * 1.2, wy + 26, '#2a2028');
  // a billboard with a big watching eye
  const bx = 250, by = 18;
  p.rect(bx, by, 76, 30, '#e8e0d0');
  p.rect(bx, by, 76, 2, '#fff8e8');
  p.rect(bx + 2, by + 30, 2, 12, '#2a2028');
  p.rect(bx + 72, by + 30, 2, 12, '#2a2028');
  p.ellipse(bx + 16, by + 15, 11, 7, '#ffffff');
  p.ellipse(bx + 16, by + 15, 5, 5, '#3a7ae0');
  p.ellipse(bx + 16, by + 15, 2, 2, '#101018');
  p.set(bx + 14, by + 13, '#ffffff');
  for (let x = bx + 4; x < bx + 29; x++) p.set(x, by + 7 - Math.round(Math.sin(((x - bx - 4) / 25) * Math.PI) * 3), '#101018');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  drawText(ctx, 'SEE IT', bx + 31, by + 6, '#c02040');
  drawText(ctx, 'BELIEVE', bx + 29, by + 16, '#101018');
  return cv;
}

/** A window: frame, glass lit or dark, and a sill. */
function windowAt(p: Painter, x: number, y: number, lit: boolean, r: ReturnType<typeof rng>) {
  p.rect(x - 1, y - 1, 12, 15, '#2a1a18');
  const glass = lit ? r.pick(['#e8b860', '#f0d080', '#d89850']) : r.pick(['#1a2030', '#222840', '#181828']);
  for (let yy = 0; yy < 13; yy++)
    for (let xx = 0; xx < 10; xx++) p.set(x + xx, y + yy, lit && bayer(xx, yy) < yy / 30 ? darken(glass, 0.15) : glass);
  p.rect(x + 4, y, 2, 13, '#2a1a18');
  p.rect(x, y + 6, 10, 1, '#2a1a18');
  if (lit && r.next() < 0.4) p.rect(x, y, 10, r.int(2, 6), darken(glass, 0.3)); // half-drawn blind
  if (!lit && r.next() < 0.3) p.rect(x + 1, y + 1, 3, 2, '#3a4060'); // a glint
  p.rect(x - 2, y + 13, 14, 2, '#8a8078');
}

/** Iron fire escape: a landing at each floor and a ladder between them. */
function fireEscape(p: Painter, x0: number, x1: number, floors: number[]) {
  for (const fy of floors) {
    p.rect(x0, fy, x1 - x0, 2, '#141418');
    for (let x = x0; x < x1; x += 3) p.rect(x, fy - 8, 1, 8, '#141418');
    p.rect(x0, fy - 8, x1 - x0, 1, '#141418');
  }
  for (let i = 0; i < floors.length - 1; i++) {
    const a = floors[i], b = floors[i + 1], lx = i % 2 ? x0 + 4 : x1 - 10;
    for (let y = a; y < b; y++) {
      const t = (y - a) / (b - a);
      const x = Math.round(lx + (i % 2 ? 1 : -1) * t * 8);
      p.set(x, y, '#141418');
      p.set(x + 5, y, '#141418');
      if ((y - a) % 3 === 0) p.rect(x, y, 6, 1, '#141418');
    }
  }
}

/** Brick fill with mortar lines and a little variation per brick. */
function brick(p: Painter, x0: number, x1: number, y0: number, y1: number, c: Color) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      const v = ((row * 7 + ((x + off) >> 3) * 13) % 5) * 0.04;
      p.set(x, y, mortar ? darken(c, 0.45) : darken(c, v));
    }
}

/** The street block: building faces, storefronts, the alley, sidewalk, curb and wet asphalt. */
function street(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1627);
  for (const b of BUILDINGS) {
    brick(p, b.x0, b.x1, b.roof, WALK, b.brick);
    // cornice
    p.rect(b.x0, b.roof, b.x1 - b.x0, 4, darken(b.brick, 0.5));
    p.rect(b.x0, b.roof + 4, b.x1 - b.x0, 1, lighten(b.brick, 0.25));
    for (let x = b.x0 + 2; x < b.x1 - 2; x += 5) p.rect(x, b.roof + 5, 2, 2, darken(b.brick, 0.5));
    // upper-floor windows
    const floors: number[] = [];
    for (let wy = b.roof + 12; wy < SIGN - 16; wy += 22) {
      floors.push(wy + 16);
      for (let wx = b.x0 + 10; wx < b.x1 - 16; wx += 22) windowAt(p, wx, wy, r.next() < 0.45, r);
    }
    if (b.escape) fireEscape(p, b.x0 + 26, b.x0 + 62, floors);
  }
  // the alley: a far wall in shadow, a dumpster, trash bags, a hanging bulb
  for (let y = 0; y < WALK; y++)
    for (let x = ALLEY[0]; x < ALLEY[1]; x++) {
      if (y < 64) p.data[(y * STAGE_W + x) * 4 + 3] = 0;
      else p.set(x, y, (x + (y >> 2) * 3) % 9 === 0 || y % 5 === 0 ? '#0e0c14' : mix('#141220', '#22202e', (y - 64) / 96));
    }
  p.rect(ALLEY[0], 62, ALLEY[1] - ALLEY[0], 2, '#0a0a10');
  p.rect(244, 134, 26, 26, '#2a5a3a');
  p.rect(244, 134, 26, 2, '#3a7a4a');
  p.rect(242, 132, 30, 3, '#1a3a24');
  for (let k = 0; k < 3; k++) p.rect(248 + k * 8, 140, 1, 16, '#1a3a24');
  p.ellipse(266, 158, 6, 4, '#141418');
  p.ellipse(265, 156, 4, 2, '#26262c');
  // shop signs and storefronts, one per building
  // pawn shop: barred window, gold sign board
  p.rect(0, SIGN, 98, 18, '#2a2018');
  p.rect(4, STORE, 54, 34, '#2a3040');
  for (let x = 6; x < 58; x += 5) p.rect(x, STORE, 1, 34, '#8a8a90');
  p.rect(4, STORE + 18, 54, 1, '#8a8a90');
  // guitars and a gold watch behind the bars
  p.ellipse(18, STORE + 26, 5, 6, '#a05a20');
  p.rect(17, STORE + 6, 2, 16, '#5a3010');
  p.ellipse(40, STORE + 12, 4, 4, '#e8c040');
  p.ellipse(40, STORE + 12, 2, 2, '#f8f0d0');
  p.rect(66, STORE + 2, 24, 40, '#3a2418');
  p.rect(68, STORE + 4, 20, 16, '#4a5060');
  p.set(84, STORE + 24, '#e8c040');
  // magic shop: purple front, arched display window, star-spangled awning
  p.rect(98, SIGN, 138, 18, '#1a1020');
  for (let y = STORE; y < WALK; y++) for (let x = 98; x < 236; x++) p.set(x, y, (x - y) % 11 === 0 ? '#3a1a4a' : '#2a1238');
  for (let y = STORE + 4; y < WALK - 4; y++)
    for (let x = 106; x < 196; x++) {
      const arch = y < STORE + 14 && Math.hypot((x - 151) / 45, (y - (STORE + 14)) / 10) > 1;
      if (!arch) p.set(x, y, mix('#30204a', '#4a2a5a', (y - STORE) / 40));
    }
  // display: top hats on stands, a cut-out rabbit, a cabinet and a deck fanned in a frame
  for (const [hx, hy] of [[120, 140], [176, 136]]) {
    p.rect(hx - 1, hy + 6, 2, WALK - 4 - hy - 6, '#8a8a90');
    p.rect(hx - 5, hy - 8, 10, 12, '#141418');
    p.rect(hx - 8, hy + 3, 16, 2, '#141418');
    p.rect(hx - 5, hy, 10, 2, '#a02030');
  }
  p.ellipse(148, 146, 7, 8, '#f0f0f0');
  p.ellipse(144, 132, 2, 7, '#f0f0f0');
  p.ellipse(152, 132, 2, 7, '#f0f0f0');
  p.ellipse(144, 132, 1, 5, '#f0a0b0');
  p.ellipse(152, 132, 1, 5, '#f0a0b0');
  p.ellipse(148, 142, 5, 4, '#f0f0f0');
  p.set(146, 141, '#c02040');
  p.set(150, 141, '#c02040');
  for (let k = 0; k < 5; k++) {
    const cx = 160 + k * 3, cy = 124 + Math.abs(k - 2);
    p.rect(cx, cy, 5, 8, '#f8f8f0');
    p.rect(cx, cy, 5, 1, '#c8c8c0');
    p.set(cx + 2, cy + 3, k % 2 ? '#c02020' : '#141418');
  }
  p.rect(202, STORE + 4, 28, 38, '#140a1a');
  p.rect(205, STORE + 8, 22, 18, '#3a2a50');
  p.set(224, STORE + 26, '#e8c040');
  // deli: yellow-striped awning drawn over a window full of fruit and an open door
  p.rect(ALLEY[1], SIGN, 404 - ALLEY[1], 18, '#1a2a1a');
  p.rect(ALLEY[1] + 6, STORE + 8, 70, 34, '#2a3a30');
  for (let i = 0; i < 40; i++) p.ellipse(ALLEY[1] + 12 + r.int(0, 58), STORE + 28 + r.int(0, 12), 2, 2, r.pick(['#e04030', '#f0a020', '#f0e040', '#80c040']));
  p.rect(ALLEY[1] + 6, STORE + 22, 70, 1, '#8a8a80');
  p.rect(366, STORE + 4, 30, 38, '#e8d8a0');
  p.rect(370, STORE + 8, 22, 34, '#c8b880');
  // fruit crates on the sidewalk in front
  for (let i = 0; i < 3; i++) {
    const cx = ALLEY[1] + 10 + i * 22;
    p.rect(cx, WALK - 2, 18, 10, '#8a6a3a');
    p.rect(cx, WALK - 2, 18, 1, '#a88a5a');
    for (let k = 0; k < 7; k++) p.ellipse(cx + 3 + k * 2, WALK - 3, 2, 2, ['#e04030', '#f0a020', '#80c040'][i]);
  }
  // theater: stone front, poster cases either side of brass doors
  p.rect(404, SIGN, 108, 18, '#2a2a30');
  for (let y = STORE; y < WALK; y++) for (let x = 404; x < STAGE_W; x++) p.set(x, y, (y - STORE) % 10 === 0 ? '#4a4a52' : '#6a6a74');
  for (const px of [412, 486]) {
    p.rect(px, STORE + 6, 20, 30, '#c8a040');
    p.rect(px + 2, STORE + 8, 16, 26, '#2a1430');
    p.ellipse(px + 10, STORE + 18, 5, 5, '#f0e0c0');
    p.rect(px + 4, STORE + 26, 12, 2, '#c02040');
  }
  for (let k = 0; k < 3; k++) {
    const dx = 440 + k * 14;
    p.rect(dx, STORE + 8, 12, 34, '#5a4020');
    p.rect(dx + 2, STORE + 10, 8, 14, '#2a2030');
    p.rect(dx + 9, STORE + 26, 1, 4, '#e8c040');
  }
  // sidewalk slabs with expansion seams
  for (let y = WALK; y < CURB; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const seam = (x + Math.floor((y - WALK) * 0.6)) % 36 === 0 || y === WALK + 9;
      p.set(x, y, seam ? '#4a4850' : bayer(x, y) < 0.12 ? '#6a6872' : '#5c5a64');
    }
  p.rect(0, WALK, STAGE_W, 1, '#2a2830');
  // curb
  p.rect(0, CURB, STAGE_W, 2, '#8a8890');
  p.rect(0, CURB + 2, STAGE_W, 2, '#3a3840');
  // asphalt, darker toward the camera, wet patches and a lane line
  for (let y = CURB + 4; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      let c: Color = mix('#2a2830', '#18161e', (y - CURB) / (H - CURB));
      if (bayer(x, y) < 0.08) c = lighten(c, 0.06);
      p.set(x, y, c);
    }
  for (let x = 0; x < STAGE_W; x += 32) p.rect(x, 214, 18, 2, '#c8a830');
  // crosswalk in perspective at the right end
  for (let k = 0; k < 6; k++)
    for (let y = CURB + 4; y < H; y++) {
      const s = 1 + (y - CURB) / 40;
      const x = 452 + (k - 2.5) * 10 * s;
      p.rect(Math.round(x), y, Math.round(5 * s), 1, mix('#d8d8d0', '#a8a8a0', (y - CURB) / 50));
    }
  // manhole
  p.ellipse(MANHOLE.x, MANHOLE.y, 14, 4, '#141418');
  p.ellipse(MANHOLE.x, MANHOLE.y, 12, 3, '#3a3a42');
  for (let k = -9; k <= 9; k += 3) p.rect(MANHOLE.x + k, MANHOLE.y - 2, 1, 5, '#26262e');
  // fire hydrant and a newspaper box on the sidewalk
  const hx = 286;
  p.rect(hx - 3, 162, 7, 12, '#c02020');
  p.rect(hx - 4, 160, 9, 3, '#e04040');
  p.rect(hx - 6, 166, 13, 3, '#a01818');
  p.rect(hx - 1, 157, 3, 3, '#c02020');
  p.rect(hx - 4, 173, 9, 2, '#801010');
  p.rect(20, 158, 14, 16, '#2a5ab0');
  p.rect(22, 160, 10, 6, '#c8d0e0');
  p.rect(20, 158, 14, 1, '#4a7ad0');
  // lamp posts
  for (const lx of LAMPS) {
    p.rect(lx - 1, 70, 3, CURB - 70, '#1a1a20');
    p.rect(lx - 2, CURB - 6, 5, 6, '#141418');
    p.rect(lx - 1, 70, 12, 2, '#1a1a20');
    p.rect(lx + 7, 72, 9, 3, '#2a2a30');
    p.rect(lx + 8, 75, 7, 1, '#fff0c0');
  }
  return p.canvas();
}

/** The magician's audience along the sidewalk, plus the card sharp at his table. */
function crowd(): Person[] {
  const r = rng(1657);
  const out: Person[] = [];
  for (let x = 8; x < STAGE_W - 6; x += r.int(10, 16)) {
    if (Math.abs(x - TABLE.x) < 18 || Math.abs(x - 286) < 7 || Math.abs(x - 27) < 9) continue;
    if (r.next() < 0.15) continue;
    out.push({ x, y: r.int(166, 176), skin: r.pick(SKINS), hair: r.pick(HAIRS), coat: r.pick(COATS), legs: r.pick(LEGS), ph: r.range(0, 1000), tall: r.int(0, 3), hat: r.pick([0, 0, 0, 1, 2]) as 0 | 1 | 2 });
  }
  out.forEach((p, i) => {
    if (i % 9 === 4) p.prop = 'flash';
    if (i % 13 === 7) p.prop = 'cam';
  });
  const fl = out.find((p) => p.x > 150 && p.x < 230 && !p.prop);
  if (fl) Object.assign(fl, { prop: 'float', coat: '#141418', legs: '#141418', hat: 0 });
  out.push({ x: TABLE.x, y: TABLE.y - 4, skin: '#d8a880', hair: '#141014', coat: '#5a2a6a', legs: '#1a1a2a', ph: 0, tall: 2, hat: 2, prop: 'dealer' });
  return out.sort((a, b) => a.y - b.y);
}

/** Neon text with a soft glow: drawn twice, the glow pass additive and wider. */
function neon(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string, on: number, scale = 1) {
  if (on <= 0) {
    drawText(ctx, s, x, y, darken(c, 0.65), { scale });
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 * on;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(ctx, s, x + dx, y + dy, c, { scale });
  ctx.restore();
  drawText(ctx, s, x, y, lighten(c, 0.55 * on), { scale });
}

export class StreetMagicStage {
  name = 'STREET MAGIC CITY';
  blurb = 'PICK A CARD. ANY CARD.';
  song: SongName = 'streetmagic';
  stakeColor = '#c8c8d0';
  sky = sky();
  city = city();
  street = street();
  people = crowd();
  pit: HTMLCanvasElement;
  pitLanding: PitLanding;
  /** Crowd excitement: jumps on every hit and fades. */
  cheer = 0;
  /** Frames left of a big gasp after a heavy hit. */
  gasp = 0;
  hp: number[] = [];

  constructor() {
    this.pit = this.buildPit();
    this.pitLanding = this.makeLanding();
  }

  reset() {
    this.cheer = 0;
    this.gasp = 0;
    this.hp = [];
  }

  update(f: Fight) {
    f.f.forEach((ft, i) => {
      const was = this.hp[i] ?? ft.hp;
      if (ft.hp < was) {
        this.cheer = Math.min(1, this.cheer + 0.35 + (was - ft.hp) / 200);
        if (was - ft.hp >= 60) this.gasp = 50;
      }
      this.hp[i] = ft.hp;
    });
    this.cheer *= 0.985;
    if (this.gasp > 0) this.gasp--;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    ctx.drawImage(this.city, -Math.round(camX * 0.5), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.street, dx, 0);
    this.drawNeon(ctx, dx, t);
    this.drawLamps(ctx, dx, t);
    for (const p of this.people) this.drawPerson(ctx, p, dx, t);
    this.drawTable(ctx, dx, t);
    this.drawStreetGlow(ctx, dx, t);
    this.drawSteam(ctx, dx, t);
  }

  /** Neon signs: a flickering MAGIC with a top hat, gold PAWN, green DELI with a blinking OPEN, and
   *  the theater marquee's chasing bulbs. */
  drawNeon(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    // PAWN, steady gold with three balls
    neon(ctx, 'PAWN', dx + 20, SIGN + 4, '#f0b030', 1, 1);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#e8c040';
      ctx.fillRect(dx + 60 + k * 7, SIGN + 6 + (k === 1 ? -2 : 0), 4, 4);
    }
    // MAGIC: the G gives out now and then
    const mx = dx + 112;
    const buzz = hash(Math.floor(t / 4)) < 0.08 ? 0 : 1;
    neon(ctx, 'MAGI', mx, SIGN + 1, '#ff40c0', 1, 2);
    neon(ctx, 'C', mx + 48, SIGN + 1, '#ff40c0', hash(Math.floor(t / 6) + 7) < 0.15 ? 0 : buzz, 2);
    // a neon top hat whose wand sparkles in turn
    const hx = dx + 186, hy = SIGN + 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(80,200,255,0.35)';
    ctx.fillRect(hx - 1, hy - 1, 14, 16);
    ctx.restore();
    ctx.fillStyle = '#a0e8ff';
    ctx.fillRect(hx + 2, hy, 8, 1);
    ctx.fillRect(hx + 2, hy, 1, 10);
    ctx.fillRect(hx + 9, hy, 1, 10);
    ctx.fillRect(hx - 1, hy + 10, 14, 1);
    const sp = Math.floor(t / 8) % 4;
    ctx.fillStyle = '#ffe080';
    ctx.fillRect(hx + 14, hy + 8 - sp * 2, 1, 1);
    for (let k = 0; k <= sp; k++) ctx.fillRect(hx + 12 + k * 2, hy + 12 - k * 2, 2, 1);
    if (sp === 3) {
      ctx.fillRect(hx + 21, hy + 4, 1, 3);
      ctx.fillRect(hx + 20, hy + 5, 3, 1);
    }
    // DELI and a blinking OPEN in the window
    neon(ctx, 'DELI', dx + ALLEY[1] + 30, SIGN + 2, '#40f070', 1, 2);
    neon(ctx, '24H', dx + ALLEY[1] + 84, SIGN + 6, '#ffe040', 1);
    neon(ctx, 'OPEN', dx + ALLEY[1] + 26, STORE + 11, '#ff3030', Math.floor(t / 40) % 2 ? 1 : 0.4);
    // the marquee: sign panel and a ring of chasing bulbs
    const qx = dx + 410, qy = SIGN - 4, qw = 96, qh = 22;
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(qx, qy, qw, qh);
    ctx.fillStyle = '#2a1430';
    ctx.fillRect(qx + 3, qy + 3, qw - 6, qh - 6);
    drawText(ctx, Math.floor(t / 180) % 2 ? 'TONIGHT' : 'VANISHING', qx + qw / 2, qy + 7, '#ffe8a0', { align: 'center' });
    let k = 0;
    const chase = Math.floor(t / 5);
    const bulb = (x: number, y: number) => {
      const on = (k++ + chase) % 3 === 0;
      ctx.fillStyle = on ? '#fff8c0' : '#8a6a30';
      ctx.fillRect(x, y, 2, 2);
    };
    for (let x = qx + 1; x < qx + qw - 2; x += 4) bulb(x, qy);
    for (let y = qy + 4; y < qy + qh - 2; y += 4) bulb(qx + qw - 2, y);
    for (let x = qx + qw - 3; x > qx; x -= 4) bulb(x, qy + qh - 2);
    for (let y = qy + qh - 6; y > qy; y -= 4) bulb(qx, y);
  }

  /** Warm cones of light under the lamps. */
  drawLamps(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, lx] of LAMPS.entries()) {
      const x = lx + 11 + dx;
      if (x < -60 || x > W + 60) continue;
      const fl = 0.9 + hash(Math.floor(t / 3) + i * 31) * 0.1;
      for (let y = 76; y < CURB + 10; y += 2) {
        const half = 3 + (y - 76) * 0.35;
        ctx.fillStyle = `rgba(255,220,150,${(0.05 + (y > WALK ? 0.04 : 0)) * fl})`;
        ctx.fillRect(Math.round(x - half), y, Math.round(half * 2), 2);
      }
    }
    ctx.restore();
  }

  /** Neon and lamp light reflected in the wet street, rippling. */
  drawStreetGlow(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const streaks: [number, number, string][] = [[36, 48, '240,176,48'], [112, 104, '255,64,192'], [192, 12, '120,220,255'], [ALLEY[1] + 30, 56, '64,240,112'], [410, 96, '255,232,160'], [LAMPS[0] + 8, 8, '255,220,150'], [LAMPS[1] + 8, 8, '255,220,150']];
    for (const [x0, w, c] of streaks) {
      for (let y = CURB + 6; y < H; y += 2) {
        const fade = 1 - (y - CURB) / (H - CURB);
        const wob = Math.round(Math.sin(y * 0.6 + t * 0.08) * 2);
        ctx.fillStyle = `rgba(${c},${0.1 * fade})`;
        ctx.fillRect(x0 + dx + wob, y, w, 1);
      }
    }
    ctx.restore();
  }

  /** Steam rolling up out of the manhole. */
  drawSteam(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const mx = MANHOLE.x + dx;
    if (mx < -40 || mx > W + 40) return;
    for (let i = 0; i < 14; i++) {
      const age = (t * 0.5 + i * 11) % 80;
      const x = mx + Math.sin(age * 0.08 + i) * (4 + age * 0.15) + age * 0.15;
      const y = MANHOLE.y - age * 1.1;
      const rr = 3 + age * 0.12;
      ctx.fillStyle = `rgba(200,200,215,${0.16 * (1 - age / 80)})`;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), rr, rr * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The three-card table: the sharp shuffles cards around, then flips the queen. */
  drawTable(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const x = TABLE.x + dx, y = TABLE.y;
    if (x < -30 || x > W + 30) return;
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(x - 12, y - 3, 1, 9);
    ctx.fillRect(x + 11, y - 3, 1, 9);
    ctx.fillStyle = '#1a5a3a';
    ctx.fillRect(x - 14, y - 6, 28, 3);
    ctx.fillStyle = '#2a7a4a';
    ctx.fillRect(x - 14, y - 6, 28, 1);
    const cyc = t % 240;
    for (let k = 0; k < 3; k++) {
      // during the shuffle the cards slide over one another; after it, the middle one turns up
      const shuffle = cyc < 150;
      const off = shuffle ? Math.round(Math.sin(cyc * 0.2 + k * 2.1) * 6) : 0;
      const cx = x - 10 + k * 8 + off, up = !shuffle && k === 1 && cyc > 170;
      ctx.fillStyle = up ? '#f8f8f0' : '#a02030';
      ctx.fillRect(cx, y - 8, 5, 2);
      if (up) {
        ctx.fillStyle = '#c02020';
        ctx.fillRect(cx + 2, y - 8, 1, 1);
      }
    }
  }

  /** One onlooker: idle shuffles, cheering on hits, hands to the head on a big one. Props: a camera
   *  flash, a camcorder held up, the levitating guy, and the card sharp behind his table. */
  drawPerson(ctx: CanvasRenderingContext2D, p: Person, dx: number, t: number) {
    const x = Math.round(p.x + dx);
    if (x < -10 || x > W + 10) return;
    const dealer = p.prop === 'dealer';
    const excited = !dealer && this.cheer > 0.15 && Math.sin(p.ph) * 0.5 + 0.5 < this.cheer + 0.3;
    const gasp = !dealer && this.gasp > 0 && hash(p.ph) < 0.7;
    const hop = excited && !gasp ? Math.round(Math.abs(Math.sin(t * 0.22 + p.ph)) * 2 * Math.min(1, this.cheer * 2)) : 0;
    const float = p.prop === 'float' ? Math.round(3 + Math.sin(t * 0.03 + p.ph) * 2) : 0;
    const legH = 8 + p.tall;
    const foot = p.y - hop - float;
    const hip = foot - legH;
    if (float) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 3, p.y - 1, 7, 1);
    }
    if (!dealer) {
      ctx.fillStyle = p.legs;
      ctx.fillRect(x - 3, hip, 2, legH);
      ctx.fillRect(x + 1, hip, 2, legH);
      ctx.fillStyle = '#141418';
      ctx.fillRect(x - 3, foot - 1, 3, 1);
      ctx.fillRect(x + 1, foot - 1, 3, 1);
    }
    const top = hip - 9;
    ctx.fillStyle = p.coat;
    ctx.fillRect(x - 3, top, 7, 10);
    ctx.fillStyle = css(darken(p.coat, 0.3));
    ctx.fillRect(x, top + 2, 1, 8);
    // arms
    ctx.fillStyle = p.skin;
    const hy = top - 6;
    if (gasp) {
      ctx.fillStyle = p.coat;
      ctx.fillRect(x - 5, hy + 1, 2, 7);
      ctx.fillRect(x + 4, hy + 1, 2, 7);
      ctx.fillStyle = p.skin;
      ctx.fillRect(x - 4, hy, 2, 2);
      ctx.fillRect(x + 3, hy, 2, 2);
    } else if (p.prop === 'cam') {
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(x - 6, hy + 1, 7, 4);
      ctx.fillStyle = Math.floor(t / 30) % 2 ? '#ff2020' : '#401010';
      ctx.fillRect(x - 6, hy + 1, 1, 1);
      ctx.fillStyle = p.coat;
      ctx.fillRect(x - 3, hy + 4, 2, 5);
    } else if (p.prop === 'flash') {
      const pop = this.cheer > 0.3 && hash(Math.floor(t / 7) + p.ph) < 0.12;
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(x + 3, hy - 1, 4, 3);
      ctx.fillStyle = p.coat;
      ctx.fillRect(x + 3, hy + 2, 2, 6);
      if (pop) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x + 1, hy - 4, 9, 9);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - 6, hy - 10, 22, 22);
        ctx.restore();
      }
    } else if (dealer) {
      // hands over the table, working the cards
      const sw = Math.round(Math.sin(t * 0.2) * 4);
      ctx.fillRect(x - 6 + sw, TABLE.y - 9, 2, 2);
      ctx.fillRect(x + 4 - sw, TABLE.y - 9, 2, 2);
      ctx.fillStyle = p.coat;
      ctx.fillRect(x - 5, top + 2, 2, TABLE.y - 9 - top - 2);
      ctx.fillRect(x + 4, top + 2, 2, TABLE.y - 9 - top - 2);
    } else if (p.prop === 'float') {
      ctx.fillStyle = p.coat;
      ctx.fillRect(x - 6, top + 1, 3, 2);
      ctx.fillRect(x + 4, top + 1, 3, 2);
    } else if (excited) {
      const w = Math.sin(t * 0.3 + p.ph) > 0 ? 1 : 0;
      ctx.fillRect(x - 5 - w, top - 5, 2, 6);
      ctx.fillRect(x + 4 + w, top - 5, 2, 6);
    } else {
      ctx.fillStyle = p.coat;
      ctx.fillRect(x - 4, top + 1, 1, 7);
      ctx.fillRect(x + 4, top + 1, 1, 7);
    }
    // head, hair, hat
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 2, hy, 5, 6);
    ctx.fillStyle = p.hair;
    ctx.fillRect(x - 2, hy - 1, 5, 2);
    if (p.hat === 1) {
      ctx.fillStyle = css(darken(p.coat, 0.2));
      ctx.fillRect(x - 2, hy - 2, 5, 3);
    } else if (p.hat === 2) {
      ctx.fillStyle = '#141418';
      ctx.fillRect(x - 2, hy - 5, 5, 4);
      ctx.fillRect(x - 3, hy - 1, 7, 1);
    }
    ctx.fillStyle = '#141014';
    ctx.fillRect(x - 1, hy + 2, 1, 1);
    ctx.fillRect(x + 1, hy + 2, 1, 1);
    if (gasp || excited) ctx.fillRect(x, hy + 4, 1, 1 + (gasp ? 1 : 0));
  }

  /** Playing cards fluttering down across the front, flicked from somewhere off-screen. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 7; i++) {
      const sp = 0.3 + (i % 3) * 0.08;
      const x = ((i * 113 + Math.sin(t * 0.02 + i) * 20 - camX * 1.1) % (W + 60) + W + 60) % (W + 60) - 30;
      const y = (t * sp + i * 97) % (H + 120) - 60;
      const flip = Math.abs(Math.sin(t * 0.07 + i * 1.3));
      const w = Math.max(1, Math.round(flip * 5));
      ctx.fillStyle = Math.sin(t * 0.07 + i * 1.3) > 0 ? '#f8f8f0' : '#a02030';
      ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 7);
      if (w > 3 && Math.sin(t * 0.07 + i * 1.3) > 0) {
        ctx.fillStyle = i % 2 ? '#c02020' : '#141418';
        ctx.fillRect(Math.round(x), Math.round(y) + 3, 1, 1);
      }
    }
  }

  // ---------------------------------------------------------------- uppercut stage finish

  /** Through the sidewalk cellar hatch into the magic shop's basement, a little stage set with a
   *  sawing-in-half cabinet waiting under a spotlight. */
  buildPit(): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1693);
    // cellar brick, warm in the middle under the bulb
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const row = y >> 2, off = row % 2 ? 4 : 0;
        const mortar = y % 4 === 3 || (x + off) % 8 === 7;
        const d = Math.hypot(x - 128, (y - 120) * 1.3) / 160;
        const base = mix('#6a3a2a', '#1a0e10', Math.min(1, d));
        p.set(x, y, mortar ? darken(base, 0.45) : darken(base, ((row * 7 + ((x + off) >> 3) * 13) % 5) * 0.04));
      }
    // the hatch overhead with streetlight pouring through
    p.rect(0, 0, W, 10, '#3a3840');
    p.rect(0, 10, W, 2, '#141418');
    p.rect(96, 0, 64, 12, '#a8b8d8');
    for (let y = 12; y < 170; y++) {
      const half = 32 + (y - 12) * 0.2;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) if (bayer(x, y) < 0.18 * (1 - y / 200)) p.set(x, y, lighten(p.get(x, y), 0.18));
    }
    p.poly([[160, 10], [166, 10], [176, 46], [170, 46]], '#5a3a20'); // the hatch door hanging open
    p.rect(171, 44, 6, 2, '#2a1a10');
    // red curtains framing the little stage
    for (const [x0, x1] of [[0, 54], [W - 54, W]]) {
      for (let y = 14; y < 176; y++)
        for (let x = x0; x < x1; x++) {
          const fold = Math.sin((x - x0) * 0.55);
          const tie = y > 110 && y < 116;
          let c: Color = fold > 0.4 ? '#c02838' : fold < -0.4 ? '#601018' : '#901828';
          if (tie) c = '#e0b040';
          // the curtains are gathered toward the tie-back, so cut a curve
          const gather = y > 112 ? Math.round((y - 112) * 0.3) : Math.round(Math.max(0, 112 - y) * 0.12);
          const edge = x0 === 0 ? x1 - gather : x0 + gather;
          if (x0 === 0 ? x > edge : x < edge) continue;
          p.set(x, y, c);
        }
    }
    p.rect(0, 12, W, 6, '#901828');
    for (let x = 0; x < W; x += 8) p.ellipse(x + 4, 18, 4, 3, '#c02838');
    // shelves of props on the back wall
    for (const [sx, sy] of [[60, 66], [150, 60]]) {
      p.rect(sx, sy, 46, 3, '#5a3a20');
      p.rect(sx, sy, 46, 1, '#8a5a32');
    }
    p.rect(64, 54, 10, 12, '#141418'); // top hat
    p.rect(61, 64, 16, 2, '#141418');
    p.rect(64, 61, 10, 2, '#a02030');
    for (let k = 0; k < 3; k++) for (let a = 0; a < Math.PI * 2; a += 0.15) p.set(Math.round(86 + k * 5 + Math.cos(a) * 5), Math.round(58 + Math.sin(a) * 5), '#d8d0c0'); // linking rings
    // a birdcage, empty, door open
    for (let k = 0; k < 7; k++) p.rect(154 + k * 3, 44, 1, 16, '#c8a040');
    p.rect(153, 44, 21, 1, '#c8a040');
    p.ellipse(163, 44, 10, 4, '#c8a040');
    p.rect(162, 36, 2, 4, '#c8a040');
    p.rect(152, 58, 22, 2, '#a88030');
    // a crate
    p.rect(182, 46, 22, 14, '#8a6a3a');
    p.rect(182, 46, 22, 1, '#a88a5a');
    p.line(182, 46, 204, 60, '#5a4020');
    // the stage floor
    for (let y = 176; y < H; y++)
      for (let x = 0; x < W; x++) {
        const plank = Math.floor((x + (y - 176) * 0) / 24);
        p.set(x, y, x % 24 === 0 ? '#2a180c' : darken('#7a4a2a', ((plank * 37) % 5) * 0.04 + (y - 176) / 120));
      }
    p.rect(0, 176, W, 1, '#a06a3a');
    // a scattering of cards on the floor
    for (let i = 0; i < 10; i++) {
      const cx = r.int(10, W - 16), cy = r.int(196, H - 10);
      p.rect(cx, cy, 6, 3, r.next() < 0.5 ? '#f0f0e8' : '#a02030');
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
      return cv;
  }

  /** The sawing-in-half finish: land in the cabinet, lid slams, feet pop out the end, the buzz saw
   *  goes through, the halves roll apart and a dove flies out of the gap. */
  makeLanding(): PitLanding {
    const REST = 150;
    const LID = [16, 30], FEET = 40, RISE = 128, DOVE = 176;
    /** Which way the victim's head points along x; set from their facing as they land. */
    let hs = 1;
    const pit = this.pit;
    return {
      pose: P(LIE, { rot: -90, af: -120, ef: -20, ab: -100, eb: -30 }),
      rest: REST,
      length: 260,
      land: (f) => {
        sfx.thud();
        sfx.land();
        f.shake(6);
        f.pitParticles.smoke(128, H - Y1, 8, '#a89888');
      },
      tick: (f, it) => {
        const ps = f.pitParticles;
        const g = geo(hs, it);
        if (it === LID[1]) {
          sfx.thud();
          sfx.hit(1);
          f.shake(4);
          ps.smoke(128, H - Y0, 6, '#c8b8a8');
        }
        if (it === FEET) sfx.twinkle();
        if (it === SAW[0]) sfx.scream();
        if (it >= SAW[0] && it < RISE && it % 6 === 0) buzz(it < SAW[1] ? 1 : 0.5);
        const depth = sawDepth(it);
        if (it > SAW[0] && it < SAW[1] && depth > Y0) {
          // sawdust spraying from the cut
          for (let i = 0; i < 2; i++)
            ps.add({ kind: 'spark', x: g.cut + rand(-2, 2), y: H - Y0, vx: rand(-1.8, 1.8), vy: rand(0.6, 2.4), life: 30, max: 30, color: rand() < 0.5 ? '#e8c890' : '#c8a060', size: 1, grav: 0.12, floor: false });
          if (it % 10 === 0) ps.sparks(g.cut, H - Math.min(depth, Y1), 4, '#fff6a0');
        }
        if (it === SPLIT[0]) squeak();
        if (it > SPLIT[0] && it < SPLIT[1] + 30 && it % 5 === 0) ps.blood(g.mid, H - (Y0 + 8 + rand(0, 10)), rand(-0.4, 0.4), 1, 0.6);
        if (it === DOVE) {
          sfx.sparkle();
          ps.sparks(g.mid, H - Y0, 14, '#ffffff');
          ps.smoke(g.mid, H - Y0, 6, '#f0f0f8');
        }
        if (it === DOVE + 30) sfx.sing([[0, 1], [4, 1], [7, 1], [12, 3]], 0.12, 0.16);
      },
      victim: (l, it) => {
        hs = -l.facing;
        // flailing until the lid comes down, then arms tucked inside along the body
        const j = Math.sin(it * 0.8) * 30;
        l.poseOverride = it < LID[1]
          ? P(LIE, { rot: -90, af: -120 + j, ef: -20, ab: -100 - j, eb: -30, lf: 0, kf: 0, lb: 0, kb: 0 })
          : P(LIE, { rot: -90, af: 15, ef: -5, ab: 10, eb: -5, lf: 0, kf: 0, lb: 0, kb: 0 });
        l.computePose();
        return Math.min(10, it * 2); // settle down into the cabinet
      },
      draw: (ctx, it) => {
        const g = geo(hs, it);
        // the saw is behind the cabinet's front panel
        if (it >= SAW[0] && it < RISE + 30) drawSaw(ctx, g.cut, sawDepth(it), it);
        if (g.gap === 0) {
          cabinet(ctx, g.x0, g.x1, it);
          neckHole(ctx, g.neck, hs);
          if (it >= FEET) feet(ctx, g.toe, -hs, it);
          // the cut, as deep as the saw has gone
          const d = Math.min(Y1, sawDepth(it));
          if (it > SAW[0] && d > Y0) {
            ctx.fillStyle = '#1a0e08';
            ctx.fillRect(g.cut, Y0, 1, d - Y0);
          }
        } else {
          // repaint the backdrop in the gap so the middle of the victim is simply gone
          const gx = Math.min(g.cut, g.cut - hs * g.gap);
          ctx.drawImage(pit, gx, Y0 - 30, g.gap, Y1 - Y0 + 50, gx, Y0 - 30, g.gap, Y1 - Y0 + 50);
          const away = -hs * g.gap;
          const [h0, h1] = hs > 0 ? [g.cut, g.x1] : [g.x0, g.cut];
          const [f0, f1] = hs > 0 ? [g.x0 + away, g.cut + away] : [g.cut + away, g.x1 + away];
          cabinet(ctx, h0, h1, it);
          neckHole(ctx, g.neck, hs);
          cabinet(ctx, f0, f1, it);
          feet(ctx, g.toe + away, -hs, it);
          cutFace(ctx, hs > 0 ? h0 : h1 - 1);
          cutFace(ctx, hs > 0 ? f1 - 1 : f0);
        }
        // the lid: open and upright at first, swinging shut over the top
        const lt = it < LID[0] ? 0 : Math.min(1, (it - LID[0]) / (LID[1] - LID[0]));
        const lidH = Math.max(3, Math.round(Math.cos((lt * lt * Math.PI) / 2) * 28));
        if (g.gap === 0) lid(ctx, g.x0, g.x1, lidH);
        else {
          const away = -hs * g.gap;
          if (hs > 0) {
            lid(ctx, g.cut, g.x1, 3);
            lid(ctx, g.x0 + away, g.cut + away, 3);
          } else {
            lid(ctx, g.x0, g.cut, 3);
            lid(ctx, g.cut + away, g.x1 + away, 3);
          }
        }
        // the dove takes off from the gap and flaps away up through the hatch
        if (it >= DOVE) {
          const k = it - DOVE;
          dove(ctx, g.mid + k * 0.6 + Math.sin(k * 0.1) * 6, Y0 - 4 - k * 1.2, k);
        }
        if (it >= DOVE + 20) drawText(ctx, 'TA-DA!', 128, 26, '#ffe8a0', { align: 'center', scale: 2, outline: '#3a1020' });
      },
    };
  }
}

/** Top and bottom of the cabinet in the pit close-up. */
const Y0 = 138, Y1 = 162;
const SAW = [56, 112], SPLIT = [140, 166];

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Cabinet layout for a victim whose head points hs along x: the ends, the neck hole, where the
 *  shoes stick out, the saw line, and how far apart the halves have rolled. */
function geo(hs: number, it: number) {
  const neck = 128 + hs * 22, end = 128 - hs * 46, cut = 128 - hs * 12;
  const gap = it < SPLIT[0] ? 0 : Math.round(easeOut(Math.min(1, (it - SPLIT[0]) / (SPLIT[1] - SPLIT[0]))) * 30);
  return { x0: Math.min(neck, end), x1: Math.max(neck, end), neck, toe: end - hs, cut, gap, mid: cut - (hs * gap) / 2 };
}

/** How far down the buzz saw's lowest edge has got (screen y). */
function sawDepth(it: number): number {
  if (it < SAW[0]) return -10;
  if (it < 76) return -10 + ((it - SAW[0]) / 20) * (Y0 - 4 + 10); // drop onto the lid
  if (it < SAW[1]) return Y0 - 4 + ((it - 76) / 36) * 32; // grind through
  if (it < 128) return Y0 + 28;
  return Y0 + 28 - ((it - 128) / 30) * 200;
}

function drawSaw(ctx: CanvasRenderingContext2D, x: number, bottom: number, it: number) {
  const R = 22, cy = bottom - R;
  // the arm it hangs from
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(x - 2, 0, 4, Math.max(0, cy));
  ctx.fillStyle = '#5a5a66';
  ctx.fillRect(x - 2, 0, 1, Math.max(0, cy));
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(it * 0.9);
  ctx.fillStyle = '#b8bcc8';
  ctx.beginPath();
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 0.6) / 24) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * (R - 3), Math.sin(a0) * (R - 3));
    ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a8e9a';
  ctx.beginPath();
  ctx.arc(0, 0, R - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ecf4';
  ctx.fillRect(-R + 6, -1, 6, 2);
  ctx.restore();
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x - 3, cy - 3, 6, 6);
}

/** One section of the cabinet: red lacquer with gold stars and trim, on a wheeled stand. */
function cabinet(ctx: CanvasRenderingContext2D, x0: number, x1: number, it: number) {
  const y0 = Y0, y1 = Y1;
  const w = x1 - x0;
  if (w <= 0) return;
  ctx.fillStyle = '#a01828';
  ctx.fillRect(x0, y0, w, y1 - y0);
  ctx.fillStyle = '#c83040';
  ctx.fillRect(x0, y0, w, 2);
  ctx.fillStyle = '#600c18';
  ctx.fillRect(x0, y1 - 2, w, 2);
  ctx.fillStyle = '#e0b040';
  ctx.fillRect(x0, y0 + 3, w, 1);
  ctx.fillRect(x0, y1 - 4, w, 1);
  for (let sx = Math.ceil((x0 + 4) / 14) * 14; sx < x1 - 3; sx += 14) {
    const sy = y0 + 12;
    ctx.fillRect(sx - 1, sy - 3, 3, 7);
    ctx.fillRect(sx - 3, sy - 1, 7, 3);
    ctx.fillStyle = '#fff0a0';
    ctx.fillRect(sx, sy, 1, 1);
    ctx.fillStyle = '#e0b040';
  }
  // stand and wheels
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x0 + 2, y1, w - 4, 3);
  ctx.fillRect(x0 + 4, y1 + 3, 2, 10);
  ctx.fillRect(x1 - 6, y1 + 3, 2, 10);
  const spin = Math.floor(it / 3) % 2;
  for (const wx of [x0 + 5, x1 - 5]) {
    ctx.fillStyle = '#141418';
    ctx.fillRect(wx - 3, y1 + 13, 6, 4);
    ctx.fillStyle = '#8a8a90';
    ctx.fillRect(wx - 1 + spin, y1 + 14, 1, 1);
  }
}

/** The lid, seen edge-on as it swings shut. */
function lid(ctx: CanvasRenderingContext2D, x0: number, x1: number, h: number) {
  const y0 = Y0;
  ctx.fillStyle = '#801420';
  ctx.fillRect(x0, y0 - h, x1 - x0, h);
  ctx.fillStyle = '#e0b040';
  ctx.fillRect(x0, y0 - h, x1 - x0, 1);
  if (h > 8) {
    ctx.fillStyle = '#c83040';
    ctx.fillRect(x0 + 2, y0 - h + 2, x1 - x0 - 4, h - 4);
  }
}

/** A collar cut-out at the neck end so the head sits outside the box. */
function neckHole(ctx: CanvasRenderingContext2D, x: number, hs: number) {
  ctx.fillStyle = '#e0b040';
  ctx.fillRect(x - (hs > 0 ? 2 : 0), Y0, 2, Y1 - Y0);
}

/** A pair of shoes sticking out of the feet end, wiggling. */
function feet(ctx: CanvasRenderingContext2D, x: number, dir: number, it: number) {
  const y = Y0 + 6;
  for (let k = 0; k < 2; k++) {
    const wig = Math.round(Math.sin(it * (it > 140 ? 0.6 : 0.3) + k * 2) * 2);
    const fy = y + k * 7;
    ctx.fillStyle = '#e8e8e0';
    ctx.fillRect(dir > 0 ? x : x - 4, fy, 4, 4); // sock
    ctx.fillStyle = '#141418';
    const sx = dir > 0 ? x + 4 : x - 8;
    ctx.fillRect(sx, fy - 1, 4, 6);
    ctx.fillRect(dir > 0 ? sx + 3 : sx - 1, fy - 3 + wig, 2, 6); // toe up, wiggling
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(sx + 1, fy, 1, 1);
  }
}

/** The raw end of a sawn half: splintered wood and a dark inside. */
function cutFace(ctx: CanvasRenderingContext2D, x: number) {
  const y0 = Y0, y1 = Y1;
  ctx.fillStyle = '#e8c890';
  ctx.fillRect(x, y0, 1, y1 - y0);
  ctx.fillStyle = '#5a0a10';
  ctx.fillRect(x, y0 + 4, 1, y1 - y0 - 8);
  for (let y = y0; y < y1; y += 5) {
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(x, y, 1, 1);
  }
}

/** A white dove with flapping wings. */
function dove(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  const X = Math.round(x), Y = Math.round(y);
  const up = Math.floor(k / 4) % 2 === 0;
  ctx.fillStyle = '#f8f8ff';
  ctx.fillRect(X - 3, Y, 7, 3);
  ctx.fillRect(X + 3, Y - 2, 3, 3);
  ctx.fillStyle = '#f0a040';
  ctx.fillRect(X + 6, Y - 1, 1, 1);
  ctx.fillStyle = '#141418';
  ctx.fillRect(X + 4, Y - 1, 1, 1);
  ctx.fillStyle = '#e0e0f0';
  if (up) {
    ctx.fillRect(X - 2, Y - 4, 4, 4);
    ctx.fillRect(X - 4, Y - 6, 3, 3);
  } else {
    ctx.fillRect(X - 2, Y + 2, 4, 3);
    ctx.fillRect(X - 4, Y + 4, 3, 2);
  }
  ctx.fillRect(X - 5, Y + 1, 2, 2);
}

/** One rasp of the buzz saw. */
function buzz(vol: number) {
  const c = ac();
  if (!c) return;
  tone({ type: 'sawtooth', freq: 180, to: 140, dur: 0.12, vol: 0.06 * vol });
  noise({ dur: 0.1, vol: 0.12 * vol, type: 'bandpass', freq: 3200, q: 3 });
}

/** The cabinet's casters squealing as the halves roll apart. */
function squeak() {
  tone({ type: 'square', freq: 1400, to: 1900, dur: 0.25, vol: 0.04 });
  tone({ type: 'square', freq: 1500, to: 1200, dur: 0.3, vol: 0.03, at: (ac()?.currentTime ?? 0) + 0.25 });
}

