import { Painter } from '../gfx/painter';
import { Color, darken, lighten, mix, rgb } from '../gfx/palette';
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
  hat?: 'stovepipe' | 'tricorn' | 'horned' | 'fedora' | 'nemes' | 'beanie';
  hatColor?: string;
  hatTrim?: string;
  hairStyle: 'short' | 'slick' | 'bob' | 'long' | 'mop' | 'feathered' | 'perm' | 'curls' | 'blowout' | 'spiky' | 'bald' | 'gelled';
  beard?: 'chinstrap' | 'braided' | 'full' | 'goatee' | 'vandyke' | 'pharaoh';
  /** Facial hair colour when it differs from the hair (bleached spikes over a darker beard). */
  beardColor?: string;
  beardRibbon?: string;
  mustache?: boolean;
  bowtie?: string;
  necktie?: string;
  armor?: { metal: string; tabard: string; trim: string };
  /** Copper coil gauntlet on the front forearm. */
  coil?: boolean;
  sash?: string;
  /** Unbuttoned collar showing a V of skin, with breast pockets (work shirt). */
  openCollar?: boolean;
  bandolier?: string;
  /** Chest hair showing through an open collar. */
  chestHair?: string;
  /** Sleeves rolled to the elbow: bare forearms with a cuff of the sleeve colour. */
  rolledSleeves?: boolean;
  /** No shirt: bare skin torso and arms with muscle definition. */
  bareChest?: boolean;
  /** Cloth wraps on the wrists and hands. */
  wraps?: string;
  /** Thick-rimmed glasses (frame colour). */
  glasses?: string;
  /** Rides a jointed mech-chair: the legs become hydraulic struts and the seated legs are part of the chair. */
  chair?: { frame: string; accent: string; glow: string };
  /** Boxing trunks over bare legs (pants should be the skin colour). */
  trunks?: { color: string; stripe: string };
  /** Padded boxing gloves in this colour. */
  boxingGloves?: string;
  /** Small hoop earrings (metal colour). */
  earrings?: string;
  /** Lipstick colour for the mouth. */
  lips?: string;
  /** Double-breasted chef's jacket over the shirt colour: stand-up collar and two rows of buttons (button colour). */
  chefCoat?: string;
  /** Waist apron over the hips and thighs. */
  apron?: string;
  /** Horizontal stripes across the shirt and sleeves (stripe colour). */
  stripes?: string;
  /** Short pants above the knee: bare legs below the hem (pants is the shorts colour). */
  shortPants?: boolean;
  /** Knee-high socks over bare shins. */
  kneeSocks?: string;
  /** Freckles across the cheek. */
  freckles?: string;
  /** Pharaoh's broad bead collar across the shoulders: [gold, inlay]. */
  usekh?: [string, string];
  /** Pleated linen kilt with a front apron and a belt, over bare legs. */
  kilt?: { color: string; belt: string };
  /** Gold bands on the upper arms and wrists. */
  bracers?: string;
  /** Loose mummy bandages wound round the shins and trailing off the torso. */
  bandages?: string;
  /** Long kohl lines out from the eyes. */
  kohl?: boolean;
  /** Hot-rod flames licking up the shirt hem and sleeves (flame colour; the tips are yellow). */
  flames?: string;
  /** Sunglasses parked on the back of the head (frame colour). */
  shadesBack?: string;
  /** Knee-length shorts: bare shins below a cuff of the pants colour. */
  shorts?: boolean;
  /** Sleeveless basketball jersey (bare arms) with trim and a chest number. `shirt` is ignored. */
  jersey?: { color: string; trim: string; number: string };
  /** Baggy knee-length basketball shorts flaring past the knee, over tall socks (`pants` is the shorts colour). */
  baggyShorts?: boolean;
  /** Sweatband on each wrist. */
  wristband?: string;
  /** High-top sneakers: `boots` is the shoe, this is the side stripe. */
  hiTops?: string;
}

/** Hot-rod flames rising from a hem at y = base across [x0, x1]. */
function flameHem(p: Painter, x0: number, x1: number, base: number, h: number, c: string) {
  for (let x = x0, i = 0; x <= x1; x += 3, i++) {
    const top = base - h + (i % 2 ? 2 : 0) + (i % 3 === 2 ? 1 : 0);
    p.poly([[x - 1.6, base], [x + 0.5, top], [x + 1.6, base]], c, true);
    p.poly([[x - 0.6, base], [x + 0.4, top + 3], [x + 0.8, base]], '#ffd040', true);
  }
}

