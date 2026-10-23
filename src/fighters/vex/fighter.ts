import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, VICTORY, DIZZY } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import type { Part, Pose } from '../../gfx/rig';
import type { PortraitStyle } from '../../gfx/portrait';
import type { SetPainter } from '../../scenes/sets';
import { Projectile } from '../../game/projectile';
import { Painter } from '../../gfx/painter';
import { css, darken, lighten } from '../../gfx/palette';
import { drawText } from '../../gfx/font';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { say, sfx } from '../../audio/sfx';
import { playCue } from '../../audio/specials';
import { type Intro } from '../../game/intro';

// Vex Vector: an original 90s cyberpunk hacker who lives in the server floors of the Data Spire.
// Spiky neon-green hair, a chunky wraparound VR headset with a glowing slit, a cropped purple
// bomber jacket with cyan piping, cargo pants and high-tops, and a keyboard strapped to his
// forearm. He fights with data packets, glitch-teleports and a firewall. Every line is original.

const OUT = '#0a0a12';
const CODE = ['#30ff70', '#a0ffb8', '#20c0ff', '#ffffff'];
const GLITCH = ['#ff2a6a', '#20e0ff', '#30ff70', '#ffffff'];

/** Visor and wrist-deck colours for each palette: [shell, glow]. */
interface Kit { shell: string; glow: string }
const KIT: Kit = { shell: '#3a3a4c', glow: '#30ffe0' };
const ALT_KIT: Kit = { shell: '#d8d8e0', glow: '#ff3a8a' };

/** Head part (24x44, face to the right): a chunky VR headset wrapped over the eyes. */
function paintVisor(p: Painter, k: Kit) {
  const sh = k.shell, dk = css(darken(sh, 0.4)), hl = css(lighten(sh, 0.35));
  // strap round the back of the head
  p.line(3, 25, 10, 25, dk);
  p.line(3, 26, 10, 26, dk);
  // the headset block over the eyes, jutting past the brow
  p.poly([[9, 23.5], [18.5, 24], [19.5, 26], [19, 29.5], [9.5, 30]], sh);
  p.line(10, 24, 18, 24.5, hl);
  p.line(10, 29.5, 18.5, 29.5, dk);
  // the glowing viewing slit and a status LED on the side
  p.line(12, 27, 19, 27, k.glow);
  p.set(19, 26, '#ffffff');
  p.set(10, 27, k.glow);
}

/** Torso part (28x42): a glowing circuit trace across the black tee and piping on the jacket. */
function paintCircuit(p: Painter, k: Kit) {
  p.line(17, 10, 19, 10, k.glow);
  p.line(19, 10, 19, 15, k.glow);
  p.set(17, 13, k.glow), p.set(18, 17, k.glow);
  p.line(17, 19, 19, 19, k.glow);
  // stripes round the waistband of the cropped jacket
  p.line(7, 22, 19, 22, css(lighten(k.glow, 0.1)));
}

/** Front forearm (12x23): a little keyboard strapped on, with a green screen strip. */
function paintDeck(p: Painter, k: Kit, front: boolean) {
  if (!front) return;
  p.rect(1.5, 4, 9, 6, k.shell);
  p.line(2, 5, 9, 5, '#30ff70');
  for (const y of [7, 9]) for (let x = 2; x < 10; x += 2) p.set(x, y, css(lighten(k.shell, 0.45)));
  p.line(1, 11, 10, 11, css(darken(k.shell, 0.4)));
}

function look(base: Omit<Look, 'paint'>, k: Kit): Look {
  return { ...base, paint: { head: (p) => paintVisor(p, k), torso: (p) => paintCircuit(p, k), foreArm: (p, _L, front) => paintDeck(p, k, front) } };
}

export const VEX_LOOK: Look = look({
  skin: '#d8a07c', hair: '#36e878', eye: '#1a1a24', shirt: '#16161e', coat: '#4a2a8a', coatTrim: '#30d8ff',
  pants: '#3a4038', boots: '#202028', hiTops: '#30d8ff', glove: '#1c1c24', belt: '#18181c', buckle: '#9aa0aa',
  hairStyle: 'spiky',
}, KIT);
/** Palette swap for mirror matches: hot orange hair, a white jacket and a pink-lit visor. */
export const VEX_ALT: Look = look({
  ...VEX_LOOK, hair: '#ff8a20', coat: '#e8e8ee', coatTrim: '#ff3a8a', shirt: '#22202a', pants: '#2a2a3a', hiTops: '#ff3a8a',
}, ALT_KIT);

