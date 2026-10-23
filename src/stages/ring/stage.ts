import { H, STAGE_W, W } from '../../core/consts';
import { rand, rng } from '../../core/rng';
import { noise } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { drawText, textWidth } from '../../gfx/font';
import { Painter } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';

// "Piledriver Palace": a sold-out pro wrestling main event. The fight is inside the ring, between
// the ropes and turnbuckles, in front of a packed house split by the entrance ramp and its LED
// tunnel. Spotlights sweep from the truss, camera flashes pop in the stands and the crowd jumps on
// every big hit. The uppercut finish sends the loser through the mat into the junk under the ring.
// The promotion and its name are original. Every layer is painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.35);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.7);
/** Far and near edges of the mat. */
const MAT_TOP = 178;
const MAT_BOT = 206;
/** Rope heights above the far edge; the near ropes sit the same height above the near edge. */
const ROPES = [12, 26, 40];
const ROPE_COLS = ['#d02028', '#f0f0f0', '#2048c8'];
const FAR_POST = [20, STAGE_W - 20];
const NEAR_POST = [6, STAGE_W - 6];
/** Centre of the entrance ramp in mid-layer px, and where it leaves the tunnel. */
const RAMP_X = 150;
const RAMP_TOP = 86;
const RAMP_BOT = 176;
const SIGNS = ['SLAM!', 'HI MOM', '10/10', 'BOOM', 'WOW', 'YES!', 'PIN HIM'];
const SHIRTS = ['#c02830', '#2048a0', '#e0c020', '#202024', '#f0f0f0', '#30a050', '#a040c0', '#e07020'];
const SKINS = ['#f0c8a0', '#d0a070', '#a86c44', '#7a4a2c', '#e8b890'];
const HAIRS = ['#141014', '#3a2414', '#6a4020', '#c8a050', '#a08080'];
const GELS = ['#ff4060', '#40a0ff', '#ffd040', '#c060ff'];

interface Fan { x: number; y: number; shirt: string; skin: string; hair: string; ph: number; hype: number; sign: string | null; dim: number }
interface Bit { x: number; y: number; vx: number; vy: number; c: string; life: number }

/** Half-width of the ramp at a mid-layer y. */
function rampHalf(y: number) {
  return 20 + ((y - RAMP_TOP) / (RAMP_BOT - RAMP_TOP)) * 22;
}

/** The arena bowl: upper deck lost in the dark, the roof truss and the hanging video cube. */
function bowl(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1401);
  p.gradRect(0, 0, FAR_W, H, '#04040a', '#141228', 8);
  // upper deck: tier lines and a haze of faces picked out by stray light
  for (let y = 40; y < 120; y++)
    for (let x = 0; x < FAR_W; x++) {
      if (y % 7 === 0) p.set(x, y, '#1c1a30');
      else if (bayer(x, y) < 0.18 && (x * 7 + y * 13) % 5 < 2) p.set(x, y, r.pick(['#2a2238', '#3a2a30', '#22283a', '#4a3a3a']));
    }
  // aisles cutting down through the tiers
  for (const ax of [40, 130, 216, 306])
    for (let y = 40; y < 120; y++) p.rect(ax + Math.round((y - 40) * (ax < FAR_W / 2 ? -0.15 : 0.15)), y, 4, 1, '#0a0a14');
  // exit signs and a scattering of phone screens
  for (const ex of [60, 284]) {
    p.rect(ex, 34, 10, 4, '#108030');
    p.rect(ex + 1, 35, 8, 2, '#40e070');
  }
  for (let i = 0; i < 60; i++) p.set(r.int(0, FAR_W), r.int(42, 118), r.pick(['#a0c8ff', '#ffffff', '#ffe0a0']));
  // roof truss: two chords and their lattice
  for (const ty of [6, 16]) p.rect(0, ty, FAR_W, 2, '#3a3a48');
  for (let x = 0; x < FAR_W; x += 12) {
    p.line(x, 8, x + 12, 16, '#2a2a36');
    p.line(x + 12, 8, x, 16, '#2a2a36');
  }
  // can lights hanging off the truss
  for (let x = 10; x < FAR_W; x += 24) {
    p.rect(x, 18, 5, 5, '#1a1a22');
    p.rect(x + 1, 22, 3, 1, '#fff0c0');
  }
  // the video cube: steel frame, four screens (the live picture is drawn on top), cables up
  const cx = Math.round(FAR_W / 2);
  p.line(cx - 26, 18, cx - 30, 8, '#2a2a36');
  p.line(cx + 26, 18, cx + 30, 8, '#2a2a36');
  p.rect(cx - 36, 18, 72, 40, '#202028');
  p.rect(cx - 34, 20, 68, 34, '#06060c');
  p.rect(cx - 36, 56, 72, 3, '#3a3a48');
  // side faces of the cube, in perspective
  p.poly([[cx - 36, 18], [cx - 46, 22], [cx - 46, 54], [cx - 36, 58]], '#14141c');
  p.poly([[cx + 36, 18], [cx + 46, 22], [cx + 46, 54], [cx + 36, 58]], '#14141c');
  p.poly([[cx - 44, 25], [cx - 38, 22], [cx - 38, 54], [cx - 44, 51]], '#0c1020');
  p.poly([[cx + 44, 25], [cx + 38, 22], [cx + 38, 54], [cx + 44, 51]], '#0c1020');
  // the hard camera platform and a banner rail on the far wall
  p.rect(0, 120, FAR_W, 3, '#24223a');
  for (let x = 0; x < FAR_W; x += 30) p.rect(x + 4, 123, 22, 6, x % 60 ? '#5a1418' : '#14245a');
  return p.canvas();
}