const OUT = '#100810';

// 3x5 pixel digits for jersey numbers
export const DIGITS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
};
function digits(p: Painter, n: string, x: number, y: number, c: Color) {
  [...n].forEach((d, i) => {
    const g = DIGITS[d];
    if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') p.set(x + i * 4 + (k % 3), y + Math.floor(k / 3), c);
  });
}

function finish(p: Painter, dimmed = false): HTMLCanvasElement {
  const c = p.clone();
  if (dimmed) c.dim(0.32);
  return c.canvas();
}

function torso(L: Look): Painter {
  // 28x42, hip pivot at (13,31), shoulders 24px above it at y=7
  const p = new Painter(28, 42);
  const outer = L.armor ? L.armor.metal : L.bareChest ? L.skin : L.jersey ? L.jersey.color : L.coat ?? L.shirt;
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
  if (L.jersey) {
    // tank top: bare shoulders, trimmed scoop neck and armholes, a number on the chest
    const j = L.jersey;
    p.ellipse(13.5, 7.5, 7.5, 3, L.skin);
    p.poly([[15, 5], [21, 6], [18, 10]], L.skin);
    p.line(8, 9, 14.5, 7, j.trim);
    p.line(15, 6, 18, 10, j.trim);
    p.line(18, 10, 21, 7, j.trim);
    p.line(7, 10, 7, 14, j.trim);
    p.line(20, 11, 21, 15, j.trim);
    p.rect(7, 22, 13, 1, j.trim);
    digits(p, j.number, 12, 13, j.trim);
  }
  if (L.stripes && !L.coat && !L.armor && !L.bareChest)
    for (const y of [8, 12, 16, 20]) p.poly([[4, y], [23, y], [23, y + 2], [4, y + 2]], L.stripes, true);
  if (L.belt) {
    p.rect(7, 23, 13, 2, L.belt);
    if (L.buckle) p.rect(16, 23, 2, 2, L.buckle);
  }
  if (L.chestHair) {
    for (const [x, y] of [[17, 8], [18, 10], [17, 12], [19, 9], [18, 14], [19, 12], [17, 16]]) p.set(x, y, L.chestHair);
  }
  if (L.openCollar && !L.coat && !L.armor) {
    p.poly([[15.5, 5], [21, 5.5], [18, 11.5]], L.skin);
    p.line(15, 5, 18, 12, darken(L.shirt, 0.35));
    p.line(21, 5.5, 18.5, 12, darken(L.shirt, 0.35));
    p.rect(10, 13, 4, 3, darken(L.shirt, 0.12));
    p.rect(17, 13, 3, 3, darken(L.shirt, 0.12));
    for (const y of [14, 18, 22]) p.set(18, y, lighten(L.shirt, 0.5));
  }
  if (L.chefCoat && !L.coat) {
    const fold = darken(L.shirt, 0.18);
    p.rect(14, 4, 7, 2, lighten(L.shirt, 0.3)); // stand-up collar
    p.line(14, 6, 20, 6, fold);
    p.line(20.5, 7, 16, 22, fold); // the crossover flap
    for (const y of [10, 14, 18]) p.set(15, y, L.chefCoat), p.set(19, y, L.chefCoat);
  }
  if (L.apron) {
    p.poly([[6, 24], [20.5, 24], [21, 31], [6.5, 31]], L.apron);
    p.line(6, 23, 20, 23, darken(L.apron, 0.3)); // tie string
  }
  if (L.sash) p.poly([[7, 21], [20, 21], [20, 23], [7, 23]], L.sash);
  if (L.bandolier) p.line(9, 6, 20, 21, L.bandolier), p.line(10, 6, 20, 20, L.bandolier);
  if (L.flames && !L.coat) flameHem(p, 7, 20, 25, 9, L.flames);
  if (L.trunks) {
    p.ellipse(13, 30, 7.5, 4.5, L.trunks.color);
    p.poly([[7, 31], [19, 31], [19.5, 22], [6.5, 22]], L.trunks.color);
    p.rect(7, 22, 13, 2, L.trunks.stripe);
    p.line(18, 24, 18, 33, L.trunks.stripe);
  }
  if (L.kilt) {
    const k = L.kilt.color;
    p.ellipse(13, 31, 8, 5.5, k);
    p.poly([[6.5, 31], [20, 31], [19.5, 22], [6.5, 22]], k);
    p.poly([[13, 24], [19, 24], [21, 35], [15, 37]], lighten(k, 0.08)); // front apron
    for (const x of [9, 11, 16, 18]) p.line(x, 26, x + 0.5, 35, darken(k, 0.18));
    p.rect(6.5, 22, 14, 2, L.kilt.belt);
    p.set(17, 23, lighten(L.kilt.belt, 0.4));
  }
  if (L.bandages) {
    p.line(7, 13, 20, 17, L.bandages);
    p.line(7, 18, 19, 15, darken(L.bandages, 0.15));
    p.poly([[6, 18], [8, 19], [4, 28], [2.5, 27]], L.bandages); // a loose end trailing behind
  }
  if (L.usekh) {
    const [g, inlay] = L.usekh;
    p.ellipse(13.5, 7.5, 8.5, 5, g);
    p.ellipse(15, 8.5, 6.5, 3.5, inlay);
    p.ellipse(15.5, 8, 5, 2.4, g);
    p.ellipse(16, 7, 3.5, 1.5, inlay);
    for (const x of [9, 12, 15, 18, 21]) p.set(x, 11, lighten(g, 0.35));
  }
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
  if (L.hairStyle === 'perm') p.ellipse(8.5, 25, 9.5, 9.5, L.hair);
  if (L.hairStyle === 'blowout') {
    // big bouncy volume behind the head, flipped out above the shoulders
    p.ellipse(8, 25, 9, 9, L.hair);
    p.poly([[0, 28], [7, 27], [8.5, 37], [5, 39.5], [0.5, 38.5], [0, 33]], L.hair);
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
  } else if (L.hairStyle === 'feathered') {
    // big swept-back feathered cut that covers the ears
    p.ellipse(9.5, 24, 7.5, 4.5, L.hair);
    p.poly([[3, 23], [8, 22], [9, 33], [5, 35], [2.5, 30]], L.hair);
    p.poly([[11, 20], [16, 21.5], [16.5, 24], [12, 23.5]], L.hair);
    p.line(5, 22, 12, 20.5, lighten(L.hair, 0.3));
    p.line(4, 26, 6, 31, lighten(L.hair, 0.2));
  } else if (L.hairStyle === 'mop') {
    // thick, full cut with a heavy fringe swept over the brow
    p.ellipse(9.5, 24, 7, 4.5, L.hair);
    p.rect(3, 23, 5, 9, L.hair);
    p.poly([[9, 21], [17, 22.5], [16.5, 26], [12, 25], [10, 24]], L.hair);
    p.line(7, 21, 14, 22, lighten(L.hair, 0.3));
  } else if (L.hairStyle === 'blowout') {
    p.ellipse(10.5, 21.5, 8.5, 5.5, L.hair);
    p.rect(3, 22, 6, 10, L.hair);
    p.poly([[8, 19], [17.5, 22], [18, 26.5], [14, 25], [10, 24]], L.hair); // side-swept fringe
  } else if (L.hairStyle === 'perm') {
    p.ellipse(10, 20.5, 9, 6, L.hair);
    p.rect(3, 22, 5, 9, L.hair);
  } else if (L.hairStyle === 'gelled') {
    // short crop gelled up into spikes that lean forward
    p.ellipse(10, 24, 6.5, 3, L.hair);
    p.rect(4, 23, 4, 5, L.hair);
    for (const [x0, tx, ty, x1] of [[3.5, 5, 19.5, 7], [6, 9.5, 17, 10], [9.5, 13.5, 17.5, 13], [12.5, 17.5, 20.5, 16]])
      p.poly([[x0, 24], [tx, ty], [x1, 23.5]], L.hair);
  } else if (L.hairStyle === 'spiky') {
    // short sides with darker roots, frosted spikes standing straight up and raking forward
    const root = L.beardColor ?? darken(L.hair, 0.35);
    p.ellipse(9.5, 23.5, 7, 3.5, root);
    p.rect(4, 23, 4, 6, root);
    const spikes = [[[3, 25], [2, 16], [7, 22]], [[5, 23], [5.5, 12], [9, 21]], [[8, 22], [10, 10], [12, 21]], [[11, 21], [14.5, 11], [15, 22]], [[13.5, 22], [19, 16], [16.5, 25]]];
    for (const s of spikes) p.poly(s, L.hair);
  } else if (L.hairStyle === 'bald') {
    // a smooth dome: a touch taller skull and nothing on top
    p.ellipse(10.5, 26, 6.2, 5, L.skin);
  } else {
    p.ellipse(10, 24.5, 6.5, 3.5, L.hair);
    p.rect(4, 24, 4, 6, L.hair);
  }
  p.shade(0.18);
  if (L.hairStyle === 'bald') p.line(8, 22, 12, 21.5, lighten(L.skin, 0.4)); // shine on the scalp
  if (L.hairStyle === 'perm') {
    // tight curls
    const hi = lighten(L.hair, 0.3), lo = darken(L.hair, 0.3);
    for (let y = 15; y < 33; y += 2)
      for (let x = (y >> 1) % 2; x < 20; x += 3) {
        const c = p.get(x, y);
        const h = rgb(L.hair);
        if (p.alpha(x, y) && Math.abs(c[0] - h[0]) + Math.abs(c[1] - h[1]) + Math.abs(c[2] - h[2]) < 90) {
          p.set(x, y, hi);
          if (p.alpha(x + 1, y + 1)) p.set(x + 1, y + 1, lo);
        }
      }
  }
  // face details (after shading so they stay crisp)
  p.set(14, 28, L.eye ?? '#1a1010');
  p.set(13, 28, '#e8e0d8');
  p.line(12, 26, 15, 26, darken(L.hair, 0.1));
  p.ellipse(8, 30, 1.2, 1.8, skinD);
  p.line(L.lips ? 13 : 14, 34, 15, 34, L.lips ?? '#5a2a2a');
  if (L.earrings) for (const [x, y] of [[8, 33], [7, 34], [9, 34], [8, 35]]) p.set(x, y, L.earrings);
  if (L.hairStyle === 'blowout') {
    const hl = lighten(L.hair, 0.35);
    p.line(5, 19, 11, 17, hl);
    p.line(12, 19, 16, 22, hl);
    p.line(2, 30, 3, 35, lighten(L.hair, 0.22));
  }
  if (L.freckles) for (const [x, y] of [[12, 30], [14, 31], [16, 30], [11, 32]]) p.set(x, y, L.freckles);
  if (L.mustache) p.poly([[13, 32], [17, 32], [17, 33.5], [12.5, 34]], L.hair);
  if (L.hairStyle === 'spiky') for (const [x, y] of [[2, 16], [6, 13], [10, 11], [14, 12], [18, 16]]) p.set(x, y, lighten(L.hair, 0.5));
  if (L.shadesBack) {
    // wraparound shades worn backwards on the head, arms hooked over the ears
    p.rect(2, 25, 3, 4, L.shadesBack);
    p.set(3, 26, '#a8d8f0');
    p.line(5, 26, 9, 27, L.shadesBack);
  }
  if (L.beard === 'chinstrap') {
    p.poly([[6.5, 30], [8.5, 35], [11, 38], [15.5, 37.5], [16, 35.5], [12.5, 35.5], [9.5, 31], [8.5, 28.5]], L.hair);
  } else if (L.beard === 'full') {
    p.poly([[6.5, 29], [8, 34.5], [10.5, 38.5], [15, 39], [17.5, 36.5], [17.8, 33], [13.5, 33.5], [10, 31.5], [8.5, 28.5]], L.hair);
    p.poly([[12.5, 32], [17.5, 31.5], [17.8, 33.2], [12.5, 33.8]], L.hair);
    p.line(14, 35, 16, 35, '#7a3434');
    const br = lighten(L.hair, 0.25);
    for (const [x, y] of [[9, 33], [11, 36], [14, 37], [16, 36], [12, 34]]) p.set(x, y, br);
  } else if (L.beard === 'braided') {
    p.poly([[6.5, 28], [9, 31], [13, 33], [17.5, 31.5], [17.5, 35], [16, 43], [9, 43], [6, 35]], L.hair);
    p.poly([[12, 31.5], [17.5, 31], [17.5, 32.5], [12, 33]], L.hair);
    const br = lighten(L.hair, 0.25);
    p.line(11, 36, 11, 42, br, true);
    p.line(14, 36, 14, 42, br, true);
    if (L.beardRibbon) for (const [x, y] of [[11, 39], [14, 40], [12, 37]]) p.set(x, y, L.beardRibbon);
    p.set(15, 33, '#5a2a2a');
  } else if (L.beard === 'goatee') {
    // a neat tuft on the chin under the lip
    p.poly([[12.5, 35], [16.5, 35], [16, 38], [14, 40], [12.5, 38.5]], L.hair);
    p.set(14, 34, '#5a2a2a');
  } else if (L.beard === 'vandyke') {
    // chin beard joined to the mustache around the mouth
    const g = L.beardColor ?? L.hair;
    p.poly([[11, 34.5], [12.5, 32], [17.5, 32], [17.5, 36], [15.5, 39.5], [12.5, 39.5], [11, 37]], g);
    p.rect(13, 34, 4, 1, '#5a2a2a');
    p.line(13, 37, 15, 38, lighten(g, 0.25));
  } else if (L.beard === 'pharaoh') {
    // the plaited ceremonial false beard: a narrow column off the chin
    p.poly([[13, 35], [16, 35], [16.5, 42], [13.5, 43]], L.hair);
    for (const y of [37, 39, 41]) p.line(13.5, y, 16, y, L.hatColor ?? L.hair);
  }
  if (L.kohl) {
    p.line(12, 27, 15, 27, '#0a0608');
    p.line(12, 29, 11, 30, '#0a0608');
    p.set(15, 29, '#1a3a8a');
  }
  if (L.glasses) {
    p.rect(11, 26, 6, 4, L.glasses);
    p.rect(12, 27, 4, 2, '#cfe6f0');
    p.set(13, 27, '#ffffff');
    p.line(6, 27, 11, 27, L.glasses);
  }
  if (L.hairStyle === 'gelled') {
    const hl = lighten(L.hair, 0.35);
    p.set(5, 20, hl), p.set(9, 18, hl), p.set(13, 18, hl), p.set(16, 20, hl);
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
  } else if (L.hat === 'beanie') {
    // propeller beanie: bright panels, a little bill and a spinner on top
    const c = L.hatColor ?? '#d83030', c2 = L.hatTrim ?? '#2a6ad8', c3 = '#f0c828';
    p.poly([[2.5, 24.5], [3, 20.5], [6, 17.8], [10.5, 16.6], [15, 17.8], [18, 20.5], [18.5, 24.5]], c);
    p.poly([[2.5, 24.5], [3, 20.5], [6, 17.8], [8.5, 17], [7.5, 24.5]], c2);
    p.poly([[12.5, 17], [15, 17.8], [18, 20.5], [18.5, 24.5], [13.5, 24.5]], c3);
    p.line(3, 24, 18, 24, darken(c, 0.3));
    p.poly([[16, 22.5], [22, 23], [21.5, 25], [16, 25]], c2);
    p.line(10, 15, 10, 16, '#d8d8e0');
    p.line(5, 14, 15, 14, c3);
    p.set(4, 13, c3), p.set(16, 15, c3);
    p.set(10, 14, c);
  } else if (L.hat === 'nemes') {
    // striped royal headcloth: a cap over the skull, a broad flap behind the jaw and a cobra on the brow
    const c = L.hatColor ?? '#d8b040', st = L.hatTrim ?? '#1c3a9a';
    p.poly([[4, 25], [2, 34], [2.5, 43], [9, 43], [9, 33], [8, 27]], c);
    p.ellipse(10, 23, 7.8, 5.8, c);
    p.rect(4, 22, 13, 4, c);
    for (const y of [18, 21, 24]) p.line(3.5, y, 17, y, st);
    for (const y of [28, 31, 34, 37, 40]) p.line(2.5, y, 9, y + 0.5, st);
    p.line(2, 25, 3, 42, darken(c, 0.35));
    p.rect(4, 25, 13, 1, lighten(c, 0.3)); // gold brow band
    // uraeus
    p.rect(15, 19, 2, 5, '#e8c040');
    p.set(17, 19, '#e8c040');
    p.set(16, 20, '#c01818');
  } else if (L.hat === 'horned') {
    // opera-house warrior helmet
    const c = L.hatColor ?? '#a8b0bc';
    const horn = '#ece2c4';
    p.poly([[4, 23], [1, 19], [0, 11], [2.5, 15], [6, 20]], horn);
    p.poly([[17, 23], [20, 19], [21, 11], [18.5, 15], [15, 20]], horn);
    p.line(1, 18, 2, 15, darken(horn, 0.25));
    p.line(20, 18, 19, 15, darken(horn, 0.25));
    p.ellipse(10.5, 21.5, 7.5, 5.5, c);
    p.rect(3, 23, 15, 2, L.hatTrim ?? '#d8b040');
    p.line(10, 16, 10, 22, L.hatTrim ?? '#d8b040');
    p.line(7, 18, 8, 17, lighten(c, 0.4));
  }
  p.outline(OUT);
  return p;
}

