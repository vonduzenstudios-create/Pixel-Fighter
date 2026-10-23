import { FLOOR, H, STAGE_W, W } from '../../core/consts';
import { rng } from '../../core/rng';
import { ac, noise, tone } from '../../audio/audio';
import { sfx } from '../../audio/sfx';
import { Painter } from '../../gfx/painter';
import { bayer, Color, css, darken, lighten, mix } from '../../gfx/palette';
import { drawRig, fk, PartSet } from '../../gfx/rig';
import { P, LIE } from '../../game/anims';
import type { SongName } from '../../audio/music';
import type { Fight } from '../../game/fight';
import type { PitLanding } from '../../game/stages';

// "The Runway": a fashion show at its peak. The fight happens on a raised, glossy catwalk with an
// LED-lit lip, the front row packed with VIPs, bleachers behind, a glowing entrance portal upstage
// and a press pit of photographers along the front edge. Moving-head lights sweep the stage,
// follow spots track the fighters and every big hit sets off a storm of camera flashes. The house
// look is an original diamond monogram; there are no real labels anywhere.

const FAR_W = W + Math.ceil((STAGE_W - W) * 0.3);
const MID_W = W + Math.ceil((STAGE_W - W) * 0.6);
const PRESS_W = W + Math.ceil((STAGE_W - W) * 1.25);
/** Top of the catwalk's glossy surface; fighters stand on FLOOR. */
const TOP = FLOOR - 3;
/** The lip of the catwalk with its LED chase strip. */
const LIP = FLOOR + 6;
const LIP_H = 10;
const PORTAL = { x: FAR_W >> 1, w: 56, top: 30, bot: 148 };
const SCREENS = [PORTAL.x - 92, PORTAL.x + 48];
const SCREEN_W = 44, SCREEN_Y = 44, SCREEN_H = 34;
/** Moving-head lights hung on the truss, in screen x. */
const HEADS = [28, 92, 164, 228];

const MAGENTA = '#ff3a9a', CYAN = '#3ae0ff', GOLD = '#ffd060', PEARL = '#ece6f4';
const BEAMS: [number, number, number][] = [[255, 70, 170], [70, 220, 255], [255, 220, 120], [180, 120, 255]];

interface Guest { x: number; y: number; h: number; w: number; outfit: string; skin: string; hat: number; shades: boolean; act: number; ph: number }
interface Shooter { x: number; h: number; tall: boolean; ph: number }
interface Pop { x: number; y: number; life: number; big: boolean }

/** A camera shutter: a mechanical clack and a tiny spring ring. */
function shutter(vol = 1) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const v = 0.92 + Math.random() * 0.16;
  noise({ dur: 0.018, vol: 0.12 * vol, type: 'highpass', freq: 4200 * v });
  noise({ dur: 0.02, vol: 0.09 * vol, type: 'bandpass', freq: 2400 * v, q: 4, at: t + 0.045 });
  tone({ type: 'square', freq: 1900 * v, to: 1500, dur: 0.012, vol: 0.02 * vol, at: t + 0.045 });
}

/** A camera flash going off: a soft bloom, a hot core and a four-point glint. */
function flashAt(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.35, 'rgba(220,230,255,0.25)');
  g.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillRect(x - Math.round(size * 0.6), y, Math.round(size * 1.2) + 1, 1);
  ctx.fillRect(x, y - Math.round(size * 0.45), 1, Math.round(size * 0.9) + 1);
}

/** The house monogram: two interlocked diamonds, wholly made up for this show. */
function monogram(p: Painter, cx: number, cy: number, r: number, c: Color) {
  for (const off of [-r * 0.45, r * 0.45])
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.abs(x) + Math.abs(y);
        if (d <= r && d > r - 2) p.set(cx + off + x, cy + y, c);
      }
  p.set(cx, cy, lighten(c, 0.5));
}

