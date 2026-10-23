import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import { axe } from '../../gfx/props';
import { throwProj } from '../kit';
import { LINCOLN_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Abe Lincoln
const LINCOLN_LOOK: Look = {
  skin: '#dea676', hair: '#19141a', eye: '#3a2a20', shirt: '#e8e4dc', coat: '#1e1c26', tails: true,
  pants: '#2c2a34', boots: '#141016', hat: 'stovepipe', hairStyle: 'short', beard: 'chinstrap', bowtie: '#0a080c',
};
const lincolnSpecials: Special[] = [
  { name: 'Stovepipe Boomerang', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('hat', 8, 58, 'hatSpin') },
  {
    name: 'Rail Splitter', cmd: [4, 5, 4], btn: 'hp', text: 'B, B + HP',
    move: {
      id: 'railsplit', prop: 'axe',
      anim: A([
        [P(STANCE, { af: -205, ef: -10, ab: -195, eb: -10, t: -16, h: -8 }), 9],
        [P(STANCE, { af: -78, ef: -4, ab: -70, eb: -6, t: 32, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 }), 5],
        [P(STANCE, { af: -60, ef: -4, ab: -55, eb: -6, t: 36, lf: -45, kf: 45, lb: 30, kb: 6 }), 14],
        [STANCE, 8],
      ]),
      active: [9, 15],
      vx: (fr) => (fr < 12 ? 1.6 : 0),
      hit: { limb: 'prop', r: 9, dmg: 115, level: 'overhead', effect: 'knockdown', push: 2, stun: 22, special: true, sfx: 'slash' },
      whoosh: true,
    },
  },
  {
    name: 'Log Roll', cmd: [4, 6], btn: 'lk', text: 'B, F + LK',
    move: {
      id: 'logroll',
      anim: A([
        [P(TUCK, { rot: 0 }), 4],
        [P(TUCK, { rot: 180 }), 6], [P(TUCK, { rot: 360 }), 6], [P(TUCK, { rot: 540 }), 6], [P(TUCK, { rot: 720 }), 6],
        [P(CROUCH, {}), 6], [STANCE, 6],
      ]),
      active: [4, 28],
      vx: (fr) => (fr >= 4 && fr < 28 ? 4.3 : 0),
      hit: { limb: 'body', r: 13, dmg: 90, level: 'mid', effect: 'knockdown', push: 2, stun: 20, special: true },
      onFrame: (self, f, fr) => { if (fr === 4) f.sfx('roll'); },
    },
  },
];

export function lincoln(): CharDef {
  return {
    id: 'lincoln', name: 'Abe Lincoln', short: 'LINCOLN', title: 'The Rail Splitter', look: LINCOLN_LOOK,
    alt: { ...LINCOLN_LOOK, coat: '#4a2c1a', pants: '#3a2a1e', hatColor: '#4a2c1a', bowtie: '#7a1010' },
    specials: lincolnSpecials, voice: 110, props: { axe: axe() }, intro: LINCOLN_INTRO,
    quotes: [
      'FOUR SCORE AND SEVEN SECONDS AGO, YOU STILL HAD TEETH.',
      'A HOUSE DIVIDED CANNOT STAND. NEITHER, IT SEEMS, CAN YOU.',
      'I SPLIT RAILS TALLER THAN YOU BEFORE BREAKFAST.',
      'GO HOME, {L}. THE NATION NEEDS ITS FLOORS SWEPT.',
    ],
    quotesVs: { blackbeard: 'I HAVE FREED YOU OF YOUR FINAL TOOTH, PIRATE.' },
    portrait: { front: (p, c) => { if (!c.beaten) p.set(c.geom.mouth[0] - 6, c.geom.mouth[1] - 6, '#7a4a30'); } },
    finisher: { name: 'Emancipation Cleave', cmd: [6, 4, 6], btn: 'hp', text: 'F, B, F + HP (close)', range: [0, 90] },
  };
}
