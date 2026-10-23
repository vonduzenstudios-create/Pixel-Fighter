import { H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import type { SongName } from '../../audio/music';
import { P, LIE } from '../../game/anims';
import type { Fight } from '../../game/fight';
import type { Particles } from '../../game/particles';
import type { PitLanding } from '../../game/stages';

// "Rescue Point": a golden-hour lifeguard beach. The fighters brawl on dry sand in front of a
// big lifeguard tower and the boardwalk, while out on the wet sand the lifeguard crew keeps
// jogging along the surf in heroic slow motion, afterimages and all. The uppercut finish drops
// the loser onto a planted beach umbrella, which pops open over them like a cocktail umbrella.
// Every layer is painted procedurally at load time.

const HZ = 100;
const FAR_P = 0.15, MID_P = 0.5;
const FAR_W = W + Math.ceil((STAGE_W - W) * FAR_P);
const MID_W = W + Math.ceil((STAGE_W - W) * MID_P);
/** Screen y of the waterline where the surf runs up the wet sand. */
const SHORE = 146;
/** Screen y of the top of the near (fighting) sand. */
const SAND = 168;
/** Feet line of the slow-motion joggers on the wet sand. */
const JOG_Y = 163;
const TOWER_X = 196;
const SAND_PUFF = ['#f4dca0', '#e8c888', '#fff0c8', '#d8b878'];

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ layers

/** Late-afternoon sky: deep blue up top melting into peach and gold at the horizon, a low sun. */
function sky(): HTMLCanvasElement {
  const p = new Painter(W, HZ + 2);
  const stops = ['#3a5ab8', '#5a74c8', '#8a8ad0', '#d898b8', '#f8b890', '#ffd890', '#fff0c0'];
  for (let y = 0; y < HZ + 2; y++) {
    const t = Math.min(1, y / HZ) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    for (let x = 0; x < W; x++) p.set(x, y, f > bayer(x, y) ? stops[Math.min(i + 1, stops.length - 1)] : stops[i]);
  }
  // a fat low sun with a dithered glow, sliced by a couple of thin cloud bands
  const sx = 70, sy = 72;
  for (let y = -34; y <= 34; y++)
    for (let x = -34; x <= 34; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (sy + y > HZ) continue;
      if (d <= 13) p.set(sx + x, sy + y, d < 10 ? '#fff8d8' : '#ffe8a0');
      else if (((34 - d) / 21) * 0.6 > bayer(sx + x, sy + y)) p.set(sx + x, sy + y, mix(p.get(sx + x, sy + y), '#ffe0a0', 0.5));
    }
  const r = rng(1201);
  for (let b = 0; b < 6; b++) {
    const cy = r.int(18, 84), cx = r.int(0, W), len = r.int(30, 80);
    for (let x = cx - len; x < cx + len; x++) {
      const k = 1 - Math.abs(x - cx) / len;
      for (let y = 0; y < (k > 0.5 ? 2 : 1); y++) p.set(((x % W) + W) % W, cy + y, mix('#ffd8b8', '#c87898', cy / 100 < 0.5 ? 0.6 : 0.2));
    }
  }
  return p.canvas();
}

/** The open sea, a headland with a lighthouse, and a pier stretching out on the right. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  for (let y = HZ; y < SHORE + 6; y++) {
    const t = (y - HZ) / (SHORE + 6 - HZ);
    for (let x = 0; x < FAR_W; x++) {
      let c = mix('#3a5a9a', '#2a8aa8', t);
      const w = Math.sin(x * (0.22 - t * 0.14) + y * 1.9) + Math.sin(x * 0.05 + y * 0.8);
      if (w > 1.5 - t * 0.5) c = lighten(c, 0.2);
      else if (w < -1.4 && bayer(x, y) < 0.5) c = darken(c, 0.12);
      p.set(x, y, c);
    }
  }
  // a road of sun glitter on the water under the sun
  for (let y = HZ + 1; y < SHORE; y++) {
    const spread = 4 + (y - HZ) * 0.45;
    for (let x = Math.floor(70 - spread); x <= 70 + spread; x++) if (hash(x * 3.1 + y * 7.7) < 0.22) p.set(x, y, '#ffe8b0');
  }
  for (let x = 0; x < FAR_W; x++) p.set(x, HZ, '#f8d0a0');
  // a headland on the far left with a striped lighthouse
  for (let x = 0; x < 60; x++) {
    const top = HZ - Math.round(Math.max(0, 1 - x / 60) * 20 + Math.sin(x * 0.4));
    for (let y = top; y <= HZ; y++) p.set(x, y, y - top < 2 ? '#7a6a7a' : bayer(x, y) < 0.3 ? '#4a3a52' : '#5a4a62');
  }
  p.rect(14, HZ - 34, 6, 14, '#f0e8e0');
  p.rect(14, HZ - 30, 6, 3, '#d84a4a');
  p.rect(14, HZ - 24, 6, 3, '#d84a4a');
  p.rect(13, HZ - 38, 8, 4, '#3a3a48');
  p.rect(15, HZ - 37, 4, 2, '#fff4a0');
  // a long wooden pier on spindly pilings, a little shack at its end
  const PX = 196, PY = HZ + 18;
  for (let x = PX; x < FAR_W; x++) {
    p.set(x, PY, '#8a6a58');
    p.set(x, PY + 1, '#5a4040');
    if ((x - PX) % 7 === 0) p.rect(x, PY + 2, 1, 12, '#4a3438');
    if ((x - PX) % 7 === 0) p.rect(x, PY - 4, 1, 4, '#6a4c48');
  }
  for (let x = PX; x < FAR_W; x++) p.set(x, PY - 4, '#6a4c48');
  p.rect(PX + 60, PY - 12, 16, 12, '#c86a58');
  p.rect(PX + 60, PY - 12, 16, 2, '#f0e0c8');
  p.rect(PX + 66, PY - 7, 4, 7, '#4a2a2a');
  // sailboats out on the water
  for (const [bx, by] of [[120, HZ + 4], [160, HZ + 2]]) {
    for (let k = 0; k < 7; k++) p.rect(bx + 1, by - 9 + k, Math.ceil(k * 0.6) + 1, 1, '#fff0e0');
    p.rect(bx - 2, by - 1, 8, 2, '#3a4a7a');
  }
  return p.canvas();
}

/** A jointed stick of pixels; w is the thickness. */
function limb(p: Painter, x0: number, y0: number, x1: number, y1: number, w: number, c: Color) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) p.rect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, c);
}

