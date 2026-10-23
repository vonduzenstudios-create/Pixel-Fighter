import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { rand, rng } from '../core/rng';
import { noise } from '../audio/audio';
import { sfx } from '../audio/sfx';
import { drawText } from '../gfx/font';
import { makeCanvas, Painter } from '../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../gfx/palette';
import { drawRig, fk, PartSet } from '../gfx/rig';
import { P, LIE } from './anims';
import type { SongName } from '../audio/music';
import type { Fight } from './fight';
import type { Particles } from './particles';

// "The Decibel Dome": a sold-out arena rock show. The fight happens on the front of the stage
// while an original band, the Chrome Howlers, plays on behind it under a truss of moving lights.
// Flame cannons along the lip fire on the big moments and the crowd surges against the barrier.
// Every layer is painted procedurally at load time; band, lights, pyro and crowd animate live.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.3);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.65);
const TRUSS_W = W + Math.ceil((STAGE_W - W) * 0.85);
const CROWD_W = W + Math.ceil((STAGE_W - W) * 1.2);
/** Back edge of the stage floor; the band stands on it. */
const BACK = 166;
const MC = Math.round(MID_W / 2);
/** One beat at the song's 150 bpm, in frames. */
const BEAT = 24;
const BAR = BEAT * 4;
/** Timed pyro volleys fire this often during a show. */
const VOLLEY = BAR * 4;
const CANNONS = [40, 136, 256, 376, 472];
const HEADS = [30, 92, 154, 216, 278, 340, 402, 444];
/** The crowd's silhouette colour: just lighter than the stage skirt behind them. */
const SIL = '#261c30';
const GELS = ['#ff2a6a', '#20d0ff', '#ffb020', '#a040ff', '#40ff80', '#ff3020'];

interface Jet { x: number; t0: number; big: boolean }
interface Fan { x: number; y: number; kind: number; ph: number; hype: number; hair: number }


