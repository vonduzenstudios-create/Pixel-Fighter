import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rand, rng, Rng } from '../../core/rng';
import { sfx } from '../../audio/sfx';
import { Painter, pxLine } from '../../gfx/painter';
import { bayer, Color, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "The Coil Works": a gaslit inventor's laboratory in an old brick mill. Two giant resonance coils
// tower over the floor and throw live arcs at the rafters, the grounding strikers and anyone who
// jumps too close. Every layer is painted procedurally at load time; the electricity is drawn live.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.25);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.55);
/** The two big coils on the floor: x of the column, and the toroid's centre height. */
const COILS = [{ x: 46, top: 50 }, { x: 466, top: 50 }];
const TOR_RX = 22, TOR_RY = 7;
/** A body lying flat draws about a hip-height above its ground line; this settles it onto the vault's plate. */
const SETTLE = 18;
/** Grounding strikers: brass balls on poles that the coils keep hitting. */
const STRIKERS = [{ x: 124, y: 104 }, { x: 388, y: 104 }];
/** Arched windows on the back wall that light up when the storm outside flashes. */
const WINDOWS = [40, 128, 216];
const JACOBS = [{ x: 70 }, { x: 330 }];
const GLOBES = [{ x: 190 }, { x: 446 }];
const WHEEL = { x: 200, y: 92, r: 30 };
/** Smaller coils up on the mezzanine, so there is lightning in view wherever the camera is. */
const FAR_COILS = [{ x: 108, top: 46 }, { x: 288, top: 52 }];

interface Strike { x0: number; y0: number; x1: number; y1: number; life: number; seed: number; big: boolean }

/** Draw a jagged electric arc with a soft glow and a hot core, plus a few forks. */
function bolt(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, r: Rng, rough = 0.3, forks = 2, bright = 1) {
  let pts: [number, number][] = [[x0, y0], [x1, y1]];
  let amp = Math.hypot(x1 - x0, y1 - y0) * rough;
  for (let d = 0; d < 5; d++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const off = r.range(-amp, amp);
      next.push([(ax + bx) / 2 + (-(by - ay) / len) * off, (ay + by) / 2 + ((bx - ax) / len) * off], pts[i]);
    }
    pts = next;
    amp *= 0.5;
  }
  const paths: [number, number][][] = [pts];
  for (let k = 0; k < forks; k++) {
    const i = r.int(4, pts.length - 4), [fx, fy] = pts[i];
    const a = Math.atan2(y1 - y0, x1 - x0) + r.range(-1.3, 1.3), l = r.range(8, 24);
    const fork: [number, number][] = [[fx, fy]];
    for (let s = 1; s <= 4; s++) fork.push([fx + Math.cos(a) * l * (s / 4) + r.range(-3, 3), fy + Math.sin(a) * l * (s / 4) + r.range(-3, 3)]);
    paths.push(fork);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, col] of [[3, `rgba(90,140,255,${0.35 * bright})`], [1, `rgba(220,235,255,${bright})`]] as [number, string][]) {
    ctx.fillStyle = col;
    for (const path of paths)
      for (let i = 1; i < path.length; i++) pxLine(ctx, path[i - 1][0] - (w >> 1), path[i - 1][1] - (w >> 1), path[i][0] - (w >> 1), path[i][1] - (w >> 1), w);
  }
  ctx.restore();
}

/** A soft additive glow disc. */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number, rgba: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  ctx.restore();
}

/** Running-bond brickwork with dark mortar and dithered soot. */
function bricks(p: Painter, x0: number, y0: number, w: number, h: number, base: Color) {
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 5), off = row % 2 ? 5 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const mortar = (y - y0) % 5 === 4 || (x - x0 + off) % 10 === 9;
      const tint = ((row * 7 + Math.floor((x - x0 + off) / 10) * 11) % 5) * 0.04;
      let c: Color = mortar ? darken(base, 0.5) : darken(base, tint);
      if (!mortar && bayer(x, y) < 0.08) c = lighten(c, 0.07);
      p.set(x, y, c);
    }
  }
}