export const VEX_LINES = {
  intro: 'Your firewall is adorable. I am already inside it.',
  finisher: 'Deleting you now. There is no backup.',
};
const VOICE = { pitch: 0.95, rate: 1.05 };

// ------------------------------------------------------------------ sprites

/** A data packet: a glowing envelope-shaped block with a bit pattern on its face. */
function packetSprite(frame: number): HTMLCanvasElement {
  const p = new Painter(16, 12);
  p.rect(1, 1, 14, 10, '#0a3a24');
  p.rect(2, 2, 12, 8, '#30ff70');
  p.line(2, 2, 8, 6, '#0a6a3a');
  p.line(13, 2, 8, 6, '#0a6a3a');
  const bits = [0b101101, 0b011010, 0b110011, 0b100110][frame % 4];
  for (let i = 0; i < 6; i++) if ((bits >> i) & 1) p.set(3 + i * 2, 8, '#ffffff');
  p.outline('#04140c');
  return p.canvas();
}

/** The little arrow cursor from the finisher. */
function cursorSprite(): HTMLCanvasElement {
  const p = new Painter(9, 13);
  p.poly([[0, 0], [0, 10], [2.5, 8], [4.5, 12], [6, 11.5], [4, 7.5], [7.5, 7.5]], '#ffffff');
  p.outline('#000000');
  return p.canvas();
}

/** One character of falling code: a 3x5 glyph of a 0 or a 1. */
function glyph(one: boolean, c: string): HTMLCanvasElement {
  const p = new Painter(3, 5);
  if (one) p.line(1, 0, 1, 4, c), p.set(0, 1, c);
  else {
    p.rect(0, 0, 3, 5, c);
    for (let y = 1; y < 4; y++) p.set(1, y, c, 0);
  }
  return p.canvas();
}

let SPR: { packets: HTMLCanvasElement[]; cursor: HTMLCanvasElement; glyphs: HTMLCanvasElement[] } | null = null;
const spr = () =>
  (SPR ??= {
    packets: [0, 1, 2, 3].map(packetSprite),
    cursor: cursorSprite(),
    glyphs: [glyph(false, '#30ff70'), glyph(true, '#30ff70'), glyph(false, '#a0ffb8'), glyph(true, '#20c0ff')],
  });

/** Projectile drawing for the 'packet' kind (origin at its centre). */
export function drawPacket(ctx: CanvasRenderingContext2D, t: number) {
  ctx.drawImage(spr().packets[(t >> 2) % 4], -8, -6);
}

/** Projectile drawing for the 'firewall' kind: a column of cyan-green code flames, `k` grown (0-1). */
export function drawFirewall(ctx: CanvasRenderingContext2D, t: number, k: number) {
  const h = Math.round(64 * k), w = 26;
  for (let x = -w / 2; x < w / 2; x += 2) {
    const flick = ((x * 7 + t * 3) % 11) - 5;
    const top = Math.max(0, h - Math.abs(x) * 1.4 + flick);
    ctx.fillStyle = '#0a5a40';
    ctx.fillRect(x, -top, 2, top);
    ctx.fillStyle = '#20d090';
    ctx.fillRect(x, -top * 0.8, 2, top * 0.8);
    ctx.fillStyle = '#80ffe0';
    ctx.fillRect(x, -top * 0.45, 2, top * 0.45);
  }
  // a brick grid of code lines glowing through it
  ctx.fillStyle = '#e8fff8';
  for (let y = 4; y < h - 6; y += 8)
    for (let x = -w / 2 + ((y >> 3) % 2) * 4; x < w / 2 - 2; x += 8) if (((x + y + (t >> 1)) & 6) === 0) ctx.fillRect(x, -y, 4, 1);
  ctx.fillStyle = '#80ffe0';
  ctx.fillRect(-w / 2 - 2, -2, w + 4, 2);
}

/** A spray of code bits (pixels and tiny 0/1 glyphs) out of a point. */
export function bits(f: Fight, x: number, y: number, n: number, spread = 1, cols = CODE) {
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0)
      f.particles.add({ kind: 'img', img: spr().glyphs[i % 4], ix: 1, iy: 2, x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-spread, spread), vy: rand(0, 1.5), grav: 0.04, life: 30, max: 30 });
    else
      f.particles.add({ kind: 'spark', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-spread, spread), vy: rand(-0.4, 1.4), life: 28, max: 28, size: i % 4 ? 1 : 2, color: cols[i % cols.length], floor: false });
  }
}

