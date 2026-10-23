import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { ac, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { drawText } from '../../gfx/font';
import { P, LAUNCHED } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "The Pearly Gates": a golden-hour sky above the clouds. Pearl-topped marble pillars hold a
// wrought-gold gate with light pouring through its bars, a white-bearded gatekeeper checks names
// in a big ledger at his lectern, a small queue of newly arrived souls waits behind a velvet rope
// under a NOW SERVING sign, and robed cherubs flutter about with harps. The fighters stand on a
// street of gold laid over the clouds. The uppercut knocks the loser through the cloud floor and
// all the way down to Earth, head first into a farmer's haystack. Painted procedurally at load.

const BASE = 168; // where the far cloud bank meets the cloud floor
const FAR_K = 0.35;
const FAR_W = W + Math.ceil((STAGE_W - W) * FAR_K);
const GATE = { x: 256, x0: 214, x1: 298, top: 52, spring: 82 };
const PILLARS = [198, 298];
const LECTERN = 352;
const QUEUE = [{ x: 130, ph: 0 }, { x: 150, ph: 1.3 }, { x: 170, ph: 2.6 }];
const CHERUBS = [{ x: 96, y: 52, ph: 0 }, { x: 420, y: 44, ph: 2.2 }];

const CLOUD = ['#ffffff', '#f6f2ff', '#e4dcf6', '#c8bce8', '#a89cd0'];

/** A shaded puff of cloud: lit from the upper left, lavender in its shadow. */
function puff(p: Painter, cx: number, cy: number, rx: number, ry: number, dim = 0) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      // light falls from the top left, shadow pools underneath
      const lit = -dx * 0.45 - dy * 0.9 + (1 - d) * 0.4;
      let k = lit > 0.55 ? 0 : lit > 0.15 ? 1 : lit > -0.25 ? 2 : lit > -0.6 ? 3 : 4;
      if (k > 0 && bayer(x, y) < 0.25 && lit > [0, 0.35, -0.05, -0.45, -0.8][k]) k--;
      p.set(x, y, darken(CLOUD[Math.min(4, k + dim)], dim * 0.03));
    }
}

