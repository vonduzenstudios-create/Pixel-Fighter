import { Painter } from '../gfx/painter';
import { Color, darken, lighten, mix } from '../gfx/palette';
import { Part, PartSet } from '../gfx/rig';

// Describes a fighter's outfit. The builder paints every jointed body part from this.
export interface Look {
  skin: string;
  hair: string;
  eye?: string;
  shirt: string;
  coat?: string;
  coatTrim?: string;
  /** Frock-coat tails that hang past the hips. */
  tails?: boolean;
  pants: string;
  boots: string;
  tallBoots?: boolean;
  glove?: string;
  /** Glove on the front hand only (overrides glove for that hand). */
  gloveFront?: string;
  /** Socks showing between the cuff and the shoe. */
  socks?: string;
  belt?: string;
  buckle?: string;
  hat?: 'stovepipe' | 'tricorn' | 'fedora';
  hatColor?: string;
  hatTrim?: string;
  hairStyle: 'short' | 'slick' | 'bob' | 'long' | 'mop' | 'curls';
  beard?: 'chinstrap' | 'braided';
  beardRibbon?: string;
  mustache?: boolean;
  bowtie?: string;
  necktie?: string;
  armor?: { metal: string; tabard: string; trim: string };
  /** Copper coil gauntlet on the front forearm. */
  coil?: boolean;
  sash?: string;
  bandolier?: string;
  /** No shirt: bare skin torso and arms with muscle definition. */
  bareChest?: boolean;
  /** Cloth wraps on the wrists and hands. */
  wraps?: string;
}

const OUT = '#100810';

function finish(p: Painter, dimmed = false): HTMLCanvasElement {
  const c = p.clone();
  if (dimmed) c.dim(0.32);
  return c.canvas();
}

function torso(L: Look): Painter {
  // 28x42, hip pivot at (13,31), shoulders 24px above it at y=7
  const p = new Painter(28, 42);
  const outer = L.armor ? L.armor.metal : L.bareChest ? L.skin : L.coat ?? L.shirt;
  if (L.tails && L.coat) {
    // frock coat tails hanging behind the legs
    p.poly([[5, 24], [14, 24], [13, 40], [9, 41], [4, 39]], darken(L.coat, 0.1));
  }
  p.ellipse(13, 30, 7.5, 4.5, L.pants);
  p.poly([[7, 31], [19, 31], [19.5, 20], [6.5, 20]], outer);
  p.poly([[6, 23], [20, 23], [22, 12], [20, 6], [8, 5.5], [5, 10]], outer);
  p.ellipse(13.5, 8, 7.5, 3.5, outer);
  if (L.coat && !L.armor) {
    // open coat shows the shirt down the front
    p.poly([[16, 6], [20.5, 6.5], [21.5, 12], [20, 23], [17, 23]], L.shirt);
    p.line(16, 7, 17, 23, darken(L.coat, 0.35));
    if (L.coatTrim) {
      p.line(17, 7, 18, 22, L.coatTrim);
      for (const y of [11, 15, 19]) p.set(15, y, L.coatTrim);
    }
  }
  if (L.armor) {
    const m = L.armor;
    p.poly([[9, 13], [19, 13], [18.5, 31], [9.5, 31]], m.tabard);
    p.line(14, 15, 14, 27, m.trim);
    p.line(11, 19, 17, 19, m.trim);
    p.line(9, 13, 19, 13, m.trim);
    p.ellipse(15, 9, 4, 2.5, lighten(m.metal, 0.25));
  }
  if (L.bareChest) {
    const d = darken(L.skin, 0.22), hi = lighten(L.skin, 0.18);
    p.line(14, 8, 20, 9, hi); // collarbone
    p.line(13, 14, 20, 14, d); // under the pecs
    p.line(15, 12, 15, 14, d);
    p.line(16, 16, 16, 21, d); // abs
    for (const y of [16, 18, 20]) p.line(17, y, 19, y, d);
    p.set(19, 11, d);
  }
  if (L.belt) {
    p.rect(7, 23, 13, 2, L.belt);
    if (L.buckle) p.rect(16, 23, 2, 2, L.buckle);
  }
  if (L.sash) p.poly([[7, 21], [20, 21], [20, 23], [7, 23]], L.sash);
  if (L.bandolier) p.line(9, 6, 20, 21, L.bandolier), p.line(10, 6, 20, 20, L.bandolier);
  p.shade(0.2);
  if (L.bowtie) {
    p.rect(18, 5, 4, 2, L.bowtie);
    p.set(20, 7, L.bowtie);
  }
  if (L.necktie) {
    p.rect(19, 5, 2, 2, L.necktie);
    p.line(19, 7, 18, 13, L.necktie);
    p.line(20, 7, 19, 12, darken(L.necktie, 0.3));
  }
  p.outline(OUT);
  return p;
}

