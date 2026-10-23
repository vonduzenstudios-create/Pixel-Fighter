import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng, Rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';

// "Tomb of the Sun King": a sandstone temple court at the foot of a great pyramid, at sunset.
// Painted columns and jackal guardians frame the plaza, braziers burn between them, vultures
// wheel overhead and sand gusts across the floor. The uppercut drops the loser through a
// trapdoor into the tomb's spike-and-snake pit. All art is procedural, all glyphs are made up.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
const BRAZIERS = [92, 256, 420];
const SUN = { x: 184, y: 116, r: 22 };

const SAND = '#d8a060';
const STONE = '#c8925a';

/** A tiny invented glyph (bird, eye, reed, wave, loop or zig-zag) carved into stone. */
function glyph(p: Painter, x: number, y: number, r: Rng, ink: Color) {
  switch (r.int(0, 5)) {
    case 0: // a little bird
      p.rect(x + 1, y + 1, 3, 2, ink); p.set(x + 4, y + 1, ink); p.set(x, y + 3, ink); p.rect(x + 1, y + 3, 1, 2, ink); p.rect(x + 3, y + 3, 1, 2, ink);
      break;
    case 1: // an eye
      p.rect(x, y + 2, 5, 1, ink); p.set(x + 2, y + 1, ink); p.set(x + 2, y + 3, ink); p.set(x + 1, y + 4, ink);
      break;
    case 2: // a reed
      p.rect(x + 2, y, 1, 5, ink); p.set(x + 1, y, ink); p.set(x + 3, y + 1, ink);
      break;
    case 3: // water
      for (let k = 0; k < 5; k++) { p.set(x + k, y + 1 + (k % 2), ink); p.set(x + k, y + 3 + (k % 2), ink); }
      break;
    case 4: // a loop over a cross bar
      p.set(x + 2, y, ink); p.set(x + 1, y + 1, ink); p.set(x + 3, y + 1, ink); p.rect(x, y + 2, 5, 1, ink); p.rect(x + 2, y + 3, 1, 2, ink);
      break;
    default: // zig-zag
      for (let k = 0; k < 5; k++) p.set(x + k, y + (k % 2 ? 1 : 3), ink);
      p.rect(x + 1, y + 4, 3, 1, ink);
  }
}

/** Fill a rectangle with sandstone blocks in running bond. */
function blocks(p: Painter, x0: number, y0: number, w: number, h: number, base: Color, bh: number, bw: number, seed: number) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / bh), off = row % 2 ? bw >> 1 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const joint = (y - y0) % bh === bh - 1 || (x - x0 + off) % bw === bw - 1;
      const tint = ((row * 5 + Math.floor((x - x0 + off) / bw) * 11) % 4) * 0.04;
      let c: Color = joint ? darken(base, 0.4) : darken(base, tint);
      if (!joint && (y - y0) % bh === 0) c = lighten(c, 0.12);
      if (!joint && bayer(x, y) < 0.08) c = darken(c, 0.1);
      p.set(x, y, c);
    }
  }
  // a few weathered chips
  for (let i = 0; i < (w * h) / 300; i++) p.set(x0 + r.int(0, w - 1), y0 + r.int(0, h - 1), darken(base, 0.3));
}

