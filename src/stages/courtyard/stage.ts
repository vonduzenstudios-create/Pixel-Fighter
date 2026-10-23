import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng, Rng } from '../../core/rng';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';

// "Court of Cinders": the cobbled inner court of a grey stone castle at dusk. Far behind the
// fight a crowd jeers around a pyre where a pointy-hatted witch wriggles at the stake, the
// flames lighting the curtain wall orange and a smoke column rolling into the sky. Torches
// burn on posts across the court. The uppercut drops the loser through a grate into the
// castle oubliette and its rusty spikes. All art is procedural; the heraldry is made up.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
/** The pyre, in mid-layer px: the stake's x and the top of the woodpile. */
const PYRE = { x: 200, top: 120 };
const TORCHES = [150, 362];

const STONE = '#7a7268';
const WOOD = '#6a4428';

/** Fill a rectangle with ashlar blocks in running bond. */
function blocks(p: Painter, x0: number, y0: number, w: number, h: number, base: Color, bh: number, bw: number, seed: number) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / bh), off = row % 2 ? bw >> 1 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const joint = (y - y0) % bh === bh - 1 || (x - x0 + off) % bw === bw - 1;
      const tint = ((row * 7 + Math.floor((x - x0 + off) / bw) * 13) % 5) * 0.035;
      let c: Color = joint ? darken(base, 0.45) : darken(base, tint);
      if (!joint && (y - y0) % bh === 0) c = lighten(c, 0.1);
      if (!joint && bayer(x, y) < 0.06) c = darken(c, 0.12);
      p.set(x, y, c);
    }
  }
  // moss and chips
  for (let i = 0; i < (w * h) / 220; i++) p.set(x0 + r.int(0, w - 1), y0 + r.int(0, h - 1), r.next() < 0.5 ? '#4a5a34' : darken(base, 0.3));
}

/** A row of merlons along a wall top at y (they stand above it). */
function crenels(p: Painter, x0: number, x1: number, y: number, base: Color, step = 10) {
  for (let x = x0; x < x1; x += step) blocks(p, x, y - 6, Math.min(6, x1 - x), 6, base, 6, 6, x * 3 + y);
}

/** A hanging banner: a red field with a gold chevron and a forked tail. */
function banner(p: Painter, x: number, y: number, h: number) {
  p.rect(x - 1, y - 1, 9, 1, '#3a2a1a');
  for (let k = 0; k < h; k++)
    for (let i = 0; i < 7; i++) {
      if (k > h - 4 && Math.abs(i - 3) < k - (h - 4)) continue; // forked tail
      p.set(x + i, y + k, i === 0 ? '#c03030' : '#9a1e22');
    }
  for (let i = 0; i < 7; i++) {
    const cy = y + 4 + Math.abs(3 - i);
    p.set(x + i, cy, '#e0b040');
    p.set(x + i, cy + 1, '#a07a20');
  }
}

