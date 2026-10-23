import { Painter } from './painter';
import { bayer, Color, darken, lighten, mix, rgb } from './palette';
import type { Look } from '../chars/build';

// Large post-match portraits, painted per pixel like the SNES win-screen art.
// Every fighter gets one generated from its Look. A fighter can add details, or
// replace the face entirely, through the optional `portrait` field on its CharDef.
//
// The face looks to the right (toward the opponent); the scene mirrors the loser.

export const PW = 104;
export const PH = 120;

/** Key landmarks of the generated face, in portrait pixels. Hooks use these to place details. */
export interface FaceGeom {
  /** Back eye (nearer the ear, drawn larger) and front eye (nearer the nose). */
  eyeA: [number, number];
  eyeB: [number, number];
  browY: number;
  noseTip: [number, number];
  nostril: [number, number];
  mouth: [number, number];
  chin: [number, number];
  ear: [number, number];
  /** Top of the skull and the hat brim line. */
  crown: number;
  brimY: number;
  neck: [number, number];
}

export const GEOM: FaceGeom = {
  eyeA: [50, 49], eyeB: [67, 48], browY: 43, noseTip: [78, 60], nostril: [72, 61],
  mouth: [64, 71], chin: [59, 85], ear: [33, 53], crown: 18, brimY: 31, neck: [52, 92],
};

/** What a portrait hook gets to work with. */
export interface PortraitCtx {
  look: Look;
  /** True for the loser's beaten-up portrait. */
  beaten: boolean;
  geom: FaceGeom;
  /** Pixels that belong to the face and neck skin (after hair and beard are painted). */
  skin: Mask;
  /** Paint a shape with soft 3D shading. `draw` paints the silhouette in any colour. */
  sculpt(draw: (m: Painter) => void, base: Color, o?: SculptOpts): Mask;
  ramp(base: Color): Color[];
}

export interface PortraitStyle {
  /** Painted before everything else (hair or capes that hang behind the head). */
  back?: (p: Painter, c: PortraitCtx) => void;
  /** Painted after the generated face (glasses, scars, accessories, custom hair). */
  front?: (p: Painter, c: PortraitCtx) => void;
  /** Replace the whole generated portrait. Bruises are still layered on top when beaten. */
  paint?: (p: Painter, c: PortraitCtx) => void;
  /** Skip parts of the generated portrait so a hook can draw its own. */
  skip?: Partial<Record<'hair' | 'beard' | 'hat' | 'clothes', boolean>>;
}

export type Mask = Uint8Array;

export interface SculptOpts {
  /** Blur radius: larger makes rounder, softer forms. */
  soft?: number;
  /** Shift toward light (+) or shadow (-). */
  bias?: number;
  /** Only paint where this mask is set. */
  clip?: Mask;
  /** Copy the result into this mask too. */
  into?: Mask;
}

const LIGHT = norm([-0.55, -0.65, 0.55]);
function norm(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l);
}

/** Five-step ramp with warm highlights and cool, purple-leaning shadows. */
export function ramp(base: Color): Color[] {
  return [
    mix(darken(base, 0.62), '#200828', 0.25),
    mix(darken(base, 0.36), '#301030', 0.12),
    rgb(base),
    mix(lighten(base, 0.2), '#fff0c0', 0.12),
    mix(lighten(base, 0.42), '#fff8e0', 0.2),
  ];
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const n = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r - 1; x < w + r; x++) {
      const add = x + r < w && x + r >= 0 ? src[y * w + x + r] : 0;
      const sub = x - r - 1 >= 0 && x - r - 1 < w ? src[y * w + x - r - 1] : 0;
      s += add - sub;
      if (x >= 0 && x < w) tmp[y * w + x] = s / n;
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r - 1; y < h + r; y++) {
      const add = y + r < h && y + r >= 0 ? tmp[(y + r) * w + x] : 0;
      const sub = y - r - 1 >= 0 && y - r - 1 < h ? tmp[(y - r - 1) * w + x] : 0;
      s += add - sub;
      if (y >= 0 && y < h) out[y * w + x] = s / n;
    }
  }
  return out;
}