/** The mill's back wall: brick, iron pillars, tall arched windows onto a stormy night. */
function backWall(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1201);
  bricks(p, 0, 0, W, H, '#3a2a26');
  for (const wx of WINDOWS) {
    // arched window: night sky with roiling clouds, a lead-mullioned frame
    for (let y = 20; y < 120; y++)
      for (let x = wx - 22; x <= wx + 22; x++) {
        const dx = (x - wx) / 22, dy = y < 42 ? (42 - y) / 22 : 0;
        const d = dx * dx + dy * dy;
        if (d > 1.25) continue;
        if (d > 1) { p.set(x, y, (x + y) % 2 ? '#5a463a' : '#4a3a30'); continue; }
        const cloud = Math.sin(x * 0.21 + y * 0.07) + Math.sin(x * 0.05 - y * 0.18) + Math.sin(y * 0.33);
        let c: Color = mix('#141a30', '#0a0c18', (y - 20) / 100);
        if (cloud > 1.1) c = mix(c, '#2a3048', 0.6);
        else if (cloud > 0.6 && bayer(x, y) < 0.5) c = mix(c, '#222840', 0.6);
        p.set(x, y, c);
      }
    // rain streaks
    for (let i = 0; i < 26; i++) {
      const rx = wx + r.int(-20, 20), ry = r.int(30, 112);
      p.set(rx, ry, '#3a4466');
      p.set(rx - 1, ry + 1, '#2a3250');
    }
    // mullions
    for (let y = 22; y < 120; y++) p.set(wx, y, '#1a1414');
    for (const yy of [52, 84]) p.rect(wx - 21, yy, 43, 1, '#1a1414');
    p.rect(wx - 25, 120, 51, 3, '#6a5a4a');
    p.rect(wx - 25, 123, 51, 1, '#2a2018');
  }
  // cast-iron pillars between the windows
  for (const px of [0, 84, 172, 254]) {
    p.rect(px - 4, 0, 8, H, '#2a2c32');
    p.rect(px - 4, 0, 2, H, '#4a4e58');
    p.rect(px + 3, 0, 1, H, '#141518');
    for (let y = 8; y < H; y += 24) p.rect(px - 5, y, 10, 2, '#3a3c44');
  }
  // roof trusses
  p.rect(0, 0, W, 8, '#1e1612');
  for (let x = 0; x < W; x++) p.set(x, 8 + Math.round(Math.abs(((x % 64) - 32) / 32) * 8), '#2e2218');
  p.shade(0.08);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < 0.45) p.set(x, y, mix(p.get(x, y), '#06060c', 0.5));
  return p.canvas();
}

