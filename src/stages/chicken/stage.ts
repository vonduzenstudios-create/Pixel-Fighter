import { FLOOR, H, W } from '../../core/consts';
import { rand, rng, Rng } from '../../core/rng';
import { drawText } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';

// "The Cluck Hut": Colonel Crisp's home turf, a 90s fried-chicken joint after closing time.
// Green and chocolate walls, a checker floor,
// booths under the windows, the order counter, and at the far right end the Fun Zone ball pit,
// whose balls are simulated and get kicked around by the fighters. All painted at load time.

const SW = 768;
const OUT_W = W + Math.ceil((SW - W) * 0.35);
/** World x where the ball pit starts; its bed is sunk below the restaurant floor. */
const PIT_X0 = 598;
const PIT_FLOOR = 216;
const BALL_R = 3;
const BALL_COLS = ['#e83040', '#f8c820', '#2c78e8', '#30c060', '#ff8a20', '#a050e0', '#ff60b0'];

// house colours: forest green, chocolate brown and mustard, with paprika and cream accents
const TEAL = '#2e7a46', GRAPE = '#5a2e16', TANG = '#e8a020', PINK = '#e0582a', LEMON = '#ffe8a0', GOLD = '#f0c030';

/** A golden fried drumstick with its bone knob sticking out. */
function drumstick(p: Painter, x: number, y: number, s: number, flip = false) {
  const d = flip ? -1 : 1;
  p.capsule(x - d * s * 2, y, s * 3.2, x + d * s * 3, y - s * 1.5, s * 1.4, '#c8782a');
  p.ellipse(x - d * s * 2.6, y - s, s * 1.4, s * 1, '#e8a048');
  p.rect(x + d * s * 3.5 - (flip ? s * 2 : 0), y - s * 2.2, s * 2, s * 1.2, '#f8f0e0');
  p.ellipse(x + d * s * 5.6, y - s * 2.2, s * 0.9, s * 0.9, '#f8f0e0');
  p.ellipse(x + d * s * 5.6, y - s * 1.2, s * 0.9, s * 0.9, '#f8f0e0');
}

/** A flaky buttermilk biscuit. */
function biscuit(p: Painter, x: number, y: number, s: number) {
  p.ellipse(x, y, s * 4, s * 2.6, '#d89a50');
  p.ellipse(x, y - s * 0.8, s * 3.4, s * 1.6, '#f0c070');
  p.rect(x - s * 3, y + s * 0.2, s * 6, Math.max(1, s * 0.6), '#fff0c8');
}

/** Clucky, the house mascot: a plump grinning hen in shades and a bow tie, giving a thumbs up. */
function clucky(p: Painter, cx: number, base: number, s: number) {
  const u = (v: number) => v * s;
  // scaly orange legs and three-toed feet
  for (const d of [-1, 1]) {
    const lx = cx + u(d * 6);
    p.rect(lx - u(1), base - u(15), u(2), u(14), '#f09020');
    for (const t of [-1, 0, 1]) p.line(lx, base - u(1), lx + u(t * 4 + d), base, '#f09020');
  }
  // tail feathers fanned out behind
  for (const [tx, ty, rx] of [[-17, -40, 6], [-20, -34, 6], [-19, -28, 5]]) p.ellipse(cx + u(tx), base + u(ty), u(rx), u(3), '#e8e0cc');
  // round body, lit from the upper left
  const by = base - u(28);
  for (let y = Math.floor(by - u(15)); y <= by + u(15); y++)
    for (let x = Math.floor(cx - u(17)); x <= cx + u(17); x++) {
      const dx = (x + 0.5 - cx) / u(17), dy = (y + 0.5 - by) / u(15);
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.5 - dy * 0.6;
      let c: Color = '#f8f2e2';
      if (l < -0.1 && bayer(x, y) < (-0.1 - l) * 2) c = '#d8ccb0';
      p.set(x, y, c);
    }
  // head with a red comb and wattle, yellow beak
  const hx = cx + u(5), hy = base - u(48);
  p.ellipse(hx, hy + u(4), u(6), u(5), '#f8f2e2');
  p.ellipse(hx, hy, u(9), u(9), '#f8f2e2');
  for (const [kx, ky, kr] of [[-4, -9, 2.6], [0, -11, 3], [4, -9, 2.6]]) p.ellipse(hx + u(kx), hy + u(ky), u(kr), u(kr), '#e03030');
  p.poly([[hx + u(8), hy - u(2)], [hx + u(16), hy + u(1)], [hx + u(8), hy + u(4)]], '#ffc020');
  p.ellipse(hx + u(8), hy + u(6.5), u(2), u(3), '#e03030');
  // shades and a grin
  p.rect(hx - u(7), hy - u(4), u(16), u(2), '#101018');
  p.ellipse(hx - u(2), hy - u(1.5), u(4), u(2.5), '#101018');
  p.ellipse(hx + u(5), hy - u(1.5), u(3.4), u(2.5), '#101018');
  p.set(hx - u(4), hy - u(2.5), '#80e0ff');
  for (let x = -4; x <= 3; x += 0.5) p.set(hx + u(x), hy + u(4.5) + u(x * x * 0.04), '#5a1810');
  // gold bow tie at the neck
  p.poly([[hx - u(6), hy + u(7)], [hx - u(1), hy + u(9.5)], [hx - u(6), hy + u(12)]], GOLD);
  p.poly([[hx + u(4), hy + u(7)], [hx - u(1), hy + u(9.5)], [hx + u(4), hy + u(12)]], GOLD);
  p.ellipse(hx - u(1), hy + u(9.5), u(1.4), u(1.4), darken(GOLD, 0.3));
  // one wing waving, the other giving a thumbs up
  p.ellipse(cx - u(16), by - u(10), u(4), u(9), '#ece4d0');
  p.capsule(cx + u(12), by, u(3.5), cx + u(23), by - u(8), u(3), '#ece4d0');
  p.ellipse(cx + u(24), by - u(13), u(1.6), u(4), '#ece4d0');
}

