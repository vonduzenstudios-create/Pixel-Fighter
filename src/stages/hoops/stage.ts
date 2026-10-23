import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { drawText } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { noise, tone } from '../../audio/audio';
import { P, LIE, LAUNCHED } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "The Hardwood": a packed indoor basketball arena on game night. A glossy maple court with
// a hoop at each end, a two-deck bowl of fans, an LED ribbon and a centre-hung jumbotron that
// keeps the fight clock. A loose ball rolls around the court: kick or uppercut it through a
// hoop for points. Every layer is painted procedurally at load time. The home colours (crimson
// and gold) and all signage are original; there are no league or team marks anywhere.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
const JUMBO_PAR = 0.4;
const COURT_TOP = 183; // far sideline
const HOME = '#b4202a', GOLD = '#f0b830', AWAY = '#203a78';
const LINE = '#f4efe2';

// Hoops, in world x. The rim hangs well over the fighters' heads, at y 64 on screen.
const RIM_Y = 64;
const RIM_H = FLOOR - RIM_Y;
const BOARD_TOP = RIM_Y - 28, BOARD_BOT = RIM_Y + 4;
const RIM_R = 9;
const HOOPS = [
  { board: 26, rim: 39, dir: 1 },
  { board: STAGE_W - 26, rim: STAGE_W - 39, dir: -1 },
];
const BALL_R = 4;
const BALL_G = 0.3;

interface Fan { x: number; y: number; h: number; w: number; shirt: string; skin: string; ph: number; hype: number; prop: 0 | 1 | 2 }
interface Ball { x: number; h: number; vx: number; vy: number; spin: number; last: number; from: number }
interface Confetti { x: number; y: number; vx: number; vy: number; c: string; life: number }

/** Sounds the arena makes on its own: rim clang, swish, buzzer and the crowd. */
const arenaSfx = {
  clang(v = 1) {
    tone({ type: 'triangle', freq: 620, to: 560, dur: 0.25, vol: 0.12 * v });
    tone({ type: 'square', freq: 1540, to: 1480, dur: 0.12, vol: 0.03 * v, filter: { type: 'bandpass', freq: 1600, q: 4 } });
    noise({ dur: 0.04, vol: 0.08 * v, type: 'highpass', freq: 3000 });
  },
  bounce(v = 1) {
    tone({ type: 'sine', freq: 180, to: 70, dur: 0.1, vol: 0.18 * v });
    noise({ dur: 0.03, vol: 0.05 * v, type: 'bandpass', freq: 900, q: 2 });
  },
  swish() {
    noise({ dur: 0.28, vol: 0.2, type: 'bandpass', freq: 5200, to: 1800, q: 1.4, attack: 0.04 });
    noise({ dur: 0.18, vol: 0.08, type: 'highpass', freq: 6000, attack: 0.02 });
  },
  buzzer() {
    for (const f of [196, 207]) tone({ type: 'square', freq: f, dur: 1.1, vol: 0.06, filter: { type: 'lowpass', freq: 1400 } });
    tone({ type: 'sawtooth', freq: 98, dur: 1.1, vol: 0.04, filter: { type: 'lowpass', freq: 600 } });
  },
  cheer(v = 1) {
    noise({ dur: 2.2, vol: 0.12 * v, type: 'bandpass', freq: 1100, to: 800, q: 0.6, attack: 0.25 });
    noise({ dur: 1.8, vol: 0.06 * v, type: 'bandpass', freq: 2600, q: 0.8, attack: 0.2 });
    // a few voices whooping over the top
    for (let i = 0; i < 4; i++) {
      const f = rand(500, 900);
      tone({ type: 'triangle', freq: f, to: f * rand(1.2, 1.5), dur: rand(0.3, 0.6), vol: 0.025 * v, attack: 0.08, at: undefined });
    }
  },
};

/** The roof: steel trusses, banners and the dark upper reaches of the bowl. */
function backWall(): HTMLCanvasElement {
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, H, '#0c0c1a', '#1a1626', 8);
  // roof trusses: a lattice of girders running across the top
  for (const y0 of [2]) {
    p.rect(0, y0, W, 2, '#3a3e4c');
    p.rect(0, y0 + 12, W, 2, '#30343e');
    for (let x = 0; x < W; x += 12) {
      p.line(x, y0 + 2, x + 6, y0 + 12, '#2a2e38');
      p.line(x + 6, y0 + 12, x + 12, y0 + 2, '#2a2e38');
    }
  }
  // banners hanging from the rafters: plain stripes and stars, no lettering
  for (const [bx, c, n] of [[18, HOME, 1], [44, AWAY, 3], [204, HOME, 2], [230, '#2a6a3a', 1]] as [number, string, number][]) {
    p.rect(bx, 20, 18, 26, c);
    p.poly([[bx, 46], [bx + 9, 51], [bx + 18, 46]], c);
    p.rect(bx, 23, 18, 2, GOLD);
    p.rect(bx, 40, 18, 2, GOLD);
    for (let i = 0; i < n; i++) {
      const sx = bx + 9 + (i - (n - 1) / 2) * 5, sy = 32;
      p.set(sx, sy - 2, GOLD);
      p.rect(sx - 2, sy - 1, 5, 1, GOLD);
      p.rect(sx - 1, sy, 3, 2, GOLD);
    }
    p.line(bx + 2, 20, bx + 2, 16, '#222');
    p.line(bx + 15, 20, bx + 15, 16, '#222');
  }
  // banks of arena lights along the catwalk
  for (let x = 8; x < W; x += 22) {
    p.rect(x, 14, 8, 3, '#20222a');
    p.rect(x + 1, 16, 6, 1, '#fff6d0');
  }
  return p.canvas();
}