/** Upstage wall: heavy black drapes under a lighting truss, with a star-cloth of tiny pinlights. */
function backWall(): HTMLCanvasElement {
  const p = new Painter(W, H);
  const r = rng(1201);
  p.gradRect(0, 0, W, H, '#140a1e', '#06040a', 6);
  // pleated drapes: a soft sine shading across the folds
  for (let y = 16; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fold = Math.sin(x * 0.45 + Math.sin(y * 0.02) * 0.6);
      if (fold > 0.55 && bayer(x, y) < (fold - 0.55) * 1.2) p.set(x, y, mix(p.get(x, y), '#3a1a4a', 0.5));
      else if (fold < -0.6 && bayer(x, y) < 0.5) p.set(x, y, darken(p.get(x, y), 0.4));
    }
  // pinlight star-cloth
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W - 1), y = r.int(20, 120);
    p.set(x, y, r.next() < 0.3 ? '#fff0ff' : '#8a6a9a');
  }
  // the truss: two chords with zig-zag lacing
  for (const y of [3, 11]) {
    p.rect(0, y, W, 2, '#6a6a76');
    p.rect(0, y, W, 1, '#a8a8b4');
  }
  for (let x = 0; x < W; x++) {
    const k = x % 8, y = 5 + (k < 4 ? k * 1.5 : (8 - k) * 1.5);
    p.set(x, Math.round(y), '#55555f');
  }
  return p.canvas();
}

/** Far layer: the entrance portal with a frosted back-lit panel, flanked by tiered bleachers. */
function far(): HTMLCanvasElement {
  const p = new Painter(FAR_W, H);
  const r = rng(1213);
  const { x: px, w: pw, top, bot } = PORTAL;
  // the set wall around the portal: a glossy black flat with mirrored panels
  p.rect(px - 110, top - 10, 220, bot - top + 14, '#0e0a14');
  for (let x = px - 108; x < px + 110; x += 18) p.rect(x, top - 8, 1, bot - top + 10, '#2a2234');
  p.rect(px - 110, top - 10, 220, 1, '#4a3a5a');
  // the portal: frosted panel glowing hot pink to white, framed in gold
  for (let y = top; y < bot; y++)
    for (let x = px - (pw >> 1); x < px + (pw >> 1); x++) {
      const t = (y - top) / (bot - top), e = Math.abs(x - px) / (pw / 2);
      let c = mix('#fff4fa', MAGENTA, Math.min(1, t * 0.8 + e * 0.6));
      if (bayer(x, y) < 0.18) c = lighten(c, 0.15);
      p.set(x, y, c);
    }
  // arched top
  for (let x = px - (pw >> 1); x < px + (pw >> 1); x++) {
    const dx = (x - px) / (pw / 2), h = Math.round(Math.sqrt(Math.max(0, 1 - dx * dx)) * 12);
    for (let y = top - h; y < top; y++) p.set(x, y, mix('#fff8fc', '#ff9acb', Math.abs(dx)));
    p.set(x, top - h - 1, GOLD);
    p.set(x, top - h - 2, '#a07020');
  }
  p.rect(px - (pw >> 1) - 2, top, 2, bot - top, GOLD);
  p.rect(px + (pw >> 1), top, 2, bot - top, GOLD);
  monogram(p, px, top + 26, 10, '#ffffff');
  // a model's silhouette waiting in the doorway for her cue
  const mx = px + 6;
  p.ellipse(mx, bot - 52, 3, 4, '#2a1020');
  p.poly([[mx - 3, bot - 47], [mx + 3, bot - 47], [mx + 6, bot - 20], [mx - 6, bot - 20]], '#2a1020');
  p.rect(mx - 3, bot - 20, 2, 18, '#2a1020');
  p.rect(mx + 1, bot - 20, 2, 18, '#2a1020');
  p.line(mx + 3, bot - 46, mx + 7, bot - 34, '#2a1020');
  p.line(mx - 3, bot - 46, mx - 5, bot - 30, '#2a1020');
  // video screen bezels (their pictures are animated live)
  for (const sx of SCREENS) {
    p.rect(sx - 2, SCREEN_Y - 2, SCREEN_W + 4, SCREEN_H + 4, '#1c1a22');
    p.rect(sx - 2, SCREEN_Y - 2, SCREEN_W + 4, 1, '#4a4856');
  }
  // tiered bleachers either side, packed with a silhouette crowd
  for (let tier = 0; tier < 4; tier++) {
    const y = 104 + tier * 14;
    for (let x = r.int(0, 4); x < FAR_W; x += r.int(5, 7)) {
      if (Math.abs(x - px) < 116 - tier * 6) continue;
      const c = tier % 2 ? '#1e1426' : '#18101e';
      const hy = y - r.int(0, 2);
      p.ellipse(x, hy - 5, 2.4, 2.8, c);
      p.rect(x - 3, hy - 2, 7, 12, c);
      if (r.next() < 0.08) p.rect(x + 2, hy - 13, 2, 4, '#c8d8ff'); // a phone screen held up
    }
    p.rect(0, y + 9, FAR_W, 2, '#2a1e30');
  }
  // riser skirt at the foot of the set
  for (let y = 150; y < H; y++) for (let x = 0; x < FAR_W; x++) p.set(x, y, bayer(x, y) < 0.25 ? '#140c18' : '#0c0810');
  return p.canvas();
}

