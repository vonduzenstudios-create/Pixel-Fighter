import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng, Rng } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import type { SongName } from '../../audio/music';
import { P, LIE } from '../../game/anims';
import type { Fight } from '../../game/fight';
import type { Particles } from '../../game/particles';
import type { PitLanding } from '../../game/stages';

// "Hollowmere Cemetery": a hilltop graveyard at midnight under a huge full moon. Crooked
// headstones, a mausoleum glowing sickly green, bats across the moon, will-o'-wisps among the
// graves, hands that claw up out of the dirt now and then, and ground fog rolling over the
// fighters' feet. The uppercut finish drops the loser into an open grave where the coffin's old
// tenants pull them down, the lid slams and the dirt comes in. Painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
const MOON: [number, number, number] = [184, 52, 26];
/** Where the near row of graves meets the dirt path. */
const BACK = 178;
const LAMP_X = 132;
const CRYPT_X = 404;
/** Grave mounds on the deck that something occasionally claws its way out of. */
const MOUNDS = [62, 248, 316, 470];
/** Rest height of the victim in the coffin, and the coffin's box in the close-up. */
const REST = 148;
const BOX = { x0: 70, x1: 186, y0: 132, y1: 166 };

const STONE = ['#6a6e80', '#5a5e70', '#7a7a88', '#4e5262'];

/** Night sky: violet-to-ink gradient, a field of stars and the big moon with its halo. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1601);
  p.gradRect(0, 0, W, 150, '#06061a', '#2a1c48', 10);
  for (let i = 0; i < 90; i++) {
    const x = r.int(0, W), y = r.int(0, 120);
    p.set(x, y, r.next() < 0.2 ? '#ffffff' : r.next() < 0.5 ? '#a8a8d0' : '#6a6a98');
  }
  const [mx, my, mr] = MOON;
  for (let y = 0; y < 130; y++)
    for (let x = mx - 70; x < mx + 70; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d < mr) {
        // limb darkening and a few maria, dithered
        let c: Color = mix('#fff8e0', '#d8d0b0', (d / mr) ** 3);
        const maria = Math.sin(x * 0.21 + y * 0.13) + Math.sin(x * 0.07 - y * 0.19) * 1.3;
        if (maria > 1.1 && bayer(x, y) < 0.6) c = '#c8c0a4';
        if (maria > 1.7) c = '#b4ac94';
        p.set(x, y, c);
      } else if (d < mr + 34 && bayer(x, y) < (1 - (d - mr) / 34) * 0.4) p.set(x, y, lighten(p.get(x, y), 0.14));
    }
  for (const [cx, cy, cr] of [[mx - 9, my + 6, 4], [mx + 8, my - 10, 3], [mx + 12, my + 9, 2.5], [mx - 4, my - 14, 2]]) {
    p.ellipse(cx, cy, cr, cr, '#bab298');
    p.ellipse(cx - 0.6, cy - 0.6, cr - 1, cr - 1, '#cec6aa');
  }
  return p.canvas();
}

/** A gnarled leafless tree: a twisting trunk that splits into clawing branches. */
function deadTree(p: Painter, x: number, base: number, h: number, c: Color, seed: number) {
  const r = rng(seed);
  const branch = (x0: number, y0: number, ang: number, len: number, w: number, depth: number) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    p.capsule(x0, y0, w, x1, y1, Math.max(0.5, w * 0.65), c);
    if (depth <= 0 || w < 0.6) return;
    const n = depth > 2 ? 2 : r.int(2, 3);
    for (let i = 0; i < n; i++) branch(x1, y1, ang + r.range(-0.9, 0.9), len * r.range(0.55, 0.8), w * 0.62, depth - 1);
  };
  // roots
  for (const a of [0.25, Math.PI - 0.25, 0.7, Math.PI - 0.7]) p.capsule(x, base - 2, h * 0.03, x + Math.cos(a) * h * 0.18, base + Math.sin(a) * 3, 0.5, c);
  branch(x, base, -Math.PI / 2 + r.range(-0.15, 0.15), h * 0.42, h * 0.05, 4);
}

