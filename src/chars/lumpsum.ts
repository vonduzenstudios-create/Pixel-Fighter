import type { Look } from './build';
import { bigCheck, bill, musicNote } from '../gfx/props';
import { A, P, STANCE, VICTORY, HIT_HIGH, DIZZY, FALL } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import { Projectile, ProjKind } from '../game/projectile';
import { sfx } from '../audio/sfx';
import { rand } from '../core/rng';

// J.G. Spentworth: an original parody of the late-night "trade your payments for cash" pitchman,
// reimagined as a horned-helmet opera tenor who fights with money and high notes.

let IMG: { bill: HTMLCanvasElement; note: HTMLCanvasElement; noteR: HTMLCanvasElement } | null = null;
const img = () => (IMG ??= { bill: bill(), note: musicNote(), noteR: musicNote('#ff9a80') });

export function floatNote(f: Fight, x: number, y: number, red = false) {
  f.particles.add({ kind: 'img', img: red ? img().noteR : img().note, ix: 3, iy: 4, x, y, vx: rand(-0.4, 0.4), vy: rand(0.5, 0.9), grav: 0, rot: 0, life: 45, max: 45, floor: false });
}

export function cashRain(f: Fight, x: number, n: number) {
  for (let i = 0; i < n; i++)
    f.particles.add({ kind: 'img', img: img().bill, ix: 3, iy: 2, x: x + rand(-40, 40), y: rand(150, 190), vx: rand(-0.3, 0.3), vy: rand(-0.6, -0.2), grav: 0.015, rot: rand(0, 6), vrot: rand(-0.15, 0.15), life: 220, max: 220 });
}

function proj(kind: ProjKind, at: number, height: number, sound: string, anim: Move['anim']): Move {
  return {
    id: 'proj_' + kind,
    anim,
    onFrame: (self: Fighter, f: Fight, fr: number) => {
      if (fr === at + 2) {
        f.projectiles.push(new Projectile(self, kind, self.x + self.facing * 24, height));
        self.projOut = true;
        f.sfx(sound);
      }
    },
  };
}

export const LUMPSUM_LOOK: Look = {
  skin: '#e6b48c', hair: '#3a2418', eye: '#2a1a14', shirt: '#f2f0ea', coat: '#5a1428', coatTrim: '#d8b040', tails: true,
  pants: '#1c1a22', boots: '#0e0c12', hat: 'horned', hairStyle: 'long', mustache: true, bowtie: '#d8b040',
  sash: '#2e8a44', glove: '#f2f0ea',
};

const specials: Special[] = [
  {
    name: 'Lump Sum Toss', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P',
    move: proj('cash', 8, 54, 'kaching', A([
      [P(STANCE, { af: 40, ef: -80, ab: -30, t: -8, h: -6 }), 8],
      [P(STANCE, { af: -96, ef: -4, ab: 20, eb: -30, t: 20, lf: -40, kf: 40, lb: 30, kb: 8 }), 10],
      [P(STANCE, { af: -88, ef: -12, t: 14 }), 12],
      [STANCE, 6],
    ])),
  },
  {
    name: 'Aria Blast', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P',
    move: proj('aria', 10, 58, 'aria', A([
      [P(STANCE, { af: -40, ef: -100, ab: -40, eb: -100, t: -6, h: -12 }), 10],
      [P(STANCE, { af: -120, ef: -10, ab: -150, eb: -10, t: -16, h: -24, lb: 24, lf: -30 }), 18],
      [STANCE, 10],
    ])),
  },
  {
    name: 'Big Check Slam', cmd: [4, 6], btn: 'hp', text: 'B, F + HP',
    move: {
      id: 'checkslam', prop: 'check',
      anim: A([
        [P(STANCE, { af: -200, ef: -10, ab: -190, eb: -10, t: -14, h: -6 }), 10],
        [P(STANCE, { af: -80, ef: -4, ab: -72, eb: -6, t: 30, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 }), 5],
        [P(STANCE, { af: -55, ef: -4, ab: -50, eb: -6, t: 34, lf: -45, kf: 45, lb: 30, kb: 6 }), 14],
        [STANCE, 8],
      ]),
      active: [10, 16],
      vx: (fr) => (fr < 14 ? 2.4 : 0),
      hit: { limb: 'prop', r: 10, dmg: 105, level: 'overhead', effect: 'knockdown', push: 2.5, stun: 22, special: true },
      whoosh: true,
      onFrame: (self, f, fr) => {
        if (fr === 15 && self.hits > 0) {
          sfx.kaching();
          f.particles.sparks(self.opp.x, 60, 10, '#ffd040');
          cashRain(f, self.opp.x, 4);
        }
      },
    },
  },
];

