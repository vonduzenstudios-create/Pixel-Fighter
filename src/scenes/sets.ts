import type { CharDef } from '../game/fighter';

/**
 * Little dioramas ("sets") that each fighter stands in on the character select screen.
 * A painter draws the back wall and floor of one set into a box; the select screen clips
 * to the box and stands the fighter on the floor afterwards. The same painter is used for
 * the small roster tiles and the big preview panels, so draw in terms of w, h, floor and u.
 *
 * A fighter picks its set with CharDef.selectSet (set in its src/fighters/<id>/index.ts); one
 * without gets a spotlight backdrop tinted from its outfit.
 */
export interface SetGfx {
  w: number;
  h: number;
  /** Top of the floor, relative to the box. The fighter's feet sit a little below this. */
  floor: number;
  /** Chunky pixel unit: 1 in roster tiles, 2 or more in the big panels. */
  u: number;
  t: number;
  /** Fill a rect relative to the box (coordinates are rounded to whole pixels). */
  r(x: number, y: number, w: number, h: number, c: string): void;
  ctx: CanvasRenderingContext2D;
}
export type SetPainter = (g: SetGfx, c: CharDef) => void;

/** Fraction of the box height where the floor starts. */
export const FLOOR_AT = 0.7;

// ------------------------------------------------------------------ helpers
/** Horizontal colour bands from top to bottom, a cheap 16-bit style gradient. */
function bands(g: SetGfx, y0: number, y1: number, cols: string[]) {
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    const a = y0 + ((y1 - y0) * i) / n, b = y0 + ((y1 - y0) * (i + 1)) / n;
    g.r(0, a, g.w, Math.ceil(b - a) + 1, cols[i]);
  }
}
function planks(g: SetGfx, a: string, b: string, line: string) {
  bands(g, g.floor, g.h, [a, b]);
  const n = Math.max(3, Math.round(g.w / (10 * g.u)));
  for (let i = 0; i <= n; i++) {
    // planks fan out toward the viewer
    const top = (i / n) * g.w, bot = (i / n - 0.5) * g.w * 1.5 + g.w / 2;
    for (let y = g.floor; y < g.h; y += g.u) {
      const k = (y - g.floor) / (g.h - g.floor);
      g.r(top + (bot - top) * k, y, g.u, g.u, line);
    }
  }
  g.r(0, g.floor, g.w, g.u, line);
}
function checker(g: SetGfx, a: string, b: string, size = 4) {
  const s = size * g.u;
  for (let y = g.floor, row = 0; y < g.h; y += s, row++)
    for (let x = 0, col = 0; x < g.w; x += s, col++) g.r(x, y, s, s, (row + col) % 2 ? a : b);
}
function flame(g: SetGfx, x: number, y: number, s: number, seed = 0) {
  const f = Math.sin(g.t * 0.3 + seed) > 0 ? 1 : 0;
  g.r(x - s, y - 2 * s - f * g.u, 2 * s, 2 * s + f * g.u, '#ff6010');
  g.r(x - s / 2, y - 3 * s + f * g.u, s, 2 * s, '#ffb020');
  g.r(x - s / 4, y - 2 * s, s / 2, s, '#fff0a0');
}
function spot(g: SetGfx, cx: number, col: string, alpha = 0.18) {
  const { ctx } = g;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx - g.w * 0.08, 0);
  ctx.lineTo(cx + g.w * 0.08, 0);
  ctx.lineTo(cx + g.w * 0.38, g.h);
  ctx.lineTo(cx - g.w * 0.38, g.h);
  ctx.fill();
  ctx.restore();
}
function stars(g: SetGfx, n: number, col = '#fff', ymax = g.floor) {
  for (let i = 0; i < n; i++) {
    const x = (i * 97.3) % g.w, y = (i * 53.7) % ymax;
    if ((i + (g.t >> 4)) % 7) g.r(x, y, g.u, g.u, col);
  }
}

