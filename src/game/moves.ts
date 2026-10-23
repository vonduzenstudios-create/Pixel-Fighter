import { A, P, STANCE, CROUCH, TUCK } from './anims';
import type { Move } from './types';

// Normal attacks shared by every fighter. Frame data loosely follows 16-bit era fighters:
// quick jabs, slower heavy hits, and an uppercut that launches.

export const JAB: Move = {
  id: 'jab',
  anim: A([
    [P(STANCE, { af: -52, ef: -118, t: 6, h: -2, ab: -40, eb: -110 }), 2, 'out'],
    [P(STANCE, { af: -91, ef: -2, t: 16, h: -7, rx: 2, ab: -30, eb: -122 }), 1, 'lin'],
    [P(STANCE, { af: -88, ef: -6, t: 14, h: -6, rx: 1, ab: -30, eb: -120 }), 3],
    [P(STANCE, { af: -68, ef: -76, t: 11 }), 3, 'out'],
    [STANCE, 5],
  ]),
  active: [3, 6],
  hit: { limb: 'handF', r: 5, dmg: 30, level: 'high', effect: 'light', push: 2.5, stun: 13 },
  whoosh: true,
};
export const HIGH_PUNCH: Move = {
  id: 'hp',
  anim: A([
    [P(STANCE, { af: -38, ef: -132, t: -2, h: 2, rx: -1, ab: -45, eb: -110 }), 2],
    [P(STANCE, { af: -30, ef: -140, t: -6, h: 4, rx: -2, ab: -50, eb: -105, lf: -18, kf: 18 }), 1, 'lin'],
    [P(STANCE, { af: -94, ef: -26, t: 16, h: -8, rx: 2, ab: -28, eb: -90 }), 1, 'lin'],
    [P(STANCE, { af: -104, ef: -2, t: 22, h: -10, rx: 4, ab: -12, eb: -70, lf: -28, kf: 26, lb: 24, kb: 6 }), 4],
    [P(STANCE, { af: -100, ef: -10, t: 20, h: -8, rx: 3, ab: -16, eb: -76, lf: -28, kf: 26, lb: 24, kb: 6 }), 3, 'out'],
    [P(STANCE, { af: -70, ef: -96, t: 13, h: -6 }), 4],
    [STANCE, 4],
  ]),
  active: [4, 8],
  hit: { limb: 'handF', r: 5, dmg: 50, level: 'high', effect: 'heavy', push: 3.5, stun: 17 },
  whoosh: true,
};
export const LOW_KICK: Move = {
  id: 'lk',
  anim: A([
    [P(STANCE, { lf: -70, kf: 98, ff: 12, t: -4, ab: -40, af: -50 }), 3, 'in'],
    [P(STANCE, { lf: -82, kf: 30, ff: 20, t: -10, ab: -32, af: -44 }), 1, 'lin'],
    [P(STANCE, { lf: -88, kf: 0, ff: 8, t: -14, h: 4, ab: -24, eb: -100, af: -36, ef: -90 }), 5],
    [P(STANCE, { lf: -62, kf: 82, ff: 10, t: -6 }), 3, 'out'],
    [STANCE, 6],
  ]),
  active: [4, 9],
  hit: { limb: 'toeF', r: 5, dmg: 45, level: 'mid', effect: 'light', push: 3, stun: 14 },
  whoosh: true,
};
export const HIGH_KICK: Move = {
  id: 'hk',
  anim: A([
    [P(STANCE, { t: -4, lf: -40, kf: 62, lb: 12, kb: 10, af: -50, ef: -110 }), 2, 'in'],
    [P(STANCE, { lf: -96, kf: 122, ff: 22, t: -14, h: 6, af: -30, ef: -80, ab: 10, eb: -60 }), 3, 'in'],
    [P(STANCE, { lf: -120, kf: 42, ff: -8, t: -24, h: 10, af: -24, ef: -66, ab: 24, eb: -40, lb: 10, kb: 0 }), 1, 'lin'],
    [P(STANCE, { lf: -132, kf: -4, ff: -40, t: -30, h: 12, af: -20, ef: -60, ab: 30, lb: 10, kb: 0 }), 5],
    [P(STANCE, { lf: -127, kf: 10, ff: -30, t: -28, h: 10, af: -20, ef: -60, ab: 28, lb: 10, kb: 0 }), 2, 'out'],
    [P(STANCE, { lf: -82, kf: 102, ff: 16, t: -12, h: 4 }), 4],
    [STANCE, 7],
  ]),
  active: [6, 12],
  hit: { limb: 'toeF', r: 6, dmg: 60, level: 'high', effect: 'heavy', push: 4, stun: 18 },
  whoosh: true,
};
// Spinning heel kick: chamber the back leg, whip it up through head height, follow through.
export const ROUNDHOUSE: Move = {
  id: 'roundhouse',
  anim: A([
    [P(STANCE, { t: 30, h: 6, lb: -95, kb: 125, fb: 20, af: -20, ef: -60, ab: -90, eb: -40, lf: -10, kf: 14 }), 5, 'in'],
    [P(STANCE, { t: -40, h: 18, lb: -112, kb: -4, fb: -35, af: 25, ef: -25, ab: -150, eb: -15, lf: 12, kf: 2, ff: 15 }), 4, 'lin'],
    [P(STANCE, { t: -52, h: 22, lb: -138, kb: -8, fb: -40, af: 40, ef: -20, ab: -165, eb: -10, lf: 16, kf: 0, ff: 20 }), 4, 'out'],
    [P(STANCE, { t: 22, h: -6, lb: -40, kb: 70, af: -40, ef: -80, ab: -60, eb: -60 }), 4],
    [P(STANCE, { t: 14, h: -4, lb: -4, kb: 36, af: -54, ef: -90 }), 3],
    [STANCE, 6],
  ]),
  active: [5, 12],
  vx: (fr) => (fr < 10 ? 1.1 : 0),
  hit: { limb: 'toeB', r: 7, dmg: 85, level: 'high', effect: 'launch', lift: [5.6, 3.4], push: 3, stun: 20, sfx: 'heavy' },
  whoosh: true,
};
const CR = (o = {}) => P(CROUCH, o);
// Hand-planted leg sweep: drop low, then scythe the back leg along the floor from behind to the front.
export const SWEEP: Move = {
  id: 'sweep',
  crouch: true,
  anim: A([
    [CR({ t: 55, h: -28, af: -20, ef: -8, ab: -100, eb: -60, lb: -110, kb: 150, lf: 20, kf: 120, ff: 30 }), 4, 'in'],
    [CR({ t: 40, h: -20, af: -30, ef: -20, ab: 10, eb: -20, lb: -110, kb: 150, lf: 84, kf: 2, ff: 80 }), 2, 'lin'],
    [CR({ t: 30, h: -14, af: -45, ef: -30, ab: 20, eb: -15, lb: -108, kb: 150, lf: -10, kf: 140, ff: 30 }), 2, 'out'],
    [CR({ t: 18, h: -6, af: -60, ef: -40, ab: 35, eb: -10, lb: -105, kb: 150, fb: 20, lf: -88, kf: 0, ff: -10 }), 4],
    [CR({ t: 22, h: -8, af: -60, ef: -40, ab: 30, eb: -12, lb: -105, kb: 150, fb: 20, lf: -84, kf: 8, ff: -6 }), 3, 'out'],
    [CR({ t: 40, lf: -60, kf: 110 }), 6],
    [CROUCH, 6],
  ]),
  active: [7, 15],
  hit: { limb: 'toeF', r: 7, dmg: 65, level: 'low', effect: 'sweep', push: 2, stun: 20 },
  whoosh: true,
};
export const CROUCH_PUNCH: Move = {
  id: 'cp',
  crouch: true,
  anim: A([[CR({ af: -60, ef: -100, t: 22 }), 2, 'out'], [CR({ af: -90, ef: -2, t: 32, rx: 1 }), 1, 'lin'], [CR({ af: -88, ef: -5, t: 30 }), 4], [CR({ af: -72, ef: -80 }), 3, 'out'], [CROUCH, 4]]),
  active: [3, 7],
  hit: { limb: 'handF', r: 5, dmg: 30, level: 'mid', effect: 'light', push: 2.5, stun: 13 },
};
export const CROUCH_KICK: Move = {
  id: 'ck',
  crouch: true,
  anim: A([[CR({ lf: -60, kf: 92 }), 3, 'in'], [CR({ lf: -70, kf: 30, ff: 18, lb: -60, kb: 140, t: 18 }), 1, 'lin'], [CR({ lf: -72, kf: 2, ff: 22, lb: -60, kb: 140, t: 20 }), 5], [CR({ lf: -66, kf: 70, t: 10 }), 3, 'out'], [CROUCH, 6]]),
  active: [4, 9],
  hit: { limb: 'toeF', r: 5, dmg: 40, level: 'low', effect: 'light', push: 2.5, stun: 14 },
};
export const CROUCH_HIGH_KICK: Move = {
  id: 'chk',
  crouch: true,
  anim: A([
    [CR({ lf: -70, kf: 112, t: 30 }), 4, 'in'],
    [CR({ lf: -98, kf: 50, ff: -10, lb: -60, kb: 140, t: 36, h: -2, af: -40, ab: 10 }), 1, 'lin'],
    [CR({ lf: -112, kf: 4, ff: -30, lb: -60, kb: 140, t: 40, h: -4, af: -40, ab: 10 }), 5],
    [CR({ lf: -108, kf: 14, ff: -24, lb: -60, kb: 140, t: 38, h: -4, af: -40, ab: 10 }), 2, 'out'],
    [CR({ lf: -76, kf: 96, t: 30 }), 4],
    [CROUCH, 6],
  ]),
  active: [5, 11],
  hit: { limb: 'toeF', r: 6, dmg: 55, level: 'mid', effect: 'heavy', push: 3.5, stun: 17 },
  whoosh: true,
};
// Rising uppercut: coil low with the fist at the hip, then drive it up through the opponent's chin.
export const UPPERCUT: Move = {
  id: 'uppercut',
  crouch: true,
  anim: A([
    [CR({ t: 36, h: -8, af: 30, ef: -110, ab: -70, eb: -80 }), 4, 'in'],
    [P(STANCE, { t: 26, h: -6, af: -70, ef: -75, ab: -20, eb: -70, lf: -45, kf: 70, lb: 10, kb: 20 }), 3, 'lin'],
    [P(STANCE, { t: 4, h: -14, af: -125, ef: -40, ab: 10, eb: -60, lf: -55, kf: 80, lb: 14, kb: 4, fb: 35 }), 4, 'out'],
    [P(STANCE, { t: -14, h: -22, af: -165, ef: -12, ab: 20, eb: -50, lf: -60, kf: 90, lb: 16, kb: 2, fb: 45 }), 8],
    [P(STANCE, { t: 10, af: -100, ef: -60 }), 6],
    [STANCE, 5],
  ]),
  active: [4, 13],
  hit: { limb: 'handF', r: 8, dmg: 120, level: 'mid', effect: 'launch', lift: [8.4, 1.1], push: 2, stun: 30, sfx: 'heavy' },
  whoosh: true,
};
export const JUMP_KICK: Move = {
  id: 'jk',
  air: true,
  anim: A([[P(TUCK, { lf: -60, kf: 70 }), 3, 'out'], [P(TUCK, { t: -12, lf: -76, kf: 4, ff: 12, lb: 30, kb: 100, af: -60, ef: -90 }), 40]]),
  active: [3, 22],
  hit: { limb: 'toeF', r: 6, dmg: 65, level: 'overhead', effect: 'heavy', push: 3, stun: 18 },
  whoosh: true,
};
export const JUMP_PUNCH: Move = {
  id: 'jp',
  air: true,
  anim: A([[P(TUCK, { af: -30, ef: -90 }), 3, 'out'], [P(TUCK, { t: 22, af: -55, ef: -5, lf: -60, kf: 90 }), 40]]),
  active: [3, 20],
  hit: { limb: 'handF', r: 6, dmg: 55, level: 'overhead', effect: 'heavy', push: 3, stun: 18 },
  whoosh: true,
};
// Judo throw: grabs the opponent and flips them over to the thrower's back side.
export const THROW: Move = {
  id: 'throw',
  anim: A([
    [P(STANCE, { af: -85, ef: -15, ab: -80, eb: -20, t: 15 }), 6, 'in'],
    [P(STANCE, { t: -10, h: -10, af: -150, ef: -20, ab: -150, eb: -20 }), 10, 'lin'],
    [P(STANCE, { t: -30, h: -20, af: -200, ef: -20, ab: -190, eb: -20, lb: 15, lf: -10 }), 10],
    [STANCE, 10],
  ]),
};
export const WHIFF_THROW: Move = {
  id: 'whiff',
  anim: A([[P(STANCE, { af: -85, ef: -15, ab: -80, eb: -20, t: 18 }), 8], [STANCE, 8]]),
};