function sculptInto(p: Painter, draw: (m: Painter) => void, base: Color, o: SculptOpts = {}): Mask {
  const w = p.w, h = p.h;
  const m = new Painter(w, h);
  draw(m);
  const mask = new Uint8Array(w * h);
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (m.data[i * 4 + 3] && (!o.clip || o.clip[i])) (mask[i] = 1), (f[i] = 1);
  // Blur twice to approximate a gaussian, then read surface normals from its gradient.
  const r = o.soft ?? 5;
  const b = boxBlur(boxBlur(f, w, h, r), w, h, Math.max(1, r >> 1));
  const R = ramp(base);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const gx = (b[i + 1] ?? 0) - (b[i - 1] ?? 0), gy = (b[i + w] ?? 0) - (b[i - w] ?? 0);
      const k = 2.6 * r;
      const n = norm([-gx * k, -gy * k, 0.5 + b[i]]);
      const lam = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      const v = Math.max(0, Math.min(3.999, (lam + (o.bias ?? 0)) * 3.2 + 0.4));
      const lo = Math.floor(v);
      // flat bands with a short dithered seam between them, like hand-placed SNES shading
      const fr = Math.max(0, Math.min(1, (v - lo - 0.5) * 2.2 + 0.5));
      const idx = fr > bayer(x, y) ? Math.min(4, lo + 1) : lo;
      p.set(x, y, R[idx]);
      if (o.into) o.into[i] = 1;
    }
  return mask;
}

const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Fill pixels of a painter-sized mask that pass a test. */
function where(w: number, h: number, test: (x: number, y: number) => boolean) {
  return (m: Painter) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x, y)) m.set(x, y, '#fff');
  };
}

/** Blend a colour into masked pixels with an ordered-dither falloff (bruises, blush, grime). */
function stain(p: Painter, clip: Mask, cx: number, cy: number, rx: number, ry: number, c: Color, amt: number) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= p.w || y >= p.h || !clip[y * p.w + x]) continue;
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d > 1) continue;
      const t = amt * (1 - d * d);
      if (t * 1.6 > bayer(x, y)) p.set(x, y, mix(p.get(x, y), c, Math.min(0.85, t + 0.25)));
    }
}

function eye(p: Painter, L: Look, cx: number, cy: number, rx: number, beaten: boolean, swollen: boolean) {
  const lid = '#1a0c10';
  if (swollen) {
    p.line(cx - rx, cy, cx + rx, cy + 1, lid);
    p.line(cx - rx + 1, cy + 1, cx + rx - 1, cy + 1, '#4a1830');
    return;
  }
  p.ellipse(cx, cy, rx, 2.4, beaten ? '#e8c8c0' : '#f0ece4');
  if (beaten) p.set(cx - rx + 1, cy, '#c05050'), p.set(cx + rx - 1, cy + 1, '#c05050');
  // look toward the opponent; the loser stares at the floor
  const ix = Math.round(cx + rx * 0.35), iy = Math.round(cy + (beaten ? 1 : 0));
  const iris = L.eye ?? '#3a2a20';
  p.rect(ix - 1, iy - 2, 3, 4, iris);
  p.set(ix, iy - 1, darken(iris, 0.6));
  p.set(ix, iy, darken(iris, 0.6));
  p.set(ix + 1, iy - 2, '#ffffff');
  p.line(cx - rx, cy - 2, cx + rx, cy - 2, lid);
  p.line(cx - rx - 1, cy - 1, cx - rx, cy - 2, lid);
  p.line(cx - rx + 1, cy + 2, cx + rx - 1, cy + 2, darken(L.skin, 0.3));
}

function hairline(style: Look['hairStyle'], x: number) {
  switch (style) {
    case 'slick': return x < 36 ? 58 : x < 44 ? 58 - (x - 36) * 3.3 : 30;
    case 'bob': return 37;
    case 'feathered': return x < 46 ? 66 : x < 52 ? 66 - (x - 46) * 5.5 : 32;
    case 'mop': return x < 40 ? 62 : x < 46 ? 62 - (x - 40) * 4 : 37 - Math.max(0, x - 62) * 0.5;
    case 'long': return x < 40 ? 60 : x < 47 ? 60 - (x - 40) * 4 : 31;
    default: return x < 38 ? 60 : x < 46 ? 60 - (x - 38) * 3.6 : 31;
  }
}

/** Run the hat polygon through a rotation so the loser's hat sits knocked askew. */
function tilt(pts: number[][], deg: number, ox = 52, oy = 30) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]);
}