/** A headstone of a given shape, lit from the moon on the upper right. */
function tomb(p: Painter, x: number, base: number, kind: number, w: number, h: number, c: Color, r: Rng, lean = 0) {
  const sx = (y: number) => Math.round(((base - y) / h) * lean); // tilt toward the top
  const lit = lighten(c, 0.22), dk = darken(c, 0.4);
  const px = (xx: number, y: number, col: Color) => p.set(xx + sx(y), y, col);
  if (kind === 0) {
    // classic round-top slab
    for (let y = base - h; y < base; y++)
      for (let xx = x - w; xx <= x + w; xx++) {
        const top = base - h + w;
        if (y < top && Math.hypot(xx - x, y - top) > w) continue;
        px(xx, y, xx === x + w || (y < top && Math.hypot(xx - x, y - top) > w - 1 && xx > x) ? lit : xx === x - w ? dk : bayer(xx, y) < 0.08 ? darken(c, 0.12) : c);
      }
    // a few chiselled lines of an illegible epitaph
    for (let k = 0; k < 3; k++) for (let xx = x - w + 3; xx < x + w - 2; xx++) if ((xx + k) % 3) px(xx, base - h + w + 4 + k * 3, dk);
  } else if (kind === 1) {
    // cross
    for (let y = base - h; y < base; y++) for (let xx = x - 1; xx <= x + 1; xx++) px(xx, y, xx === x + 1 ? lit : xx === x - 1 ? dk : c);
    const arm = base - h + Math.round(h * 0.28);
    for (let xx = x - Math.round(w * 0.9); xx <= x + Math.round(w * 0.9); xx++) {
      px(xx, arm, lit);
      px(xx, arm + 1, c);
      px(xx, arm + 2, dk);
    }
  } else if (kind === 2) {
    // obelisk on a plinth
    for (let y = base - h; y < base - 4; y++) {
      const hw = Math.round(1 + ((y - (base - h)) / h) * (w - 1));
      for (let xx = x - hw; xx <= x + hw; xx++) px(xx, y, xx >= x + hw - 1 ? lit : xx === x - hw ? dk : c);
    }
    for (let y = base - 4; y < base; y++) for (let xx = x - w - 2; xx <= x + w + 2; xx++) px(xx, y, y === base - 4 ? lit : c);
  } else {
    // square slab with a peaked cap, chipped
    for (let y = base - h; y < base; y++)
      for (let xx = x - w; xx <= x + w; xx++) {
        const peak = base - h + Math.abs(xx - x) * 0.5;
        if (y < peak) continue;
        px(xx, y, y < peak + 1 ? lit : xx === x - w ? dk : xx === x + w ? lit : c);
      }
    const cx = x + r.int(-w + 1, w - 2);
    p.set(cx + sx(base - h + 4), base - h + 4, dk);
  }
  // moss and a dark crack
  for (let i = 0; i < 6; i++) {
    const mx = x + r.int(-w, w), my = base - r.int(1, Math.max(2, Math.round(h / 3)));
    if (p.alpha(mx + sx(my), my)) p.set(mx + sx(my), my, r.next() < 0.5 ? '#3a5a3a' : '#2a4430');
  }
}