/** RGB-split glitch blocks scattered over a fighter's body. */
function glitch(f: Fight, x: number, n: number) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'spark', x: x + rand(-12, 12), y: rand(6, 76), vx: rand(-2, 2), vy: 0, life: 6 + (i % 5), max: 10, size: 2 + (i % 3), color: GLITCH[i % 4], floor: false });
}

// ------------------------------------------------------------------ poses (facing right)

/** Front forearm across the chest, the back hand typing on the wrist deck. */
const TYPE: Pose = P(STANCE, { t: 6, h: 12, af: -40, ef: -95, ab: -30, eb: -95, lf: -14, kf: 10, lb: 16, kb: 6 });
const TYPE2: Pose = P(TYPE, { ab: -38, eb: -88, h: 14 });
/** Palm shoved out at the opponent. */
const PUSH: Pose = P(STANCE, { t: 18, h: 2, af: -94, ef: -2, ab: 25, eb: -20, lf: -40, kf: 40, lb: 30, kb: 8 });
/** Both arms flung upward. */
const RAISE: Pose = P(STANCE, { t: -10, h: -16, af: -165, ef: -20, ab: -150, eb: -25, lf: -16, kf: 10, lb: 18, kb: 6 });
/** Arms folded, head cocked: unimpressed. */
const SMUG: Pose = P(STANCE, { t: -4, h: -8, af: -60, ef: -110, ab: -50, eb: -115, lf: -10, kf: 6, lb: 12, kb: 4 });
/** One finger raised, about to press Enter. */
const POISE: Pose = P(TYPE, { ab: -70, eb: -60, h: 10 });

// ------------------------------------------------------------------ specials

const packetShot: Move = {
  id: 'proj_packet',
  anim: A([
    [TYPE, 4],
    [TYPE2, 4],
    [P(STANCE, { af: 40, ef: -70, ab: -40, t: -6, h: -6 }), 3],
    [PUSH, 12, 'out'],
    [STANCE, 6],
  ]),
  onFrame: (self: Fighter, f: Fight, fr: number) => {
    if (fr === 1) playCue('keyTap');
    if (fr === 11) {
      f.projectiles.push(new Projectile(self, 'packet', self.x + self.facing * 24, 52));
      self.projOut = true;
      playCue('packetSend');
      bits(f, self.x + self.facing * 22, 52, 6, 1.2);
    }
  },
};

const glitchStep: Move = {
  id: 'glitchstep',
  anim: A([
    [TYPE, 6],
    [P(TYPE2, { t: 10 }), 4],
    [P(CROUCH, {}), 12],
    // reappears mid-air with a flying knee
    [P(STANCE, { lf: -110, kf: 120, lb: 20, kb: 40, t: 14, h: 6, af: -60, ef: -80, ab: 20, eb: -60 }), 3],
    [P(STANCE, { lf: -120, kf: 130, lb: 30, kb: 30, t: 20, h: 8, af: -40, ef: -90, ab: 30, eb: -50 }), 9],
    [STANCE, 10],
  ]),
  invisible: [10, 22],
  active: [23, 31],
  vx: (fr) => (fr >= 22 && fr < 30 ? 1.6 : 0),
  hit: { limb: 'kneeF', r: 9, dmg: 90, level: 'mid', effect: 'knockdown', push: 2.4, stun: 20, special: true },
  onFrame: (self, f, fr) => {
    if (fr === 4) playCue('keyTap');
    if (fr >= 6 && fr < 10) glitch(f, self.x, 5);
    if (fr === 10) {
      playCue('glitchOut');
      bits(f, self.x, 40, 14, 1.6);
    }
    if (fr === 16) {
      // land on the far side of the opponent, turned to face them
      const o = self.opp;
      const side = o.x >= self.x ? 1 : -1;
      self.x = Math.max(20, Math.min(f.sw - 20, o.x + side * 34));
      self.facing = o.x > self.x ? 1 : -1;
    }
    if (fr >= 17 && fr < 22) glitch(f, self.x, 4);
    if (fr === 20) playCue('glitchIn');
  },
};