/** The lower bowl: seating risers, the entrance stage with its tunnel and the ramp to the ring. */
function stands(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  // risers stepping down to the barrier
  for (let y = 92; y < 180; y++)
    for (let x = 0; x < MID_W; x++) {
      const step = (y - 92) % 12;
      p.set(x, y, step === 0 ? '#2a2840' : step < 3 ? '#1a1830' : bayer(x, y) < 0.1 ? '#16142a' : '#100e20');
    }
  // the entrance stage: a raised deck under a lighting arch, the tunnel mouth in its middle
  const sx0 = RAMP_X - 64, sx1 = RAMP_X + 64;
  for (let y = 20; y < RAMP_TOP + 4; y++)
    for (let x = sx0; x < sx1; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#14121e' : '#0c0a14');
  // arch frame and the LED panel bays (colours are painted live on top)
  p.rect(sx0, 18, sx1 - sx0, 4, '#4a4a58');
  p.rect(sx0, 18, 4, RAMP_TOP - 14, '#3a3a48');
  p.rect(sx1 - 4, 18, 4, RAMP_TOP - 14, '#3a3a48');
  for (let k = 0; k < 4; k++) {
    p.rect(sx0 + 6, 26 + k * 14, 26, 11, '#08080c');
    p.rect(sx1 - 32, 26 + k * 14, 26, 11, '#08080c');
  }
  // the tunnel: a dark doorway with smoke-coloured edges
  p.rect(RAMP_X - 18, 40, 36, RAMP_TOP - 40, '#040408');
  p.rect(RAMP_X - 20, 38, 40, 2, '#5a5a68');
  p.rect(RAMP_X - 20, 38, 2, RAMP_TOP - 38, '#5a5a68');
  p.rect(RAMP_X + 18, 38, 2, RAMP_TOP - 38, '#5a5a68');
  // stage lip
  p.rect(sx0, RAMP_TOP, sx1 - sx0, 4, '#3a3a48');
  p.rect(sx0, RAMP_TOP + 4, sx1 - sx0, 2, '#1a1a22');
  // the ramp: black steel with a white edge line and light strips, widening toward us
  for (let y = RAMP_TOP + 4; y < RAMP_BOT; y++) {
    const hw = rampHalf(y);
    for (let x = Math.floor(RAMP_X - hw); x <= RAMP_X + hw; x++) {
      const u = Math.abs(x - RAMP_X) / hw;
      p.set(x, y, u > 0.94 ? '#d8d8e0' : u > 0.86 ? '#2a2a34' : (y % 10 === 0) ? '#22222c' : '#18181f');
    }
    // railings either side
    p.set(Math.floor(RAMP_X - hw) - 1, y, '#6a6a78');
    p.set(Math.ceil(RAMP_X + hw) + 1, y, '#6a6a78');
  }
  // the barrier around ringside, padded black with a top rail
  p.rect(0, 174, MID_W, 6, '#0a0a10');
  p.rect(0, 174, MID_W, 1, '#4a4a58');
  return p.canvas();
}

/** The ring itself: far ropes and posts, the mat with its logo, and the apron skirt. */
function ring(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  // the mat: dimmed canvas with a light pool in the middle and dithered edges
  for (let y = MAT_TOP; y < MAT_BOT; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const d = Math.hypot((x - STAGE_W / 2) / 260, (y - 192) / 26);
      let c: Color = mix('#c8ccd8', '#6a6e80', Math.min(1, d * 0.9));
      if (bayer(x, y) < 0.12) c = darken(c, 0.06);
      if (y === MAT_TOP) c = '#4a4c5a';
      if (y >= MAT_BOT - 2) c = '#e8e8f0'; // the white edge of the mat
      p.set(x, y, c);
    }
  // centre logo: a five-pointed star inside two rings, squashed by perspective
  const lx = STAGE_W / 2, ly = 192;
  for (let y = MAT_TOP + 2; y < MAT_BOT - 2; y++)
    for (let x = lx - 60; x < lx + 60; x++) {
      const dx = (x - lx) / 56, dy = (y - ly) / 11, d = Math.hypot(dx, dy);
      if (d > 0.86 && d < 1) p.set(x, y, '#a01820');
      else if (d < 0.8 && d > 0.72) p.set(x, y, '#d8b020');
      else if (d < 0.72) {
        // the star, in polar form
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        const k = Math.abs(((a / (Math.PI * 2 / 5)) % 1 + 1) % 1 - 0.5) * 2;
        if (d < 0.3 + 0.38 * k) p.set(x, y, '#1a2a70');
      }
    }
  // far turnbuckle posts
  for (const x of FAR_POST) {
    p.rect(x - 2, MAT_TOP - 50, 5, 50, '#b8bcc8');
    p.rect(x - 2, MAT_TOP - 50, 1, 50, '#e0e4f0');
    p.rect(x + 2, MAT_TOP - 50, 1, 50, '#6a6e7a');
    p.rect(x - 3, MAT_TOP - 52, 7, 3, '#d8dce8');
  }
  // far ropes, slightly sagging, then the side ropes running forward to the near posts
  ROPES.forEach((h, i) => {
    const y0 = MAT_TOP - h;
    for (let x = FAR_POST[0]; x <= FAR_POST[1]; x++) {
      const u = (x - FAR_POST[0]) / (FAR_POST[1] - FAR_POST[0]);
      const y = y0 + Math.round(Math.sin(u * Math.PI) * 2);
      p.set(x, y, lighten(ROPE_COLS[i], 0.15));
      p.set(x, y + 1, darken(ROPE_COLS[i], 0.35));
    }
    for (const k of [0, 1]) p.line(FAR_POST[k], y0, NEAR_POST[k], y0 + (MAT_BOT - MAT_TOP), darken(ROPE_COLS[i], 0.2));
  });
  // turnbuckle pads where the ropes meet the far posts: red corner and blue corner
  for (const [k, x] of FAR_POST.entries())
    for (const h of ROPES) {
      const c = k === 0 ? '#c02028' : '#2040b0';
      p.rect(x - 3, MAT_TOP - h - 2, 7, 5, c);
      p.rect(x - 3, MAT_TOP - h - 2, 7, 1, lighten(c, 0.3));
    }
  // the apron skirt with the promotion's name on it
  for (let y = MAT_BOT; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) p.set(x, y, y === MAT_BOT ? '#30344a' : (x + y) % 40 === 0 ? '#121426' : '#181a30');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  for (const x of [128, 384]) drawText(ctx, 'PILEDRIVER PALACE', x, 212, '#e8c040', { align: 'center', outline: '#401010' });
  for (const x of [20, 256, 492]) {
    ctx.fillStyle = '#a01820';
    ctx.fillRect(x - 5, 210, 11, 9);
    ctx.fillStyle = '#e8c040';
    for (let k = 0; k < 4; k++) ctx.fillRect(x - k, 211 + k, k * 2 + 1, 1);
    for (let k = 0; k < 3; k++) ctx.fillRect(x - k, 217 - k, k * 2 + 1, 1);
  }
  return cv;
}

/** The crowd filling the risers either side of the ramp. */
function crowd(): Fan[] {
  const r = rng(1433);
  const fans: Fan[] = [];
  for (let row = 0; row < 7; row++) {
    const y = 96 + row * 12;
    for (let x = r.int(0, 5); x < MID_W; x += r.int(8, 11)) {
      if (Math.abs(x - RAMP_X) < rampHalf(y + 8) + 6) continue;
      fans.push({
        x, y: y + r.int(-1, 1), shirt: r.pick(SHIRTS), skin: r.pick(SKINS), hair: r.pick(HAIRS), ph: r.range(0, 6.28),
        hype: r.range(0.5, 1), sign: row % 2 === 1 && r.next() < 0.08 ? r.pick(SIGNS) : null, dim: 0.68 - row * 0.05,
      });
    }
  }
  return fans;
}

/** Under the ring: torn mat above, steel frame, the stash of chairs and ladders, and a bed of giant tacks. */
function underRing(bones: PartSet): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1459);
  p.gradRect(0, 0, W, H, '#16141e', '#060508', 8);
  // the ring boards overhead with the hole punched through, the canvas hanging in shreds
  for (let x = 0; x < W; x++) {
    const hole = x > 92 && x < 164;
    const lip = hole ? Math.round(Math.abs(Math.sin(x * 0.9)) * 5 + Math.abs(Math.sin(x * 0.31)) * 4) : 14;
    for (let y = 0; y < lip; y++) p.set(x, y, hole ? (y % 2 ? '#c8ccd8' : '#a8acb8') : Math.floor(x / 16) % 2 ? '#6a4a2e' : '#5a3e26');
    if (!hole) p.rect(x, 14, 1, 2, '#2a1a10');
  }
  for (const [x, len] of [[96, 18], [108, 12], [140, 22], [158, 14]]) p.poly([[x - 3, 4], [x + 3, 4], [x, 4 + len]], '#b8bcc8');
  // arena light pouring through the hole
  for (let y = 10; y < 196; y++) {
    const half = 36 + (y - 10) * 0.25;
    for (let x = Math.floor(128 - half); x < 128 + half; x++) {
      const edge = 1 - Math.abs(x - 128) / half;
      if (bayer(x, y) < edge * 0.5) p.set(x, y, mix(p.get(x, y), '#d0d8ff', 0.12 * (1 - y / 260)));
    }
  }
  // the steel frame: posts, a cross beam and diagonal braces
  for (const x of [18, 234]) {
    p.rect(x, 14, 6, 186, '#3a3a46');
    p.rect(x, 14, 1, 186, '#5a5a68');
  }
  p.rect(0, 30, W, 4, '#2e2e3a');
  p.line(24, 34, 70, 120, '#2a2a34');
  p.line(234, 34, 188, 120, '#2a2a34');
  // folding chairs stacked against the left post
  for (let k = 0; k < 5; k++) {
    const x = 30 + k * 3, y = 132 - k * 2;
    p.rect(x, y, 2, 52, '#7a7e8a');
    p.rect(x + 14, y + 22, 2, 30, '#5a5e6a');
    p.rect(x, y + 22, 16, 3, '#9a9eaa');
    p.rect(x + 1, y + 2, 12, 12, '#8a8e9a');
  }
  // a ladder leaning on the right post, and a folding table on its side
  for (let y = 60; y < 200; y++) {
    const off = Math.round((200 - y) * 0.12);
    p.set(212 - off, y, '#c8b030');
    p.set(226 - off, y, '#c8b030');
    if (y % 14 === 4) p.line(212 - off, y, 226 - off, y, '#a89020');
  }
  p.rect(178, 128, 4, 66, '#8a6a42');
  p.rect(182, 128, 2, 66, '#5a4228');
  for (const ly of [140, 180]) p.rect(184, ly, 16, 2, '#6a6e7a');
  // concrete floor
  p.gradRect(0, 196, W, H - 196, '#2a2830', '#141218', 4);
  // the tack bed: a heap of oversized drawing pins, the near ones biggest and sharpest
  for (let row = 0; row < 3; row++) {
    const baseY = 192 + row * 10;
    for (let sx = 44 + row * 6; sx < W - 44; sx += 15 - row * 2) {
      const x = sx + r.int(-2, 2), hgt = 22 + row * 8 + r.int(-4, 4);
      const head = r.pick(['#c02028', '#d8b020', '#2050c0', '#30a050']);
      p.ellipse(x, baseY + 6, 7 + row, 3, darken(head, 0.3));
      p.ellipse(x, baseY + 5, 6 + row, 2, head);
      p.ellipse(x - 2, baseY + 4, 2, 1, lighten(head, 0.4));
      p.line(x, baseY + 4, x, baseY + 4 - hgt, '#c8ccd8');
      p.set(x + 1, baseY + 3 - Math.round(hgt / 2), '#ffffff');
    }
  }
  // the centre tack, right under the hole
  p.ellipse(128, 202, 9, 3, '#7a1418');
  p.ellipse(128, 201, 8, 2, '#c02028');
  p.line(128, 200, 128, 156, '#d8dce8');
  const cv = p.canvas();
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // a forgotten challenger from a past main event, still lying on the chairs
  ctx.save();
  ctx.translate(52, 180);
  drawRig(ctx, bones, fk(P(LIE, { rot: -100, af: -110, ab: 30, lf: -40, kf: 60, h: 30 })));
  ctx.restore();
  return cv;
}