function head(L: Look): Painter {
  // 24x44, neck pivot at (10,40); skull centred ~13px above the neck
  const p = new Painter(24, 44);
  const skinD = darken(L.skin, 0.18);
  p.rect(8, 35, 5, 7, skinD);
  if (L.hairStyle === 'long') p.poly([[3, 26], [8, 24], [8, 40], [4, 41]], L.hair);
  if (L.hairStyle === 'bob') p.ellipse(9, 29, 7.5, 7.5, L.hair);
  if (L.hairStyle === 'curls') {
    // shoulder-length ringlets hanging behind the jaw
    p.ellipse(7, 28, 6, 7, L.hair);
    for (const [x, y] of [[3, 33], [5, 36], [8, 38], [3, 37]]) p.ellipse(x, y, 2.2, 2.4, L.hair);
  }
  p.ellipse(10.5, 29, 6, 7, L.skin);
  p.ellipse(13, 33, 4, 3.5, L.skin);
  p.poly([[15, 28], [17.5, 30.5], [15, 31]], L.skin); // nose
  // hair
  if (L.hairStyle === 'short') {
    p.ellipse(9.5, 24.5, 6.5, 3.5, L.hair);
    p.rect(4, 24, 4, 7, L.hair);
  } else if (L.hairStyle === 'slick') {
    p.ellipse(10, 24, 7, 3.5, L.hair);
    p.rect(4, 24, 4, 8, L.hair);
    p.line(6, 22, 13, 21, lighten(L.hair, 0.35));
  } else if (L.hairStyle === 'bob') {
    p.ellipse(10.5, 24.5, 7, 4, L.hair);
    p.rect(13, 23, 4, 3, L.hair);
  } else if (L.hairStyle === 'curls') {
    p.ellipse(10, 24, 7, 3.5, L.hair);
    p.rect(4, 24, 5, 8, L.hair);
  } else if (L.hairStyle === 'mop') {
    // thick, full cut with a heavy fringe swept over the brow
    p.ellipse(9.5, 24, 7, 4.5, L.hair);
    p.rect(3, 23, 5, 9, L.hair);
    p.poly([[9, 21], [17, 22.5], [16.5, 26], [12, 25], [10, 24]], L.hair);
    p.line(7, 21, 14, 22, lighten(L.hair, 0.3));
  } else {
    p.ellipse(10, 24.5, 6.5, 3.5, L.hair);
    p.rect(4, 24, 4, 6, L.hair);
  }
  p.shade(0.18);
  // face details (after shading so they stay crisp)
  p.set(14, 28, L.eye ?? '#1a1010');
  p.set(13, 28, '#e8e0d8');
  p.line(12, 26, 15, 26, darken(L.hair, 0.1));
  p.ellipse(8, 30, 1.2, 1.8, skinD);
  p.line(14, 34, 15, 34, '#5a2a2a');
  if (L.mustache) p.poly([[13, 32], [17, 32], [17, 33.5], [12.5, 34]], L.hair);
  if (L.beard === 'chinstrap') {
    p.poly([[6.5, 30], [8.5, 35], [11, 38], [15.5, 37.5], [16, 35.5], [12.5, 35.5], [9.5, 31], [8.5, 28.5]], L.hair);
  } else if (L.beard === 'braided') {
    p.poly([[6.5, 28], [9, 31], [13, 33], [17.5, 31.5], [17.5, 35], [16, 43], [9, 43], [6, 35]], L.hair);
    p.poly([[12, 31.5], [17.5, 31], [17.5, 32.5], [12, 33]], L.hair);
    const br = lighten(L.hair, 0.25);
    p.line(11, 36, 11, 42, br, true);
    p.line(14, 36, 14, 42, br, true);
    if (L.beardRibbon) for (const [x, y] of [[11, 39], [14, 40], [12, 37]]) p.set(x, y, L.beardRibbon);
    p.set(15, 33, '#5a2a2a');
  }
  if (L.hairStyle === 'curls') {
    // ringlet highlights and the single curl that falls over the brow
    const hl = lighten(L.hair, 0.3);
    for (const [x, y] of [[3, 33], [5, 36], [8, 38], [4, 29]]) p.set(x, y, hl);
    p.line(15, 23, 16, 26, L.hair);
    p.set(15, 27, L.hair);
  }
  if (L.hat === 'stovepipe') {
    const c = L.hatColor ?? '#141218';
    p.rect(4, 2, 13, 21, c);
    p.rect(2, 21, 17, 3, c);
    p.rect(4, 17, 13, 3, L.hatTrim ?? '#34303a');
    p.line(5, 3, 5, 16, lighten(c, 0.2));
    p.line(15, 3, 15, 22, darken(c, 0.4));
  } else if (L.hat === 'tricorn') {
    const c = L.hatColor ?? '#18141a';
    p.poly([[0, 24], [21, 24], [19, 18], [11, 14], [3, 17]], c);
    p.ellipse(10.5, 19, 6, 4, c);
    p.line(0, 24, 21, 24, L.hatTrim ?? '#c9a33a');
    p.line(3, 17, 11, 14, L.hatTrim ?? '#c9a33a');
    p.line(11, 14, 19, 18, L.hatTrim ?? '#c9a33a');
    // skull and crossbones badge
    p.rect(9, 18, 3, 2, '#e8e0d0');
    p.set(10, 20, '#e8e0d0');
  } else if (L.hat === 'fedora') {
    const c = L.hatColor ?? '#141218';
    // pinched crown tipped down over the eyes, wide brim
    p.poly([[4, 22], [5, 15], [8, 13], [13, 13.5], [16, 15], [17, 22]], c);
    p.poly([[0, 22], [17, 21], [21, 23], [20, 24], [1, 24]], c);
    p.rect(5, 19, 12, 2, L.hatTrim ?? '#e8e4dc');
    p.line(9, 14, 12, 14.5, darken(c, 0.4));
    p.line(5, 16, 5, 18, lighten(c, 0.25));
  }
  p.outline(OUT);
  return p;
}

