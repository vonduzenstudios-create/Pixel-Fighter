import { H, W } from '../core/consts';
import { Painter } from '../gfx/painter';
import { roster, partsFor } from '../chars/roster';
import { P, STANCE } from '../game/anims';
import type { Pose } from '../gfx/rig';
import type { CharDef } from '../game/fighter';
import { drawFigure } from './common';

// Title screen: the whole roster dancing in an endless conga line under party lights.
// The line shuffles leftward; dancers leave on the left and the next fighters in the roster
// step in from the right, so new fighters join automatically.

/** Feet of the conga line. */
export const CONGA_FLOOR = 204;
const HORIZON = 132;
/** Frames per bar: step, step, step, kick at 120 BPM. */
export const BAR = 120;
const SPEED = 0.42;

/** Conga pose: hands on the shoulders ahead, three shuffle steps then a kick, hips swinging. */
export function congaPose(f: number): Pose {
  const bar = Math.floor(f / BAR);
  const ph = (f % BAR) / BAR; // 0..1 through the bar
  const beat = Math.floor(ph * 4);
  const bp = ph * 4 - beat; // 0..1 through the beat
  const sway = Math.sin(ph * Math.PI * 4) * 7;
  const arms = { af: -78 + sway * 0.4, ef: -18, ab: -72 - sway * 0.4, eb: -26 };
  if (beat < 3) {
    // shuffle: lift alternating feet, a little dip on each step
    const lift = Math.sin(bp * Math.PI);
    const front = (beat + bar) % 2 === 0;
    return P(STANCE, {
      ...arms, t: 10 + sway, h: -6 - sway * 0.5,
      lf: front ? -22 - lift * 18 : -10, kf: front ? 22 + lift * 40 : 14,
      lb: front ? 14 : 4 - lift * 18, kb: front ? 6 : 10 + lift * 40,
    });
  }
  // kick: alternate kicking leg each bar, lean back against it
  const k = Math.sin(Math.min(1, bp * 1.6) * Math.PI);
  const front = bar % 2 === 0;
  return P(STANCE, {
    ...arms, t: 6 - k * 12, h: -10 + k * 6,
    lf: front ? -22 - k * 58 : -10, kf: front ? 22 - k * 20 : 14,
    lb: front ? 10 : 10 + k * 46, kb: front ? 8 : 8 - k * 4,
  });
}

interface Dancer { c: CharDef; x: number; i: number }

export class CongaLine {
  dancers: Dancer[] = [];
  next = 0;
  /** Rebuilt on each call so fighters added to the registry show up without a reload. */
  private chars() {
    return roster();
  }
  private gap(c: CharDef) {
    return 40 * (c.scale ?? 1);
  }
  update() {
    const chars = this.chars();
    if (!chars.length) return;
    for (const d of this.dancers) d.x -= SPEED;
    while (this.dancers.length && this.dancers[0].x < -50) this.dancers.shift();
    // first frame: start with the stage already full; afterwards feed new dancers in from the right
    let last = this.dancers[this.dancers.length - 1];
    let x = last ? last.x + this.gap(last.c) : -40;
    while (x < W + 60) {
      const i = this.next++ % chars.length;
      const c = chars[i];
      if (last) x = last.x + (this.gap(last.c) + this.gap(c)) / 2;
      last = { c, x, i: this.next };
      this.dancers.push(last);
      x = last.x + this.gap(c);
    }
  }
  draw(ctx: CanvasRenderingContext2D, t: number) {
    // back to front: the rightmost dancer's reaching arms tuck behind the one ahead
    for (let n = this.dancers.length - 1; n >= 0; n--) {
      const d = this.dancers[n];
      const f = t + d.i * 3; // tiny ripple down the line
      const ph = (f % BAR) / BAR;
      const hop = Math.abs(Math.sin(ph * Math.PI * 4)) * 1.5;
      const s = d.c.scale ?? 1;
      ctx.fillStyle = 'rgba(60,0,60,0.28)';
      ctx.fillRect(Math.round(d.x - 12 * s), CONGA_FLOOR - 1, Math.round(24 * s), 3);
      drawFigure(ctx, partsFor(d.c), congaPose(f), d.x, CONGA_FLOOR - hop, -1, s);
    }
  }
}