function outside(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(OUT_W, H);
  const r = rng(801);
  const stops = ['#140c34', '#2a1458', '#5a2070', '#a03a70', '#e8705a', '#ffb060'];
  for (let y = 0; y < 150; y++) {
    const t = Math.min(1, y / 130) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < OUT_W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  for (let i = 0; i < 50; i++) p.set(r.int(0, OUT_W), r.int(0, 50), r.next() < 0.3 ? '#fff4d0' : '#8070a8');
  // town skyline silhouette and a strip-mall row across the road
  let x = 0;
  while (x < OUT_W) {
    const w = r.int(14, 34), h = r.int(16, 50);
    p.rect(x, 128 - h, w, h + 22, '#24183e');
    for (let wy = 128 - h + 4; wy < 140; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r.next() < 0.3) p.rect(wx, wy, 2, 3, r.pick(['#ffd880', '#a0e0ff', '#ffb0d0']));
    x += w + r.int(0, 4);
  }
  // parking lot under sodium lamps
  p.rect(0, 140, OUT_W, H - 140, '#2a2436');
  for (let lx = 6; lx < OUT_W; lx += 24) p.rect(lx, 152, 10, 1, '#d8d0a0');
  for (let i = 0; i < 6; i++) {
    const cx = r.int(10, OUT_W - 30), col = r.pick(['#c03040', '#3060c0', '#e0d0a0', '#40a070']);
    p.rect(cx, 141, 26, 6, col);
    p.rect(cx + 5, 137, 15, 5, darken(col, 0.3));
    p.rect(cx + 7, 138, 11, 3, '#80a0c0');
    p.ellipse(cx + 5, 147, 2.5, 2.5, '#101010');
    p.ellipse(cx + 21, 147, 2.5, 2.5, '#101010');
  }
  for (let lx = 40; lx < OUT_W; lx += 120) {
    p.rect(lx, 70, 2, 80, '#3a3448');
    p.rect(lx - 4, 68, 10, 3, '#3a3448');
    glows.push({ x: lx + 1, y: 74, r: 30, col: '#ffb860', ph: lx });
  }
  // the roadside pole sign, Clucky on top
  const sx = 180;
  p.rect(sx - 2, 60, 5, 90, '#4a4458');
  p.rect(sx - 32, 64, 65, 22, GRAPE);
  p.rect(sx - 30, 66, 61, 18, TEAL);
  clucky(p, sx, 64, 0.75);
  glows.push({ x: sx, y: 70, r: 50, col: PINK, ph: 1 });
  const cv = p.canvas();
  drawText(cv.getContext('2d')!, 'CLUCK HUT', sx + 1, 72, LEMON, { align: 'center', outline: GRAPE });
  return cv;
}

interface Glow { x: number; y: number; r: number; col: string; ph: number }

// windows and the door in the room layer are left transparent so the street shows through
const WINDOWS = [[78, 150], [160, 232], [242, 314]];

function room(glows: Glow[], lights: number[]): HTMLCanvasElement {
  const p = new Painter(SW, H);
  const r = rng(823);
  // upper wall: teal with a 90s confetti print
  for (let y = 18; y < 128; y++) for (let x = 0; x < PIT_X0; x++) p.set(x, y, bayer(x, y) < 0.08 ? lighten(TEAL, 0.1) : TEAL);
  for (let i = 0; i < 240; i++) {
    const x = r.int(0, PIT_X0 - 6), y = r.int(22, 122), c = r.pick([PINK, LEMON, '#ffffff', GRAPE, TANG]);
    switch (r.int(0, 2)) {
      case 0: p.poly([[x, y + 4], [x + 2, y], [x + 4, y + 4]], c); break;
      case 1: for (let k = 0; k < 6; k++) p.set(x + k, y + Math.round(Math.sin(k * 1.4) * 1.5), c); break;
      default: p.rect(x, y, 2, 2, c);
    }
  }
  // wainscot: grape panels under a chrome rail, tangerine stripe
  p.rect(0, 128, PIT_X0, 3, '#d8e0e8');
  p.rect(0, 129, PIT_X0, 1, '#ffffff');
  for (let y = 131; y < FLOOR; y++) for (let x = 0; x < PIT_X0; x++) p.set(x, y, x % 24 === 0 ? darken(GRAPE, 0.3) : bayer(x, y) < 0.1 ? lighten(GRAPE, 0.08) : GRAPE);
  p.rect(0, 160, PIT_X0, 3, TANG);
  // drop ceiling with fluorescent panels
  p.rect(0, 0, SW, 18, '#d8d4c8');
  for (let x = 0; x < SW; x += 32) p.rect(x, 0, 1, 18, '#a8a498');
  p.rect(0, 9, SW, 1, '#a8a498');
  p.rect(0, 17, SW, 2, '#8a867c');
  for (let lx = 20; lx < SW; lx += 96) {
    p.rect(lx, 2, 40, 6, '#f8fff8');
    p.rect(lx, 7, 40, 1, '#c0d0c8');
    lights.push(lx + 20);
  }
  // front door at the far left
  p.rect(6, 40, 56, FLOOR - 40, '#b8c0c8');
  for (let y = 44; y < FLOOR - 2; y++) for (let x = 10; x < 58; x++) if (x !== 33 && x !== 34) p.set(x, y, [0, 0, 0], 0);
  p.rect(26, 110, 4, 16, '#d8e0e8');
  p.rect(37, 110, 4, 16, '#d8e0e8');
  // windows with booths under them
  for (const [x0, x1] of WINDOWS) {
    p.rect(x0 - 3, 34, x1 - x0 + 6, 96, '#b8c0c8');
    for (let y = 37; y < 124; y++) for (let x = x0; x < x1; x++) p.set(x, y, [0, 0, 0], 0);
    p.rect(x0 - 3, 124, x1 - x0 + 6, 4, '#d8e0e8');
    // a striped awning valance
    for (let x = x0 - 4; x < x1 + 4; x++) for (let y = 30; y < 38; y++) p.set(x, y, Math.floor((x - x0) / 6) % 2 ? '#ffffff' : TANG);
    for (let x = x0 - 4; x < x1 + 4; x += 6) p.ellipse(x + 3, 38, 3, 2, Math.floor((x - x0) / 6) % 2 ? '#ffffff' : TANG, false);
    // booth: tangerine vinyl backs either side of a table
    const mid = (x0 + x1) / 2;
    for (const bx of [x0 + 2, x1 - 18]) {
      p.rect(bx, 136, 16, 44, '#e8701c');
      for (let y = 140; y < 176; y += 8) p.rect(bx + 1, y, 14, 1, '#b8500c');
      p.rect(bx, 136, 16, 2, '#ffa050');
      p.rect(bx - 2, 176, 20, 6, '#c85a14');
    }
    p.rect(mid - 22, 160, 44, 4, '#f4f0e0');
    p.rect(mid - 22, 164, 44, 1, '#b8b4a8');
    p.rect(mid - 2, 165, 4, 33, '#c0c8d0');
    p.rect(mid - 10, 196, 20, 2, '#808890');
    // supper on a tray: drumsticks, a biscuit, a cup
    p.rect(mid - 16, 158, 22, 2, '#7a3e1a');
    drumstick(p, mid - 11, 155, 1);
    drumstick(p, mid - 6, 152, 0.9, true);
    biscuit(p, mid + 2, 155, 0.9);
    p.rect(mid + 10, 150, 6, 10, '#ffffff');
    p.rect(mid + 10, 153, 6, 2, TEAL);
    p.rect(mid + 13, 146, 1, 4, PINK);
  }
  // the order counter, menu boards above, kitchen pass-through behind
  const C0 = 340, C1 = 552;
  p.rect(C0, 86, C1 - C0, 60, '#3a3440');
  for (let y = 88; y < 144; y += 6) for (let x = C0 + 2; x < C1 - 2; x += 8) p.rect(x + ((y / 6) % 2) * 4, y, 7, 5, '#d8d4c4');
  // heat lamps over the pass with chicken in waiting
  for (let hx = C0 + 30; hx < C1 - 20; hx += 50) {
    p.rect(hx - 1, 86, 2, 20, '#606070');
    p.poly([[hx - 9, 112], [hx - 5, 104], [hx + 5, 104], [hx + 9, 112]], '#a0a0b0');
    glows.push({ x: hx, y: 118, r: 22, col: '#ff7030', ph: hx * 0.3 });
    for (let k = -1; k <= 1; k++) drumstick(p, hx + k * 9, 138, 0.8, k > 0);
  }
  p.rect(C0 - 4, 82, C1 - C0 + 8, 4, '#d8e0e8');
  // three backlit menu boards
  const boards: [string, string, string][] = [['TENDERS', '#2a1a10', '2.49'], ['WINGS', '#2a1a10', '1.99'], ['BISCUITS', '#2a1a10', '.69']];
  boards.forEach(([, bg], i) => {
    const bx = C0 + 6 + i * 70;
    p.rect(bx, 24, 64, 54, '#101018');
    p.rect(bx + 2, 26, 60, 50, bg);
    p.rect(bx + 2, 26, 60, 9, i === 1 ? TANG : i === 2 ? PINK : TEAL);
    // a little picture of each item
    if (i === 0) {
      for (let k = 0; k < 3; k++) p.capsule(bx + 9, 44 + k * 6, 2.5, bx + 23, 42 + k * 6, 2.5, k % 2 ? '#d08838' : '#c8782a');
    } else if (i === 1) {
      drumstick(p, bx + 13, 46, 1.4);
      drumstick(p, bx + 17, 56, 1.4, true);
    } else {
      biscuit(p, bx + 16, 46, 2);
      biscuit(p, bx + 16, 57, 2);
    }
    for (let ly = 0; ly < 4; ly++) {
      p.rect(bx + 30, 42 + ly * 7, 18 - (ly % 2) * 6, 2, '#c8c0d8');
      p.rect(bx + 52, 42 + ly * 7, 7, 2, LEMON);
    }
    glows.push({ x: bx + 32, y: 50, r: 40, col: '#ffe0a0', ph: i * 2 });
  });
  // the counter itself: steel top, tangerine and teal front with registers
  p.rect(C0 - 6, 144, C1 - C0 + 12, 5, '#d8e0e8');
  p.rect(C0 - 6, 144, C1 - C0 + 12, 1, '#ffffff');
  for (let y = 149; y < FLOOR; y++) for (let x = C0 - 4; x < C1 + 4; x++) p.set(x, y, y < 172 ? (bayer(x, y) < 0.1 ? lighten(TANG, 0.1) : TANG) : y < 176 ? LEMON : TEAL);
  for (const rx of [C0 + 20, C0 + 110]) {
    p.rect(rx, 132, 22, 12, '#2a2a34');
    p.rect(rx + 2, 134, 18, 4, '#60ff90');
    p.rect(rx + 4, 126, 14, 6, '#3a3a48');
  }
  // drink fountain
  p.rect(C1 - 40, 118, 30, 26, '#c0c8d0');
  for (let k = 0; k < 4; k++) p.rect(C1 - 38 + k * 7, 122, 5, 8, [PINK, LEMON, TEAL, TANG][k]);
  // Clucky on the counter front
  clucky(p, (C0 + C1) / 2 - 4, 196, 0.6);
  // Clucky's statue by the Fun Zone door
  clucky(p, 554, FLOOR, 1.2);
  p.shade(0.1);
  // ---- the Fun Zone: padded walls, a cargo net, an overhead tube slide
  for (let y = 18; y < FLOOR; y++)
    for (let x = PIT_X0 - 8; x < SW; x++) {
      const band = Math.floor((x - PIT_X0) / 20) & 3;
      p.set(x, y, bayer(x, y) < 0.1 ? '#3a2a6a' : ['#2a2a5a', '#2a3a6a', '#3a2a5a', '#2a3a5a'][band]);
    }
  for (let x = PIT_X0; x < SW; x += 20) p.rect(x, 18, 1, FLOOR - 18, '#1a1a40');
  // star stickers on the padding
  for (let i = 0; i < 18; i++) {
    const sx = r.int(PIT_X0 + 4, SW - 6), sy = r.int(26, 120), c = r.pick([LEMON, PINK, '#80f0ff', '#90ff90']);
    p.rect(sx - 2, sy, 5, 1, c);
    p.rect(sx, sy - 2, 1, 5, c);
  }
  // cargo net strung across the back
  for (let y = 60; y < FLOOR - 6; y++)
    for (let x = PIT_X0 + 10; x < SW - 8; x++)
      if ((x + y) % 10 === 0 || (x - y + 1000) % 10 === 0) p.set(x, y, '#e8e0c0');
  p.rect(PIT_X0 + 8, 58, SW - PIT_X0 - 14, 3, '#c83040');
  // a big spiral tube slide coming down from the ceiling
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    const x = SW - 24 - Math.sin(t * Math.PI * 1.2) * 70, y = 20 + t * 130;
    p.ellipse(x, y, 11, 11, k % 8 < 4 ? '#ff4a6a' : '#ff6a8a');
  }
  for (let k = 0; k <= 60; k += 6) {
    const t = k / 60;
    p.ellipse(SW - 24 - Math.sin(t * Math.PI * 1.2) * 70, 20 + t * 130, 11, 2, '#c02848');
  }
  // FUN ZONE sign
  p.rect(PIT_X0 + 18, 26, 84, 22, '#101018');
  p.rect(PIT_X0 + 20, 28, 80, 18, GRAPE);
  // the pit itself in cross-section: blue padded walls and a pink cushion bed
  for (let y = FLOOR; y < H; y++) for (let x = PIT_X0; x < SW; x++) p.set(x, y, y >= PIT_FLOOR ? (bayer(x, y) < 0.2 ? '#ff7ab0' : PINK) : bayer(x, y) < 0.15 ? '#22205a' : '#1a1848');
  // padded bumper post at the pit's lip
  p.rect(PIT_X0 - 8, FLOOR - 12, 8, H - FLOOR + 12, '#2c78e8');
  p.rect(PIT_X0 - 8, FLOOR - 12, 8, 2, '#80b0ff');
  p.rect(PIT_X0 - 2, FLOOR - 12, 2, H - FLOOR + 12, '#1a50b0');
  p.rect(PIT_X0 - 8, FLOOR + 2, 8, 2, LEMON);
  // ---- checker floor with a glossy shine
  for (let y = FLOOR; y < H; y++) {
    const row = y - FLOOR;
    const sz = 6 + Math.floor(row / 6) * 2;
    for (let x = 0; x < PIT_X0 - 8; x++) {
      const on = (Math.floor(x / sz) + Math.floor((row + 2) / 7)) % 2 === 0;
      let c: Color = on ? '#f4f0e8' : '#2a6a40';
      if (bayer(x, y) < 0.08) c = lighten(c, 0.15);
      p.set(x, y, c);
    }
  }
  p.rect(0, FLOOR, PIT_X0 - 8, 1, '#ffffff');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  boards.forEach(([name, , price], i) => {
    const bx = C0 + 6 + i * 70;
    drawText(ctx, name, bx + 32, 27, '#ffffff', { align: 'center' });
    drawText(ctx, price, bx + 16, 66, LEMON, { align: 'center' });
  });
  drawText(ctx, 'THE CLUCK HUT', (C0 + C1) / 2, 151, '#ffffff', { align: 'center', outline: GRAPE });
  drawText(ctx, 'FUN ZONE', PIT_X0 + 60, 32, LEMON, { align: 'center', outline: PINK });
  drawText(ctx, 'EXIT', 34, 30, '#ff5050', { align: 'center' });
  return cv;
}