/** Wet sand and the shoreline props: the lifeguard tower, a volleyball net, the boardwalk. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1213);
  for (let y = SHORE; y < SAND + 8; y++)
    for (let x = 0; x < MID_W; x++) {
      const wet = y < SHORE + 10;
      let c: Color = wet ? mix('#a89070', '#c8a878', (y - SHORE) / 10) : '#e0c48c';
      if (wet && Math.sin(x * 0.3 + y) > 0.85) c = '#f0d8b8';
      if (!wet && bayer(x, y) < 0.12) c = '#d0b07a';
      p.set(x, y, c);
    }
  // the boardwalk on the left: planks on posts with a rail, a snack hut and a row of benches
  const BW = 120, BY = SHORE - 4;
  for (let x = 0; x < BW; x++) {
    for (let y = BY; y < BY + 4; y++) p.set(x, y, y === BY ? '#d8a868' : x % 6 === 0 ? '#7a5030' : '#a87444');
    if (x % 12 === 0) p.rect(x, BY + 4, 2, SHORE + 14 - BY - 4, '#6a4428');
    if (x % 10 === 0) p.rect(x, BY - 8, 1, 8, '#f0e8d8');
  }
  p.rect(0, BY - 8, BW, 1, '#f0e8d8');
  p.rect(0, BY - 5, BW, 1, '#d8d0c0');
  const hx = 34;
  p.rect(hx, BY - 34, 40, 26, '#f0d8a8');
  for (let y = BY - 34; y < BY - 8; y += 3) p.rect(hx, y, 40, 1, '#d8bc88');
  p.rect(hx + 4, BY - 26, 32, 10, '#3a2a30');
  p.rect(hx + 4, BY - 18, 32, 2, '#c87848');
  for (let x = hx - 4; x < hx + 44; x++) {
    const stripe = Math.floor((x - hx + 4) / 4) % 2;
    for (let y = BY - 40; y < BY - 33; y++) p.set(x, y, stripe ? '#ffffff' : '#2a8ad0');
    if (stripe === 0) p.set(x, BY - 33, '#1a6ab0');
  }
  // three ice-cream cones painted on the sign board
  for (let k = 0; k < 3; k++) {
    const cx = hx + 10 + k * 10;
    p.poly([[cx - 2, BY - 22], [cx + 2, BY - 22], [cx, BY - 17]], '#d8a050');
    p.ellipse(cx, BY - 23, 2.5, 2, ['#ffb0c8', '#f8f0d8', '#a0e0b0'][k]);
  }
  // a volleyball net strung between two poles
  const nx = 300;
  p.rect(nx - 30, SHORE + 2, 1, 18, '#e8e0d0');
  p.rect(nx + 30, SHORE + 2, 1, 18, '#e8e0d0');
  for (let x = nx - 29; x < nx + 30; x++) {
    p.set(x, SHORE + 2, '#ffffff');
    for (let y = SHORE + 3; y < SHORE + 9; y++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) p.set(x, y, '#d8d0c0');
    p.set(x, SHORE + 9, '#ffffff');
  }
  // the lifeguard tower: a hut on braced stilts with a ramp, a red rail and a flag pole
  const tx = TOWER_X, base = SHORE + 18;
  for (const s of [-1, 1]) {
    limb(p, tx + s * 16, base, tx + s * 12, base - 34, 2, '#e8e0d0');
    p.set(tx + s * 16, base, '#a8a090');
  }
  limb(p, tx - 14, base - 6, tx + 13, base - 26, 1, '#c8c0b0');
  limb(p, tx + 14, base - 6, tx - 13, base - 26, 1, '#c8c0b0');
  // the ramp up to the deck
  limb(p, tx + 16, base - 34, tx + 44, base, 2, '#d8b888');
  for (let k = 0; k < 7; k++) p.rect(tx + 20 + k * 4, base - 29 + k * 5, 1, 2, '#a88858');
  p.rect(tx - 20, base - 36, 40, 3, '#d8d0c0');
  p.rect(tx - 20, base - 42, 40, 1, '#e83a3a');
  for (let x = tx - 20; x < tx + 20; x += 5) p.rect(x, base - 42, 1, 6, '#e83a3a');
  // the hut: pastel blue boards, wraparound windows and a peaked roof
  p.rect(tx - 15, base - 60, 30, 24, '#8ad0e8');
  for (let y = base - 60; y < base - 36; y += 3) p.rect(tx - 15, y, 30, 1, '#6ab0c8');
  p.rect(tx - 12, base - 56, 24, 9, '#2a4a6a');
  p.rect(tx - 12, base - 56, 24, 1, '#c8e8f8');
  p.rect(tx - 1, base - 56, 1, 9, '#e8f0f0');
  p.rect(tx - 15, base - 44, 30, 3, '#f0d040');
  p.poly([[tx - 20, base - 59], [tx, base - 70], [tx + 20, base - 59]], '#e8e0d0');
  p.line(tx - 20, base - 59, tx + 20, base - 59, '#b8b0a0');
  p.rect(tx + 12, base - 86, 1, 18, '#b8b8b8');
  // a red rescue float and a buoy ring hanging off the rail
  p.rect(tx - 26, base - 42, 4, 14, '#e83030');
  p.rect(tx - 26, base - 42, 1, 14, '#ff7a6a');
  p.rect(tx - 25, base - 44, 2, 2, '#202020');
  p.ellipse(tx + 24, base - 30, 4, 4, '#ff6a2a');
  for (let y = base - 32; y <= base - 28; y++) for (let x = tx + 22; x <= tx + 26; x++) if ((x - tx - 24) ** 2 + (y - base + 30) ** 2 < 4) p.set(x, y, [0, 0, 0], 0);
  for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) p.set(tx + 24 + dx, base - 30 + dy, '#ffffff');
  // a row of beach umbrellas and towels further along
  for (const [ux, c1, c2] of [[260, '#ffd040', '#ffffff'], [356, '#40b0a0', '#f8f0d8']] as [number, string, string][]) {
    p.rect(ux, SHORE + 2, 1, 16, '#e8e8e8');
    for (let x = -11; x <= 11; x++) {
      const yy = SHORE + 2 - Math.round(Math.sqrt(1 - (x / 12) ** 2) * 5);
      for (let y = yy; y <= SHORE + 3; y++) p.set(ux + x, y, Math.floor((x + 12) / 4) % 2 ? c1 : c2);
    }
    p.rect(ux + 3, SHORE + 17, 14, 3, c1);
    p.rect(ux + 3, SHORE + 18, 14, 1, c2);
  }
  // shells and pebbles on the wet sand
  for (let i = 0; i < 40; i++) p.set(r.int(0, MID_W), r.int(SHORE + 4, SAND + 6), r.pick(['#fff0e0', '#a89078', '#f0b0a0']));
  return p.canvas();
}

/** The near sand the fighters stand on: dry, rippled by wind, dotted with footprints and props. */
function ground(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1229);
  for (let y = SAND; y < H; y++) {
    const t = (y - SAND) / (H - SAND);
    for (let x = 0; x < STAGE_W; x++) {
      const ripple = Math.sin(x * 0.09 + Math.sin(y * 0.3 + x * 0.01) * 2.4 + y * 0.5);
      let c: Color = mix('#e8cc94', '#f4dcaa', t);
      if (ripple > 0.75) c = lighten(c, 0.12);
      else if (ripple < -0.7) c = darken(c, 0.08);
      if (bayer(x, y) < 0.05) c = darken(c, 0.12);
      p.set(x, y, c);
    }
  }
  for (let x = 0; x < STAGE_W; x++) p.set(x, SAND, '#fff0c8');
  // footprints wandering across the sand
  for (let trail = 0; trail < 5; trail++) {
    let x = r.int(0, STAGE_W), y = r.int(SAND + 6, H - 6);
    const dx = r.range(-1, 1) > 0 ? 9 : -9;
    for (let s = 0; s < 14; s++) {
      x += dx; y += r.int(-1, 1);
      if (y < SAND + 3 || y > H - 3) break;
      const off = s % 2 ? 2 : -2;
      p.ellipse(x, y + off, 1.5, 1, '#c8a870');
      p.set(x + Math.sign(dx), y + off, '#b89860');
    }
  }
  // a sandcastle on the left with a little flag
  const cx = 34, cb = 194;
  for (const [ox, w, h] of [[-12, 8, 12], [4, 8, 12], [-5, 10, 18]]) {
    p.rect(cx + ox, cb - h, w, h, '#d8b070');
    p.rect(cx + ox, cb - h, w, 1, '#f0d098');
    for (let k = 0; k < w; k += 2) p.set(cx + ox + k, cb - h - 1, '#d8b070');
    p.rect(cx + ox + w - 1, cb - h, 1, h, '#b89050');
  }
  p.rect(cx - 2, cb - 7, 3, 4, '#5a4020');
  p.rect(cx, cb - 26, 1, 8, '#ffffff');
  p.rect(cx + 1, cb - 26, 4, 3, '#e83a3a');
  p.rect(cx + 14, cb - 4, 6, 4, '#3a8ad8');
  p.rect(cx + 15, cb - 7, 1, 3, '#2a6ab0');
  // a striped towel and flip-flops in the middle-back
  p.rect(232, SAND + 6, 28, 8, '#f84a7a');
  for (let x = 232; x < 260; x += 4) p.rect(x, SAND + 6, 2, 8, '#ffd040');
  p.ellipse(266, SAND + 9, 2, 1, '#40a0e0');
  p.ellipse(266, SAND + 12, 2, 1, '#40a0e0');
  // a red rescue float left lying on the sand on the right, its strap trailing
  p.capsule(432, 186, 3, 456, 184, 3, '#e83030');
  p.line(432, 184, 456, 182, '#ff7a6a');
  p.line(456, 184, 470, 190, '#202020');
  p.line(470, 190, 476, 188, '#202020');
  // a cooler and a boombox
  p.rect(380, 176, 16, 10, '#2a8ad0');
  p.rect(380, 176, 16, 3, '#f0f0f0');
  p.rect(386, 174, 4, 2, '#d8d8d8');
  p.rect(120, 178, 16, 9, '#3a3a48');
  p.ellipse(124, 183, 2.5, 2.5, '#7a7a8a');
  p.ellipse(132, 183, 2.5, 2.5, '#7a7a8a');
  p.rect(126, 176, 4, 2, '#5a5a6a');
  // shells and pebbles
  for (let i = 0; i < 60; i++) {
    const x = r.int(0, STAGE_W), y = r.int(SAND + 3, H - 1);
    p.set(x, y, r.pick(['#fff4ec', '#c8a070', '#f0a8a0', '#a89888']));
  }
  return p.canvas();
}