export class RingStage {
  name = 'PILEDRIVER PALACE';
  blurb = 'MAIN EVENT. THROUGH THE MAT!';
  song: SongName = 'ring';
  stakeColor = '#d8dce8';
  bowl = bowl();
  stands = stands();
  ring = ring();
  fans = crowd();
  pit: HTMLCanvasElement;
  /** Frames left of the crowd's pop after a big hit or the knockout. */
  pop = 0;
  hp: number[] = [];
  phase = '';
  /** Sparkler fountains at the tunnel, in stands px. */
  sparks: Bit[] = [];
  /** Streamers falling over the ring, in ring px. */
  confettiBits: Bit[] = [];
  lastT = -1;

  constructor(bones: PartSet) {
    this.pit = underRing(bones);
  }

  reset() {
    this.pop = 0;
    this.hp = [];
    this.phase = '';
    this.sparks = [];
    this.confettiBits = [];
  }

  /** The bell, entrance pyro and crowd pops, driven off the fight. */
  update(f: Fight) {
    if (f.phase !== this.phase) {
      if (f.phase === 'entrance') this.pyro(), sfx.fire();
      if (f.phase === 'fight') sfx.bell();
      if (f.phase === 'ko') {
        sfx.bell();
        this.pop = 120;
        this.confetti();
        noise({ dur: 2.6, vol: 0.16, type: 'bandpass', freq: 800, q: 0.5, attack: 0.3 });
      }
      this.phase = f.phase;
    }
    // a big shot gets the stands on their feet
    f.f.forEach((ft, i) => {
      const was = this.hp[i] ?? ft.hp;
      if (was - ft.hp >= 60) this.pop = Math.max(this.pop, 40);
      this.hp[i] = ft.hp;
    });
    if (f.phase === 'entrance' && f.t % 40 === 0) this.pyro();
  }