/** Dusk sky: bruised purple clouds over a smoky orange horizon. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const stops: [number, Color][] = [[0, '#16121e'], [50, '#2e2238'], [100, '#5a2a3a'], [130, '#a8452e'], [160, '#e0783a']];
  for (let y = 0; y < H; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    for (let x = 0; x < W; x++) p.set(x, y, mix(c0, c1, Math.floor(t * 4 + bayer(x, y)) / 4));
  }
  const r = rng(1601);
  for (let i = 0; i < 24; i++) p.set(r.int(0, W - 1), r.int(0, 40), r.next() < 0.3 ? '#e8e0f0' : '#7a6a90');
  // low heavy clouds, underlit by the fire
  for (const [cy, cx, len, th] of [[30, -10, 120, 6], [52, 120, 150, 5], [76, 30, 100, 4], [92, 170, 90, 3]]) {
    for (let x = cx; x < cx + len; x++) {
      const h = Math.round(th * Math.sin(((x - cx) / len) * Math.PI) + Math.sin(x * 0.3) * 0.8);
      for (let k = 0; k <= h; k++) p.set(x, cy - k, k === 0 ? '#b0503a' : k === 1 ? '#6a3040' : '#3a2638');
    }
  }
  return p.canvas();
}

/** A round tower with a slate cone roof and a pennant. */
function tower(p: Painter, cx: number, top: number, half: number, base: Color, r: Rng) {
  blocks(p, cx - half, top, half * 2, 150 - top, base, 6, 10, cx * 7);
  for (let y = top; y < 150; y++) {
    for (let x = cx - half; x < cx + half; x++) {
      const k = (x - cx) / half;
      if (k > 0.45) p.set(x, y, darken(p.get(x, y), 0.25));
      else if (k < -0.6) p.set(x, y, lighten(p.get(x, y), 0.08));
    }
  }
  const roof = top - half * 2 - 6;
  for (let y = roof; y < top; y++) {
    const w = Math.round(((y - roof) / (top - roof)) * (half + 3));
    for (let x = cx - w; x <= cx + w; x++) p.set(x, y, x > cx + w * 0.3 ? '#2a2a3e' : (y - roof) % 3 === 0 ? '#3a3a52' : '#4a4a66');
  }
  p.line(cx, roof - 8, cx, roof, '#2a2228');
  p.poly([[cx + 1, roof - 8], [cx + 8, roof - 6], [cx + 1, roof - 4]], '#9a1e22');
  // a couple of lit windows
  for (let i = 0; i < 2; i++) {
    const wy = top + 10 + i * 22 + r.int(0, 6);
    p.rect(cx - 1, wy, 2, 4, r.next() < 0.7 ? '#f0c060' : '#1a1418');
  }
}

