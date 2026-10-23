import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';

// "Ironwood Dojo": a mountain training hall at dusk. Polished plank floor, paper screens slid
// open onto a moonlit blossom garden, a weapons rack, a great drum and a row of kneeling students
// watching from the back wall under swaying paper lanterns. Painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.5);
const WALL_TOP = 16; // underside of the ceiling beam
const OPEN_TOP = 40; // top of the door openings, below the carved transom
const BASE = 172; // where the back wall meets the floor
const PILLARS = [4, 128, 256, 384, 508];
/** Door openings in the back wall, in deck px: the garden shows through these. */
const DOORS = [[10, 122], [390, 502]];
const LANTERNS = [{ x: 64, len: 18, ph: 0 }, { x: 192, len: 24, ph: 1.7 }, { x: 320, len: 24, ph: 3.1 }, { x: 448, len: 18, ph: 4.6 }];

interface Student { x: number; belt: string; skin: string; hair: string; ph: number; dir: number; master?: boolean }

/** Static sky: dusk gradient, a big moon, and layered mountain ridges with a distant pagoda. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, 150, '#1c1838', '#c87a6a', 10);
  // moon with a soft halo
  for (let y = 0; y < 110; y++)
    for (let x = 140; x < 240; x++) {
      const d = Math.hypot(x - 190, y - 46);
      if (d < 14) p.set(x, y, d < 12 && bayer(x, y) < 0.15 + (x - 178) / 60 ? '#e8dcc0' : '#fff4dc');
      else if (d < 34 && bayer(x, y) < (1 - (d - 14) / 20) * 0.35) p.set(x, y, lighten(p.get(x, y), 0.18));
    }
  // ridges: far blue, nearer purple, nearest almost black
  const ridges: [number, number, number, string][] = [[78, 16, 0.03, '#4a4060'], [98, 12, 0.05, '#342c48'], [118, 10, 0.08, '#1e1a2c']];
  ridges.forEach(([base, amp, f, c], k) => {
    for (let x = 0; x < W; x++) {
      const top = base - Math.abs(Math.sin(x * f + k * 2)) * amp - Math.sin(x * f * 2.7 + k) * amp * 0.4;
      for (let y = Math.floor(top); y < H; y++) p.set(x, y, c);
    }
  });
  // a pagoda on the middle ridge, five shrinking roofs with upturned eaves
  const px = 70;
  for (let i = 0; i < 5; i++) {
    const y = 88 - i * 6, w = 14 - i * 2;
    p.rect(px - w / 2 + 2, y + 1, w - 4, 4, '#241e30');
    p.poly([[px - w, y + 1], [px + w, y + 1], [px + w / 2, y - 2], [px - w / 2, y - 2]], '#16121e');
    p.set(px - w - 1, y, '#16121e');
    p.set(px + w + 1, y, '#16121e');
  }
  p.line(px, 58, px, 64, '#16121e');
  p.set(px - 2, 86, '#ffc070'); // a lit window
  return p.canvas();
}

/** A blossom tree: crooked trunk, then pink canopy clumps with dithered shading. */
function blossomTree(p: Painter, x: number, base: number, h: number, seed: number) {
  const r = rng(seed);
  let tx = x, ty = base;
  const tips: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const nx = tx + r.range(-5, 5), ny = ty - h / 6;
    p.capsule(tx, ty, 3 - i * 0.35, nx, ny, 2.6 - i * 0.35, '#2a1a1c');
    tx = nx;
    ty = ny;
    if (i >= 2) {
      const bx = tx + r.range(-22, 22), by = ty - r.range(0, 10);
      p.capsule(tx, ty, 1.5, bx, by, 0.8, '#2a1a1c');
      tips.push([bx, by]);
    }
  }
  tips.push([tx, ty]);
  for (const [cx, cy] of tips)
    for (let k = 0; k < 4; k++) {
      const ex = cx + r.range(-10, 10), ey = cy + r.range(-6, 6), rx = r.range(7, 13), ry = rx * 0.7;
      for (let y = Math.floor(ey - ry); y <= ey + ry; y++)
        for (let xx = Math.floor(ex - rx); xx <= ex + rx; xx++) {
          const dx = (xx - ex) / rx, dy = (y - ey) / ry, d = dx * dx + dy * dy;
          if (d > 1 || bayer(xx, y) < (d - 0.75) * 3) continue;
          const lit = dy < -0.2 && dx < 0.4;
          p.set(xx, y, lit ? '#f4b8c8' : d > 0.6 && bayer(xx, y) < 0.5 ? '#a05070' : '#d888a4');
        }
    }
}