/** Far hill: rolling silhouette, a crooked iron fence, a little ruined chapel and dead trees. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1607);
  const sil = '#18142c';
  for (let x = 0; x < FAR_W; x++) {
    const top = 118 - Math.sin(x * 0.018 + 1) * 10 - Math.sin(x * 0.051) * 4;
    for (let y = Math.floor(top); y < H; y++) p.set(x, y, y < top + 2 ? '#2a2444' : sil);
  }
  // ruined chapel: a broken nave and a bell tower with a missing corner
  const cx = 70;
  p.rect(cx - 22, 92, 30, 24, sil);
  p.poly([[cx - 24, 92], [cx - 7, 80], [cx + 10, 92]], sil);
  p.rect(cx + 8, 70, 12, 46, sil);
  p.poly([[cx + 6, 70], [cx + 14, 56], [cx + 22, 70]], sil);
  p.rect(cx + 12, 78, 4, 6, '#3a2c50'); // empty belfry
  for (const wx of [cx - 18, cx - 10, cx - 2]) p.rect(wx, 98, 3, 6, '#2a2240');
  p.set(cx + 14, 54, sil);
  p.line(cx + 14, 52, cx + 14, 50, sil);
  // iron fence along the hill crest
  for (let x = 0; x < FAR_W; x++) {
    const top = Math.floor(118 - Math.sin(x * 0.018 + 1) * 10 - Math.sin(x * 0.051) * 4);
    if (x % 4 === 0) {
      for (let y = top - 7; y < top; y++) p.set(x, y, sil);
      p.set(x, top - 8, '#2a2444');
    }
    p.set(x, top - 5, sil);
  }
  deadTree(p, 170, 112, 70, sil, 1613);
  deadTree(p, 300, 116, 54, sil, 1619);
  // distant graves dotting the hillside
  for (let i = 0; i < 40; i++) {
    const x = r.int(0, FAR_W), y = r.int(124, 150);
    p.rect(x, y - 4, 3, 4, '#2a2644');
    p.set(x + 1, y - 5, '#2a2644');
    p.set(x + 2, y - 4, '#3a3658');
  }
  return p.canvas();
}

/** Middle ground: grassy rise with rows of headstones, a stone angel and the big dead oak. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1627);
  for (let y = 140; y < H; y++)
    for (let x = 0; x < MID_W; x++) {
      const top = 142 + Math.sin(x * 0.03) * 3;
      if (y < top) continue;
      const c = mix('#1e2a2c', '#141a1e', (y - 140) / 40);
      p.set(x, y, bayer(x, y) < 0.15 ? lighten(c, 0.08) : c);
    }
  deadTree(p, 236, 152, 120, '#120e18', 1637);
  // two rows of graves, back row smaller and bluer
  for (const [base, sc, tint] of [[152, 0.7, 0.45], [168, 1, 0.25]] as const)
    for (let x = r.int(4, 14); x < MID_W - 6; x += r.int(16, 30)) {
      if (Math.abs(x - 236) < 10) continue;
      const kind = r.int(0, 4), w = Math.round(r.int(4, 7) * sc), h = Math.round(r.int(14, 24) * sc);
      tomb(p, x, base + r.int(-1, 2), kind, w, h, darken(r.pick(STONE), tint), r, r.int(-2, 2));
    }
  // a weeping stone angel on a tall plinth
  const ax = 120;
  p.rect(ax - 7, 148, 15, 20, '#4e5262');
  p.rect(ax - 9, 146, 19, 3, '#6a6e80');
  p.rect(ax - 9, 166, 19, 3, '#3e4252');
  p.poly([[ax - 6, 146], [ax + 6, 146], [ax + 3, 124], [ax - 3, 124]], '#5a5e70'); // robe
  p.ellipse(ax, 120, 3, 3.5, '#6a6e80'); // bowed head
  p.poly([[ax - 3, 126], [ax - 16, 112], [ax - 12, 134]], '#4e5262'); // wings
  p.poly([[ax + 3, 126], [ax + 16, 112], [ax + 12, 134]], '#7a7a88');
  p.line(ax - 2, 128, ax + 1, 122, '#7a7a88'); // hands to face
  return p.canvas();
}

/** The near graves, the lamp post, the mausoleum and the dirt path the fighters stand on. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1657);
  // grass behind the path
  for (let y = 160; y < BACK; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const top = 164 + Math.round(Math.sin(x * 0.05) * 2);
      if (y < top) continue;
      p.set(x, y, bayer(x, y) < 0.2 ? '#24342a' : '#1a2820');
    }
  // the mausoleum: columns, pediment, an iron gate with green light behind it
  const mx = CRYPT_X;
  p.rect(mx - 34, 120, 68, 58, '#4a4e5e');
  for (let y = 120; y < 178; y++) for (let x = mx - 34; x < mx + 34; x++) if ((y - 120) % 8 === 7 || (x - mx + ((y - 120) >> 3) * 6 + 100) % 12 === 0) p.set(x, y, '#3a3e4c');
  p.poly([[mx - 40, 120], [mx + 40, 120], [mx, 98]], '#5a5e70');
  p.poly([[mx - 32, 118], [mx + 32, 118], [mx, 104]], '#3e4252');
  p.rect(mx - 40, 118, 80, 4, '#6a6e80');
  p.rect(mx - 40, 118, 80, 1, '#8a8e9e');
  p.rect(mx - 40, 174, 80, 4, '#5a5e70');
  for (const cx of [mx - 30, mx - 20, mx + 16, mx + 26]) {
    p.rect(cx, 122, 5, 52, '#6a6e80');
    p.rect(cx + 4, 122, 1, 52, '#8a8e9e');
    p.rect(cx, 122, 1, 52, '#4a4e5e');
  }
  // the doorway: dark, then a green glow and a bar gate drawn over it
  for (let y = 132; y < 174; y++)
    for (let x = mx - 12; x < mx + 12; x++) {
      if (y < 140 && Math.hypot(x + 0.5 - mx, y - 140) > 12) continue;
      const g = 1 - Math.min(1, Math.hypot(x - mx, y - 160) / 22);
      p.set(x, y, mix('#06100a', '#2a8a4a', g * 0.8));
    }
  for (let x = mx - 11; x < mx + 12; x += 4) p.rect(x, 132, 1, 42, '#141418');
  p.rect(mx - 12, 146, 24, 1, '#141418');
  p.set(mx + 4, 156, '#c8a040'); // padlock
  p.rect(mx + 3, 157, 3, 2, '#a08030');
  // name lintel, unreadable with age
  p.rect(mx - 14, 124, 28, 5, '#3e4252');
  for (let x = mx - 12; x < mx + 12; x += 2) p.set(x, 126, '#6a6e80');
  // urns on the corners
  for (const ux of [mx - 38, mx + 34]) {
    p.ellipse(ux + 2, 114, 3, 3, '#5a5e70');
    p.rect(ux + 1, 116, 3, 2, '#4a4e5e');
  }
  // the near row of headstones (avoiding the lamp and the crypt)
  for (let x = r.int(6, 14); x < STAGE_W - 8; x += r.int(22, 40)) {
    if (Math.abs(x - CRYPT_X) < 46 || Math.abs(x - LAMP_X) < 10) continue;
    tomb(p, x, BACK - r.int(0, 3), r.int(0, 4), r.int(5, 9), r.int(20, 34), r.pick(STONE), r, r.int(-3, 3));
  }
  // grave mounds where the hands come up, with a shovel left in the last one
  for (const gx of MOUNDS) {
    for (let y = BACK - 6; y < BACK + 2; y++)
      for (let x = gx - 16; x <= gx + 16; x++) {
        const dx = (x - gx) / 16, dy = (y - BACK + 2) / 5;
        if (dx * dx + dy * dy > 1) continue;
        p.set(x, y, dy < -0.4 ? '#5a4030' : bayer(x, y) < 0.3 ? '#3a2818' : '#4a3424');
      }
  }
  p.line(MOUNDS[3] + 10, BACK - 4, MOUNDS[3] + 18, BACK - 30, '#6a4a2a');
  p.rect(MOUNDS[3] + 7, BACK - 6, 6, 6, '#7a7e88');
  p.rect(MOUNDS[3] + 7, BACK - 6, 1, 6, '#a0a4ae');
  // the iron lamp post (the flame is drawn live)
  p.rect(LAMP_X - 1, 104, 3, 74, '#141418');
  p.rect(LAMP_X - 3, 172, 7, 6, '#1c1c22');
  p.rect(LAMP_X - 5, 92, 11, 2, '#141418');
  p.rect(LAMP_X - 4, 94, 9, 10, '#1c1c22');
  p.rect(LAMP_X - 3, 95, 7, 8, '#3a2a10');
  p.poly([[LAMP_X - 6, 92], [LAMP_X + 6, 92], [LAMP_X, 85]], '#141418');
  // the dirt path: packed earth with ruts, stones, bone chips and fallen leaves
  for (let y = BACK; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const t = (y - BACK) / (H - BACK);
      let c: Color = mix('#3a2c24', '#2a1e18', t);
      if (Math.abs(y - (FLOOR + 6)) < 1 && (x >> 3) % 3) c = darken(c, 0.25);
      if (bayer(x, y) < 0.12) c = lighten(c, 0.08);
      if (y < BACK + 3 && bayer(x, y) < 0.5) c = '#1e2a20'; // grass edge
      p.set(x, y, c);
    }
  for (let i = 0; i < 140; i++) {
    const x = r.int(0, STAGE_W), y = r.int(BACK + 2, H);
    const k = r.next();
    if (k < 0.4) p.set(x, y, '#6a5a4a');
    else if (k < 0.55) p.rect(x, y, 2, 1, '#c8c0a8'); // bone chip
    else if (k < 0.8) p.set(x, y, r.pick(['#7a3a1a', '#8a5a1a', '#5a2a14']));
    else {
      p.set(x, y, '#2a3a28');
      p.set(x, y - 1, '#2a3a28');
    }
  }
  // tufts of grass along the back edge
  for (let x = 0; x < STAGE_W; x += r.int(2, 5)) p.line(x, BACK + 1, x + r.int(-1, 1), BACK - r.int(1, 4), '#2a3a2c');
  return p.canvas();
}

/** The open grave from inside: strata, roots, an old skeleton in the wall and an open coffin. */
function gravePit(bones: PartSet): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1693);
  // the night sky and a slice of moon through the hole at the top
  p.gradRect(60, 0, 136, 22, '#0a0a22', '#22183c', 4);
  p.ellipse(170, 6, 9, 9, '#fff4d8');
  for (let i = 0; i < 12; i++) p.set(r.int(64, 192), r.int(0, 18), '#a8a8d0');
  // earth walls with layered soil, narrowing toward the bottom in perspective
  for (let y = 0; y < H; y++) {
    const hole0 = 60 + y * 0.12, hole1 = 196 - y * 0.12;
    for (let x = 0; x < W; x++) {
      const inHole = y < 22 && x > hole0 && x < hole1;
      if (inHole) continue;
      const band = Math.floor((y + 3 + Math.sin(x * 0.08) * 3) / 14) % 4;
      let c: Color = ['#3a2a1e', '#4a3424', '#32241a', '#42301e'][band];
      const back = x > hole0 && x < hole1; // the far wall, darker
      if (back) c = darken(c, 0.35 + (y / H) * 0.2);
      else c = darken(c, Math.abs(x - 128) < 80 ? 0.1 : 0);
      if (bayer(x, y) < 0.1) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
  }
  // spade-cut edges where the side walls meet the back wall
  for (let y = 22; y < H; y++) {
    p.set(Math.round(60 + y * 0.12), y, '#5a4430');
    p.set(Math.round(196 - y * 0.12), y, '#1a120c');
  }
  // grass lip over the edge
  for (let x = 0; x < W; x++) {
    const inHole = x > 60 && x < 196;
    if (!inHole) for (let y = 0; y < 4 + (x % 3); y++) p.set(x, y, y < 2 ? '#2a3a2c' : '#1e2a20');
    else for (let y = 20; y < 23 + ((x * 7) % 3); y++) p.set(x, y, '#2a3a2c');
  }
  // roots dangling out of the walls
  for (let i = 0; i < 14; i++) {
    let x = r.next() < 0.5 ? r.int(6, 50) : r.int(206, 250), y = r.int(24, 120);
    const dir = x < 128 ? 1 : -1;
    for (let k = 0; k < r.int(10, 26); k++) {
      p.set(x, y, '#6a4a30');
      x += r.next() < 0.6 ? dir : 0;
      y++;
    }
  }
  // stones, a worm or two, a skull
  for (let i = 0; i < 26; i++) {
    const x = r.int(0, W), y = r.int(24, H), s = r.int(1, 3);
    if (x > 66 && x < 190) continue;
    p.ellipse(x, y, s + 1, s, '#5a5458');
    p.set(x - 1, y - 1, '#7a7478');
  }
  for (const [wx, wy] of [[30, 140], [222, 96]]) for (let k = 0; k < 6; k++) p.set(wx + k, wy + Math.round(Math.sin(k) * 1), '#c87a7a');
  p.ellipse(214, 182, 6, 5, '#c8c0a8');
  p.rect(211, 185, 6, 3, '#c8c0a8');
  p.set(212, 181, '#1a1410');
  p.set(216, 181, '#1a1410');
  p.set(214, 184, '#1a1410');
  // the coffin floor: a wooden box with red satin, wider at the shoulders like a proper casket
  const { x0, x1, y0, y1 } = BOX;
  const hexX = (y: number, inset: number) => {
    const t = (y - y0) / (y1 - y0);
    const w = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) * 0.4;
    return [x0 + inset + (1 - w) * 6, x1 - inset - (1 - w) * 14];
  };
  for (let y = y0; y < y1 + 8; y++) {
    const yy = Math.min(y, y1);
    const [a, b] = hexX(yy, 0);
    for (let x = Math.floor(a); x < b; x++) p.set(x, y, y >= y1 ? '#2a160c' : '#5a3218');
  }
  for (let y = y0 + 4; y < y1 - 3; y++) {
    const [a, b] = hexX(y, 5);
    for (let x = Math.floor(a); x < b; x++) {
      const fold = Math.sin(x * 0.5 + y * 0.3) > 0.6;
      p.set(x, y, fold ? '#a01820' : bayer(x, y) < 0.15 ? '#6a0c14' : '#801018');
    }
  }
  p.ellipse(x1 - 26, (y0 + y1) / 2, 8, 6, '#c02830'); // pillow at the head end
  p.ellipse(x1 - 27, (y0 + y1) / 2 - 1, 5, 3, '#d84048');
  for (const hx of [x0 + 30, x0 + 60, x0 + 90]) p.rect(hx, y1 + 2, 8, 2, '#c8a040'); // brass handles
  // an earlier resident lying in the side wall, half dug out
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(30, 196);
  ctx.globalAlpha = 0.85;
  drawRig(ctx, bones, fk(P(LIE, { rot: -84, af: -150, ef: -40, ab: -20, lf: 10, kf: 40 })));
  ctx.restore();
  return cv;
}