/** Far layer: an iron mezzanine lined with glowing jars and a great dynamo flywheel. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1213);
  // the mezzanine floor and railing
  p.rect(0, 128, FAR_W, 5, '#2a2a30');
  p.rect(0, 128, FAR_W, 1, '#4a4a54');
  for (let x = 0; x < FAR_W; x += 6) p.rect(x, 112, 1, 16, '#34343c');
  p.rect(0, 112, FAR_W, 2, '#44444c');
  for (let x = 0; x < FAR_W; x += 40) p.rect(x, 133, 3, H - 133, '#1e1e24');
  // shelves of storage jars along the mezzanine
  for (let x = 6; x < FAR_W; x += 9) {
    if (Math.abs(x - WHEEL.x) < WHEEL.r + 12) continue;
    const h = r.int(8, 13), c = r.pick(['#3a6a5a', '#4a5a7a', '#6a5a3a', '#3a5a4a']);
    p.rect(x, 128 - h, 6, h, darken(c, 0.35));
    p.rect(x + 1, 128 - h + 3, 4, h - 4, c);
    p.rect(x + 1, 128 - h - 1, 4, 2, '#8a7a5a'); // brass caps
    p.set(x + 1, 128 - h + 4, lighten(c, 0.5));
  }
  // the dynamo housing (its spokes are drawn live so the wheel can spin)
  p.ellipse(WHEEL.x, WHEEL.y, WHEEL.r + 2, WHEEL.r + 2, '#1a1a1e');
  p.ellipse(WHEEL.x, WHEEL.y, WHEEL.r, WHEEL.r, '#2a2e36');
  p.ellipse(WHEEL.x, WHEEL.y, WHEEL.r - 4, WHEEL.r - 4, '#121418');
  p.rect(WHEEL.x - 26, 110, 52, 18, '#3a3026');
  p.rect(WHEEL.x - 26, 110, 52, 2, '#5a4a36');
  p.rect(WHEEL.x + 30, 100, 18, 28, '#4a3020'); // field magnet, wrapped in copper
  for (let y = 102; y < 126; y += 2) p.rect(WHEEL.x + 31, y, 16, 1, '#b06a30');
  // two mezzanine coils on iron stands
  for (const c of FAR_COILS) {
    p.rect(c.x - 9, 120, 19, 8, '#3a2618');
    p.rect(c.x - 9, 120, 19, 1, '#5a3a24');
    for (let y = c.top + 5; y < 120; y++)
      for (let x = c.x - 4; x <= c.x + 4; x++) p.set(x, y, x < c.x - 1 ? '#8a5a30' : x > c.x + 2 ? '#4a2e18' : y % 2 ? '#7a4a24' : '#6a3e1e');
    p.ellipse(c.x + 0.5, c.top, 12, 4, '#5a6270');
    p.ellipse(c.x + 0.5, c.top - 1, 10, 2, '#8a94a4');
  }
  // drive belt down to the floor
  p.line(WHEEL.x - 4, WHEEL.y + WHEEL.r, WHEEL.x - 14, H, '#1a1410');
  p.line(WHEEL.x + 4, WHEEL.y + WHEEL.r, WHEEL.x + 14, H, '#1a1410');
  // the lower floor behind the workbenches, in gloom
  for (let y = 133; y < H; y++) for (let x = 0; x < FAR_W; x++) if (bayer(x, y) < 0.7) p.set(x, y, '#0c0c12');
  // hanging pendant lamps, dimmed by the storm
  for (let x = 24; x < FAR_W; x += 88) {
    p.line(x, 0, x, 60, '#18181c');
    p.poly([[x - 5, 66], [x, 60], [x + 5, 66]], '#2e3a2e');
    p.set(x, 66, '#e0c080');
  }
  return p.canvas();
}

/** Mid layer: workbenches crowded with tubes, dials, cables and glassware. */
function mid(): HTMLCanvasElement {
  const p = new Painter(MID_W, H);
  const r = rng(1229);
  for (let x = 0; x < MID_W; x++) {
    // bench tops
    p.set(x, 150, '#7a5434');
    p.set(x, 151, '#5a3a24');
    for (let y = 152; y < 156; y++) p.set(x, y, '#3a2618');
    for (let y = 156; y < H; y++) p.set(x, y, bayer(x, y) < 0.4 ? '#141012' : '#0c0a0c');
    if (x % 48 < 3) for (let y = 156; y < 186; y++) p.set(x, y, '#2a1c14'); // bench legs
  }
  for (let x = 4; x < MID_W - 20; x += r.int(14, 22)) {
    const busy = (cx: number) => [...JACOBS, ...GLOBES].some((o) => Math.abs(o.x - cx) < 16);
    if (busy(x)) continue;
    const k = r.int(0, 4);
    if (k === 0) {
      // an instrument cabinet with two dials
      p.rect(x, 130, 14, 20, '#2a2a30');
      p.rect(x, 130, 14, 1, '#4a4a54');
      for (const dx of [4, 10]) {
        p.ellipse(x + dx, 137, 2.5, 2.5, '#d8d0b0');
        p.set(x + dx, 137, '#1a1a1a');
        p.set(x + dx + 1, 136, '#a01010');
      }
      p.rect(x + 3, 143, 8, 3, '#1a1a1e');
      p.set(x + 4, 144, '#40ff60');
    } else if (k === 1) {
      // vacuum tubes in a rack (their filaments glow live)
      p.rect(x, 144, 16, 6, '#3a3a40');
      for (let i = 0; i < 3; i++) {
        p.ellipse(x + 3 + i * 5, 138, 2, 5, '#3a4048');
        p.rect(x + 2 + i * 5, 142, 3, 2, '#6a6a6a');
      }
    } else if (k === 2) {
      // flasks and a retort with coloured fluids
      const c = r.pick(['#40c070', '#c04080', '#4080e0', '#e0a020']);
      p.ellipse(x + 5, 145, 4, 4, '#8aa0a8');
      p.ellipse(x + 5, 146, 3, 2.5, c);
      p.rect(x + 4, 136, 2, 6, '#8aa0a8');
      p.rect(x + 10, 140, 3, 10, '#8aa0a8');
      p.rect(x + 10, 145, 3, 5, c);
    } else if (k === 3) {
      // coiled cable spilling off the bench
      for (let i = 0; i < 4; i++) p.ellipse(x + 7, 147 - i, 7 - i, 2, i % 2 ? '#1a1a1a' : '#2a2420');
      for (let y = 152; y < 176; y++) p.set(x + 12 + Math.round(Math.sin(y * 0.3) * 2), y, '#201a18');
    } else {
      // a stack of notebooks and a brass microscope
      for (let i = 0; i < 3; i++) p.rect(x + i, 146 - i * 2, 10, 2, r.pick(['#6a2020', '#204a6a', '#3a5a2a']));
      p.rect(x + 12, 140, 2, 10, '#a08040');
      p.rect(x + 10, 148, 6, 2, '#806030');
    }
  }
  // Jacob's ladders: two copper horns in a frame
  for (const j of JACOBS) {
    p.rect(j.x - 8, 146, 17, 4, '#2a2a30');
    for (let y = 104; y < 146; y++) {
      const spread = Math.round(1 + (146 - y) * 0.16);
      p.set(j.x - spread, y, '#c07838');
      p.set(j.x + spread, y, '#c07838');
    }
  }
  // plasma globe bases
  for (const g of GLOBES) {
    p.rect(g.x - 6, 144, 13, 6, '#1a1a20');
    p.rect(g.x - 4, 142, 9, 2, '#3a3a44');
  }
  return p.canvas();
}