/** The garden behind the open screens: gravel, a koi pond, stone lantern, bamboo and blossom trees. */
function garden(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1201);
  // bamboo grove against the hills
  for (let x = r.int(0, 6); x < FAR_W; x += r.int(5, 9)) {
    const c = r.pick(['#2c4a30', '#36583a', '#24402a']);
    const top = r.int(40, 90);
    for (let y = top; y < 140; y++) p.set(x, y, c);
    for (let y = top; y < 140; y++) p.set(x + 1, y, darken(c, 0.25));
    for (let y = top + 6; y < 140; y += r.int(9, 14)) p.rect(x - 1, y, 3, 1, lighten(c, 0.2));
    if (r.next() < 0.6) p.poly([[x + 1, top + 10], [x + 9, top + 6], [x + 3, top + 13]], '#3e6a40');
  }
  // raked gravel with ripple lines
  for (let y = 132; y < H; y++)
    for (let x = 0; x < FAR_W; x++) {
      const ripple = (y + Math.round(Math.sin(x * 0.05) * 2)) % 4 === 0;
      p.set(x, y, ripple ? '#6a6670' : bayer(x, y) < 0.2 ? '#8a8690' : '#7a7680');
    }
  // koi pond reflecting the sky, with a couple of fish
  for (let y = 142; y < 166; y++)
    for (let x = 150; x < 270; x++) {
      const dx = (x - 210) / 60, dy = (y - 154) / 12;
      if (dx * dx + dy * dy > 1) continue;
      p.set(x, y, dx * dx + dy * dy > 0.8 ? '#4a4652' : y % 3 === 0 && bayer(x, y) < 0.4 ? '#7a5a78' : '#2a3050');
    }
  p.ellipse(190, 152, 4, 1.5, '#f08030');
  p.ellipse(228, 158, 4, 1.5, '#f0e8e0');
  p.set(229, 158, '#e03020');
  // stepping stones
  for (const [sx, sy] of [[60, 168], [84, 160], [108, 166], [300, 162], [326, 168]]) {
    p.ellipse(sx, sy, 8, 3, '#5a5660');
    p.ellipse(sx - 1, sy - 1, 6, 2, '#8a8690');
  }
  // stone lanterns
  for (const lx of [40, 344]) {
    p.rect(lx - 2, 126, 5, 20, '#6a6670');
    p.rect(lx - 6, 120, 13, 4, '#7a7680');
    p.rect(lx - 4, 110, 9, 10, '#6a6670');
    p.rect(lx - 2, 113, 5, 4, '#ffd080');
    p.poly([[lx - 9, 110], [lx + 9, 110], [lx, 101]], '#7a7680');
    p.rect(lx - 1, 99, 3, 3, '#6a6670');
    p.rect(lx - 7, 146, 15, 3, '#5a5660');
  }
  blossomTree(p, 18, 144, 90, 1213);
  blossomTree(p, 130, 140, 100, 1229);
  blossomTree(p, 282, 142, 96, 1237);
  blossomTree(p, 372, 144, 84, 1249);
  // fallen petals on the gravel
  for (let i = 0; i < 160; i++) p.set(r.int(0, FAR_W), r.int(134, H), r.pick(['#f4b8c8', '#d888a4']));
  return p.canvas();
}

/** Plaster panel with dithered texture. */
function plaster(p: Painter, x0: number, x1: number) {
  for (let y = WALL_TOP; y < BASE - 12; y++)
    for (let x = x0; x < x1; x++) {
      const c = mix('#5a4636', '#b49a78', Math.min(1, (y - WALL_TOP) / 70));
      p.set(x, y, bayer(x, y) < 0.12 ? darken(c, 0.08) : c);
    }
}

