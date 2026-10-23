import type { Look } from './build';
import { crook, sarcophagus, sarcophagusCase } from '../gfx/props';
import { Painter } from '../gfx/painter';
import { darken, lighten, mix } from '../gfx/palette';
import type { PortraitStyle } from '../gfx/portrait';
import { A, P, STANCE, CROUCH, VICTORY } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Intro } from '../game/intro';
import type { Move, Special } from '../game/types';
import { Projectile } from '../game/projectile';
import { FLOOR } from '../core/consts';
import { rand } from '../core/rng';
import { sfx } from '../audio/sfx';
import { playCue } from '../audio/specials';

// An original pixel take on the boy pharaoh Tutankhamun, back from the tomb: striped royal
// headcloth, gold collar, linen kilt and the odd loose mummy bandage. Fights with scarabs,
// falling sarcophagi and the desert itself.

const LINEN = '#e4d8b8';
const GOLD = '#d8b040';
const LAPIS = '#1c3a9a';

export const TUT_LOOK: Look = {
  skin: '#b88052', hair: '#2a1a14', eye: '#120c0a', shirt: '#b88052', pants: '#b88052', boots: '#c89a3a',
  hairStyle: 'short', hat: 'nemes', hatColor: GOLD, hatTrim: LAPIS, beard: 'pharaoh', kohl: true,
  bareChest: true, usekh: [GOLD, LAPIS], kilt: { color: '#f2ecd8', belt: GOLD }, bracers: GOLD,
  wraps: LINEN, bandages: LINEN,
};
const TUT_ALT: Look = {
  ...TUT_LOOK, hatColor: '#2a2a32', hatTrim: '#c8a040', usekh: ['#c8a040', '#a01818'], kilt: { color: '#2a2a32', belt: '#c8a040' },
  bracers: '#c8a040', boots: '#2a2a32', bandages: '#8a7a5a', wraps: '#8a7a5a',
};

// ---------------------------------------------------------------- poses (facing right)
/** Arms crossed on the chest like the coffin portraits. */
const CROSSED = P(STANCE, { t: -2, h: -6, af: -30, ef: -150, ab: -20, eb: -155, lf: -12, kf: 10, lb: 12, kb: 4 });
const SUMMON = P(STANCE, { t: -10, h: -14, af: -165, ef: -20, ab: -155, eb: -25, lf: -26, kf: 10, lb: 24, kb: 4 });
const SUMMON_HI = P(SUMMON, { af: -174, ab: -162, h: -18, t: -14 });
const POINT = P(STANCE, { af: -92, ef: -2, ab: 30, eb: -30, t: 20, h: -6, lf: -40, kf: 40, lb: 30, kb: 8 });
const WHIRL = P(STANCE, { af: -90, ef: -5, ab: -90, eb: -5, t: 0, h: -8, lf: -10, kf: 15, lb: 10, kb: 10 });
const CROOK_UP = P(VICTORY, { af: -172, ef: -14, ab: -40, eb: -140, t: -8, h: -12 });

const img = (() => {
  let cache: { strip: HTMLCanvasElement; lid: HTMLCanvasElement; box: HTMLCanvasElement } | null = null;
  return () => {
    if (cache) return cache;
    const s = new Painter(6, 2);
    s.rect(0, 0, 6, 2, LINEN);
    s.line(0, 1, 5, 1, darken(LINEN, 0.2));
    return (cache = { strip: s.canvas(), lid: sarcophagus(), box: sarcophagusCase() });
  };
})();

/** Puffs of desert sand. */
function sand(f: Fight, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) f.particles.smoke(x + rand(-8, 8), y + rand(-6, 6), 1, Math.random() < 0.5 ? '#d8b878' : '#b89458');
}

/** A loose bandage strip fluttering off a point. */
function strip(f: Fight, x: number, y: number, vx: number, vy: number, life = 30) {
  f.particles.add({ kind: 'img', img: img().strip, ix: 3, iy: 1, x, y, vx, vy, grav: 0, rot: rand(0, 6), vrot: rand(-0.3, 0.3), life, max: life, floor: false });
}

// ---------------------------------------------------------------- specials
const SCARAB_SWARM: Move = {
  id: 'proj_scarab',
  anim: A([
    [CROSSED, 5],
    [P(STANCE, { af: 40, ef: -90, ab: -40, eb: -100, t: -6, h: -6, lf: -16, kf: 14 }), 5],
    [POINT, 10],
    [P(POINT, { af: -88, ef: -10, t: 14 }), 12],
    [STANCE, 6],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 12) {
      f.projectiles.push(new Projectile(self, 'scarab', self.x + self.facing * 26, 54));
      self.projOut = true;
      f.particles.sparks(self.x + self.facing * 24, 54, 6, '#e8c860');
    }
  },
};

