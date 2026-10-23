import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { clamp, rand, rng, unseeded } from '../../core/rng';
import { noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { drawText } from '../../gfx/font';
import { Painter, pxLine } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { P, LAUNCHED } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "Roll-O-Rama": a roller rink on a Friday night in about 1994, Legs McGee's home turf. Neon
// tubes on black walls, a mirror ball throwing flecks of light over everything, coloured spots
// sweeping a glossy maple floor and a crowd of skaters circling behind the fight. The board
// over the DJ booth calls ALL SKATE, COUPLES SKATE and REVERSE SKATE in turn, and a big hit can
// send a skater sprawling. Everything is painted procedurally at load time.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.5);
const RAIL = 124; // top of the carpeted rink wall
const RINK = 146; // the maple floor starts here
const LANES = [154, 164]; // where the far skaters' wheels touch the floor
/** How long each skate session lasts before the DJ calls the next one, in frames. */
const SESSION = 1200;
const SESSIONS = ['ALL SKATE', 'COUPLES SKATE', 'REVERSE SKATE'];
const NEON = ['#ff3ad0', '#30f0f0', '#fff040', '#a050ff', '#40ff80', '#ff8030'];

const SKINS = ['#f4d0b0', '#e0b088', '#c08860', '#8a5a3a', '#5a3a26', '#f0c8a0'];
const HAIRS = ['#2a1a10', '#141014', '#6a3a1a', '#d8a848', '#a04a20', '#e8d070'];
const TOPS = ['#ff3ad0', '#30d0e0', '#f0e040', '#7a40e0', '#40c060', '#ff7030', '#f4f4f4', '#e83040'];
const BOTTOMS = ['#2a3a8a', '#141420', '#5a2a8a', '#2a6a6a', '#e8e0d0', '#ff3ad0'];

interface Skater {
  lane: number; x: number; spd: number; ph: number;
  skin: string; hair: string; top: string; bottom: string; skate: string; wheel: string;
  hat: 'cap' | 'pony' | 'none' | 'big';
  /** Index of the skater whose hand this one holds, in couples skate. */
  partner: number;
  /** Frames left in a wipeout; they slide on their seat, then scramble back up. */
  wipe: number;
}

interface Fan { x: number; skin: string; hair: string; top: string; ph: number; tall: number }

/** The hall behind the rink at half parallax: trusses, black walls, snack bar, DJ booth, arcade. */
function hall(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1581);
  // ceiling and back wall
  p.gradRect(0, 0, FAR_W, 30, '#06030c', '#120822', 5);
  for (let y = 30; y < RAIL + 4; y++)
    for (let x = 0; x < FAR_W; x++) p.set(x, y, mix('#1a0c2e', '#0e0618', (y - 30) / (RAIL - 26)));
  // a faint neon-confetti wallpaper
  for (let i = 0; i < 140; i++) {
    const x = r.int(0, FAR_W), y = r.int(32, RAIL), c = darken(r.pick(NEON), 0.72);
    if (r.next() < 0.5) for (let k = 0; k < 5; k++) p.set(x + k, y + Math.round(Math.sin(k * 1.4) * 1.2), c);
    else p.poly([[x, y], [x + 4, y + 1], [x + 1, y + 4]], c);
  }
  // roof trusses: a zig-zag girder with can lights hanging off it
  for (let x = 0; x < FAR_W; x++) {
    p.set(x, 8, '#2a2438');
    p.set(x, 20, '#2a2438');
    const k = x % 16;
    p.set(x, 8 + Math.round(k < 8 ? k * 1.5 : (16 - k) * 1.5), '#3a3448');
  }
  for (let x = 12; x < FAR_W; x += 34) {
    p.rect(x, 20, 1, 4, '#2a2438');
    p.poly([[x - 3, 24], [x + 3, 24], [x + 2, 29], [x - 2, 29]], '#3a3448');
    p.rect(x - 2, 29, 5, 1, r.pick(NEON));
  }
  // snack bar: a lit window with a counter, a popcorn machine and a menu board
  const sx = 16, sy = 66;
  p.rect(sx - 2, sy - 2, 96, 42, '#2a2034');
  p.gradRect(sx, sy, 92, 30, '#fff0b0', '#e0a050', 4);
  p.rect(sx, sy + 30, 92, 8, '#e04080');
  p.rect(sx, sy + 30, 92, 1, '#ff80b0');
  p.rect(sx + 6, sy + 4, 30, 12, '#2a2a30'); // menu board
  for (let k = 0; k < 4; k++) p.rect(sx + 8, sy + 6 + k * 3, r.int(12, 24), 1, k % 2 ? '#f0f0a0' : '#80f0f0');
  p.rect(sx + 44, sy + 8, 14, 18, '#c03030'); // popcorn machine
  p.rect(sx + 46, sy + 10, 10, 12, '#fff8d0');
  for (let k = 0; k < 14; k++) p.set(sx + 46 + r.int(0, 10), sy + 16 + r.int(0, 6), '#f0d060');
  p.rect(sx + 64, sy + 12, 6, 14, '#3080e0'); // a soda fountain
  p.rect(sx + 72, sy + 12, 6, 14, '#e04040');
  p.rect(sx + 80, sy + 12, 6, 14, '#40c040');
  for (const c of [sx + 66, sx + 74, sx + 82]) p.rect(c, sy + 26, 2, 3, '#c8ccd4');
  // DJ booth, raised in the middle, with a speaker stack each side
  const mid = FAR_W / 2;
  p.rect(mid - 28, 86, 56, RAIL - 86, '#201830');
  p.rect(mid - 28, 86, 56, 2, '#ff3ad0');
  p.rect(mid - 28, 100, 56, 1, '#30f0f0');
  for (const sp of [mid - 46, mid + 34]) {
    p.rect(sp, 72, 12, RAIL - 72, '#141018');
    for (const [cy, rr] of [[80, 4], [94, 4], [108, 5]] as const) {
      p.ellipse(sp + 6, cy, rr, rr, '#2a2434');
      p.ellipse(sp + 6, cy, rr - 2, rr - 2, '#0a080c');
      p.set(sp + 6, cy, '#4a4458');
    }
  }
  // the session board above the booth (its text is drawn live)
  p.rect(mid - 34, 54, 68, 14, '#0a0610');
  p.rect(mid - 34, 54, 68, 1, '#3a3448');
  // arcade corner: four cabinets with glowing marquees (screens are drawn live)
  for (let k = 0; k < 4; k++) {
    const ax = FAR_W - 112 + k * 24;
    p.rect(ax, 78, 18, RAIL - 78, '#181420');
    p.rect(ax, 78, 18, 6, r.pick(NEON));
    p.rect(ax + 1, 79, 16, 1, '#f0e8f8');
    p.rect(ax + 2, 86, 14, 12, '#06040a');
    p.rect(ax + 1, 100, 16, 4, '#2a2434');
    p.set(ax + 5, 101, '#e04040');
    p.set(ax + 11, 101, '#40c0f0');
    p.set(ax + 13, 102, '#f0e040');
    p.rect(ax + 2, 106, 2, RAIL - 106, darken(r.pick(NEON), 0.5));
  }
  return p.canvas();
}