/** Sunset sky with a banded sun and the first stars. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops: [number, Color][] = [[0, '#1c1238'], [60, '#4a2450'], [100, '#c04a3a'], [130, '#f08a3a'], [150, '#ffc868']];
  for (let y = 0; y < H; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    for (let x = 0; x < W; x++) {
      const q = Math.floor(t * 4 + bayer(x, y)) / 4;
      p.set(x, y, mix(c0, c1, q));
    }
  }
  const r = rng(1201);
  for (let i = 0; i < 40; i++) {
    const x = r.int(0, W - 1), y = r.int(0, 60);
    p.set(x, y, r.next() < 0.3 ? '#fff4d8' : '#a890b0');
  }
  // the sun, sliced by thin bands of haze near the horizon
  for (let y = SUN.y - SUN.r; y <= SUN.y + SUN.r; y++)
    for (let x = SUN.x - SUN.r; x <= SUN.x + SUN.r; x++) {
      const dx = x - SUN.x, dy = y - SUN.y, d = Math.sqrt(dx * dx + dy * dy) / SUN.r;
      if (d > 1) continue;
      const band = y > SUN.y && (y - SUN.y) % 5 < (y - SUN.y) / 7;
      if (band) continue;
      p.set(x, y, d < 0.75 ? '#fff0b0' : '#ffd070');
    }
  // soft glow ring around it
  for (let y = SUN.y - 44; y < SUN.y + 30; y++)
    for (let x = SUN.x - 44; x < SUN.x + 44; x++) {
      const dx = x - SUN.x, dy = y - SUN.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > SUN.r && d < 44 && bayer(x, y) < (1 - (d - SUN.r) / 22) * 0.35) p.set(x, y, mix(p.get(x, y), '#ffe090', 0.4));
    }
  // long thin clouds lit from below
  for (const [cy, cx, len] of [[44, 30, 90], [70, 150, 110], [88, 20, 70]]) {
    for (let x = cx; x < cx + len; x++) {
      const th = Math.round(2 * Math.sin(((x - cx) / len) * Math.PI));
      for (let k = 0; k <= th; k++) p.set(x, cy - k, k === 0 ? '#f09060' : '#8a4060');
    }
  }
  return p.canvas();
}

/** Draws one stepped pyramid: lit right face, shadowed left face, gilded cap. */
function pyramid(p: Painter, cx: number, apex: number, base: number, slope: number, hue: Color) {
  for (let y = apex; y < base; y++) {
    const half = (y - apex) * slope;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const lit = x >= cx + (y - apex) * 0.15;
      let c: Color = lit ? hue : darken(mix(hue, '#6a3050', 0.4), 0.35);
      if ((y - apex) % 3 === 2) c = darken(c, 0.18); // stone courses
      if (y - apex < 7) c = lit ? '#ffe080' : '#b08030'; // capstone
      p.set(x, y, c);
    }
  }
}

/** Far layer: distant pyramids over rolling dunes, with a few palm silhouettes. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  pyramid(p, 70, 64, 150, 0.95, '#e8a868');
  pyramid(p, 196, 88, 150, 0.95, '#d89a60');
  pyramid(p, 286, 108, 150, 0.95, '#c88a58');
  for (let x = 0; x < FAR_W; x++) {
    const top = Math.round(144 + Math.sin(x * 0.03) * 4 + Math.sin(x * 0.071 + 1) * 3);
    for (let y = top; y < H; y++) {
      const t = (y - top) / 30;
      p.set(x, y, mix(y === top ? '#f8c880' : '#d88c48', '#9a5030', Math.min(1, Math.floor(t * 3 + bayer(x, y)) / 3)));
    }
  }
  // palms
  for (const px of [140, 250, 312]) {
    const base = 150;
    for (let k = 0; k < 22; k++) p.set(px + Math.round(Math.sin(k * 0.12) * 2), base - k, '#3a1e20');
    const tx = px + Math.round(Math.sin(22 * 0.12) * 2), ty = base - 22;
    for (const a of [-2.6, -2.1, -1.4, -0.9, -0.3]) for (let k = 0; k < 9; k++) p.set(tx + Math.cos(a) * k, ty + Math.sin(a) * k * 0.6 + k * k * 0.05, '#2a1418');
  }
  return p.canvas();
}

/** A painted papyrus column with a flared capital, standing from y0 to the floor. */
function column(p: Painter, cx: number, y0: number, broken: boolean, r: Rng) {
  const top = broken ? y0 + r.int(30, 60) : y0;
  for (let y = top; y < FLOOR; y++) {
    const half = 7 + (y > FLOOR - 10 ? 1 : 0);
    for (let x = cx - half; x <= cx + half; x++) {
      const k = x - cx;
      let c: Color = STONE;
      if (Math.abs(k) % 3 === 0) c = darken(STONE, 0.12); // fluting
      if (k > 3) c = darken(c, 0.25);
      if (k < -4) c = lighten(c, 0.12);
      p.set(x, y, c);
    }
  }
  if (broken) {
    // jagged snapped top, and the drum that fell off lying at the base
    for (let x = cx - 7; x <= cx + 7; x++) for (let k = 0; k < r.int(0, 5); k++) p.set(x, top + k, [0, 0, 0], 0);
    p.ellipse(cx + 14, FLOOR - 6, 10, 6, darken(STONE, 0.1));
    p.rect(cx + 6, FLOOR - 7, 16, 1, darken(STONE, 0.3));
    return;
  }
  // painted bands under the capital
  const bands: Color[] = ['#2a5a9a', '#c8a040', '#a83a2a', '#c8a040', '#2a5a9a'];
  bands.forEach((c, i) => p.rect(cx - 7, top + 16 + i * 2, 15, 2, c));
  // flared lotus capital
  for (let y = top; y < top + 16; y++) {
    const half = 7 + Math.round(((top + 16 - y) / 16) * 6);
    for (let x = cx - half; x <= cx + half; x++) {
      const petal = Math.abs(x - cx) % 4 === 0;
      p.set(x, y, petal ? '#3a7a5a' : x > cx + 3 ? darken(STONE, 0.2) : STONE);
    }
  }
  p.rect(cx - 13, top - 4, 27, 4, darken(STONE, 0.05)); // abacus block
  // glyph column down the shaft
  for (let y = top + 30; y < FLOOR - 16; y += 8) glyph(p, cx - 2, y, r, darken(STONE, 0.5));
}

