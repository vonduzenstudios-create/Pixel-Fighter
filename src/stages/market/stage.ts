import { FLOOR, H, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { drawText } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { Fighter } from '../../game/fighter';
import type { Particles } from '../../game/particles';
import type { PitLanding } from '../../game/stages';

// "Thriftopia Mart": a late-night discount supermarket. A produce stand, three long shelving
// units split by aisle mouths, a can pyramid on the floor and the checkout at the far end.
// Every product on the shelves is simulated: hits, bodies flying into the shelves and hard
// landings knock them off, and they fall, bounce, roll, smash and get kicked around the floor.
// The store and every brand on the shelves are made up. All painted at load time.

const SW = 704;
const BACK_W = W + Math.ceil((SW - W) * 0.35);
/** Top surface of each shelf board on the gondola units, top to bottom. */
const SHELVES = [84, 108, 132, 156, 182];
const GONDOLA_TOP = 62;
const UNITS: [number, number, string, Kind[]][] = [
  [120, 256, 'CEREAL & SNACKS', ['chips', 'cereal', 'cereal2', 'tp', 'tp']],
  [300, 436, 'SODA & CANNED', ['pop', 'soda', 'beans', 'sauce', 'beans']],
  [480, 616, 'DAIRY & PANTRY', ['jar', 'eggs', 'milk', 'sauce', 'milk']],
];
/** Aisle mouths between the units, with their hanging aisle numbers. */
const GAPS: [number, number, string][] = [[256, 300, '4'], [436, 480, '5']];
const PRODUCE_X1 = 112;
const CHECK_X0 = 624;

// house colours: a supermarket's cheerful lime and tomato red over cream
const LIME = '#58c040', TOMATO = '#e8402c', CREAM = '#f4ecd4', NAVY = '#1c2a5a', SUN = '#ffd030';

const PRODUCTS = [TOMATO, SUN, LIME, '#4a90e0', '#ffffff', '#e870a8', '#f08a20', '#7a38c0', '#5a2a10'];

type Kind = 'soda' | 'pop' | 'beans' | 'cereal' | 'cereal2' | 'chips' | 'milk' | 'jar' | 'eggs' | 'sauce' | 'tp' | 'apple' | 'orange' | 'melon' | 'banana';

interface KindDef {
  w: number; h: number;
  /** Bounciness off the floor. */
  bounce: number;
  /** Rolls along the floor instead of sliding to a stop. */
  round?: boolean;
  /** Smashes when it lands faster than this. */
  frag?: number;
  /** What it splatters when it smashes. */
  goo?: string[];
  glass?: boolean;
  /** Cans clank, boxes thump, soft things barely make a sound. */
  snd: 'can' | 'box' | 'soft';
  /** Sprite variants. */
  vars: number;
}

const KINDS: Record<Kind, KindDef> = {
  soda: { w: 4, h: 7, bounce: 0.45, round: true, snd: 'can', vars: 3 },
  pop: { w: 4, h: 11, bounce: 0.4, snd: 'soft', vars: 2 },
  beans: { w: 5, h: 6, bounce: 0.35, round: true, snd: 'can', vars: 2 },
  cereal: { w: 7, h: 11, bounce: 0.2, snd: 'box', vars: 1 },
  cereal2: { w: 7, h: 11, bounce: 0.2, snd: 'box', vars: 1 },
  chips: { w: 7, h: 9, bounce: 0.5, snd: 'soft', vars: 3 },
  milk: { w: 6, h: 9, bounce: 0.15, frag: 5.5, goo: ['#ffffff', '#e8eef8'], snd: 'soft', vars: 2 },
  jar: { w: 5, h: 7, bounce: 0.2, frag: 3, goo: ['#88b030', '#a8c840', '#6a9020'], glass: true, snd: 'can', vars: 1 },
  eggs: { w: 10, h: 4, bounce: 0.1, frag: 2.6, goo: ['#ffd030', '#fff4c0', '#ffb820'], snd: 'soft', vars: 1 },
  sauce: { w: 3, h: 9, bounce: 0.35, frag: 6, goo: ['#d82818', '#b01808'], snd: 'soft', vars: 2 },
  tp: { w: 8, h: 8, bounce: 0.55, snd: 'soft', vars: 2 },
  apple: { w: 3, h: 3, bounce: 0.35, round: true, snd: 'soft', vars: 2 },
  orange: { w: 4, h: 4, bounce: 0.4, round: true, snd: 'soft', vars: 1 },
  melon: { w: 9, h: 7, bounce: 0.15, round: true, frag: 4.2, goo: ['#e83848', '#ff6070', '#2a1810'], snd: 'box', vars: 1 },
  banana: { w: 6, h: 3, bounce: 0.25, snd: 'soft', vars: 1 },
};

/** Draw one product into a w x h painter. Tiny, but each reads as itself. */
function paintItem(k: Kind, v: number): HTMLCanvasElement {
  const d = KINDS[k];
  const p = new Painter(d.w, d.h);
  switch (k) {
    case 'soda': {
      // Bubblo Cola, Fizzer Lime and Grape Gush
      const c = ['#d82020', '#48b830', '#7a38c0'][v];
      p.rect(0, 1, 4, 5, c);
      p.rect(0, 0, 4, 1, '#c8ccd4');
      p.rect(0, 6, 4, 1, '#9aa0a8');
      p.rect(0, 3, 4, 1, '#ffffff');
      p.set(0, 1, lighten(c, 0.4));
      break;
    }
    case 'pop': {
      // a two-litre bottle with a label band
      const c = ['#5a2a10', '#60c840'][v];
      p.rect(1, 0, 2, 2, v ? '#ffffff' : '#d82020');
      p.rect(1, 2, 2, 1, c);
      p.rect(0, 3, 4, 8, c);
      p.rect(0, 5, 4, 3, v ? '#ffffff' : '#d82020');
      p.set(0, 3, lighten(c, 0.5));
      break;
    }
    case 'beans': {
      // Beanzo baked beans, and Tom-A-Toe soup
      const c = v ? '#e83828' : '#f08a20';
      p.rect(0, 1, 5, 4, c);
      p.rect(0, 0, 5, 1, '#c8ccd4');
      p.rect(0, 5, 5, 1, '#9aa0a8');
      p.rect(1, 2, 3, 2, v ? '#ffffff' : '#6a3010');
      break;
    }
    case 'cereal': {
      // Krunch-O's: a yellow box with a red ring and a burst
      p.rect(0, 0, 7, 11, '#ffc820');
      p.rect(0, 0, 7, 2, '#e83020');
      p.ellipse(3.5, 6, 2.2, 2.2, '#e83020');
      p.ellipse(3.5, 6, 1, 1, '#ffc820');
      p.rect(6, 0, 1, 11, '#c89810');
      break;
    }
    case 'cereal2': {
      // Choco Moons: purple box, a crescent and stars
      p.rect(0, 0, 7, 11, '#5a2a90');
      p.rect(0, 0, 7, 2, '#ffd030');
      p.ellipse(3, 6, 2.2, 2.2, '#f0e0a0');
      p.ellipse(4, 5.5, 1.8, 1.8, '#5a2a90');
      p.set(5, 8, '#ffffff');
      p.set(1, 3, '#ffffff');
      p.rect(6, 0, 1, 11, '#3a1868');
      break;
    }
    case 'chips': {
      // Crunchlers in three flavours: a puffy foil bag with crimped ends
      const c = ['#e83020', '#2a70d8', '#38a830'][v];
      p.rect(0, 1, 7, 7, c);
      for (let x = 0; x < 7; x += 2) { p.set(x, 0, c); p.set(x, 8, c); }
      p.ellipse(3.5, 4.5, 2, 1.6, SUN);
      p.set(1, 2, lighten(c, 0.5));
      p.rect(6, 1, 1, 7, darken(c, 0.25));
      break;
    }
    case 'milk': {
      p.rect(0, 2, 6, 7, '#f4f8ff');
      p.rect(1, 1, 3, 1, '#f4f8ff');
      p.rect(2, 0, 2, 1, v ? '#e83030' : '#2a60d8');
      p.rect(4, 2, 2, 3, '#c8d0e0');
      p.rect(0, 5, 6, 2, v ? '#e83030' : '#2a60d8');
      p.rect(5, 2, 1, 7, '#c8d0e0');
      break;
    }
    case 'jar': {
      p.rect(0, 0, 5, 2, '#d8b040');
      p.rect(0, 2, 5, 5, '#3a6a20');
      p.rect(1, 3, 1, 3, '#88c050');
      p.rect(3, 2, 1, 4, '#5a9030');
      p.rect(0, 4, 5, 2, '#f4ecd4');
      p.set(0, 2, '#c0e8a0');
      break;
    }
    case 'eggs': {
      p.rect(0, 1, 10, 3, '#d8ccb0');
      for (let x = 1; x < 10; x += 2) p.set(x, 0, '#e8dcc0');
      p.rect(0, 3, 10, 1, '#b8a888');
      p.rect(3, 1, 4, 2, '#4a8ad8');
      break;
    }
    case 'sauce': {
      const c = v ? '#e8b018' : '#d82818';
      p.rect(1, 0, 1, 2, '#ffffff');
      p.rect(0, 2, 3, 7, c);
      p.rect(0, 4, 3, 2, '#ffffff');
      p.set(0, 2, lighten(c, 0.4));
      break;
    }
    case 'tp': {
      // a pack of Fluffies, four rolls in plastic
      p.rect(0, 0, 8, 8, '#f8f8f4');
      p.rect(0, 3, 8, 2, v ? '#e870a8' : '#58a8e8');
      p.rect(4, 0, 1, 8, '#d8d8d0');
      p.rect(0, 4, 8, 0, '#d8d8d0');
      p.rect(7, 0, 1, 8, '#c8c8c0');
      break;
    }
    case 'apple':
      p.ellipse(1.5, 1.5, 1.6, 1.6, v ? '#58b830' : '#d82830');
      p.set(0, 0, v ? '#a8e880' : '#ff8070');
      break;
    case 'orange':
      p.ellipse(2, 2, 2, 2, '#ff9820');
      p.set(1, 1, '#ffd080');
      p.set(3, 3, '#d87010');
      break;
    case 'melon':
      p.ellipse(4.5, 3.5, 4.5, 3.5, '#2a8a30');
      for (let x = 1; x < 9; x += 2) for (let y = 0; y < 7; y++) if (p.alpha(x, y)) p.set(x, y, '#58b848');
      p.set(2, 1, '#a8e890');
      break;
    case 'banana':
      p.rect(1, 1, 4, 1, '#ffe040');
      p.set(0, 0, '#5a4018');
      p.set(5, 0, '#ffe040');
      p.rect(1, 2, 4, 1, '#d8b020');
      break;
  }
  return p.canvas();
}

interface Item {
  k: Kind; v: number;
  /** x is the centre, y the bottom edge, both in world/screen px. */
  x: number; y: number;
  vx: number; vy: number;
  rot: number; vr: number;
  /** 0 = sitting on display, 1 = in flight, 2 = lying on the floor. */
  st: 0 | 1 | 2;
  /** 0 = behind the fighters, 1 = scattered in front of them. */
  z: 0 | 1;
  /** Displayed items stacked on these fall when any of them goes. */
  sup: Item[];
  wob: number;
  dead: boolean;
  /** A shaken two-litre bottle rockets around while this counts down. */
  fizz: number;
}

interface Splat { x: number; w: number; c: string; z: 0 | 1 }
interface Glow { x: number; y: number; r: number; col: string; ph: number }

const hexA = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---------------------------------------------------------------- sounds
function clank(v: number) {
  tone({ type: 'square', freq: rand(900, 1300), to: rand(500, 700), dur: 0.06, vol: 0.05 * v, filter: { type: 'bandpass', freq: 2200, q: 3 } });
  noise({ dur: 0.05, vol: 0.06 * v, type: 'highpass', freq: 3000 });
}
function thump(v: number) {
  tone({ type: 'sine', freq: 140, to: 70, dur: 0.08, vol: 0.12 * v });
  noise({ dur: 0.06, vol: 0.05 * v, type: 'lowpass', freq: 900 });
}
function smash(glass: boolean) {
  if (glass) {
    for (let i = 0; i < 3; i++) noise({ dur: 0.12, vol: 0.12, type: 'highpass', freq: 3500 + i * 1500, at: undefined });
    tone({ type: 'triangle', freq: 2600, to: 1800, dur: 0.15, vol: 0.05 });
  } else {
    noise({ dur: 0.18, vol: 0.2, type: 'bandpass', freq: 700, to: 300, q: 1.5 });
    tone({ type: 'sine', freq: 120, to: 60, dur: 0.1, vol: 0.12 });
  }
}
function hiss() {
  noise({ dur: 0.6, vol: 0.1, type: 'highpass', freq: 4000, to: 6000 });
}

// ---------------------------------------------------------------- painting
/** The back wall above the shelves: department signs and the store's name. Parallax layer. */
function backWall(glows: Glow[]): HTMLCanvasElement {
  const p = new Painter(BACK_W, H);
  for (let y = 0; y < 100; y++)
    for (let x = 0; x < BACK_W; x++) p.set(x, y, y < 46 ? (bayer(x, y) < 0.06 ? '#f8f0dc' : CREAM) : y < 50 ? LIME : bayer(x, y) < 0.1 ? '#e0d8c0' : '#ece4cc');
  p.rect(0, 50, BACK_W, 2, '#3a8a28');
  const depts: [string, string][] = [['PRODUCE', LIME], ['BAKERY', '#c87830'], ['THRIFTOPIA MART', TOMATO], ['DELI', '#e8a020'], ['DAIRY', '#5a7ad8']];
  const step = BACK_W / depts.length;
  depts.forEach(([, c], i) => {
    const cx = Math.round(step * (i + 0.5));
    const hw = i === 2 ? 52 : 26;
    p.rect(cx - hw, 20, hw * 2, 16, darken(c, 0.35));
    p.rect(cx - hw + 1, 21, hw * 2 - 2, 14, c);
    if (i === 2) p.rect(cx - hw + 1, 32, hw * 2 - 2, 3, SUN);
    glows.push({ x: cx, y: 29, r: 26, col: '#fff4d0', ph: i * 1.7 });
  });
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  depts.forEach(([name], i) => drawText(ctx, name, Math.round(step * (i + 0.5)), 24, '#ffffff', { align: 'center' }));
  return cv;
}

/** One receding aisle seen through a gap between two shelving units. */
function aisleMouth(p: Painter, x0: number, x1: number) {
  const cx = (x0 + x1) / 2, vy = 120;
  // far end wall and the floor running away
  for (let y = 40; y < FLOOR; y++)
    for (let x = x0; x < x1; x++) {
      if (y < vy) p.set(x, y, mix('#e0d8c0', '#b8b098', (y - 40) / 80));
      else {
        const t = (y - vy) / (FLOOR - vy);
        const lane = Math.floor((x - cx) / (t * 9 + 1));
        p.set(x, y, (lane + Math.floor(Math.sqrt(t) * 10)) % 2 ? '#e8e0cc' : '#cfc6ae');
      }
    }
  // shelves receding on both sides, shrinking toward the far end, stacked with tiny products
  for (const side of [-1, 1]) {
    const edge = side < 0 ? x0 : x1 - 1, len = Math.abs(edge - cx) - 3;
    for (let i = 0; i <= len; i++) {
      const t = i / len, x = edge - side * i;
      const top = Math.round(GONDOLA_TOP + (vy - 24 - GONDOLA_TOP) * t), bot = Math.round(FLOOR - (FLOOR - vy - 4) * t);
      const rows = 5, rh = (bot - top) / rows;
      const seg = Math.floor(i / Math.max(2, 5 - t * 4));
      for (let y = top; y < bot; y++) {
        const k = (y - top) / rh, row = Math.floor(k);
        // runs of the same product, a shelf lip under each row, the upright at the near end
        const pick = ((seg * 7 + row * 13 + (side > 0 ? 5 : 0)) * 2654435761) >>> 0;
        let c: Color = k % 1 > 0.82 ? '#e8eaee' : k % 1 < 0.2 ? '#5a5c68' : PRODUCTS[pick % PRODUCTS.length];
        if (i < 2) c = '#7a7c84';
        else if (bayer(x, y) < 0.12) c = darken(c, 0.15);
        p.set(x, y, mix(c, '#c8c0a8', t * 0.7));
      }
    }
  }
}

function store(glows: Glow[], lights: number[]): HTMLCanvasElement {
  const p = new Painter(SW, H);
  const r = rng(1301);
  // drop ceiling and long fluorescent runs; the wall band between ceiling and shelves is left
  // transparent so the parallax back wall shows through
  p.rect(0, 0, SW, 14, '#e4e0d4');
  for (let x = 0; x < SW; x += 24) p.rect(x, 0, 1, 14, '#b8b4a8');
  p.rect(0, 7, SW, 1, '#b8b4a8');
  p.rect(0, 13, SW, 2, '#8a867c');
  for (let lx = 16; lx < SW; lx += 72) {
    p.rect(lx, 3, 44, 4, '#fbfff8');
    p.rect(lx, 6, 44, 1, '#c8d8c8');
    lights.push(lx + 22);
  }
  // aisle mouths
  for (const [x0, x1] of GAPS) aisleMouth(p, x0, x1);
  // the gondola units: steel uprights, peg-board back, shelf boards with price-tag strips
  for (const [x0, x1] of UNITS) {
    for (let y = GONDOLA_TOP; y < FLOOR; y++)
      for (let x = x0; x < x1; x++) p.set(x, y, (x % 4 === 2 && y % 4 === 2) ? '#a8aab0' : bayer(x, y) < 0.08 ? '#d8dade' : '#c8cad0');
    // header sign
    p.rect(x0, GONDOLA_TOP - 2, x1 - x0, 16, NAVY);
    p.rect(x0, GONDOLA_TOP - 2, x1 - x0, 1, '#4a5a9a');
    p.rect(x0, GONDOLA_TOP + 13, x1 - x0, 2, SUN);
    for (const sy of SHELVES) {
      p.rect(x0, sy, x1 - x0, 4, '#e8eaee');
      p.rect(x0, sy + 3, x1 - x0, 1, '#8a8c94');
      // yellow price-tag strip with little tags
      p.rect(x0, sy + 1, x1 - x0, 2, SUN);
      for (let tx = x0 + 4; tx < x1 - 6; tx += 12 + r.int(0, 6)) p.rect(tx, sy + 1, 4, 2, r.next() < 0.3 ? TOMATO : '#ffffff');
    }
    p.rect(x0, 186, x1 - x0, FLOOR - 186, '#3a3c44'); // kick plate
    p.rect(x0, 186, x1 - x0, 1, '#60626a');
    for (const ux of [x0, x1 - 3]) {
      p.rect(ux, GONDOLA_TOP + 12, 3, FLOOR - GONDOLA_TOP - 12, '#7a7c84');
      p.rect(ux, GONDOLA_TOP + 12, 1, FLOOR - GONDOLA_TOP - 12, '#a8aab0');
    }
    // end-cap ad posters hung on the uprights
    glows.push({ x: (x0 + x1) / 2, y: GONDOLA_TOP + 5, r: 46, col: '#c0d0ff', ph: x0 });
  }
  // ---- produce stand at the far left: green awning, misters, two tiers of wooden bins
  for (let y = 40; y < FLOOR; y++) for (let x = 0; x < PRODUCE_X1 + 6; x++) p.set(x, y, bayer(x, y) < 0.08 ? '#3a7a30' : '#2e6a26');
  for (let x = 0; x < PRODUCE_X1 + 8; x++) for (let y = 40; y < 52; y++) p.set(x, y, Math.floor(x / 8) % 2 ? '#ffffff' : LIME);
  for (let x = 0; x < PRODUCE_X1 + 8; x += 8) p.ellipse(x + 4, 52, 4, 2, Math.floor(x / 8) % 2 ? '#ffffff' : LIME);
  p.rect(0, 62, PRODUCE_X1 + 6, 2, '#a8b0b8');
  for (let x = 6; x < PRODUCE_X1; x += 14) p.rect(x, 64, 1, 2, '#d8e8f8');
  // a hanging scale
  p.rect(84, 52, 1, 30, '#8a8c94');
  p.ellipse(84, 86, 7, 7, '#e8eaee');
  p.ellipse(84, 86, 5, 5, '#ffffff');
  p.rect(84, 82, 1, 4, TOMATO);
  p.poly([[74, 96], [94, 96], [90, 100], [78, 100]], '#c8cad0');
  for (const [top, x0, x1] of [[150, 4, PRODUCE_X1], [176, 0, PRODUCE_X1 + 4]] as const) {
    p.rect(x0, top, x1 - x0, 3, '#8a5a30');
    for (let y = top + 3; y < (top === 150 ? 176 : FLOOR); y++)
      for (let x = x0; x < x1; x++) p.set(x, y, (y - top) % 6 === 5 ? '#5a3418' : bayer(x, y) < 0.15 ? '#b07a44' : '#9a6a3a');
  }
  // ---- checkout at the far right: windows onto the night lot, the lane, a register
  for (let y = 40; y < 150; y++) for (let x = CHECK_X0 - 6; x < SW; x++) p.set(x, y, mix('#101838', '#2a2a50', (y - 40) / 110));
  for (let i = 0; i < 20; i++) p.set(r.int(CHECK_X0, SW - 2), r.int(42, 80), '#fff4d0');
  for (let x = CHECK_X0 - 6; x < SW; x += 26) p.rect(x, 40, 3, 110, '#9aa0a8');
  p.rect(CHECK_X0 - 6, 40, SW - CHECK_X0 + 6, 3, '#9aa0a8');
  for (let lx = CHECK_X0 + 8; lx < SW; lx += 40) {
    p.rect(lx, 110, 2, 40, '#3a3448');
    glows.push({ x: lx + 1, y: 112, r: 20, col: '#ffb860', ph: lx });
  }
  p.rect(CHECK_X0 - 6, 150, SW - CHECK_X0 + 6, 48, '#2a2a34');
  p.rect(CHECK_X0 - 6, 150, SW - CHECK_X0 + 6, 2, '#5a5a68');
  for (let x = CHECK_X0 - 6; x < SW; x += 3) p.rect(x, 152, 1, 3, '#3e3e4a');
  p.rect(CHECK_X0 - 6, 155, SW - CHECK_X0 + 6, 43, TOMATO);
  p.rect(CHECK_X0 - 6, 176, SW - CHECK_X0 + 6, 3, SUN);
  p.rect(CHECK_X0 + 34, 128, 26, 22, '#3a3a48');
  p.rect(CHECK_X0 + 36, 130, 22, 8, '#60ff90');
  p.rect(CHECK_X0 + 40, 140, 14, 8, '#202028');
  // lane light on its pole
  p.rect(CHECK_X0 + 14, 70, 2, 80, '#9aa0a8');
  p.rect(CHECK_X0 + 6, 62, 18, 10, '#101018');
  p.rect(CHECK_X0 + 7, 63, 16, 8, '#60ff60');
  glows.push({ x: CHECK_X0 + 15, y: 67, r: 22, col: '#60ff60', ph: 3 });
  // a parked shopping cart in the second aisle mouth
  const cx = 446;
  for (let y = 0; y < 18; y++) for (let x = 0; x < 26; x++) if ((x + y) % 3 === 0 || y === 0 || x === 0 || x === 25) p.set(cx + x - Math.floor(y * 0.2), 166 + y, '#b8c0c8');
  p.rect(cx + 24, 160, 2, 8, '#b8c0c8');
  p.rect(cx + 22, 158, 8, 2, TOMATO);
  p.rect(cx - 2, 184, 26, 2, '#8a9098');
  for (const wx of [cx, cx + 20]) p.ellipse(wx, 193, 2.5, 2.5, '#202024');
  // ---- floor: speckled vinyl tile in cream and sage, with a waxed shine
  for (let y = FLOOR; y < H; y++) {
    const row = y - FLOOR;
    const sz = 10 + Math.floor(row / 4) * 2;
    for (let x = 0; x < SW; x++) {
      const on = (Math.floor(x / sz) + Math.floor(row / 7)) % 2 === 0;
      let c: Color = on ? '#ece6d4' : '#b8c8a8';
      const n = (x * 7919 + y * 104729) % 97;
      if (n < 4) c = darken(c, 0.25);
      else if (n < 7) c = lighten(c, 0.3);
      if (bayer(x, y) < 0.06) c = lighten(c, 0.15);
      p.set(x, y, c);
    }
  }
  p.rect(0, FLOOR, SW, 1, '#ffffff');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  for (const [x0, x1, label] of UNITS) drawText(ctx, label, (x0 + x1) / 2, GONDOLA_TOP + 2, '#ffffff', { align: 'center' });
  drawText(ctx, 'FRESH PRODUCE', PRODUCE_X1 / 2 + 2, 70, '#ffffff', { align: 'center', outline: '#1a4a18' });
  drawText(ctx, 'LANE 1', CHECK_X0 + 46, 158, '#ffffff', { align: 'center' });
  drawText(ctx, 'THRIFTOPIA', CHECK_X0 + 40, 182, NAVY, { align: 'center' });
  // hanging aisle number signs in the gaps
  for (const [x0, x1, n] of GAPS) {
    const mx = (x0 + x1) / 2;
    ctx.fillStyle = '#8a8c94';
    ctx.fillRect(mx - 8, 14, 1, 10);
    ctx.fillRect(mx + 7, 14, 1, 10);
    ctx.fillStyle = NAVY;
    ctx.fillRect(mx - 12, 24, 24, 16);
    ctx.fillStyle = SUN;
    ctx.fillRect(mx - 12, 38, 24, 2);
    drawText(ctx, n, mx, 28, '#ffffff', { align: 'center' });
  }
  return cv;
}

// ---------------------------------------------------------------- the stockroom finish
/** Through the floor into the stockroom, under an overloaded pallet rack of canned goods. */
function stockroom(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1327);
  // cinderblock walls under caged work lights
  for (let y = 0; y < 156; y++)
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 8), off = row % 2 ? 8 : 0;
      const mortar = y % 8 === 0 || (x + off) % 16 === 0;
      p.set(x, y, mortar ? '#5a5a62' : bayer(x, y) < 0.15 + y / 600 ? '#7a7a84' : '#8a8a94');
    }
  // the busted floor above, light pouring through the hole
  p.rect(0, 0, W, 8, '#3a3a42');
  p.rect(96, 0, 64, 8, '#f8f0d0');
  for (let x = 92; x < 164; x += 3) p.rect(x, 7 + r.int(0, 3), 2, 2, '#3a3a42');
  // pallet racks down both sides, piled with cardboard cases
  for (const [x0, x1] of [[0, 72], [184, W]]) {
    for (const ry of [40, 92, 144]) {
      p.rect(x0, ry, x1 - x0, 4, '#e86820');
      p.rect(x0, ry + 4, x1 - x0, 1, '#a04010');
      for (let bx = x0 + 2; bx < x1 - 12; bx += r.int(14, 20)) {
        const bw = r.int(11, 15), bh = r.int(12, 22);
        p.rect(bx, ry - bh, bw, bh, '#c89a60');
        p.rect(bx, ry - bh, bw, 1, '#e0b880');
        p.rect(bx + bw - 1, ry - bh, 1, bh, '#9a7040');
        p.rect(bx + 2, ry - bh + 4, bw - 4, 2, r.pick([TOMATO, NAVY, LIME]));
      }
    }
    for (const ux of [x0 + 2, x1 - 5]) p.rect(ux, 0, 3, 156, '#2a50b0');
  }
  // an EMPLOYEES ONLY door and a hazard-striped dock
  p.rect(96, 92, 64, 64, '#5a6a7a');
  p.rect(98, 94, 60, 62, '#6a7a8a');
  for (let x = 98; x < 158; x++) for (let y = 148; y < 156; y++) p.set(x, y, Math.floor((x + y) / 4) % 2 ? SUN : '#101018');
  // concrete floor and the pallet the loser lands on
  for (let y = 156; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, bayer(x, y) < 0.2 + (y - 156) / 200 ? '#5a5a60' : '#6a6a70');
  for (let i = 0; i < 6; i++) p.ellipse(r.int(10, W - 10), r.int(162, 220), r.int(6, 14), 2, '#4a4a50');
  p.rect(70, 150, 116, 3, '#c8a060');
  p.rect(70, 153, 116, 3, '#8a6a3a');
  for (let x = 72; x < 186; x += 22) p.rect(x, 153, 6, 4, '#c8a060');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  drawText(ctx, 'EMPLOYEES', 128, 100, '#ffffff', { align: 'center' });
  drawText(ctx, 'ONLY', 128, 110, '#ffffff', { align: 'center' });
  return cv;
}

