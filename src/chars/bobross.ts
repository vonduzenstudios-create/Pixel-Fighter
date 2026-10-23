import type { Look } from './build';
import { A, P, STANCE, CROUCH } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Special } from '../game/types';
import { Projectile } from '../game/projectile';
import { brush, paletteKnife, pineTree } from '../gfx/props';
import type { Part } from '../gfx/rig';
import { rand } from '../core/rng';
import { sfx } from '../audio/sfx';

// An original pixel caricature of the soft-spoken TV landscape painter: big curly perm,
// full beard, open-collar work shirt. Fights with paint, a fan brush and a palette knife.

const ROSS_LOOK: Look = {
  skin: '#e8b48a', hair: '#5a3a24', eye: '#3a2a1a', shirt: '#7aa0c8', pants: '#3a4a6a', boots: '#4a3020',
  hairStyle: 'perm', beard: 'full', openCollar: true, belt: '#3a2414', buckle: '#c8b070',
};

function paintThrow(at: number) {
  return {
    id: 'proj_paint', prop: 'brush' as const,
    anim: A([
      [P(STANCE, { af: 60, ef: -80, ab: -40, t: -6, h: -6 }), at],
      [P(STANCE, { af: -100, ef: -4, ab: 25, eb: -20, t: 20, lf: -40, kf: 40, lb: 30, kb: 8 }), 10],
      [P(STANCE, { af: -90, ef: -10, t: 14 }), 12],
      [STANCE, 6],
    ]),
    onFrame: (self: Fighter, f: Fight, fr: number) => {
      if (fr === at + 2) {
        f.projectiles.push(new Projectile(self, 'paint', self.x + self.facing * 26, 54));
        self.projOut = true;
        f.sfx('whoosh');
      }
    },
  };
}