/** The uppercut finish drops the loser through the floor into the kitchen's giant fryer. */
function kitchen(bones: PartSet): [HTMLCanvasElement, HTMLCanvasElement] {
  const p = new Painter(W, H);
  const r = rng(851);
  // greasy cream tiles
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const grout = x % 12 === 0 || y % 12 === 0;
      let c: Color = grout ? '#8a8270' : '#d8d0b0';
      if (!grout && bayer(x, y) < 0.15 + (y / H) * 0.3) c = '#c0b48a';
      p.set(x, y, c);
    }
  // the extractor hood
  p.poly([[20, 0], [236, 0], [250, 50], [6, 50]], '#a8b0b8');
  p.rect(6, 50, 244, 6, '#808890');
  for (let x = 40; x < 220; x += 12) p.rect(x, 20, 6, 22, '#70787f');
  // shelves of biscuits and a warning sign
  p.rect(10, 72, 50, 3, '#808890');
  for (let k = 0; k < 4; k++) p.ellipse(18 + k * 12, 68, 5, 4, '#e8a050');
  p.rect(200, 64, 40, 26, LEMON);
  p.poly([[220, 68], [228, 84], [212, 84]], '#101018');
  p.rect(219, 73, 2, 6, LEMON);
  p.rect(219, 81, 2, 2, LEMON);
  // a previous challenger, done to a crisp
  const bg = p.canvas();
  const bctx = bg.getContext('2d')!;
  bctx.imageSmoothingEnabled = false;
  bctx.save();
  bctx.translate(196, 172);
  bctx.scale(-1, 1);
  drawRig(bctx, bones, fk(P(LIE, { rot: -60, af: -150, ab: -120, lf: -20, kf: 40, h: 20 })));
  bctx.restore();
  drawText(bctx, 'HOT', 220, 92, '#101018', { align: 'center' });
  // the vat front: bubbling oil surface and a steel tank, drawn over the victim
  const f = new Painter(W, H);
  for (let x = 0; x < W; x++) {
    const sy = 158 + Math.round(Math.sin(x * 0.2) * 1.5);
    for (let y = sy; y < 172; y++) f.set(x, y, y === sy ? '#fff0a0' : bayer(x, y) < 0.3 ? '#e8b030' : '#c88a18');
  }
  for (let i = 0; i < 40; i++) {
    const bx = r.int(4, W - 4), by = r.int(158, 168);
    f.ellipse(bx, by, r.int(1, 3), 1, '#fff4c0');
  }
  for (let y = 172; y < H; y++)
    for (let x = 0; x < W; x++) f.set(x, y, x % 40 < 2 ? '#707880' : bayer(x, y) < 0.25 ? '#c8d0d8' : '#a8b0b8');
  f.rect(0, 172, W, 3, '#e8f0f8');
  // basket handles hooked on the rim
  for (const hx of [40, 200]) {
    f.rect(hx, 140, 3, 34, '#505860');
    f.rect(hx - 4, 140, 10, 4, '#202024');
  }
  // heat shimmer stripes on the tank
  for (let x = 6; x < W; x += 24) f.rect(x, 190, 12, 3, '#ff6a20');
  return [bg, f.canvas()];
}