interface PitCan { x: number; y: number; vy: number; vx: number; rot: number; vr: number; k: Kind; v: number; rest: boolean }

const HURT_STATES = new Set(['hitstun', 'launched', 'fall', 'thrown']);

export class SupermarketStage {
  name = 'THRIFTOPIA MART';
  blurb = 'CLEANUP ON EVERY AISLE';
  song: SongName = 'market';
  width = SW;
  backGlows: Glow[] = [];
  glows: Glow[] = [];
  lights: number[] = [];
  back = backWall(this.backGlows);
  room = store(this.glows, this.lights);
  pit = stockroom();
  sprites = Object.fromEntries((Object.keys(KINDS) as Kind[]).map((k) => [k, Array.from({ length: KINDS[k].vars }, (_, v) => paintItem(k, v))])) as Record<Kind, HTMLCanvasElement[]>;
  items: Item[] = [];
  splats: Splat[] = [];
  prev = new Map<Fighter, { x: number; y: number; hp: number; state: string }>();
  fx: Particles | null = null;
  /** Frames until the next clatter sound may play, so a landslide doesn't deafen anyone. */
  sndCd = 0;
  pitCans: PitCan[] = [];
  pitHm: number[] = [];
  pitLanding: PitLanding;

  constructor() {
    this.pitLanding = this.makeLanding();
    this.reset();
  }