  /** Sparkler fountains either side of the tunnel. */
  pyro() {
    for (const dx of [-30, 30])
      for (let i = 0; i < 24; i++)
        this.sparks.push({ x: RAMP_X + dx, y: RAMP_TOP, vx: rand(-0.6, 0.6), vy: rand(-3.4, -1.8), c: Math.random() < 0.5 ? '#fff0a0' : '#ffb030', life: rand(30, 50) });
  }

  /** Streamers raining down over the ring on the knockout. */
  confetti() {
    for (let i = 0; i < 90; i++)
      this.confettiBits.push({ x: rand(0, STAGE_W), y: rand(-80, 0), vx: rand(-0.3, 0.3), vy: rand(0.5, 1.1), c: Math.random() < 0.5 ? '#ffd040' : Math.random() < 0.5 ? '#ff4060' : '#ffffff', life: 400 });
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    if (t !== this.lastT) {
      this.lastT = t;
      if (this.pop > 0) this.pop--;
      for (const b of this.sparks) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.08;
        b.life--;
      }
      for (const b of this.confettiBits) {
        b.x += b.vx + Math.sin(b.life * 0.1) * 0.3;
        b.y += b.vy;
        b.life--;
      }
      this.sparks = this.sparks.filter((b) => b.life > 0);
      this.confettiBits = this.confettiBits.filter((b) => b.life > 0 && b.y < H + 4);
    }
    const fx = -Math.round(camX * 0.35);
    ctx.drawImage(this.bowl, fx, 0);
    this.drawCube(ctx, fx + Math.round(FAR_W / 2), t);
    const mx = -Math.round(camX * 0.7);
    ctx.drawImage(this.stands, mx, 0);
    this.drawTunnel(ctx, mx, t);
    this.drawCrowd(ctx, mx, t);
    for (const b of this.sparks) this.bit(ctx, b, mx, 1);
    this.drawSpots(ctx, t);
    ctx.drawImage(this.ring, -Math.round(camX), 0);
  }

  bit(ctx: CanvasRenderingContext2D, b: Bit, ox: number, h: number) {
    ctx.fillStyle = b.c;
    ctx.fillRect(Math.round(b.x + ox), Math.round(b.y), 1, h);
  }

  /** The video cube cycles the card, with a scanline flicker. */
  drawCube(ctx: CanvasRenderingContext2D, cx: number, t: number) {
    if (cx < -60 || cx > W + 60) return;
    const msgs = ['MAIN', 'EVENT', 'TONIGHT', 'PP'];
    const m = msgs[Math.floor(t / 90) % msgs.length];
    const pop = this.pop > 0 && t % 8 < 4;
    ctx.fillStyle = pop ? '#401018' : '#0a1030';
    ctx.fillRect(cx - 34, 20, 68, 34);
    drawText(ctx, pop ? 'OHHH!' : m, cx, 31, pop ? '#ffe060' : '#e8c040', { align: 'center', outline: '#000000' });
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 20; y < 54; y += 2) ctx.fillRect(cx - 34, y, 68, 1);
  }

  /** LED panels around the tunnel chase colours, faster during entrances and pops. */
  drawTunnel(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    const x0 = RAMP_X - 64 + mx;
    if (x0 > W || x0 + 128 < 0) return;
    const fast = this.phase === 'entrance' || this.pop > 0;
    for (let k = 0; k < 4; k++)
      for (const [side, px] of [[0, x0 + 6], [1, x0 + 96]] as const) {
        const g = GELS[(k + side + Math.floor(t / (fast ? 6 : 24))) % GELS.length];
        ctx.fillStyle = css(darken(g, 0.35));
        ctx.fillRect(px, 26 + k * 14, 26, 11);
        ctx.fillStyle = g;
        for (let i = 0; i < 26; i += 3) ctx.fillRect(px + i, 27 + k * 14 + ((i + t) % 9), 1, 1);
      }
    // haze rolling out of the tunnel mouth
    ctx.fillStyle = 'rgba(140,140,170,0.12)';
    for (let i = 0; i < 6; i++) {
      const w = 30 + i * 6 + Math.round(Math.sin(t * 0.03 + i) * 4);
      ctx.fillRect(RAMP_X + mx - w / 2, RAMP_TOP - 6 + i * 4, w, 4);
    }
  }

  /** Fans bob along; on a pop they jump with their arms up. Flashes go off all night. */
  drawCrowd(ctx: CanvasRenderingContext2D, mx: number, t: number) {
    const hot = this.pop > 0;
    for (const f of this.fans) {
      const x = f.x + mx;
      if (x < -10 || x > W + 10) continue;
      const jump = hot ? Math.round(Math.abs(Math.sin(t * 0.25 * f.hype + f.ph)) * 3) : Math.sin(t * 0.06 + f.ph) > 0.8 ? 1 : 0;
      const y = f.y - jump;
      ctx.fillStyle = css(darken(f.shirt, f.dim));
      ctx.fillRect(x - 3, y + 5, 7, 7);
      ctx.fillStyle = css(darken(f.skin, f.dim));
      ctx.fillRect(x - 2, y, 5, 5);
      const up = hot || Math.sin(t * 0.04 * f.hype + f.ph) > 0.93;
      if (up) {
        ctx.fillRect(x - 4, y - 3 + (t + f.x) % 2, 1, 6);
        ctx.fillRect(x + 4, y - 3 + (t + f.x + 1) % 2, 1, 6);
      }
      ctx.fillStyle = css(darken(f.hair, f.dim));
      ctx.fillRect(x - 2, y, 5, 2);
      if (f.sign) {
        const sy = y - 10 - (hot ? (t >> 2) % 2 : 0);
        const w = textWidth(f.sign) + 4;
        ctx.fillStyle = '#a8a8a0';
        ctx.fillRect(x + 1 - Math.ceil(w / 2), sy, w, 9);
        drawText(ctx, f.sign, x + 1, sy + 1, '#801018', { align: 'center' });
      }
    }
    // camera flashes: a few every frame, a storm on a pop
    const n = hot ? 6 : 1;
    for (let i = 0; i < n; i++) {
      const k = (t * 7 + i * 131) % this.fans.length;
      if ((t * 13 + i * 7) % (hot ? 2 : 9)) continue;
      const f = this.fans[k], x = f.x + mx;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, f.y + 4, 2, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 2, f.y + 2, 6, 6);
    }
  }

  /** Two spotlights sweeping the ring from the truss. */
  drawSpots(ctx: CanvasRenderingContext2D, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const top = 40 + i * 176, foot = W / 2 + Math.sin(t * 0.012 + i * 2.4) * 110;
      const g = this.pop > 0 ? GELS[(i + (t >> 3)) % GELS.length] : i ? '#a0b8ff' : '#fff0d0';
      ctx.fillStyle = css(g, 0.07);
      ctx.beginPath();
      ctx.moveTo(top - 3, 20);
      ctx.lineTo(top + 3, 20);
      ctx.lineTo(foot + 26, MAT_BOT);
      ctx.lineTo(foot - 26, MAT_BOT);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(foot, 192, 30, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The near posts and ropes, see-through so the fighters read through them, and the confetti. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, _t: number) {
    const dx = -Math.round(camX);
    const span = MAT_BOT - MAT_TOP;
    ROPES.forEach((h, i) => {
      const y0 = MAT_TOP - h + span;
      ctx.fillStyle = css(ROPE_COLS[i], 0.4);
      ctx.fillRect(NEAR_POST[0] + dx, y0, NEAR_POST[1] - NEAR_POST[0], 1);
      ctx.fillStyle = css(darken(ROPE_COLS[i], 0.4), 0.3);
      ctx.fillRect(NEAR_POST[0] + dx, y0 + 1, NEAR_POST[1] - NEAR_POST[0], 1);
    });
    for (const [k, px] of NEAR_POST.entries()) {
      const x = px + dx;
      if (x < -10 || x > W + 10) continue;
      ctx.fillStyle = '#b8bcc8';
      ctx.fillRect(x - 3, MAT_BOT - 52, 6, 56);
      ctx.fillStyle = '#e8ecf8';
      ctx.fillRect(x - 3, MAT_BOT - 52, 1, 56);
      ctx.fillStyle = '#6a6e7a';
      ctx.fillRect(x + 2, MAT_BOT - 52, 1, 56);
      for (const h of ROPES) {
        const c = k === 0 ? '#c02028' : '#2040b0';
        ctx.fillStyle = c;
        ctx.fillRect(x - 4, MAT_BOT - h - 3, 8, 6);
        ctx.fillStyle = css(lighten(c, 0.3));
        ctx.fillRect(x - 4, MAT_BOT - h - 3, 8, 1);
      }
    }
    for (const b of this.confettiBits) this.bit(ctx, b, dx, (b.life >> 3) % 2 ? 2 : 1);
  }
}