/** Static sky: gold at the top melting to cream at the horizon, the sun glowing behind the gate. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, BASE, '#f0b868', '#fff2d8', 10);
  for (let y = 0; y < BASE; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, (y - 76) * 1.2);
      if (d < 90 && bayer(x, y) < (1 - d / 90) * 0.9) p.set(x, y, mix(p.get(x, y), '#fffbe8', 0.6));
    }
  // a few thin high clouds catching the light
  const r = rng(7301);
  for (let i = 0; i < 9; i++) {
    const y = r.int(8, 70), x0 = r.int(-20, W), len = r.int(30, 80);
    for (let x = x0; x < x0 + len; x++) if (bayer(x, y) < 0.7) p.set(x, y, '#fff8ec');
    for (let x = x0 + 6; x < x0 + len - 8; x++) if (bayer(x, y + 1) < 0.4) p.set(x, y + 1, '#f8dcb0');
  }
  return p.canvas();
}

/** Far layer: a rainbow, floating cloud islands with little colonnades, and the far cloud bank. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(7311);
  // a faint rainbow arcing over everything
  const RB = ['#f08080', '#f0b070', '#f0e080', '#90d890', '#80b0f0', '#b090e0'];
  const rcx = FAR_W * 0.62, rcy = 150;
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < FAR_W; x++) {
      const d = Math.hypot(x - rcx, y - rcy);
      const band = Math.floor((d - 98) / 2.5);
      if (band >= 0 && band < RB.length && bayer(x, y) < 0.45) p.set(x, y, RB[RB.length - 1 - band]);
    }
  // floating islands: a heap of cloud with a small round colonnade on top
  for (const [ix, iy, s] of [[40, 92, 1], [FAR_W - 70, 84, 0.85], [FAR_W * 0.45, 108, 0.6]] as const) {
    for (let k = 0; k < 5; k++) puff(p, ix + (k - 2) * 9 * s, iy + Math.abs(k - 2) * 2 * s, 9 * s, 6 * s, 1);
    const w = Math.round(22 * s), top = Math.round(iy - 24 * s);
    p.rect(ix - w / 2 - 2, iy - 5 * s, w + 4, 2, '#f0e8d8');
    for (let c = 0; c <= 4; c++) p.rect(Math.round(ix - w / 2 + (c * w) / 4), top + 4, 2, Math.round(16 * s), c % 2 ? '#e0d4c0' : '#fff8ec');
    p.rect(ix - w / 2 - 2, top + 2, w + 5, 2, '#f0e8d8');
    p.ellipse(ix + 1, top, w / 2 + 1, 4 * s, '#f0d070'); // a golden dome
    p.ellipse(ix - 1, top - 1, w / 4, 2 * s, '#fff0b0');
  }
  // the far cloud bank along the horizon, in layered rows of puffs
  for (let row = 0; row < 3; row++)
    for (let x = -10; x < FAR_W + 20; x += r.int(14, 22)) {
      const ry = 8 + r.int(0, 6) + row * 2;
      puff(p, x, BASE - 22 + row * 9 + r.int(-2, 2), ry * 1.5, ry, 2 - row);
    }
  p.rect(0, BASE - 4, FAR_W, 8, CLOUD[2]);
  return p.canvas();
}

/** The gate: pillars, the arched golden gate with light behind it, the lectern and the queue rope. */
function near(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const { x0, x1, top, spring } = GATE;
  // the light behind the gate
  for (let y = top - 6; y < BASE + 4; y++)
    for (let x = x0; x < x1; x++) {
      const d = Math.hypot(x - GATE.x, (y - 120) * 0.8);
      if (y < archY(x) - 2) continue;
      p.set(x, y, mix('#fffef4', '#ffe8a8', Math.min(1, d / 60)));
    }
  // cloud the gate stands in
  for (let k = 0; k < 9; k++) puff(p, x0 - 20 + k * 16, BASE + 2, 14, 9);
  // the gate itself: two leaves of upright gold bars under an arched top, studded with pearls
  for (let x = x0 + 2; x < x1 - 1; x++) {
    const a = archY(x);
    const bar = (x - x0) % 6 === 0 || x === GATE.x || x === GATE.x - 1;
    if (bar) for (let y = Math.round(a); y < BASE + 2; y++) p.set(x, y, x % 2 ? '#e0a830' : '#f8d060');
    // the arch frame and two cross rails
    for (const dy of [0, 1, 2]) p.set(x, Math.round(a) + dy, dy === 0 ? '#fff0a0' : '#c88a20');
    for (const ry of [104, 140]) {
      p.set(x, ry, '#f8d060');
      p.set(x, ry + 1, '#a87018');
    }
    // scrollwork between the rails
    const u = (x - x0) % 12;
    if (u > 1 && u < 11) {
      const cy = 122 + Math.sin(((x - x0) / 12) * Math.PI * 2) * 6;
      p.set(x, Math.round(cy), '#f0c040');
    }
  }
  for (let x = x0 + 6; x < x1 - 2; x += 12)
    for (const ry of [104, 140]) {
      p.ellipse(x, ry, 2, 2, '#f8f4f0');
      p.set(x - 1, ry - 1, '#ffffff');
    }
  // a big pearl at the crown of the arch and a golden latch where the leaves meet
  p.ellipse(GATE.x, top - 4, 5, 5, '#f4f0f0');
  p.ellipse(GATE.x - 1.5, top - 5.5, 2, 2, '#ffffff');
  p.ellipse(GATE.x + 1.5, top - 2, 2, 1.5, '#d8d0e0');
  p.rect(GATE.x - 3, 118, 6, 8, '#c88a20');
  p.rect(GATE.x - 2, 119, 4, 3, '#f8d060');
  // the marble pillars, each crowned with a great pearl
  for (const px of PILLARS) {
    const w = 16;
    for (let y = spring - 20; y < BASE + 2; y++)
      for (let x = px; x < px + w; x++) {
        const u = (x - px) / (w - 1);
        let c: Color = mix('#ffffff', '#c8bcd8', Math.max(0, u - 0.2) * 1.2);
        if ((x - px) % 4 === 0 && x > px) c = darken(c, 0.12); // fluting
        if (Math.sin(x * 0.4 + y * 0.12) > 0.96) c = mix(c, '#e8c8a0', 0.5); // veining
        p.set(x, y, c);
      }
    p.rect(px - 3, spring - 24, w + 6, 4, '#f0e8f0');
    p.rect(px - 2, spring - 20, w + 4, 2, '#c8bcd8');
    p.rect(px - 3, BASE - 6, w + 6, 6, '#e8e0ec');
    p.rect(px - 3, BASE - 6, w + 6, 1, '#ffffff');
    p.ellipse(px + w / 2, spring - 34, 10, 10, '#ece8f0');
    p.ellipse(px + w / 2 - 3, spring - 37, 4, 4, '#ffffff');
    p.ellipse(px + w / 2 + 3, spring - 29, 4, 2.5, '#c8c0d8');
  }
  // the gatekeeper's lectern: marble, with a big ledger open on top
  const lx = LECTERN;
  p.poly([[lx - 10, BASE + 4], [lx + 10, BASE + 4], [lx + 7, BASE - 26], [lx - 7, BASE - 26]], '#ece6f0');
  p.line(lx + 6, BASE - 24, lx + 9, BASE + 3, '#c0b4d0');
  p.poly([[lx - 14, BASE - 26], [lx + 14, BASE - 26], [lx + 12, BASE - 31], [lx - 12, BASE - 31]], '#d8ccdc');
  p.poly([[lx - 13, BASE - 31], [lx, BASE - 33], [lx + 13, BASE - 31], [lx + 12, BASE - 36], [lx, BASE - 35], [lx - 12, BASE - 36]], '#f8f0e0');
  p.line(lx, BASE - 35, lx, BASE - 32, '#a89878');
  for (let k = 0; k < 4; k++) {
    p.line(lx - 10, BASE - 34 + k * 0.7, lx - 3, BASE - 34 + k * 0.7, '#8a8070');
    p.line(lx + 3, BASE - 34 + k * 0.7, lx + 10, BASE - 34 + k * 0.7, '#8a8070');
  }
  p.rect(lx - 13, BASE - 31, 26, 1, '#8a2030'); // the ribbon bookmark
  p.line(lx + 9, BASE - 31, lx + 10, BASE - 26, '#8a2030');
  // velvet rope queue on gold stanchions
  for (const sx of [116, 146, 176]) {
    p.rect(sx, BASE - 16, 2, 18, '#e0a830');
    p.rect(sx - 1, BASE - 18, 4, 3, '#f8d060');
    p.rect(sx - 2, BASE + 1, 6, 2, '#c88a20');
  }
  for (let x = 117; x < 177; x++) {
    const k = ((x - 117) % 30) / 30, sag = Math.sin(k * Math.PI) * 5;
    p.set(x, Math.round(BASE - 14 + sag), '#a01828');
    p.set(x, Math.round(BASE - 13 + sag), '#6a0e18');
  }
  // the NOW SERVING sign on a gold post
  p.rect(98, BASE - 50, 2, 52, '#c88a20');
  p.rect(84, BASE - 66, 32, 18, '#2a2448');
  p.rect(84, BASE - 66, 32, 1, '#f8d060');
  p.rect(84, BASE - 49, 32, 1, '#a87018');
  p.rect(84, BASE - 66, 1, 18, '#f8d060');
  p.rect(115, BASE - 66, 1, 18, '#a87018');
  // a ticket dispenser on the first stanchion
  p.rect(110, BASE - 30, 8, 8, '#c02838');
  p.rect(111, BASE - 29, 6, 2, '#ff8090');
  p.rect(113, BASE - 22, 2, 2, '#f8f4e8');
  // the cloud floor, rolling away to the far bank
  const fr = rng(7341);
  for (let y = BASE; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const v = (y - BASE) / (H - BASE);
      const wave = Math.sin(x * 0.07 + y * 0.5) + Math.sin(x * 0.031 - y * 0.23) * 1.3;
      let c: Color = mix(CLOUD[2], CLOUD[1], v);
      if (wave > 1.3) c = CLOUD[0];
      else if (wave < -1.4) c = CLOUD[3];
      if (bayer(x, y) < 0.12) c = lighten(c, 0.3);
      p.set(x, y, c);
    }
  for (let x = -10; x < STAGE_W + 20; x += fr.int(12, 20)) puff(p, x, BASE + fr.int(-1, 3), fr.int(10, 16), fr.int(5, 8));
  // the street of gold, where the fighters stand
  for (let y = 186; y < 210; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const row = Math.floor((y - 186) / 6), off = row % 2 ? 7 : 0;
      const seam = (y - 186) % 6 === 5 || (x + off) % 14 === 13;
      let c: Color = seam ? '#b07818' : ((row * 5 + Math.floor((x + off) / 14) * 3) % 4 === 0 ? '#f0c848' : '#e8b838');
      if (!seam && (y - 186) % 6 === 0) c = lighten(c, 0.35);
      if (!seam && bayer(x, y) < Math.max(0, 1 - Math.abs(y - 194) / 6) * 0.25) c = '#fff4c0'; // the polished sheen
      p.set(x, y, c);
    }
  // its kerbs blur into cloud
  for (let x = -6; x < STAGE_W + 10; x += 9) {
    puff(p, x, 186, 7, 3);
    puff(p, x + 4, 210, 8, 3.5);
  }
  return p.canvas();
}

