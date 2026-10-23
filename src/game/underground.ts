import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rng } from '../core/rng';
import { Painter } from '../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';

// "The Underdrome": an illegal fight ring in a flooded subway maintenance hall. A chain-link
// cage on a steel platform over an old sump, ringed by a rowdy crowd under swinging work lamps.
// Every layer is painted procedurally at load time; the crowd and lights animate live.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
const FENCE_TOP = 112;
const POSTS = [8, 136, 264, 392, 504];
const LAMPS = [{ x: 96, len: 58, ph: 0 }, { x: 256, len: 70, ph: 2.1 }, { x: 416, len: 54, ph: 4.4 }];

interface Fan { x: number; y: number; h: number; w: number; shirt: string; skin: string; ph: number; hype: number }

/** Running-bond brickwork filling a rectangle, with grimy mortar and dithered soot. */
function bricks(p: Painter, x0: number, y0: number, w: number, h: number, base: Color, seed: number) {
  const r = rng(seed);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 6), off = row % 2 ? 6 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const mortar = (y - y0) % 6 === 5 || (x - x0 + off) % 12 === 11;
      const tint = ((row * 7 + Math.floor((x - x0 + off) / 12) * 13) % 5) * 0.03;
      let c: Color = mortar ? darken(base, 0.45) : darken(base, tint);
      if (!mortar && bayer(x, y) < 0.1) c = lighten(c, 0.08);
      p.set(x, y, c);
    }
  }
  // soot and damp streaks running down from the ceiling
  for (let i = 0; i < w / 14; i++) {
    const sx = x0 + r.int(0, w), len = r.int(10, h);
    for (let y = y0; y < y0 + len; y++) if (bayer(sx, y) < 0.6 * (1 - (y - y0) / len)) p.set(sx + (y % 3 === 0 ? 1 : 0), y, darken(p.get(sx, y), 0.35));
  }
}

/** The back wall of the hall: brick, two dark tunnel mouths, pipes and a dead signal light. */
function backWall(): HTMLCanvasElement {
  const p = new Painter(W, H);
  bricks(p, 0, 0, W, H, '#3a2622', 911);
  // tunnel arches leading off into the dark
  for (const cx of [62, 196]) {
    for (let y = 40; y < H; y++)
      for (let x = cx - 40; x <= cx + 40; x++) {
        const dx = (x - cx) / 40, dy = y < 80 ? (80 - y) / 40 : 0;
        const d = dx * dx + dy * dy;
        if (d > 1.18) continue;
        if (d > 1) p.set(x, y, (x + y) % 3 ? '#5a3c30' : '#4a3028'); // arch voussoirs
        else p.set(x, y, mix('#06050a', '#140e14', Math.max(0, 1 - d) * (y < 120 ? 0.6 : 0.2)));
      }
    // rails vanishing into the tunnel
    for (let y = 120; y < H; y++) {
      const s = (y - 120) / 100;
      p.set(cx - 6 - s * 26, y, '#3a3640');
      p.set(cx + 6 + s * 26, y, '#3a3640');
    }
  }
  // a dead signal lamp on the pier between the arches
  p.rect(124, 56, 10, 22, '#1a1a1c');
  p.ellipse(129, 62, 3, 3, '#401010');
  p.ellipse(129, 72, 3, 3, '#103010');
  // big pipes along the ceiling
  for (const [y, rr, c] of [[10, 5, '#4a4e4a'], [22, 3, '#6a4a2a']] as [number, number, string][]) {
    for (let x = 0; x < W; x++)
      for (let k = -rr; k <= rr; k++) {
        const t = k / rr;
        p.set(x, y + k, t < -0.4 ? lighten(c, 0.2) : t > 0.4 ? darken(c, 0.35) : c);
      }
    for (let x = 18; x < W; x += 48) p.rect(x, y - rr - 1, 3, rr * 2 + 3, darken(c, 0.4));
  }
  p.shade(0.1);
  // everything back here sits in shadow
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (bayer(x, y) < 0.5) p.set(x, y, mix(p.get(x, y), '#08060a', 0.5));
  return p.canvas();
}