/** Far layer: the keep and its towers, a chapel spire, all hazed by smoke. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1607);
  const base = '#5a5468';
  tower(p, 34, 70, 12, base, r);
  blocks(p, 56, 50, 70, 100, base, 7, 14, 1609);
  crenels(p, 56, 126, 50, base, 9);
  for (let i = 0; i < 3; i++) p.rect(68 + i * 20, 70, 3, 6, '#f0c060');
  tower(p, 140, 56, 10, base, r);
  tower(p, 222, 84, 9, darken(base, 0.08), r);
  // chapel with a thin spire and a little cross
  blocks(p, 252, 100, 40, 50, darken(base, 0.05), 6, 12, 1613);
  p.poly([[250, 100], [272, 82], [294, 100]], '#3a3a52');
  for (let y = 40; y < 84; y++) {
    const w = Math.round(((y - 40) / 44) * 4);
    p.rect(272 - w, y, w * 2 + 1, 1, '#34344a');
  }
  p.rect(271, 32, 3, 9, '#2a2228');
  p.rect(268, 35, 9, 2, '#2a2228');
  p.rect(268, 112, 8, 10, '#e8a050');
  p.rect(271, 112, 2, 10, '#5a3a20');
  banner(p, 80, 52, 18);
  banner(p, 106, 52, 18);
  p.outline('#1e1a26');
  // haze: everything far away leans toward the sky colour
  for (let y = 0; y < H; y++)
    for (let x = 0; x < FAR_W; x++) if (p.alpha(x, y) && bayer(x, y) < 0.45) p.set(x, y, mix(p.get(x, y), '#6a3a48', 0.35));
  return p.canvas();
}

/** Mid layer: the curtain wall with its gatehouse, the courtyard dirt and the pyre. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1619);
  // curtain wall
  blocks(p, 0, 96, MID_W, 56, STONE, 7, 16, 1621);
  crenels(p, 0, MID_W, 96, STONE, 11);
  for (let x = 30; x < MID_W; x += 46) {
    if (x > 150 && x < 250) continue; // keep the wall behind the stake plain
    p.rect(x, 112, 2, 9, '#1a1418'); // arrow slits
    p.rect(x - 1, 115, 4, 2, '#1a1418');
  }
  // gatehouse with a raised portcullis
  for (const gx of [24, 64]) {
    blocks(p, gx - 9, 70, 18, 82, lighten(STONE, 0.04), 7, 9, 1627 + gx);
    crenels(p, gx - 9, gx + 9, 70, lighten(STONE, 0.04), 6);
  }
  blocks(p, 33, 84, 22, 68, STONE, 7, 11, 1631);
  for (let y = 116; y < 152; y++) {
    const half = y < 126 ? Math.round(Math.sqrt(Math.max(0, 100 - (126 - y) ** 2))) : 10;
    for (let x = 44 - half; x < 44 + half; x++) p.set(x, y, '#120c10');
  }
  for (let x = 35; x < 54; x += 4) p.rect(x, 116, 1, 10, '#3a3434');
  for (let y = 118; y < 126; y += 3) p.rect(34, y, 20, 1, '#3a3434');
  for (let x = 35; x < 54; x += 4) p.set(x, 126, '#5a5050');
  banner(p, 330, 100, 22);
  banner(p, 290, 100, 22);
  // courtyard dirt, scattered with straw and stones
  for (let y = 150; y < H; y++)
    for (let x = 0; x < MID_W; x++) {
      let c: Color = y === 150 ? '#7a6048' : mix('#5a4636', '#3a2c24', Math.min(1, (y - 150) / 40));
      if (bayer(x, y) < 0.08) c = darken(c, 0.15);
      p.set(x, y, c);
    }
  for (let i = 0; i < 60; i++) p.rect(r.int(0, MID_W), r.int(152, 180), r.int(1, 3), 1, r.next() < 0.5 ? '#a08a50' : '#6a6058');
  // the pyre: a timber platform, a heap of bound sticks and a tall stake
  const px = PYRE.x;
  p.rect(px - 26, 140, 52, 4, WOOD);
  p.rect(px - 26, 140, 52, 1, lighten(WOOD, 0.2));
  for (const lx of [-24, -10, 8, 22]) p.rect(px + lx, 144, 3, 9, darken(WOOD, 0.25));
  p.rect(px - 26, 147, 52, 1, darken(WOOD, 0.35)); // cross brace
  // steps up the side
  for (let k = 0; k < 3; k++) p.rect(px + 27 + k * 3, 141 + k * 4, 4, 2, darken(WOOD, 0.1));
  // the stake
  p.rect(px - 1, 82, 3, 58, '#4a3020');
  p.rect(px - 1, 82, 1, 58, '#6a4a30');
  // the woodpile: sticks leaning in toward the stake
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const bx = px + side * r.int(2, 22), by = 140;
    const tx = px + side * r.int(0, 6), ty = PYRE.top + r.int(0, 10) + Math.abs(bx - px) * 0.4;
    p.line(bx, by, tx, ty, i % 3 ? '#7a5030' : '#5a3820');
  }
  // binding ropes on the bundles
  for (const [bx, by] of [[px - 14, 134], [px + 12, 133], [px - 6, 128], [px + 6, 127]]) p.rect(bx - 2, by, 5, 1, '#c8a868');
  p.shade(0.14, 1, -1);
  p.outline('#1a1218');
  // the fire lights the wall and dirt around the pyre
  for (let y = 60; y < H; y++)
    for (let x = px - 110; x < px + 110; x++) {
      if (!p.alpha(x, y)) continue;
      const d = Math.hypot((x - px) * 0.8, y - 130) / 110;
      if (d < 1 && bayer(x, y) < (1 - d) * 0.8) p.set(x, y, mix(p.get(x, y), '#ff7a2a', 0.3 * (1 - d) + 0.1));
    }
  return p.canvas();
}

/** The cobbled court with a hay cart, a pillory, barrels and two torch posts. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1637);
  // hay cart on the left
  p.poly([[20, 168], [84, 168], [80, 150], [24, 150]], '#d8b050');
  for (let i = 0; i < 40; i++) p.line(24 + r.int(0, 56), 150 + r.int(0, 4), 24 + r.int(0, 56), 146 + r.int(0, 4), r.next() < 0.5 ? '#e8c868' : '#b08a38');
  p.rect(18, 168, 70, 6, WOOD);
  p.rect(18, 168, 70, 1, lighten(WOOD, 0.2));
  for (let x = 22; x < 88; x += 10) p.rect(x, 162, 2, 6, darken(WOOD, 0.2));
  p.line(88, 172, 112, FLOOR - 2, darken(WOOD, 0.1)); // shafts resting on the cobbles
  p.line(88, 170, 112, FLOOR - 4, WOOD);
  p.ellipse(36, 182, 12, 12, darken(WOOD, 0.3));
  p.ellipse(36, 182, 9, 9, [0, 0, 0], false);
  for (let a = 0; a < 6; a++) p.line(36, 182, 36 + Math.cos(a * 1.05) * 9, 182 + Math.sin(a * 1.05) * 9, darken(WOOD, 0.1));
  p.ellipse(36, 182, 2, 2, '#3a3434');
  // pillory on the right: a post with a hinged board holding three holes
  p.rect(452, 150, 4, FLOOR - 150, WOOD);
  p.rect(436, 150, 36, 8, lighten(WOOD, 0.1));
  for (const hx of [442, 454, 466]) p.ellipse(hx, 154, hx === 454 ? 3 : 2, 2, '#1a1010');
  p.rect(436, 154, 36, 1, darken(WOOD, 0.35));
  p.rect(446, FLOOR - 4, 16, 4, darken(WOOD, 0.2));
  // barrels and a crate
  for (const [bx, bh] of [[488, 22], [500, 18]]) {
    for (let y = FLOOR - bh; y < FLOOR; y++) {
      const half = 7 + Math.round(Math.sin(((y - FLOOR + bh) / bh) * Math.PI) * 2);
      for (let x = bx - half; x <= bx + half; x++) p.set(x, y, x > bx + 3 ? darken(WOOD, 0.25) : WOOD);
    }
    for (const k of [3, Math.floor(bh / 2), bh - 4]) p.rect(bx - 9, FLOOR - bh + k, 19, 1, '#3a3434');
  }
  p.rect(400, FLOOR - 14, 18, 14, '#8a6a40');
  p.line(400, FLOOR - 14, 417, FLOOR - 1, '#5a4024');
  p.line(417, FLOOR - 14, 400, FLOOR - 1, '#5a4024');
  // torch posts: a pole with an iron cup
  for (const tx of TORCHES) {
    p.rect(tx - 1, FLOOR - 46, 3, 46, darken(WOOD, 0.1));
    p.poly([[tx - 4, FLOOR - 52], [tx + 4, FLOOR - 52], [tx + 2, FLOOR - 46], [tx - 2, FLOOR - 46]], '#3a3434');
    p.rect(tx - 3, FLOOR - 52, 7, 1, '#6a6060');
    p.rect(tx - 3, FLOOR - 3, 7, 3, '#4a4444');
  }
  p.shade(0.16, 1, -1);
  p.outline('#140c0c');
  // cobblestones
  for (let y = FLOOR; y < H; y++) {
    const row = Math.floor((y - FLOOR) / 5), off = row % 2 ? 4 : 0;
    for (let x = 0; x < STAGE_W; x++) {
      const sx = Math.floor((x + off) / 8), yy = (y - FLOOR) % 5, xx = (x + off) % 8;
      const joint = yy === 4 || xx === 7 || ((yy === 0 || yy === 3) && (xx === 0 || xx === 6));
      const tint = ((sx * 13 + row * 7) % 5) * 0.05;
      let c: Color = joint ? '#2a2422' : darken(y === FLOOR ? '#a09488' : '#7a6e64', tint);
      if (!joint && yy === 0) c = lighten(c, 0.12);
      if (!joint && bayer(x, y) < 0.08) c = darken(c, 0.12);
      if (row > 2 && bayer(x, y) < (row - 2) * 0.12) c = darken(c, 0.3);
      p.set(x, y, c);
    }
  }
  // straw blown between the stones, and the iron grate over the oubliette at centre court
  for (let i = 0; i < 30; i++) p.rect(r.int(0, STAGE_W), FLOOR + r.int(0, 3), r.int(2, 5), 1, '#b09048');
  for (let x = 236; x < 276; x++)
    for (let y = FLOOR + 1; y < FLOOR + 9; y++) p.set(x, y, (x - 236) % 5 === 0 || y === FLOOR + 1 || y === FLOOR + 8 ? '#4a4444' : '#0a0606');
  return p.canvas();
}

/** One person in the jeering crowd. */
interface Peasant {
  x: number;
  foot: number;
  h: number;
  w: number;
  col: string;
  /** 0 fist, 1 pitchfork, 2 torch, 3 nothing raised. */
  arm: number;
  ph: number;
  hood: boolean;
}