// ------------------------------------------------------------------ the slow-motion lifeguards

/** One of the crew jogging the shoreline: a home x, how far they range, and their look. */
interface Jogger { x0: number; range: number; speed: number; phase: number; suit: string; skin: string; hair: string; long: boolean; carry: 'can' | 'ring' | 'none' }

const CREW: Jogger[] = [
  { x0: 150, range: 120, speed: 0.06, phase: 0.0, suit: '#e82a3a', skin: '#e8a878', hair: '#f8e078', long: true, carry: 'can' },
  { x0: 230, range: 140, speed: 0.05, phase: 2.2, suit: '#e82a3a', skin: '#b87a50', hair: '#3a2418', long: false, carry: 'ring' },
  { x0: 300, range: 90, speed: 0.07, phase: 4.1, suit: '#e82a3a', skin: '#f0c098', hair: '#8a4a20', long: true, carry: 'none' },
];
/** Frames per full stride: very long, because everything out there happens in slow motion. */
const STRIDE = 84;

export class LifeguardStage {
  name = 'RESCUE POINT';
  blurb = 'EVERYONE RUNS IN SLOW MOTION';
  song: SongName = 'lifeguard';
  sky = sky();
  far = far();
  mid = mid();
  ground = ground();
  pit = umbrellaPit();
  prev = new Map<object, { y: number; vy: number }>();
  lastSound = -1;