const SARCOPHAGUS_DROP: Move = {
  id: 'proj_sarc',
  anim: A([
    [CROSSED, 4],
    [SUMMON, 8],
    [SUMMON_HI, 16],
    [P(STANCE, { af: -80, ef: -10, ab: -70, eb: -10, t: 22, h: 6, lf: -30, kf: 30 }), 8],
    [STANCE, 8],
  ]),
  onFrame: (self, f, fr) => {
    if (fr === 8) {
      f.projectiles.push(new Projectile(self, 'sarcophagus', self.opp.x, 230));
      self.projOut = true;
    }
    if (fr >= 6 && fr < 28 && fr % 3 === 0) {
      for (const h of ['handF', 'handB'] as const) {
        const [lx, ly] = self.skel[h];
        f.particles.sparks(self.wx(lx), self.wy(ly), 1, '#ffe080');
      }
    }
  },
};

const SANDSTORM: Move = {
  id: 'sandstorm',
  anim: A([
    [P(CROUCH, { af: -60, ab: -60, t: 10 }), 4],
    [WHIRL, 8],
    [P(WHIRL, { h: -14, t: -6, lf: -20, kf: 25 }), 14],
    [WHIRL, 14],
    [P(STANCE, { af: -40, ef: -60, t: 6 }), 10],
  ]),
  spin: 4,
  active: [4, 40],
  vx: (fr) => (fr >= 4 && fr < 40 ? 1.6 : 0),
  hit: { limb: 'body', r: 20, dmg: 24, level: 'mid', effect: 'light', push: 1.4, stun: 14, rehit: 8, special: true },
  onFrame: (self, f, fr) => {
    if (fr >= 4 && fr < 40) {
      sand(f, self.x, rand(4, 70), 2);
      if (fr % 5 === 0) strip(f, self.x + rand(-14, 14), rand(20, 70), rand(-1.5, 1.5), rand(0.2, 1), 20);
      if (fr % 8 === 4) f.sfx('whoosh');
    }
  },
};