/** Upper deck: suites, a steep bank of tiny fans and the LED ribbon rail. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(2201);
  // suite level: a row of glowing glass boxes
  p.rect(0, 54, FAR_W, 14, '#1c1a24');
  for (let x = 2; x < FAR_W; x += 14) {
    p.rect(x, 57, 11, 8, r.next() < 0.75 ? '#5a5a3a' : '#2a2a30');
    p.rect(x, 57, 11, 1, '#8a8a60');
    if (r.next() < 0.5) p.rect(x + r.int(2, 8), 61, 2, 4, '#1a1414');
  }
  p.rect(0, 68, FAR_W, 2, '#3a3a46');
  // the upper bowl: rows of seats, mostly full, with aisle stairs
  const shirts = [HOME, HOME, GOLD, '#e8e0d0', AWAY, '#3a3a3a', HOME];
  for (let row = 0; row < 9; row++) {
    const y = 72 + row * 6;
    p.rect(0, y + 4, FAR_W, 1, '#24202c');
    for (let x = row % 2; x < FAR_W; x += 3) {
      if (x % 46 < 4) continue; // aisle
      if (r.next() < 0.08) { p.rect(x, y + 2, 2, 2, '#4a2a30'); continue; } // empty seat
      const c = mix(r.pick(shirts), '#14101c', 0.5 - row * 0.03);
      p.rect(x, y + 1, 2, 3, c);
      p.set(x, y, mix(r.pick(['#d8a880', '#8a5a40', '#5a3424', '#e8c0a0']), '#14101c', 0.45));
    }
  }
  for (let x = 0; x < FAR_W; x += 46) for (let y = 72; y < 126; y += 2) p.rect(x, y, 4, 1, '#3a3640');
  // LED ribbon housing (the animated face is drawn live)
  p.rect(0, 125, FAR_W, 9, '#0a0a10');
  // the lower bowl's back wall, in shadow
  p.gradRect(0, 134, FAR_W, H - 134, '#1a1622', '#100e16', 4);
  return p.canvas();
}

/** The lower-bowl crowd, generated once and animated each frame. */
function crowd(): Fan[] {
  const r = rng(2213);
  const shirts = [HOME, HOME, HOME, GOLD, GOLD, '#f0ece0', AWAY, AWAY, '#2a2a2a', '#5a5a64'];
  const skins = ['#e8c0a0', '#d8a880', '#a87050', '#7a4a30', '#5a3424', '#f0d0b0'];
  const fans: Fan[] = [];
  for (let row = 0; row < 3; row++)
    for (let x = r.int(0, 6); x < MID_W; x += r.int(8, 12))
      fans.push({ x, y: 150 + row * 10, h: r.int(22, 28), w: r.int(8, 11), shirt: r.pick(shirts), skin: r.pick(skins), ph: r.range(0, 6.28), hype: r.range(0.35, 1), prop: r.next() < 0.1 ? 1 : r.next() < 0.08 ? 2 : 0 });
  return fans;
}

