import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import { nunchaku } from '../../gfx/props';
import { BRUCE_LEE_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Bruce Lee
const LEE_LOOK: Look = {
  skin: '#e0b088', hair: '#100c10', eye: '#1a1010', shirt: '#e0b088', pants: '#16141c', boots: '#0c0a0e',
  hairStyle: 'mop', bareChest: true, sash: '#c8a030', wraps: '#e8e0d0',
};
// Nunchaku spin: the arm circles overhead while the free stick whips round the fist.
const spinKeys: [ReturnType<typeof P>, number][] = [];
for (let i = 0; i < 8; i++) spinKeys.push([P(STANCE, { af: i % 2 ? -150 : -110, ef: -30, ab: -20, eb: -90, t: 2, pa: 150 * (i + 1) }), 4]);
const leeSpecials: Special[] = [
  {
    name: "Dragon's Inch", cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P',
    move: {
      id: 'inchpunch',
      anim: A([
        [P(STANCE, { af: -70, ef: -80, ab: -30, eb: -110, t: 4, h: -4 }), 8],
        [P(STANCE, { af: -92, ef: -2, ab: -20, eb: -120, t: 24, h: -8, lf: -42, kf: 40, lb: 26, kb: 6 }), 6],
        [P(STANCE, { af: -90, ef: -4, ab: -20, eb: -120, t: 22, h: -6, lf: -42, kf: 40, lb: 26, kb: 6 }), 10],
        [STANCE, 8],
      ]),
      active: [8, 13],
      vx: (fr) => (fr >= 6 && fr < 10 ? 3 : 0),
      hit: { limb: 'handF', r: 7, dmg: 95, level: 'mid', effect: 'knockdown', push: 4, stun: 22, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 7) f.sfx('kiai', 340);
        if (fr === 9) f.particles.sparks(self.x + self.facing * 30, 52, 5, '#fff2c0');
      },
    },
  },
  {
    name: 'Soaring Dragon Kick', cmd: [6, 2, 3], btn: 'k', text: 'F, D, DF + K',
    move: {
      id: 'dragonkick', air: true,
      anim: A([
        [P(CROUCH, { t: 20 }), 3],
        [P(TUCK, { t: -28, h: 16, lf: -96, kf: -2, ff: -20, lb: -40, kb: 120, af: -40, ef: -80, ab: 30, eb: -40 }), 30],
        [TUCK, 20],
      ]),
      active: [4, 26],
      hit: { limb: 'toeF', r: 7, dmg: 105, level: 'high', effect: 'knockdown', push: 3, stun: 22, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 2) {
          self.vy = 5.4;
          self.y = 1;
          self.vx = 3.6 * self.facing;
          f.sfx('kiai', 380);
        }
      },
    },
  },
  {
    name: 'Nunchaku Storm', cmd: [4, 6], btn: 'hp', mash: 'hp', text: 'MASH HP',
    move: {
      id: 'nunchaku', prop: 'nunchaku',
      anim: A([
        [P(STANCE, { af: -120, ef: -40, ab: -20, eb: -90, pa: 0 }), 4],
        ...spinKeys,
        [P(STANCE, { af: -84, ef: -6, ab: -20, eb: -90, t: 18, pa: 1260 }), 6],
        [STANCE, 8],
      ]),
      active: [4, 40],
      vx: (fr) => (fr >= 4 && fr < 36 ? 0.9 : 0),
      hit: { limb: 'prop', r: 9, dmg: 28, level: 'mid', effect: 'light', push: 1.4, stun: 15, rehit: 7, special: true },
      onFrame: (_self, f, fr) => { if (fr % 6 === 4 && fr < 36) f.sfx('whoosh'); },
    },
  },
];

export function bruceLee(): CharDef {
  return {
    intro: BRUCE_LEE_INTRO,
    // TODO: a detailed winner/loser portrait once the portrait API lands on main. Entrance: ./intro.ts.
    id: 'brucelee', name: 'Bruce Lee', short: 'BRUCE LEE', title: 'The Little Dragon', look: LEE_LOOK,
    alt: { ...LEE_LOOK, pants: '#e4e0d4', boots: '#d8d4c8', sash: '#b01818', wraps: '#2a2a30' },
    specials: leeSpecials, voice: 180, props: { nunchaku: nunchaku() },
    quotes: [
      'BE LIKE WATER. YOU WERE MORE LIKE A PUDDLE.',
      'BOARDS DO NOT HIT BACK. NEITHER, IT TURNS OUT, DO YOU.',
      'I FEAR THE MAN WHO PRACTISED ONE KICK TEN THOUSAND TIMES. NOT YOU, {L}.',
    ],
    finisher: { name: 'Hundred-Fist Finale', cmd: [4, 6, 4], btn: 'lp', text: 'B, F, B + LP (close)', range: [0, 90] },
  };
}