// ------------------------------------------------------------------ the sets
export const SETS: Record<string, SetPainter> = {
  /** Wood-panelled study with a moonlit window. */
  study(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#4a2018', '#5a281c', '#6a301e']);
    g.r(0, g.floor - 7 * u, g.w, 7 * u, '#3a1a10');
    g.r(0, g.floor - 7 * u, g.w, u, '#8a5030');
    const wx = g.w * 0.66, ww = 9 * u, wy = 5 * u;
    g.r(wx - u, wy - u, ww + 2 * u, 13 * u, '#2a120a');
    g.r(wx, wy, ww, 11 * u, '#1a2a50');
    g.r(wx + 5 * u, wy + 2 * u, 2 * u, 2 * u, '#f0f0d0');
    g.r(wx + ww / 2 - u / 2, wy, u, 11 * u, '#2a120a');
    g.r(wx - 3 * u, wy - 2 * u, 3 * u, 15 * u, '#8a1818');
    g.r(wx + ww, wy - 2 * u, 3 * u, 15 * u, '#8a1818');
    planks(g, '#5a3418', '#6a3c1c', '#3a200c');
    g.r(g.w * 0.2, g.floor + 3 * u, g.w * 0.6, (g.h - g.floor) * 0.5, '#7a1a1a');
  },
  /** Night laboratory with a crackling coil. */
  lab(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#10141e', '#161c2a', '#1c2434']);
    for (let x = 0; x < g.w; x += 8 * u) g.r(x, 0, u, g.floor, '#0c1018');
    const cx = g.w * 0.82;
    g.r(cx - 3 * u, g.floor - 3 * u, 6 * u, 3 * u, '#3a3a44');
    g.r(cx - u, g.floor - 16 * u, 2 * u, 13 * u, '#b07030');
    g.r(cx - 3 * u, g.floor - 19 * u, 6 * u, 3 * u, '#c0c0d0');
    if ((g.t >> 2) % 3) {
      let x = cx, y = g.floor - 18 * u;
      for (let i = 0; i < 6; i++) {
        const nx = x - (2 + ((g.t * 7 + i * 13) % 4)) * u, ny = y + (((g.t * 5 + i * 11) % 5) - 2) * u;
        g.r(Math.min(x, nx), Math.min(y, ny), Math.abs(nx - x) + u, u, '#a0e0ff');
        (x = nx), (y = ny);
      }
    }
    checker(g, '#2a2e3a', '#3a404e');
  },
  /** Castle hall: stone blocks, a banner and a torch. */
  castle(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.floor, '#4a4a54');
    for (let y = 0, row = 0; y < g.floor; y += 4 * u, row++)
      for (let x = (row % 2) * 4 * u - 4 * u; x < g.w; x += 8 * u) {
        g.r(x, y, 8 * u, u, '#34343c');
        g.r(x, y, u, 4 * u, '#34343c');
      }
    const bx = g.w * 0.22;
    g.r(bx, 2 * u, 7 * u, 14 * u, '#1a3a8a');
    g.r(bx + 3 * u, 4 * u, u, 8 * u, '#e8c040');
    g.r(bx + u, 7 * u, 5 * u, u, '#e8c040');
    g.r(bx, 16 * u, 2 * u, 2 * u, '#1a3a8a');
    g.r(bx + 5 * u, 16 * u, 2 * u, 2 * u, '#1a3a8a');
    const tx = g.w * 0.82;
    g.r(tx - u, 12 * u, 2 * u, 5 * u, '#5a3a20');
    flame(g, tx, 12 * u, 2 * u);
    bands(g, g.floor, g.h, ['#3a3a42', '#44444c']);
    for (let x = 0; x < g.w; x += 10 * u) g.r(x, g.floor, u, g.h, '#2a2a30');
  },
  /** Ship deck at dusk with a rolling sea. */
  ship(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#2a1a3a', '#5a2a4a', '#a04a3a', '#e08a4a']);
    const sea = g.floor - 6 * u;
    g.r(0, sea, g.w, 6 * u, '#1a3a5a');
    for (let x = 0; x < g.w; x += 6 * u) g.r(x + ((g.t >> 3) % 6) * u - 6 * u, sea + 2 * u, 3 * u, u, '#4a7aa0');
    g.r(g.w * 0.75, 0, 3 * u, g.floor, '#4a2a14');
    g.r(g.w * 0.75 - 6 * u, 6 * u, 15 * u, u, '#4a2a14');
    g.r(0, sea - u, g.w, u, '#3a200c');
    for (let x = 2 * u; x < g.w; x += 6 * u) g.r(x, sea - u, u, 6 * u, '#3a200c');
    g.r(0, g.floor - u, g.w, 2 * u, '#5a3418');
    planks(g, '#7a4a22', '#8a5428', '#4a2a10');
  },
  /** Paper-screen dojo. */
  dojo(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.floor, '#3a2416');
    for (let x = 2 * u; x < g.w - 4 * u; x += 14 * u) {
      g.r(x, 3 * u, 12 * u, g.floor - 5 * u, '#f0e4c4');
      for (let k = 4 * u; k < 12 * u; k += 4 * u) g.r(x + k, 3 * u, u, g.floor - 5 * u, '#5a3a20');
      for (let k = 3 * u + 5 * u; k < g.floor - 2 * u; k += 5 * u) g.r(x, k, 12 * u, u, '#5a3a20');
    }
    g.r(g.w / 2 - 2 * u, 2 * u, 4 * u, 12 * u, '#e8dcc0');
    g.r(g.w / 2 - u, 4 * u, 2 * u, 2 * u, '#1a1a1a');
    g.r(g.w / 2 - u, 8 * u, 2 * u, 3 * u, '#1a1a1a');
    planks(g, '#a07040', '#b07c48', '#7a5028');
  },
  /** Desert sunset with mesas and a cactus. */
  western(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#f0a040', '#f08038', '#e06030', '#c04830']);
    g.r(g.w * 0.5 - 4 * u, 6 * u, 8 * u, 8 * u, '#ffe080');
    g.r(0, g.floor - 7 * u, g.w * 0.35, 7 * u, '#7a3020');
    g.r(g.w * 0.08, g.floor - 10 * u, g.w * 0.2, 3 * u, '#7a3020');
    g.r(g.w * 0.62, g.floor - 5 * u, g.w * 0.4, 5 * u, '#8a3a24');
    const cx = g.w * 0.86;
    g.r(cx, g.floor - 13 * u, 2 * u, 13 * u, '#2a6a2a');
    g.r(cx - 3 * u, g.floor - 10 * u, 2 * u, 5 * u, '#2a6a2a');
    g.r(cx - 3 * u, g.floor - 6 * u, 4 * u, u, '#2a6a2a');
    bands(g, g.floor, g.h, ['#c08a50', '#b07a44']);
  },
  /** Boxing ring under the arena lights. */
  ring(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#08080e', '#10101a', '#181826']);
    for (let i = 0; i < 18; i++) if ((i * 7 + (g.t >> 3)) % 11 === 0) g.r((i * 41) % g.w, ((i * 23) % (g.floor * 0.5)) + 2 * u, u, u, '#fff');
    spot(g, g.w / 2, '#fff8d0', 0.15);
    const post = (x: number) => g.r(x, g.floor - 16 * u, 2 * u, 18 * u, '#c0c0c8');
    post(u);
    post(g.w - 3 * u);
    ['#d02020', '#f0f0f0', '#2040d0'].forEach((c, i) => g.r(0, g.floor - (14 - i * 4) * u, g.w, u, c));
    bands(g, g.floor, g.h, ['#d8d8dc', '#c8c8d0']);
    g.r(0, g.h - 3 * u, g.w, 3 * u, '#2040d0');
  },
  /** Bank vault full of gold. */
  vault(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#3a4048', '#46505a']);
    for (let x = 0; x < g.w; x += 6 * u) for (let y = 3 * u; y < g.floor; y += 6 * u) g.r(x + 2 * u, y, u, u, '#5a6670');
    const vx = g.w * 0.78, vy = g.floor * 0.45, rr = Math.min(10 * u, g.floor * 0.4);
    const { ctx } = g;
    ctx.fillStyle = '#8a9098';
    ctx.beginPath();
    ctx.arc(Math.round(vx), Math.round(vy), rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a6068';
    ctx.beginPath();
    ctx.arc(Math.round(vx), Math.round(vy), rr * 0.6, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 2) + g.t * 0.01;
      g.r(vx + Math.cos(a) * rr * 0.5 - u / 2, vy + Math.sin(a) * rr * 0.5 - u / 2, u + 1, u + 1, '#d0d4d8');
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j <= i; j++) g.r(2 * u + j * 5 * u + (2 - i) * 2.5 * u, g.floor - (3 - i) * 3 * u, 4 * u, 2 * u, (i + j + (g.t >> 4)) % 5 ? '#e8b830' : '#fff0a0');
    checker(g, '#5a5048', '#6a6058', 5);
  },
  /** Red and white diner kitchen. */
  diner(g) {
    const { u } = g;
    for (let y = 0, row = 0; y < g.floor; y += 4 * u, row++) for (let x = 0, col = 0; x < g.w; x += 4 * u, col++) g.r(x, y, 4 * u, 4 * u, (row + col) % 2 ? '#e8e0d0' : '#c02020');
    g.r(0, g.floor - 8 * u, g.w, 8 * u, '#8a1010');
    g.r(0, g.floor - 8 * u, g.w, 2 * u, '#d8d8e0');
    const bx = g.w * 0.8;
    g.r(bx - 3 * u, g.floor - 15 * u, 7 * u, 7 * u, '#f0f0f0');
    g.r(bx - 3 * u, g.floor - 13 * u, 7 * u, 2 * u, '#c02020');
    g.r(bx - 2 * u, g.floor - 17 * u, 2 * u, 2 * u, '#c88a3a');
    g.r(bx + u, g.floor - 17 * u, 2 * u, 2 * u, '#b07a30');
    checker(g, '#1a1a1a', '#e8e8e8');
  },
  /** Deep space with a ringed planet. */
  cosmos(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.h, '#05040e');
    stars(g, 30, '#e0e0ff', g.floor);
    const { ctx } = g;
    const px = g.w * 0.75, py = g.floor * 0.35, pr = 5 * u;
    ctx.fillStyle = '#c08a4a';
    ctx.beginPath();
    ctx.arc(Math.round(px), Math.round(py), pr, 0, Math.PI * 2);
    ctx.fill();
    g.r(px - pr * 1.8, py, pr * 3.6, u, '#e8d0a0');
    const bx = g.w * 0.2, by = g.floor * 0.4;
    for (let i = 0; i < 10; i++) {
      const a = i * 0.9 + g.t * 0.05, d = (10 - i) * 0.7 * u;
      g.r(bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.5, u, u, i % 2 ? '#a060ff' : '#60a0ff');
    }
    g.r(bx - u, by - u, 2 * u, 2 * u, '#000');
    bands(g, g.floor, g.h, ['#20203a', '#2a2a48']);
    for (let x = 0; x < g.w; x += 6 * u) g.r(x, g.floor + ((x / u) % 3) * u, u, u, '#3a3a5a');
  },
  /** Painter's studio with a landscape on the easel. */
  easel(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#a8c8e0', '#b8d4e8']);
    const ex = g.w * 0.74, ew = 12 * u, eh = 9 * u, ey = g.floor - 18 * u;
    g.r(ex + 2 * u, ey + eh, u, 18 * u - eh, '#6a4a2a');
    g.r(ex + ew - 3 * u, ey + eh, u, 18 * u - eh, '#6a4a2a');
    g.r(ex - u, ey - u, ew + 2 * u, eh + 2 * u, '#f0f0f0');
    g.r(ex, ey, ew, eh, '#80b8f0');
    g.r(ex, ey + 4 * u, ew, 2 * u, '#6a6a90');
    g.r(ex + 3 * u, ey + 2 * u, 3 * u, 3 * u, '#6a6a90');
    g.r(ex + 4 * u, ey + 2 * u, u, u, '#f0f0f0');
    g.r(ex, ey + 6 * u, ew, 3 * u, '#3a7a3a');
    g.r(ex + ew - 4 * u, ey + 2 * u, 2 * u, 5 * u, '#1a5a2a');
    g.r(ex + ew - 3.5 * u, ey + 7 * u, u, 2 * u, '#5a3a1a');
    const pal = ['#d02020', '#e8c020', '#2060d0', '#f0f0f0'];
    pal.forEach((c, i) => g.r(g.w * 0.08 + i * 2 * u, g.floor - 2 * u, u * 1.5, u, c));
    planks(g, '#8a8070', '#968c7a', '#6a6050');
  },
  /** Light-up dance floor. */
  disco(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#0a0614', '#140a24', '#1e1034']);
    spot(g, g.w * 0.2, '#ff40a0', 0.14);
    spot(g, g.w * 0.8, '#40c0ff', 0.14);
    const s = 5 * u, cols = ['#ff3080', '#30c0ff', '#ffe030', '#60ff60', '#c040ff'];
    for (let y = g.floor, row = 0; y < g.h; y += s, row++)
      for (let x = 0, col = 0; x < g.w; x += s, col++) {
        const lit = (row * 3 + col * 7 + (g.t >> 4)) % 5;
        g.r(x, y, s, s, '#1a1024');
        g.r(x + u, y + u, s - u, s - u, lit < 2 ? cols[(row + col) % 5] : '#2a1a3a');
      }
  },
  /** Fashion runway with flashing cameras. */
  runway(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#120c18', '#1a1222', '#24182e']);
    spot(g, g.w / 2, '#ffffff', 0.2);
    for (let i = 0; i < 6; i++) {
      const x = ((i + 0.5) / 6) * g.w, y = g.floor - 4 * u - (i % 2) * 3 * u;
      g.r(x - u, y, 2 * u, 2 * u, '#2a2a30');
      if ((g.t + i * 23) % 70 < 4) g.r(x - 2 * u, y - u, 4 * u, 4 * u, '#ffffff');
    }
    g.r(0, g.floor, g.w, g.h - g.floor, '#2a2a34');
    g.r(g.w * 0.2, g.floor, g.w * 0.6, g.h - g.floor, '#e8e8f0');
    for (let y = g.floor + 2 * u; y < g.h; y += 4 * u) {
      g.r(g.w * 0.2 - u, y, u, u, '#ffe080');
      g.r(g.w * 0.8, y, u, u, '#ffe080');
    }
  },
  /** Talk show stage: skyline backdrop and a plush couch. */
  talkshow(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#2a1040', '#3a1856', '#4a206a']);
    for (let i = 0; i < 9; i++) {
      const bw = 5 * u, bh = (6 + ((i * 5) % 9)) * u, x = (i * g.w) / 9;
      g.r(x, g.floor - 8 * u - bh, bw, bh, '#1a0a2a');
      for (let y = g.floor - 8 * u - bh + u; y < g.floor - 9 * u; y += 2 * u) if ((i + y) % 3) g.r(x + u, y, u, u, '#ffd870');
    }
    spot(g, g.w * 0.5, '#ffe0a0', 0.16);
    const cx = g.w * 0.78;
    g.r(cx - 6 * u, g.floor - 5 * u, 12 * u, 5 * u, '#c04070');
    g.r(cx - 7 * u, g.floor - 7 * u, 2 * u, 7 * u, '#a03058');
    g.r(cx + 5 * u, g.floor - 7 * u, 2 * u, 7 * u, '#a03058');
    bands(g, g.floor, g.h, ['#5a2a6a', '#6a3478']);
  },
  /** Steel restaurant kitchen with a flaming range. */
  kitchen(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.floor, '#9aa4ae');
    for (let y = 0, row = 0; y < g.floor; y += 3 * u, row++) for (let x = (row % 2) * 3 * u - 3 * u; x < g.w; x += 6 * u) g.r(x, y, 5 * u, 2 * u, '#c8d0d8');
    for (let i = 0; i < 3; i++) {
      const x = g.w * 0.12 + i * 6 * u;
      g.r(x + 2 * u, 2 * u, u, 4 * u, '#3a3a40');
      g.r(x, 6 * u, 5 * u, 3 * u, '#2a2a30');
    }
    const rx = g.w * 0.66;
    g.r(rx, g.floor - 7 * u, g.w - rx, 7 * u, '#5a6068');
    g.r(rx, g.floor - 7 * u, g.w - rx, u, '#d0d8e0');
    flame(g, rx + 4 * u, g.floor - 7 * u, 1.5 * u, 1);
    flame(g, rx + 11 * u, g.floor - 7 * u, 1.5 * u, 2);
    checker(g, '#3a3a40', '#5a5a62', 3);
  },
  /** Night street: brick wall and a lamp post. */
  street(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.floor, '#6a2a20');
    for (let y = 0, row = 0; y < g.floor; y += 3 * u, row++) {
      g.r(0, y, g.w, u, '#4a1a14');
      for (let x = (row % 2) * 3 * u; x < g.w; x += 6 * u) g.r(x, y, u, 3 * u, '#4a1a14');
    }
    g.ctx.save();
    g.ctx.globalAlpha = 0.45;
    g.r(0, 0, g.w, g.floor, '#0a0a1a');
    g.ctx.restore();
    const lx = g.w * 0.84;
    g.r(lx, 4 * u, u * 1.5, g.floor - 4 * u, '#2a2a30');
    g.r(lx - 2 * u, 3 * u, 5 * u, 2 * u, '#2a2a30');
    g.r(lx - u, 5 * u, 3 * u, 2 * u, '#ffe890');
    spot(g, lx, '#ffe890', 0.12);
    const card = ['#f0f0f0', '#f0f0f0', '#f0f0f0'];
    card.forEach((c, i) => {
      const x = g.w * 0.12 + i * 4 * u, y = g.floor * 0.3 + Math.sin(g.t * 0.06 + i) * 2 * u;
      g.r(x, y, 2 * u, 3 * u, c);
      g.r(x + u * 0.5, y + u, u, u, i % 2 ? '#d02020' : '#101010');
    });
    bands(g, g.floor, g.h, ['#3a3a42', '#2e2e36']);
    g.r(0, g.floor, g.w, u, '#6a6a72');
  },
  /** Kid's bedroom with toy blocks. */
  toyroom(g) {
    const { u } = g;
    for (let x = 0, i = 0; x < g.w; x += 4 * u, i++) g.r(x, 0, 4 * u, g.floor, i % 2 ? '#a8d8f0' : '#c8e8f8');
    const bc = ['#e83030', '#30a0e8', '#f0c020', '#40c040'];
    for (let i = 0; i < 3; i++) g.r(2 * u + i * 5 * u, g.floor - 4 * u, 4 * u, 4 * u, bc[i]);
    g.r(4.5 * u, g.floor - 8 * u, 4 * u, 4 * u, bc[3]);
    const bx = g.w * 0.82, by = g.floor * 0.3 + Math.sin(g.t * 0.05) * u;
    g.r(bx, by, 4 * u, 5 * u, '#ff60a0');
    g.r(bx + 2 * u, by + 5 * u, u * 0.5, 6 * u, '#ffffff');
    bands(g, g.floor, g.h, ['#e0b070', '#d0a060']);
    for (let x = 0; x < g.w; x += 8 * u) g.r(x, g.floor + 2 * u, 4 * u, u, '#c89050');
  },
  /** Torch-lit tomb with hieroglyphs. */
  tomb(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#8a6a3a', '#a07c44', '#b08a4a']);
    for (let y = 3 * u; y < g.floor - 4 * u; y += 5 * u)
      for (let x = 2 * u, i = 0; x < g.w; x += 4 * u, i++) {
        const k = (i * 7 + y) % 4;
        if (k === 0) g.r(x, y, 2 * u, u, '#5a3a1a');
        else if (k === 1) g.r(x, y, u, 3 * u, '#5a3a1a');
        else if (k === 2) (g.r(x, y, 2 * u, 2 * u, '#3a6aa0'), g.r(x + u * 0.5, y + u * 0.5, u, u, '#b08a4a'));
      }
    for (const tx of [g.w * 0.1, g.w * 0.9]) {
      g.r(tx - u, 10 * u, 2 * u, 4 * u, '#4a3018');
      flame(g, tx, 10 * u, 1.5 * u, tx);
    }
    bands(g, g.floor, g.h, ['#c0a060', '#b09050']);
    for (let x = 0; x < g.w; x += 9 * u) g.r(x, g.floor, u, g.h, '#8a6a3a');
  },
  /** Hot-rod flames on black. */
  flames(g) {
    const { u } = g;
    g.r(0, 0, g.w, g.floor, '#141014');
    const cols = ['#c01010', '#f05010', '#f0a020', '#fff060'];
    for (let x = 0; x < g.w; x += u) {
      const hgt = (Math.sin(x * 0.25 / u + g.t * 0.08) * 0.5 + 0.5) * 6 * u + 6 * u;
      for (let k = 0; k < 4; k++) g.r(x, g.floor - hgt * (1 - k * 0.22), u, hgt * (1 - k * 0.22) - 0, cols[k]);
    }
    g.r(0, g.floor - u, g.w, u, '#d0d0d8');
    bands(g, g.floor, g.h, ['#9aa0a8', '#7a8088']);
    for (let x = 0; x < g.w; x += 8 * u) g.r(x, g.floor + 2 * u, 3 * u, u, '#d0d8e0');
  },
  /** Basketball court with a hoop. */
  court(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#1a1430', '#241a40']);
    for (let i = 0; i < 40; i++) g.r((i * 31) % g.w, ((i * 17) % (g.floor * 0.6)) + u, u, u, ['#c04040', '#4060c0', '#e0c060', '#d0d0d0'][i % 4]);
    const hx = g.w * 0.8;
    g.r(hx - 5 * u, 4 * u, 10 * u, 7 * u, '#f0f0f0');
    g.r(hx - 2 * u, 7 * u, 4 * u, 3 * u, '#d03020');
    g.r(hx - 3 * u, 11 * u, 6 * u, u, '#e06020');
    for (let k = 0; k < 3; k++) g.r(hx - 2.5 * u + k * 2 * u, 12 * u, u, 3 * u, '#e8e8e8');
    planks(g, '#d8a060', '#c89050', '#b07a40');
    g.r(0, g.floor + 3 * u, g.w, u, '#f0f0f0');
  },
  /** Outback: red earth, big sky, gum tree. */
  outback(g) {
    const { u } = g;
    bands(g, 0, g.floor, ['#3a90d8', '#58a8e0', '#88c4e8']);
    g.r(g.w * 0.15, 4 * u, 6 * u, 6 * u, '#fff4a0');
    g.r(0, g.floor - 3 * u, g.w, 3 * u, '#a85a2a');
    const tx = g.w * 0.82;
    g.r(tx, g.floor - 16 * u, 2 * u, 16 * u, '#e8e0d0');
    g.r(tx - 4 * u, g.floor - 20 * u, 10 * u, 5 * u, '#5a8a4a');
    g.r(tx - 2 * u, g.floor - 22 * u, 7 * u, 3 * u, '#6a9a5a');
    bands(g, g.floor, g.h, ['#c06a30', '#b05e28']);
    for (let x = 0; x < g.w; x += 7 * u) g.r(x + 2 * u, g.floor + ((x / u) % 4) * u + u, u, u, '#8a4a1e');
  },
};