/** One giant resonance coil, painted onto the deck. */
function coil(p: Painter, cx: number, top: number) {
  const base = FLOOR - 12;
  // wooden platform with brass bolts
  p.rect(cx - 26, base, 53, 12, '#4a2e1a');
  p.rect(cx - 26, base, 53, 2, '#7a5030');
  p.rect(cx - 26, base + 10, 53, 2, '#2a1a10');
  for (const bx of [-22, 22]) p.set(cx + bx, base + 5, '#d8b060');
  // flat primary spiral of thick copper strap around the foot of the column
  for (let i = 0; i < 4; i++) {
    const rx = 22 - i * 3;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = cx + Math.cos(a) * rx, y = base - 4 + Math.sin(a) * 3;
      p.set(x, y, Math.sin(a) > 0 ? '#e09040' : '#8a5020');
    }
  }
  // the secondary: a tall column wound with fine copper wire
  const col0 = top + TOR_RY + 2, w = 8;
  for (let y = col0; y < base - 4; y++)
    for (let x = cx - w; x <= cx + w; x++) {
      const t = (x - cx) / w;
      let c: Color = y % 2 ? '#b8743a' : '#9a5c2a';
      if (t < -0.5) c = lighten(c, 0.25);
      else if (t > 0.45) c = darken(c, 0.4);
      if (Math.abs(t) < 0.12 && y % 2) c = '#f0b070';
      p.set(x, y, c);
    }
  p.rect(cx - w - 1, col0, w * 2 + 3, 2, '#2a2a30');
  p.rect(cx - w - 1, base - 6, w * 2 + 3, 3, '#2a2a30');
  // the polished toroid on top
  for (let y = top - TOR_RY - 1; y <= top + TOR_RY + 1; y++)
    for (let x = cx - TOR_RX - 1; x <= cx + TOR_RX + 1; x++) {
      const dx = (x + 0.5 - cx) / TOR_RX, dy = (y + 0.5 - top) / TOR_RY, d = dx * dx + dy * dy;
      if (d > 1) continue;
      const lit = dy < -0.3 ? 0.4 : dy < 0.2 ? 0.15 : -0.35;
      let c: Color = lit > 0 ? lighten('#8a94a4', lit) : darken('#8a94a4', -lit);
      if (Math.abs(dy + 0.45) < 0.12 && Math.abs(dx) < 0.7) c = '#f0f4ff';
      p.set(x, y, c);
    }
  p.rect(cx - 2, top - TOR_RY - 4, 5, 3, '#c0c8d4'); // breakout point
}