function upperArm(L: Look): Painter {
  const p = new Painter(12, 21);
  const bare = L.bareChest || !!L.jersey;
  const c = L.armor ? L.armor.metal : bare ? L.skin : L.coat ?? L.shirt;
  p.capsule(6, 3, 4.6, 6, 15, 3.6, c);
  if (bare) p.line(8, 5, 8, 11, lighten(L.skin, 0.15));
  if (L.stripes && !L.coat && !L.armor) for (const y of [7, 12]) p.poly([[0, y], [12, y], [12, y + 2], [0, y + 2]], L.stripes, true);
  if (L.bracers) p.rect(1.5, 9, 9, 2, L.bracers);
  if (L.flames && !L.coat) flameHem(p, 3, 9, 18, 7, L.flames);
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
  const bare = L.bareChest || !!L.jersey;
  const c = L.armor ? L.armor.metal : bare ? L.skin : L.coat ?? L.shirt;
  p.capsule(6, 3, 3.9, 6, 12, 3.2, c);
  if (L.stripes && !L.coat && !L.armor && !L.rolledSleeves) p.poly([[1, 6], [11, 6], [11, 8], [1, 8]], L.stripes, true);
  const cuff = L.wraps ?? L.coatTrim ?? (L.coat ? L.shirt : darken(c, 0.2));
  if (L.rolledSleeves) {
    p.capsule(6, 3, 3.9, 6, 12, 3.2, L.skin);
    p.rect(1.5, 1, 9, 4, c);
    p.line(2, 4, 9, 4, darken(c, 0.25));
  } else if (L.wristband) p.rect(2, 9, 8, 3, L.wristband);
  else if (!bare || L.wraps) p.rect(2, 11, 8, 2, cuff);
  if (L.bracers) p.rect(2, 8, 8, 3, L.bracers), p.line(2, 9, 9, 9, lighten(L.bracers, 0.35));
  if (L.coil && front) {
    p.rect(2, 4, 8, 7, '#b5652a');
    for (let y = 4; y < 11; y += 2) p.line(2, y, 9, y, '#e8a050');
  }
  if (L.boxingGloves) {
    const g = L.boxingGloves;
    p.rect(2, 10, 8, 3, '#e8e4dc'); // taped cuff
    p.ellipse(6, 16, 5.2, 5.4, g);
    p.ellipse(8.5, 14, 2, 2.4, lighten(g, 0.25));
    p.shade(0.22);
    p.line(2, 19, 7, 20, darken(g, 0.35));
  } else {
    const hand = (front && L.gloveFront) || L.glove || L.skin;
    p.ellipse(6, 16, 3.6, 3.6, hand);
    if (L.wraps) p.rect(3, 14, 6, 2, L.wraps);
    p.shade(0.22);
    p.line(4, 18, 8, 18, darken(hand, 0.3));
    if (front && L.gloveFront) for (const [x, y] of [[5, 15], [7, 17]]) p.set(x, y, '#ffffff'); // sequin glints
  }
  p.outline(OUT);
  return p;
}