const tutSpecials: Special[] = [
  { name: 'Scarab Swarm', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: SCARAB_SWARM },
  { name: 'Sarcophagus Drop', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P (block high)', move: SARCOPHAGUS_DROP },
  { name: 'Sandstorm Whirl', cmd: [2, 5, 2], btn: 'hk', mash: 'hk', text: 'MASH HK', move: SANDSTORM },
];

// ---------------------------------------------------------------- finisher
/**
 * Eternal Embalming: bandages whip out and wind the loser into a mummy, a sarcophagus slams
 * down over them, and it sinks into the sand leaving only a dark stain.
 */
function eternalEmbalming(f: Fight, w: Fighter, l: Fighter, t: number, D: any): boolean {
  const mid = () => ({ x: l.x, y: l.y + 45 });
  if (t < 16) {
    w.poseOverride = CROSSED;
    l.poseOverride = P(STANCE, { t: 4, h: 10, af: 10, ef: -20, ab: 22, eb: -15 });
  } else if (t < 100) {
    w.poseOverride = t % 8 < 4 ? POINT : P(POINT, { af: -100, ab: 40, t: 24 });
    if (t === 16) sfx.whoosh(2);
    // bandages stream from his hands and spiral round the victim, tightening
    const k = (t - 16) / 84;
    if (t % 2 === 0) {
      const hx = w.wx(w.skel.handF[0]), hy = w.wy(w.skel.handF[1]);
      strip(f, hx, hy, (l.x - hx) / 12, (45 - hy) / 12 + 0.3, 12);
      const a = t * 0.5, m = mid();
      strip(f, m.x + Math.cos(a) * (18 - k * 8), m.y + ((t * 3) % 70) - 35, -Math.sin(a) * 1.5, 0.2, 10);
    }
    if (t % 6 === 0) playCue('linenSnap');
    l.tint = [LINEN, Math.min(0.92, k * 1.1)];
    l.shake = k < 0.7 ? 2 : 1;
    // stiffens into the burial pose: arms pinned across the chest
    l.poseOverride = k < 0.5 ? P(STANCE, { t: 2, h: 14 - k * 20, af: -20, ef: -100, ab: -10, eb: -110 }) : P(CROSSED, { lf: 0, kf: 0, lb: 0, kb: 0, t: 0, h: -2 });
    if (t === 40) sfx.scream();
    if (t === 80) sfx.grunt();
  } else if (t === 100) {
    l.shake = 0;
    w.poseOverride = SUMMON;
    playCue('curseChant');
    D.sarc = new Projectile(w, 'sarcophagus', l.x, 240);
    D.sarc.spent = true; // scenery only: the finisher drives it
    D.vy = 0;
    f.projectiles.push(D.sarc);
  }
  if (D.sarc && !D.slam) {
    w.poseOverride = t < 112 ? SUMMON : SUMMON_HI;
    if (t > 112) {
      D.vy -= 0.6;
      D.sarc.y += D.vy;
      if (D.sarc.y <= 22) {
        D.sarc.y = 22;
        D.slam = t;
        l.alpha = 0;
        f.shake(16);
        sfx.thud();
        sfx.crunch();
        sfx.blood();
        sand(f, l.x, 4, 16);
        for (const s of [-1, 1]) f.particles.blood(l.x + s * 11, 4, s, 30, 1.4);
      }
    }
  }
  if (D.slam) {
    const dt = t - D.slam;
    w.poseOverride = dt < 40 ? P(STANCE, { af: -80, ef: -10, ab: -70, eb: -10, t: 22, h: 6 }) : CROOK_UP;
    w.propOverride = dt >= 40 ? w.ch.props.crook ?? null : null;
    if (dt < 40 && dt % 6 === 0) for (const s of [-1, 1]) f.particles.blood(l.x + s * 11, 2, s, 4, 0.8);
    if (dt === 40) sfx.gong();
    if (dt > 50 && dt < 100) {
      // sinks into the sand
      D.sarc.y -= 0.9;
      if (dt % 3 === 0) sand(f, l.x, 2, 2);
      if (dt % 10 === 0) playCue('stoneGrind');
    }
    if (dt === 100) D.sarc.dead = true;
    return dt >= 150;
  }
  return false;
}

// ---------------------------------------------------------------- round intro
const homes = new WeakMap<Fighter, number>();

export const TUT_INTRO: Intro = {
  line: 'The boy king wakes. Kneel, or be buried.',
  speech: { pitch: 0.75, rate: 0.85 },
  speakAt: 72,
  dur: 150,
  update(self, f, t, home) {
    homes.set(self, home);
    self.x = home;
    if (t < 34) {
      // still sealed in the coffin, which shudders
      self.alpha = 0;
      if (t % 10 === 0) playCue('stoneGrind');
      if (t % 4 === 0) sand(f, home, rand(10, 80), 1);
    } else {
      self.alpha = 1;
      if (t === 34) {
        sfx.thud();
        f.shake(4);
        sand(f, home, 30, 14);
        for (let i = 0; i < 6; i++) strip(f, home + rand(-6, 6), rand(30, 80), rand(-1, 1), rand(0.4, 1.2), 40);
      }
      if (t < 64) {
        // steps out in the coffin pose
        self.x = home - self.facing * 6 * (1 - (t - 34) / 30);
        self.poseOverride = P(CROSSED, (t >> 3) % 2 ? { lf: -20, kf: 18 } : { lf: -6, kf: 6 });
      } else {
        self.propOverride = self.ch.props.crook ?? null;
        self.poseOverride = CROOK_UP;
        if (t === 64) playCue('curseChant');
        if (t % 4 === 0) {
          // the eyes glow
          const [nx, ny] = self.skel.neck, [tx, ty] = self.skel.headTop;
          f.particles.sparks(self.wx((nx + tx) / 2 + 4), self.wy((ny + ty) / 2), 1, '#ffe060');
        }
      }
    }
  },
  draw(ctx, self, _f, t, cam) {
    const home = homes.get(self) ?? self.x;
    const x = Math.round(home - cam);
    const i = img();
    const sinkK = Math.max(0, (t - 110) / 40);
    const sink = Math.round(sinkK * 46);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 30, 0, 60, FLOOR);
    ctx.clip();
    const shake = t < 34 && t % 4 < 2 ? 1 : 0;
    ctx.drawImage(i.box, x - 11 + shake, FLOOR - 44 + sink);
    if (t < 34) ctx.drawImage(i.lid, x - 11 + shake, FLOOR - 44);
    ctx.restore();
    if (t >= 34) {
      // the lid topples over toward the opponent and lies on the floor
      const k = Math.min(1, (t - 34) / 10);
      ctx.save();
      ctx.translate(x + self.facing * 11, FLOOR);
      ctx.rotate(self.facing * k * (Math.PI / 2));
      ctx.globalAlpha = 1 - sinkK;
      ctx.drawImage(i.lid, self.facing === 1 ? -22 : 0, -44);
      ctx.restore();
    }
  },
};