/** Hardwood boards, paint and the courtside furniture, across the whole floor. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(2221);
  // courtside LED boards along the far sideline (animated face drawn live)
  p.rect(60, 168, STAGE_W - 120, 15, '#0a0a10');
  p.rect(60, 168, STAGE_W - 120, 1, '#44444e');
  // scorer's table at centre court
  p.rect(206, 160, 100, 23, '#16161e');
  p.rect(206, 160, 100, 2, '#4a4a56');
  for (let x = 214; x < 300; x += 18) {
    p.rect(x, 155, 8, 5, '#2a2a34'); // monitors
    p.rect(x + 1, 156, 6, 3, '#3a6a8a');
  }
  // benches: folding chairs with players waiting in warm-ups
  for (const [x0, team] of [[100, HOME], [338, AWAY]] as [number, string][]) {
    for (let i = 0; i < 5; i++) {
      const cx = x0 + i * 15;
      p.rect(cx, 166, 10, 2, '#5a5a62');
      p.rect(cx + 1, 168, 1, 6, '#3a3a42');
      p.rect(cx + 8, 168, 1, 6, '#3a3a42');
      if (r.next() < 0.75) {
        const skin = r.pick(['#d8a880', '#8a5a40', '#5a3424', '#a87050']);
        p.rect(cx + 2, 150, 6, 16, team);
        p.rect(cx + 2, 154, 6, 1, lighten(team, 0.4));
        p.rect(cx + 3, 144, 4, 6, skin);
        p.rect(cx + 3, 143, 4, 1, '#1a1210');
        if (r.next() < 0.4) p.rect(cx + 1, 150, 8, 2, '#f0f0e8'); // towel
      }
    }
  }
  // the floor: maple boards running the length of the court, glossy under the lights
  for (let y = COURT_TOP; y < H; y++) {
    const k = (y - COURT_TOP) / (H - COURT_TOP);
    const board = Math.floor(Math.pow(k, 0.8) * 16);
    const seamY = Math.floor(Math.pow((y + 1 - COURT_TOP) / (H - COURT_TOP), 0.8) * 16) !== board;
    for (let x = 0; x < STAGE_W; x++) {
      const len = 40 + (board % 3) * 14;
      const seg = Math.floor((x + board * 23) / len);
      const tint = ((seg * 7 + board * 3) % 5) * 0.035;
      let c: Color = mix('#d89a58', '#b87638', tint * 3);
      if (seamY) c = darken(c, 0.18);
      if ((x + board * 23) % len === 0) c = darken(c, 0.25);
      if (bayer(x, y) < 0.08 + Math.sin(x * 0.21 + board) * 0.04) c = darken(c, 0.07); // grain
      // a varnish sheen under each bank of lights
      const glow = Math.max(0, Math.cos(((x % 96) - 48) / 48 * Math.PI)) * (1 - k) * 0.4;
      if (bayer(x, y) < glow) c = lighten(c, 0.18);
      p.set(x, y, c);
    }
  }
  // paint: the keys in home crimson, free-throw circles and three-point arcs
  for (const hp of HOOPS) {
    const base = hp.dir === 1 ? 0 : STAGE_W;
    const ft = base + hp.dir * 80;
    for (let y = 192; y < 214; y++)
      for (let x = Math.min(base, ft); x < Math.max(base, ft); x++) p.set(x, y, mix(p.get(x, y), HOME, 0.75));
    for (let x = Math.min(base, ft); x < Math.max(base, ft); x++) { p.set(x, 192, LINE); p.set(x, 213, LINE); }
    for (let y = 192; y < 214; y++) p.set(ft, y, LINE);
    ring(p, ft, 202.5, 16, 10.5, LINE, (x) => (x - ft) * hp.dir >= 0);
    ring(p, hp.rim, 203, 150, 20, LINE, (x) => (x - hp.rim) * hp.dir >= 0);
    // short block marks along the lane
    for (const o of [20, 32, 44]) { p.rect(base + hp.dir * o, 190, 2, 2, LINE); p.rect(base + hp.dir * o, 214, 2, 2, LINE); }
  }
  // half-court line and the centre circle with a gold ring
  for (let y = COURT_TOP; y < H; y++) p.rect(255, y, 2, 1, LINE);
  ring(p, 256, 203, 36, 10, LINE);
  for (let y = 196; y < 211; y++)
    for (let x = 240; x < 273; x++) {
      const dx = (x - 256) / 15, dy = (y - 203) / 6.5;
      const d = dx * dx + dy * dy;
      if (d <= 1) p.set(x, y, d > 0.6 ? GOLD : mix(p.get(x, y), HOME, 0.7));
    }
  // sideline and baselines
  p.rect(0, COURT_TOP, STAGE_W, 1, LINE);
  p.rect(2, COURT_TOP, 1, H - COURT_TOP, LINE);
  p.rect(STAGE_W - 3, COURT_TOP, 1, H - COURT_TOP, LINE);
  // the hoop stanchions and backboards (rims and nets are drawn live, in front of the ball)
  for (const hp of HOOPS) {
    const d = hp.dir, base = hp.dir === 1 ? 0 : STAGE_W - 1;
    // padded base and the support arm
    p.rect(Math.min(base, base + d * 18), 146, 19, 38, '#16161e');
    p.rect(Math.min(base, base + d * 18), 146, 19, 4, HOME);
    p.rect(Math.min(base, base + d * 18), 172, 19, 3, GOLD);
    for (let y = BOARD_TOP - 4; y < 146; y++) p.rect(base + d * 6 - (d < 0 ? 2 : 0), y, 3, 1, y % 20 < 2 ? '#2a2a32' : '#5a5e6a');
    p.line(base + d * 6, BOARD_TOP, hp.board - d * 2, BOARD_TOP + 14, '#5a5e6a');
    p.line(base + d * 6, BOARD_TOP + 8, hp.board - d * 2, BOARD_TOP + 22, '#4a4e58');
    // backboard seen nearly edge-on: a slab of glass with a shooter's square on it
    for (let y = BOARD_TOP; y < BOARD_BOT; y++)
      for (let k = -3; k <= 3; k++) {
        const x = hp.board + k;
        const edge = y === BOARD_TOP || y === BOARD_BOT - 1 || Math.abs(k) === 3;
        p.set(x, y, edge ? '#e8eef4' : mix('#7a90a8', '#c8d8e8', (y - BOARD_TOP) / 40), edge ? 255 : 150);
      }
    p.rect(hp.board - 1, RIM_Y - 10, 3, 10, '#d84a1a');
    p.rect(hp.board, RIM_Y - 8, 1, 6, '#c8d8e8');
    // rim bracket
    p.rect(Math.min(hp.board + d * 3, hp.board + d * 5), RIM_Y - 2, 3, 3, '#a03a10');
  }
  // the floor's edge at the bottom of the screen
  for (let x = 0; x < STAGE_W; x++) if (bayer(x, H - 1) < 0.5) p.set(x, H - 1, '#8a5a2a');
  return p.canvas();
}

/** An ellipse outline, optionally only where keep(x) holds, clipped to the court. */
function ring(p: Painter, cx: number, cy: number, rx: number, ry: number, c: Color, keep: (x: number) => boolean = () => true) {
  const n = Math.ceil((rx + ry) * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (y < COURT_TOP || y >= H || x < 0 || x >= STAGE_W || !keep(x)) continue;
    p.set(x, y, c);
  }
}