const firewall: Move = {
  id: 'firewall',
  anim: A([
    [TYPE, 4],
    [TYPE2, 4],
    [TYPE, 4],
    [P(RAISE, { t: 4 }), 6, 'out'],
    [RAISE, 16],
    [STANCE, 8],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 1 || fr === 8) playCue('keyTap');
    if (fr === 12) playCue('enterKey');
    if (fr === 14) {
      f.projectiles.push(new Projectile(self, 'firewall', self.x + self.facing * 58, 30));
      self.projOut = true;
    }
  },
};

const specials: Special[] = [
  { name: 'Packet Shot', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: packetShot },
  { name: 'Glitch Step', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K', move: glitchStep },
  { name: 'Firewall', cmd: [4, 6], btn: 'hp', text: 'B, F + HP', move: firewall },
];

// ------------------------------------------------------------------ intro

/** Round 1 entrance: he compiles in out of a rain of code, flickers solid, types a command and folds his arms. */
export const VEX_INTRO: Intro = {
  line: VEX_LINES.intro,
  speech: VOICE,
  speakAt: 84,
  dur: 170,
  update(self, f, t, home) {
    self.x = home;
    if (t === 0) {
      self.alpha = 0;
      playCue('dataStream');
    }
    if (t < 50) {
      // code rains down onto his spot, then he flickers in
      self.poseOverride = RAISE;
      if (t % 2 === 0) bits(f, self.x + rand(-14, 14), rand(60, 90), 2, 0.2);
      if (t >= 24) self.alpha = (t >> 1) % 3 === 0 ? 0 : Math.min(1, (t - 24) / 22);
      if (t >= 24 && t % 4 === 0) glitch(f, self.x, 2);
      if (t === 24) playCue('glitchIn');
    } else if (t < 80) {
      self.alpha = 1;
      self.poseOverride = (t >> 2) % 2 ? TYPE : TYPE2;
      if (t % 8 === 0) playCue('keyTap');
      if (t === 76) playCue('enterKey');
    } else self.poseOverride = SMUG;
  },
};

// ------------------------------------------------------------------ finisher

/** Order the loser's parts are deleted in, and the frame each one goes. */
const DELETE_ORDER: [Parameters<Fighter['hidden']['add']>[0], number][] = [
  ['head', 118], ['armF', 136], ['armB', 152], ['torso', 170], ['legF', 186], ['legB', 200],
];
const ASK = 30, CLICK = 86, BAR0 = 96, BAR1 = 206, GONE = 214;

/**
 * Hard Delete: a system dialog pops up over the loser asking whether to delete them. Vex steers
 * a cursor over and clicks YES. A progress bar fills while the loser is selected and deleted a
 * piece at a time, each one crumbling into bits. Then the screen confirms the file is gone.
 */
function hardDelete(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const ps = f.particles;
  if (t === 0) {
    D.dir = w.facing;
    D.bx = l.x;
  }
  const dir = D.dir as 1 | -1;
  // step back to make room
  if (t < 20 && (l.x - w.x) * dir < 70) w.x = Math.max(20, Math.min(f.sw - 20, w.x - dir * 2.5));
  if (t < ASK) w.poseOverride = (t >> 2) % 2 ? TYPE : TYPE2;
  if (t % 8 === 0 && t < CLICK) playCue('keyTap');
  if (t === 10) say(VEX_LINES.finisher, VOICE);
  if (t === ASK) playCue('dialogChime');
  if (t >= ASK && t < CLICK) w.poseOverride = (t >> 3) % 2 ? TYPE : TYPE2;
  if (t === CLICK) {
    playCue('mouseClick');
    w.poseOverride = POISE;
  }
  if (t === CLICK + 6) playCue('enterKey');
  // the loser is selected and held up off the ground while the bar fills
  if (t >= CLICK && t < GONE) {
    l.y = Math.min(6, l.y + 0.25);
    l.poseOverride = P(DIZZY, { rot: Math.sin(t * 0.3) * 3 });
    if (t % 14 === 0) playCue('driveGrind');
    if (t > CLICK + 10) w.poseOverride = (t >> 2) % 2 ? TYPE : TYPE2;
  }
  for (const [part, at] of DELETE_ORDER) {
    if (t !== at) continue;
    l.hidden.add(part);
    playCue('deleteChunk');
    sfx.blood();
    const s = l.skel, Pt = l.parts;
    const pieces: Record<string, [Part, [number, number]][]> = {
      head: [[Pt.head, s.neck]],
      armF: [[Pt.uarm, s.shF], [Pt.farm, s.elbowF]],
      armB: [[Pt.uarmB, s.shB], [Pt.farmB, s.elbowB]],
      torso: [[Pt.torso, s.hip]],
      legF: [[Pt.thigh, s.hipF], [Pt.shin, s.kneeF], [Pt.foot, s.ankleF]],
      legB: [[Pt.thighB, s.hipB], [Pt.shinB, s.kneeB], [Pt.footB, s.ankleB]],
    };
    for (const [pt, at2] of pieces[part]) {
      const x = l.wx(at2[0]), y = l.wy(at2[1]);
      // the pieces only last a moment before they crumble into bits too
      ps.chunk(pt.img, pt.px, pt.py, x, y, rand(-0.6, 0.6), rand(0.5, 2), rand(-0.3, 0.3), 40);
      bits(f, x, y, 12, 1.4);
      ps.blood(x, y, dir, 14, 1);
    }
    f.shake(3);
  }
  for (const [, at] of DELETE_ORDER) if (t === at + 40) bits(f, D.bx + rand(-10, 10), 6, 10, 1.2);
  if (t === GONE) {
    l.alpha = 0;
    playCue(['errorBuzz', 'packetPop']);
    bits(f, D.bx, 30, 30, 2.2);
    f.shake(8);
  }
  if (t > GONE && t < 260 && t % 5 === 0) ps.blood(D.bx + rand(-12, 12), 2, rand(-1, 1), 2, 0.6);
  if (t >= GONE + 16) w.poseOverride = t < 270 ? SMUG : VICTORY;
  if (t === 260) playCue('dialogChime');
  return t >= 330;
}

/** Plain 90s-style system window with a title bar (screen coordinates). */
function windowBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#c4c4cc';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f4f4f8';
  ctx.fillRect(x, y, w, 1), ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = '#6a6a74';
  ctx.fillRect(x, y + h - 1, w, 1), ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = '#1a2a8a';
  ctx.fillRect(x + 2, y + 2, w - 4, 9);
  drawText(ctx, title, x + 4, y + 3, '#ffffff');
  // close box
  ctx.fillStyle = '#c4c4cc';
  ctx.fillRect(x + w - 10, y + 3, 7, 7);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - 8, y + 5, 3, 3);
}