export function paintPortrait(L: Look, beaten: boolean, style: PortraitStyle = {}): HTMLCanvasElement {
  const p = new Painter(PW, PH);
  const g = GEOM;
  const skin = new Uint8Array(PW * PH);
  const ctx: PortraitCtx = {
    look: L, beaten, geom: g, skin,
    sculpt: (draw, base, o) => sculptInto(p, draw, base, o),
    ramp,
  };
  const S = ctx.sculpt;
  const skip = style.skip ?? {};
  const hairD = darken(L.hair, 0.15);
  const outer = L.armor ? L.armor.metal : L.bareChest ? L.skin : L.coat ?? L.shirt;

  style.back?.(p, ctx);
  if (style.paint) style.paint(p, ctx);
  else {
    // ---- hair that hangs behind the head
    if (!skip.hair) {
      if (L.hairStyle === 'long') S((m) => m.poly([[22, 34], [46, 26], [48, 104], [30, 108], [18, 96]], '#fff'), L.hair, { soft: 4 });
      if (L.hairStyle === 'bob') S((m) => m.ellipse(48, 46, 29, 32, '#fff'), L.hair, { soft: 5, clip: rectMask(0, 0, PW, 76) });
    }
    // ---- shoulders and clothes
    if (!skip.clothes) {
      S((m) => m.poly([[-2, 121], [2, 104], [16, 95], [36, 90], [66, 91], [88, 96], [102, 106], [106, 121]], '#fff'), outer, { soft: 7 });
      if (L.armor) {
        const a = L.armor;
        S((m) => m.poly([[30, 92], [74, 92], [80, 104], [24, 104]], '#fff'), lighten(a.metal, 0.08), { soft: 3 });
        p.line(24, 104, 80, 104, a.trim);
        p.line(30, 92, 74, 92, a.trim);
        S((m) => m.poly([[36, 105], [70, 105], [68, 121], [38, 121]], '#fff'), a.tabard, { soft: 3 });
        p.line(53, 107, 53, 120, a.trim);
        p.line(45, 112, 61, 112, a.trim);
        // pauldron rivets
        for (const [x, y] of [[12, 104], [92, 106], [20, 100], [86, 101]]) p.set(x, y, lighten(a.metal, 0.6));
      } else if (L.bareChest) {
        const d = darken(L.skin, 0.3), hi = lighten(L.skin, 0.2);
        p.line(30, 99, 48, 101, hi), p.line(58, 101, 78, 98, hi); // collarbones
        p.line(28, 116, 50, 118, d), p.line(56, 118, 80, 115, d); // pecs
        p.line(53, 104, 53, 121, d);
        if (L.chestHair) for (let i = 0; i < 18; i++) p.set(46 + ((i * 7) % 15), 104 + ((i * 5) % 16), L.chestHair);
        for (let y = 92; y < PH; y++) for (let x = 0; x < PW; x++) if (p.alpha(x, y)) skin[y * PW + x] = 1;
      } else {
        if (L.coat) {
          S((m) => m.poly([[42, 90], [66, 90], [62, 121], [46, 121]], '#fff'), L.shirt, { soft: 3 });
          // lapels
          p.poly([[38, 91], [46, 92], [52, 112], [44, 121], [36, 121], [40, 106]], darken(L.coat, 0.25));
          p.poly([[68, 91], [62, 92], [56, 112], [62, 121], [70, 121], [66, 106]], darken(L.coat, 0.1));
          p.line(46, 92, 52, 112, darken(L.coat, 0.55));
          p.line(62, 92, 56, 112, darken(L.coat, 0.55));
          if (L.coatTrim) p.line(38, 91, 40, 106, L.coatTrim), p.line(68, 91, 66, 106, L.coatTrim);
        }
        // shirt collar points
        p.poly([[44, 88], [52, 94], [47, 98]], lighten(L.shirt, 0.15));
        p.poly([[62, 88], [55, 94], [60, 98]], L.shirt);
        if (L.bandolier) for (let i = 0; i < 4; i++) p.line(14 + i, 98, 70 + i, 121, L.bandolier);
        if (L.bowtie) {
          p.poly([[44, 93], [53, 96], [44, 100]], L.bowtie);
          p.poly([[63, 93], [54, 96], [63, 100]], L.bowtie);
          p.rect(51, 94, 4, 4, lighten(L.bowtie, 0.2));
        }
        if (L.necktie) {
          p.poly([[50, 94], [57, 94], [55, 98], [52, 98]], L.necktie);
          p.poly([[52, 98], [55, 98], [58, 116], [53.5, 121], [49, 116]], L.necktie);
          p.line(53, 99, 51, 115, lighten(L.necktie, 0.25));
        }
      }
    }
    // ---- neck, head, nose
    S((m) => m.poly([[40, 70], [64, 78], [65, 97], [52, 100], [39, 96]], '#fff'), L.skin, { soft: 4, bias: -0.3, into: skin });
    const head = (m: Painter) => {
      m.ellipse(52, 47, 23.5, 27, '#fff');
      m.poly([[29, 50], [32, 66], [42, 79], [53, 86], [64, 84], [72, 76], [76, 64], [76.5, 46], [70, 30]], '#fff');
      m.poly([[69, 46], [79, 59], [77.5, 63], [71, 63]], '#fff');
    };
    S(head, L.skin, { soft: 5, into: skin });
    // cheekbone and jaw shadow, eye sockets, nose shadow
    stain(p, skin, 44, 64, 8, 5, darken(L.skin, 0.25), 0.4);
    stain(p, skin, g.eyeA[0], g.eyeA[1] - 1, 7, 4, darken(L.skin, 0.3), 0.45);
    stain(p, skin, g.eyeB[0], g.eyeB[1] - 1, 5, 4, darken(L.skin, 0.3), 0.45);
    p.line(71, 52, 75, 60, darken(L.skin, 0.28));
    p.line(71, 63, 74, 63, darken(L.skin, 0.4));
    p.set(g.nostril[0], g.nostril[1], '#3a1414');
    p.set(g.nostril[0] + 1, g.nostril[1], '#3a1414');
    p.line(66, 63, 66, 68, darken(L.skin, 0.18)); // philtrum
    // ---- ear
    S((m) => m.ellipse(g.ear[0], g.ear[1], 5, 8, '#fff'), L.skin, { soft: 2, into: skin });
    p.line(33, 49, 35, 56, darken(L.skin, 0.3));
    p.set(32, 48, darken(L.skin, 0.3));

    // ---- hair on the head
    if (!skip.hair) {
      const hl = (x: number, y: number) => y < hairline(L.hairStyle, x);
      const headM = maskOf(head);
      S(where(PW, PH, (x, y) => (headM[y * PW + x] === 1 && hl(x, y) && (L.hairStyle === 'feathered' || !inEll(x, y, g.ear[0], g.ear[1], 5, 8))) || inEll(x, y, 51, 31, 26, 14) && y < 36), L.hair, { soft: 3 });
      if (L.hairStyle === 'feathered') {
        S((m) => m.poly([[22, 34], [42, 30], [46, 70], [36, 78], [24, 72], [20, 50]], '#fff'), L.hair, { soft: 4 });
        for (let i = 0; i < 5; i++) p.line(26 + i * 9, 24 - (i % 2), 40 + i * 8, 20 + i, lighten(L.hair, 0.3));
        for (let x = 25; x < 42; x += 4) p.line(x, 44, x + 2, 70, darken(L.hair, 0.35));
      }
      if (L.hairStyle === 'slick') {
        for (let i = 0; i < 4; i++) p.line(32 + i * 7, 22 + i, 46 + i * 7, 19 + i * 2, lighten(L.hair, 0.3));
        p.line(52, 18, 54, 30, darken(L.hair, 0.5));
      } else if (L.hairStyle === 'bob') {
        // straight-cut fringe and a lock in front of the ear
        S((m) => m.poly([[25, 38], [44, 38], [44, 70], [40, 76], [28, 76], [24, 68]], '#fff'), L.hair, { soft: 3 });
        for (let x = 46; x < 76; x += 4) p.line(x, 30, x + 1, 36, darken(L.hair, 0.4));
        for (let x = 27; x < 43; x += 4) p.line(x, 50, x, 74, darken(L.hair, 0.35));
      } else {
        for (let x = 30; x < 40; x += 3) p.line(x, 40, x + 1, 58, darken(L.hair, 0.4));
      }
      recomputeSkin(p, skin, L.skin);
    }

    // ---- brows and eyes
    const angry = !beaten;
    const bw = darken(L.hair, 0.2);
    for (let t = 0; t < 2; t++) {
      if (angry) {
        p.line(43, g.browY - 2 + t, 56, g.browY + 2 + t, bw);
        p.line(62, g.browY + 2 + t, 72, g.browY - 1 + t, bw);
      } else {
        p.line(43, g.browY + 1 + t, 56, g.browY - 1 + t, bw);
        p.line(62, g.browY - 1 + t, 71, g.browY + 2 + t, bw);
      }
    }
    eye(p, L, g.eyeA[0], g.eyeA[1], 5, beaten, beaten);
    eye(p, L, g.eyeB[0], g.eyeB[1], 3.5, beaten, false);
    // ---- mouth
    const [mx, my] = g.mouth;
    if (!beaten) {
      // confident smirk, teeth showing on the near side
      p.line(mx - 8, my, mx + 3, my - 1, '#4a1418');
      p.line(mx + 3, my - 1, mx + 7, my - 3, '#4a1418');
      p.rect(mx - 1, my, 6, 1, '#f0e8d8');
      p.line(mx - 6, my + 2, mx + 3, my + 2, darken(L.skin, 0.3));
      p.set(mx + 8, my - 4, darken(L.skin, 0.35));
    } else {
      // gasping, bloody, a tooth missing
      p.ellipse(mx, my + 1, 6, 3.5, '#3a0a10');
      p.rect(mx - 4, my - 2, 9, 2, '#e8dcc0');
      p.set(mx, my - 2, '#3a0a10'), p.set(mx, my - 1, '#3a0a10');
      p.line(mx - 3, my + 4, mx + 3, my + 4, '#b02030');
      p.line(mx - 6, my - 2, mx + 6, my - 3, darken(L.skin, 0.4));
    }
    // ---- facial hair
    if (!skip.beard) {
      if (L.mustache)
        S((m) => m.poly([[56, 67], [64, 64.5], [72, 65], [77, 69], [72, 68.5], [64, 67.5], [55, 70]], '#fff'), L.hair, { soft: 2 });
      if (L.beard === 'chinstrap') {
        const headM = maskOf(head);
        S(where(PW, PH, (x, y) =>
          ((headM[y * PW + x] === 1 && ((y > 60 && !inEll(x, y, 64, 66, 12, 11.5)) || (x < 41 && y > 50) && !inEll(x, y, g.ear[0], g.ear[1], 5, 8))) ||
            inEll(x, y, 57, 84, 13, 6))), L.hair, { soft: 3 });
        for (let x = 46; x < 70; x += 3) p.line(x, 80, x - 1, 88, darken(L.hair, 0.45));
      } else if (L.beard === 'full') {
        const headM = maskOf(head);
        S(where(PW, PH, (x, y) =>
          (headM[y * PW + x] === 1 && y > 56 && !inEll(x, y, g.mouth[0], g.mouth[1] + 1, 7, 3.5) && !inEll(x, y, g.ear[0], g.ear[1], 5, 8)) ||
            inEll(x, y, 58, 84, 15, 7)), L.hair, { soft: 3 });
        S((m) => m.poly([[55, 66], [64, 63.5], [73, 64], [78, 69], [72, 69], [64, 68], [54, 70]], '#fff'), darken(L.hair, 0.1), { soft: 2 });
        for (let x = 40; x < 72; x += 4) p.line(x, 74, x - 1, 86, darken(L.hair, 0.4));
      } else if (L.beard === 'braided') {
        S((m) => {
          m.poly([[34, 58], [44, 66], [56, 70], [76, 66], [77, 76], [72, 96], [64, 110], [46, 110], [38, 92], [32, 70]], '#fff');
        }, L.hair, { soft: 4 });
        // mouth peeks through
        if (!beaten) p.line(mx - 6, my + 1, mx + 6, my, '#3a0a10'), p.rect(mx - 2, my + 1, 6, 1, '#e8e0c8');
        else p.ellipse(mx, my + 2, 5, 2.5, '#3a0a10'), p.rect(mx - 3, my + 1, 7, 1, '#e0d0b0');
        p.poly([[56, 66], [64, 64], [74, 65], [78, 69], [64, 68]], L.hair);
        const br = lighten(L.hair, 0.28);
        for (const bx of [48, 56, 64]) {
          for (let y = 78; y < 106; y += 4) p.line(bx - 2, y, bx + 2, y + 2, br), p.line(bx + 2, y + 2, bx - 2, y + 4, darken(L.hair, 0.5));
          if (L.beardRibbon) p.rect(bx - 2, 92 + (bx % 3), 5, 2, L.beardRibbon);
        }
      }
    }
    recomputeSkin(p, skin, L.skin);
    // ---- hats
    if (!skip.hat && L.hat) {
      const ang = beaten ? -11 : 0;
      if (L.hat === 'stovepipe') {
        const c = L.hatColor ?? '#141218';
        S((m) => m.poly(tilt([[34, 30], [71, 28], [70, 0], [35, 0]], ang), '#fff'), c, { soft: 5, bias: 0.15 });
        S((m) => m.poly(tilt([[34, 20], [71, 18], [71, 25], [34, 27]], ang), '#fff'), L.hatTrim ?? '#34303a', { soft: 2 });
        S((m) => m.poly(tilt([[20, 33], [52, 28], [84, 27], [88, 30], [52, 33], [22, 37]], ang), '#fff'), c, { soft: 2, bias: 0.2 });
        if (beaten) p.poly(tilt([[50, 6], [58, 4], [55, 12]], ang), darken(c, 0.5)); // dent
      } else if (L.hat === 'horned') {
        const c = L.hatColor ?? '#a8b0bc', trim = L.hatTrim ?? '#d8b040', horn = '#ece2c4';
        S((m) => m.poly(tilt([[24, 30], [16, 22], [10, 6], [20, 14], [30, 22]], ang), '#fff'), horn, { soft: 2 });
        S((m) => m.poly(tilt([[80, 30], [88, 22], [94, 6], [84, 14], [74, 22]], ang), '#fff'), horn, { soft: 2 });
        S((m) => m.poly(tilt([[24, 34], [26, 20], [36, 10], [52, 6], [68, 10], [78, 20], [80, 34]], ang), '#fff'), c, { soft: 5, bias: 0.1 });
        S((m) => m.poly(tilt([[23, 30], [81, 30], [81, 35], [23, 35]], ang), '#fff'), trim, { soft: 2 });
        S((m) => m.poly(tilt([[50, 7], [54, 7], [54, 30], [50, 30]], ang), '#fff'), trim, { soft: 1 });
        for (let x = 28; x < 80; x += 8) {
          const [rx, ry] = tilt([[x, 32.5]], ang)[0];
          p.set(rx, ry, lighten(trim, 0.5));
        }
      } else if (L.hat === 'tricorn') {
        const c = L.hatColor ?? '#18141a', trim = L.hatTrim ?? '#c9a33a';
        const brim = tilt([[10, 36], [94, 31], [84, 16], [54, 6], [22, 14]], ang);
        S((m) => m.poly(brim, '#fff'), c, { soft: 5, bias: 0.15 });
        for (let i = 0; i < brim.length; i++) {
          const [x0, y0] = brim[i], [x1, y1] = brim[(i + 1) % brim.length];
          if (i !== 4) p.line(x0, y0, x1, y1, trim);
        }
        const [sx, sy] = tilt([[52, 20]], ang)[0];
        p.ellipse(sx, sy, 4, 3.5, '#ece4d4');
        p.set(sx - 2, sy, '#100'), p.set(sx + 1, sy, '#100');
        p.line(sx - 6, sy + 4, sx + 6, sy + 8, '#ece4d4');
        p.line(sx + 6, sy + 4, sx - 6, sy + 8, '#ece4d4');
      }
    }
  }
  style.front?.(p, ctx);

  if (beaten) batter(p, ctx);
  p.outline('#0c0408');
  return p.canvas();
}