/** Grand Finale: a sustained high note that rattles the victim until their head bursts, then it rains money. */
function grandFinale(f: Fight, w: Fighter, l: Fighter, t: number): boolean {
  w.poseOverride = t < 16 ? P(STANCE, { af: -60, ef: -110, ab: -60, eb: -110, t: 4 }) : P(VICTORY, { ab: -150, eb: -20, h: -26, t: -12 });
  if (t === 16) sfx.sing([[0, 1], [4, 1], [7, 1], [12, 2], [16, 2], [19, 8]], 0.18, 0.28);
  if (t >= 16 && t < 120) {
    if (t % 6 === 0) floatNote(f, w.x + w.facing * 10, 80, t > 80);
    const k = (t - 16) / 104;
    l.shake = 1 + Math.round(k * 4);
    l.tint = ['#a01010', k * 0.6];
    l.poseOverride = t % 10 < 5 ? P(DIZZY, { h: -20 }) : P(HIT_HIGH, { af: -150, ab: -140 });
    if (t === 70) sfx.scream();
  }
  if (t === 120) {
    const nx = l.wx(l.skel.neck[0]), ny = l.wy(l.skel.neck[1]);
    l.hidden.add('head');
    l.shake = 0;
    l.tint = null;
    f.particles.chunk(l.bones.head.img, l.bones.head.px, l.bones.head.py, nx, ny, w.facing * 1.4, 4, 0.3 * w.facing);
    f.particles.blood(nx, ny + 6, 1, 50, 1.8);
    f.particles.blood(nx, ny + 6, -1, 50, 1.8);
    f.shake(14);
    sfx.explode();
    sfx.blood();
  }
  if (t > 120 && t < 175) {
    const nx = l.wx(l.skel.neck[0]), ny = l.wy(l.skel.neck[1]);
    f.particles.blood(nx, ny + 2, rand(-1, 1), 3, 1.4);
  }
  if (t === 150) {
    l.poseOverride = null;
    l.setState('fall', FALL);
    l.vy = 1.5;
    l.y = 1;
    l.vx = -w.facing * 0.4;
  }
  if (t === 165) sfx.kaching();
  if (t >= 160 && t < 240 && t % 4 === 0) cashRain(f, l.x, 2);
  return t >= 320;
}

export function lumpsum(check = bigCheck()): CharDef {
  return {
    id: 'lumpsum', name: 'J.G. Spentworth', short: 'SPENTWORTH', title: 'The Payout Tenor', look: LUMPSUM_LOOK,
    alt: { ...LUMPSUM_LOOK, coat: '#f0ece0', coatTrim: '#1a1a22', pants: '#e0dcd0', shirt: '#1a1a22', bowtie: '#a01828', sash: '#a01828', hatColor: '#d8b040', hatTrim: '#f4f0e8', glove: '#1a1a22' },
    specials, voice: 130, props: { check },
    finisher: { name: 'Grand Finale', cmd: [2, 4, 6], btn: 'hp', text: 'D, B, F + HP (any range)', range: [0, 400] },
    fatality: grandFinale,
    quotes: [
      'IT IS YOUR MONEY, {L}, AND I JUST TOOK IT!',
      'CALL ME NOW, AND I WILL BEAT YOU AGAIN FOR FREE!',
      'STRUCTURED SETTLEMENT? MORE LIKE STRUCTURED BEATDOWN!',
      'HOLD THE NOTE... HOLD IT... AND YOU ARE DOWN.',
    ],
    quotesVs: { chuck: 'YOU NEVER BLINK? THEN WATCH ME CASH YOU OUT.' },
  };
}

// TODO: round-intro animation and voice line ("Your payments... are about to END!") once the intro hook lands.