function thigh(L: Look): Painter {
  const p = new Painter(14, 25);
  if (L.chair) {
    // hydraulic strut: outer sleeve with a piston rod and a glowing knee joint
    const c = L.chair;
    p.capsule(7, 3, 4.2, 7, 18, 3.2, c.frame);
    p.rect(5, 6, 4, 11, darken(c.frame, 0.35));
    p.line(7, 6, 7, 17, lighten(c.frame, 0.4));
    p.ellipse(7, 20, 3.4, 3.4, c.accent);
    p.shade(0.2);
    p.set(7, 20, c.glow);
    p.outline(OUT);
    return p;
  }
  const c = L.armor ? L.armor.metal : L.shortPants ? L.skin : L.pants;
  if (L.baggyShorts) {
    // baggy leg that flares out past the knee
    p.poly([[1.5, 2], [12.5, 2], [13.5, 23], [0.5, 23]], c);
    p.line(1, 22, 13, 22, darken(c, 0.3));
    if (L.jersey) p.line(11, 3, 12.5, 21, L.jersey.trim);
    p.shade(0.2);
    p.outline(OUT);
    return p;
  }
  p.capsule(7, 3, 5.6, 7, 19, 4.4, c);
  if (L.apron) {
    p.capsule(7, 3, 6, 7, 13, 5.2, L.apron);
    p.line(12, 4, 11, 15, darken(L.apron, 0.25));
  }
  if (L.shortPants) {
    p.capsule(7, 3, 6.2, 7, 10, 5.6, L.pants);
    p.line(2, 14, 12, 14, darken(L.pants, 0.3));
  }
  if (L.trunks) {
    p.capsule(7, 3, 6, 7, 10, 5.4, L.trunks.color);
    p.line(10, 1, 10, 13, L.trunks.stripe);
  }
  if (L.kilt) {
    p.poly([[0.5, 0], [13.5, 0], [13.5, 11], [0.5, 12]], L.kilt.color);
    for (const x of [3, 6, 9, 12]) p.line(x, 2, x, 11, darken(L.kilt.color, 0.18));
  }
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
  if (L.chair) {
    const c = L.chair;
    p.capsule(6, 2, 3, 6, 19, 2.6, lighten(c.frame, 0.15));
    p.line(4, 5, 4, 17, darken(c.frame, 0.3));
    p.rect(3, 10, 6, 2, c.accent);
    p.shade(0.2);
    p.set(6, 11, c.glow);
    p.outline(OUT);
    return p;
  }
  const c = L.armor ? L.armor.metal : L.pants;
  if (L.baggyShorts) {
    // bare calf, tall socks and the collar of a high-top
    p.capsule(6, 2, 4.4, 6, 19, 3.6, L.skin);
    p.rect(2, 11, 8, 6, L.socks ?? '#f0f0f0');
    p.rect(2, 12, 8, 1, L.hiTops ?? darken(L.socks ?? '#f0f0f0', 0.25));
    p.rect(1.5, 17, 9, 6, L.boots);
    p.shade(0.2);
    p.outline(OUT);
    return p;
  }
  p.capsule(6, 2, 4.6, 6, 19, 3.6, L.shorts || L.shortPants ? L.skin : c);
  if (L.shorts) {
    p.rect(1, 0, 10, 5, c);
    p.line(1, 4, 10, 4, darken(c, 0.3));
  }
  if (L.kneeSocks) {
    p.capsule(6, 5, 4.5, 6, 19, 3.7, L.kneeSocks);
    p.rect(1, 4, 10, 2, lighten(L.kneeSocks, 0.25));
    p.rect(1, 7, 10, 1, L.stripes ?? darken(L.kneeSocks, 0.3));
  }
  if (L.tallBoots) {
    p.capsule(6, 6, 4.4, 6, 19, 3.8, L.boots);
    p.rect(1, 5, 10, 3, lighten(L.boots, 0.2));
  } else {
    p.rect(2, 16, 8, 6, L.boots);
    if (L.socks) p.rect(2, 16, 8, 4, L.socks);
  }
  if (L.bandages) for (const y of [5, 9, 13]) p.line(1.5, y + 1.5, 10.5, y, L.bandages), p.line(1.5, y + 2.5, 10.5, y + 1, darken(L.bandages, 0.2));
  p.shade(0.2);
  p.outline(OUT);
  return p;
}