/** Far layer: rickety scaffold bleachers packed with a static silhouette crowd. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(923);
  for (let tier = 0; tier < 3; tier++) {
    const y = 104 + tier * 18;
    // heads and shoulders
    for (let x = r.int(0, 4); x < FAR_W; x += r.int(5, 8)) {
      const hy = y - r.int(0, 3), c = tier === 2 ? '#1c1418' : '#140e12';
      p.ellipse(x, hy - 6, 2.5, 3, c);
      p.rect(x - 4, hy - 3, 9, 14, c);
      if (r.next() < 0.12) p.rect(x + (r.next() < 0.5 ? -5 : 4), hy - 14, 2, 9, c); // a raised fist
      if (r.next() < 0.05) p.set(x + 1, hy - 7, '#ffb040'); // a lit cigarette
    }
    // scaffold plank and pipe railing
    p.rect(0, y + 10, FAR_W, 3, '#3a3026');
    for (let x = 0; x < FAR_W; x += 30) p.rect(x, y - 16, 2, 28, '#4a4a50');
    p.rect(0, y - 4, FAR_W, 1, '#55555c');
  }
  for (let y = 152; y < H; y++) for (let x = 0; x < FAR_W; x++) p.set(x, y, bayer(x, y) < 0.3 ? '#151014' : '#0e0a0e');
  // hang a few work lights from the scaffold so it isn't pitch black
  for (let x = 40; x < FAR_W; x += 96) {
    p.line(x, 0, x, 86, '#2a2a2a');
    p.poly([[x - 4, 92], [x, 86], [x + 4, 92]], '#3a3a3a');
    p.set(x, 92, '#ffe8a0');
  }
  return p.canvas();
}

/** The mid-distance ringside crowd, generated once and animated each frame. */
function crowd(): Fan[] {
  const r = rng(941);
  const shirts = ['#5a2020', '#20304a', '#2e3a22', '#4a3a28', '#3a2a4a', '#606060', '#7a5a1a', '#1a1a1a'];
  const skins = ['#e0b090', '#a87050', '#704030', '#c89070', '#5a3424'];
  const fans: Fan[] = [];
  for (let row = 0; row < 2; row++)
    for (let x = r.int(0, 6); x < MID_W; x += r.int(9, 14))
      fans.push({ x, y: 166 + row * 12, h: r.int(26, 34), w: r.int(9, 12), shirt: r.pick(shirts), skin: r.pick(skins), ph: r.range(0, 6.28), hype: r.range(0.4, 1) });
  return fans;
}