/** The lid, painted once and dropped over the coffin in the finish. */
function coffinLid(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const { x0, x1, y0, y1 } = BOX;
  for (let y = y0 - 2; y < y1 + 2; y++) {
    const t = (y - y0 + 2) / (y1 - y0 + 4);
    const w = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) * 0.4;
    const a = x0 - 2 + (1 - w) * 6, b = x1 + 2 - (1 - w) * 14;
    for (let x = Math.floor(a); x < b; x++) {
      const edge = x < a + 2 || x > b - 2 || y < y0 || y > y1 - 1;
      const grain = Math.sin(x * 0.15 + Math.sin(y * 0.5) * 2) > 0.8;
      p.set(x, y, edge ? '#3a1e0e' : grain ? '#6a3a1c' : y < (y0 + y1) / 2 ? '#8a5228' : '#74441e');
    }
  }
  // a raised centre panel and a ring of brass nails
  for (let y = y0 + 6; y < y1 - 6; y++) for (let x = x0 + 20; x < x1 - 24; x++) if (y === y0 + 6 || x === x0 + 20) p.set(x, y, '#a06a38');
  for (let x = x0 + 4; x < x1 - 6; x += 8) {
    p.set(x, y0 + 1, '#e0c060');
    p.set(x, y1 - 2, '#c8a040');
  }
  return p.canvas();
}