/** The arena behind the stage: roof girders, speaker hangs and the band's giant backdrop. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1201);
  p.gradRect(0, 0, FAR_W, H, '#06040c', '#160a1e', 8);
  // roof girders lost in the dark
  for (let x = -40; x < FAR_W + 40; x += 22) {
    p.line(x, 0, x + 22, 22, '#1a1426');
    p.line(x + 22, 0, x, 22, '#1a1426');
  }
  p.rect(0, 0, FAR_W, 1, '#241c30');
  p.rect(0, 22, FAR_W, 1, '#241c30');
  // a haze of lighters glimmering in the far upper tiers at either side
  for (let i = 0; i < 70; i++) {
    const side = r.next() < 0.5, x = side ? r.int(0, 60) : r.int(FAR_W - 60, FAR_W), y = r.int(36, 130);
    p.set(x, y, r.pick(['#ffd070', '#ffb040', '#fff0c0', '#6a4a30']));
  }
  // the backdrop: a huge crimson banner with folds and a ragged hem
  const bx = Math.round(FAR_W / 2) - 92, bw = 184, by = 26, bh = 98;
  for (let y = by; y < by + bh; y++)
    for (let x = bx; x < bx + bw; x++) {
      const fold = Math.sin((x - bx) * 0.21) * 0.5 + Math.sin((x - bx) * 0.05) * 0.5;
      let c: Color = mix('#4a0a14', '#8a1426', 0.5 + fold * 0.4);
      if (bayer(x, y) < 0.12 + (fold < -0.4 ? 0.2 : 0)) c = darken(c, 0.2);
      p.set(x, y, c);
    }
  for (let x = bx; x < bx + bw; x++) {
    const hem = (x * 7) % 5;
    for (let y = by + bh; y < by + bh + hem; y++) p.set(x, y, '#3a0810');
    p.set(x, by, '#2a2a30');
  }
  // its pipe batten and chains
  p.rect(bx - 6, by - 3, bw + 12, 3, '#5a5a66');
  for (const cx of [bx + 10, bx + bw - 12]) p.line(cx, 0, cx, by - 3, '#3a3a44');
  // the band's mark: a chrome wolf skull with a lightning bolt through it (original design)
  const cx = bx + bw / 2, cy = 76;
  const chrome = (x: number, y: number) => mix('#f4f8ff', '#6a7488', Math.min(1, Math.max(0, (y - cy + 18) / 34)));
  p.poly([[cx - 15, cy - 8], [cx - 18, cy - 26], [cx - 6, cy - 14]], chrome(cx, cy - 20)); // ears
  p.poly([[cx + 15, cy - 8], [cx + 18, cy - 26], [cx + 6, cy - 14]], chrome(cx, cy - 20));
  for (let y = cy - 18; y < cy + 26; y++)
    for (let x = cx - 18; x <= cx + 18; x++) {
      const dx = (x - cx) / 17, dy = (y - cy) / 14;
      const cranium = dx * dx + dy * dy < 1;
      const snout = y >= cy && Math.abs(x - cx) < 10 - (y - cy) * 0.22;
      if (cranium || snout) p.set(x, y, chrome(x, y));
    }
  for (const s of [-1, 1]) {
    p.poly([[cx + s * 3, cy - 2], [cx + s * 13, cy - 6], [cx + s * 11, cy + 4]], '#120408'); // eye sockets
    p.set(cx + s * 9, cy - 2, '#ff3040');
    p.poly([[cx + s * 4, cy + 17], [cx + s * 7, cy + 17], [cx + s * 5, cy + 26]], '#f4f8ff'); // fangs
  }
  p.poly([[cx - 3, cy + 8], [cx + 3, cy + 8], [cx, cy + 12]], '#120408');
  for (let x = cx - 7; x <= cx + 7; x += 2) p.set(x, cy + 16, '#3a3e4a');
  // the bolt
  p.poly([[cx + 4, cy - 30], [cx - 6, cy - 4], [cx + 1, cy - 4], [cx - 5, cy + 22], [cx + 8, cy - 8], [cx + 1, cy - 8], [cx + 10, cy - 30]], '#ffd030');
  p.outline('#1a0408');
  // speaker line arrays flown either side of the banner
  for (const sx of [bx - 46, bx + bw + 22]) {
    p.line(sx + 12, 0, sx + 12, 24, '#3a3a44');
    for (let k = 0; k < 8; k++) {
      const y = 24 + k * 11, inset = k > 4 ? k - 4 : 0;
      p.rect(sx + inset, y, 24 - inset * 2, 10, '#16161c');
      p.rect(sx + inset + 2, y + 2, 20 - inset * 2, 6, bayer(sx, y) < 0.5 ? '#26262e' : '#2c2c34');
      p.rect(sx + inset, y + 9, 24 - inset * 2, 1, '#0a0a0e');
    }
  }
  // the back wall of the stage, in shadow
  for (let y = 130; y < H; y++) for (let x = 0; x < FAR_W; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#0c0a10' : '#08060c');
  const cv = p.canvas();
  drawText(cv.getContext('2d')!, 'CHROME HOWLERS', cx, 32, '#e8ecf4', { scale: 2, align: 'center', grad: ['#ffffff', '#7a8498'], outline: '#1a0408' });
  return cv;
}

/** A tolex amp cabinet: grille cloth, corner caps and a dark border. */
function cab(p: Painter, x: number, y: number, w: number, h: number, head: boolean) {
  p.rect(x, y, w, h, '#121214');
  p.rect(x, y, w, 1, '#2a2a2e');
  if (head) {
    p.rect(x + 2, y + 2, w - 4, h - 4, '#1c1c20');
    p.rect(x + 3, y + 3, w - 6, 2, '#b89a50');
    for (let k = x + 5; k < x + w - 4; k += 3) p.set(k, y + h - 4, '#e8d080');
    return;
  }
  for (let yy = y + 2; yy < y + h - 2; yy++)
    for (let xx = x + 2; xx < x + w - 2; xx++) p.set(xx, yy, (xx + yy) % 2 ? '#34302c' : '#2a2622');
  for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) p.rect(cx, cy, 2, 2, '#8a8a92');
}