/** The ring itself: chain-link cage, steel platform, and the sump underneath. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(953);
  // chain-link mesh: two diagonal wire sets, a bit rusty and broken in places
  for (let y = FENCE_TOP; y < FLOOR; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const a = (x + y) % 7 === 0, b = (x - y + 700) % 7 === 0;
      if (!a && !b) continue;
      if (((x * 31 + y * 17) % 97) === 0) continue; // a snapped link
      const rust = Math.sin(x * 0.05) + Math.sin(y * 0.11) > 1.2;
      p.set(x, y, rust ? '#7a5034' : (a && b ? '#a8acb4' : '#70747c'));
    }
  // a torn flap where someone went through the fence
  for (let y = 150; y < 176; y++) for (let x = 330; x < 346; x++) if (y - 150 < (x - 330) * 1.6) p.data[(y * STAGE_W + x) * 4 + 3] = 0;
  // posts with rails and barbed wire coils on top
  for (const px of POSTS) {
    p.rect(px - 2, FENCE_TOP - 8, 5, FLOOR - FENCE_TOP + 8, '#5a5e66');
    p.rect(px - 2, FENCE_TOP - 8, 1, FLOOR - FENCE_TOP + 8, '#9aa0a8');
    p.rect(px + 2, FENCE_TOP - 8, 1, FLOOR - FENCE_TOP + 8, '#2e3036');
    p.rect(px - 3, FENCE_TOP - 10, 7, 2, '#7a7e86');
  }
  p.rect(0, FENCE_TOP, STAGE_W, 2, '#8a8e96');
  p.rect(0, FENCE_TOP + 2, STAGE_W, 1, '#3a3c42');
  for (let x = 0; x < STAGE_W; x++) {
    const a = (x % 10) / 10 * Math.PI * 2;
    p.set(x, FENCE_TOP - 5 + Math.round(Math.sin(a) * 3), '#6a6e76');
    if (x % 10 === 3) p.set(x, FENCE_TOP - 6, '#c0c4cc');
  }
  // flyers and padding zip-tied to the cage (pure shapes, no text)
  for (let i = 0; i < 6; i++) {
    const fx = 40 + i * 82 + r.int(-10, 10), fy = r.int(130, 160);
    const c = r.pick(['#c8b890', '#d06030', '#e0d040', '#a0a8c0']);
    p.rect(fx, fy, 10, 13, c);
    p.rect(fx + 2, fy + 2, 6, 4, darken(c, 0.5));
    for (let k = 0; k < 3; k++) p.rect(fx + 1, fy + 8 + k * 2, 8 - k * 2, 1, darken(c, 0.35));
  }
  // the mat: stained canvas over the steel deck
  for (let x = 0; x < STAGE_W; x++) {
    for (let y = FLOOR; y < FLOOR + 6; y++) {
      let c: Color = y === FLOOR ? '#8a6a5a' : y < FLOOR + 3 ? '#6a4c40' : '#523830';
      if (bayer(x, y) < 0.14) c = darken(c, 0.15);
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 26; i++) {
    const sx = r.int(0, STAGE_W), w = r.int(3, 12);
    for (let x = sx; x < sx + w; x++) p.set(x, FLOOR + r.int(0, 2), r.next() < 0.6 ? '#5a1a16' : '#7a2a20');
  }
  // steel I-beam apron with rivets
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, FLOOR + 6, '#9a9ea4');
    for (let y = FLOOR + 7; y < FLOOR + 13; y++) p.set(x, y, y < FLOOR + 9 ? '#5a5e66' : '#3a3e46');
    p.set(x, FLOOR + 13, '#1e2026');
    if (x % 16 === 6) p.set(x, FLOOR + 9, '#b0b4ba');
  }
  // the sump below: support struts and rebar, black water glinting at the bottom
  p.rect(0, FLOOR + 14, STAGE_W, H - FLOOR - 14, '#07080a');
  for (let x = 20; x < STAGE_W; x += 64) {
    p.line(x, FLOOR + 14, x + 16, H, '#262830');
    p.line(x + 32, FLOOR + 14, x + 16, H, '#262830');
  }
  for (let x = 0; x < STAGE_W; x += r.int(5, 9)) {
    const h = r.int(3, 8), lean = r.range(-2, 2);
    p.line(x, H, x + lean, H - h, '#5a3a26');
    p.set(x + lean, H - h, '#a07050');
  }
  for (let x = 0; x < STAGE_W; x++) if (bayer(x, H - 1) < 0.2) p.set(x, H - 1, '#1a3030');
  return p.canvas();
}

export class UndergroundStage {
  name = 'THE UNDERDROME';
  blurb = 'NO RULES BELOW THE CITY';
  song: SongName = 'underground';
  wall = backWall();
  far = far();
  fans = crowd();
  deck = deck();
  pit: HTMLCanvasElement;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  /** Down through the platform into the flooded sump for the uppercut stage finish. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(977);
    p.gradRect(0, 0, W, H, '#1a1416', '#040506', 8);
    // concrete shaft walls, wet and cracked, with a rusty ladder on the left
    for (let y = 0; y < H; y++) {
      const L = 34 + Math.sin(y * 0.06) * 3, R = 34 + Math.sin(y * 0.05 + 1) * 3;
      for (let x = 0; x < L; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#3a383a' : '#2a282c');
      for (let x = W - Math.floor(R); x < W; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#3a383a' : '#2a282c');
      if (y % 24 === 0) { p.rect(0, y, L, 1, '#1a181c'); p.rect(W - R, y, R, 1, '#1a181c'); }
    }
    for (let y = 0; y < 170; y++) { p.set(14, y, '#6a3a22'); p.set(24, y, '#6a3a22'); if (y % 10 === 0) p.rect(14, y, 11, 1, '#8a4a2a'); }
    // damp streaks and a dripping pipe
    for (let i = 0; i < 10; i++) {
      const sx = r.next() < 0.5 ? r.int(2, 32) : W - r.int(2, 32), len = r.int(30, 140);
      for (let y = 0; y < len; y++) if (bayer(sx, y) < 0.5) p.set(sx, y, '#1a2a26');
    }
    p.rect(W - 60, 40, 30, 6, '#4a4e4a');
    p.rect(W - 60, 40, 30, 1, '#7a7e7a');
    p.ellipse(W - 60, 43, 2, 3, '#2a2e2a');
    // the underside of the ring platform above, light leaking through the grating
    p.rect(0, 0, W, 10, '#2a2c32');
    for (let x = 4; x < W; x += 8) p.rect(x, 2, 4, 6, '#8a7a50');
    // ring lights spilling down through the grating in a dusty column
    for (let y = 10; y < 200; y++) {
      const half = 30 + (y - 10) * 0.25;
      for (let x = Math.floor(128 - half); x < 128 + half; x++) {
        const edge = 1 - Math.abs(x - 128) / half;
        if (bayer(x, y) < edge * 0.28 * (1 - y / 260)) p.set(x, y, mix(p.get(x, y), '#c8a870', 0.35));
      }
    }
    // chains and a snapped cable dangling into the shaft
    for (const [cx, len] of [[70, 120], [176, 90], [196, 60]]) {
      for (let y = 10; y < len; y++) p.set(cx + Math.round(Math.sin(y * 0.03) * 2), y, y % 4 < 2 ? '#7a7a80' : '#4a4a50');
    }
    p.ellipse(176, 92, 4, 3, '#5a5a60');
    p.ellipse(176, 92, 2, 1, '#151216');
    for (let y = 10; y < 76; y++) p.set(100 + Math.round(Math.sin(y * 0.08) * 3), y, '#1a1a1a');
    p.set(100 + Math.round(Math.sin(76 * 0.08) * 3), 76, '#ffe080');
    // black water with a greasy sheen, and a forest of rusty rebar sticking out of it
    for (let y = 200; y < H; y++)
      for (let x = 30; x < W - 30; x++) p.set(x, y, bayer(x, y) < 0.15 ? '#1e3a34' : (y === 200 ? '#2a4a44' : '#0a1414'));
    for (let row = 0; row < 3; row++) {
      const baseY = 188 + row * 12;
      for (let sx = 36 + row * 5; sx < W - 34; sx += 12 - row * 2) {
        const h = 36 + row * 8 + r.int(-8, 8), bend = r.range(-5, 5);
        const col = row === 2 ? '#8a5a3a' : row === 1 ? '#6a4630' : '#4a3426';
        p.line(sx, baseY + 24, sx + bend, baseY + 24 - h, col);
        p.line(sx + 1, baseY + 24, sx + 1 + bend, baseY + 24 - h, darken(col, 0.3));
        for (let k = 4; k < h; k += 4) p.set(sx + bend * (k / h), baseY + 24 - k, lighten(col, 0.25)); // ribbing
      }
    }
    // a couple of old cinder blocks and a tire half sunk in the muck
    p.rect(50, 196, 14, 8, '#6a6a6a');
    p.rect(52, 198, 4, 4, '#2a2a2a');
    p.ellipse(200, 204, 12, 5, '#141414');
    p.ellipse(200, 204, 6, 2, '#0a1414');
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[66, 180, -100, 1], [196, 186, -70, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -110, ab: 50, lf: -30, kf: 70, h: 30 })));
      ctx.restore();
    }
    return cv;
  }

  /** Swing angle of a hanging lamp, in radians. */
  swing(i: number, t: number) {
    return Math.sin(t * 0.025 + LAMPS[i].ph) * 0.22;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.wall, 0, 0);
    ctx.drawImage(this.far, -Math.round(camX * 0.25), 0);
    this.drawCrowd(ctx, -Math.round(camX * 0.55), t);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // swinging work lamps: cord, shade, bulb, and a cone of light that sweeps the ring
    for (let i = 0; i < LAMPS.length; i++) {
      const L = LAMPS[i], a = this.swing(i, t);
      const bx = L.x + dx + Math.sin(a) * L.len, by = Math.cos(a) * L.len;
      if (bx < -120 || bx > W + 120) continue;
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(L.x + dx + 0.5, 0);
      ctx.lineTo(Math.round(bx) + 0.5, Math.round(by));
      ctx.stroke();
      // a faulty one flickers
      const on = i !== 1 || Math.sin(t * 0.7) + Math.sin(t * 0.13) > -1.6;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (on) {
        const reach = FLOOR - by + 4, spread = 46;
        const fx = bx + Math.sin(a) * reach;
        const g = ctx.createLinearGradient(0, by, 0, FLOOR);
        g.addColorStop(0, 'rgba(255,220,140,0.22)');
        g.addColorStop(1, 'rgba(255,200,120,0.05)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by + 3);
        ctx.lineTo(bx + 4, by + 3);
        ctx.lineTo(fx + spread, FLOOR + 2);
        ctx.lineTo(fx - spread, FLOOR + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,210,130,0.18)';
        ctx.beginPath();
        ctx.ellipse(fx, FLOOR + 2, spread, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(Math.round(bx), Math.round(by));
      ctx.rotate(a);
      ctx.fillStyle = '#2a3a2a';
      ctx.fillRect(-6, 0, 12, 3);
      ctx.fillRect(-4, -2, 8, 2);
      ctx.fillStyle = on ? '#fff4c0' : '#6a6050';
      ctx.fillRect(-2, 3, 4, 2);
      ctx.restore();
    }
  }

  drawCrowd(ctx: CanvasRenderingContext2D, ox: number, t: number) {
    // a camera flash pops somewhere in the crowd now and then
    const flashI = Math.floor(t / 23) % this.fans.length;
    const flash = (t % 23) < 3 && (Math.floor(t / 23) * 7) % 5 === 0;
    for (let i = 0; i < this.fans.length; i++) {
      const f = this.fans[i];
      const x = f.x + ox;
      if (x < -16 || x > W + 16) continue;
      const bounce = Math.max(0, Math.sin(t * 0.12 * f.hype + f.ph)) * 3 * f.hype;
      const top = Math.round(f.y - f.h - bounce);
      const dim = f.y < 170 ? 0.55 : 0.35;
      const shirt = css(mix(f.shirt, '#000000', dim)), skin = css(mix(f.skin, '#000000', dim + 0.1));
      ctx.fillStyle = shirt;
      ctx.fillRect(x - (f.w >> 1), top + 7, f.w, f.h);
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, top, 5, 6);
      // arms: pumping fists when hyped, otherwise crossed or at the sides
      const pump = Math.sin(t * 0.18 * f.hype + f.ph * 2);
      if (f.hype > 0.7) {
        const ay = top - 4 + Math.round(pump * 3);
        ctx.fillStyle = shirt;
        ctx.fillRect(x + (f.w >> 1) - 1, ay + 3, 2, top + 9 - ay - 3);
        ctx.fillStyle = skin;
        ctx.fillRect(x + (f.w >> 1) - 1, ay, 3, 3);
        if (f.hype > 0.88) {
          ctx.fillStyle = shirt;
          ctx.fillRect(x - (f.w >> 1) - 1, ay + 5, 2, top + 9 - ay - 5);
          ctx.fillStyle = skin;
          ctx.fillRect(x - (f.w >> 1) - 2, ay + 2, 3, 3);
        }
      } else {
        ctx.fillStyle = skin;
        ctx.fillRect(x - (f.w >> 1) + 1, top + 12, f.w - 2, 2);
      }
      if (flash && i === flashI) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, top + 2, 3, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - 8, top - 6, 17, 17);
      }
    }
  }

  /** Cigarette smoke hanging over the ring, dust drifting in the lamp light, and cage posts close up. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 6; i++) {
      const x = ((i * 131 + t * 0.12 - camX * 1.1) % (W + 160) + W + 160) % (W + 160) - 80;
      const y = 60 + (i % 3) * 22 + Math.sin(t * 0.01 + i) * 4;
      ctx.fillStyle = 'rgba(180,170,160,0.06)';
      ctx.fillRect(Math.round(x), Math.round(y), 90, 5);
      ctx.fillRect(Math.round(x) + 14, Math.round(y) - 3, 50, 3);
    }
    ctx.fillStyle = 'rgba(255,230,170,0.45)';
    for (let i = 0; i < 18; i++) {
      const x = ((i * 47 + Math.sin(t * 0.015 + i) * 10 - camX) % STAGE_W + STAGE_W) % STAGE_W;
      if (x > W) continue;
      const y = (t * (0.1 + (i % 4) * 0.03) + i * 41) % FLOOR;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}