  /** The uppercut finish: the loser drops onto a planted beach umbrella, which then pops open over them. */
  pitLanding: PitLanding = {
    rest: 168,
    length: 170,
    pose: P(LIE, { rot: -100, h: 40, af: -60, ef: -20, ab: 60, lf: 30, kf: 40, lb: 40, kb: 50 }),
    land: (f) => this.skewer(f.pitParticles, 0),
    tick: (f, it) => this.skewer(f.pitParticles, it),
    draw: (ctx, it) => this.umbrellaDraw(ctx, it),
    drawFall: (ctx) => this.umbrellaDraw(ctx, -1),
  };

  reset() {
    this.prev.clear();
  }

  /** Sand kicks up when the fighters land hard. */
  update(f: Fight) {
    for (const ft of f.f) {
      const pv = this.prev.get(ft) ?? { y: ft.y, vy: 0 };
      if (ft.alpha > 0 && ft.y === 0 && pv.y > 0) {
        const big = Math.min(1, -pv.vy / 7);
        for (let i = 0; i < 8 + big * 14; i++) {
          const life = rand(14, 28);
          f.particles.add({ kind: 'spark', x: ft.x + rand(-7, 7), y: 1, vx: rand(-1.6, 1.6) * (0.6 + big), vy: rand(0.6, 2.2) * (0.6 + big), life, max: life, color: SAND_PUFF[i % 4], size: i % 4 ? 1 : 2, grav: 0.18, floor: true });
        }
        noise({ dur: 0.12 + big * 0.1, vol: 0.06 + big * 0.06, type: 'lowpass', freq: 900, to: 300 });
      }
      this.prev.set(ft, { y: ft.y, vy: ft.y - pv.y });
    }
  }