/** Mid layer: walls of amps, the drum riser and the drum kit (kit is separate, it sits in front of the drummer). */
function mid(): [HTMLCanvasElement, HTMLCanvasElement] {
  const p = new Painter(MID_W, H);
  for (const ax of [6, MID_W - 102]) {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 3; col++) cab(p, ax + col * 32, BACK - 22 - row * 22, 30, 22, false);
    for (let col = 0; col < 3; col++) cab(p, ax + col * 32, BACK - 22 * 4 - 12, 30, 12, true);
  }
  // the drum riser: carpeted top, silver edge, black skirt
  p.rect(MC - 54, 138, 108, 3, '#9a9aa4');
  p.rect(MC - 54, 141, 108, BACK - 141, '#141218');
  for (let x = MC - 54; x < MC + 54; x += 6) p.rect(x, 141, 1, BACK - 141, '#1e1c24');
  for (let x = MC - 54; x < MC + 54; x++) if (bayer(x, 137) < 0.5) p.set(x, 137, '#2a1620');
  // a pair of fill lights on the riser's front corners
  for (const fx of [MC - 50, MC + 46]) {
    p.rect(fx, 132, 5, 5, '#2a2a30');
    p.set(fx + 2, 134, '#ffe8a0');
  }
  const back = p.canvas();
  const k = new Painter(MID_W, H);
  // kick drum with the skull mark on its head
  k.ellipse(MC, 124, 13, 13, '#7a1020');
  k.ellipse(MC, 124, 11, 11, '#e8e0d8');
  k.ellipse(MC, 122, 5, 4, '#1a1a20');
  k.set(MC - 2, 122, '#ff3040');
  k.set(MC + 2, 122, '#ff3040');
  k.rect(MC - 2, 126, 4, 3, '#1a1a20');
  // rack toms, floor tom and snare
  k.ellipse(MC - 9, 108, 6, 4, '#7a1020');
  k.ellipse(MC + 9, 108, 6, 4, '#7a1020');
  k.rect(MC - 13, 106, 9, 1, '#e8e0d8');
  k.rect(MC + 5, 106, 9, 1, '#e8e0d8');
  k.rect(MC + 20, 118, 12, 14, '#7a1020');
  k.rect(MC + 20, 118, 12, 2, '#e8e0d8');
  k.rect(MC - 30, 118, 11, 6, '#7a1020');
  k.rect(MC - 30, 118, 11, 1, '#e8e0d8');
  for (const [sx, top] of [[MC - 25, 124], [MC + 26, 132]]) k.rect(sx, top, 1, 138 - top, '#8a8a92');
  // cymbal stands
  for (const [sx, sy] of [[MC - 36, 98], [MC + 34, 94], [MC - 28, 110]]) {
    k.rect(sx, sy, 1, 138 - sy, '#6a6a72');
    k.rect(sx - 7, sy, 15, 1, '#e0b040');
    k.set(sx, sy - 1, '#fff0a0');
  }
  k.outline('#08060a');
  return [back, k.canvas()];
}

/** The stage itself: boards, tape marks, cable runs, wedges, flame cannons and the lip. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1231);
  for (let y = BACK; y < FLOOR + 1; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const row = Math.floor((y - BACK) / 5);
      const seam = (y - BACK) % 5 === 4 || (x + row * 37) % 64 === 0;
      let c: Color = seam ? '#0c0a10' : mix('#18161e', '#26222c', (y - BACK) / (FLOOR - BACK));
      if (!seam && bayer(x, y) < 0.08) c = lighten(c, 0.06);
      p.set(x, y, c);
    }
  // gaffer-tape marks where everyone is supposed to stand
  for (let i = 0; i < 14; i++) {
    const tx = r.int(8, STAGE_W - 8), ty = r.int(BACK + 4, FLOOR - 6), c = r.pick(['#d8d8d0', '#e0c040', '#40c0e0']);
    if (r.next() < 0.5) { p.line(tx - 2, ty - 1, tx + 2, ty + 1, c); p.line(tx - 2, ty + 1, tx + 2, ty - 1, c); }
    else p.rect(tx - 3, ty, 6, 1, c);
  }
  // snaking cable runs
  for (let i = 0; i < 5; i++) {
    let y = r.int(BACK + 6, FLOOR - 10);
    const c = r.pick(['#050508', '#0a0a10', '#2a0a10']);
    for (let x = 0; x < STAGE_W; x++) {
      if (x % 9 === 0) y += r.int(-1, 1);
      y = Math.max(BACK + 3, Math.min(FLOOR - 4, y));
      p.set(x, y, c);
    }
  }
  // the stage lip: steel edge and a hazard stripe
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, FLOOR + 1, '#c0c0c8');
    p.set(x, FLOOR + 2, '#6a6a74');
    for (let y = FLOOR + 3; y < FLOOR + 7; y++) p.set(x, y, (x + y) % 8 < 4 ? '#e0b020' : '#141414');
  }
  // the black front skirt below
  for (let y = FLOOR + 7; y < H; y++) for (let x = 0; x < STAGE_W; x++) p.set(x, y, x % 7 === 0 ? '#060408' : '#0e0c12');
  // monitor wedges along the front
  for (const mx of [86, 196, 316, 426]) {
    p.poly([[mx, FLOOR], [mx + 22, FLOOR], [mx + 18, FLOOR - 9], [mx + 3, FLOOR - 6]], '#16161a');
    p.poly([[mx + 5, FLOOR - 2], [mx + 17, FLOOR - 2], [mx + 15, FLOOR - 7], [mx + 6, FLOOR - 5]], '#2a2a30');
    p.set(mx + 11, FLOOR - 4, '#40ff60');
  }
  // flame cannons: squat steel boxes with a nozzle and a warning tab
  for (const cx of CANNONS) {
    p.rect(cx - 6, FLOOR - 5, 12, 6, '#3a3a42');
    p.rect(cx - 6, FLOOR - 5, 12, 1, '#7a7a84');
    p.rect(cx - 2, FLOOR - 8, 4, 3, '#5a5a62');
    p.rect(cx - 1, FLOOR - 8, 2, 1, '#ff8020');
    p.rect(cx + 3, FLOOR - 3, 2, 2, '#e0b020');
  }
  return p.canvas();
}

/** The front rows, silhouetted against the stage. */
function crowd(): Fan[] {
  const r = rng(1249);
  const fans: Fan[] = [];
  for (let row = 0; row < 2; row++)
    for (let x = r.int(0, 6); x < CROWD_W; x += r.int(8, 13))
      fans.push({ x, y: 208 + row * 8 + r.int(-1, 1), kind: r.int(0, 4), ph: r.range(0, 6.28), hype: r.range(0.5, 1), hair: r.int(0, 3) });
  return fans.sort((a, b) => a.y - b.y);
}