/** The carpeted rink wall, loud 90s carpet on black under a padded vinyl rail. */
function rail(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1583);
  p.rect(0, RAIL, STAGE_W, RINK - RAIL, '#0c0814');
  // carpet confetti: squiggles, triangles, rings and zig-zags
  for (let i = 0; i < 260; i++) {
    const x = r.int(-4, STAGE_W), y = r.int(RAIL + 4, RINK - 2), c = r.pick(NEON), kind = r.int(0, 4);
    if (kind === 0) for (let k = 0; k < 7; k++) p.set(x + k, y + Math.round(Math.sin(k * 1.1) * 1.5), c);
    else if (kind === 1) p.poly([[x, y], [x + 4, y + 2], [x, y + 4]], c);
    else if (kind === 2) for (let a = 0; a < 6.28; a += 0.5) p.set(Math.round(x + Math.cos(a) * 2), Math.round(y + Math.sin(a) * 2), c);
    else for (let k = 0; k < 6; k++) p.set(x + k, y + (k % 2), c);
  }
  // padded rail on top, with a bright edge and a shadow line
  p.rect(0, RAIL - 2, STAGE_W, 5, '#201a2a');
  p.rect(0, RAIL - 2, STAGE_W, 1, '#5a5068');
  p.rect(0, RAIL + 3, STAGE_W, 1, '#000000');
  for (let x = 0; x < STAGE_W; x += 64) p.rect(x, RAIL - 2, 1, 5, '#0a0810'); // seams in the padding
  // a neon tube running the length of the wall's foot
  p.rect(0, RINK - 3, STAGE_W, 1, '#ff3ad0');
  p.rect(0, RINK - 2, STAGE_W, 1, '#7a1a68');
  return p.canvas();
}