/** Height of the gate's arch at x. */
function archY(x: number) {
  const { x0, x1, top, spring } = GATE;
  const k = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
  return spring - (spring - top) * Math.sqrt(Math.max(0, 1 - k * k));
}

export class HeavenStage {
  name = 'THE PEARLY GATES';
  blurb = 'PLEASE TAKE A NUMBER';
  song: SongName = 'heaven';
  sky = sky();
  far = far();
  near = near();
  pit: HTMLCanvasElement;
  pitLanding: PitLanding;
  /** NOW SERVING: ticks up whenever someone gets knocked down. */
  serving = 7;
  /** The gatekeeper glances up from the ledger when a big hit lands. */
  look = 0;
  hp: number[] = [];
  falls: string[] = [];

  constructor() {
    this.pit = this.buildPit();
    this.pitLanding = this.makeLanding();
  }

  reset() {
    this.serving = 7;
    this.look = 0;
    this.hp = [];
    this.falls = [];
  }

  update(f: Fight) {
    f.f.forEach((ft, i) => {
      const was = this.hp[i] ?? ft.hp;
      if (was - ft.hp > 60) this.look = 90;
      this.hp[i] = ft.hp;
      // every knockdown calls the next number in the queue
      const st = ft.state;
      if (st === 'lying' && this.falls[i] !== 'lying') this.serving++;
      this.falls[i] = st;
    });
    if (this.look > 0) this.look--;
  }