/** The front row: VIPs on gilt chairs either side of the catwalk, generated once and animated live. */
function guests(): Guest[] {
  const r = rng(1229);
  const outfits = ['#e83a6a', '#1a1a1a', '#f4f0e8', '#3a7ae8', '#e8b030', '#7a3ac8', '#1ab08a', '#c84020', '#f0a0c8', '#404048'];
  const skins = ['#f0c8a8', '#c89070', '#8a5838', '#5a3424', '#e0b090'];
  const out: Guest[] = [];
  for (let x = r.int(2, 6); x < MID_W; x += r.int(12, 16))
    out.push({ x, y: 186, h: r.int(20, 26), w: r.int(9, 12), outfit: r.pick(outfits), skin: r.pick(skins), hat: r.next() < 0.25 ? r.int(1, 2) : 0, shades: r.next() < 0.45, act: r.int(0, 3), ph: r.range(0, 6.28) });
  return out;
}

/** The press pit along the front edge of the catwalk, seen as silhouettes over the fight. */
function shooters(): Shooter[] {
  const r = rng(1237);
  const out: Shooter[] = [];
  for (let x = r.int(0, 8); x < PRESS_W; x += r.int(14, 22)) out.push({ x, h: r.int(10, 16), tall: r.next() < 0.3, ph: r.range(0, 100) });
  return out;
}

/** The catwalk itself: a glossy pearl surface with a lit centre seam and a black lacquer lip. */
function deck(): HTMLCanvasElement {
  const p = new Painter(STAGE_W, H);
  // gilt chair legs and the dark gap between the front row and the stage
  for (let y = TOP - 6; y < TOP; y++) for (let x = 0; x < STAGE_W; x++) if (bayer(x, y) < (y - TOP + 6) / 8) p.set(x, y, '#0a0610');
  // surface: pearl at the near edge, a little darker toward the back, with long glossy streaks
  for (let y = TOP; y < LIP; y++)
    for (let x = 0; x < STAGE_W; x++) {
      const t = (y - TOP) / (LIP - TOP);
      let c: Color = mix('#b8b0c8', PEARL, t);
      const streak = Math.sin(x * 0.07) + Math.sin(x * 0.023 + 2) > 1.4;
      if (streak && bayer(x, y) < 0.5) c = lighten(c, 0.35);
      if (y === TOP) c = '#8a8098';
      p.set(x, y, c);
    }
  // the seam of light running down the middle of the catwalk
  for (let x = 0; x < STAGE_W; x++) if (x % 6 < 4) p.set(x, FLOOR + 2, '#fff8ff');
  // black lacquer lip with a chrome edge (the LED chase is drawn live)
  for (let x = 0; x < STAGE_W; x++) {
    p.set(x, LIP, '#d8d4e0');
    p.set(x, LIP + 1, '#6a6478');
    for (let y = LIP + 2; y < LIP + LIP_H; y++) p.set(x, y, bayer(x, y) < 0.08 ? '#2a2432' : '#0e0c12');
    p.set(x, LIP + LIP_H, '#3a3444');
  }
  // the press pit floor below
  for (let y = LIP + LIP_H + 1; y < H; y++) for (let x = 0; x < STAGE_W; x++) p.set(x, y, bayer(x, y) < 0.2 ? '#100a16' : '#08060c');
  return p.canvas();
}

export class RunwayStage {
  name = 'THE RUNWAY';
  blurb = 'WORK IT, OR GET WORKED';
  song: SongName = 'runway';
  wall = backWall();
  far = far();
  crowd = guests();
  press = shooters();
  deck = deck();
  pit: HTMLCanvasElement;
  pitLanding: PitLanding;
  /** World x of each fighter for the follow spots, and their last hp to spot hits. */
  spots: number[] = [176, 336];
  hp: number[] = [];
  /** How hard the press is shooting right now; decays back to a steady patter. */
  frenzy = 0;