  /** Restock every shelf, rebuild the can pyramid and the fruit piles, and mop the floor. */
  reset() {
    const r = rng(1361);
    this.items = [];
    this.splats = [];
    this.prev.clear();
    const add = (k: Kind, x: number, y: number, v = 0, sup: Item[] = []) => {
      const it: Item = { k, v, x, y, vx: 0, vy: 0, rot: 0, vr: 0, st: 0, z: 0, sup, wob: 0, dead: false, fizz: 0 };
      this.items.push(it);
      return it;
    };
    // shelves: one product line per shelf, faced up neatly with a few gaps where it's sold out
    for (const [x0, x1, , tiers] of UNITS)
      tiers.forEach((k, ti) => {
        const d = KINDS[k];
        for (let x = x0 + 5; x + d.w < x1 - 4; x += d.w + 1) {
          if (r.next() < 0.06) { x += d.w; continue; }
          add(k, x + d.w / 2, SHELVES[ti], r.int(0, d.vars - 1));
        }
      });
    // a pyramid of Beanzo cans on the floor in the first aisle mouth, every can resting on two
    const base = 7, cw = 6, px = (GAPS[0][0] + GAPS[0][1]) / 2;
    let below: Item[] = [];
    for (let row = 0; row < base; row++) {
      const n = base - row, cur: Item[] = [];
      for (let i = 0; i < n; i++) cur.push(add('beans', px + (i - (n - 1) / 2) * cw, FLOOR - row * 6, row % 2, row ? [below[i], below[i + 1]] : []));
      below = cur;
    }
    // produce: piles of fruit in the bins, upper rows resting on the fruit beneath
    const pile = (k: Kind, x0: number, x1: number, top: number, rows: number, v = () => 0) => {
      const d = KINDS[k];
      let prevRow: Item[] = [];
      for (let row = 0; row < rows; row++) {
        const cur: Item[] = [];
        const inset = row * (d.w / 2 + 0.5);
        for (let x = x0 + inset; x + d.w <= x1 - inset; x += d.w + 1) {
          const cx = x + d.w / 2;
          const sup = prevRow.filter((s) => Math.abs(s.x - cx) <= d.w);
          if (row && !sup.length) continue;
          cur.push(add(k, cx, top - row * d.h, v(), sup));
        }
        prevRow = cur;
      }
    };
    pile('apple', 6, 36, 150, 3, () => r.int(0, 1));
    pile('orange', 38, 70, 150, 3);
    pile('banana', 72, 108, 150, 2);
    pile('melon', 2, 60, 176, 2);
    pile('apple', 62, 114, 176, 3, () => 1);
  }