  /** The finish close-up: dropped out of the bottom of the clouds, down to a farm far below. */
  buildPit(): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(7361);
    p.gradRect(0, 0, W, 120, '#6aa8e8', '#c8e8ff', 6);
    // the underside of the cloud deck, with the hole they fell through
    for (let x = -8; x < W + 8; x += r.int(10, 16)) {
      if (Math.abs(x - 128) < 22) continue;
      puff(p, x, r.int(0, 6), r.int(12, 18), r.int(8, 12), 1);
    }
    for (let y = 0; y < 6; y++) for (let x = 0; x < W; x++) if (Math.abs(x - 128) > 22 + y * 2) p.set(x, y, CLOUD[3]);
    // far hills and a patchwork of fields
    for (let x = 0; x < W; x++) {
      const h = 96 + Math.sin(x * 0.03) * 6 + Math.sin(x * 0.11) * 2;
      for (let y = Math.floor(h); y < 120; y++) p.set(x, y, bayer(x, y) < 0.3 ? '#7aa860' : '#6a9a50');
    }
    const FIELDS = ['#a8c060', '#c8b058', '#88b050', '#d8c878', '#78a048'];
    for (let y = 112; y < 150; y++)
      for (let x = 0; x < W; x++) {
        const col = Math.floor((x + (y - 112) * 0.6) / 40), row = Math.floor((y - 112) / 12);
        let c: Color = FIELDS[(col * 3 + row * 2 + 50) % FIELDS.length];
        if ((x + (y - 112) * 0.6) % 40 < 1 || (y - 112) % 12 === 0) c = '#5a7a3a'; // hedgerows
        else if ((x + y) % 4 === 0) c = darken(c, 0.08); // furrows
        p.set(x, y, c);
      }
    // a red barn with a white-trimmed roof on the left, a windmill on the right
    p.rect(26, 92, 34, 30, '#b03028');
    p.poly([[22, 93], [43, 78], [64, 93]], '#5a3a30');
    p.line(22, 93, 43, 78, '#f0ece0');
    p.line(43, 78, 64, 93, '#f0ece0');
    p.rect(36, 104, 14, 18, '#5a1810');
    p.line(36, 104, 50, 122, '#f0ece0');
    p.line(50, 104, 36, 122, '#f0ece0');
    p.rect(39, 86, 8, 5, '#f0ece0');
    p.poly([[206, 76], [214, 76], [216, 112], [204, 112]], '#d8d0c0');
    p.ellipse(210, 78, 3, 3, '#8a7a6a');
    for (const [dx, dy] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) p.line(210, 78, 210 + dx, 78 + dy, '#f0ece0');
    // the farmyard: packed earth, a rail fence, a feed trough
    for (let y = 150; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c: Color = mix('#b08858', '#8a6a40', (y - 150) / (H - 150));
        if (bayer(x, y) < 0.1) c = darken(c, 0.15);
        else if (Math.sin(x * 0.2 + y * 0.9) > 0.97) c = '#d8c898'; // stray straw
        p.set(x, y, c);
      }
    for (const y of [140, 147]) p.rect(0, y, W, 2, '#8a6a40');
    for (let x = 6; x < W; x += 30) p.rect(x, 136, 3, 18, '#6a4a2a');
    p.rect(182, 170, 40, 10, '#7a5a34');
    p.rect(182, 170, 40, 2, '#9a7a4c');
    p.rect(184, 172, 36, 3, '#c8b070');
    // the haystack, dead centre, waiting
    const cx = 128, cy = 160;
    for (let y = cy - 34; y < cy + 14; y++)
      for (let x = cx - 46; x < cx + 46; x++) {
        const dx = (x - cx) / 46, dy = (y - (cy + 14)) / 48;
        if (dx * dx + dy * dy > 1) continue;
        let c: Color = (x * 3 + y * 7) % 11 < 2 ? '#a88a38' : (x + y * 2) % 9 < 2 ? '#f8e8a0' : '#e0c868';
        if (dx > 0.35) c = darken(c, 0.15);
        p.set(x, y, c);
      }
    // a pitchfork leaning on it and a chicken pecking at the dirt
    p.line(184, 186, 168, 142, '#7a5a34');
    for (const dx of [-3, 0, 3]) p.line(168 + dx, 142, 168 + dx * 1.3, 134, '#8a8e9a');
    p.line(165, 142, 171, 142, '#8a8e9a');
    this.chicken(p, 46, 196, 1);
    return p.canvas();
  }

  /** A little white hen, facing dir. */
  chicken(p: Painter, x: number, y: number, dir: number) {
    p.ellipse(x, y - 4, 5, 3.5, '#f8f4ec');
    p.ellipse(x + dir * 4, y - 8, 2.5, 2.5, '#f8f4ec');
    p.set(x + dir * 5, y - 11, '#e02020');
    p.set(x + dir * 4, y - 11, '#e02020');
    p.set(x + dir * 7, y - 8, '#f0a020');
    p.set(x + dir * 5, y - 9, '#141014');
    p.poly([[x - dir * 4, y - 6], [x - dir * 8, y - 10], [x - dir * 6, y - 4]], '#e8e0d4');
    p.line(x - 1, y - 1, x - 1, y + 1, '#f0a020');
    p.line(x + 1, y - 1, x + 1, y + 1, '#f0a020');
  }

  /** Landing for the uppercut finish: head first into the haystack, legs kicking; a hen settles on a boot. */
  makeLanding(): PitLanding {
    const REST = 128;
    const SURF = 132; // where the hay swallows them, screen y
    const HEN_AT = 70, HEN_LAND = 96, CROW = 130;
    let feet = { x: 128, y: 0 };
    const hen = new Painter(14, 14);
    this.chicken(hen, 6, 13, 1);
    const henCv = hen.canvas();
    return {
      pose: P(LAUNCHED, { rot: 180 }),
      rest: REST,
      length: 230,
      land: (f) => {
        sfx.thud();
        sfx.land();
        f.shake(8);
        for (let i = 0; i < 46; i++) {
          const a = rand(Math.PI * 0.05, Math.PI * 0.95), s = rand(1, 3.4);
          f.pitParticles.add({ kind: 'spark', x: 128 + rand(-12, 12), y: H - SURF, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 46, max: 46, color: rand() < 0.5 ? '#f8e8a0' : '#c8a848', size: rand(1, 2), grav: 0.1, floor: false });
        }
      },
      tick: (f, it) => {
        if (it < 40 && it % 6 === 0) f.pitParticles.add({ kind: 'spark', x: 128 + rand(-20, 20), y: H - SURF + 4, vx: rand(-0.6, 0.6), vy: rand(0.6, 1.4), life: 30, max: 30, color: '#f8e8a0', size: 1, grav: 0.08, floor: false });
        if (it === HEN_AT) cluckRun();
        if (it === HEN_LAND) {
          sfx.ow();
          for (let i = 0; i < 6; i++) f.pitParticles.add({ kind: 'spark', x: feet.x + rand(-4, 4), y: H - feet.y + 10, vx: rand(-1, 1), vy: rand(0.4, 1.4), life: 30, max: 30, color: '#ffffff', size: 1, grav: 0.05, floor: false });
        }
        if (it === CROW) crow();
      },
      victim: (l, it) => {
        // legs kicking wildly, slowing to a stop once the hen has settled on a boot
        const k = it < HEN_LAND ? 1 : it < HEN_LAND + 20 ? 0.3 : 0;
        const j = Math.sin(it * 0.8) * 24 * k, j2 = Math.sin(it * 0.8 + 1.7) * 24 * k;
        l.poseOverride = P(LAUNCHED, { rot: 180, t: 0, h: 0, af: -170, ef: 0, ab: -170, eb: 0, lf: -14 + j, kf: 16 + Math.abs(j) * 0.6, lb: 14 + j2, kb: 16 + Math.abs(j2) * 0.6 });
        l.computePose();
        const s = l.skel;
        const lift = SURF + 4 + Math.min(10, it) * 0.5 - REST + l.G;
        const top = s.heelF[1] < s.toeF[1] ? s.heelF : s.toeF;
        feet = { x: 128 + ((s.heelF[0] + s.toeF[0]) / 2) * l.facing, y: REST + lift - l.G + top[1] };
        return lift;
      },
      draw: (ctx, it) => {
        // the front of the haystack over their head and shoulders
        ctx.drawImage(this.pit, 80, SURF - 4, 96, H - SURF + 4, 80, SURF - 4, 96, H - SURF + 4);
        ctx.fillStyle = '#f8e8a0';
        for (let k = 0; k < 10; k++) ctx.fillRect(104 + k * 5, SURF - 6 + ((k * 7) % 4), 1, 4);
        // a hen flaps up from the yard and roosts on the upturned boot
        if (it >= HEN_AT) {
          const e = Math.min(1, (it - HEN_AT) / (HEN_LAND - HEN_AT));
          const hx = 46 + (feet.x - 46) * e, hy = 196 + (H - feet.y - 196) * e - Math.sin(e * Math.PI) * 40;
          const flap = it < HEN_LAND && Math.floor(it / 3) % 2 === 0;
          ctx.drawImage(henCv, Math.round(hx - 6), Math.round(hy - 13 + (flap ? -1 : 0)));
          if (flap) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(hx - 4), Math.round(hy - 10), 4, 1);
          }
          if (it >= CROW && it < CROW + 50) drawText(ctx, 'BAWK!', Math.round(hx + 8), Math.round(hy - 22), '#ffffff', { outline: '#3a2010' });
        }
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.sky, 0, 0);
    this.drawRays(ctx, t);
    // big slow clouds drifting across the sky
    for (let i = 0; i < 3; i++) {
      const x = ((i * 131 + t * 0.04 * (1 + i * 0.4) - camX * 0.15) % (W + 120) + W + 120) % (W + 120) - 60;
      const y = 26 + i * 16;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const [dx, dy, rr] of [[0, 0, 10], [12, -5, 12], [26, 0, 9], [13, 3, 11]]) {
        ctx.beginPath();
        ctx.ellipse(Math.round(x + dx), y + dy, rr, rr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.drawImage(this.far, -Math.round(camX * FAR_K), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.near, dx, 0);
    // the gate's light breathes
    const gx = GATE.x + dx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(gx, 120, 6, gx, 120, 70);
    g.addColorStop(0, `rgba(255,240,180,${0.18 + Math.sin(t * 0.03) * 0.06})`);
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(gx - 70, 50, 140, 140);
    ctx.restore();
    drawText(ctx, 'NOW', 100 + dx, BASE - 64, '#f8d060', { align: 'center' });
    drawText(ctx, String(this.serving).padStart(3, '0'), 100 + dx, BASE - 56, Math.floor(t / 30) % 2 ? '#ff6070' : '#ffb0b8', { align: 'center' });
    for (const q of QUEUE) this.drawSoul(ctx, q.x + dx, BASE, t, q.ph);
    this.drawGatekeeper(ctx, LECTERN + 18 + dx, BASE, t);
    for (const c of CHERUBS) this.drawCherub(ctx, c.x + dx, c.y, t, c.ph);
  }

  /** Soft beams of light fanning down from behind the gate. */
  drawRays(ctx: CanvasRenderingContext2D, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * 0.004 + i) * 0.04;
      const alpha = 0.05 + Math.sin(t * 0.02 + i * 1.7) * 0.025;
      ctx.fillStyle = `rgba(255,246,210,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(W / 2, 80);
      ctx.lineTo(W / 2 + Math.cos(a - 0.05) * 260, 80 + Math.sin(a - 0.05) * 260);
      ctx.lineTo(W / 2 + Math.cos(a + 0.05) * 260, 80 + Math.sin(a + 0.05) * 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** A newly arrived soul waiting in the queue: a white robe, a halo, shuffling and looking about. */
  drawSoul(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, ph: number) {
    if (x < -20 || x > W + 20) return;
    const bob = Math.sin(t * 0.05 + ph) > 0.6 ? 1 : 0;
    const skin = ['#f0c8a0', '#a8724a', '#d8a47a'][Math.round(ph) % 3];
    const hair = ['#6a3a1a', '#1a1414', '#c8c8c0'][Math.round(ph) % 3];
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(x - 4, y - 16 + bob, 8, 15);
    ctx.fillRect(x - 5, y - 6 + bob, 10, 6);
    ctx.fillStyle = '#d8d0e0';
    ctx.fillRect(x + 2, y - 15 + bob, 2, 14);
    ctx.fillStyle = skin;
    ctx.fillRect(x - 3, y - 22 + bob, 6, 6);
    ctx.fillStyle = hair;
    ctx.fillRect(x - 3, y - 23 + bob, 6, 2);
    // glancing toward the fight now and then
    ctx.fillStyle = '#141014';
    ctx.fillRect(x + (Math.sin(t * 0.013 + ph * 2) > 0 ? 1 : -2), y - 20 + bob, 1, 1);
    ctx.fillStyle = `rgba(255,220,100,${0.7 + Math.sin(t * 0.1 + ph) * 0.2})`;
    ctx.fillRect(x - 3, y - 26 + bob, 6, 1);
    ctx.fillRect(x - 4, y - 25 + bob, 1, 1);
    ctx.fillRect(x + 3, y - 25 + bob, 1, 1);
  }

  /** The gatekeeper at his lectern: white beard, keys on his belt, quill scratching in the ledger. */
  drawGatekeeper(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
    if (x < -30 || x > W + 30) return;
    const up = this.look > 0;
    ctx.fillStyle = '#e8e4f0';
    ctx.fillRect(x - 6, y - 26, 12, 26); // robe
    ctx.fillRect(x - 7, y - 8, 14, 8);
    ctx.fillStyle = '#c0b4d0';
    ctx.fillRect(x + 3, y - 25, 3, 24);
    ctx.fillStyle = '#d8b040';
    ctx.fillRect(x - 6, y - 14, 12, 1); // belt
    ctx.fillRect(x - 6, y - 13, 2, 4); // keys
    ctx.fillRect(x - 3, y - 13, 1, 3);
    // head, bald on top, a long white beard; tilted down to the ledger unless a big hit lands
    const hx = x + (up ? -1 : -3), hy = y - 34 + (up ? 0 : 1);
    ctx.fillStyle = '#e8b890';
    ctx.fillRect(hx - 3, hy, 7, 7);
    ctx.fillStyle = '#f4f4f8';
    ctx.fillRect(hx - 4, hy + 3, 2, 3);
    ctx.fillRect(hx - 3, hy + 5, 7, 6);
    ctx.fillRect(hx - 1, hy + 11, 4, 3);
    ctx.fillStyle = '#141014';
    ctx.fillRect(hx - 2, hy + 3, 1, 1);
    if (up) {
      // eyebrows raised at the fighters
      ctx.fillStyle = '#f4f4f8';
      ctx.fillRect(hx - 3, hy + 1, 3, 1);
    }
    // arm reaching to the book with a quill that scratches along
    const qx = x - 14 + (up ? 0 : Math.floor(t / 4) % 4), qy = y - 32;
    ctx.fillStyle = '#e8e4f0';
    ctx.fillRect(qx, qy + 2, x - 6 - qx, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - 1, qy - 5, 1, 7);
    ctx.fillRect(qx - 2, qy - 5, 1, 4);
    ctx.fillStyle = `rgba(255,220,100,0.8)`;
    ctx.fillRect(hx - 3, hy - 3, 8, 1);
  }

  /** A chubby robed cherub fluttering in loops, strumming a little harp. */
  drawCherub(ctx: CanvasRenderingContext2D, x0: number, y0: number, t: number, ph: number) {
    const x = Math.round(x0 + Math.sin(t * 0.015 + ph) * 26), y = Math.round(y0 + Math.sin(t * 0.03 + ph) * 8);
    if (x < -20 || x > W + 20) return;
    const dir = Math.cos(t * 0.015 + ph) > 0 ? 1 : -1;
    const flap = Math.floor(t / 5 + ph) % 2;
    // wings
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - dir * 4 - (dir > 0 ? 4 : 0), y - 6 - flap * 2, 4, 4 + flap);
    ctx.fillRect(x - dir * 7 - (dir > 0 ? 2 : 0), y - 8 - flap * 3, 2, 4);
    ctx.fillStyle = '#d8d0ec';
    ctx.fillRect(x - dir * 4 - (dir > 0 ? 4 : 0), y - 2 - flap * 2, 4, 1);
    // pale blue robe, round face, golden curls
    ctx.fillStyle = '#c8dcf8';
    ctx.fillRect(x - 3, y - 4, 6, 7);
    ctx.fillStyle = '#f4c8a8';
    ctx.fillRect(x - 2, y - 9, 5, 5);
    ctx.fillRect(x + dir * 3, y - 2, 2, 2);
    ctx.fillStyle = '#f0c840';
    ctx.fillRect(x - 3, y - 10, 6, 2);
    ctx.fillRect(x - dir * 3, y - 9, 1, 2);
    ctx.fillStyle = '#141014';
    ctx.fillRect(x + dir, y - 7, 1, 1);
    // the harp, its strings shimmering as they're plucked
    const hx = x + dir * 5;
    ctx.fillStyle = '#e0a830';
    ctx.fillRect(hx, y - 6, 1, 8);
    ctx.fillRect(hx, y - 6, dir * 4, 1);
    ctx.fillRect(hx + dir * 3, y - 6, 1, 3);
    ctx.fillStyle = Math.floor(t / 3) % 2 ? '#fff8d0' : '#d8c890';
    ctx.fillRect(hx + dir, y - 5, 1, 6);
    ctx.fillRect(hx + dir * 2, y - 5, 1, 4);
    ctx.fillStyle = 'rgba(255,220,100,0.8)';
    ctx.fillRect(x - 2, y - 12, 5, 1);
  }

  /** Wisps of mist drifting low across the street, and golden motes floating up. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 7; i++) {
      const x = ((i * 89 + t * (0.15 + (i % 3) * 0.08) - camX * 1.2) % (W + 120) + W + 120) % (W + 120) - 60;
      const y = 202 + (i % 3) * 7;
      ctx.fillStyle = css('#ffffff', 0.35 + (i % 2) * 0.15);
      for (const [dx, dy, rr] of [[0, 0, 12], [14, -2, 10], [26, 1, 13]]) {
        ctx.beginPath();
        ctx.ellipse(Math.round(x + dx), y + dy, rr, rr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,236,160,0.7)';
    for (let i = 0; i < 22; i++) {
      const x = ((i * 113 + Math.sin(t * 0.01 + i) * 14 - camX * 1.05) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = FLOOR - ((i * 47 + t * (0.15 + (i % 4) * 0.05)) % 180);
      if (Math.sin(t * 0.06 + i * 1.3) > -0.3) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

/** The hen taking off: a run of startled clucks and flapping. */
function cluckRun() {
  for (let i = 0; i < 4; i++) {
    tone({ type: 'square', freq: 700 + i * 40, to: 500, dur: 0.07, vol: 0.06, at: now() + i * 0.12, filter: { type: 'bandpass', freq: 1200, q: 2 } });
  }
}
/** A rooster's crow from across the farmyard: a rising then falling call. */
function crow() {
  const t = now();
  tone({ type: 'sawtooth', freq: 500, to: 900, dur: 0.18, vol: 0.06, at: t, filter: { type: 'bandpass', freq: 1400, q: 3 } });
  tone({ type: 'sawtooth', freq: 900, to: 1000, dur: 0.4, vol: 0.06, at: t + 0.18, filter: { type: 'bandpass', freq: 1600, q: 3 } });
  tone({ type: 'sawtooth', freq: 1000, to: 520, dur: 0.5, vol: 0.05, at: t + 0.58, filter: { type: 'bandpass', freq: 1300, q: 3 } });
}
const now = () => ac()?.currentTime ?? 0;