interface Bat { x: number; y: number; sp: number; ph: number; s: number }
interface Hand { x: number; t: number }

export class GraveyardStage {
  name = 'HOLLOWMERE CEMETERY';
  blurb = 'THE NEIGHBOURS ARE VERY QUIET';
  song: SongName = 'graveyard';
  sky = sky();
  far = far();
  mid = mid();
  deck = deck();
  lid = coffinLid();
  pit: HTMLCanvasElement;
  bats: Bat[] = Array.from({ length: 5 }, (_, i) => ({ x: i * 70, y: 30 + i * 9, sp: 0.6 + (i % 3) * 0.25, ph: i * 1.7, s: i % 2 ? 1 : 2 }));
  hands: Hand[] = [];
  /** Next frame a hand claws up from one of the mounds. */
  nextHand = 240;
  lastSound = -1;

  constructor(bones: PartSet) {
    this.pit = gravePit(bones);
  }

  reset() {
    this.hands = [];
    this.nextHand = 240;
  }

  /** The uppercut finish: into the open grave, grabbed by the coffin's tenants, lid shut, buried. */
  pitLanding: PitLanding = {
    rest: REST,
    length: 200,
    pose: P(LIE, { rot: -90, af: -150, ef: -30, ab: -140, eb: -20, lf: 6, kf: 10 }),
    land: (f) => {
      sfx.crunch();
      for (let i = 0; i < 10; i++) f.pitParticles.smoke(128 + rand(-30, 30), H - REST + rand(-4, 4), 1, '#6a5a4a');
    },
    tick: (f, it) => this.graveStep(f, it),
    draw: (ctx, it) => this.graveDraw(ctx, it),
    victim: (l, it) => {
      // flailing as the bony hands drag them down into the satin
      const j = it < 56 ? Math.sin(it * 0.9) * (1 - it / 70) * 30 : 0;
      l.poseOverride = P(LIE, { rot: -90, af: -150 + j, ef: -30 - j * 0.5, ab: -140 - j, eb: -20, lf: 6 + j * 0.6, kf: 10 + Math.abs(j) * 0.5, lb: -j * 0.4, kb: 8 });
      l.computePose();
      return Math.min(6, it * 0.12);
    },
  };