/** A seated jackal guardian on a plinth, facing dir (1 = right). */
function jackal(p: Painter, cx: number, dir: number) {
  const base = FLOOR, s = (dx: number) => cx + dx * dir;
  blocks(p, cx - 16, base - 18, 33, 18, darken(STONE, 0.1), 6, 11, cx);
  p.rect(cx - 17, base - 20, 35, 2, lighten(STONE, 0.1));
  const body = '#1e1a22', gold = '#d8b048';
  // haunch, chest and forelegs
  p.ellipse(s(-5), base - 30, 9, 10, body);
  p.poly([[s(-2), base - 46], [s(8), base - 44], [s(9), base - 20], [s(2), base - 20]], body);
  p.rect(Math.min(s(4), s(9)), base - 26, 6, 6, body);
  // tail curling forward along the plinth
  p.rect(Math.min(s(-14), s(4)), base - 22, 18, 2, body);
  // neck, head, long snout, tall ears
  p.poly([[s(0), base - 46], [s(7), base - 48], [s(8), base - 58], [s(2), base - 58]], body);
  p.poly([[s(2), base - 62], [s(9), base - 64], [s(17), base - 58], [s(16), base - 56], [s(6), base - 55]], body);
  p.poly([[s(2), base - 62], [s(3), base - 74], [s(6), base - 63]], body);
  p.poly([[s(5), base - 63], [s(7), base - 75], [s(9), base - 63]], body);
  // gold collar and eye
  p.rect(Math.min(s(0), s(8)), base - 48, 9, 2, gold);
  p.set(s(9), base - 60, gold);
}