function foot(L: Look): Painter {
  const p = new Painter(16, 10);
  if (L.chair) {
    // three-toed mech claw
    const c = L.chair;
    p.poly([[1, 1], [7, 1], [14, 6], [14, 8], [1, 8]], c.frame);
    p.rect(0, 7, 15, 2, darken(c.frame, 0.4));
    p.set(13, 6, c.glow);
    p.shade(0.2);
    p.outline(OUT);
    return p;
  }
  if (L.hiTops) {
    // big high-top sneaker: chunky sole, toe cap and a swoosh-free side stripe
    p.poly([[0, 0], [7, 0], [14.5, 4], [15, 8], [0, 8]], L.boots);
    p.line(3, 3, 11, 5, L.hiTops);
    p.line(3, 4, 10, 6, L.hiTops);
    p.shade(0.2);
    p.rect(0, 8, 16, 2, '#e8e4dc');
    p.line(0, 9, 15, 9, darken('#e8e4dc', 0.3));
    p.outline(OUT);
    return p;
  }
  p.poly([[1, 1], [7, 1], [13.5, 4.5], [14, 8], [1, 8]], L.boots);
  p.shade(0.2);
  p.line(1, 8, 13, 8, darken(L.boots, 0.5));
  p.outline(OUT);
  return p;
}