/** The uppercut finish: off the front of the stage and down onto the pyro trench. */
function trench(bones: PartSet): [HTMLCanvasElement, HTMLCanvasElement] {
  const p = new Painter(W, H);
  const r = rng(1277);
  p.gradRect(0, 0, W, H, '#140818', '#050208', 8);
  // the stage lip seen from below, with its hazard stripe and a monitor hanging over the edge
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < 8; y++) p.set(x, y, '#1a181e');
    p.set(x, 8, '#c0c0c8');
    for (let y = 9; y < 14; y++) p.set(x, y, (x + y) % 10 < 5 ? '#e0b020' : '#141414');
  }
  p.poly([[150, 0], [196, 0], [192, 14], [154, 14]], '#16161a');
  // the stage front wall: black drape with folds, gaffer-taped cable bundles
  for (let y = 14; y < 170; y++)
    for (let x = 0; x < W; x++) {
      const fold = Math.sin(x * 0.4) > 0.6;
      p.set(x, y, fold ? '#141018' : bayer(x, y) < 0.15 ? '#100c14' : '#0a080e');
    }
  for (const [cx, sag] of [[40, 50], [118, 70], [210, 44]]) {
    for (let x = cx - 30; x < cx + 30; x++) {
      const y = 16 + Math.round(sag * (1 - ((x - cx) / 30) ** 2));
      p.rect(x, y, 1, 2, '#050508');
    }
    p.rect(cx - 1, 16, 3, 4, '#d8d8d0');
  }
  // a crumpled set list stuck to the wall (lines only, no words)
  p.rect(30, 96, 18, 24, '#e8e4d8');
  for (let k = 0; k < 7; k++) p.rect(33, 99 + k * 3, r.int(8, 13), 1, '#3a3a44');
  // coloured light leaking over the lip in dusty shafts
  for (const [sx, c] of [[60, '#ff2a6a'], [190, '#20d0ff']] as [number, string][]) {
    for (let y = 14; y < 170; y++) {
      const half = 10 + (y - 14) * 0.18;
      for (let x = Math.floor(sx - half); x < sx + half; x++) {
        const edge = 1 - Math.abs(x - sx) / half;
        if (bayer(x, y) < edge * 0.3 * (1 - y / 220)) p.set(x, y, mix(p.get(x, y), c, 0.4));
      }
    }
  }
  const bg = p.canvas();
  // a previous challenger, scorched black, slumped against the stage wall
  const [tmp, tctx] = makeCanvas(W, H);
  tctx.imageSmoothingEnabled = false;
  tctx.translate(206, 168);
  tctx.scale(-1, 1);
  drawRig(tctx, bones, fk(P(LIE, { rot: -40, af: -140, ab: 30, lf: -30, kf: 60, h: 14 })));
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalCompositeOperation = 'source-atop';
  tctx.fillStyle = 'rgba(24,14,10,0.85)';
  tctx.fillRect(0, 0, W, H);
  const bctx = bg.getContext('2d')!;
  bctx.drawImage(tmp, 0, 0);
  // the trench front, drawn over the victim: mortar tubes, glowing rim and steel box
  const f = new Painter(W, H);
  for (let x = 0; x < W; x++)
    for (let y = 160; y < 166; y++) f.set(x, y, y === 160 ? '#ffd060' : bayer(x, y) < 0.4 ? '#ff7020' : '#a02a10');
  for (let i = 0; i < 8; i++) {
    const tx = 16 + i * 32;
    for (let y = 144; y < 166; y++)
      for (let x = tx - 5; x <= tx + 5; x++) {
        const t = (x - tx) / 5;
        f.set(x, y, t < -0.5 ? '#6a6a74' : t > 0.5 ? '#202026' : '#3a3a44');
      }
    f.ellipse(tx, 144, 5, 1.5, '#ff9030');
    f.ellipse(tx, 144, 3, 1, '#fff0a0');
  }
  for (let y = 166; y < H; y++)
    for (let x = 0; x < W; x++) f.set(x, y, x % 48 < 2 ? '#2a2a32' : bayer(x, y) < 0.2 ? '#4a4a54' : '#3a3a44');
  f.rect(0, 166, W, 2, '#8a8a94');
  for (let x = 0; x < W; x++) for (let y = 196; y < 204; y++) f.set(x, y, (x + y) % 12 < 6 ? '#e0b020' : '#141414');
  for (let x = 6; x < W; x += 16) f.set(x, 172, '#a0a0aa');
  const fc = f.canvas();
  drawText(fc.getContext('2d')!, 'DANGER PYRO', W / 2, 182, '#ff4020', { align: 'center', outline: '#141414' });
  return [bg, fc];
}

