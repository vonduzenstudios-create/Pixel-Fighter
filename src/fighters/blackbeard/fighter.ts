import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import { cutlass } from '../../gfx/props';
import { throwProj } from '../kit';
import { BLACKBEARD_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Blackbeard
const BEARD_LOOK: Look = {
  skin: '#c88858', hair: '#0e0c10', eye: '#1a1010', shirt: '#e0d8c8', coat: '#8c1a1c', coatTrim: '#d8b040',
  pants: '#3a2a20', boots: '#1a1210', tallBoots: true, hat: 'tricorn', hairStyle: 'long', beard: 'braided',
  beardRibbon: '#e02828', belt: '#3a2010', buckle: '#d8b040', bandolier: '#4a2a14',
};
const beardSpecials: Special[] = [
  { name: 'Cannon Volley', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('cannon', 9, 50, 'cannon') },
  {
    name: 'Powder Keg', cmd: [2, 1, 4], btn: 'lk', text: 'D, DB, B + LK',
    move: {
      ...throwProj('keg', 9, 8, 'roll'),
      anim: A([
        [P(STANCE, { af: 40, ef: -40, t: 10 }), 9],
        [P(CROUCH, { af: -60, ef: -5, t: 40 }), 10],
        [P(CROUCH, {}), 10],
        [STANCE, 6],
      ]),
    },
  },
  {
    name: 'Cutlass Cyclone', cmd: [2, 5, 2], btn: 'hk', mash: 'hk', text: 'MASH HK',
    move: {
      id: 'cyclone', prop: 'cutlass',
      anim: A([
        [P(STANCE, { af: -90, ef: -10, ab: -90, eb: -10, t: 0 }), 4],
        [P(STANCE, { af: -88, ef: 0, ab: -92, eb: 0, t: -4, h: -10, lf: -10, kf: 15, lb: 10, kb: 10 }), 36],
        [STANCE, 10],
      ]),
      spin: 4,
      active: [4, 40],
      vx: (fr) => (fr >= 4 && fr < 40 ? 2.2 : 0),
      hit: { limb: 'prop', r: 10, dmg: 26, level: 'mid', effect: 'light', push: 1.5, stun: 14, rehit: 8, special: true, sfx: 'slash' },
      onFrame: (self, f, fr) => { if (fr % 8 === 4 && fr < 40) f.sfx('whoosh'); },
    },
  },
];

export function blackbeard(): CharDef {
  return {
    id: 'blackbeard', name: 'Blackbeard', short: 'BLACKBEARD', title: 'Terror of the Seas', look: BEARD_LOOK,
    alt: { ...BEARD_LOOK, coat: '#1c3c2a', coatTrim: '#c0c0c8', pants: '#2a2a30', beardRibbon: '#20a0e0' },
    specials: beardSpecials, voice: 95, props: { cutlass: cutlass() }, intro: BLACKBEARD_INTRO,
    portrait: {
      front: (p, c) => {
        // the lit fuses tucked under his hat brim
        const pts = c.beaten ? [[22, 26], [82, 20]] : [[20, 34], [86, 30]];
        for (const [x, y] of pts) {
          p.line(x, y, x, y + 8, '#d0b890');
          p.set(x, y - 1, '#ffd040'), p.set(x, y - 2, '#ff6020'), p.set(x + 1, y - 3, '#a0a0a0');
        }
      },
    },
    finisher: { name: 'Powder Keg Surprise', cmd: [4, 4, 6], btn: 'lp', text: 'B, B, F + LP (close)', range: [0, 90] },
  };
}