/** Seat, backrest and big rear wheel, drawn behind the torso. Pivot = hip. */
function chairBack(L: Look): Painter {
  const c = L.chair!;
  const p = new Painter(38, 46);
  const hx = 18, hy = 26;
  const tire = '#1a1820', rim = lighten(c.frame, 0.25);
  // backrest with push handle and a little antenna beacon
  p.rect(hx - 13, hy - 27, 5, 29, c.frame);
  p.rect(hx - 17, hy - 27, 5, 2, c.frame);
  p.rect(hx - 12, hy - 24, 3, 22, c.accent);
  p.line(hx - 11, hy - 27, hx - 11, hy - 33, darken(c.frame, 0.2));
  p.ellipse(hx - 11, hy - 34, 1.6, 1.6, c.glow);
  // seat
  p.rect(hx - 12, hy, 26, 4, c.accent);
  p.rect(hx - 12, hy + 3, 26, 2, c.frame);
  // rear wheel
  const wx = hx - 2, wy = hy + 6;
  p.ellipse(wx, wy, 11, 11, tire);
  p.ellipse(wx, wy, 9, 9, rim);
  p.ellipse(wx, wy, 7.5, 7.5, darken(c.frame, 0.5));
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4;
    p.line(wx, wy, wx + Math.cos(t) * 7, wy + Math.sin(t) * 7, rim);
  }
  p.ellipse(wx, wy, 2.6, 2.6, c.accent);
  p.set(wx, wy, c.glow);
  p.shade(0.18);
  p.outline(OUT);
  return p;
}