/** Draw a band member: feet at (x, y), facing right; `look` picks the person, `a` animates them. */
function rocker(ctx: CanvasRenderingContext2D, x: number, y: number, look: 'guitar' | 'singer' | 'bass' | 'drums', a: number, lit: string) {
  const R = (c: string, rx: number, ry: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + rx), Math.round(y + ry), w, h);
  };
  const beat = (a % BEAT) / BEAT;
  const hit = (1 - beat) ** 2;
  const skin = look === 'bass' ? '#8a5a3a' : look === 'drums' ? '#c08860' : '#e0b090';
  const top = look === 'singer' ? '#a01818' : look === 'bass' ? '#1a2a4a' : '#1a1a1e';
  if (look !== 'drums') {
    // wide rock stance, boots
    R('#16141c', -5, -14, 3, 13);
    R('#16141c', 2, -14, 3, 13);
    R('#000000', -6, -2, 4, 2);
    R('#000000', 2, -2, 4, 2);
  }
  const bob = Math.round(hit * (look === 'guitar' ? 3 : 1));
  const ty = look === 'drums' ? -6 : 0;
  R(top, -4, -26 + ty, 9, 13);
  R(css(lighten(top, 0.2)), -4, -26 + ty, 1, 13);
  // head and hair
  const hx = look === 'guitar' ? bob : 0, hy = -33 + ty + bob;
  R(skin, -2 + hx, hy, 6, 6);
  if (look === 'guitar') {
    // long hair flung down on the headbang
    R('#2a1408', -3 + hx, hy - 1, 8, 2);
    R('#2a1408', 3 + hx, hy, 3, 9 + bob);
    R('#2a1408', -3 + hx, hy, 2, 8);
  } else if (look === 'singer') {
    R('#30e040', 0, hy - 4, 2, 4); // mohawk
    R('#20a030', 0, hy - 1, 2, 1);
  } else if (look === 'bass') {
    R('#101010', -2, hy + 2, 6, 1); // shades
  } else {
    R('#e8e0d0', -3, hy - 1, 8, 2); // bandana
  }
  if (look === 'guitar' || look === 'bass') {
    // body slung low, neck up and out, strumming hand on the beat
    const body = look === 'guitar' ? '#f0f0f4' : '#c01828';
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(Math.round(x - 3), Math.round(y - 13));
    ctx.lineTo(Math.round(x + 6), Math.round(y - 19));
    ctx.lineTo(Math.round(x + 7), Math.round(y - 13));
    ctx.lineTo(Math.round(x + 1), Math.round(y - 9));
    ctx.fill();
    for (let k = 0; k < 14; k++) R('#5a3a20', 6 + k, -19 - Math.round(k * 0.5), 1, 1);
    R('#1a1a1e', 19, -27, 3, 2);
    R(skin, 13, -24, 2, 2); // fretting hand
    R(skin, 0, -18 + Math.round(hit * 3), 2, 2); // picking hand
    R(top, -1, -24, 2, 6);
  } else if (look === 'singer') {
    // mic stand, one fist thrown up on the downbeat
    R('#8a8a92', 7, -22, 1, 22);
    R('#3a3a40', 6, -24, 3, 3);
    R(skin, 5, -24, 2, 2);
    const up = Math.floor(a / BEAT) % 4 === 0 ? 1 - beat : 0;
    R(top, -6, -26 - Math.round(up * 6), 2, 7);
    R(skin, -6, -29 - Math.round(up * 6), 3, 3);
  } else {
    // drummer: sticks windmilling between the toms and the cymbals
    const l = Math.sin(a * (Math.PI * 2 / BEAT)), rr = Math.sin(a * (Math.PI * 2 / BEAT) + Math.PI);
    R(skin, -8, -26 + Math.round(l * 4), 3, 3);
    R(skin, 6, -26 + Math.round(rr * 4), 3, 3);
    R('#e8d8b0', -10, -31 + Math.round(l * 6), 1, 6);
    R('#e8d8b0', 9, -31 + Math.round(rr * 6), 1, 6);
  }
  // a rim of stage light on their back edge
  R(lit, -5, -26 + ty, 1, 12);
}