/** Mid layer: the temple colonnade and its lintel, with two guardians. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1223);
  const xs: number[] = [];
  for (let x = 26; x < MID_W; x += 62) xs.push(x);
  xs.forEach((x, i) => column(p, x, 64, i === 3, r));
  // lintel runs between intact columns, with a gap over the broken one
  for (let i = 0; i < xs.length - 1; i++) {
    if (i === 2 || i === 3) continue;
    const a = xs[i] - 13, b = xs[i + 1] + 13;
    blocks(p, a, 46, b - a, 14, STONE, 7, 20, 1230 + i);
    for (let x = a; x < b; x++) p.set(x, 59, '#2a5a9a');
    for (let x = a + 4; x < b - 6; x += 9) glyph(p, x, 48, r, darken(STONE, 0.5));
  }
  // a winged sun disc carved over the middle span
  const wx = Math.round((xs[1] + xs[2]) / 2);
  p.ellipse(wx, 40, 5, 5, '#e8b040');
  for (let k = 0; k < 18; k++) {
    const y = 40 - Math.round(Math.sin((k / 18) * Math.PI) * 3) + (k > 12 ? 1 : 0);
    p.rect(wx + 6 + k, y, 1, 3, k % 3 ? '#2a5a9a' : '#c8a040');
    p.rect(wx - 6 - k, y, 1, 3, k % 3 ? '#2a5a9a' : '#c8a040');
  }
  jackal(p, xs[1] + 31, 1);
  jackal(p, xs[4] + 31, -1);
  p.shade(0.12, 1, -1);
  p.outline('#3a1a14');
  // the low sun washes the whole court in orange
  for (let y = 0; y < H; y++)
    for (let x = 0; x < MID_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.3) p.set(x, y, mix(p.get(x, y), '#e06030', 0.25));
  return p.canvas();
}

/** The plaza: tiled floor with a sun inlay, two obelisks, brazier stands and a carved frieze. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1249);
  // obelisks at either end of the court
  for (const ox of [18, STAGE_W - 18]) {
    for (let y = 30; y < FLOOR; y++) {
      const half = 5 + Math.round(((y - 30) / (FLOOR - 30)) * 4);
      for (let x = ox - half; x <= ox + half; x++) p.set(x, y, x > ox + 1 ? darken(STONE, 0.3) : x < ox - half + 2 ? lighten(STONE, 0.15) : STONE);
    }
    p.poly([[ox - 5, 30], [ox, 20], [ox + 5, 30]], '#f0c050');
    for (let y = 40; y < FLOOR - 10; y += 8) glyph(p, ox - 2, y, r, darken(STONE, 0.5));
  }
  // brazier stands: a tripod under a bronze bowl
  for (const bx of BRAZIERS) {
    p.line(bx, FLOOR - 1, bx, FLOOR - 26, '#5a3a1a');
    p.line(bx - 7, FLOOR - 1, bx - 2, FLOOR - 24, '#6a4420');
    p.line(bx + 7, FLOOR - 1, bx + 2, FLOOR - 24, '#4a2e14');
    p.poly([[bx - 9, FLOOR - 32], [bx + 9, FLOOR - 32], [bx + 6, FLOOR - 25], [bx - 6, FLOOR - 25]], '#a06a2a');
    p.rect(bx - 9, FLOOR - 32, 19, 1, '#e0a050');
    p.rect(bx - 5, FLOOR - 33, 11, 1, '#3a1a08'); // coals
  }
  p.shade(0.15, 1, -1);
  p.outline('#2a120c');
  // floor tiles
  for (let y = FLOOR; y < FLOOR + 8; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const row = y - FLOOR < 4 ? 0 : 1;
      const joint = (x + row * 12) % 24 === 0 || y === FLOOR + 3 || y === FLOOR + 7;
      let c: Color = y === FLOOR ? '#f0c088' : joint ? '#7a4a2a' : row ? '#b07a48' : '#c88c56';
      if (!joint && bayer(x, y) < 0.1) c = darken(c, 0.12);
      p.set(x, y, c);
    }
  // a gilded sun disc inlaid at centre court
  for (let x = 216; x < 296; x++) {
    const d = Math.abs(x - 256) / 40;
    if (d < 1) for (let y = FLOOR + 1; y < FLOOR + 7; y++) if (Math.abs(x - 256) < 40 * Math.sqrt(1 - ((y - FLOOR - 4) / 4) ** 2)) p.set(x, y, d < 0.35 ? '#f0c040' : (x % 4 === 0 ? '#f0c040' : '#a87030'));
  }
  // sand drifted into the joints
  for (let i = 0; i < 40; i++) {
    const sx = r.int(0, STAGE_W), w = r.int(4, 16);
    for (let x = sx; x < sx + w; x++) p.set(x, FLOOR + (bayer(x, 0) < 0.5 ? 0 : 1), SAND);
  }
  // carved frieze along the plaza edge: a glyph band between painted borders
  p.rect(0, FLOOR + 8, STAGE_W, 1, '#2a5a9a');
  blocks(p, 0, FLOOR + 9, STAGE_W, H - FLOOR - 9, '#a87048', 9, 30, 1261);
  for (let x = 4; x < STAGE_W; x += 8) glyph(p, x, FLOOR + 11, r, '#5a3420');
  p.rect(0, FLOOR + 18, STAGE_W, 1, '#c8a040');
  for (let x = 0; x < STAGE_W; x++) for (let y = FLOOR + 19; y < H; y++) if (bayer(x, y) < 0.5) p.set(x, y, darken(p.get(x, y), 0.35));
  return p.canvas();
}

export class PyramidStage {
  name = 'TOMB OF THE SUN KING';
  blurb = 'THE SANDS REMEMBER EVERY FALL';
  song: SongName = 'pyramid';
  sky = sky();
  far = far();
  mid = mid();
  deck = deck();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  /** Through the trapdoor into the burial shaft: bronze stakes, snakes and old treasure. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1283);
    p.gradRect(0, 0, W, H, '#3a2418', '#0a0604', 8);
    // block walls with glyph bands, darkening toward the bottom
    blocks(p, 0, 0, 40, H, '#6a4428', 10, 20, 1291);
    blocks(p, W - 40, 0, 40, H, '#6a4428', 10, 20, 1297);
    for (let y = 16; y < 150; y += 30) {
      for (let x = 3; x < 36; x += 7) glyph(p, x, y, r, '#2a160c');
      for (let x = W - 37; x < W - 4; x += 7) glyph(p, x, y, r, '#2a160c');
    }
    for (let y = 0; y < H; y++)
      for (const [a, b] of [[0, 40], [W - 40, W]]) for (let x = a; x < b; x++) if (bayer(x, y) < y / H) p.set(x, y, darken(p.get(x, y), 0.5));
    // the trapdoor above, and evening light falling through it in a dusty column
    p.rect(0, 0, W, 8, '#4a2e1a');
    p.rect(98, 0, 60, 8, '#ffc870');
    for (let y = 8; y < 196; y++) {
      const half = 30 + (y - 8) * 0.18;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) {
        const edge = 1 - Math.abs(x - 128) / half;
        if (bayer(x, y) < edge * 0.3 * (1 - y / 280)) p.set(x, y, mix(p.get(x, y), '#e8a050', 0.4));
      }
    }
    // a hinged trapdoor leaf hanging open
    p.poly([[98, 8], [102, 8], [92, 44], [88, 44]], '#5a3a20');
    // an open sarcophagus leaning on the left wall, and spilled gold on the right
    p.poly([[42, 180], [50, 110], [70, 106], [72, 182]], '#2a5a9a');
    p.poly([[46, 178], [53, 116], [67, 112], [68, 180]], '#c8a040');
    p.ellipse(60, 122, 6, 7, '#e8c060');
    p.rect(54, 130, 12, 2, '#2a5a9a');
    for (let i = 0; i < 70; i++) {
      const x = r.int(186, 214), y = 190 - Math.round(Math.sqrt(Math.max(0, 1 - ((x - 200) / 15) ** 2)) * 14) + r.int(0, 10);
      p.set(x, y, r.next() < 0.4 ? '#fff0a0' : '#d8a030');
    }
    p.rect(204, 168, 8, 10, '#d8a030'); // a little golden urn
    p.ellipse(208, 168, 5, 2, '#f0c050');
    // the stake field
    for (let row = 0; row < 3; row++) {
      const baseY = 186 + row * 14, hgt = 34 + row * 6;
      for (let sx = -4 + row * 7; sx < W + 8; sx += 15 - row * 2) {
        const h = hgt + r.int(-6, 6);
        const col = row === 2 ? '#a07a40' : row === 1 ? '#7a5a30' : '#5a4024';
        p.poly([[sx - 4, baseY + 20], [sx, baseY - h + 20], [sx + 4, baseY + 20]], col);
        p.line(sx, baseY - h + 21, sx - 2, baseY + 18, lighten(col, 0.35));
        if (r.next() < 0.4) for (let k = 0; k < 6; k++) p.set(sx + r.int(-1, 1), baseY - h + 21 + k + r.int(0, 3), k < 3 ? '#a01010' : '#600808');
      }
    }
    // snakes winding between the stakes
    for (const [sx, sy, len, ph] of [[24, 206, 60, 0], [150, 212, 70, 1.7], [90, 198, 40, 3.1]]) {
      for (let k = 0; k < len; k++) {
        const x = sx + k, y = sy + Math.round(Math.sin(k * 0.25 + ph) * 3);
        p.rect(x, y, 1, 3, k % 6 < 3 ? '#4a7a2a' : '#6a9a3a');
        p.set(x, y + 2, '#2a4a18');
      }
      const hx = sx + len, hy = sy + Math.round(Math.sin(len * 0.25 + ph) * 3);
      p.ellipse(hx + 2, hy - 2, 3, 2, '#5a8a32');
      p.set(hx + 3, hy - 3, '#ffe040');
      p.line(hx + 5, hy - 2, hx + 7, hy - 1, '#c02020');
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[72, 178, -100, 1], [146, 186, -70, -1]]) {
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
    // vultures wheeling high over the pyramids
    ctx.fillStyle = '#1a0e18';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.008 + i * 2.1;
      const x = Math.round(120 + i * 40 + Math.cos(a) * (30 + i * 8) - camX * 0.1);
      const y = Math.round(40 + i * 10 + Math.sin(a) * 10);
      const flap = Math.sin(t * 0.09 + i) > 0.6 ? 1 : 0;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x - 4, y - 1 + flap, 3, 1);
      ctx.fillRect(x + 2, y - 1 + flap, 3, 1);
      ctx.fillRect(x - 6, y - flap, 2, 1);
      ctx.fillRect(x + 5, y - flap, 2, 1);
    }
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    ctx.drawImage(this.mid, -Math.round(camX * 0.55), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // brazier fires with a warm glow on the stone
    for (const bx of BRAZIERS) {
      const sx = bx + dx;
      if (sx < -40 || sx > W + 40) continue;
      const fy = FLOOR - 33;
      const fl = Math.sin(t * 0.3 + bx) * 1.5 + Math.sin(t * 0.71 + bx * 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,120,30,0.06)';
      for (const rr of [30, 20, 12]) ctx.fillRect(sx - rr, fy - 6 - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
      const h = 11 + fl;
      ctx.fillStyle = '#c02808';
      ctx.fillRect(sx - 6, fy - h * 0.6, 13, h * 0.6);
      ctx.fillStyle = '#ff8a18';
      ctx.fillRect(sx - 4, fy - h * 0.9, 9, h * 0.8);
      ctx.fillRect(sx - 1 + Math.round(fl), fy - h - 2, 3, 3);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(sx - 2, fy - h * 0.55, 5, h * 0.5);
      // embers drifting up
      for (let k = 0; k < 3; k++) {
        const e = (t * 0.6 + k * 17 + bx) % 40;
        ctx.fillStyle = e < 20 ? '#ffd060' : '#c04010';
        ctx.fillRect(Math.round(sx + Math.sin((t + k * 30) * 0.05) * 4), Math.round(fy - h - e), 1, 1);
      }
    }
  }

  /** Sand gusting across the court in streaks and grains. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const gust = 0.5 + 0.5 * Math.sin(t * 0.004);
    for (let i = 0; i < 5; i++) {
      const x = ((i * 157 + t * (1.2 + gust) - camX * 1.1) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = 150 + (i % 3) * 16 + Math.sin(t * 0.02 + i) * 4;
      ctx.fillStyle = `rgba(230,170,100,${0.05 + gust * 0.06})`;
      ctx.fillRect(Math.round(x), Math.round(y), 100, 3);
      ctx.fillRect(Math.round(x) + 20, Math.round(y) + 3, 60, 2);
    }
    ctx.fillStyle = 'rgba(250,210,150,0.6)';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 53 + t * (1.5 + (i % 3) * 0.6 + gust) - camX) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = 120 + ((i * 37) % 80) + Math.sin(t * 0.05 + i) * 3;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}