/** The maple floor: glossy boards, neon reflections and the painted centre circle. */
function floor(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  let row = 0;
  for (let y = RINK, h = 2; y < H; y += h, h = Math.min(6, 2 + Math.floor((y - RINK) / 14)), row++) {
    const off = (row * 37) % 29;
    for (let yy = y; yy < Math.min(H, y + h); yy++)
      for (let x = 0; x < STAGE_W; x++) {
        const plank = Math.floor((x + off) / 29);
        let c: Color = mix('#b8783c', '#6a3e1c', (yy - RINK) / (H - RINK));
        c = mix(c, '#d8985a', ((plank * 7 + row * 3) % 5) * 0.04);
        if (yy === y) c = darken(c, 0.35); // board seam
        else if ((x + off) % 29 === 0) c = darken(c, 0.25);
        else if (yy === y + 1 && h > 2) c = lighten(c, 0.12);
        p.set(x, yy, c);
      }
  }
  // the dark wall casts a band of shadow on the floor right below it
  for (let y = RINK; y < RINK + 5; y++) for (let x = 0; x < STAGE_W; x++) if (bayer(x, y) < (RINK + 5 - y) / 6) p.set(x, y, darken(p.get(x, y), 0.4));
  // neon smeared down the gloss below the wall's tube
  for (let y = RINK; y < RINK + 30; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const k = (y - RINK) / 30;
      if (bayer(x, y) < (1 - k) * 0.28) p.set(x, y, mix(p.get(x, y), '#ff3ad0', 0.45 * (1 - k)));
    }
  // the painted centre circle and a dashed lane line
  for (let a = 0; a < Math.PI * 2; a += 0.005)
    for (const [rx, ry] of [[70, 12], [68, 11.5]]) {
      const x = Math.round(STAGE_W / 2 + Math.cos(a) * rx), y = Math.round(184 + Math.sin(a) * ry);
      if (bayer(x, y) > 0.1) p.set(x, y, mix(p.get(x, y), '#30f0f0', 0.75));
    }
  for (let x = 0; x < STAGE_W; x++) if (x % 16 < 9) p.set(x, 171, mix(p.get(x, 171), '#fff040', 0.6));
  // a starburst in the circle
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4)
    for (let k = 3; k < 30; k++) {
      const x = Math.round(STAGE_W / 2 + Math.cos(a) * k * 1.4), y = Math.round(184 + Math.sin(a) * k * 0.22);
      p.set(x, y, mix(p.get(x, y), '#ff3ad0', 0.6));
    }
  return p.canvas();
}

function makeSkaters(): Skater[] {
  const r = rng(1597);
  const out: Skater[] = [];
  for (let lane = 0; lane < LANES.length; lane++)
    for (let x = r.int(0, 30); x < STAGE_W + 40; x += r.int(36, 70)) {
      const pair = r.next() < 0.3;
      const make = (xx: number): Skater => ({
        lane, x: xx, spd: (lane ? 0.75 : 0.55) + r.range(0, 0.15), ph: r.range(0, 100),
        skin: r.pick(SKINS), hair: r.pick(HAIRS), top: r.pick(TOPS), bottom: r.pick(BOTTOMS),
        skate: r.pick(['#f4f0e8', '#202028', '#ff3ad0', '#f4f0e8']), wheel: r.pick(NEON),
        hat: r.pick(['cap', 'pony', 'none', 'big'] as const), partner: -1, wipe: 0,
      });
      const a = make(x);
      out.push(a);
      if (pair) {
        const b = make(x + 11);
        b.spd = a.spd;
        a.partner = out.length;
        b.partner = out.length - 1;
        out.push(b);
        x += 11;
      }
    }
  return out;
}

function makeFans(): Fan[] {
  const r = rng(1601);
  const out: Fan[] = [];
  for (let x = 14; x < STAGE_W - 10; x += r.int(26, 60))
    out.push({ x, skin: r.pick(SKINS), hair: r.pick(HAIRS), top: r.pick(TOPS), ph: r.range(0, 100), tall: r.int(0, 4) });
  return out;
}

/** A long can of skate spray, hissing. */
const spray = unseeded(() => {
  noise({ dur: 1.1, vol: 0.13, type: 'highpass', freq: 3800, attack: 0.04 });
  noise({ dur: 0.9, vol: 0.05, type: 'bandpass', freq: 1800, attack: 0.08 });
});
/** The rental desk's rubber stamp coming down: a dull thwack. */
const stamp = unseeded(() => {
  tone({ type: 'sine', freq: 140, to: 50, dur: 0.25, vol: 0.4 });
  noise({ dur: 0.08, vol: 0.2, type: 'lowpass', freq: 900 });
});

export class RinkStage {
  name = 'ROLL-O-RAMA';
  blurb = 'COUPLES SKATE ONLY. NO, REALLY';
  song: SongName = 'rink';
  hall = hall();
  rail = rail();
  floor = floor();
  skaters = makeSkaters();
  fans = makeFans();
  pit: HTMLCanvasElement;
  binFront: HTMLCanvasElement;
  pitLanding: PitLanding;
  /** How hard the fans at the rail are cheering; jumps on every hit and fades. */
  cheer = 0;
  hp: number[] = [];
  /** Damage of a big hit still to be felt by the skaters (they read it on the next draw). */
  trip = 0;
  lastT = -1;
  tripped = 0;

  constructor() {
    this.pit = this.buildPit();
    this.binFront = this.buildBinFront();
    this.pitLanding = this.makeLanding();
  }

  reset() {
    this.cheer = 0;
    this.hp = [];
    this.trip = 0;
    for (const s of this.skaters) s.wipe = 0;
  }

  update(f: Fight) {
    f.f.forEach((ft, i) => {
      const was = this.hp[i] ?? ft.hp;
      if (ft.hp < was) {
        this.cheer = Math.min(1, this.cheer + 0.35 + (was - ft.hp) / 200);
        if (was - ft.hp >= 70) this.trip = Math.max(this.trip, was - ft.hp);
      }
      this.hp[i] = ft.hp;
    });
    this.cheer *= 0.985;
  }