// ---------------------------------------------------------------- portrait
const nemesPts = [[24, 50], [25, 30], [34, 16], [52, 10], [68, 13], [78, 24], [80, 36], [64, 35], [44, 37], [38, 46], [40, 70], [44, 98], [30, 104], [16, 98], [18, 70]];

export const TUT_PORTRAIT: PortraitStyle = {
  skip: { hair: true, hat: true, beard: true },
  back(p, c) {
    // the headcloth's lappet hangs behind the shoulder
    c.sculpt((m) => m.poly([[20, 60], [38, 56], [42, 110], [22, 118]], '#fff'), c.look.hatColor ?? GOLD, { soft: 3 });
  },
  front(p, c) {
    const L = c.look, g = c.geom;
    const gold = L.hatColor ?? GOLD, stripe = L.hatTrim ?? LAPIS;
    const [cg, inlay] = L.usekh ?? [GOLD, LAPIS];
    // broad collar: rows of gold and inlay across the chest
    for (let r = 0; r < 4; r++) {
      const top = 92 + r * 7;
      c.sculpt((m) => m.poly([[8 - r * 4, top + 14], [24, top], [52, top + 4], [84, top], [100 + r * 4, top + 14], [84, top + 6], [52, top + 10], [24, top + 6]], '#fff'), r % 2 ? inlay : cg, { soft: 2 });
    }
    // the false beard
    c.sculpt((m) => m.poly([[55, 84], [63, 84], [64, 104], [56, 106]], '#fff'), L.hair, { soft: 1 });
    for (let y = 88; y < 104; y += 4) p.line(55, y, 63, y, gold);
    // striped headcloth over the skull and ear, with a gold band at the brow
    const cloth = c.sculpt((m) => m.poly(nemesPts, '#fff'), gold, { soft: 4, bias: 0.1 });
    for (let y = 0; y < 120; y++)
      for (let x = 0; x < 104; x++) if (cloth[y * 104 + x] && y % 6 < 2 && y < 34 + (x < 40 ? 80 : 0)) p.set(x, y, mix(p.get(x, y), stripe, 0.8));
    c.sculpt((m) => m.poly([[34, 36], [80, 33], [80, 38], [38, 41]], '#fff'), lighten(gold, 0.1), { soft: 1 });
    // uraeus cobra on the brow
    c.sculpt((m) => m.poly([[71, 36], [71, 24], [74, 20], [77, 23], [75, 26], [74, 36]], '#fff'), gold, { soft: 1 });
    p.set(74, 22, '#c01818');
    // heavy kohl wings off both eyes
    const [ax, ay] = g.eyeA, [bx, by] = g.eyeB;
    p.line(ax - 6, ay - 3, ax + 5, ay - 4, '#0a0608');
    p.line(ax - 6, ay - 3, ax - 12, ay - 1, '#0a0608');
    p.line(bx - 4, by - 3, bx + 4, by - 4, '#0a0608');
    p.line(bx + 4, by - 4, bx + 8, by - 2, '#0a0608');
    if (!c.beaten) p.set(ax - 1, ay - 1, '#ffe060'), p.set(bx, by - 1, '#ffe060');
    // a few bandage strips across the shoulder
    if (L.bandages) for (const [x0, y0] of [[12, 104], [16, 112]]) p.line(x0, y0, x0 + 18, y0 - 6, L.bandages), p.line(x0, y0 + 1, x0 + 18, y0 - 5, darken(L.bandages, 0.25));
  },
};

// ---------------------------------------------------------------- definition
export function kingTut(): CharDef {
  return {
    id: 'kingtut', name: 'King Tut', short: 'KING TUT', title: 'The Boy Pharaoh', look: TUT_LOOK, alt: TUT_ALT,
    specials: tutSpecials, voice: 150, props: { crook: crook() },
    finisher: { name: 'Eternal Embalming', cmd: [2, 4, 6], btn: 'hk', text: 'D, B, F + HK (mid range)', range: [0, 160] },
    fatality: eternalEmbalming, intro: TUT_INTRO, portrait: TUT_PORTRAIT,
    quotes: [
      'THREE THOUSAND YEARS IN A BOX, AND I STILL GOT UP FASTER THAN YOU, {L}.',
      'YOUR TOMB IS READY. I HAD IT DUG THIS MORNING.',
      'BOW TO THE BOY KING. YOU ARE ALREADY ON THE FLOOR, SO THAT HELPS.',
      'THE CURSE IS REAL. ASK YOUR TEETH.',
    ],
    quotesVs: {
      hawking: 'I HAVE BEEN DEAD FOR AGES, PROFESSOR. TIME IS ON MY SIDE.',
      lincoln: 'A TALL HAT IS NO MATCH FOR A GOLD ONE.',
    },
  };
}