export class ConcertStage {
  name = 'THE DECIBEL DOME';
  blurb = 'LIVE TONIGHT: THE CHROME HOWLERS';
  song: SongName = 'concert';
  far = far();
  mid = mid();
  deck = deck();
  fans = crowd();
  pit: HTMLCanvasElement;
  pitFront: HTMLCanvasElement;
  jets: Jet[] = [];
  /** Frame the spark waterfall and confetti started, or -1. */
  rainT = -1;
  lastT = -1;
  phase = '';

  constructor(bones: PartSet) {
    [this.pit, this.pitFront] = trench(bones);
  }

  reset() {
    this.jets = [];
    this.rainT = -1;
    this.phase = '';
  }

  volley(t: number, big: boolean) {
    for (const x of CANNONS) this.jets.push({ x, t0: t + (big ? 0 : Math.abs(x - STAGE_W / 2) / 16), big });
  }

  /** Pyro and crowd noise on the fight's big moments. */
  update(f: Fight) {
    if (f.phase !== this.phase) {
      if (f.phase === 'fight' && this.phase === 'intro') {
        this.volley(f.t, false);
        sfx.fire();
      }
      if (f.phase === 'ko') {
        this.volley(f.t, true);
        this.rainT = f.t;
        sfx.fire();
        sfx.cannon();
        noise({ dur: 2.4, vol: 0.18, type: 'bandpass', freq: 900, q: 0.5, attack: 0.25 });
      }
      this.phase = f.phase;
    }
    if (f.phase === 'fight' && f.t % VOLLEY === 0) sfx.fire();
  }

  /** Light colour for the current bar. */
  gel(t: number) {
    return GELS[Math.floor(t / BAR) % GELS.length];
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    if (t !== this.lastT) {
      this.lastT = t;
      if (t % VOLLEY === 0) this.volley(t, false);
      this.jets = this.jets.filter((j) => t - j.t0 < 50);
    }
    ctx.drawImage(this.far, -Math.round(camX * 0.3), 0);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    const mx = -Math.round(camX * 0.65);
    ctx.drawImage(this.mid[0], mx, 0);
    const gel = this.gel(t);
    rocker(ctx, mx + MC, 138, 'drums', t, gel);
    ctx.drawImage(this.mid[1], mx, 0);
    rocker(ctx, mx + MC - 104, BACK, 'guitar', t, gel);
    rocker(ctx, mx + MC - 40, BACK, 'singer', t + 6, gel);
    rocker(ctx, mx + MC + 86, BACK, 'bass', t + 12, gel);
    this.drawPyro(ctx, dx, t);
    this.drawRig(ctx, -Math.round(camX * 0.85), t, gel);
  }

