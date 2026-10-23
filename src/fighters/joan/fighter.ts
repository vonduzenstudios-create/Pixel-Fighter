import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import { sword } from '../../gfx/props';
import { throwProj } from '../kit';
import { JOAN_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Joan of Arc
const JOAN_LOOK: Look = {
  skin: '#f0c098', hair: '#5c3418', eye: '#2a4a8a', shirt: '#c0c4cc', pants: '#a8b0bc', boots: '#68707e',
  hairStyle: 'bob', glove: '#9aa2ae', armor: { metal: '#a8b0bc', tabard: '#2a3a8c', trim: '#e8c848' },
};
const joanSpecials: Special[] = [
  { name: 'Holy Flame', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('holy', 8, 52, 'fire') },
  {
    name: 'Banner Charge', cmd: [4, 6], btn: 'hk', text: 'B, F + HK',
    move: {
      id: 'charge', prop: 'sword',
      anim: A([
        [P(STANCE, { af: 30, ef: -100, t: -4 }), 6],
        [P(STANCE, { af: -88, ef: -2, ab: 20, t: 30, h: -10, lf: -50, kf: 50, lb: 40, kb: 10 }), 18],
        [P(STANCE, { af: -80, ef: -10, t: 16 }), 12],
      ]),
      active: [6, 24],
      vx: (fr) => (fr >= 6 && fr < 24 ? 4.8 : 0),
      hit: { limb: 'prop', r: 8, dmg: 100, level: 'mid', effect: 'knockdown', push: 2, stun: 20, special: true, sfx: 'slash' },
      whoosh: true,
    },
  },
  {
    name: 'Ascension Blade', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP',
    move: {
      id: 'ascend', prop: 'sword', air: true,
      anim: A([
        [P(CROUCH, { af: 30, ef: -60 }), 2],
        [P(STANCE, { af: -178, ef: -6, ab: 10, t: -8, h: -18, lf: -60, kf: 70, lb: 20, kb: 30 }), 16],
        [P(TUCK, { af: -150, ef: -30 }), 30],
      ]),
      active: [2, 16],
      hit: { limb: 'prop', r: 9, dmg: 110, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true, sfx: 'slash' },
      onFrame: (self, f, fr) => {
        if (fr === 1) {
          self.vy = 7.6;
          self.y = 1;
          self.vx = 1.1 * self.facing;
          f.sfx('fire');
        }
        if (fr > 1 && fr < 16) f.particles.fire(self.x + self.facing * 8, self.y + 70, 2, 3);
      },
    },
  },
];

export function joan(): CharDef {
  return {
    id: 'joan', name: 'Joan of Arc', short: 'JOAN', title: 'Maid of the Flame', look: JOAN_LOOK,
    alt: { ...JOAN_LOOK, hair: '#c8a040', armor: { metal: '#8a8a96', tabard: '#8a1a1a', trim: '#e8e8e8' }, pants: '#8a8a96' },
    specials: joanSpecials, voice: 260, props: { sword: sword() }, intro: JOAN_INTRO,
    quotes: [
      'THE VOICES TOLD ME YOU WOULD FALL. THEY WERE RIGHT.',
      'KNEEL, {L}. IT SUITS YOU.',
      'I HAVE FACED ARMIES. YOU WERE A LIGHT WARM-UP.',
      'GO WITH GOD. GO QUICKLY.',
    ],
    quotesVs: { tesla: 'I AM NOT AFRAID OF FIRE, AND I AM NOT AFRAID OF SPARKS.' },
    finisher: { name: 'Purifying Pyre', cmd: [6, 2, 6], btn: 'hk', text: 'F, D, F + HK (mid range)', range: [20, 180] },
  };
}