export class HoopsStage {
  name = 'THE HARDWOOD';
  blurb = 'NOTHING BUT NET';
  song: SongName = 'hoops';
  wall = backWall();
  far = far();
  fans = crowd();
  deck = deck();
  pit: HTMLCanvasElement;
  /** The front of the rim and the net, drawn over the victim in the finish close-up. */
  net: HTMLCanvasElement;
  ball: Ball = { x: STAGE_W / 2, h: BALL_R, vx: 0, vy: 0, spin: 0, last: -1, from: 0 };
  /** Points each player has dunked, kicked or uppercut through a hoop this match. */
  score = [0, 0];
  clock = 99;
  /** Frames left on the jumbotron's "SWISH" replay, the net's sway, and the crowd's roar. */
  replay = 0;
  replayText = '';
  netSway = [0, 0];
  roar = 0;
  confetti: Confetti[] = [];
  clangCool = 0;
  ft = 0;

  constructor(bones: PartSet) {
    const [pit, front] = this.buildPit(bones);
    this.pit = pit;
    this.net = front;
  }

  reset() {
    this.ball = { x: STAGE_W / 2, h: BALL_R, vx: 0, vy: 0, spin: 0, last: -1, from: STAGE_W / 2 };
    this.score = [0, 0];
    this.replay = 0;
    this.roar = 0;
    this.confetti = [];
    this.clock = 99;
  }

  // ----------------------------------------------------------------- the uppercut finish

  /** Close-up under a giant hoop: the victim comes down out of the rafters head-first into the net. */
  buildPit(bones: PartSet): [HTMLCanvasElement, HTMLCanvasElement] {
    const p = new Painter(W, H);
    const r = rng(2237);
    p.gradRect(0, 0, W, H, '#14121e', '#2a2030', 6);
    // packed stands out of focus behind the hoop: soft blobs of colour and flashbulbs
    for (let i = 0; i < 900; i++) {
      const x = r.int(0, W), y = r.int(40, 200);
      p.set(x, y, mix(r.pick([HOME, GOLD, '#e8e0d0', AWAY, '#3a3a40']), '#14121e', 0.55));
    }
    for (let i = 0; i < 60; i++) {
      const x = r.int(0, W), y = r.int(50, 190), c = mix(r.pick([HOME, GOLD, '#e8e0d0', AWAY]), '#1a1622', 0.4);
      p.ellipse(x, y, 3, 3, c);
    }
    // the backboard, huge: a sheet of glass with a white frame and a shooter's square
    for (let y = 14; y < 112; y++)
      for (let x = 30; x < 226; x++) {
        const frame = y < 18 || y > 107 || x < 34 || x > 221;
        if (frame) p.set(x, y, y < 18 || x < 34 ? '#ffffff' : '#c8ccd4');
        else p.set(x, y, mix(p.get(x, y), '#a8c0d8', 0.35 + (bayer(x, y) < 0.1 ? 0.15 : 0)));
      }
    // reflections streaking across the glass
    for (let i = 0; i < 3; i++) p.line(60 + i * 50, 18, 100 + i * 50, 107, '#d8e8f4');
    for (let y = 66; y < 112; y++) for (const x of [92, 93, 94, 162, 163, 164]) p.set(x, y, '#e8401a');
    for (let x = 92; x < 165; x++) for (const y of [66, 67, 68]) p.set(x, y, '#e8401a');
    // padding under the board
    p.rect(30, 112, 196, 6, HOME);
    p.rect(30, 112, 196, 1, lighten(HOME, 0.3));
    // the back half of the rim, and its bracket
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI + (i / 64) * Math.PI;
      const x = Math.round(128 + Math.cos(a) * 36), y = Math.round(122 + Math.sin(a) * 9);
      p.rect(x - 1, y - 1, 3, 3, '#a02808');
    }
    p.rect(118, 112, 20, 6, '#802008');
    // arena floor glimpsed below
    p.gradRect(0, 196, W, H - 196, '#b87a40', '#7a4a20', 4);
    for (let x = 0; x < W; x++) p.set(x, 196, '#e8b070');
    p.rect(0, 206, W, 1, LINE);
    // a camera crew's lens glinting from the baseline
    p.rect(14, 176, 18, 20, '#1a1a20');
    p.ellipse(34, 184, 5, 5, '#2a2a34');
    p.ellipse(34, 184, 2, 2, '#6a8ab0');
    const cv = p.canvas();
    // a teammate already sprawled on the floor below
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(206, 204);
    ctx.scale(-1, 1);
    drawRig(ctx, bones, fk(P(LIE, { rot: -95, af: -120, ab: 40, lf: -20, kf: 60, h: 30 })));
    ctx.restore();