  constructor(bones: PartSet) {
    this.pit = this.buildPit(bones);
    this.pitLanding = this.makeLanding();
  }

  reset() {
    this.spots = [176, 336];
    this.hp = [];
    this.frenzy = 0;
  }

  update(f: Fight) {
    f.f.forEach((ft, i) => {
      this.spots[i] += (ft.x - this.spots[i]) * 0.12;
      const was = this.hp[i] ?? ft.hp;
      // the press goes wild on every clean hit, wilder for the big ones
      if (ft.hp < was) {
        this.frenzy = Math.min(1, this.frenzy + (was - ft.hp) / 160);
        shutter(0.5);
      }
      this.hp[i] = ft.hp;
    });
    this.frenzy *= 0.985;
  }

  /** Down off the end of the catwalk into the photographers' pit for the uppercut stage finish. */
  buildPit(bones: PartSet): HTMLCanvasElement {
    const p = new Painter(W, H);
    const r = rng(1249);
    p.gradRect(0, 0, W, H, '#1a0e22', '#050308', 8);
    // the underside of the catwalk overhead, its LED lip glowing pink
    p.rect(0, 0, W, 12, '#0e0c12');
    p.rect(0, 12, W, 1, '#d8d4e0');
    for (let x = 2; x < W; x += 5) p.rect(x, 9, 2, 2, x % 10 < 5 ? MAGENTA : '#ff9acb');
    for (let y = 13; y < 60; y++)
      for (let x = 0; x < W; x++) if (bayer(x, y) < 0.22 * (1 - (y - 13) / 47)) p.set(x, y, mix(p.get(x, y), MAGENTA, 0.3));
    // the press wall at the back of the pit: a step-and-repeat of the show's monogram
    p.rect(0, 64, W, 50, '#1e1428');
    for (let y = 64; y < 114; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < 0.12) p.set(x, y, '#2a1e36');
    for (let row = 0; row < 3; row++)
      for (let x = (row % 2) * 24 + 12; x < W; x += 48) monogram(p, x, 76 + row * 15, 5, row % 2 ? '#8a5a9a' : '#c86aa8');
    p.rect(0, 63, W, 1, '#4a3a5a');
    // pit floor: black carpet with gaffer-tape marks, seen at a slope
    for (let y = 120; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c: Color = bayer(x, y) < 0.3 ? '#1a1420' : '#120e18';
        if (y < 124) c = '#0a080e';
        p.set(x, y, c);
      }
    for (const [tx, ty] of [[60, 140], [190, 132], [128, 196]]) {
      p.line(tx - 6, ty - 3, tx + 6, ty + 3, '#e8e070');
      p.line(tx - 6, ty + 3, tx + 6, ty - 3, '#e8e070');
    }
    // cables snaking over the floor
    for (let k = 0; k < 4; k++) {
      let y = r.int(130, 210);
      const c = k % 2 ? '#2a2a30' : '#3a2a20';
      for (let x = 0; x < W; x++) {
        y += Math.sin(x * 0.05 + k * 2) * 0.6;
        p.set(x, Math.round(y), c);
      }
    }
    // toppled tripods, a light stand and dropped camera bags
    for (const [x0, y0, a] of [[34, 182, -0.3], [206, 176, 0.4], [150, 214, 0.1]]) {
      for (const da of [-0.25, 0, 0.25]) p.line(x0, y0, x0 + Math.cos(a + da) * 30, y0 + Math.sin(a + da) * 8 + 4, '#6a6a74');
      p.rect(x0 - 4, y0 - 3, 8, 5, '#1a1a1e');
    }
    for (const [bx, by] of [[86, 202], [180, 150], [24, 140]]) {
      p.rect(bx, by, 16, 9, '#2a2830');
      p.rect(bx, by, 16, 1, '#4a4856');
      p.rect(bx + 5, by - 2, 6, 2, '#1a1a1e');
    }
    // a thrown bouquet and a scatter of petals and sequins
    p.line(118, 170, 132, 176, '#2a6a2a');
    p.line(118, 172, 132, 178, '#2a6a2a');
    for (const [rx, ry] of [[114, 168], [117, 166], [113, 172], [118, 171]]) p.ellipse(rx, ry, 2, 2, '#e02a5a');
    for (let i = 0; i < 60; i++) p.set(r.int(10, W - 10), r.int(126, H - 2), r.pick(['#e02a5a', '#ff7aa0', '#ffe080', '#c8d0ff']));
    // more of the press crowding the back of the pit, lenses up
    for (let x = 4; x < W; x += r.int(16, 22)) {
      const hy = r.int(104, 112), c = '#0e0a12';
      p.ellipse(x, hy, 4, 5, c);
      p.rect(x - 7, hy + 4, 14, 16, c);
      p.rect(x - 4, hy - 2, 8, 6, '#1a1a1e');
      p.ellipse(x, hy + 1, 2, 2, '#3a4a6a');
    }
    const cv = p.canvas();
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    // a previous casualty of the runway, still sprawled among the tripods
    ctx.save();
    ctx.translate(176, 200);
    ctx.scale(-1, 1);
    drawRig(ctx, bones, fk(P(LIE, { rot: -92, af: -150, ab: 20, lf: -10, kf: 40, h: 0 })));
    ctx.restore();
    return cv;
  }

