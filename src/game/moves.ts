import { A, P, STANCE, CROUCH, TUCK } from './anims';
import type { Move } from './types';

// Normal attacks shared by every fighter. Frame data loosely follows 16-bit era fighters:
// quick jabs, slower heavy hits, and an uppercut that launches.

export const JAB: Move = {
  id: 'jab',
  anim: A([[P(STANCE, { af: -70, ef: -70, t: 10 }), 3], [P(STANCE, { af: -88, ef: -4, t: 14, h: -6 }), 5], [STANCE, 6]]),
  active: [3, 6],
  hit: { limb: 'handF', r: 5, dmg: 30, level: 'high', effect: 'light', push: 2.5, stun: 13 },
  whoosh: true,
};
export const HIGH_PUNCH: Move = {
  id: 'hp',
  anim: A([[P(STANCE, { af: -55, ef: -115, t: 4 }), 4], [P(STANCE, { af: -102, ef: -4, t: 20, h: -10, rx: 3, ab: -20, eb: -80 }), 6], [STANCE, 9]]),
  active: [4, 8],
  hit: { limb: 'handF', r: 5, dmg: 50, level: 'high', effect: 'heavy', push: 3.5, stun: 17 },
  whoosh: true,
};
export const LOW_KICK: Move = {
  id: 'lk',
  anim: A([[P(STANCE, { lf: -60, kf: 75, t: -2 }), 4], [P(STANCE, { lf: -86, kf: 0, ff: 6, t: -12, ab: -20, af: -40 }), 6], [STANCE, 8]]),
  active: [4, 9],
  hit: { limb: 'toeF', r: 5, dmg: 45, level: 'mid', effect: 'light', push: 3, stun: 14 },
  whoosh: true,
};
export const HIGH_KICK: Move = {
  id: 'hk',
  anim: A([[P(STANCE, { lf: -85, kf: 100, t: -10 }), 6], [P(STANCE, { lf: -132, kf: -4, ff: -40, t: -30, h: 12, af: -20, ef: -60, ab: 30, lb: 10, kb: 0 }), 7], [STANCE, 11]]),
  active: [6, 12],
  hit: { limb: 'toeF', r: 6, dmg: 60, level: 'high', effect: 'heavy', push: 4, stun: 18 },
  whoosh: true,
};
export const ROUNDHOUSE: Move = {
  id: 'roundhouse',
  anim: A([
    [P(STANCE, { t: 25, lb: -30, kb: 90, af: -20, ab: -60 }), 6],
    [P(STANCE, { lb: -128, kb: -4, fb: -40, t: -36, h: 10, af: -10, ef: -40, ab: 10, lf: 6, kf: 4 }), 8],
    [STANCE, 12],
  ]),
  active: [6, 13],
  hit: { limb: 'toeB', r: 7, dmg: 85, level: 'high', effect: 'launch', lift: [5.6, 3.4], push: 3, stun: 20, sfx: 'heavy' },
  whoosh: true,
};
const CR = (o = {}) => P(CROUCH, o);
export const SWEEP: Move = {
  id: 'sweep',
  crouch: true,
  anim: A([
    [CR({ t: 40, ab: 10, eb: -10, af: -10, ef: -20 }), 5],
    [CR({ t: 45, ab: 15, eb: -5, af: -5, ef: -10, lf: -76, kf: 4, ff: 20, lb: -60, kb: 140 }), 9],
    [CROUCH, 10],
  ]),
  active: [5, 13],
  hit: { limb: 'toeF', r: 6, dmg: 65, level: 'low', effect: 'sweep', push: 2, stun: 20 },
  whoosh: true,
};
export const CROUCH_PUNCH: Move = {
  id: 'cp',
  crouch: true,
  anim: A([[CR({ af: -70, ef: -70 }), 3], [CR({ af: -88, ef: -5, t: 30 }), 5], [CROUCH, 6]]),
  active: [3, 7],
  hit: { limb: 'handF', r: 5, dmg: 30, level: 'mid', effect: 'light', push: 2.5, stun: 13 },
};
export const CROUCH_KICK: Move = {
  id: 'ck',
  crouch: true,
  anim: A([[CR({ lf: -60, kf: 90 }), 4], [CR({ lf: -72, kf: 2, ff: 22, lb: -60, kb: 140, t: 20 }), 6], [CROUCH, 8]]),
  active: [4, 9],
  hit: { limb: 'toeF', r: 5, dmg: 40, level: 'low', effect: 'light', push: 2.5, stun: 14 },
};
export const CROUCH_HIGH_KICK: Move = {
  id: 'chk',
  crouch: true,
  anim: A([
    [CR({ lf: -70, kf: 110, t: 30 }), 5],
    [CR({ lf: -112, kf: 4, ff: -30, lb: -60, kb: 140, t: 40, h: -4, af: -40, ab: 10 }), 7],
    [CROUCH, 10],
  ]),
  active: [5, 11],
  hit: { limb: 'toeF', r: 6, dmg: 55, level: 'mid', effect: 'heavy', push: 3.5, stun: 17 },
  whoosh: true,
};
export const UPPERCUT: Move = {
  id: 'uppercut',
  crouch: true,
  anim: A([
    [CR({ af: 40, ef: -110, t: 30 }), 6],
    [P(STANCE, { t: -10, h: -16, af: -176, ef: -16, ab: 10, eb: -60, lf: -14, kf: 14, lb: 18, kb: 8 }), 8],
    [P(STANCE, { t: -6, af: -170, ef: -30 }), 8],
    [STANCE, 8],
  ]),
  active: [6, 14],
  hit: { limb: 'handF', r: 7, dmg: 120, level: 'mid', effect: 'launch', lift: [8.4, 1.1], push: 2, stun: 30, sfx: 'heavy' },
  whoosh: true,
};
export const JUMP_KICK: Move = {
  id: 'jk',
  air: true,
  anim: A([[P(TUCK, { lf: -60, kf: 70 }), 3], [P(TUCK, { t: -12, lf: -76, kf: 4, ff: 12, lb: 30, kb: 100, af: -60, ef: -90 }), 40]]),
  active: [3, 22],
  hit: { limb: 'toeF', r: 6, dmg: 65, level: 'overhead', effect: 'heavy', push: 3, stun: 18 },
  whoosh: true,
};
export const JUMP_PUNCH: Move = {
  id: 'jp',
  air: true,
  anim: A([[P(TUCK, { af: -30, ef: -90 }), 3], [P(TUCK, { t: 22, af: -55, ef: -5, lf: -60, kf: 90 }), 40]]),
  active: [3, 20],
  hit: { limb: 'handF', r: 6, dmg: 55, level: 'overhead', effect: 'heavy', push: 3, stun: 18 },
  whoosh: true,
};
// Judo throw: grabs the opponent and flips them over to the thrower's back side.
export const THROW: Move = {
  id: 'throw',
  anim: A([
    [P(STANCE, { af: -85, ef: -15, ab: -80, eb: -20, t: 15 }), 6],
    [P(STANCE, { t: -10, h: -10, af: -150, ef: -20, ab: -150, eb: -20 }), 10],
    [P(STANCE, { t: -30, h: -20, af: -200, ef: -20, ab: -190, eb: -20, lb: 15, lf: -10 }), 10],
    [STANCE, 10],
  ]),
};
export const WHIFF_THROW: Move = {
  id: 'whiff',
  anim: A([[P(STANCE, { af: -85, ef: -15, ab: -80, eb: -20, t: 18 }), 8], [STANCE, 8]]),
};