export class CourtyardStage {
  name = 'COURT OF CINDERS';
  blurb = 'THE WHOLE TOWN TURNED OUT FOR THIS';
  song: SongName = 'courtyard';
  sky = sky();
  far = far();
  mid = mid();
  deck = deck();
  crowd: Peasant[] = [];
  pit: HTMLCanvasElement;
  stakeColor = '#8a7a6a';

  constructor(bones: PartSet) {
    const r = rng(1657);
    const cols = ['#1e1418', '#24181c', '#1a1620', '#281c18'];
    for (let row = 0; row < 2; row++)
      for (let x = 112 + row * 5; x < 290; x += 9 + r.int(0, 3)) {
        if (row === 1 && Math.abs(x - PYRE.x) < 8) continue; // a gap so the pyre steps show
        this.crowd.push({ x, foot: 160 + row * 8, h: 13 + r.int(0, 4) + row, w: 5 + r.int(0, 1), col: cols[r.int(0, 3)], arm: r.int(0, 3), ph: r.next() * 6.28, hood: r.next() < 0.4 });
      }
    this.pit = this.buildPit(bones);
  }

  /** Through the grate into the oubliette: a round stone shaft, chains, old bones and rusty spikes. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1663);
    p.gradRect(0, 0, W, H, '#2a2630', '#060406', 8);
    // curved shaft wall: blocks that darken toward the edges
    blocks(p, 0, 0, W, H, '#4a4450', 9, 18, 1667);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const edge = Math.abs(x - 128) / 128;
        if (bayer(x, y) < edge * 0.9 + y / H * 0.4) p.set(x, y, darken(p.get(x, y), 0.55));
      }
    // drips of damp
    for (let i = 0; i < 18; i++) {
      const x = r.int(10, W - 10), y = r.int(10, 150);
      for (let k = 0; k < r.int(4, 12); k++) p.set(x, y + k, '#2a3a34');
    }
    // the grate overhead and a barred shaft of firelight falling through it
    p.rect(0, 0, W, 6, '#1a1418');
    p.rect(100, 0, 56, 6, '#ffa050');
    for (let x = 100; x < 156; x += 7) p.rect(x, 0, 2, 6, '#2a2428');
    for (let y = 6; y < 196; y++) {
      const half = 28 + (y - 6) * 0.16;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) {
        const edge = 1 - Math.abs(x - 128) / half;
        const bar = Math.floor((x - 128 + half) / (half / 4)) % 2 === 0 && edge < 0.9;
        if (!bar && bayer(x, y) < edge * 0.3 * (1 - y / 280)) p.set(x, y, mix(p.get(x, y), '#e08040', 0.4));
      }
    }
    // chains and manacles hanging from rings in the wall
    for (const [cx, len] of [[34, 70], [222, 90], [58, 40]]) {
      p.rect(cx - 2, 20, 5, 2, '#5a5050');
      for (let k = 0; k < len; k += 3) p.rect(cx + (k % 6 ? 0 : -1), 22 + k, 2, 2, k % 6 ? '#6a6060' : '#4a4444');
      p.ellipse(cx, 24 + len, 3, 2, '#5a5050');
      p.ellipse(cx, 24 + len, 1, 1, '#0a0606');
    }
    // a skull on a ledge and a rat on the far side
    p.rect(196, 128, 26, 3, '#3a3438');
    p.ellipse(206, 123, 5, 5, '#d8d0b8');
    p.rect(203, 122, 2, 2, '#1a1010');
    p.rect(208, 122, 2, 2, '#1a1010');
    p.rect(204, 127, 5, 1, '#1a1010');
    p.ellipse(40, 176, 6, 3, '#3a3030');
    p.ellipse(46, 174, 3, 2, '#3a3030');
    p.set(48, 173, '#e02020');
    p.line(34, 177, 26, 172, '#6a5a5a');
    // the spike field
    for (let row = 0; row < 3; row++) {
      const baseY = 186 + row * 14, hgt = 34 + row * 6;
      for (let sx = -4 + row * 7; sx < W + 8; sx += 15 - row * 2) {
        const h = hgt + r.int(-6, 6);
        const col = row === 2 ? '#8a7a6a' : row === 1 ? '#6a5a4c' : '#4a3e36';
        p.poly([[sx - 4, baseY + 20], [sx, baseY - h + 20], [sx + 4, baseY + 20]], col);
        p.line(sx, baseY - h + 21, sx - 2, baseY + 18, lighten(col, 0.3));
        for (let k = 0; k < 3; k++) p.set(sx + r.int(-2, 2), baseY + 4 + r.int(0, 12), '#8a4a20'); // rust
        if (r.next() < 0.4) for (let k = 0; k < 6; k++) p.set(sx + r.int(-1, 1), baseY - h + 21 + k + r.int(0, 3), k < 3 ? '#a01010' : '#600808');
      }
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // an earlier visitor, still here
    ctx.save();
    ctx.translate(178, 182);
    ctx.scale(-1, 1);
    drawRig(ctx, bones, fk(P(LIE, { rot: -80, af: -100, ab: 50, lf: -30, kf: 70, h: 40 })));
    ctx.restore();
    return cv;
  }

  /** A flickering fire tongue cluster with its base at (x, y). */
  flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, t: number, seed: number) {
    for (let k = -w; k <= w; k += 2) {
      const fh = h * (1 - Math.abs(k) / (w + 2)) * (0.75 + 0.25 * Math.sin(t * 0.37 + k * 1.7 + seed)) + Math.sin(t * 0.83 + k + seed) * 1.5;
      ctx.fillStyle = '#b82008';
      ctx.fillRect(x + k, Math.round(y - fh), 2, Math.round(fh));
      ctx.fillStyle = '#ff8a18';
      ctx.fillRect(x + k, Math.round(y - fh * 0.75), 2, Math.round(fh * 0.75));
      if (Math.abs(k) < w * 0.6) {
        ctx.fillStyle = '#ffe070';
        ctx.fillRect(x + k, Math.round(y - fh * 0.4), 2, Math.round(fh * 0.4));
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    const mx = -Math.round(camX * 0.55);
    const sx = PYRE.x + mx;
    // the smoke column, billowing up and drifting right before the far keep
    for (let i = 0; i < 18; i++) {
      const life = ((t * 0.35 + i * 11) % 200) / 200;
      const x = sx + Math.sin(life * 5 + i) * 4 + life * life * 70;
      const y = 90 - life * 110;
      const rr = 4 + life * 16;
      ctx.fillStyle = `rgba(${40 + Math.round((1 - life) * 50)},${30 + Math.round((1 - life) * 20)},36,${0.7 * (1 - life)})`;
      ctx.fillRect(Math.round(x - rr), Math.round(y - rr * 0.7), Math.round(rr * 2), Math.round(rr * 1.4));
    }
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    ctx.drawImage(this.mid, mx, 0);
    // glow behind the pyre
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.05 + Math.sin(t * 0.13) * 0.012;
    ctx.fillStyle = `rgba(255,110,30,${pulse})`;
    for (const rr of [56, 38, 22]) ctx.fillRect(sx - rr, 118 - rr, rr * 2, rr * 2);
    ctx.globalCompositeOperation = 'source-over';
    this.witch(ctx, sx, t);
    this.flame(ctx, sx, 141, 22, 18, t, 0);
    this.flame(ctx, sx - 2, 134, 18, 8, t * 1.3, 2);
    // sparks flying up off the pyre
    for (let k = 0; k < 8; k++) {
      const e = (t * 0.9 + k * 23) % 70;
      ctx.fillStyle = e < 30 ? '#ffd060' : '#c04010';
      ctx.fillRect(Math.round(sx + Math.sin((t + k * 40) * 0.04) * 10 + (k - 4) * 3), Math.round(110 - e), 1, 1);
    }
    this.drawCrowd(ctx, mx, t);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // torches on their posts
    for (const tx of TORCHES) {
      const x = tx + dx;
      if (x < -30 || x > W + 30) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,120,30,0.06)';
      for (const rr of [26, 16, 9]) ctx.fillRect(x - rr, FLOOR - 58 - rr, rr * 2, rr * 2);
      ctx.globalCompositeOperation = 'source-over';
      this.flame(ctx, x, FLOOR - 52, 10, 4, t, tx);
    }
  }

  /** The witch tied to the stake: a pointy-hatted silhouette that wriggles and kicks. */
  witch(ctx: CanvasRenderingContext2D, x: number, t: number) {
    const wob = Math.round(Math.sin(t * 0.21) * 1.2);
    const kick = Math.sin(t * 0.33) > 0.3 ? 1 : 0;
    const dress = '#3a2448', skin = '#8ab060', hat = '#1a1014', rim = '#ffa050';
    // body and dress, bound against the stake
    ctx.fillStyle = dress;
    ctx.fillRect(x - 3, 101, 7, 9);
    ctx.fillRect(x - 4, 108, 9, 8);
    // striped stockings kicking under the hem
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(x - 3 - kick, 116, 2, 3);
    ctx.fillRect(x + 2 + kick, 116, 2, 3);
    ctx.fillStyle = '#a02030';
    ctx.fillRect(x - 3 - kick, 117, 2, 1);
    ctx.fillRect(x + 2 + kick, 117, 2, 1);
    // green hands flapping behind the stake
    ctx.fillStyle = skin;
    ctx.fillRect(x - 5, 102 + wob, 2, 2);
    ctx.fillRect(x + 4, 102 - wob, 2, 2);
    // green face with a long nose, straw hair, and a tall crooked hat
    const hx = x + wob;
    ctx.fillRect(hx - 2, 95, 5, 5);
    ctx.fillRect(hx + 3, 97, 2, 1);
    ctx.fillStyle = '#1a1014';
    ctx.fillRect(hx - 1, 96, 1, 1);
    ctx.fillRect(hx + 1, 96, 1, 1);
    ctx.fillRect(hx - 1, 98 + (kick ? 0 : 1), 3, 1); // yelling
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(hx - 3, 95, 1, 5);
    ctx.fillRect(hx + 3, 95, 1, 2);
    ctx.fillStyle = hat;
    ctx.fillRect(hx - 5, 94, 11, 1);
    ctx.fillRect(hx - 2, 90, 5, 4);
    ctx.fillRect(hx - 1, 86, 3, 4);
    ctx.fillRect(hx, 83, 2, 3);
    ctx.fillRect(hx + 2, 82, 2, 2);
    ctx.fillStyle = '#7a3a9a';
    ctx.fillRect(hx - 2, 92, 5, 1);
    // rope across the middle
    ctx.fillStyle = '#c8a868';
    ctx.fillRect(x - 4, 104, 9, 1);
    ctx.fillRect(x - 4, 112, 9, 1);
    // firelight from below
    ctx.fillStyle = rim;
    ctx.fillRect(hx - 5, 94, 2, 1);
    ctx.fillRect(hx + 4, 94, 2, 1);
    ctx.fillRect(x - 4, 115, 9, 1);
  }

  /** The crowd: dark silhouettes rimmed by the fire, shaking fists, forks and torches. */
  drawCrowd(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    for (const c of this.crowd) {
      const x = c.x + mx;
      if (x < -10 || x > W + 10) continue;
      const bob = Math.round(Math.max(0, Math.sin(t * 0.12 + c.ph)) * 1.5);
      const top = c.foot - c.h - bob;
      const lit = Math.max(0, 1 - Math.abs(c.x - PYRE.x) / 90);
      ctx.fillStyle = c.col;
      ctx.fillRect(x, top + 4, c.w, c.h - 4);
      ctx.fillRect(x + 1, top, c.w - 2, 4);
      if (c.hood) ctx.fillRect(x, top, c.w, 2);
      // the raised arm pumps with the jeering
      const up = Math.round(4 + Math.sin(t * 0.18 + c.ph * 2) * 2);
      const ax = x + (c.x < PYRE.x ? c.w : -1);
      if (c.arm < 3) ctx.fillRect(ax, top + 4 - up, 1, up + 2);
      if (c.arm === 0) ctx.fillRect(ax - 1, top + 3 - up, 2, 2);
      if (c.arm === 1) {
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(ax, top - up - 6, 1, 8);
        ctx.fillRect(ax - 2, top - up - 7, 5, 1);
        ctx.fillRect(ax - 2, top - up - 9, 1, 2);
        ctx.fillRect(ax + 2, top - up - 9, 1, 2);
        ctx.fillRect(ax, top - up - 9, 1, 2);
      }
      if (c.arm === 2) {
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(ax, top - up - 2, 1, 4);
        ctx.fillStyle = Math.sin(t * 0.5 + c.ph) > 0 ? '#ffb030' : '#ff6a18';
        ctx.fillRect(ax - 1, top - up - 5, 3, 3);
        ctx.fillStyle = '#ffe070';
        ctx.fillRect(ax, top - up - 4, 1, 1);
      }
      // rim light from the fire on the side facing it
      if (lit > 0.1) {
        ctx.fillStyle = `rgba(255,130,50,${0.3 + lit * 0.5})`;
        ctx.fillRect(c.x < PYRE.x ? x + c.w - 1 : x, top + 1, 1, c.h - 2);
        ctx.fillRect(x + 1, top, c.w - 2, 1);
      }
    }
  }

  /** Ash and embers drifting across the court, and a smoky haze up high. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 4; i++) {
      const x = ((i * 131 + t * 0.4 - camX * 0.9) % (W + 160) + W + 160) % (W + 160) - 80;
      ctx.fillStyle = 'rgba(60,40,50,0.08)';
      ctx.fillRect(Math.round(x), 8 + i * 9, 120, 6);
    }
    for (let i = 0; i < 24; i++) {
      const x = ((i * 47 + t * (0.4 + (i % 3) * 0.2) - camX) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = ((i * 61 - t * (0.25 + (i % 4) * 0.1)) % H + H) % H;
      ctx.fillStyle = i % 4 === 0 ? (Math.sin(t * 0.3 + i) > 0 ? '#ffa040' : '#c04010') : 'rgba(170,160,160,0.6)';
      ctx.fillRect(Math.round(x + Math.sin(t * 0.03 + i) * 3), Math.round(y), 1, 1);
    }
  }
}