  /** Landing for the uppercut finish: a hard thud, then the whole press pit opens fire. */
  makeLanding(): PitLanding {
    const pops: Pop[] = [];
    const flashes = shooters().slice(0, 12);
    return {
      pose: P(LIE, { rot: -92, h: 4, af: -160, ef: -10, ab: 30, lf: -20, kf: 30, lb: 10, kb: 20 }),
      land: (f) => {
        pops.length = 0;
        sfx.thud();
        sfx.crunch();
        f.shake(10);
        f.pitParticles.sparks(128, H - 74, 24, '#ffe8f4');
        for (let i = 0; i < 8; i++) shutter(1);
      },
      tick: (_f, it) => {
        for (let i = pops.length - 1; i >= 0; i--) if (--pops[i].life <= 0) pops.splice(i, 1);
        if (it % 3 === 0 || Math.random() < 0.35) {
          const s = flashes[Math.floor(Math.random() * flashes.length)];
          const left = Math.random() < 0.5;
          pops.push({ x: left ? 14 + (s.x % 50) : W - 14 - (s.x % 50), y: 120 + (s.h * 5) % 90, life: 4, big: Math.random() < 0.25 });
          if (it % 2 === 0) shutter(0.7);
        }
      },
      draw: (ctx, it) => {
        // photographers leaning in from both sides, cameras up
        ctx.fillStyle = '#06040a';
        for (const side of [-1, 1]) {
          for (let k = 0; k < 3; k++) {
            const cx = side < 0 ? 10 + k * 18 : W - 10 - k * 18, cy = 110 + k * 38 + ((it >> 4) + k) % 2;
            ctx.fillRect(cx - 12, cy, 24, H - cy);
            ctx.beginPath();
            ctx.ellipse(cx, cy - 4, 7, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#18161c';
            ctx.fillRect(cx - side * 4 - 6, cy - 8, 12, 9);
            ctx.fillStyle = '#2a3a5a';
            ctx.fillRect(cx - side * 10 - 2, cy - 6, 4, 5);
            ctx.fillStyle = '#06040a';
          }
        }
        // the flashes, and the whole frame blown out on the big ones
        let blown = 0;
        for (const fl of pops) {
          flashAt(ctx, fl.x, fl.y, fl.big ? 22 : 14);
          if (fl.big && fl.life > 2) blown = Math.max(blown, 0.28);
        }
        if (blown) {
          ctx.fillStyle = `rgba(255,250,255,${blown})`;
          ctx.fillRect(0, 0, W, H);
        }
      },
    };
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    ctx.drawImage(this.wall, 0, 0);
    const fx = -Math.round(camX * 0.3);
    ctx.drawImage(this.far, fx, 0);
    this.drawScreens(ctx, fx, t);
    // the portal breathes with the beat
    const pulse = 0.08 + Math.max(0, Math.sin(t * 0.13)) * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,60,150,${pulse})`;
    ctx.fillRect(PORTAL.x + fx - 40, PORTAL.top - 16, 80, PORTAL.bot - PORTAL.top + 16);
    ctx.restore();
    this.drawBeams(ctx, t);
    this.drawCrowd(ctx, -Math.round(camX * 0.6), t);
    const dx = -Math.round(camX);
    ctx.drawImage(this.deck, dx, 0);
    // LED chase along the catwalk lip
    for (let x = 1 + (((dx % 4) + 4) % 4); x < W; x += 4) {
      const wx = x - dx, k = (wx >> 2) - Math.floor(t / 3);
      const c = ((k % 12) + 12) % 12 < 3 ? '#ffffff' : (wx >> 5) % 2 ? MAGENTA : CYAN;
      ctx.fillStyle = c;
      ctx.fillRect(x, LIP + 4, 2, 2);
    }
    this.drawSpots(ctx, dx);
  }

  /** The two video walls flanking the portal: scrolling diamond patterns that change every few beats. */
  drawScreens(ctx: CanvasRenderingContext2D, fx: number, t: number) {
    const mode = Math.floor(t / 240) % 3;
    for (let s = 0; s < SCREENS.length; s++) {
      const sx = SCREENS[s] + fx;
      if (sx > W || sx + SCREEN_W < 0) continue;
      for (let y = 0; y < SCREEN_H; y += 2)
        for (let x = 0; x < SCREEN_W; x += 2) {
          let v: number;
          if (mode === 0) v = ((Math.abs((x % 16) - 8) + Math.abs((y % 16) - 8) + (t >> 2)) % 16) / 16;
          else if (mode === 1) v = (Math.sin((x + y) * 0.2 - t * 0.08 + s) + 1) / 2;
          else v = Math.max(0, 1 - Math.abs(y - SCREEN_H / 2 - Math.sin(x * 0.25 + t * 0.1) * 10) / 6);
          ctx.fillStyle = v > 0.66 ? '#ffe8f6' : v > 0.4 ? (s ? CYAN : MAGENTA) : v > 0.2 ? (s ? '#1a4a6a' : '#6a1a4a') : '#120a1a';
          ctx.fillRect(sx + x, SCREEN_Y + y, 2, 2);
        }
    }
  }

  /** Moving-head beams from the truss, sweeping and changing colour. */
  drawBeams(ctx: CanvasRenderingContext2D, t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < HEADS.length; i++) {
      const hx = HEADS[i], a = Math.sin(t * 0.018 + i * 1.7) * 0.55 + (i % 2 ? 0.15 : -0.15);
      const [r, g, b] = BEAMS[(i + Math.floor(t / 300)) % BEAMS.length];
      const len = 220, ex = hx + Math.sin(a) * len, ey = 14 + Math.cos(a) * len;
      const grad = ctx.createLinearGradient(hx, 14, ex, ey);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      const nx = Math.cos(a), ny = -Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(hx - nx * 2, 14 - ny * 2);
      ctx.lineTo(hx + nx * 2, 14 + ny * 2);
      ctx.lineTo(ex + nx * 18, ey + ny * 18);
      ctx.lineTo(ex - nx * 18, ey - ny * 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // the fixtures themselves
    for (const hx of HEADS) {
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(hx - 4, 12, 8, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - 2, 17, 4, 1);
    }
  }

  /** Follow spots from the back of the house, one locked on each fighter. */
  drawSpots(ctx: CanvasRenderingContext2D, dx: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.spots.length; i++) {
      const x = this.spots[i] + dx, src = i ? W + 30 : -30;
      if (x < -40 || x > W + 40) continue;
      const grad = ctx.createLinearGradient(0, 0, 0, FLOOR);
      grad.addColorStop(0, 'rgba(255,250,240,0)');
      grad.addColorStop(1, 'rgba(255,250,240,0.13)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(src - 3, 0);
      ctx.lineTo(src + 3, 0);
      ctx.lineTo(x + 22, FLOOR + 2);
      ctx.lineTo(x - 22, FLOOR + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,240,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, FLOOR + 1, 22, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCrowd(ctx: CanvasRenderingContext2D, ox: number, t: number) {
    for (let i = 0; i < this.crowd.length; i++) {
      const g = this.crowd[i];
      const x = g.x + ox;
      if (x < -16 || x > W + 16) continue;
      const top = g.y - g.h;
      const outfit = css(mix(g.outfit, '#000000', 0.35)), skin = css(mix(g.skin, '#000000', 0.3));
      // gilt chair back
      ctx.fillStyle = '#8a6a28';
      ctx.fillRect(x - 6, top + 6, 1, g.h - 6);
      ctx.fillRect(x + 5, top + 6, 1, g.h - 6);
      ctx.fillStyle = outfit;
      ctx.fillRect(x - (g.w >> 1), top + 7, g.w, g.h - 7);
      ctx.fillStyle = skin;
      ctx.fillRect(x - 2, top, 5, 6);
      if (g.shades) {
        ctx.fillStyle = '#08080c';
        ctx.fillRect(x - 2, top + 2, 5, 1);
      }
      if (g.hat) {
        ctx.fillStyle = g.hat === 1 ? '#101010' : '#e8d8b0';
        ctx.fillRect(x - 5, top, 11, 1);
        ctx.fillRect(x - 2, top - 2, 5, 2);
      }
      // what they're doing: polite clapping, phone up, fanning, or arms crossed
      const k = Math.sin(t * 0.3 + g.ph);
      if (g.act === 0) {
        ctx.fillStyle = skin;
        const sep = k > 0 ? 2 : 0;
        ctx.fillRect(x - 2 - sep, top + 10, 2, 2);
        ctx.fillRect(x + 1 + sep, top + 10, 2, 2);
      } else if (g.act === 1) {
        ctx.fillStyle = outfit;
        ctx.fillRect(x + (g.w >> 1) - 1, top - 2, 2, 10);
        ctx.fillStyle = '#c8d8ff';
        ctx.fillRect(x + (g.w >> 1) - 1, top - 6, 3, 4);
      } else if (g.act === 2) {
        ctx.fillStyle = g.outfit === '#1a1a1a' ? MAGENTA : '#f4f0e8';
        const sw = Math.round(Math.sin(t * 0.2 + g.ph) * 2);
        ctx.fillRect(x - (g.w >> 1) - 3 + sw, top + 3, 3, 4);
      } else {
        ctx.fillStyle = skin;
        ctx.fillRect(x - (g.w >> 1) + 1, top + 11, g.w - 2, 2);
      }
    }
  }

  /** The press pit along the front edge, flashes popping faster the harder the fight gets. */
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number) {
    const ox = -Math.round(camX * 1.25);
    const rate = 0.03 + this.frenzy * 0.35;
    let blown = 0;
    for (const s of this.press) {
      const x = s.x + ox;
      if (x < -16 || x > W + 16) continue;
      const bob = Math.round(Math.sin(t * 0.05 + s.ph) * 1);
      const top = H - s.h + bob;
      ctx.fillStyle = '#050308';
      ctx.fillRect(x - 7, top + 5, 14, s.h);
      ctx.beginPath();
      ctx.ellipse(x, top + 2, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // camera held up to the eye (the tall ones hold it overhead)
      const cy = s.tall ? top - 8 : top - 1;
      ctx.fillStyle = '#18161c';
      ctx.fillRect(x - 5, cy, 10, 6);
      ctx.fillRect(x - 2, cy - 2, 4, 2);
      if (s.tall) {
        ctx.fillStyle = '#050308';
        ctx.fillRect(x - 6, cy + 5, 2, top - cy);
        ctx.fillRect(x + 4, cy + 5, 2, top - cy);
      }
      // a deterministic-looking pop pattern per photographer
      const n = Math.sin(s.ph * 12.9898 + Math.floor(t / 4) * 78.233) * 43758.5453;
      if (n - Math.floor(n) < rate) {
        flashAt(ctx, x, cy + 1, 12);
        blown = Math.max(blown, this.frenzy * 0.12);
      }
    }
    if (blown > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${blown})`;
      ctx.fillRect(0, 0, W, H);
    }
    // glitter drifting down through the light
    for (let i = 0; i < 16; i++) {
      const x = ((i * 53 + Math.sin(t * 0.02 + i) * 8 - camX) % STAGE_W + STAGE_W) % STAGE_W;
      if (x > W) continue;
      const y = (t * (0.15 + (i % 4) * 0.04) + i * 37) % FLOOR;
      ctx.fillStyle = (t >> 3) % 2 === i % 2 ? '#ffffff' : i % 3 ? GOLD : '#ff9acb';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}