function rectMask(x: number, y: number, w: number, h: number) {
  const m = new Uint8Array(PW * PH);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m[j * PW + i] = 1;
  return m;
}
function maskOf(draw: (m: Painter) => void) {
  const m = new Painter(PW, PH);
  draw(m);
  const out = new Uint8Array(PW * PH);
  for (let i = 0; i < PW * PH; i++) out[i] = m.data[i * 4 + 3] ? 1 : 0;
  return out;
}
/** Keep only skin pixels that still look like skin after hair, beard and features covered them. */
function recomputeSkin(p: Painter, skin: Mask, base: Color) {
  const R = ramp(base).map(rgb);
  for (let i = 0; i < skin.length; i++) {
    if (!skin[i]) continue;
    const r = p.data[i * 4], gg = p.data[i * 4 + 1], b = p.data[i * 4 + 2];
    const close = R.some((c) => Math.abs(c[0] - r) + Math.abs(c[1] - gg) + Math.abs(c[2] - b) < 90);
    if (!close) skin[i] = 0;
  }
}

const BLOOD = '#b0101c', BLOOD_D = '#600810';

/** Bruises, cuts, swelling and blood on the loser. */
function batter(p: Painter, c: PortraitCtx) {
  const g = c.geom, s = c.skin;
  // swollen black eye
  stain(p, s, g.eyeA[0], g.eyeA[1], 9, 7, '#4a2050', 0.9);
  stain(p, s, g.eyeA[0] - 1, g.eyeA[1] + 3, 7, 4, '#6a3a20', 0.5);
  p.line(g.eyeA[0] - 5, g.eyeA[1], g.eyeA[0] + 5, g.eyeA[1] + 1, '#1a0c10');
  // bruised cheek and jaw
  stain(p, s, 42, 66, 7, 6, '#5a3060', 0.6);
  stain(p, s, 70, 76, 6, 4, '#5a3060', 0.45);
  // cut over the front brow, blood running down
  const [ex] = g.eyeB, gy = g.browY - 3;
  p.line(ex - 6, gy + 2, ex + 3, gy - 4, BLOOD_D);
  p.line(ex - 5, gy + 2, ex + 3, gy - 3, BLOOD);
  for (const [x, len] of [[ex - 4, 3], [ex + 5, 7]]) {
    p.line(x, gy + 1, x + 1, gy + 1 + len, BLOOD);
    p.set(x + 1, gy + 2 + len, BLOOD_D);
  }
  // bloody nose and split lip
  const [nx, ny] = g.nostril;
  p.rect(nx - 1, ny + 1, 2, 5, BLOOD);
  p.set(nx, ny + 6, BLOOD_D);
  p.set(nx - 1, ny + 7, BLOOD);
  p.line(g.mouth[0] + 6, g.mouth[1] - 1, g.mouth[0] + 7, g.mouth[1] + 6, BLOOD);
  p.set(g.mouth[0] + 7, g.mouth[1] + 8, BLOOD_D);
  // plaster across the bridge of the nose
  p.poly([[66, 50], [74, 47], [75.5, 50], [67.5, 53]], '#e0c8a0');
  p.set(70, 50, '#a08868'), p.set(72, 49, '#a08868');
  // sweat
  for (const [x, y] of [[40, 34], [78, 44]]) {
    p.set(x, y, '#d0f0ff'), p.rect(x - 1, y + 1, 3, 2, '#a0d0f0'), p.set(x, y + 3, '#6090c0');
  }
  // rips in the clothes
  for (const [x, y] of [[14, 106], [86, 108], [24, 114]]) p.line(x, y, x + 4, y + 5, '#0c0408'), p.line(x + 1, y, x + 5, y + 5, darken(c.look.shirt, 0.2));
  // drain colour a little
  for (let i = 0; i < p.data.length; i += 4) {
    if (!p.data[i + 3]) continue;
    const r = p.data[i], gg = p.data[i + 1], b = p.data[i + 2];
    if (r > 150 && gg < 40 && b < 50) continue; // keep the blood vivid
    const l = (r + gg + b) / 3;
    p.data[i] = r * 0.82 + l * 0.18;
    p.data[i + 1] = gg * 0.78 + l * 0.18;
    p.data[i + 2] = b * 0.82 + l * 0.18 + 4;
  }
}

const cache = new Map<string, HTMLCanvasElement>();
/** Cached portrait for a fighter. `key` should identify the look (id plus alt flag). */
export function portraitFor(key: string, L: Look, beaten: boolean, style?: PortraitStyle) {
  const k = `${key}|${beaten ? 'b' : 'w'}`;
  let cv = cache.get(k);
  if (!cv) cache.set(k, (cv = paintPortrait(L, beaten, style)));
  return cv;
}