function upperArm(L: Look): Painter {
  const p = new Painter(12, 21);
  const c = L.armor ? L.armor.metal : L.bareChest ? L.skin : L.coat ?? L.shirt;
  p.capsule(6, 3, 4.6, 6, 15, 3.6, c);
  if (L.bareChest) p.line(8, 5, 8, 11, lighten(L.skin, 0.15));
  if (L.armor) {
    p.ellipse(6, 4, 5.5, 4.5, lighten(L.armor.metal, 0.1));
    p.line(1, 7, 11, 7, L.armor.trim);
  }
  p.shade(0.22);
  p.outline(OUT);
  return p;
}

function foreArm(L: Look, front: boolean): Painter {
  const p = new Painter(12, 23);
  const c = L.armor ? L.armor.metal : L.bareChest ? L.skin : L.coat ?? L.shirt;
  p.capsule(6, 3, 3.9, 6, 12, 3.2, c);
  const cuff = L.wraps ?? L.coatTrim ?? (L.coat ? L.shirt : darken(c, 0.2));
  if (!L.bareChest || L.wraps) p.rect(2, 11, 8, 2, cuff);
  if (L.coil && front) {
    p.rect(2, 4, 8, 7, '#b5652a');
    for (let y = 4; y < 11; y += 2) p.line(2, y, 9, y, '#e8a050');
  }
  const hand = (front && L.gloveFront) || L.glove || L.skin;
  p.ellipse(6, 16, 3.6, 3.6, hand);
  if (L.wraps) p.rect(3, 14, 6, 2, L.wraps);
  p.shade(0.22);
  p.line(4, 18, 8, 18, darken(hand, 0.3));
  if (front && L.gloveFront) for (const [x, y] of [[5, 15], [7, 17]]) p.set(x, y, '#ffffff'); // sequin glints
  p.outline(OUT);
  return p;
}