  /** Which session the DJ has called at time t: 0 all skate, 1 couples skate, 2 reverse skate. */
  session(t: number) {
    return Math.floor(t / SESSION) % SESSIONS.length;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const dt = this.lastT < 0 ? 1 : clamp(t - this.lastT, 0, 4);
    this.lastT = t;
    const ses = this.session(t);
    const far = -Math.round(camX * 0.5);
    ctx.drawImage(this.hall, far, 0);
    this.drawHallLive(ctx, far, t, ses);
    const dx = -Math.round(camX);
    for (const fan of this.fans) this.drawFan(ctx, fan, dx, t);
    ctx.drawImage(this.rail, dx, 0);
    ctx.drawImage(this.floor, dx, 0);
    this.drawSpots(ctx, dx, t, ses);
    this.moveSkaters(dt, ses);
    for (let lane = 0; lane < LANES.length; lane++)
      this.skaters.forEach((s, i) => {
        if (s.lane !== lane) return;
        this.drawSkater(ctx, s, s.x + dx, LANES[lane], t, ses === 2 ? -1 : 1, lane ? 1 : 0.85);
        const p = s.partner >= 0 ? this.skaters[s.partner] : null;
        // in couples skate the pairs hold hands
        if (ses === 1 && p && s.partner > i && !s.wipe && !p.wipe) {
          ctx.fillStyle = s.skin;
          const y = LANES[lane] - 13 * (lane ? 1 : 0.85);
          ctx.fillRect(Math.round(s.x + dx + 2), Math.round(y), Math.round(p.x - s.x - 3), 1);
        }
      });
  }

  /** Skaters roll round; reverse skate turns them all about, and a big hit trips the nearest. */
  moveSkaters(dt: number, ses: number) {
    const dir = ses === 2 ? -1 : 1;
    if (this.trip > 0) {
      // the next one along wipes out (a couple holds each other up)
      for (let k = 0; k < this.skaters.length; k++) {
        const s = this.skaters[(this.tripped + k) % this.skaters.length];
        if (s.wipe || s.partner >= 0) continue;
        s.wipe = 90;
        this.tripped += k + 1;
        break;
      }
      this.trip = 0;
    }
    const span = STAGE_W + 40;
    for (const s of this.skaters) {
      let v = s.spd * dir;
      if (s.wipe > 0) {
        v *= s.wipe > 60 ? (s.wipe - 60) / 30 : 0;
        s.wipe = Math.max(0, s.wipe - dt);
      }
      s.x = ((s.x + v * dt + 20) % span + span) % span - 20;
    }
  }