/** Seated legs, footrest and the armrest console, drawn in front of the torso. Pivot = hip. */
function chairFront(L: Look): Painter {
  const c = L.chair!;
  const p = new Painter(36, 34);
  const hx = 10, hy = 12;
  p.line(hx + 2, hy + 4, hx + 14, hy + 19, c.frame);
  p.line(hx + 3, hy + 4, hx + 15, hy + 19, c.frame);
  p.rect(hx + 10, hy + 18, 13, 2, lighten(c.frame, 0.15));
  p.capsule(hx, hy, 4.6, hx + 14, hy + 1, 4, L.pants);
  p.capsule(hx + 14, hy + 1, 3.8, hx + 15, hy + 13, 3.2, L.pants);
  p.poly([[hx + 12, hy + 13], [hx + 17, hy + 13], [hx + 22, hy + 16], [hx + 22, hy + 18], [hx + 12, hy + 18]], L.boots);
  // armrest with a glowing control console
  p.rect(hx - 8, hy - 6, 20, 2, c.frame);
  p.line(hx + 9, hy - 4, hx + 9, hy + 1, c.frame);
  p.rect(hx + 8, hy - 11, 8, 5, darken(c.frame, 0.3));
  p.rect(hx + 9, hy - 10, 6, 3, '#103020');
  p.shade(0.18);
  p.set(hx + 10, hy - 9, c.glow);
  p.set(hx + 12, hy - 9, c.glow);
  p.set(hx + 13, hy - 8, c.glow);
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
    ...(L.chair ? { chair: part(chairBack(L), 18, 26), chairF: part(chairFront(L), 10, 12) } : {}),
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