  makeLanding(): PitLanding {
    return {
      pose: P(LIE, {}),
      rest: 150,
      length: 210,
      land: (f) => {
        sfx.thud();
        f.shake(6);
        f.pitParticles.dust(128, 8, '#c8a060');
        this.pitCans = [];
        this.pitHm = Array.from({ length: W }, (_, x) => (x > 104 && x < 152 ? 140 : x >= 70 && x < 186 ? 150 : 156));
      },
      tick: (f, it) => {
        // the rack overhead gives way: an avalanche of cans and boxes
        if (it > 12 && it < 100) {
          const n = it < 50 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const k = (['beans', 'soda', 'beans', 'cereal', 'soda'] as Kind[])[Math.floor(Math.random() * 5)];
            this.pitCans.push({ x: 128 + rand(-28, 28), y: rand(-20, 4), vx: rand(-0.4, 0.4), vy: rand(0, 1.5), rot: rand(0, 6), vr: rand(-0.3, 0.3), k, v: Math.floor(Math.random() * KINDS[k].vars), rest: false });
          }
        }
        let hits = 0;
        for (const c of this.pitCans) {
          if (c.rest) continue;
          c.vy += 0.3;
          c.x += c.vx;
          c.y += c.vy;
          c.rot += c.vr;
          const d = KINDS[c.k];
          const x0 = Math.max(0, Math.round(c.x - d.w / 2)), x1 = Math.min(W - 1, Math.round(c.x + d.w / 2));
          let g = H;
          for (let x = x0; x <= x1; x++) g = Math.min(g, this.pitHm[x]);
          if (c.y >= g) {
            c.y = g;
            // slide off the side of the heap rather than stacking into a tower
            const l = this.pitHm[Math.max(0, x0 - 2)], rr = this.pitHm[Math.min(W - 1, x1 + 2)];
            if (Math.max(l, rr) > g + 3) {
              c.x += l > rr ? -1.5 : 1.5;
              c.vy = 0.5;
              continue;
            }
            c.rest = true;
            c.rot = Math.round(c.rot / (Math.PI / 2)) * (Math.PI / 2);
            const top = g - (Math.round(c.rot / (Math.PI / 2)) % 2 ? d.w : d.h) + 1;
            for (let x = x0; x <= x1; x++) this.pitHm[x] = Math.min(this.pitHm[x], top);
            hits++;
          }
        }
        if (hits && it % 3 === 0) clank(1);
        if (it === 14 || it === 50) sfx.thud();
        if (it % 20 === 0 && it < 100) f.shake(2);
      },
      draw: (ctx, it) => {
        for (const c of this.pitCans) {
          const d = KINDS[c.k];
          ctx.save();
          ctx.translate(Math.round(c.x), Math.round(c.y - d.h / 2));
          ctx.rotate(c.rot);
          ctx.drawImage(this.sprites[c.k][c.v], -Math.floor(d.w / 2), -Math.floor(d.h / 2));
          ctx.restore();
        }
        if (it > 110) {
          drawText(ctx, 'CLEANUP IN', 128, 172, SUN, { align: 'center', outline: '#101018', scale: 2 });
          drawText(ctx, 'THE STOCKROOM', 128, 192, SUN, { align: 'center', outline: '#101018', scale: 2 });
        }
      },
      victim: (l, it) => {
        // kicking under the avalanche until it buries them
        const j = it < 90 ? Math.sin(it * 0.9) * (1 - it / 90) * 16 : 0;
        l.poseOverride = P(LIE, { af: 30 + j * 2, ab: 5 - j * 2, lf: -6 + j, kf: 6 - j * 0.5 });
        l.computePose();
        return 0;
      },
    };
  }

  // ---------------------------------------------------------------- simulation
  /** Knock a displayed or resting item into the air. */
  knock(it: Item, vx: number, vy: number) {
    if (it.dead) return;
    if (it.st === 0) it.z = Math.random() < 0.4 ? 1 : 0;
    it.st = 1;
    it.vx = vx;
    it.vy = vy;
    it.vr = KINDS[it.k].round ? 0 : rand(-0.25, 0.25) + vx * 0.04;
    // a two-litre that gets smacked fizzes up and takes off
    if (it.k === 'pop' && it.fizz === 0 && Math.abs(vx) + Math.abs(vy) > 5 && Math.random() < 0.5) {
      it.fizz = 50;
      hiss();
    }
  }

  /** Everything inside a box (world x, screen y) gets sent flying. */
  hitBox(x0: number, x1: number, top: number, bot: number, vx: number, vy: number) {
    let n = 0;
    for (const it of this.items) {
      if (it.dead || it.st === 1) continue;
      const d = KINDS[it.k];
      if (it.x + d.w / 2 < x0 || it.x - d.w / 2 > x1 || it.y < top || it.y - d.h > bot) continue;
      this.knock(it, vx * rand(0.7, 1.3), vy * rand(0.7, 1.3));
      n++;
    }
    return n;
  }

  /** A heavy impact shakes nearby displays: things wobble, and some topple off. */
  rumble(x: number, rad: number, odds: number) {
    for (const it of this.items) {
      if (it.dead || it.st !== 0) continue;
      const dx = it.x - x;
      if (Math.abs(dx) > rad) continue;
      const k = 1 - Math.abs(dx) / rad;
      it.wob = Math.max(it.wob, Math.round(24 * k));
      if (Math.random() < odds * k) this.knock(it, Math.sign(dx || 1) * rand(0.3, 1.5), rand(-1.5, 0));
    }
  }

  update(f: Fight) {
    this.fx = f.particles;
    if (this.sndCd > 0) this.sndCd--;
    for (const ft of f.f) {
      const pv = this.prev.get(ft) ?? { x: ft.x, y: ft.y, hp: ft.hp, state: ft.state };
      const dx = ft.x - pv.x;
      if (ft.alpha > 0 && ft.state !== 'fatal') {
        const hb = ft.hurtbox();
        const top = FLOOR - hb[3], bot = FLOOR - hb[1];
        // took a hit: whatever is behind them on the shelf goes flying, and the unit shakes
        const dmg = pv.hp - ft.hp;
        if (dmg > 0) {
          const dir = Math.sign(dx) || -ft.facing;
          const pad = 4 + dmg / 12;
          this.hitBox(hb[0] - pad, hb[2] + pad, top - pad, bot, dir * (1.2 + dmg / 30), -(1 + dmg / 35));
          this.rumble(ft.x, 30 + dmg / 3, dmg / 500);
        }
        // a body flying through the air ploughs through the displays it passes
        if (HURT_STATES.has(ft.state) && Math.abs(dx) > 1.2) this.hitBox(hb[0], hb[2], top, bot, dx * 1.3, -rand(0.8, 2.4));
        // slamming into the floor rocks the shelves and bounces the litter
        if ((pv.state === 'fall' || pv.state === 'launched') && !HURT_STATES.has(ft.state)) {
          this.rumble(ft.x, 60, 0.3);
          for (const it of this.items) if (it.st === 2 && Math.abs(it.x - ft.x) < 34) this.knock(it, Math.sign(it.x - ft.x || 1) * rand(0.5, 2), -rand(1.5, 3.5));
        }
        // walking through the litter kicks it along
        if (Math.abs(dx) > 0.4)
          for (const it of this.items) {
            if (it.dead || it.st !== 2 || it.x < hb[0] - 1 || it.x > hb[2] + 1) continue;
            if (it.k === 'melon' || it.k === 'tp') it.vx = dx * 1.1;
            else this.knock(it, dx * rand(1.2, 2) + Math.sign(dx) * 0.4, -rand(0.4, 1.6));
          }
        // punching or kicking the shelves themselves
        const sp = ft.strikePoint();
        if (sp) {
          const y = FLOOR - sp.y, rad = sp.hit.r + 3, up = ft.move?.id === 'uppercut';
          this.hitBox(sp.x - rad, sp.x + rad, y - rad, y + rad, ft.facing * (1.5 + sp.hit.dmg / 25), up ? -6 : -1 - sp.hit.dmg / 50);
        }
      }
      this.prev.set(ft, { x: ft.x, y: ft.y, hp: ft.hp, state: ft.state });
    }
    for (const pr of f.projectiles)
      if (!pr.dead) this.hitBox(pr.x - pr.r, pr.x + pr.r, FLOOR - pr.y - pr.r, FLOOR - pr.y + pr.r, Math.sign(pr.vx) * 2.5, -2);
    this.simulate();
  }

  simulate() {
    // displays fall when what they were stacked on is gone
    for (const it of this.items) {
      if (it.wob > 0) it.wob--;
      if (it.st === 0 && it.sup.some((s) => s.st !== 0 || s.dead)) this.knock(it, rand(-0.8, 0.8), rand(-0.5, 0));
    }
    for (const it of this.items) {
      if (it.dead || it.st === 0) continue;
      const d = KINDS[it.k];
      const ground = it.z ? FLOOR + 5 : FLOOR;
      if (it.fizz > 0) {
        // the bottle rockets about, spraying foam
        it.fizz--;
        it.vx += Math.cos(it.rot - Math.PI / 2) * 0.35;
        it.vy += Math.sin(it.rot - Math.PI / 2) * 0.35;
        it.vr += rand(-0.08, 0.08);
        it.st = 1;
        this.fx?.add({ kind: 'spark', x: it.x, y: FLOOR - it.y + d.h / 2, vx: rand(-0.6, 0.6) - it.vx * 0.3, vy: rand(-0.2, 0.6), life: 16, max: 16, color: Math.random() < 0.5 ? '#f8f0d8' : '#c8a070', grav: 0.08, floor: true });
      }
      if (it.st === 1) {
        it.vy += 0.25;
        it.x += it.vx;
        it.y += it.vy;
        it.rot += it.vr;
        if (it.y >= ground) {
          it.y = ground;
          const sp = it.vy;
          if (d.frag && sp > d.frag) {
            this.burst(it);
            continue;
          }
          if (sp > 1.2) {
            it.vy = -sp * d.bounce;
            it.vx *= 0.75;
            it.vr = d.round ? it.vx / (d.w / 2) : it.vr * 0.5 + rand(-0.1, 0.1);
            this.sound(d.snd, Math.min(1, sp / 5));
          } else {
            it.vy = 0;
            it.st = 2;
            if (!d.round) it.rot = Math.round(it.rot / (Math.PI / 2)) * (Math.PI / 2);
            it.vr = 0;
          }
        }
      } else {
        it.vx *= d.round ? 0.985 : 0.82;
        it.x += it.vx;
        if (d.round) it.rot += it.vx / (d.w / 2);
        if (Math.abs(it.vx) < 0.03) it.vx = 0;
      }
      if (it.x < 4) { it.x = 4; it.vx = Math.abs(it.vx) * 0.5; }
      if (it.x > SW - 4) { it.x = SW - 4; it.vx = -Math.abs(it.vx) * 0.5; }
      if (it.y < 18) { it.y = 18; it.vy = Math.abs(it.vy) * 0.3; }
    }
    if (this.items.some((it) => it.dead)) this.items = this.items.filter((it) => !it.dead);
  }

  /** Smash: a splatter of goo (and glass), and a puddle left on the tiles. */
  burst(it: Item) {
    const d = KINDS[it.k];
    it.dead = true;
    const fx = this.fx;
    const h = FLOOR - it.y + 2;
    if (fx) {
      for (let i = 0; i < 14; i++)
        fx.add({ kind: 'spark', x: it.x + rand(-2, 2), y: h, vx: rand(-1.8, 1.8), vy: rand(0.5, 2.8), life: 30, max: 30, color: d.goo![Math.floor(Math.random() * d.goo!.length)], grav: 0.18, floor: true, size: Math.random() < 0.3 ? 2 : 1 });
      if (d.glass) fx.sparks(it.x, h + 2, 8, '#e8f8ff');
    }
    this.splats.push({ x: Math.round(it.x - d.w / 2 - 2), w: d.w + 4 + Math.floor(Math.random() * 4), c: d.goo![0], z: it.z });
    if (this.splats.length > 60) this.splats.shift();
    smash(!!d.glass);
  }

  sound(kind: KindDef['snd'], v: number) {
    if (this.sndCd > 0 || v < 0.2) return;
    this.sndCd = 3;
    if (kind === 'can') clank(v);
    else if (kind === 'box') thump(v);
    else thump(v * 0.4);
  }

  // ---------------------------------------------------------------- drawing
  drawItems(ctx: CanvasRenderingContext2D, camX: number, front: boolean) {
    for (const it of this.items) {
      if (front !== (it.st !== 0 && it.z === 1)) continue;
      const d = KINDS[it.k];
      const sx = it.x - camX;
      if (sx < -12 || sx > W + 12) continue;
      const spr = this.sprites[it.k][it.v];
      const rot = it.rot + (it.wob ? Math.sin(it.wob * 1.3) * 0.12 * (it.wob / 24) : 0);
      if (rot === 0) ctx.drawImage(spr, Math.round(sx - d.w / 2), Math.round(it.y - d.h));
      else {
        ctx.save();
        ctx.translate(Math.round(sx), Math.round(it.y - d.h / 2));
        ctx.rotate(rot);
        ctx.drawImage(spr, -Math.floor(d.w / 2), -Math.floor(d.h / 2));
        ctx.restore();
      }
    }
  }

  drawSplats(ctx: CanvasRenderingContext2D, camX: number, z: 0 | 1) {
    for (const s of this.splats) {
      if (s.z !== z) continue;
      const y = z ? FLOOR + 4 : FLOOR - 1;
      ctx.fillStyle = s.c;
      ctx.fillRect(Math.round(s.x - camX), y, s.w, 2);
      ctx.fillRect(Math.round(s.x - camX) + 2, y + 2, s.w - 4, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(Math.round(s.x - camX) + 2, y, 2, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const ox = -Math.round(camX * 0.35);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.back, ox, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.backGlows) this.glow(ctx, g.x + ox, g.y, g.r, g.col, 0.1 + 0.03 * Math.sin(t * 0.05 + g.ph));
    ctx.globalCompositeOperation = 'source-over';
    const dx = -Math.round(camX);
    ctx.drawImage(this.room, dx, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const sx = g.x + dx;
      if (sx < -g.r * 2 || sx > W + g.r * 2) continue;
      this.glow(ctx, sx, g.y, g.r, g.col, 0.12 + 0.04 * Math.sin(t * 0.04 + g.ph));
    }
    // fluorescent wash, one tube over aisle five on the blink
    for (const [i, lx] of this.lights.entries()) {
      const sx = lx + dx;
      if (sx < -60 || sx > W + 60) continue;
      const bad = i === 6 && (t % 170 < 5 || (t % 170 > 9 && t % 170 < 12));
      this.glow(ctx, sx, 6, 56, '#f0fff0', bad ? 0.02 : 0.11);
    }
    ctx.globalCompositeOperation = 'source-over';
    this.drawSplats(ctx, camX, 0);
    this.drawItems(ctx, camX, false);
  }

  /** Litter knocked toward the camera lies in front of the fighters' feet. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number) {
    this.drawSplats(ctx, camX, 1);
    this.drawItems(ctx, camX, true);
  }

  glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, Math.max(0, a)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(Math.round(x - r), Math.round(y - r), Math.ceil(r * 2), Math.ceil(r * 2));
  }
}