function thigh(L: Look): Painter {
  const p = new Painter(14, 25);
  const c = L.armor ? L.armor.metal : L.pants;
  p.capsule(7, 3, 5.6, 7, 19, 4.4, c);
  if (L.armor) {
    p.ellipse(7, 20, 4.5, 3.5, lighten(L.armor.metal, 0.15));
    p.line(2, 9, 12, 9, L.armor.trim);
  }
  p.shade(0.2);
  p.outline(OUT);
  return p;
}

function shin(L: Look): Painter {
  const p = new Painter(12, 25);
  const c = L.armor ? L.armor.metal : L.pants;
  p.capsule(6, 2, 4.6, 6, 19, 3.6, c);
  if (L.tallBoots) {
    p.capsule(6, 6, 4.4, 6, 19, 3.8, L.boots);
    p.rect(1, 5, 10, 3, lighten(L.boots, 0.2));
  } else {
    p.rect(2, 16, 8, 6, L.boots);
    if (L.socks) p.rect(2, 16, 8, 4, L.socks);
  }
  p.shade(0.2);
  p.outline(OUT);
  return p;
}

function foot(L: Look): Painter {
  const p = new Painter(16, 10);
  p.poly([[1, 1], [7, 1], [13.5, 4.5], [14, 8], [1, 8]], L.boots);
  p.shade(0.2);
  p.line(1, 8, 13, 8, darken(L.boots, 0.5));
  p.outline(OUT);
  return p;
}

export function buildParts(L: Look): PartSet {
  const t = torso(L), h = head(L), ua = upperArm(L), faF = foreArm(L, true), faB = foreArm(L, false);
  const th = thigh(L), sh = shin(L), ft = foot(L);
  const part = (p: Painter, px: number, py: number, dim = false): Part => ({ img: finish(p, dim), px, py });
  return {
    torso: part(t, 13, 31),
    head: part(h, 10, 40),
    uarm: part(ua, 6, 3), farm: part(faF, 6, 3), thigh: part(th, 7, 3), shin: part(sh, 6, 2), foot: part(ft, 4, 2),
    uarmB: part(ua, 6, 3, true), farmB: part(faB, 6, 3, true), thighB: part(th, 7, 3, true), shinB: part(sh, 6, 2, true),
    footB: part(ft, 4, 2, true),
  };
}

/** Colour-swapped outfit for mirror matches, in the spirit of the era's palette swaps. */
export function altLook(L: Look, swap: Record<string, string>): Look {
  const out: any = { ...L };
  for (const k of Object.keys(out)) if (typeof out[k] === 'string' && swap[out[k]]) out[k] = swap[out[k]];
  if (L.armor) out.armor = { ...L.armor, tabard: swap[L.armor.tabard] ?? L.armor.tabard, metal: swap[L.armor.metal] ?? L.armor.metal };
  return out;
}

export const OUTLINE = OUT;
export const tone = (c: Color, t: number) => mix(c, '#000', t);