function button(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, down: boolean) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x - 1, y - 1, 24, 12);
  ctx.fillStyle = down ? '#9a9aa4' : '#d8d8e0';
  ctx.fillRect(x, y, 22, 10);
  ctx.fillStyle = down ? '#6a6a74' : '#ffffff';
  ctx.fillRect(x, y, 22, 1);
  drawText(ctx, label, x + 11, y + 2 + (down ? 1 : 0), '#000000', { align: 'center' });
}

function drawHardDelete(ctx: CanvasRenderingContext2D, f: Fight, cam: number, front: boolean) {
  const D = f.fatal?.data;
  if (!D || D.bx == null || !front) return;
  const t = f.fatal!.t;
  const l = f.loser, w = f.winner;
  const cx = Math.round(Math.max(54, Math.min(202, D.bx - cam)));
  const bw = 112, bh = 54, bx = cx - bw / 2, by = 22;
  // marching-ants selection box round the loser
  if (t >= CLICK && t < GONE && l) {
    const x0 = Math.round(D.bx - cam - 22), y0 = FLOOR - 92, x1 = x0 + 44, y1 = FLOOR - 2;
    ctx.fillStyle = '#ffffff';
    const off = (t >> 1) % 4;
    for (let x = x0 + off; x < x1; x += 4) ctx.fillRect(x, y0, 2, 1), ctx.fillRect(x, y1, 2, 1);
    for (let y = y0 + off; y < y1; y += 4) ctx.fillRect(x0, y, 1, 2), ctx.fillRect(x1, y, 1, 2);
  }
  if (t >= ASK && t < GONE + 4) {
    const k = Math.min(1, (t - ASK) / 6);
    ctx.save();
    ctx.translate(cx, by + bh / 2);
    ctx.scale(k, k);
    ctx.translate(-cx, -(by + bh / 2));
    if (t < BAR0) {
      const name = l?.ch.short ?? 'FILE';
      windowBox(ctx, bx, by, bw, bh, 'DELETE?');
      // warning sign
      ctx.fillStyle = '#e8c020';
      ctx.beginPath();
      ctx.moveTo(bx + 13, by + 16), ctx.lineTo(bx + 21, by + 31), ctx.lineTo(bx + 5, by + 31);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx + 12, by + 20, 2, 6), ctx.fillRect(bx + 12, by + 27, 2, 2);
      drawText(ctx, 'DELETE THIS', bx + 26, by + 15, '#000000');
      drawText(ctx, name + '?', bx + 26, by + 25, '#000000');
      button(ctx, bx + 26, by + 39, 'YES', t >= CLICK && t < CLICK + 6);
      button(ctx, bx + 62, by + 39, 'NO', false);
    } else {
      windowBox(ctx, bx, by, bw, bh, 'DELETING...');
      const k2 = Math.max(0, Math.min(1, (t - BAR0) / (BAR1 - BAR0)));
      drawText(ctx, (l?.ch.short ?? 'FILE') + '.EXE', bx + 6, by + 16, '#000000');
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx + 5, by + 32, bw - 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + 6, by + 33, bw - 12, 8);
      // chunky segmented progress blocks
      ctx.fillStyle = '#1a2a8a';
      const segs = Math.floor(k2 * 16);
      for (let i = 0; i < segs; i++) ctx.fillRect(bx + 7 + i * 6, by + 34, 5, 6);
      drawText(ctx, Math.floor(k2 * 100) + '%', bx + bw - 6, by + 16, '#000000', { align: 'right' });
    }
    ctx.restore();
  }
  // the cursor glides from Vex's wrist deck to the YES button
  if (t >= ASK + 8 && t < BAR0 && w) {
    const s = w.skel;
    const sx = w.wx(s.handF[0]) - cam, sy = FLOOR - w.wy(s.handF[1]);
    const tx = bx + 36, ty = by + 43;
    const k = Math.min(1, Math.max(0, (t - ASK - 12) / (CLICK - ASK - 18)));
    const e = k * k * (3 - 2 * k);
    ctx.drawImage(spr().cursor, Math.round(sx + (tx - sx) * e), Math.round(sy + (ty - sy) * e));
  }
  if (t >= GONE && t < 300) {
    const blink = t < GONE + 30 ? (t >> 2) % 2 === 0 : true;
    if (blink) {
      drawText(ctx, 'FILE DELETED', 128, 66, '#30ff70', { scale: 2, align: 'center', outline: '#000000' });
      drawText(ctx, 'NO BACKUP FOUND', 128, 88, '#ffffff', { align: 'center', outline: '#000000' });
    }
  }
}