    // in front of the victim: the front of the rim and the net they get stuck in
    const f = new Painter(W, H);
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI;
      const x = Math.round(128 + Math.cos(a) * 36), y = Math.round(122 + Math.sin(a) * 9);
      f.rect(x - 1, y - 1, 3, 3, '#e84a14');
      f.set(x, y - 1, '#ff8a4a');
    }
    // the net: diamond mesh tapering from the rim to a narrow mouth
    const top = 124, bot = 190;
    for (let y = top; y < bot; y++) {
      const k = (y - top) / (bot - top);
      const half = 34 - k * 16;
      for (let x = Math.floor(128 - half); x <= 128 + half; x++) {
        const u = (x - 128) / half; // -1..1 across the net
        const s = u * 4 + k * 9, s2 = u * 4 - k * 9;
        const on = Math.abs(s - Math.round(s)) < 0.07 || Math.abs(s2 - Math.round(s2)) < 0.07;
        if (on) f.set(x, y, bayer(x, y) < 0.3 ? '#c8c8c0' : '#f4f4ec');
      }
    }
    for (let x = 112; x <= 144; x += 2) f.set(x, bot, '#e0e0d8');
    return [cv, f.canvas()];
  }

  /** Where the victim lands in the net, and how far they slide into it. */
  pitLanding: PitLanding = {
    pose: P(LAUNCHED, { rot: 180 }),
    // head-first in the net, legs kicking, slowly sliding deeper
    victim: (l, it) => {
      l.poseOverride = P(LAUNCHED, { rot: 180 + Math.sin(it * 0.4) * 10 });
      l.computePose();
      return Math.min(22, it * 0.5);
    },
    draw: (ctx) => ctx.drawImage(this.net, 0, 0),
    drawFall: (ctx) => ctx.drawImage(this.net, 0, 0),
    land: (f: Fight) => {
      arenaSfx.swish();
      arenaSfx.buzzer();
      arenaSfx.cheer(1.3);
      f.shake(8);
      for (let i = 0; i < 4; i++) f.pitParticles.flash(rand(20, W - 20), H - rand(60, 180), 10, '#ffffff');
      this.burst(f, 70);
    },
    tick: (f: Fight, it: number) => {
      if (it % 3 === 0) this.burst(f, 2);
      if (it % 25 === 0) f.pitParticles.flash(rand(10, W - 10), H - rand(60, 190), 6, '#ffffff');
      if (it === 60) arenaSfx.cheer(0.8);
    },
  };

  /** Confetti raining from the rafters in the finish close-up. */
  burst(f: Fight, n: number) {
    for (let i = 0; i < n; i++) {
      const life = rand(90, 160);
      f.pitParticles.add({ kind: 'spark', x: rand(0, W), y: H + rand(0, 40), vx: rand(-0.4, 0.4), vy: rand(-0.6, -0.2), life, max: life, grav: 0.004, color: [HOME, GOLD, '#ffffff', '#f4d060'][Math.floor(rand(0, 4))], size: rand(1, 2.5), floor: false });
    }
  }

  // ----------------------------------------------------------------- the loose ball

  update(f: Fight) {
    this.ft++;
    this.clock = f.timer;
    if (this.replay > 0) this.replay--;
    if (this.roar > 0) this.roar--;
    if (this.clangCool > 0) this.clangCool--;
    for (let i = 0; i < 2; i++) this.netSway[i] *= 0.9;
    for (const c of this.confetti) {
      c.life--;
      c.x += c.vx + Math.sin((c.life + c.x) * 0.1) * 0.3;
      if (c.y < FLOOR) c.y += c.vy;
      else c.vx = 0;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0);
    const b = this.ball;
    f.f.forEach((ft, i) => {
      if (ft.alpha <= 0 || ft.state === 'thrown') return;
      const [x0, y0, x1, y1] = ft.hurtbox();
      // walking into the ball nudges it along like a dribble
      if (b.h - BALL_R < y1 && b.h + BALL_R > y0 && b.x > x0 - BALL_R && b.x < x1 + BALL_R) {
        const left = b.x - (x0 - BALL_R), right = x1 + BALL_R - b.x;
        const push = Math.abs(ft.vx) + 0.6;
        if (left < right) { b.x = x0 - BALL_R; b.vx = Math.min(b.vx, -push); } else { b.x = x1 + BALL_R; b.vx = Math.max(b.vx, push); }
        if (b.h <= BALL_R + 0.5 && Math.abs(ft.vx) > 1) b.vy = 1.6;
        this.touch(i);
      }
      // any strike that reaches it sends it flying; an uppercut sends it toward the rafters
      const sp = ft.strikePoint();
      if (sp) {
        const dx = b.x - sp.x, dy = b.h - sp.y, rr = sp.hit.r + BALL_R + 3;
        if (dx * dx + dy * dy < rr * rr) {
          const up = ft.move?.id === 'uppercut';
          b.vx = ft.facing * (up ? 2.2 : 2.5 + sp.hit.dmg / 22) * rand(0.85, 1.15);
          b.vy = up ? rand(9.5, 11) : sp.hit.effect === 'launch' ? rand(7, 8.5) : 2 + sp.hit.dmg / 30 + (sp.hit.level === 'low' ? -1 : 1);
          b.spin = ft.facing * 0.3;
          this.touch(i);
          arenaSfx.bounce(1.2);
        }
      }
    });
    for (const pr of f.projectiles) {
      if (pr.dead) continue;
      const dx = b.x - pr.x, dy = b.h - pr.y;
      if (dx * dx + dy * dy < (pr.r + BALL_R) ** 2) {
        b.vx = Math.sign(pr.vx) * 4;
        b.vy = 4;
        this.touch(f.f.indexOf(pr.owner));
      }
    }
    this.simulate();
  }

  touch(i: number) {
    this.ball.last = i;
    this.ball.from = this.ball.x;
  }

  simulate() {
    const b = this.ball;
    const prevH = b.h, prevX = b.x;
    b.vy -= BALL_G;
    b.x += b.vx;
    b.h += b.vy;
    b.spin += b.vx * 0.08;
    if (b.h < BALL_R) {
      b.h = BALL_R;
      if (b.vy < -1.2) {
        arenaSfx.bounce(Math.min(1, -b.vy / 6));
        b.vy = -b.vy * 0.7;
      } else b.vy = 0;
      b.vx *= 0.97;
      if (Math.abs(b.vx) < 0.03) b.vx = 0;
    }
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.6; }
    if (b.x > STAGE_W - BALL_R) { b.x = STAGE_W - BALL_R; b.vx = -Math.abs(b.vx) * 0.6; }
    HOOPS.forEach((hp, i) => {
      // the backboard glass
      const bh0 = FLOOR - BOARD_BOT, bh1 = FLOOR - BOARD_TOP;
      const face = hp.board + hp.dir * 3;
      if (b.h > bh0 - BALL_R && b.h < bh1 + BALL_R && (prevX - face) * hp.dir >= BALL_R && (b.x - face) * hp.dir < BALL_R) {
        b.x = face + hp.dir * BALL_R;
        b.vx = -b.vx * 0.6;
        this.clang(0.6);
      }
      // the rim: a hard point at the front and back edges
      for (const ex of [hp.rim - RIM_R, hp.rim + RIM_R]) {
        const dx = b.x - ex, dy = b.h - RIM_H, d = Math.hypot(dx, dy);
        if (d < BALL_R + 1 && d > 0) {
          const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
          b.x = ex + nx * (BALL_R + 1);
          b.h = RIM_H + ny * (BALL_R + 1);
          if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
          this.clang(1);
        }
      }
      // through the hoop, coming down
      if (prevH > RIM_H && b.h <= RIM_H && b.vy < 0 && Math.abs(b.x - hp.rim) < RIM_R - 2) this.scored(i);
    });
  }

  clang(v: number) {
    if (this.clangCool > 0) return;
    this.clangCool = 6;
    arenaSfx.clang(v);
  }

  scored(hoop: number) {
    const b = this.ball;
    b.vx *= 0.3;
    b.vy = Math.min(b.vy, -1);
    const three = Math.abs(b.from - HOOPS[hoop].rim) > 150;
    const pts = three ? 3 : 2;
    if (b.last >= 0) this.score[b.last] += pts;
    this.netSway[hoop] = 1;
    this.replay = 150;
    this.replayText = three ? 'FROM DOWNTOWN!' : 'SWISH!';
    this.roar = 120;
    arenaSfx.swish();
    arenaSfx.cheer(three ? 1.2 : 0.9);
    for (let i = 0; i < (three ? 40 : 18); i++)
      this.confetti.push({ x: HOOPS[hoop].rim + rand(-30, 30), y: rand(30, 70), vx: rand(-0.5, 0.5), vy: rand(0.1, 0.6), c: [HOME, GOLD, '#ffffff'][i % 3], life: rand(120, 200) });
  }

  // ----------------------------------------------------------------- drawing

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.wall, 0, 0);
    const fx = -Math.round(camX * 0.25);
    ctx.drawImage(this.far, fx, 0);
    this.drawRibbon(ctx, fx, 126, FAR_W, t, 0);
    this.drawJumbo(ctx, Math.round(STAGE_W / 2 - camX * JUMBO_PAR - (STAGE_W / 2 - W / 2) * (1 - JUMBO_PAR)), t);
    this.drawCrowd(ctx, -Math.round(camX * 0.55), t);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    this.drawRibbon(ctx, dx + 61, 170, STAGE_W - 122, t, 1);
    this.drawBall(ctx, dx);
    HOOPS.forEach((hp, i) => this.drawRim(ctx, hp.rim + dx, i, t));
  }

  /** A scrolling LED band: chevrons, stars and colour wipes, never any wordmarks. */
  drawRibbon(ctx: CanvasRenderingContext2D, x0: number, y: number, w: number, t: number, kind: number) {
    const mode = Math.floor((t + kind * 200) / 360) % 3;
    const hype = this.roar > 0 && Math.floor(t / 6) % 2 === 0;
    for (let i = 0; i < w; i += 2) {
      const sx = x0 + i;
      if (sx < -2 || sx > W + 2) continue;
      let c: string;
      if (hype) c = (i >> 3) % 2 ? GOLD : HOME;
      else if (mode === 0) c = (((i + Math.floor(t * 0.8)) >> 3) % 2) ? HOME : '#3a0a10'; // chevrons running along
      else if (mode === 1) c = ((i + Math.floor(t)) % 40) < 4 ? '#ffffff' : AWAY;
      else c = css(mix(HOME, GOLD, (Math.sin(i * 0.05 - t * 0.06) + 1) / 2));
      ctx.fillStyle = c;
      const h = kind === 0 ? 6 : 11;
      if (mode === 0 && !hype) {
        // a chevron: the bar's top and bottom are offset to make arrows
        const k = ((i + Math.floor(t * 0.8)) % 8) / 8;
        ctx.fillRect(sx, y + Math.round(Math.abs(k - 0.5) * 2), 2, h - 2);
      } else ctx.fillRect(sx, y, 2, h);
    }
  }

  /** The centre-hung scoreboard: the fight clock, the ball game's score, and hype screens. */
  drawJumbo(ctx: CanvasRenderingContext2D, cx: number, t: number) {
    if (cx < -60 || cx > W + 60) return;
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(cx - 20, 0, 1, 32);
    ctx.fillRect(cx + 19, 0, 1, 32);
    // body, with a lit ring around the top
    ctx.fillStyle = '#121218';
    ctx.fillRect(cx - 36, 32, 72, 42);
    ctx.fillStyle = Math.floor(t / 10) % 2 && this.roar > 0 ? GOLD : HOME;
    ctx.fillRect(cx - 36, 32, 72, 3);
    ctx.fillRect(cx - 36, 71, 72, 3);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(cx - 32, 37, 64, 32);
    const mode = this.replay > 0 ? 3 : Math.floor(t / 240) % 3;
    if (mode === 0) {
      // the clock and each player's points
      drawText(ctx, String(Math.max(0, this.clock)).padStart(2, '0'), cx, 39, '#ff4030', { align: 'center' });
      drawText(ctx, `P1 ${this.score[0]}`, cx - 29, 57, GOLD);
      drawText(ctx, `${this.score[1]} P2`, cx + 30, 57, '#8ab0ff', { align: 'right' });
    } else if (mode === 1) {
      // "DEFENSE" with a picket fence that marches across
      if (Math.floor(t / 20) % 2) drawText(ctx, 'DEFENSE', cx, 41, '#ffffff', { align: 'center' });
      ctx.fillStyle = '#e0e0d8';
      for (let x = -30; x < 30; x += 6) {
        const px = cx + ((x + Math.floor(t * 0.4) + 60) % 60) - 30;
        ctx.fillRect(px, 56, 3, 10);
        ctx.fillRect(px + 1, 55, 1, 1);
      }
      ctx.fillRect(cx - 32, 60, 64, 1);
    } else if (mode === 2) {
      // the noise meter: bars that bounce with the crowd
      drawText(ctx, 'MAKE NOISE', cx, 39, GOLD, { align: 'center' });
      for (let i = 0; i < 10; i++) {
        const h = Math.max(1, Math.round((Math.sin(t * 0.15 + i * 0.7) + 1.2) * 4 + (this.roar > 0 ? 6 : 0)));
        ctx.fillStyle = i < 6 ? '#40c040' : i < 8 ? '#e0c020' : '#e03020';
        ctx.fillRect(cx - 30 + i * 6, 67 - Math.min(18, h), 4, Math.min(18, h));
      }
    } else {
      const on = Math.floor(this.replay / 8) % 2 === 0;
      if (on) drawText(ctx, this.replayText.length > 9 ? 'DOWNTOWN!' : this.replayText, cx, 42, GOLD, { align: 'center' });
      drawText(ctx, this.replayText.length > 9 ? '+3' : '+2', cx, 54, '#ffffff', { align: 'center' });
    }
  }

  drawCrowd(ctx: CanvasRenderingContext2D, ox: number, t: number) {
    const flashI = Math.floor(t / 17) % this.fans.length;
    const flash = (t % 17) < 3 && (Math.floor(t / 17) * 7) % 3 === 0;
    const loud = this.roar > 0 ? 1.8 : 1;
    // lower-bowl seating behind them
    ctx.fillStyle = '#2a1e2a';
    ctx.fillRect(0, 134, W, 50);
    for (let i = 0; i < this.fans.length; i++) {
      const f = this.fans[i];
      const x = f.x + ox;
      if (x < -16 || x > W + 16) continue;
      const bounce = Math.max(0, Math.sin(t * 0.12 * f.hype * loud + f.ph)) * 3 * f.hype * loud;
      const top = Math.round(f.y - f.h - bounce);
      const dim = 0.45 - (f.y - 150) * 0.012;
      const shirt = css(mix(f.shirt, '#0a0810', dim)), skin = css(mix(f.skin, '#0a0810', dim + 0.05));
      ctx.fillStyle = shirt;
      ctx.fillRect(x - (f.w >> 1), top + 6, f.w, f.h);
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, top, 5, 6);
      const up = f.hype > 0.65 || this.roar > 0;
      if (up) {
        // arms up: a foam finger, a blank sign, or just fists
        const ay = top - 5 + Math.round(Math.sin(t * 0.2 * f.hype + f.ph * 2) * 2);
        ctx.fillStyle = shirt;
        ctx.fillRect(x + (f.w >> 1) - 1, ay + 3, 2, top + 8 - ay - 3);
        if (f.prop === 1) {
          ctx.fillStyle = css(mix(GOLD, '#0a0810', dim));
          ctx.fillRect(x + (f.w >> 1) - 2, ay - 2, 4, 5);
          ctx.fillRect(x + (f.w >> 1) - 1, ay - 7, 2, 5);
        } else if (f.prop === 2) {
          ctx.fillStyle = css(mix('#f0ece0', '#0a0810', dim));
          ctx.fillRect(x - 7, ay - 6, 15, 8);
          ctx.fillStyle = css(mix(HOME, '#0a0810', dim));
          ctx.fillRect(x - 5, ay - 4, 11, 2);
          ctx.fillRect(x - 5, ay - 1, 7, 1);
        } else {
          ctx.fillStyle = skin;
          ctx.fillRect(x + (f.w >> 1) - 1, ay, 3, 3);
        }
      } else {
        ctx.fillStyle = skin;
        ctx.fillRect(x - (f.w >> 1) + 1, top + 11, f.w - 2, 2);
      }
      if (flash && i === flashI) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, top + 2, 3, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - 8, top - 6, 17, 17);
      }
    }
    // the rail between the stands and the court
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(0, 160, W, 2);
  }

  drawBall(ctx: CanvasRenderingContext2D, dx: number) {
    const b = this.ball;
    const x = Math.round(b.x + dx), y = Math.round(FLOOR - b.h);
    if (x < -8 || x > W + 8) return;
    // shadow on the boards
    ctx.fillStyle = 'rgba(40,20,10,0.35)';
    const sw = Math.max(2, 6 - Math.floor(b.h / 20));
    ctx.fillRect(x - sw / 2, FLOOR + 2, sw, 1);
    ctx.fillStyle = '#c85a18';
    ctx.fillRect(x - 3, y - 4, 7, 9);
    ctx.fillRect(x - 4, y - 3, 9, 7);
    ctx.fillStyle = '#e8803a';
    ctx.fillRect(x - 2, y - 3, 3, 2);
    // seams rotate as it spins
    ctx.fillStyle = '#3a1808';
    const s = Math.round(Math.sin(b.spin) * 3);
    ctx.fillRect(x + s, y - 4, 1, 9);
    ctx.fillRect(x - 4, y + Math.round(Math.cos(b.spin) * 2), 9, 1);
  }

  /** The rim and net, drawn in front of the ball so it drops through. */
  drawRim(ctx: CanvasRenderingContext2D, rx: number, i: number, t: number) {
    if (rx < -20 || rx > W + 20) return;
    const y = FLOOR - RIM_H;
    const sway = this.netSway[i] * Math.sin(t * 0.6) * 3;
    ctx.fillStyle = '#f0f0e8';
    for (let k = 0; k < 14; k++) {
      const ky = y + 1 + k;
      const half = RIM_R - k * 0.3;
      const off = Math.round(sway * (k / 14));
      for (const u of [-1, -0.5, 0, 0.5, 1]) {
        const px = Math.round(rx + u * half + off + ((k + Math.round(u * 2)) % 2 ? 0.5 : 0));
        if ((k + Math.round(u * 4)) % 3 !== 2) ctx.fillRect(px, ky, 1, 1);
      }
    }
    ctx.fillStyle = '#e84a14';
    ctx.fillRect(rx - RIM_R, y - 1, RIM_R * 2 + 1, 2);
    ctx.fillStyle = '#ff8a4a';
    ctx.fillRect(rx - RIM_R, y - 1, RIM_R * 2 + 1, 1);
  }

  /** Spotlight beams roaming the court and confetti from a made basket. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const fx = 128 + Math.sin(t * 0.007 + i * 2.6) * 150;
      const top = 128 + (i ? 60 : -60);
      ctx.fillStyle = 'rgba(255,240,200,0.05)';
      ctx.beginPath();
      ctx.moveTo(top - 3, 0);
      ctx.lineTo(top + 3, 0);
      ctx.lineTo(fx + 26, FLOOR + 2);
      ctx.lineTo(fx - 26, FLOOR + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    for (const c of this.confetti) {
      ctx.fillStyle = c.c;
      ctx.fillRect(Math.round(c.x - camX), Math.round(c.y), c.life % 10 < 5 ? 2 : 1, 1);
    }
  }
}