/** A shiny plastic ball, pre-rendered per colour. */
function ballSprite(c: string, back: boolean): HTMLCanvasElement {
  const p = new Painter(7, 7);
  const base = back ? darken(c, 0.22) : c;
  p.ellipse(3.5, 3.5, 3, 3, base);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (p.alpha(x, y) && x + y > 7) p.set(x, y, darken(base, 0.25));
  p.set(2, 2, lighten(base, 0.6));
  p.set(3, 2, lighten(base, 0.3));
  return p.canvas();
}

interface Ball { x: number; y: number; vx: number; vy: number; c: number; z: number }

const hexA = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export class ChickenStage {
  name = 'THE CLUCK HUT';
  blurb = 'FRIED CHICKEN AND A BALL PIT';
  song: SongName = 'chicken';
  width = SW;
  outGlows: Glow[] = [];
  glows: Glow[] = [];
  lights: number[] = [];
  outside = outside(this.outGlows);
  room = room(this.glows, this.lights);
  pit: HTMLCanvasElement;
  pitFront: HTMLCanvasElement;
  sprites = [BALL_COLS.map((c) => ballSprite(c, true)), BALL_COLS.map((c) => ballSprite(c, false))];
  balls: Ball[] = [];
  /** Each fighter's last position, to push balls with the speed they move at. */
  prev = new Map<object, { x: number; y: number; vy: number }>();

  constructor(bones: PartSet) {
    [this.pit, this.pitFront] = kitchen(bones);
    this.reset();
  }

  /** Refill the pit and let it settle so it looks at rest on stage select. */
  reset() {
    const r = rng(877);
    this.balls = [];
    this.prev.clear();
    for (let z = 0; z < 2; z++)
      for (let i = 0; i < 140; i++) {
        const cols = Math.floor((SW - PIT_X0 - 8) / 6);
        this.balls.push({ x: PIT_X0 + 6 + (i % cols) * 6 + r.range(-1, 1), y: PIT_FLOOR - 4 - Math.floor(i / cols) * 6, vx: 0, vy: 0, c: r.int(0, BALL_COLS.length - 1), z });
      }
    for (let i = 0; i < 240; i++) this.simulate();
  }

  update(f: Fight) {
    for (const ft of f.f) {
      const pv = this.prev.get(ft) ?? { x: ft.x, y: ft.y, vy: 0 };
      const dx = ft.x - pv.x, vy = ft.y - pv.y;
      if (ft.alpha > 0 && ft.state !== 'thrown') {
        this.shove(ft.hurtbox(), dx);
        // landing hard sends a splash of balls flying
        if (ft.y === 0 && pv.y > 0 && pv.vy < -2.5) this.splash(ft.x, Math.min(8, -pv.vy * 1.2));
        const sp = ft.strikePoint();
        if (sp) this.strike(sp.x, FLOOR - sp.y, sp.hit.r + BALL_R + 2, ft.facing * (2 + sp.hit.dmg / 18), ft.move?.id === 'uppercut' ? -7 : -1.5 - sp.hit.dmg / 40);
      }
      this.prev.set(ft, { x: ft.x, y: ft.y, vy });
    }
    for (const pr of f.projectiles) if (!pr.dead) this.strike(pr.x, FLOOR - pr.y, pr.r + BALL_R, Math.sign(pr.vx) * 3, -2);
    this.simulate();
  }

  /** Push balls out of a fighter's body, carrying them along at the fighter's speed. */
  shove(hb: [number, number, number, number], dx: number) {
    const x0 = hb[0] - BALL_R, x1 = hb[2] + BALL_R, top = FLOOR - hb[3] - BALL_R, bot = FLOOR - hb[1] + BALL_R;
    for (const b of this.balls) {
      if (b.x < x0 || b.x > x1 || b.y < top || b.y > bot || b.y > FLOOR) continue;
      const l = b.x - x0, rr = x1 - b.x, u = b.y - top;
      if (u < l && u < rr) {
        b.y = top;
        b.vy = Math.min(b.vy, -0.5);
      } else if (l < rr) {
        b.x = x0;
        b.vx = Math.min(b.vx, dx * 1.3 - 0.4);
      } else {
        b.x = x1;
        b.vx = Math.max(b.vx, dx * 1.3 + 0.4);
      }
      if (Math.abs(dx) > 0.5) b.vy -= Math.abs(dx) * 0.4 * Math.random();
    }
  }

  strike(x: number, y: number, rad: number, vx: number, vy: number) {
    for (const b of this.balls) {
      const ddx = b.x - x, ddy = b.y - y;
      if (ddx * ddx + ddy * ddy > rad * rad) continue;
      b.vx = vx * rand(0.7, 1.3) + ddx * 0.1;
      b.vy = vy * rand(0.7, 1.3) + ddy * 0.05;
    }
  }

  splash(x: number, force: number) {
    for (const b of this.balls) {
      const d = b.x - x;
      if (Math.abs(d) > 30 || b.y < FLOOR - 20) continue;
      const k = 1 - Math.abs(d) / 30;
      b.vy = -force * k * rand(0.6, 1.2);
      b.vx += Math.sign(d || 1) * force * 0.4 * k * rand(0.5, 1.2);
    }
  }

  simulate() {
    const bs = this.balls, D = BALL_R * 2;
    for (const b of bs) {
      b.vy += 0.2;
      b.vx *= 0.995;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < 4 + BALL_R) { b.x = 4 + BALL_R; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > SW - 2 - BALL_R) { b.x = SW - 2 - BALL_R; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < 22) { b.y = 22; b.vy = Math.abs(b.vy) * 0.4; }
      // the pit's inner wall below the lip
      if (b.y + BALL_R > FLOOR + 1 && b.x - BALL_R < PIT_X0 && b.x > PIT_X0 - BALL_R) { b.x = PIT_X0 + BALL_R; b.vx = Math.abs(b.vx) * 0.4; }
      const g = b.x > PIT_X0 ? PIT_FLOOR : FLOOR;
      if (b.y + BALL_R > g) {
        b.y = g - BALL_R;
        b.vy = b.vy > 1 ? -b.vy * 0.35 : 0;
        b.vx *= g === FLOOR ? 0.97 : 0.85;
      }
    }
    // ball against ball, per depth layer, sweeping along x
    for (let z = 0; z < 2; z++) {
      const L = bs.filter((b) => b.z === z).sort((a, b) => a.x - b.x);
      for (let it = 0; it < 2; it++)
        for (let i = 0; i < L.length; i++) {
          const a = L[i];
          for (let j = i + 1; j < L.length; j++) {
            const b = L[j];
            const dx = b.x - a.x;
            if (dx >= D) break;
            const dy = b.y - a.y, d2 = dx * dx + dy * dy;
            if (d2 >= D * D || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (D - d) / 2;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              const imp = -rv * 0.6;
              a.vx -= nx * imp; a.vy -= ny * imp;
              b.vx += nx * imp; b.vy += ny * imp;
            }
          }
        }
    }
    // re-floor after the overlap pass so nothing sinks through the bed
    for (const b of bs) {
      const g = b.x > PIT_X0 ? PIT_FLOOR : FLOOR;
      if (b.y + BALL_R > g) b.y = g - BALL_R;
      if (Math.abs(b.vx) < 0.02) b.vx = 0;
    }
  }

  drawBalls(ctx: CanvasRenderingContext2D, camX: number, z: number) {
    const sp = this.sprites[z];
    for (const b of this.balls) {
      if (b.z !== z) continue;
      const x = Math.round(b.x - camX) - 3;
      if (x < -7 || x > W) continue;
      ctx.drawImage(sp[b.c], x, Math.round(b.y) - 3);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const ox = -Math.round(camX * 0.35);
    ctx.drawImage(this.outside, ox, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.outGlows) {
      // the pole sign's neon buzzes and flickers now and then
      const flick = g.col === PINK && Math.sin(t * 0.37) > 0.93 ? 0.02 : 0.22;
      this.glow(ctx, g.x + ox, g.y, g.r, g.col, flick + 0.05 * Math.sin(t * 0.05 + g.ph));
    }
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    ctx.drawImage(this.room, dx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const sx = g.x + dx;
      if (sx < -g.r * 2 || sx > W + g.r * 2) continue;
      this.glow(ctx, sx, g.y, g.r, g.col, 0.16 + 0.05 * Math.sin(t * 0.04 + g.ph));
    }
    // fluorescent light wash, one tube on the fritz
    for (const [i, lx] of this.lights.entries()) {
      const sx = lx + dx;
      if (sx < -60 || sx > W + 60) continue;
      const bad = i === 3 && (t % 140 < 6 || (t % 140 > 10 && t % 140 < 13));
      this.glow(ctx, sx, 8, 50, '#d8fff0', bad ? 0.02 : 0.12);
    }
    ctx.globalCompositeOperation = 'source-over';
    this.drawBalls(ctx, camX, 0);
  }

  /** The front layer of balls covers the fighters' legs as they wade through the pit. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number) {
    this.drawBalls(ctx, camX, 1);
  }

  glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, Math.max(0, a)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }
}