  /** Surf, gulls and a lifeguard's whistle now and then; keyed to frame numbers so redraws stay quiet. */
  sounds(t: number) {
    if (t === this.lastSound) return;
    this.lastSound = t;
    if (t % 300 === 0) noise({ dur: 1.8, vol: 0.07, type: 'lowpass', freq: 650, to: 140, attack: 0.4 });
    const c = ac();
    if (!c) return;
    if (t % 1200 === 600)
      for (let i = 0; i < 2; i++) tone({ type: 'triangle', freq: 2900, to: 2750, dur: i ? 0.4 : 0.12, vol: 0.03, at: c.currentTime + i * 0.18, attack: 0.01 });
    if (t % 900 === 300)
      for (let i = 0; i < 3; i++) tone({ type: 'triangle', freq: 1500 - i * 60, to: 950, dur: 0.18, vol: 0.03, at: c.currentTime + i * 0.22, attack: 0.03 });
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    this.sounds(t);
    ctx.drawImage(this.sky, 0, 0);
    // a pair of gulls gliding past
    for (let i = 0; i < 2; i++) {
      const gx = Math.round(((t * (0.2 + i * 0.08) + i * 120) % (W + 60)) - 30);
      const gy = Math.round(30 + i * 16 + Math.sin(t * 0.02 + i * 2) * 6);
      const up = ((t >> 3) + i) % 3 === 0;
      ctx.fillStyle = '#4a3a58';
      ctx.fillRect(gx - 3, gy - (up ? 2 : 0), 2, 1);
      ctx.fillRect(gx + 2, gy - (up ? 2 : 0), 2, 1);
      ctx.fillRect(gx - 1, gy, 3, 1);
    }
    const fx = -Math.round(camX * FAR_P);
    ctx.drawImage(this.far, fx, 0);
    const mx = -Math.round(camX * MID_P);
    ctx.drawImage(this.mid, mx, 0);
    this.drawSurf(ctx, mx, t);
    // the tower's flag flapping
    const fpx = mx + TOWER_X + 13, fpy = SHORE + 18 - 86;
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 3 === 2 ? '#f0f0f0' : '#e83a3a';
      ctx.fillRect(fpx + k, fpy + Math.round(Math.sin(t * 0.15 - k * 0.6) * 1.2), 1, 5);
    }
    for (const j of CREW) this.drawJogger(ctx, j, mx, t);
    ctx.drawImage(this.ground, -Math.round(camX), 0);
  }

  /** Waves running up the wet sand and sliding back, a foam lace at their edge. */
  drawSurf(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    const k = (t % 360) / 360;
    const reach = Math.sin(k * Math.PI) * 9;
    for (let x = 0; x < W; x++) {
      const wx = x - mx;
      const edge = Math.round(SHORE + reach + Math.sin(wx * 0.07 + t * 0.01) * 1.5 + Math.sin(wx * 0.21) * 0.8);
      ctx.fillStyle = 'rgba(80,170,190,0.55)';
      ctx.fillRect(x, SHORE - 2, 1, edge - SHORE + 2);
      ctx.fillStyle = hash(wx * 0.9 + Math.floor(t / 8)) < 0.75 ? '#ffffff' : '#d0f0f0';
      ctx.fillRect(x, edge, 1, 1);
      if (hash(wx * 2.3) < 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x, edge - 2, 1, 1);
      }
    }
  }

  /** Where a jogger is along their beat and which way they face, at frame t. */
  joggerAt(j: Jogger, t: number): [number, number] {
    const a = t * j.speed * 0.02 + j.phase;
    return [j.x0 + Math.sin(a) * j.range, Math.cos(a) >= 0 ? 1 : -1];
  }

  /** A lifeguard in heroic slow motion, trailing faint afterimages. */
  drawJogger(ctx: CanvasRenderingContext2D, j: Jogger, mx: number, t: number) {
    for (const [lag, a] of [[24, 0.18], [12, 0.32], [0, 1]]) {
      const [x, dir] = this.joggerAt(j, t - lag);
      const sx = Math.round(x + mx);
      if (sx < -20 || sx > W + 20) continue;
      ctx.globalAlpha = a;
      this.jogFrame(ctx, j, sx, dir, t - lag);
    }
    ctx.globalAlpha = 1;
  }

  jogFrame(ctx: CanvasRenderingContext2D, j: Jogger, x: number, dir: number, t: number) {
    const ph = ((t + j.phase * 40) / STRIDE) * Math.PI * 2;
    const bob = -Math.round(Math.abs(Math.sin(ph)) * 2);
    const y = JOG_Y + bob;
    const px = (dx: number, dy: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(dir > 0 ? x + dx : x - dx - w + 1, y + dy, w, h);
    };
    const stick = (x0: number, y0: number, x1: number, y1: number, c: string) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) px(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 1, c);
    };
    const back = darken(j.skin, 0.2);
    // legs: big, floaty strides
    for (const s of [1, -1]) {
      const a = Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.7;
      const kx = Math.round(Math.sin(a) * 5), ky = -9 + Math.round(Math.cos(a) * 5);
      const bend = a < 0 ? 0.9 : 0.15;
      const fx = kx + Math.round(Math.sin(a - bend) * 5), fy = ky + Math.round(Math.cos(a - bend) * 5);
      const c = s > 0 ? j.skin : css(back);
      stick(0, -10, kx, ky, c);
      stick(kx, ky, fx, Math.min(0, fy), c);
    }
    // swimsuit: a one-piece for the long-haired crew, trunks otherwise
    px(-1, -12, 4, 3, j.suit);
    if (j.long) {
      px(-1, -18, 4, 7, j.suit);
      px(-1, -19, 1, 1, j.skin);
      px(2, -19, 1, 1, j.skin);
      // the comic slow-motion bounce, lagging a beat behind each stride
      const b = Math.round(Math.sin(ph * 2 - 1.4) * 1.5);
      px(2, -17 + b, 3, 3, j.suit);
      px(4, -16 + b, 1, 1, '#ff6a6a');
    } else {
      px(-1, -19, 4, 7, j.skin);
      px(0, -17, 2, 1, css(back));
    }
    // arms pumping against the legs
    for (const s of [1, -1]) {
      const a = Math.sin(ph + (s > 0 ? Math.PI : 0)) * 0.9;
      const hx = Math.round(Math.sin(a) * 4), hy = -18 + Math.round(Math.cos(a) * 4);
      stick(1, -18, hx + 1, hy, s > 0 ? j.skin : css(back));
      if (s > 0 && j.carry === 'can') px(hx - 1, hy - 1, 6, 2, '#ff3a2a');
      if (s > 0 && j.carry === 'ring') {
        px(hx - 1, hy - 2, 4, 1, '#ff8a2a');
        px(hx - 1, hy + 2, 4, 1, '#ff8a2a');
        px(hx - 2, hy - 1, 1, 3, '#ff8a2a');
        px(hx + 3, hy - 1, 1, 3, '#ff8a2a');
      }
    }
    // head and hair streaming out behind in the sea breeze
    px(0, -24, 4, 5, j.skin);
    px(3, -22, 1, 1, '#202020');
    px(-1, -25, 5, 2, j.hair);
    if (j.long) for (let k = 1; k <= 6; k++) px(-1 - k, -24 + Math.round(Math.sin(ph * 0.5 + k * 0.7) * 1.2) + (k >> 1), 1, 2, j.hair);
    else px(-2, -25, 1, 3, j.hair);
  }

  drawFront(_ctx: CanvasRenderingContext2D, _camX: number, _t: number) {}

  // ------------------------------------------------------------------ the umbrella finish

  skewer(p: Particles, it: number) {
    if (it === 0) {
      sfx.impale();
      p.blood(128, H - UMB_Y, 1, 50, 1.4);
      for (let i = 0; i < 24; i++) {
        const life = rand(20, 40);
        p.add({ kind: 'spark', x: 128 + rand(-20, 20), y: H - SAND_PIT, vx: rand(-1.8, 1.8), vy: rand(0.6, 2.6), life, max: life, color: SAND_PUFF[i % 4], size: i % 3 ? 1 : 2, grav: 0.18, floor: false });
      }
    }
    if (it === POP) {
      // the canopy springs open with a whoomp
      noise({ dur: 0.2, vol: 0.18, type: 'bandpass', freq: 700, to: 1800, q: 0.8 });
      tone({ type: 'triangle', freq: 300, to: 700, dur: 0.15, vol: 0.12 });
    }
    if (it > 0 && it % 6 === 0) p.blood(128 + rand(-6, 6), H - UMB_Y - 4, rand(-1, 1), 2, 0.5);
  }

  /** The pole poking up through the victim and the striped canopy above, closed until it pops. */
  umbrellaDraw(ctx: CanvasRenderingContext2D, it: number) {
    if (it < 0) return;
    const tip = UMB_Y - 32;
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(127, tip, 2, UMB_Y - 8 - tip);
    ctx.fillStyle = '#a01818';
    ctx.fillRect(127, UMB_Y - 18, 2, 8);
    // canopy: furled, then springing open with a little overshoot
    const k = it < POP ? 0 : Math.min(1, (it - POP) / 6);
    const open = k < 1 ? k * 1.15 : 1 + Math.sin((it - POP - 6) * 0.5) * 0.06 * Math.max(0, 1 - (it - POP - 6) / 20);
    const rx = Math.round(4 + open * 30), hgt = Math.round(14 - open * 6);
    for (let x = -rx; x <= rx; x++) {
      const yy = tip - Math.round(Math.sqrt(Math.max(0, 1 - (x / (rx + 1)) ** 2)) * hgt);
      const stripe = Math.floor(((x + rx) / (rx * 2 + 1)) * 8) % 2;
      ctx.fillStyle = stripe ? '#ffffff' : '#ff4a6a';
      ctx.fillRect(128 + x, yy, 1, tip - yy + 2);
      ctx.fillStyle = stripe ? '#d8d8e0' : '#c82a4a';
      ctx.fillRect(128 + x, tip + 1, 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(127, tip - hgt - 3, 2, 3);
  }
}

/** Screen y of the sand in the finish close-up, and where the victim comes to rest above it. */
const SAND_PIT = 196;
const UMB_Y = 168;
/** Frame after landing when the umbrella pops open. */
const POP = 40;

const css = (c: Color) => (typeof c === 'string' ? c : `rgb(${c[0]},${c[1]},${c[2]})`);

/** Finish backdrop: a close-up on the sand at sunset with the pole planted in it and a crab nearby. */
function umbrellaPit(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1237);
  p.gradRect(0, 0, W, 120, '#5a64b8', '#ffc890', 6);
  for (let y = 120; y < 160; y++)
    for (let x = 0; x < W; x++) {
      let c = mix('#3a6aa0', '#2a8aa8', (y - 120) / 40);
      if (Math.sin(x * 0.2 + y * 1.7) > 0.9) c = lighten(c, 0.25);
      p.set(x, y, c);
    }
  for (let x = 0; x < W; x++) {
    const e = 160 + Math.round(Math.sin(x * 0.06) * 2);
    p.set(x, e - 1, '#ffffff');
    for (let y = e; y < SAND_PIT; y++) p.set(x, y, mix('#b89a70', '#e0c48c', (y - e) / (SAND_PIT - e)));
    for (let y = SAND_PIT; y < H; y++) p.set(x, y, bayer(x, y) < 0.1 ? '#d0b07a' : y === SAND_PIT ? '#fff0c8' : '#ecd29c');
  }
  // the low sun on the horizon
  for (let y = -12; y <= 0; y++) for (let x = -14; x <= 14; x++) if (x * x + y * y < 196) p.set(200 + x, 120 + y, '#fff0b0');
  // the pole, planted deep in the sand below the victim
  p.rect(127, UMB_Y - 8, 2, SAND_PIT - UMB_Y + 10, '#d8d8d8');
  p.rect(128, UMB_Y - 8, 1, SAND_PIT - UMB_Y + 10, '#a8a8b0');
  for (let x = 120; x < 137; x++) p.set(x, SAND_PIT, '#c8a870');
  // a crab watching from the side, a bucket and spade
  const cx = 60, cy = 206;
  p.ellipse(cx, cy, 6, 3, '#e8502a');
  p.rect(cx - 3, cy - 5, 1, 2, '#e8502a');
  p.rect(cx + 2, cy - 5, 1, 2, '#e8502a');
  p.set(cx - 3, cy - 6, '#101010');
  p.set(cx + 2, cy - 6, '#101010');
  p.ellipse(cx - 9, cy - 3, 2, 2, '#ff6a3a');
  p.ellipse(cx + 9, cy - 3, 2, 2, '#ff6a3a');
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) p.line(cx + s * 4, cy + 1, cx + s * (7 + k), cy + 3 + k, '#c83a1a');
  p.poly([[184, 200], [198, 200], [196, 214], [186, 214]], '#ffd040');
  p.rect(184, 200, 14, 1, '#fff080');
  p.line(204, 196, 212, 214, '#3a8ad8');
  for (let i = 0; i < 40; i++) p.set(r.int(0, W), r.int(SAND_PIT + 2, H), r.pick(['#fff4ec', '#c8a070', '#f0a8a0']));
  return p.canvas();
}