  graveStep(f: Fight, it: number) {
    const ps = f.pitParticles;
    if (it === 8 || it === 20) sfx.crunch();
    if (it === 30) sfx.scream();
    if (it === 60) {
      // the lid slams
      sfx.thud();
      sfx.hit(2);
      f.shake(8);
      for (let i = 0; i < 24; i++) ps.add({ kind: 'smoke', x: rand(70, 186), y: H - BOX.y1 + rand(-2, 4), vx: rand(-0.6, 0.6), vy: rand(0.2, 0.8), life: 40, max: 40, color: '#6a5a4a', size: 2, grav: 0, floor: false });
    }
    // then the dirt comes in from the shovels above
    if (it > 76 && it < 180) {
      if (it % 2 === 0)
        for (let i = 0; i < 3; i++) {
          const life = 60;
          ps.add({ kind: 'spark', x: rand(70, 186), y: H - rand(0, 10), vx: rand(-0.4, 0.4), vy: rand(-1, 0), life, max: life, color: ['#4a3424', '#5a4030', '#3a2818'][i], size: rand(1, 3) > 2 ? 2 : 1, grav: 0.2, floor: false });
        }
      if (it % 22 === 0) {
        noise({ dur: 0.35, vol: 0.12, type: 'lowpass', freq: 900, to: 200 });
        f.shake(2);
      }
    }
  }

