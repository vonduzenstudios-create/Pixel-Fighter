import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import { throwProj } from '../kit';
import { TESLA_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Nikola Tesla
const TESLA_LOOK: Look = {
  skin: '#e8b890', hair: '#141018', eye: '#2a2a3a', shirt: '#ecebf2', coat: '#28304a', pants: '#232838', boots: '#121218',
  hairStyle: 'slick', mustache: true, necktie: '#7a1a2a', coil: true, glove: '#d8d4cc',
};
const teslaSpecials: Special[] = [
  { name: 'Coil Bolt', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('bolt', 7, 54, 'zap') },
  {
    name: 'Wireless Step', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K',
    move: {
      id: 'teleport',
      anim: A([
        [P(CROUCH, { af: -150, ef: -20, ab: -140 }), 8],
        [P(CROUCH, {}), 14],
        [P(STANCE, { lf: -85, kf: 100, t: -10 }), 3],
        [P(STANCE, { lf: -132, kf: -4, ff: -40, t: -30, h: 12, af: -20, ef: -60, ab: 30 }), 9],
        [STANCE, 10],
      ]),
      invisible: [8, 22],
      active: [25, 33],
      hit: { limb: 'toeF', r: 7, dmg: 85, level: 'high', effect: 'knockdown', push: 2, stun: 20, special: true },
      onFrame: (self, f, fr) => {
        if (fr === 2) f.sfx('teleport');
        if (fr < 8) f.particles.zap(self.x, 30, 2);
        if (fr === 15) {
          const o = self.opp;
          const side = o.x >= self.x ? 1 : -1;
          self.x = Math.max(20, Math.min(492, o.x + side * 30));
          self.facing = o.x > self.x ? 1 : -1;
          f.sfx('teleport');
        }
        if (fr >= 18 && fr < 22) f.particles.zap(self.x, 30, 3);
      },
    },
  },
  {
    name: 'Alternating Field', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP',
    move: {
      id: 'acfield',
      anim: A([
        [P(STANCE, { af: -100, ef: -60, ab: -100, eb: -60, t: 4 }), 6],
        [P(STANCE, { af: -60, ef: -30, ab: -125, eb: -30, t: -10, h: -10 }), 15],
        [P(STANCE, { af: -55, ef: -35, ab: -120, eb: -35, t: -12, h: -6 }), 15],
        [STANCE, 10],
      ]),
      active: [6, 36],
      hit: { limb: 'body', r: 24, dmg: 32, level: 'mid', effect: 'light', push: 1.2, stun: 16, rehit: 9, special: true, sfx: 'zap' },
      onFrame: (self, f, fr) => {
        if (fr === 6) f.sfx('zap');
        if (fr >= 6 && fr < 36) f.particles.zap(self.x + self.facing * 4, 44, 4);
      },
    },
  },
];

export function tesla(): CharDef {
  return {
    id: 'tesla', name: 'Nikola Tesla', short: 'TESLA', title: 'Wizard of Current', look: TESLA_LOOK,
    alt: { ...TESLA_LOOK, coat: '#3e2a46', pants: '#2c2232', necktie: '#d0a020', glove: '#2a2a2a' },
    specials: teslaSpecials, voice: 140, props: {}, intro: TESLA_INTRO,
    quotes: [
      'YOUR RESISTANCE WAS LOW. MY CURRENT WAS NOT.',
      'I SAW THIS DEFEAT IN A VISION. IT WAS FUNNIER IN PERSON.',
      'ALTERNATING BLOWS, {L}. YOU ONLY BLOCKED THE FIRST ONE.',
      'EVEN A PIGEON PUTS UP A BETTER FIGHT.',
    ],
    quotesVs: { lincoln: 'A FINE HAT, MR PRESIDENT. A SHAME IT CONDUCTS SO WELL.' },
    portrait: {
      front: (p, c) => {
        // static crackling off the hair
        if (c.beaten) for (const [x, y] of [[30, 18], [44, 12], [62, 13]]) p.line(x, y, x + 3, y - 4, '#a0e0ff'), p.line(x + 3, y - 4, x + 1, y - 7, '#e0f8ff');
      },
    },
    finisher: { name: 'Grand Discharge', cmd: [2, 6, 2], btn: 'lp', text: 'D, F, D + LP (any range)', range: [0, 400] },
  };
}