// ------------------------------------------------------------------ select screen set

/** A dark server room: racks of blinking lights, a glowing CRT and cable trays on a raised floor. */
export const serverRoomSet: SetPainter = (g, c) => {
  const { u } = g;
  const glow = c.look === VEX_ALT ? ALT_KIT.glow : KIT.glow;
  g.r(0, 0, g.w, g.floor, '#0a0c16');
  g.r(0, 0, g.w, g.floor * 0.4, '#0c1020');
  // server racks
  for (let i = 0; i < 4; i++) {
    const x = i * g.w * 0.27 - 2 * u, rw = g.w * 0.2;
    g.r(x, 3 * u, rw, g.floor - 3 * u, '#161a28');
    g.r(x + u, 4 * u, rw - 2 * u, g.floor - 5 * u, '#1e2436');
    for (let y = 5 * u, row = 0; y < g.floor - 2 * u; y += 2 * u, row++) {
      g.r(x + u * 1.5, y, rw - 3 * u, u, '#0e1220');
      const on = (row * 7 + i * 3 + (g.t >> 3)) % 5;
      g.r(x + rw - 3 * u, y, u, u, on === 0 ? '#ff3a5a' : on < 3 ? '#30ff70' : '#123a22');
      if ((row + i + (g.t >> 4)) % 3 === 0) g.r(x + rw - 5 * u, y, u, u, glow);
    }
  }
  // a CRT on a desk with scrolling green code
  const mx = g.w * 0.62, my = g.floor - 12 * u;
  g.r(mx - u, my - u, 12 * u, 10 * u, '#2a2a34');
  g.r(mx, my, 10 * u, 7 * u, '#04140c');
  for (let i = 0; i < 4; i++) {
    const len = ((i * 5 + (g.t >> 3)) % 7) + 2;
    g.r(mx + u, my + u + i * 1.5 * u, len * u, u * 0.8, '#30ff70');
  }
  g.r(mx + 3 * u, my + 9 * u, 4 * u, 2 * u, '#2a2a34');
  // raised floor tiles with a glowing seam
  for (let y = g.floor, row = 0; y < g.h; y += 4 * u, row++)
    for (let x = 0, col = 0; x < g.w; x += 6 * u, col++) g.r(x, y, 6 * u - 1, 4 * u - 1, (row + col) % 2 ? '#1a1e2c' : '#20263a');
  g.r(0, g.floor, g.w, u, glow);
};