  graveDraw(ctx: CanvasRenderingContext2D, it: number) {
    const { x0, x1, y1 } = BOX;
    // skeletal hands come up out of the satin and pull
    if (it < 64) {
      const rise = Math.min(1, it / 14);
      for (const [hx, side] of [[x0 + 30, -1], [x0 + 56, 1], [x0 + 82, -1], [x1 - 34, 1]]) {
        const hy = y1 - 6 - Math.round(rise * 16) + Math.round(Math.sin(it * 0.5 + hx) * 1.5);
        ctx.fillStyle = '#d8d0b8';
        ctx.fillRect(hx, hy, 2, y1 - 4 - hy); // forearm bones
        ctx.fillRect(hx + 3, hy + 2, 1, y1 - 6 - hy);
        ctx.fillRect(hx - 1, hy - 2, 5, 3); // palm
        for (let k = 0; k < 4; k++) ctx.fillRect(hx - 1 + k + (side > 0 ? 1 : 0), hy - 5 + (k % 2), 1, 3); // fingers curled over
        ctx.fillStyle = '#8a8270';
        ctx.fillRect(hx + 1, hy, 1, 1);
      }
    }
    // the lid falls from above and slams
    if (it >= 44) {
      const dropT = Math.min(1, (it - 44) / 16);
      const oy = Math.round(-180 * (1 - dropT * dropT));
      ctx.drawImage(this.lid, 0, oy);
    }
    // dirt piles up from the bottom until the coffin is gone
    if (it > 80) {
      const level = Math.round(H - Math.min(1, (it - 80) / 100) * (H - 110));
      for (let x = 0; x < W; x++) {
        const top = level + Math.round(Math.sin(x * 0.12 + it * 0.02) * 2 + Math.abs(x - 128) * 0.04);
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(x, top, 1, H - top);
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(x, top, 1, 1);
      }
    }
  }