/** Vertical hardwood post with highlight and shadow edges. */
function post(p: Painter, x: number, y0: number, y1: number, w = 7) {
  for (let y = y0; y < y1; y++)
    for (let i = 0; i < w; i++) p.set(x + i, y, i === 0 ? '#7a4a2a' : i === w - 1 ? '#2a160c' : (y + i * 13) % 17 === 0 ? '#3a2214' : '#4e2e1a');
}

/** The hall: back wall with screens, rack and drum, and the polished plank floor. */
function hall(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1301);
  // ceiling beam and rafters
  for (let y = 0; y < WALL_TOP; y++)
    for (let x = 0; x < STAGE_W; x++) p.set(x, y, y === WALL_TOP - 1 ? '#1a0e08' : y === WALL_TOP - 4 ? '#5a3420' : (x + y * 7) % 23 === 0 ? '#2a180e' : '#3a2214');
  for (let x = 20; x < STAGE_W; x += 40) p.rect(x, 0, 6, WALL_TOP - 4, '#2a180e');
  // plaster everywhere, then cut the doors open
  plaster(p, 0, STAGE_W);
  // carved transom lattice above each door
  for (const [x0, x1] of DOORS) {
    for (let y = WALL_TOP + 4; y < OPEN_TOP - 2; y++)
      for (let x = x0; x < x1; x++) {
        const k = (x - x0 + (y - WALL_TOP) * 2) % 12, k2 = (x - x0 - (y - WALL_TOP) * 2 + 600) % 12;
        p.set(x, y, k < 2 || k2 < 2 ? '#5a3420' : '#1a0e10');
      }
    p.rect(x0, OPEN_TOP - 3, x1 - x0, 3, '#4e2e1a');
    p.rect(x0, OPEN_TOP - 3, x1 - x0, 1, '#7a4a2a');
    // the opening itself
    for (let y = OPEN_TOP; y < BASE - 12; y++) for (let x = x0; x < x1; x++) p.data[(y * STAGE_W + x) * 4 + 3] = 0;
    // a screen slid half aside on the left of each door: cream paper on a lattice frame
    const sw = 30;
    for (let y = OPEN_TOP; y < BASE - 12; y++)
      for (let x = x0; x < x0 + sw; x++) {
        const fr = x === x0 || x === x0 + sw - 1 || (x - x0) % 10 === 0 || (y - OPEN_TOP) % 14 === 0;
        p.set(x, y, fr ? '#5a3420' : bayer(x, y) < 0.1 ? '#e8d8b8' : '#f4e8cc');
      }
    p.rect(x0 + sw - 4, 98, 2, 6, '#2a180e'); // finger pull
  }
  // weapons rack between the first two pillars: staffs, wooden swords, a pair of spears
  const rk = 144;
  p.rect(rk, 48, 96, 4, '#4e2e1a');
  p.rect(rk, 120, 96, 4, '#4e2e1a');
  p.rect(rk, 48, 4, 112, '#3a2214');
  p.rect(rk + 92, 48, 4, 112, '#3a2214');
  for (let i = 0; i < 10; i++) {
    const x = rk + 10 + i * 8, kind = i % 4;
    if (kind === 0) p.rect(x, 34, 3, 124, '#8a6a3a'); // long staff
    else if (kind === 1) {
      // wooden practice sword: gently curved blade, round guard
      for (let y = 56; y < 150; y++) p.set(x + Math.round((y - 56) ** 2 / 3000), y, y < 120 ? '#c8a870' : '#3a2a20');
      p.rect(x - 2, 120, 5, 2, '#2a1a10');
    } else if (kind === 2) {
      p.rect(x, 26, 2, 132, '#5a3a20'); // spear shaft and blade
      p.poly([[x - 2, 30], [x + 3, 30], [x + 1, 18]], '#b8bcc8');
      p.set(x, 24, '#ffffff');
      p.rect(x - 1, 31, 4, 2, '#a02020');
    } else p.rect(x, 64, 3, 94, '#6a4a2a'); // short staff
  }
  // the centrepiece: a hanging scroll with a single ink circle, over a raised shelf
  const sc = 340;
  p.rect(sc - 16, 30, 32, 74, '#ece0c4');
  p.rect(sc - 18, 28, 36, 3, '#3a2214');
  p.rect(sc - 18, 103, 36, 4, '#3a2214');
  p.rect(sc - 16, 30, 32, 2, '#7a5a3a');
  p.line(sc - 10, 28, sc, 20, '#2a180e');
  p.line(sc + 10, 28, sc, 20, '#2a180e');
  for (let a = 0.35; a < Math.PI * 2 - 0.1; a += 0.01) {
    const th = 1.6 + Math.sin(a * 0.5) * 1.6; // a brush stroke thins as it lifts
    p.ellipse(sc + Math.cos(a) * 10, 62 + Math.sin(a) * 12, th, th, '#141014');
  }
  p.set(sc + 9, 57, '#141014');
  p.rect(sc + 8, 90, 4, 4, '#b02020'); // red seal
  // a low shelf under the scroll with an incense bowl
  p.rect(sc - 26, 146, 52, 4, '#5a3420');
  p.rect(sc - 26, 146, 52, 1, '#8a5a32');
  p.rect(sc - 24, 150, 3, 10, '#3a2214');
  p.rect(sc + 21, 150, 3, 10, '#3a2214');
  p.rect(sc + 18, 141, 8, 5, '#3a3a40');
  p.rect(sc + 19, 141, 6, 1, '#6a6a70');
  p.line(sc + 22, 141, sc + 22, 135, '#6a4a2a');
  // the big drum on its frame to the left of the scroll
  const dx = 290, dy = 134;
  p.line(dx - 18, BASE - 12, dx - 8, dy, '#3a2214');
  p.line(dx + 18, BASE - 12, dx + 8, dy, '#3a2214');
  p.line(dx - 17, BASE - 12, dx - 7, dy, '#3a2214');
  p.line(dx + 17, BASE - 12, dx + 7, dy, '#3a2214');
  for (let y = dy - 22; y <= dy + 22; y++) {
    const bulge = 17 + Math.round(Math.cos(((y - dy) / 22) * 1.2) * 4);
    for (let x = dx - bulge; x <= dx + bulge; x++) {
      const t = (x - dx) / bulge;
      p.set(x, y, t < -0.6 ? '#8a3a1a' : t > 0.55 ? '#3a1408' : (y - dy + 30) % 9 === 0 ? '#4a1c0c' : '#6a2a12');
    }
  }
  for (const yy of [dy - 22, dy + 22]) for (let x = dx - 17; x <= dx + 17; x += 3) p.set(x, yy, '#d8c060'); // tacks
  p.ellipse(dx, dy, 12, 16, '#d8c8a0'); // head facing us
  p.ellipse(dx, dy, 7, 10, '#e8dcb8');
  p.ellipse(dx - 2, dy - 3, 4, 5, '#f4ecd0');
  // mallets resting against the frame
  p.line(dx + 22, BASE - 12, dx + 30, dy - 6, '#8a6a3a');
  p.ellipse(dx + 30, dy - 7, 2, 2, '#5a3a20');
  // a tie beam running the length of the wall at door height
  p.rect(0, OPEN_TOP - 4, STAGE_W, 4, '#4e2e1a');
  p.rect(0, OPEN_TOP - 4, STAGE_W, 1, '#7a4a2a');
  p.rect(0, OPEN_TOP - 1, STAGE_W, 1, '#1a0e08');
  // pillars over everything on the wall
  for (const x of PILLARS) post(p, x - 3, WALL_TOP, BASE);
  // wainscot along the base of the wall
  for (let y = BASE - 12; y < BASE; y++)
    for (let x = 0; x < STAGE_W; x++) p.set(x, y, y === BASE - 12 ? '#7a4a2a' : y === BASE - 1 ? '#1a0e08' : x % 32 === 0 ? '#2a180e' : '#4a2a18');
  for (const x of PILLARS) post(p, x - 3, BASE - 12, BASE);
  // polished plank floor in perspective: boards run toward the camera from the wall
  const vx = STAGE_W / 2;
  for (let y = BASE; y < H; y++) {
    const s = 0.55 + (0.45 * (y - BASE)) / (H - BASE);
    for (let x = 0; x < STAGE_W; x++) {
      const u = (x - vx) / s, u1 = (x + 1 - vx) / s;
      const board = Math.floor(u / 18);
      const seam = board !== Math.floor(u1 / 18);
      const shade = ((board * 37) % 5) * 0.035;
      const joint = (y + board * 11) % 23 === 0; // staggered butt joints
      let c: Color = seam || joint ? '#3a200e' : darken('#a0663a', shade);
      if (!seam && Math.sin(u * 0.4 + board * 3 + Math.sin(y * 0.3) * 2) > 0.85) c = darken(c, 0.12); // grain
      // polish: a broad sheen band and a soft dither toward the wall
      const sheen = Math.max(0, 1 - Math.abs(y - 190) / 10);
      if (!seam && bayer(x, y) < sheen * 0.35) c = lighten(c, 0.18);
      if (y < BASE + 6 && bayer(x, y) < (BASE + 6 - y) / 10) c = darken(c, 0.3);
      p.set(x, y, c);
    }
  }
  // a little scuffing where countless feet have pivoted
  for (let i = 0; i < 40; i++) {
    const sx = r.int(0, STAGE_W), sy = r.int(BASE + 10, H - 2);
    p.set(sx, sy, lighten(p.get(sx, sy), 0.1));
    p.set(sx + 1, sy, lighten(p.get(sx + 1, sy), 0.1));
  }
  return p.canvas();
}