/** Fallback for a fighter with no set yet: a spotlit backdrop in their outfit colours. */
export const spotlightSet: SetPainter = (g, c) => {
  const main = c.look.coat ?? c.look.shirt;
  g.r(0, 0, g.w, g.floor, '#14101c');
  g.ctx.save();
  g.ctx.globalAlpha = 0.35;
  bands(g, 0, g.floor, ['#14101c', main, main]);
  g.ctx.restore();
  spot(g, g.w / 2, '#fff8e0', 0.18);
  bands(g, g.floor, g.h, ['#2a2430', '#221c28']);
  g.r(0, g.floor, g.w, g.u, c.look.pants);
};

export const setFor = (c: CharDef): SetPainter => c.selectSet ?? spotlightSet;

/** Paint a fighter's set into a box on ctx (clipped to the box). Returns the y of the fighter's feet. */
export function paintSet(ctx: CanvasRenderingContext2D, c: CharDef, x: number, y: number, w: number, h: number, t: number) {
  const u = Math.max(1, Math.round(h / 44));
  const floor = Math.round(h * FLOOR_AT);
  const g: SetGfx = {
    w, h, floor, u, t, ctx,
    r: (rx, ry, rw, rh, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(rx), Math.round(ry), Math.max(1, Math.round(rw)), Math.max(1, Math.round(rh)));
    },
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(Math.round(x), Math.round(y));
  setFor(c)(g, c);
  ctx.restore();
  return y + floor + Math.round((h - floor) * 0.45);
}