  /** Flame columns roaring up off the cannons, with a glow on the floor. */
  drawPyro(ctx: CanvasRenderingContext2D, dx: number, t: number) {
    for (const j of this.jets) {
      const age = t - j.t0;
      if (age < 0) continue;
      const x = j.x + dx;
      if (x < -30 || x > W + 30) continue;
      const k = age < 6 ? age / 6 : Math.max(0, 1 - (age - 6) / 30);
      const hgt = Math.round((j.big ? 110 : 80) * k);
      if (hgt <= 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,120,30,${0.25 * k})`;
      ctx.beginPath();
      ctx.ellipse(x, FLOOR - 2, 40, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      for (let y = 0; y < hgt; y += 2) {
        const u = y / hgt;
        const w = Math.round((3 + u * 9 + Math.sin(y * 0.5 + age * 0.9) * 2) * (j.big ? 1.3 : 1));
        const wob = Math.round(Math.sin(y * 0.15 + age * 0.4) * u * 4);
        const c = u < 0.25 ? '#fff8d0' : u < 0.5 ? '#ffd040' : u < 0.8 ? '#ff7a10' : '#c02a08';
        ctx.fillStyle = c;
        ctx.fillRect(x - (w >> 1) + wob, FLOOR - 8 - y, w, 2);
        if (u > 0.4) {
          ctx.fillStyle = '#ffe070';
          ctx.fillRect(x - 1 + wob, FLOOR - 8 - y, 2, 2);
        }
      }
      // smoke curling off the top as it dies away
      if (age > 20) {
        ctx.fillStyle = `rgba(60,50,56,${0.5 * (1 - (age - 20) / 30)})`;
        const sy = FLOOR - 8 - hgt - (age - 20);
        ctx.fillRect(x - 8, sy - 4, 16, 6);
        ctx.fillRect(x - 5, sy - 8, 10, 4);
      }
    }
  }

  /** The lighting truss: moving heads sweeping coloured beams, PAR cans flashing on the beat. */
  drawRig(ctx: CanvasRenderingContext2D, ox: number, t: number, gel: string) {
    const beat = (t % BEAT) / BEAT;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < HEADS.length; i++) {
      const hx = HEADS[i] + ox;
      if (hx < -100 || hx > W + 100) continue;
      const c = i % 2 ? gel : GELS[(Math.floor(t / BAR) + 2) % GELS.length];
      const sweep = Math.sin(t * 0.02 + i * 1.3) * (i % 2 ? 70 : -70);
      const fx = hx + sweep, spread = 22;
      const g = ctx.createLinearGradient(0, 16, 0, FLOOR);
      g.addColorStop(0, css(c, 0.32));
      g.addColorStop(1, css(c, 0.06));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx - 2, 18);
      ctx.lineTo(hx + 2, 18);
      ctx.lineTo(fx + spread, FLOOR);
      ctx.lineTo(fx - spread, FLOOR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = css(c, 0.22);
      ctx.beginPath();
      ctx.ellipse(fx, FLOOR - 1, spread, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // the truss: two chords and zigzag lattice
    for (const y of [4, 12]) {
      ctx.fillStyle = '#8a8a96';
      ctx.fillRect(0, y, W, 1);
    }
    ctx.fillStyle = '#5a5a66';
    for (let x = ((ox % 8) + 8) % 8 - 8; x < W; x += 8)
      for (let k = 0; k < 8; k++) ctx.fillRect(x + k, 5 + Math.round(k * 0.875), 1, 1);
    // moving-head fixtures and PAR cans
    for (let i = 0; i < HEADS.length; i++) {
      const hx = Math.round(HEADS[i] + ox);
      if (hx < -10 || hx > W + 10) continue;
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(hx - 3, 13, 6, 3);
      ctx.fillStyle = '#16161c';
      ctx.fillRect(hx - 2, 16, 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx, 18, 1, 1);
      const px = hx + 31;
      if (px > W + 4) continue;
      const on = (Math.floor(t / BEAT) + i) % 2 === 0;
      ctx.fillStyle = '#1a1a20';
      ctx.fillRect(px - 2, 13, 5, 4);
      ctx.fillStyle = on ? css(lighten(gel, 0.5)) : '#3a3a44';
      ctx.fillRect(px - 1, 16, 3, 1);
      if (on && beat < 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = css(gel, 0.3 * (1 - beat * 2));
        ctx.fillRect(px - 5, 17, 11, 3);
        ctx.restore();
      }
    }
  }

  /** The crowd at the barrier, a haze of smoke, and the big-finish spark waterfall and confetti. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    // stage haze drifting through the beams
    for (let i = 0; i < 5; i++) {
      const x = ((i * 157 + t * 0.15 - camX * 0.9) % (W + 180) + W + 180) % (W + 180) - 90;
      const y = 70 + (i % 3) * 26 + Math.sin(t * 0.012 + i) * 5;
      ctx.fillStyle = 'rgba(190,170,210,0.05)';
      ctx.fillRect(Math.round(x), Math.round(y), 100, 6);
      ctx.fillRect(Math.round(x) + 16, Math.round(y) - 3, 60, 3);
    }
    if (this.rainT >= 0 && t - this.rainT < 260) this.drawRain(ctx, camX, t - this.rainT);
    const gel = this.gel(t);
    const rim = css(lighten(gel, 0.2), 0.9);
    const beat = (t % BEAT) / BEAT;
    const ox = -Math.round(camX * 1.2);
    for (const f of this.fans) {
      const x = f.x + ox;
      if (x < -10 || x > W + 10) continue;
      const jump = Math.round((1 - beat) ** 2 * 3 * f.hype * (f.y < 212 ? 1 : 0.6));
      const hy = f.y - jump;
      ctx.fillStyle = SIL;
      ctx.fillRect(x - 6, hy + 5, 13, H - hy);
      ctx.fillRect(x - 3, hy - 1, 7, 7);
      if (f.hair === 1) ctx.fillRect(x - 4, hy, 9, 9); // big hair
      if (f.hair === 2) ctx.fillRect(x, hy - 4, 1, 4); // spikes
      ctx.fillStyle = rim;
      ctx.fillRect(x - 2, hy - 1, 5, 1);
      if (f.kind === 4) continue;
      // one arm up: pumping fist, horns, or a lighter held high
      const side = f.ph > 3 ? 1 : -1;
      const pump = f.kind === 0 ? Math.round((1 - beat) * 4) : Math.round(Math.sin(t * 0.03 + f.ph) * 1.5);
      const ax = x + side * 6, ay = hy - 7 - pump;
      ctx.fillStyle = SIL;
      ctx.fillRect(ax, ay + 3, 2, hy + 8 - ay - 3);
      ctx.fillRect(ax - 1, ay, 3, 3);
      ctx.fillStyle = rim;
      ctx.fillRect(ax - 1, ay, 3, 1);
      if (f.kind === 1) {
        ctx.fillStyle = SIL;
        ctx.fillRect(ax - 1, ay - 2, 1, 2);
        ctx.fillRect(ax + 1, ay - 2, 1, 2);
      } else if (f.kind === 2) {
        const fl = Math.sin(t * 0.4 + f.ph) > 0 ? '#ffe070' : '#ffb030';
        ctx.fillStyle = fl;
        ctx.fillRect(ax, ay - 3, 1, 2);
        ctx.fillStyle = 'rgba(255,190,80,0.18)';
        ctx.fillRect(ax - 3, ay - 6, 7, 7);
      }
    }
  }

  /** Sparks pouring off the truss and confetti drifting down, for a few seconds after a KO. */
  drawRain(ctx: CanvasRenderingContext2D, camX: number, age: number) {
    const fade = age < 200 ? 1 : 1 - (age - 200) / 60;
    const ox = -camX * 0.85;
    for (let x = ((Math.round(ox) % 5) + 5) % 5; x < W; x += 5) {
      for (let k = 0; k < 4; k++) {
        const y = 19 + ((age * 2.6 + k * 47 + x * 13) % 150);
        if (y > 19 + age * 3) continue;
        ctx.fillStyle = (x + k) % 3 ? `rgba(255,240,180,${fade})` : `rgba(255,190,80,${fade})`;
        ctx.fillRect(x, Math.round(y), 1, 2);
      }
    }
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 53 + Math.sin(age * 0.05 + i) * 8 - camX) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = (age * (0.5 + (i % 5) * 0.12) + i * 29) % 220 - 20;
      if (y < 20 && age < 40) continue;
      ctx.fillStyle = GELS[i % GELS.length];
      ctx.globalAlpha = fade;
      ctx.fillRect(Math.round(sx), Math.round(y), (i + Math.floor(age / 6)) % 2 ? 2 : 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  /** Flame jets keep firing out of the trench while the loser cooks. */
  pitTick(p: Particles, it: number) {
    const k = Math.max(0, 1 - it / 140);
    for (let i = 0; i < 8; i++) {
      if (Math.random() > 0.5 * k + 0.08) continue;
      const tx = 16 + i * 32;
      const life = rand(18, 34);
      p.add({ kind: 'fire', x: tx + rand(-2, 2), y: H - 146, vx: rand(-0.3, 0.3), vy: rand(2.2, 4) * (0.4 + k), life, max: life, color: '#ffb030', size: rand(2, 4), grav: 0.02, floor: false });
    }
  }
}