/** The kneeling row along the back wall; the master sits under the scroll. */
function students(): Student[] {
  const r = rng(1321);
  const belts = ['#f0f0f0', '#e0c020', '#e07020', '#30a040', '#2050c0', '#7a4020', '#141414'];
  const skins = ['#f0c8a0', '#d0a070', '#a86c44', '#7a4a2c', '#e8b890'];
  const hairs = ['#141014', '#3a2414', '#6a4020', '#1a1a1a', '#a08060'];
  const out: Student[] = [];
  for (const [x0, x1] of [[20, 120], [140, 236], [358, 380], [396, 498]])
    for (let x = x0 + 8; x < x1 - 4; x += r.int(16, 22))
      out.push({ x, belt: r.pick(belts), skin: r.pick(skins), hair: r.pick(hairs), ph: r.range(0, 1000), dir: x < 340 ? 1 : -1 });
  out.push({ x: 340, belt: '#141014', skin: '#d8a880', hair: '#e8e8e8', ph: 0, dir: 1, master: true });
  return out;
}

export class DojoStage {
  name = 'IRONWOOD DOJO';
  blurb = 'BOW IN. FIGHT. BOW OUT.';
  song: SongName = 'dojo';
  stakeColor = '#d8c890';
  sky = sky();
  garden = garden();
  hall = hall();
  row = students();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  /** Through a trapdoor in the floorboards into the old proving pit, lined with sharpened bamboo. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1361);
    p.gradRect(0, 0, W, H, '#2a2026', '#08060a', 8);
    // fitted stone walls narrowing toward the bottom
    for (let y = 0; y < H; y++) {
      const wall = 30 + (y / H) * 26;
      for (let x = 0; x < W; x++) {
        if (x > wall && x < W - wall) continue;
        const row = Math.floor(y / 10), off = row % 2 ? 9 : 0;
        const mortar = y % 10 === 9 || (x + off) % 18 === 17;
        p.set(x, y, mortar ? '#1a1618' : darken('#5a5258', ((row * 5 + Math.floor((x + off) / 18) * 3) % 4) * 0.08 + y / H * 0.4));
      }
    }
    // moss creeping down the stones
    for (let i = 0; i < 60; i++) {
      const left = r.next() < 0.5, mx = left ? r.int(0, 40) : W - r.int(0, 40), my = r.int(0, 200);
      p.set(mx, my, '#3a5a30');
      p.set(mx, my + 1, '#2a4024');
    }
    // the broken floorboards above, lantern light spilling through the hole
    for (let x = 0; x < W; x++) {
      const hole = x > 86 && x < 170;
      const edge = hole ? 0 : 12;
      for (let y = 0; y < edge + (hole ? Math.abs(Math.sin(x * 0.7)) * 6 : 0); y++) p.set(x, y, Math.floor(x / 18) % 2 ? '#7a4a2a' : '#6a3e22');
      if (!hole) p.set(x, 12, '#2a160c');
    }
    // splintered board ends
    p.poly([[86, 0], [92, 0], [88, 18]], '#8a5a32');
    p.poly([[164, 0], [170, 0], [168, 14]], '#8a5a32');
    for (let y = 12; y < 190; y++) {
      const half = 44 + (y - 12) * 0.22;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) {
        const edge = 1 - Math.abs(x - 128) / half;
        p.set(x, y, mix(p.get(x, y), '#ffb860', edge * 0.14 * (1 - y / 240)));
      }
    }
    // an old rope ladder, cut
    for (let y = 12; y < 90; y++) {
      p.set(52 + Math.round(Math.sin(y * 0.05) * 2), y, '#8a7050');
      p.set(64 + Math.round(Math.sin(y * 0.05) * 2), y, '#8a7050');
      if (y % 12 === 6) p.line(52 + Math.round(Math.sin(y * 0.05) * 2), y, 64 + Math.round(Math.sin(y * 0.05) * 2), y, '#6a5038');
    }
    // the floor of the pit: packed earth and three ranks of cut bamboo stakes
    p.gradRect(30, 196, W - 60, H - 196, '#3a2a1e', '#1a120c', 4);
    for (let row = 0; row < 3; row++) {
      const baseY = 194 + row * 10;
      for (let sx = 40 + row * 7; sx < W - 40; sx += 17 - row * 2) {
        const h = 38 + row * 10 + r.int(-8, 8), lean = r.range(-3, 3);
        const col = row === 2 ? '#c8b070' : row === 1 ? '#9a8a50' : '#6a6038';
        for (let k = 0; k < h; k++) {
          const t = k / h, w = t > 0.82 ? Math.round((1 - t) / 0.18 * 2) : 3; // angled cut at the tip
          const x = Math.round(sx + lean * t), y = baseY + 24 - k;
          for (let i = 0; i < w; i++) p.set(x + i, y, i === 0 ? lighten(col, 0.2) : i === w - 1 && w > 1 ? darken(col, 0.35) : col);
          if (w === 3 && k % 14 === 7) p.rect(x - 1, y, 5, 1, darken(col, 0.4)); // node rings
        }
        p.set(Math.round(sx + lean), baseY + 24 - h, lighten(col, 0.5));
      }
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[70, 182, -96, 1], [192, 188, -76, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -100, ab: 40, lf: -30, kf: 70, h: 30 })));
      ctx.restore();
    }
    return cv;
  }

  /** Swing angle of a paper lantern, in radians. */
  swing(i: number, t: number) {
    return Math.sin(t * 0.02 + LANTERNS[i].ph) * 0.12;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    ctx.drawImage(this.garden, -Math.round(camX * 0.5), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.hall, dx, 0);
    this.drawStudents(ctx, dx, t);
    // paper lanterns: cord, ribbed red body, caps, and a warm pool on the wall and floor
    for (let i = 0; i < LANTERNS.length; i++) {
      const L = LANTERNS[i], a = this.swing(i, t);
      const bx = Math.round(L.x + dx + Math.sin(a) * L.len), by = Math.round(WALL_TOP + Math.cos(a) * L.len);
      if (bx < -40 || bx > W + 40) continue;
      const flick = 0.9 + Math.sin(t * 0.3 + i * 2) * 0.05 + Math.sin(t * 0.71 + i) * 0.05;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by + 8, 2, bx, by + 8, 40);
      g.addColorStop(0, `rgba(255,150,70,${0.28 * flick})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - 40, by - 32, 80, 80);
      // reflection on the polished boards
      ctx.fillStyle = `rgba(255,140,60,${0.12 * flick})`;
      for (let k = 0; k < 6; k++) ctx.fillRect(bx - 3 + (k % 2), BASE + 4 + k * 4, 6 - (k % 2) * 2, 2);
      ctx.restore();
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(Math.round(L.x + dx), WALL_TOP, 1, 1);
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(L.x + dx + 0.5, WALL_TOP);
      ctx.lineTo(bx + 0.5, by);
      ctx.stroke();
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(bx - 3, by, 7, 2);
      ctx.fillRect(bx - 3, by + 15, 7, 2);
      ctx.fillStyle = '#c03020';
      ctx.fillRect(bx - 5, by + 3, 11, 11);
      ctx.fillRect(bx - 4, by + 2, 9, 13);
      ctx.fillStyle = `rgba(255,200,110,${0.5 * flick})`;
      ctx.fillRect(bx - 2, by + 4, 4, 9);
      ctx.fillStyle = '#801810';
      for (let k = 0; k < 3; k++) ctx.fillRect(bx - 5, by + 5 + k * 3, 11, 1);
      ctx.fillStyle = '#e0c060';
      ctx.fillRect(bx, by + 17, 1, 4); // tassel
    }
  }

  /** Students kneel and watch; every so often one bows. The master never moves. */
  drawStudents(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    const y0 = BASE + 2;
    for (const s of this.row) {
      const x = s.x + dx;
      if (x < -12 || x > W + 12) continue;
      const cyc = (t + s.ph) % 600;
      const bow = s.master ? 0 : cyc < 40 ? Math.sin((cyc / 40) * Math.PI) : 0;
      const nod = s.master ? 0 : Math.sin(t * 0.05 + s.ph) > 0.97 ? 1 : 0;
      const lean = Math.round(bow * 4) * s.dir;
      const drop = Math.round(bow * 4) + nod;
      const gi = s.master ? '#2a2034' : '#e8e4dc';
      // folded legs and feet tucked under
      ctx.fillStyle = s.master ? '#1e1828' : '#2a2a3a';
      ctx.fillRect(x - 6, y0 - 5, 13, 5);
      ctx.fillStyle = gi;
      ctx.fillRect(x - 4 + lean, y0 - 14 + drop, 9, 10);
      ctx.fillRect(x - 5 + lean, y0 - 13 + drop, 11, 4);
      ctx.fillStyle = s.belt;
      ctx.fillRect(x - 4 + Math.round(lean / 2), y0 - 6, 9, 2);
      // hands on thighs
      ctx.fillStyle = s.skin;
      ctx.fillRect(x - 2 + s.dir * 3, y0 - 6, 3, 2);
      // head
      const hx = x - 2 + lean + (bow > 0.3 ? s.dir : 0), hy = y0 - 20 + drop;
      ctx.fillRect(hx, hy, 6, 6);
      ctx.fillStyle = s.hair;
      if (s.master) {
        ctx.fillRect(hx, hy + 4, 6, 7); // long white beard
        ctx.fillRect(hx - 1, hy + 1, 1, 3);
        ctx.fillRect(hx + 6, hy + 1, 1, 3);
      } else ctx.fillRect(hx, hy, 6, 2);
      ctx.fillStyle = '#141014';
      ctx.fillRect(hx + (s.dir > 0 ? 4 : 1), hy + 2 + (s.master ? 0 : 1), 1, 1);
    }
  }

  /** Blossom petals drifting in through the open screens, and a thread of incense smoke. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 26; i++) {
      const sp = 0.25 + (i % 5) * 0.06;
      const x = ((i * 89 + t * sp * 0.8 + Math.sin(t * 0.03 + i) * 12 - camX * (0.9 + (i % 3) * 0.1)) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = (t * sp + i * 53) % (H + 10) - 10;
      ctx.fillStyle = i % 3 ? '#f4b8c8' : '#d888a4';
      const flip = Math.sin(t * 0.1 + i) > 0;
      ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, 1);
      if (!flip) ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    }
    // incense rising from the shelf below the scroll
    const ix = 340 - Math.round(camX);
    if (ix > -20 && ix < W + 20) {
      ctx.fillStyle = '#ffa040';
      ctx.fillRect(ix + 22, 134, 1, 1);
      ctx.fillStyle = 'rgba(220,210,230,0.18)';
      for (let k = 0; k < 30; k++) ctx.fillRect(ix + 22 + Math.round(Math.sin(k * 0.25 - t * 0.04) * (k / 10)), 132 - k * 2, 1, 2);
    }
  }
}