const rossSpecials: Special[] = [
  { name: 'Paint Flick', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: paintThrow(8) },
  {
    // taps the brush on the deck and an evergreen bursts up under the opponent (block low)
    name: 'Sudden Evergreen', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K',
    move: {
      id: 'proj_tree', prop: 'brush',
      anim: A([
        [P(STANCE, { af: -150, ef: -30, t: -6, h: -8 }), 8],
        [P(CROUCH, { af: -40, ef: -10, t: 34, h: 6 }), 8],
        [P(CROUCH, { af: -40, ef: -10, t: 34, h: 6 }), 12],
        [STANCE, 8],
      ]),
      onFrame: (self, f, fr) => {
        if (fr === 9) {
          const dx = Math.max(30, Math.min(150, Math.abs(self.opp.x - self.x)));
          f.projectiles.push(new Projectile(self, 'tree', self.x + self.facing * dx, -40));
          self.projOut = true;
          f.particles.sparks(self.x + self.facing * 22, 2, 6, '#2e7a34');
        }
      },
    },
  },
  {
    name: 'Fan Brush Flurry', cmd: [4, 6], btn: 'hp', text: 'B, F + HP',
    move: {
      id: 'flurry', prop: 'brush',
      anim: A([
        [P(STANCE, { af: 20, ef: -110, t: -4 }), 5],
        [P(STANCE, { af: -120, ef: -10, t: 18, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
        [P(STANCE, { af: -60, ef: -10, t: 22, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
        [P(STANCE, { af: -120, ef: -10, t: 18, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
        [P(STANCE, { af: -60, ef: -10, t: 22, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
        [P(STANCE, { af: -120, ef: -10, t: 18, lf: -40, kf: 40, lb: 30, kb: 8 }), 4],
        [P(STANCE, { af: -70, ef: -20, t: 24, h: 4, lf: -40, kf: 40, lb: 30, kb: 8 }), 6],
        [STANCE, 10],
      ]),
      active: [5, 31],
      vx: (fr) => (fr >= 5 && fr < 27 ? 2.8 : 0),
      hit: { limb: 'prop', r: 9, dmg: 24, level: 'mid', effect: 'light', push: 1.4, stun: 14, rehit: 6, special: true },
      onFrame: (self, f, fr) => {
        if (fr >= 5 && fr < 31 && fr % 4 === 1) {
          f.sfx('whoosh');
          f.particles.sparks(self.x + self.facing * 30, rand(40, 70), 3, ['#2e7a34', '#f0c020', '#123c78'][fr % 3]);
        }
      },
    },
  },
];

let TREE: HTMLCanvasElement | null = null;

/** Palette Knife Landscape: one clean horizontal scrape, then he paints a little tree beside what is left. */
function rossFatality(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  const s = l.skel;
  if (tt < 18) {
    w.x += (l.x - w.facing * 28 - w.x) * 0.2;
    w.propOverride = w.ch.props.knife ?? null;
    w.poseOverride = P(STANCE, { af: 70, ef: -40, ab: -30, t: -10, h: -6 });
  }
  if (tt === 22) {
    w.poseOverride = P(STANCE, { af: -95, ef: -2, ab: 20, t: 22, h: 4, lf: -45, kf: 45, lb: 30, kb: 6 });
    sfx.slash();
    sfx.blood();
    fight.shake(10);
    D.hx = l.wx(s.hip[0]);
    D.hy = l.wy(s.hip[1]);
    // everything above the belt slides off
    for (const n of ['torso', 'head', 'armF', 'armB'] as const) l.hidden.add(n);
    const P2 = l.parts;
    const upper: [Part, [number, number]][] = [
      [P2.torso, s.hip], [P2.head, s.neck], [P2.uarm, s.shF], [P2.farm, s.elbowF], [P2.uarmB, s.shB], [P2.farmB, s.elbowB],
    ];
    for (const [part, at] of upper)
      ps.chunk(part.img, part.px, part.py, l.wx(at[0]), l.wy(at[1]), w.facing * rand(0.6, 2.2), rand(1.5, 3.5), rand(-0.25, 0.25) * w.facing);
    ps.blood(D.hx, D.hy, w.facing, 60, 1.6);
  }
  if (tt > 22 && tt < 150) {
    // fountain from the waist
    ps.blood(D.hx, D.hy, rand(-0.6, 0.6), 3, 1.7);
    if (tt % 18 === 0) sfx.blood();
  }
  if (tt === 60) {
    w.propOverride = w.ch.props.brush ?? null;
    sfx.scream();
  }
  if (tt >= 60 && tt < 120) {
    // gentle dabbing strokes
    w.poseOverride = P(STANCE, { af: tt % 16 < 8 ? -100 : -70, ef: -20, ab: -30, t: 6, h: -4 });
    if (tt % 8 === 0) {
      sfx.whoosh();
      ps.sparks(l.x + w.facing * 22, rand(10, 40), 3, '#2e7a34');
    }
  }
  if (tt === 120) {
    TREE ??= pineTree();
    ps.add({ kind: 'img', img: TREE, ix: 10, iy: 40, x: l.x + w.facing * 22, y: 0, life: 9999, max: 9999, grav: 0, floor: false });
    ps.sparks(l.x + w.facing * 22, 20, 20, '#9ad870');
    ps.sparks(l.x + w.facing * 22, 30, 10, '#ffffff');
    sfx.menuPick();
    w.poseOverride = P(STANCE, { af: -168, ef: -20, ab: 25, t: -5, h: -10 });
  }
  if (tt === 160) {
    // the legs finally give up
    const P2 = l.parts;
    const legs: [Part, [number, number]][] = [
      [P2.thigh, s.hipF], [P2.shin, s.kneeF], [P2.foot, s.ankleF], [P2.thighB, s.hipB], [P2.shinB, s.kneeB], [P2.footB, s.ankleB],
    ];
    for (const [part, at] of legs) ps.chunk(part.img, part.px, part.py, l.wx(at[0]), l.wy(at[1]), rand(-0.6, 0.6), rand(0.2, 0.8), rand(-0.2, 0.2));
    l.alpha = 0;
    sfx.thud();
  }
  return tt >= 290;
}

// Original lines for the round intro and win screens.
// TODO: hook these up once the intro-animation / voice-line and post-match screens land.
export const ROSS_LINES = {
  intro: ['Easy now. Nice, soft strokes.', "Let's mix up a little trouble."],
  win: ['There. Every landscape needs a dark spot.', 'You just needed a little more white.'],
};

export function bobRoss(): CharDef {
  return {
    id: 'bobross', name: 'Bob Ross', short: 'ROSS', title: 'The Gentle Brush', look: ROSS_LOOK,
    alt: { ...ROSS_LOOK, shirt: '#e8e0d0', pants: '#5a4a38', hair: '#8a6a44' },
    specials: rossSpecials, voice: 105, props: { brush: brush(), knife: paletteKnife() },
    finisher: { name: 'Palette Knife Landscape', cmd: [4, 6, 4, 6], btn: 'hp', text: 'B, F, B, F + HP (close)', range: [0, 70] },
    fatality: rossFatality,
    quotes: [
      'WE DO NOT MAKE MISTAKES. YOU JUST HAD A HAPPY LITTLE ACCIDENT.',
      'LET US PUT A HAPPY LITTLE BRUISE RIGHT THERE.',
      'EVERY PAINTING NEEDS A LITTLE DARK, {L}. TODAY THAT WAS YOU.',
      'BEAT THE DEVIL OUT OF IT. THERE, ALL CLEAN.',
    ],
    quotesVs: { lumpsum: 'TAKE YOUR TIME. THERE IS NO PAYOUT FOR RUSHING.' },
  };
}