/** The lab floor: two coils, grounding strikers, cable runs and hazard-striped iron plate. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  const r = rng(1237);
  // grounding strikers on brass-ringed poles
  for (const s of STRIKERS) {
    p.rect(s.x - 1, s.y, 3, FLOOR - s.y, '#4a4a54');
    p.rect(s.x - 1, s.y, 1, FLOOR - s.y, '#8a8a96');
    for (let y = s.y + 14; y < FLOOR; y += 18) p.rect(s.x - 2, y, 5, 2, '#a08040');
    p.ellipse(s.x + 0.5, s.y, 4, 4, '#c8a050');
    p.ellipse(s.x - 0.5, s.y - 1.5, 1.6, 1.4, '#fff0c0');
    p.rect(s.x - 5, FLOOR - 3, 11, 3, '#2a2a30');
  }
  for (const c of COILS) coil(p, c.x, c.top);
  // heavy cables snaking from the coils to the strikers
  for (let i = 0; i < 2; i++) {
    const a = COILS[i].x + (i ? -27 : 27), b = STRIKERS[i].x;
    for (let x = Math.min(a, b); x <= Math.max(a, b); x++) {
      const t = (x - Math.min(a, b)) / Math.abs(b - a);
      p.set(x, FLOOR - 2 - Math.round(Math.sin(t * Math.PI) * 2), '#141214');
      p.set(x, FLOOR - 1 - Math.round(Math.sin(t * Math.PI) * 2), '#2a2626');
    }
  }
  // diamond-plate iron floor
  for (let x = 0; x < STAGE_W; x++) {
    for (let y = FLOOR; y < FLOOR + 12; y++) {
      let c: Color = y === FLOOR ? '#8a8e98' : y < FLOOR + 3 ? '#5a5e68' : '#41444c';
      if ((x + (y - FLOOR) * 2) % 8 === 0 || (x - (y - FLOOR) * 2 + 800) % 8 === 0) c = lighten(c, 0.12);
      if (bayer(x, y) < 0.1) c = darken(c, 0.15);
      p.set(x, y, c);
    }
    // copper bus bar inlaid in the floor
    p.set(x, FLOOR + 4, x % 24 < 2 ? '#3a2a1a' : '#b07038');
    // hazard stripes along the front edge
    for (let y = FLOOR + 12; y < FLOOR + 16; y++) p.set(x, y, ((x + y) >> 2) % 2 ? '#d8b020' : '#1a1a1a');
  }
  // scorch marks where the coils have struck the floor
  for (let i = 0; i < 16; i++) {
    const sx = r.int(0, STAGE_W), w = r.int(2, 8);
    for (let x = sx; x < sx + w; x++) if (bayer(x, FLOOR + 1) < 0.7) p.set(x, FLOOR + r.int(0, 2), '#24262c');
  }
  // the cable trench below, with conduit and the faint glow of the vault
  for (let y = FLOOR + 16; y < H; y++)
    for (let x = 0; x < STAGE_W; x++) {
      let c: Color = mix('#0c0e16', '#141c34', (y - FLOOR - 16) / 10);
      if (x % 6 === 0 || y % 4 === 0) c = '#08090c'; // grating
      p.set(x, y, c);
    }
  return p.canvas();
}

export class LabStage {
  name = 'THE COIL WORKS';
  blurb = 'TEN MILLION VOLTS. MIND YOUR HEAD';
  song: SongName = 'lab';
  pitLanding: PitLanding = {
    pose: P(LIE, {}),
    land: (f) => {
      sfx.zap(1.2);
      sfx.explode();
      f.pitParticles.zap(128, H - 146, 30);
    },
    tick: (f, it) => {
      if (it < 110) {
        if (it % 3 === 0) f.pitParticles.zap(128 + rand(-16, 16), H - 146 + rand(-6, 6), 2);
        if (it % 18 === 0) sfx.zap(0.3);
        if (it % 20 === 0) f.shake(3);
      } else if (it % 5 === 0) f.pitParticles.smoke(128 + rand(-14, 14), H - 146, 1, '#3a3a40');
    },
    draw: (ctx, it) => this.drawPitFx(ctx, it, 128, 150 + SETTLE),
    victim: (l, it) => {
      // convulsing on the plate, the skeleton flashing through, slowly charring black
      const j = it < 110 ? Math.sin(it * 1.7) * 14 : 0;
      l.poseOverride = P(LIE, { rot: -90 + j * 0.2, h: -5 + Math.abs(j) * 0.3, af: -120 + j * 2, ab: -40 - j * 2, ef: j, lf: -6 + j * 0.6, kf: 6 - j * 0.4, lb: 4 - j * 0.6, kb: 4 + j * 0.4 });
      l.computePose();
      l.showBones = it < 110 && Math.floor(it / 3) % 2 === 0;
      l.tint = ['#0a0a0c', Math.min(0.9, it / 100)];
      return SETTLE;
    },
  };
  wall = backWall();
  far = far();
  mid = mid();
  deck = deck();
  pit: HTMLCanvasElement;
  strikes: Strike[] = [];
  /** Frames left of the room-wide flash from a big discharge. */
  flash = 0;
  /** Storm flicker outside the windows. */
  storm = 0;
  cool = [90, 160];
  /** Counts down between fight updates; at 0 nothing is driving us (stage select). */
  live = 0;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
  }

  reset() {
    this.strikes = [];
    this.flash = 0;
    this.cool = [90, 160];
  }

  /** Down through the floor grating into the capacitor vault for the uppercut stage finish. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1249);
    p.gradRect(0, 0, W, H, '#10141e', '#04050a', 8);
    // brick vault walls
    bricks(p, 0, 0, 40, H, '#2a2228');
    bricks(p, W - 40, 0, 40, H, '#2a2228');
    // the grating of the lab floor above, coil-light leaking through
    p.rect(0, 0, W, 10, '#24262c');
    for (let x = 3; x < W; x += 6) p.rect(x, 2, 3, 6, '#6a78a8');
    // banks of glass capacitor jars down both sides
    for (const side of [0, 1]) {
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 3; i++) {
          const x = side ? W - 36 + i * 11 : 4 + i * 11, y = 50 + row * 46;
          p.rect(x, y + 30, 10, 2, '#4a3a2a');
          p.rect(x + 1, y + 6, 8, 24, '#3a4a5a');
          p.rect(x + 2, y + 16, 6, 14, '#a0a8b0'); // foil lining
          p.rect(x + 2, y + 6, 1, 24, '#6a8aa0');
          p.rect(x + 4, y, 2, 6, '#c8a050');
          p.ellipse(x + 5, y, 2, 2, '#d8b060');
        }
    }
    // two great spark-gap electrodes reaching in toward the middle (arcs are drawn live)
    for (const side of [-1, 1]) {
      const bx = 128 + side * 86;
      p.rect(Math.min(bx, 128 + side * 46), 98, 40, 4, '#5a5e68');
      p.rect(Math.min(bx, 128 + side * 46), 98, 40, 1, '#9aa0aa');
      p.ellipse(128 + side * 46, 100, 7, 7, '#c8a050');
      p.ellipse(128 + side * 46 - 2, 98, 2, 2, '#fff0c0');
    }
    // the discharge plate the victim lands on, on a transformer the size of a stove
    p.rect(88, 152, 80, 4, '#a0a8b4');
    p.rect(88, 152, 80, 1, '#e0e8f4');
    p.rect(96, 156, 64, 48, '#2a2c34');
    for (let y = 160; y < 200; y += 3) p.rect(98, y, 60, 1, '#3a3e48');
    for (let y = 162; y < 198; y += 2) { p.set(94, y, '#b07038'); p.set(161, y, '#b07038'); }
    p.rect(120, 176, 16, 8, '#1a1a1e');
    p.rect(122, 178, 3, 3, '#ff3020');
    // scattered fried remains of earlier visitors, and scorch rings on the floor
    for (let y = 204; y < H; y++) for (let x = 40; x < W - 40; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#1a1c24' : '#101218');
    for (let i = 0; i < 10; i++) {
      const sx = r.int(48, W - 56);
      p.ellipse(sx, 210 + r.int(0, 8), r.int(4, 9), 2, '#08080a');
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, rot, flip] of [[60, 214, -95, 1], [200, 216, -80, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip, 1);
      drawRig(ctx, bones, fk(P(LIE, { rot, af: -100, ab: 60, lf: -20, kf: 60, h: 20 })));
      ctx.restore();
    }
    return cv;
  }

  /** Arcs crackling in the vault during the shock finish, aimed at a body lying at (x, y). */
  drawPitFx(ctx: CanvasRenderingContext2D, it: number, x: number, y: number) {
    const live = it < 110;
    const r = rng(Math.floor(it / 2) * 7919 + 3);
    if (live) {
      for (const side of [-1, 1]) bolt(ctx, 128 + side * 46, 100, x + side * r.range(4, 16), y - r.range(4, 14), r, 0.35, 2);
      if (it % 6 < 3) bolt(ctx, x + r.range(-20, 20), 10, x + r.range(-8, 8), y - 10, r, 0.25, 1, 0.7);
      glow(ctx, x, y - 10, 70, `rgba(120,160,255,${0.25 + (it % 4) * 0.06})`);
      if (it % 8 < 2) {
        ctx.fillStyle = 'rgba(200,220,255,0.18)';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (it % 12 === 0 && it < 140) bolt(ctx, 128 - 46, 100, 128 + 46, 100, r, 0.2, 0, 0.5);
  }

  /** Track the fighters so the coils can lash out at anyone who jumps too close. */
  update(f: Fight) {
    this.live = 10;
    this.tickStrikes();
    if (f.phase === 'fatal') return;
    for (let i = 0; i < COILS.length; i++) {
      if (--this.cool[i] > 0) continue;
      const c = COILS[i];
      const ox = c.x, oy = c.top - TOR_RY;
      // the nearest fighter's head is a lightning rod
      let best: { x: number; y: number; d: number } | null = null;
      for (const ft of f.f) {
        if (ft.alpha <= 0) continue;
        const hb = ft.hurtbox();
        const hx = ft.x, hy = FLOOR - hb[3];
        const d = Math.hypot(hx - ox, hy - oy);
        if (d < 120 && (!best || d < best.d)) best = { x: hx, y: hy, d };
      }
      if (best && Math.random() < 0.5) {
        this.strikes.push({ x0: ox, y0: oy, x1: best.x, y1: best.y, life: 9, seed: Math.random() * 1e6, big: true });
        f.particles.zap(best.x, FLOOR - best.y, 6);
        sfx.zap(0.18);
      } else {
        const s = STRIKERS[i];
        this.strikes.push({ x0: ox, y0: oy, x1: s.x, y1: s.y - 3, life: 10, seed: Math.random() * 1e6, big: true });
        sfx.zap(0.12);
      }
      this.flash = 4;
      this.cool[i] = 110 + Math.floor(Math.random() * 160);
    }
  }

  tickStrikes() {
    for (const s of this.strikes) s.life--;
    this.strikes = this.strikes.filter((s) => s.life > 0);
    if (this.flash > 0) this.flash--;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.wall, 0, 0);
    // the storm outside: a double flicker every so often lights the windows
    const sp = t % 337;
    const storm = sp < 4 || (sp > 8 && sp < 11) ? 1 : sp < 20 ? 0.25 : 0;
    if (storm > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(140,160,220,${0.35 * storm})`;
      for (const wx of WINDOWS) {
        ctx.fillRect(wx - 21, 42, 43, 78);
        ctx.fillRect(wx - 15, 28, 31, 14);
        ctx.fillRect(wx - 8, 22, 17, 6);
      }
      ctx.restore();
      if (storm === 1) {
        const r = rng(Math.floor(t / 337) * 31 + 5), wx = WINDOWS[Math.floor(t / 337) % 3];
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx - 21, 24, 43, 96);
        ctx.clip();
        bolt(ctx, wx + r.range(-14, 14), 24, wx + r.range(-18, 18), 120, r, 0.25, 2, 0.8);
        ctx.restore();
      }
    }
    // far layer and the spinning dynamo flywheel
    const fx = -Math.round(camX * 0.25);
    ctx.drawImage(this.far, fx, 0);
    const a = t * 0.06;
    ctx.fillStyle = '#5a5e6a';
    for (let k = 0; k < 6; k++) {
      const ang = a + (k * Math.PI) / 3;
      pxLine(ctx, WHEEL.x + fx, WHEEL.y, WHEEL.x + fx + Math.cos(ang) * (WHEEL.r - 4), WHEEL.y + Math.sin(ang) * (WHEEL.r - 4), 2);
    }
    ctx.fillStyle = '#a08040';
    ctx.fillRect(WHEEL.x + fx - 3, WHEEL.y - 3, 6, 6);
    for (let i = 0; i < FAR_COILS.length; i++) {
      const c = FAR_COILS[i], x = c.x + fx;
      if (x < -40 || x > W + 40) continue;
      glow(ctx, x, c.top, 28, 'rgba(90,120,255,0.16)');
      const r = rng(Math.floor(t / 3) * 211 + i * 5);
      // every so often it arcs over to the railing
      if ((t + i * 61) % 150 < 6) bolt(ctx, x, c.top - 2, x + (i ? -1 : 1) * r.range(30, 46), 112, r, 0.3, 2, 0.7);
      for (let k = 0; k < 2; k++) {
        const ang = -Math.PI / 2 + r.range(-1.6, 1.6), len = r.range(8, 18);
        const sx = x + Math.cos(ang) * 9, sy = c.top + Math.sin(ang) * 3;
        bolt(ctx, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, r, 0.35, 0, 0.5);
      }
    }
    // mid layer: benches, Jacob's ladders, plasma globes and glowing tubes
    const mx = -Math.round(camX * 0.55);
    ctx.drawImage(this.mid, mx, 0);
    for (let i = 0; i < JACOBS.length; i++) {
      const j = JACOBS[i], x = j.x + mx;
      if (x < -20 || x > W + 20) continue;
      // the arc climbs the horns, widening, then snaps and starts again at the bottom
      const ph = ((t + i * 37) % 80) / 80, y = 144 - ph * 40;
      const spread = 1 + (146 - y) * 0.16;
      const r = rng(Math.floor(t / 2) * 13 + i);
      bolt(ctx, x - spread, y, x + spread, y - ph * 3, r, 0.35, 0, 0.9);
      glow(ctx, x, y, 14, 'rgba(140,170,255,0.35)');
    }
    for (let i = 0; i < GLOBES.length; i++) {
      const g = GLOBES[i], x = g.x + mx;
      if (x < -20 || x > W + 20) continue;
      ctx.fillStyle = 'rgba(40,20,70,0.85)';
      ctx.beginPath();
      ctx.arc(x + 0.5, 134, 9, 0, Math.PI * 2);
      ctx.fill();
      const r = rng(Math.floor(t / 3) * 17 + i);
      for (let k = 0; k < 4; k++) {
        const ang = r.range(0, Math.PI * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = k % 2 ? '#d070ff' : '#ff80e0';
        pxLine(ctx, x, 134, x + Math.cos(ang) * 8, 134 + Math.sin(ang) * 8, 1);
        ctx.restore();
      }
      ctx.fillStyle = '#ffe0ff';
      ctx.fillRect(x - 1, 133, 3, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 5, 128, 2, 2);
    }
    // vacuum tube filaments flicker faintly everywhere on the benches
    ctx.fillStyle = `rgba(255,150,60,${0.5 + Math.sin(t * 0.3) * 0.15})`;
    for (let x = ((mx % 29) + 29) % 29; x < W; x += 29) ctx.fillRect(x, 139, 1, 2);
    // the floor, coils and strikers
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // coils hum with constant corona streamers off the toroid
    for (let i = 0; i < COILS.length; i++) {
      const c = COILS[i], x = c.x + dx;
      if (x < -80 || x > W + 80) continue;
      glow(ctx, x, c.top, 50, 'rgba(90,120,255,0.22)');
      const r = rng(Math.floor(t / 2) * 101 + i * 7);
      for (let k = 0; k < 3; k++) {
        const ang = -Math.PI / 2 + r.range(-1.5, 1.5), len = r.range(14, 34);
        const sx = x + Math.cos(ang) * TOR_RX * 0.8, sy = c.top + Math.sin(ang) * TOR_RY;
        bolt(ctx, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, r, 0.35, 1, 0.7);
      }
    }
    // stage select has no fight to drive the big discharges, so fake them on a timer
    if (this.live > 0) this.live--;
    const strikes = this.live > 0 ? this.strikes : this.idleStrikes(t);
    for (const s of strikes) {
      const r = rng(Math.floor(s.seed) + s.life * 13);
      bolt(ctx, s.x0 + dx, s.y0, s.x1 + dx, s.y1, r, 0.28, 3, 1);
      glow(ctx, s.x1 + dx, s.y1, 24, 'rgba(160,190,255,0.5)');
    }
  }

  /** Big discharges on a fixed clock, for when no fight is running (stage select). */
  idleStrikes(t: number): Strike[] {
    const out: Strike[] = [];
    for (let i = 0; i < 2; i++) {
      const ph = (t + i * 97) % 190;
      if (ph < 9) out.push({ x0: COILS[i].x, y0: COILS[i].top - TOR_RY, x1: STRIKERS[i].x, y1: STRIKERS[i].y - 3, life: 9 - ph, seed: Math.floor((t + i * 97) / 190) * 977, big: true });
    }
    return out;
  }

  /** Ozone haze, sparks raining from the rafters, and the flash of a big discharge. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    for (let i = 0; i < 5; i++) {
      const x = ((i * 149 + t * 0.1 - camX * 1.1) % (W + 160) + W + 160) % (W + 160) - 80;
      const y = 70 + (i % 3) * 26 + Math.sin(t * 0.012 + i) * 4;
      ctx.fillStyle = 'rgba(150,170,220,0.05)';
      ctx.fillRect(Math.round(x), Math.round(y), 96, 5);
      ctx.fillRect(Math.round(x) + 16, Math.round(y) - 3, 52, 3);
    }
    // sparks drifting down from the coils' last discharge
    for (let i = 0; i < 14; i++) {
      const c = COILS[i % 2];
      const life = (t * 1.3 + i * 23) % 70;
      const x = c.x - camX + Math.sin(i * 2.1) * (8 + life * 0.6);
      const y = c.top + life * life * 0.03 + life * 0.4;
      if (x < 0 || x > W || y > FLOOR) continue;
      ctx.fillStyle = life < 30 ? '#e8f0ff' : '#7aa0ff';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const idle = this.live === 0 && this.idleStrikes(t).length > 0;
    if (this.flash > 0 || idle) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,150,255,${0.05 * (this.flash || 2)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