// ------------------------------------------------------------------ portrait

export const VEX_PORTRAIT: PortraitStyle = {
  front(p, c) {
    const g = c.geom, L = c.look;
    const k = L.coat === VEX_ALT.coat ? ALT_KIT : KIT;
    // tall gelled spikes standing up off the crown
    const top = g.crown;
    for (const [x, h, lean] of [[30, 14, -6], [42, 20, -3], [54, 22, 0], [66, 18, 4], [76, 12, 7]])
      c.sculpt((m) => m.poly([[x - 7, top + 8], [x + lean, top - h], [x + 7, top + 8]], '#fff'), L.hair, { soft: 2 });
    for (const [x, h, lean] of [[42, 20, -3], [54, 22, 0], [66, 18, 4]]) p.line(x - 2, top + 4, x + lean, top - h + 3, lighten(L.hair, 0.4));
    const y = Math.round((g.eyeA[1] + g.eyeB[1]) / 2);
    const x0 = g.eyeA[0] - 14, x1 = g.eyeB[0] + 14;
    // strap round to the ear
    p.line(g.ear[0] - 6, y - 2, x0, y - 2, darken(k.shell, 0.45));
    p.line(g.ear[0] - 6, y - 1, x0, y - 1, darken(k.shell, 0.45));
    // the chunky VR headset over both eyes
    c.sculpt((m) => m.poly([[x0, y - 10], [x1, y - 9], [x1 + 4, y - 4], [x1 + 2, y + 8], [x0, y + 9]], '#fff'), k.shell, { soft: 2 });
    p.line(x0 + 2, y - 9, x1 - 2, y - 8, lighten(k.shell, 0.4));
    // the glowing slit (cracked and flickering when beaten)
    const glow = c.beaten ? '#ff3a3a' : k.glow;
    for (let x = x0 + 4; x < x1; x++) if (!c.beaten || x % 5) p.set(x, y, glow), p.set(x, y + 1, lighten(glow, 0.4));
    p.set(x1, y - 3, '#ffffff');
    if (c.beaten) p.line(x0 + 10, y - 9, x0 + 16, y + 8, '#000000');
  },
};

export function vex(): CharDef {
  return {
    id: 'vex', name: 'Vex Vector', short: 'VEX', title: 'The Firewall Breaker', look: VEX_LOOK, alt: VEX_ALT,
    specials, voice: 230, props: {}, intro: VEX_INTRO, portrait: VEX_PORTRAIT, selectSet: serverRoomSet,
    homeStage: 'spire',
    finisher: { name: 'Hard Delete', cmd: [2, 6, 4], btn: 'lk', text: 'D, F, B + LK (any range)', range: [0, 400] },
    fatality: hardDelete,
    fatalityDraw: drawHardDelete,
    quotes: [
      'YOU GOT PATCHED, {L}. PERMANENTLY.',
      'YOUR PASSWORD WAS PASSWORD. IT IS ALWAYS PASSWORD.',
      'I DID NOT EVEN NEED A CHEAT CODE.',
      'LAG IS NOT AN EXCUSE. I CHECKED YOUR PING.',
    ],
    quotesVs: {
      hawking: 'NICE CHAIR. I HAD ROOT ACCESS IN FOUR SECONDS.',
      tesla: 'YOU INVENTED THE CURRENT. I JUST RIDE IT.',
      blaine: 'YOUR TRICKS RUN ON HARDWARE. MINE RUN ON SOFTWARE.',
      cleo: 'YOU READ THE FUTURE? I READ YOUR BROWSER HISTORY.',
    },
  };
}