  /** Neon signs, the mirror ball, the DJ, the session board and the arcade screens. */
  drawHallLive(ctx: CanvasRenderingContext2D, far: number, t: number, ses: number) {
    const mid = FAR_W / 2 + far;
    // a mirror ball either side of the sign, facets glinting as they turn
    for (const bx of [mid - 100, mid + 100]) {
      const x0 = Math.round(bx), y0 = 34;
      ctx.fillStyle = '#4a4458';
      ctx.fillRect(x0, 0, 1, y0 - 9);
      for (let y = -9; y <= 9; y++)
        for (let x = -9; x <= 9; x++) {
          if (x * x + y * y > 81) continue;
          const fx = Math.floor((x + 9 + t * 0.15) / 2), fy = Math.floor((y + 9) / 2);
          const glint = Math.sin(fx * 1.7 + fy * 2.3 + t * 0.05 + bx);
          ctx.fillStyle = glint > 0.85 ? '#ffffff' : glint > 0.2 ? '#b8c0d0' : x + y > 5 ? '#4a5060' : '#7a8498';
          ctx.fillRect(x0 + x, y0 + y, 1, 1);
        }
      if (Math.sin(t * 0.07 + bx) > 0.9) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0 - 7, y0 - 4, 5, 1);
        ctx.fillRect(x0 - 5, y0 - 6, 1, 5);
      }
    }
    // the big sign, buzzing, with a flicker now and then
    const flick = t % 420 < 6 && t % 3 === 0;
    if (!flick) {
      drawText(ctx, 'ROLL-O-RAMA', mid + 1, 37, '#7a1a68', { scale: 2, align: 'center' });
      drawText(ctx, 'ROLL-O-RAMA', mid, 36, '#ff3ad0', { scale: 2, align: 'center', grad: ['#ffb0f0', '#ff3ad0'] });
    } else drawText(ctx, 'ROLL-O-RAMA', mid, 36, '#3a1030', { scale: 2, align: 'center' });
    drawText(ctx, 'SNACKS', 16 + far + 46, 56, '#30f0f0', { align: 'center' });
    drawText(ctx, 'ARCADE', FAR_W - 112 + far + 45, 66, '#fff040', { align: 'center' });
    // session board over the booth: the DJ's call, blinking
    const label = SESSIONS[ses];
    const on = t % SESSION > 40 || Math.floor(t / 8) % 2 === 0;
    if (on) drawText(ctx, label, mid, 58, ['#40ff80', '#ff3ad0', '#fff040'][ses], { align: 'center', spacing: label.length > 10 ? 0 : 1 });
    // the DJ, nodding to the beat, scratching when the crowd gets loud
    const nod = Math.floor(t / 15) % 2;
    const dy = 72 + nod;
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(Math.round(mid) - 5, dy + 6, 10, 8);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(Math.round(mid) - 3, dy, 6, 6);
    ctx.fillStyle = '#141014';
    ctx.fillRect(Math.round(mid) - 4, dy - 1, 8, 2);
    ctx.fillRect(Math.round(mid) - 4, dy + 2, 1, 3); // headphones
    ctx.fillRect(Math.round(mid) + 3, dy + 2, 1, 3);
    ctx.fillStyle = '#8a5a3a';
    const scratch = this.cheer > 0.3 ? Math.round(Math.sin(t * 0.6) * 2) : 0;
    ctx.fillRect(Math.round(mid) - 9 + scratch, 84, 5, 2);
    ctx.fillRect(Math.round(mid) + 5, 84 - nod, 5, 2);
    // turntables on the booth top
    for (const tx of [-14, 8]) {
      ctx.fillStyle = '#0a080c';
      ctx.fillRect(Math.round(mid) + tx, 85, 7, 2);
      ctx.fillStyle = (t >> 3) % 2 ? '#e04040' : '#c03030';
      ctx.fillRect(Math.round(mid) + tx + 3, 85, 1, 1);
    }
    // arcade screens cycling their attract modes
    for (let k = 0; k < 4; k++) {
      const ax = FAR_W - 112 + k * 24 + far;
      const ph = Math.floor(t / 20 + k * 3);
      ctx.fillStyle = ['#102060', '#401060', '#104020', '#402010'][(ph + k) % 4];
      ctx.fillRect(ax + 3, 87, 12, 10);
      ctx.fillStyle = NEON[(ph + k) % NEON.length];
      ctx.fillRect(ax + 4 + (ph * 3) % 9, 89 + (ph % 5), 2, 2);
      ctx.fillRect(ax + 5, 95, 8, 1);
    }
  }

  /** Coloured spots sweeping the floor; couples skate drops them to a slow pink and purple. */
  drawSpots(ctx: CanvasRenderingContext2D, dx: number, t: number, ses: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cols = ses === 1 ? ['#ff3ad0', '#a050ff', '#ff3ad0'] : ['#ff3ad0', '#30f0f0', '#fff040'];
    const sp = ses === 1 ? 0.5 : 1;
    for (let k = 0; k < 3; k++) {
      const x = STAGE_W / 2 + Math.sin(t * 0.011 * sp + k * 2.1) * 220 + dx;
      const y = 176 + Math.sin(t * 0.017 * sp + k * 1.3) * 14;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = cols[k];
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), 30, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.ellipse(Math.round(x), Math.round(y), 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A fan leaning on the rail; they throw their arms up on the big hits. */
  drawFan(ctx: CanvasRenderingContext2D, f: Fan, dx: number, t: number) {
    const x = Math.round(f.x + dx);
    if (x < -10 || x > W + 10) return;
    const excited = this.cheer > 0.2 && Math.sin(f.ph) * 0.5 + 0.5 < this.cheer + 0.3;
    const hop = excited ? Math.round(Math.abs(Math.sin(t * 0.25 + f.ph)) * 2) : 0;
    const top = RAIL - 10 - f.tall - hop;
    ctx.fillStyle = f.top;
    ctx.fillRect(x - 3, top, 7, RAIL - top);
    ctx.fillStyle = f.skin;
    if (excited) {
      ctx.fillRect(x - 5, top - 5, 2, 6);
      ctx.fillRect(x + 4, top - 5, 2, 6);
    } else {
      ctx.fillRect(x - 4, RAIL - 2, 2, 2); // forearms on the rail
      ctx.fillRect(x + 3, RAIL - 2, 2, 2);
    }
    ctx.fillRect(x - 2, top - 6, 5, 6);
    ctx.fillStyle = f.hair;
    ctx.fillRect(x - 2, top - 7, 5, 2);
    ctx.fillStyle = '#141014';
    ctx.fillRect(x - 1, top - 4, 1, 1);
    ctx.fillRect(x + 1, top - 4, 1, 1);
  }

  /** One skater, wheels at y, rolling in direction dir; sc shrinks the far lane. */
  drawSkater(ctx: CanvasRenderingContext2D, s: Skater, wx: number, y: number, t: number, dir: number, sc: number, shade?: string) {
    const x = Math.round(wx);
    if (x < -30 || x > W + 30) return;
    const c = (col: string) => (shade ? css(mix(col, '#0c0614', 0.6)) : col);
    const px = (ox: number, oy: number, w: number, h: number) => ctx.fillRect(Math.round(x + ox * sc * dir - (dir < 0 ? w * sc : 0)), Math.round(y + oy * sc), Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)));
    const seg = (x0: number, y0: number, x1: number, y1: number, w = 2) => pxLine(ctx, x + x0 * sc * dir, y + y0 * sc, x + x1 * sc * dir, y + y1 * sc, Math.max(1, Math.round(w * sc)));
    if (s.wipe > 0) {
      // sprawled on the floor, skates in the air, arms windmilling
      const flail = Math.sin(t * 0.5 + s.ph) * 3;
      ctx.fillStyle = c(s.bottom);
      px(-6, -4, 8, 3);
      seg(2, -3, 7, -9);
      ctx.fillStyle = c(s.skate);
      px(6, -11, 3, 3);
      ctx.fillStyle = c(s.wheel);
      px(6, -12, 1, 1);
      px(9, -12, 1, 1);
      ctx.fillStyle = c(s.top);
      px(-9, -10, 5, 7);
      ctx.fillStyle = c(s.skin);
      seg(-7, -9, -11, -14 + flail, 1);
      seg(-6, -9, -2, -14 - flail, 1);
      px(-10, -15, 5, 5);
      ctx.fillStyle = c(s.hair);
      px(-10, -16, 5, 2);
      return;
    }
    // a skating stride: one leg pushes out behind while the other glides
    const st = Math.sin(t * 0.09 * (s.spd * 1.6) + s.ph);
    const push = st > 0 ? st : 0, push2 = st < 0 ? -st : 0;
    const hip = -9;
    ctx.fillStyle = c(s.bottom);
    seg(0, hip, -1 - push * 5, -2 + push * -1);
    seg(0, hip, -1 - push2 * 5, -2 + push2 * -1);
    const skate = (fx: number, fy: number) => {
      ctx.fillStyle = c(s.skate);
      px(fx - 1, fy - 2, 4, 2);
      ctx.fillStyle = c(s.wheel);
      px(fx - 1, fy, 1, 1);
      px(fx + 2, fy, 1, 1);
    };
    skate(-1 - push * 5, -1 - push * 1);
    skate(-1 - push2 * 5, -1 - push2 * 1);
    // torso leaning into the skate, arms swinging
    ctx.fillStyle = c(s.top);
    px(-1, hip - 8, 5, 8);
    ctx.fillStyle = c(s.skin);
    seg(1, hip - 7, 1 + st * 4, hip - 2, 1);
    seg(2, hip - 7, 2 - st * 4, hip - 2, 1);
    px(1, hip - 14, 5, 6);
    ctx.fillStyle = '#141014';
    px(4, hip - 12, 1, 1);
    ctx.fillStyle = c(s.hair);
    if (s.hat === 'cap') {
      px(0, hip - 15, 6, 2);
      px(-2, hip - 14, 2, 1); // worn backwards, obviously
    } else if (s.hat === 'big') {
      px(0, hip - 17, 7, 4);
      px(-1, hip - 14, 2, 4);
    } else {
      px(1, hip - 15, 5, 2);
      if (s.hat === 'pony') {
        px(-1, hip - 14, 2, 4);
        ctx.fillStyle = c(s.wheel);
        px(0, hip - 14, 1, 1); // scrunchie
      }
    }
    if (shade) {
      // rim light from the spots on the leading edge
      ctx.fillStyle = shade;
      px(4, hip - 8, 1, 8);
      px(6, hip - 14, 1, 6);
    }
  }

  /** Mirror-ball flecks drifting across everything, and now and then a skater gliding past the camera. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 48; i++) {
      const span = W + 40;
      const x = (((i * 61.7 + t * (0.35 + (i % 5) * 0.04) - camX * 0.3) % span) + span) % span - 20;
      const y = 10 + ((i * 97) % 200) + Math.sin(t * 0.01 + i) * 4;
      ctx.globalAlpha = 0.25 + 0.25 * Math.max(0, Math.sin(t * 0.08 + i * 1.7));
      ctx.fillStyle = i % 7 === 0 ? '#ff80e0' : i % 5 === 0 ? '#80ffff' : '#ffffff';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    }
    ctx.restore();
    // a near-side skater cuts across the bottom of the screen the other way round the oval
    const cyc = t % 780;
    if (cyc < 150) {
      const s = this.skaters[Math.floor(t / 780) % this.skaters.length];
      const dir = this.session(t) === 2 ? 1 : -1;
      const x = dir < 0 ? W + 40 - cyc * 2.2 : -40 + cyc * 2.2;
      this.drawSkater(ctx, { ...s, wipe: 0 }, x, H + 4, t, dir, 2, '#ff3ad0');
    }
  }

  /** The finish close-up: the skate-rental counter, and the big bin of returned skates in front. */
  buildPit(): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1607);
    p.rect(0, 0, W, H, '#140a20');
    // cubby shelves behind the counter, every hole holding a pair of tired rental skates
    for (let cy = 4; cy < 84; cy += 20)
      for (let cx = 4; cx < W; cx += 24) {
        p.rect(cx, cy, 22, 18, '#3a2410');
        p.rect(cx + 1, cy + 1, 20, 16, '#1a0e06');
        for (const sx of [cx + 3, cx + 11]) {
          p.rect(sx, cy + 8, 7, 6, '#7a4a24');
          p.rect(sx, cy + 8, 7, 1, '#9a6234');
          p.rect(sx + 4, cy + 5, 3, 3, '#7a4a24');
          p.rect(sx, cy + 14, 7, 1, '#6a6a70');
          p.set(sx + 1, cy + 15, '#ff8030');
          p.set(sx + 5, cy + 15, '#ff8030');
          p.set(sx + 3, cy + 10, '#f0e0c0'); // laces
          p.set(sx + 5, cy + 9, '#f0e0c0');
        }
        p.rect(cx + 8, cy + 1, 6, 4, '#f4f0e8'); // size tag
        p.set(cx + 10, cy + 2, '#202020');
        p.set(cx + 11, cy + 3, '#202020');
      }
    // the counter top
    p.rect(0, 86, W, 9, '#e04080');
    p.rect(0, 86, W, 2, '#ff90c0');
    p.rect(0, 94, W, 2, '#5a1a38');
    p.rect(30, 80, 10, 6, '#c8ccd4'); // a service bell
    p.ellipse(35, 80, 5, 3, '#e8e8f0');
    p.rect(200, 78, 14, 8, '#e8d8a0'); // the sign-out clipboard
    p.rect(205, 76, 4, 2, '#a0a4ac');
    for (let k = 0; k < 3; k++) p.rect(202, 80 + k * 2, 10, 1, '#7a7a80');
    // the counter front: neon carpet like the rink wall
    p.rect(0, 96, W, H - 96, '#0c0814');
    for (let i = 0; i < 180; i++) {
      const x = r.int(-4, W), y = r.int(98, H), c = r.pick(NEON);
      if (r.next() < 0.5) for (let k = 0; k < 6; k++) p.set(x + k, y + Math.round(Math.sin(k * 1.1) * 1.5), c);
      else p.poly([[x, y], [x + 4, y + 2], [x, y + 4]], c);
    }
    // the inside back wall of the returns bin, and a heap of skates poking up from it
    p.rect(60, 112, 136, 20, '#3a2410');
    p.rect(60, 112, 136, 2, '#6a4420');
    for (let i = 0; i < 26; i++) skateProp(p, r.int(64, 186), r.int(110, 126), r.next() < 0.5);
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    drawText(ctx, 'SKATE RENTAL', W / 2, 87, '#fff8fc', { align: 'center' });
    return cv;
  }

  /** The front of the returns bin, drawn over the victim so only their legs stick out. */
  buildBinFront(): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1613);
    for (let y = 126; y < H; y++)
      for (let x = 56; x < 200; x++) {
        const plank = Math.floor((y - 126) / 12);
        let c: Color = mix('#9a6232', '#7a4a24', ((plank * 3) % 4) / 4);
        if ((y - 126) % 12 === 0) c = '#4a2a10';
        else if (x < 60 || x > 195) c = '#5a3418';
        p.set(x, y, c);
      }
    p.rect(54, 124, 148, 3, '#b87a40');
    p.rect(54, 124, 148, 1, '#d89a58');
    for (let i = 0; i < 9; i++) skateProp(p, r.int(64, 186), r.int(118, 126), r.next() < 0.5);
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    drawText(ctx, 'RETURNS', 128, 160, '#2a1606', { scale: 2, align: 'center' });
    return cv;
  }

  /** Landing for the uppercut finish: head-first into the returns bin, then a long blast of skate spray. */
  makeLanding(): PitLanding {
    const REST = 132;
    const SURF = 124;
    const CAN_AT = 50, SPRAY = 72, SPRAY_END = 130, STAMP = 158;
    let feet = { x: 128, y: 0 };
    return {
      pose: P(LAUNCHED, { rot: 180 }),
      rest: REST,
      length: 230,
      land: (f) => {
        sfx.thud();
        sfx.land();
        f.shake(8);
        // rental skates go flying out of the bin
        for (let i = 0; i < 24; i++) {
          const a = rand(Math.PI * 0.15, Math.PI * 0.85), s = rand(1.5, 4);
          f.pitParticles.add({ kind: 'spark', x: 128 + rand(-20, 20), y: H - SURF, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 46, max: 46, color: rand() < 0.6 ? '#7a4a24' : '#ff8030', size: rand(2, 3), grav: 0.14, floor: false });
        }
      },
      tick: (f, it) => {
        if (it === SPRAY) spray();
        if (it >= SPRAY && it < SPRAY_END && it % 3 === 0) f.pitParticles.smoke(feet.x + rand(-6, 10), H - feet.y + rand(-4, 8), 1, '#c8f0a0');
        if (it === STAMP) {
          stamp();
          f.shake(5);
        }
      },
      victim: (l, it) => {
        // legs kick wildly, slow under the spray, then go stiff with the odd twitch
        const k = it < SPRAY ? 1 : it < SPRAY_END ? 1 - (it - SPRAY) / (SPRAY_END - SPRAY) : Math.sin(it * 0.15) > 0.96 ? 0.3 : 0;
        const j = Math.sin(it * 0.9) * 26 * k, j2 = Math.sin(it * 0.9 + 1.7) * 26 * k;
        l.poseOverride = P(LAUNCHED, { rot: 180, t: 0, h: 0, af: -170, ef: 0, ab: -170, eb: 0, lf: -18 + j, kf: 20 + Math.abs(j) * 0.6, lb: 18 + j2, kb: 20 + Math.abs(j2) * 0.6 });
        l.computePose();
        if (it >= SPRAY) l.tint = ['#a8e070', Math.min(0.45, ((it - SPRAY) / (SPRAY_END - SPRAY)) * 0.45)];
        const s = l.skel;
        const lift = SURF + 4 + Math.min(12, it) * 0.5 - REST + l.G;
        const top = s.heelF[1] < s.toeF[1] ? s.heelF : s.toeF;
        feet = { x: 128 + ((s.heelF[0] + s.toeF[0]) / 2) * l.facing, y: REST + lift - l.G + top[1] };
        return lift;
      },
      draw: (ctx, it) => {
        ctx.drawImage(this.binFront, 0, 0);
        // the giant can of skate spray, swinging down from the counter and letting rip
        if (it >= CAN_AT) {
          const e = Math.min(1, (it - CAN_AT) / (SPRAY - CAN_AT));
          const out = it > SPRAY_END + 10 ? Math.min(1, (it - SPRAY_END - 10) / 20) : 0;
          const cx = 214 + out * 70, cy = -40 + (feet.y - 14 + 40) * (1 - (1 - e) * (1 - e));
          ctx.save();
          ctx.translate(Math.round(cx), Math.round(cy));
          ctx.rotate(-0.5);
          ctx.fillStyle = '#d8dce4';
          ctx.fillRect(-8, -24, 16, 44);
          ctx.fillStyle = '#30c050';
          ctx.fillRect(-8, -12, 16, 20);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-6, -6, 12, 2);
          ctx.fillRect(-6, 0, 8, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-5, -24, 2, 44);
          ctx.fillStyle = '#a0a4ac';
          ctx.fillRect(-5, -30, 10, 6);
          ctx.fillStyle = '#e04040';
          ctx.fillRect(-2, -34, 5, 4);
          ctx.restore();
          // the hiss itself: a cone of mist from the nozzle onto the upturned boots
          if (it >= SPRAY && it < SPRAY_END) {
            const nx = cx - 16, ny = cy - 26;
            ctx.save();
            ctx.globalAlpha = 0.5;
            for (let k = 0; k < 18; k++) {
              const f = ((it * 3 + k * 7) % 24) / 24;
              const tx = nx + (feet.x - nx) * f + Math.sin(k * 3.1 + it) * 6 * f;
              const ty = ny + (H - feet.y - 6 - ny) * f + Math.cos(k * 2.3 + it) * 5 * f;
              ctx.fillStyle = k % 3 ? '#e0ffd0' : '#a8e070';
              ctx.fillRect(Math.round(tx), Math.round(ty), 1 + Math.round(f * 3), 1 + Math.round(f * 2));
            }
            ctx.restore();
          }
        }
        // stink lines curling up off the boots afterwards
        if (it > SPRAY_END)
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = '#a8e070';
            const bx = feet.x - 8 + k * 8;
            for (let y = 0; y < 14; y++) ctx.fillRect(Math.round(bx + Math.sin(y * 0.6 + it * 0.12 + k) * 2), Math.round(H - feet.y - 12 - y - ((it * 0.3) % 6)), 1, 1);
          }
        // the rental desk's verdict
        if (it >= STAMP) {
          const s = Math.max(2, 5 - (it - STAMP) * 0.75);
          ctx.save();
          ctx.translate(128, 198);
          ctx.rotate(-0.18);
          ctx.scale(s / 2, s / 2);
          ctx.fillStyle = '#e02030';
          ctx.fillRect(-58, -12, 116, 3);
          ctx.fillRect(-58, 11, 116, 3);
          drawText(ctx, 'RETURNED', 0, -6, '#e02030', { scale: 2, align: 'center' });
          ctx.restore();
        }
      },
    };
  }
}

/** One rental skate for the heap: brown boot, steel plate, orange wheels, sometimes upside down. */
function skateProp(p: Painter, x: number, y: number, flip: boolean) {
  const d = flip ? -1 : 1;
  p.rect(x, y, 8, 5, '#7a4a24');
  p.rect(x + (flip ? 0 : 5), y - 4 * d + (flip ? 5 : 0), 3, 4, '#6a3e1c');
  p.rect(x, y + (flip ? -1 : 5), 8, 1, '#8a8a90');
  p.set(x + 1, y + (flip ? -2 : 6), '#ff8030');
  p.set(x + 6, y + (flip ? -2 : 6), '#ff8030');
  p.set(x + 3, y + 1, '#f0e0c0');
}