  /** Graveyard ambience: an owl now and then, a tolling bell, wind through the trees. */
  update(f: Fight) {
    const t = f.t;
    if (t === this.lastSound) return;
    this.lastSound = t;
    const c = ac();
    if (c && t % 1100 === 300) {
      // "hoo... hoo-hoo"
      [0, 0.5, 0.7].forEach((d, i) => tone({ type: 'sine', freq: i ? 392 : 415, to: i ? 360 : 380, dur: i ? 0.22 : 0.4, vol: 0.05, at: c.currentTime + d, attack: 0.05 }));
    }
    if (t % 1500 === 900) noise({ dur: 2.4, vol: 0.06, type: 'bandpass', freq: 500, to: 900, q: 3, attack: 0.8 });
    if (t >= this.nextHand) {
      this.hands.push({ x: MOUNDS[Math.floor(Math.random() * MOUNDS.length)] + rand(-6, 6), t: 0 });
      this.nextHand = t + Math.round(rand(360, 720));
    }
    for (const h of this.hands) h.t++;
    this.hands = this.hands.filter((h) => h.t < 200);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    // clouds sliding across the moon
    ctx.fillStyle = 'rgba(30,24,52,0.55)';
    for (let i = 0; i < 4; i++) {
      const cx = ((t * (0.08 + i * 0.03) + i * 90) % (W + 120)) - 60, cy = 30 + i * 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 36 - i * 4, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 18, cy - 3, 20, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawBats(ctx, t);
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    const mx = -Math.round(camX * 0.55);
    ctx.drawImage(this.mid, mx, 0);
    // will-o'-wisps drifting among the middle graves
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const wx = mx + 40 + i * 64 + Math.sin(t * 0.011 + i * 2) * 20, wy = 150 + Math.sin(t * 0.023 + i) * 8;
      const a = 0.5 + Math.sin(t * 0.07 + i * 3) * 0.3;
      const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, 8);
      g.addColorStop(0, `rgba(140,255,170,${a})`);
      g.addColorStop(1, 'rgba(60,200,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(wx - 8, wy - 8, 16, 16);
    }
    ctx.restore();
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    this.drawHands(ctx, dx);
    // the crypt breathes green light; the lamp flickers warm
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.18 + Math.sin(t * 0.03) * 0.08;
    let g = ctx.createRadialGradient(CRYPT_X + dx, 160, 4, CRYPT_X + dx, 160, 40);
    g.addColorStop(0, `rgba(80,220,120,${pulse})`);
    g.addColorStop(1, 'rgba(40,160,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CRYPT_X + dx - 40, 120, 80, 80);
    const flick = 0.85 + Math.sin(t * 0.37) * 0.08 + Math.sin(t * 0.91) * 0.07;
    const lx = LAMP_X + dx;
    g = ctx.createRadialGradient(lx, 99, 2, lx, 99, 46);
    g.addColorStop(0, `rgba(255,170,70,${0.32 * flick})`);
    g.addColorStop(1, 'rgba(255,130,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - 46, 53, 92, 92);
    ctx.fillStyle = `rgba(255,150,60,${0.1 * flick})`;
    ctx.beginPath();
    ctx.ellipse(lx, BACK + 6, 30, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = flick > 0.9 ? '#ffe090' : '#ffb850';
    ctx.fillRect(lx - 1, 97, 3, 5);
    ctx.fillStyle = '#fff4c0';
    ctx.fillRect(lx, 99, 1, 2);
  }

  /** Bats flap across the sky, wings beating up and down. */
  drawBats(ctx: CanvasRenderingContext2D, t: number) {
    ctx.fillStyle = '#0a0812';
    for (const b of this.bats) {
      const x = Math.round(((b.x + t * b.sp) % (W + 40)) - 20);
      const y = Math.round(b.y + Math.sin(t * 0.04 + b.ph) * 10);
      const up = Math.floor(t / 5 + b.ph) % 2 === 0;
      const s = b.s;
      ctx.fillRect(x - s, y - s, s * 2 + 1, s * 2);
      for (const side of [-1, 1]) {
        for (let k = 1; k <= 3 * s; k++) {
          const wy = up ? y - Math.ceil(k / 2) : y + Math.floor(k / 3);
          ctx.fillRect(x + side * (s + k), wy, 1, k === 3 * s ? 1 : 2);
        }
      }
      ctx.fillRect(x - s, y - s - 1, 1, 1); // ears
      ctx.fillRect(x + s, y - s - 1, 1, 1);
    }
  }

  /** A rotting hand claws up out of a grave mound, grasps at the air and sinks again. */
  drawHands(ctx: CanvasRenderingContext2D, dx: number) {
    for (const h of this.hands) {
      const x = Math.round(h.x + dx);
      if (x < -10 || x > W + 10) continue;
      const up = h.t < 30 ? h.t / 30 : h.t > 170 ? (200 - h.t) / 30 : 1;
      const len = Math.round(up * 14);
      if (len <= 0) continue;
      const base = BACK - 3, top = base - len;
      const wave = Math.round(Math.sin(h.t * 0.15) * 1.5);
      ctx.fillStyle = '#6a8a5a';
      ctx.fillRect(x + wave, top + 4, 3, len - 4);
      ctx.fillStyle = '#4a6a40';
      ctx.fillRect(x + 2 + wave, top + 4, 1, len - 4);
      if (len > 5) {
        const grip = Math.floor(h.t / 12) % 2;
        ctx.fillStyle = '#7a9a68';
        ctx.fillRect(x - 1 + wave, top + 1, 5, 4);
        for (let k = 0; k < 4; k++) ctx.fillRect(x - 1 + k + (k > 1 ? 1 : 0) + wave, top - 2 + (grip ? 2 : 0) + (k % 2), 1, grip ? 1 : 3);
        ctx.fillRect(x - 2 + wave, top + 2, 1, 2); // thumb
      }
      // dirt kicked up around the wrist
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(x - 3, base - 1, 2, 1);
      ctx.fillRect(x + 4, base - 1, 2, 1);
    }
  }

  /** Ground fog rolling across the path over the fighters' feet. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let band = 0; band < 3; band++) {
      const y0 = FLOOR - 6 + band * 9;
      const sp = 0.25 + band * 0.15;
      ctx.fillStyle = `rgba(170,170,200,${0.07 + band * 0.03})`;
      for (let x = 0; x < W; x += 2) {
        const u = x + camX * (1 + band * 0.1) + t * sp;
        const h = 4 + Math.sin(u * 0.03 + band) * 3 + Math.sin(u * 0.071 + band * 2) * 2;
        ctx.fillRect(x, Math.round(y0 - h), 2, Math.round(h * 2 + 4));
      }
    }
  }
}