// ------------------------------------------------------------------ Party backdrop
let backdrop: HTMLCanvasElement | null = null;
function partyBackdrop() {
  if (backdrop) return backdrop;
  const p = new Painter(W, H);
  // sunset sky
  p.gradRect(0, 0, W, HORIZON, '#4a7cff', '#ff8ac0', 12);
  p.gradRect(0, HORIZON - 40, W, 40, '#ff8ac0', '#ffc070', 6);
  // striped sun
  const sx = W / 2, sy = HORIZON - 4;
  for (let y = sy - 44; y < HORIZON; y++) {
    const gapBand = y > sy - 22 && (y - (sy - 22)) % 6 < 1 + (y - (sy - 22)) / 8;
    if (gapBand) continue;
    const t = (y - (sy - 44)) / 44;
    const col = t < 0.5 ? '#fff4a0' : t < 0.8 ? '#ffd060' : '#ffa040';
    const hw = Math.sqrt(Math.max(0, 44 * 44 - (y - sy) ** 2));
    for (let x = Math.floor(sx - hw); x < sx + hw; x++) p.set(x, y, col);
  }
  // distant skyline and palms in soft purple
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let x = 0; x < W; ) {
    const bw = 8 + Math.floor(rnd() * 14), bh = 10 + Math.floor(rnd() * 26);
    if (Math.abs(x + bw / 2 - sx) > 52) {
      p.rect(x, HORIZON - bh, bw, bh, '#b05ab0');
      for (let wy = HORIZON - bh + 3; wy < HORIZON - 3; wy += 5)
        for (let wx = x + 2; wx < x + bw - 2; wx += 4) if (rnd() < 0.5) p.rect(wx, wy, 2, 2, '#ffe0f0');
    }
    x += bw + 1;
  }
  for (const px of [18, 62, 196, 240]) {
    for (let y = 0; y < 46; y++) p.rect(px + Math.round(Math.sin(y / 14) * 3), HORIZON - y, 3, 1, '#8a3a9a');
    const top = HORIZON - 46, cx = px + Math.round(Math.sin(46 / 14) * 3) + 1;
    for (const [dx, dy] of [[-1, 0.3], [1, 0.3], [-1, -0.2], [1, -0.2], [-0.6, 0.8], [0.6, 0.8]])
      for (let s = 0; s < 14; s++) p.rect(cx + dx * s, top + dy * s + (s * s) / 30, 2, 2, '#8a3a9a');
  }
  // dance floor in perspective
  for (let y = HORIZON; y < H; y++) {
    const d = (y - HORIZON + 6) / (H - HORIZON + 6);
    const row = Math.floor(Math.log(d * 20) * 3);
    for (let x = 0; x < W; x++) {
      const col = Math.floor(((x - W / 2) / d) / 26 + 100);
      const lit = (row + col) % 2 === 0;
      p.set(x, y, lit ? (row % 3 === 0 ? '#ff5cc8' : row % 3 === 1 ? '#5ce0ff' : '#ffe45c') : '#f4e8ff');
    }
  }
  p.rect(0, HORIZON, W, 1, '#ffffff');
  backdrop = p.canvas();
  return backdrop;
}

/** Sweeping party lights and confetti over the backdrop. Additive, so the scene only gets brighter. */
export function drawParty(ctx: CanvasRenderingContext2D, t: number) {
  ctx.drawImage(partyBackdrop(), 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beams: [number, string][] = [[40, 'rgba(255,90,200,0.16)'], [128, 'rgba(90,220,255,0.14)'], [216, 'rgba(255,230,90,0.16)']];
  beams.forEach(([bx, col], i) => {
    const a = Math.sin(t * 0.02 + i * 2.1) * 0.6;
    const len = 240;
    const ex = bx + Math.sin(a) * len, ey = Math.cos(a) * len;
    const px = Math.cos(a) * 22, py = -Math.sin(a) * 22;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(bx - 2, 0);
    ctx.lineTo(bx + 2, 0);
    ctx.lineTo(ex + px, ey + py);
    ctx.lineTo(ex - px, ey - py);
    ctx.fill();
  });
  // floor flash on the beat
  const ph = (t % (BAR / 4)) / (BAR / 4);
  if (ph < 0.25) {
    ctx.fillStyle = `rgba(255,255,255,${(0.25 - ph) * 0.4})`;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
  }
  ctx.restore();
  const cols = ['#ff3c8c', '#3cc8ff', '#ffe03c', '#6cff6c', '#ffffff', '#b06cff'];
  for (let i = 0; i < 40; i++) {
    const x = (i * 67 + Math.sin(t * 0.03 + i) * 6 + t * 0.15) % W;
    const y = (i * 41 + t * (0.35 + (i % 5) * 0.08)) % (H + 10) - 5;
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(Math.round(x), Math.round(y), (t + i * 7) % 20 < 10 ? 2 : 1, 2);
  }
}
