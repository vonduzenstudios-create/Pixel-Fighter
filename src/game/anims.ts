import type { Pose } from '../gfx/rig';
import { lerpPose } from '../gfx/rig';
import type { Anim, Ease } from './types';

export const P = (base: Pose, o: Pose = {}): Pose => ({ ...base, ...o });
export const A = (keys: [Pose, number, Ease?][], loop = false, blend?: number): Anim => ({ keys, loop, blend });

export const EASE: Record<Ease, (t: number) => number> = {
  smooth: (t) => t * t * (3 - 2 * t),
  lin: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t) * (1 - t),
  hold: () => 0,
};

export function animLength(a: Anim) {
  let n = 0;
  for (const k of a.keys) n += k[1];
  return n;
}

/** Pose at frame f, eased between keyframes. Non-looping anims hold the last key. */
export function sample(a: Anim, f: number): Pose {
  const len = animLength(a);
  if (a.loop && len > 0) f = ((f % len) + len) % len;
  let acc = 0;
  for (let i = 0; i < a.keys.length; i++) {
    const [pose, d, e] = a.keys[i];
    if (f < acc + d) {
      const next = a.keys[i + 1] ?? (a.loop ? a.keys[0] : null);
      if (!next) return pose;
      return lerpPose(pose, next[0], EASE[e ?? 'smooth']((f - acc) / d));
    }
    acc += d;
  }
  return a.keys[a.keys.length - 1][0];
}

/**
 * Cross-fade from the pose a fighter was in to the first frames of a new anim, so state changes
 * (walk to idle, landing, recovering from a hit) flow instead of popping. Whole-body spins are
 * wrapped to the nearest turn so a finished flip does not unwind.
 */
export function blendPose(from: Pose, to: Pose, k: number): Pose {
  let r = from.rot ?? 0;
  const tr = to.rot ?? 0;
  while (r - tr > 180) r -= 360;
  while (r - tr < -180) r += 360;
  return lerpPose({ ...from, rot: r }, to, EASE.smooth(k));
}

// ---------- Shared poses (facing right). See gfx/rig.ts for the angle conventions. ----------
export const STANCE: Pose = { t: 8, h: -4, ab: -35, eb: -105, af: -60, ef: -95, lb: 18, kb: 4, lf: -22, kf: 22 };
export const STANCE2: Pose = P(STANCE, { t: 11, h: -2, ab: -38, eb: -100, af: -56, ef: -100 });
export const CROUCH: Pose = { t: 26, h: -16, ab: -50, eb: -105, af: -75, ef: -95, lb: -55, kb: 120, lf: -80, kf: 135 };
export const TUCK: Pose = { t: 12, h: -6, ab: -50, eb: -120, af: -80, ef: -120, lb: -60, kb: 125, lf: -95, kf: 115 };
export const BLOCK: Pose = P(STANCE, { t: -4, h: 6, af: -35, ef: -145, ab: -25, eb: -150 });
export const CBLOCK: Pose = P(CROUCH, { t: 14, af: -35, ef: -150, ab: -25, eb: -150 });
export const HIT_HIGH: Pose = P(STANCE, { t: -24, h: -28, af: 25, ef: -40, ab: 35, eb: -30, lf: -12, kf: 12 });
export const HIT_MID: Pose = P(STANCE, { t: 34, h: 25, af: -25, ef: -25, ab: -10, eb: -30, lf: -10, kf: 25, lb: 15, kb: 10 });
export const HIT_CROUCH: Pose = P(CROUCH, { t: 5, h: -25, af: 10, ef: -40, ab: 20, eb: -30 });
export const LIE: Pose = { rot: -90, t: 0, h: -5, af: 30, ef: -10, ab: 5, eb: -10, lf: -6, kf: 6, lb: 4, kb: 4, ff: 0, fb: 0 };
export const LAUNCHED: Pose = { t: -20, h: -35, af: -160, ef: -20, ab: -130, eb: -30, lf: -25, kf: 50, lb: 15, kb: 60 };
export const DIZZY: Pose = { t: -4, h: 25, af: 10, ef: -20, ab: 22, eb: -15, lf: -14, kf: 24, lb: 14, kb: 8 };
export const VICTORY: Pose = { t: -5, h: -10, af: -168, ef: -20, ab: 25, eb: -60, lf: -12, kf: 6, lb: 10, kb: 5 };

// Idle: a springy fighting-game bounce. Knees dip and the guard trails a beat behind the body.
const BOB_DOWN: Pose = P(STANCE, { t: 10, lf: -25, kf: 29, lb: 15, kb: 11 });
const BOB_LOW: Pose = P(STANCE, { t: 12, h: -2, lf: -28, kf: 37, lb: 12, kb: 19, ab: -38, eb: -100, af: -56, ef: -100 });
const BOB_UP: Pose = P(BOB_DOWN, { ab: -38, eb: -100, af: -56, ef: -100 });
export const IDLE = A([[STANCE, 9], [BOB_DOWN, 9], [BOB_LOW, 9], [BOB_UP, 9]], true);

// Walk: contact, down, passing and up for each leg. A stride covers about as much ground as the
// fighter moves in that time, so the feet plant instead of skating. The guard sways with the hips.
const W = (o: Pose): Pose => P(STANCE, o);
const WALK_KEYS: [Pose, number, Ease?][] = [
  [W({ lf: -30, kf: 12, ff: -6, lb: 22, kb: 20, fb: 16, t: 9 }), 4],
  [W({ lf: -22, kf: 26, lb: 18, kb: 32, fb: 10, t: 12, h: -2, af: -56, ab: -32 }), 4],
  [W({ lf: -2, kf: 22, lb: -8, kb: 58, fb: 20, t: 10 }), 4],
  [W({ lf: 12, kf: 14, ff: 12, lb: -24, kb: 32, t: 7, h: -5, af: -63, ab: -38 }), 4],
  [W({ lb: -28, kb: 12, fb: -6, lf: 20, kf: 20, ff: 16, t: 9 }), 4],
  [W({ lb: -20, kb: 26, lf: 16, kf: 32, ff: 10, t: 12, h: -2, af: -56, ab: -32 }), 4],
  [W({ lb: 0, kb: 22, lf: -10, kf: 58, ff: 20, t: 10 }), 4],
  [W({ lb: 12, kb: 14, fb: 12, lf: -26, kf: 32, t: 7, h: -5, af: -63, ab: -38 }), 4],
];
export const WALK = A(WALK_KEYS, true, 5);
/** Walking away (played in reverse): leaning back with the guard up high. */
export const WALK_B = A(WALK_KEYS.map(([p, d]) => [P(p, { t: (p.t ?? 0) - 6, h: (p.h ?? 0) + 2, af: -50, ef: -112, ab: -30, eb: -118 }), d]), true, 5);
export const CROUCH_ANIM = A([[P(STANCE, { t: 16, lf: -50, kf: 80, lb: -25, kb: 70 }), 3, 'out'], [CROUCH, 1]], false, 2);
/** Coiled squat before take-off. */
export const PREJUMP = A([[P(CROUCH, { t: 14, h: -4, af: -50, ab: -40 }), 2, 'out'], [P(CROUCH, { t: 18, h: -6, lb: -60, kb: 130, lf: -85, kf: 140, af: -40, ab: -30 }), 2]], false, 2);
// Take-off stretch (legs straight, toes pointed), tuck at the peak, then legs reach for the floor.
const LAUNCH: Pose = P(STANCE, { t: 2, h: -6, lf: -12, kf: 6, ff: 40, lb: 8, kb: 6, fb: 45, af: -120, ef: -40, ab: -100, eb: -60 });
export const JUMP_UP = A([
  [LAUNCH, 5, 'out'],
  [P(TUCK, { t: 8 }), 8],
  [TUCK, 10],
  [P(TUCK, { lf: -50, kf: 70, lb: -30, kb: 80 }), 6],
  [P(STANCE, { lf: -24, kf: 32, lb: 12, kb: 18, ff: 20, fb: 25, af: -70, ab: -50 }), 9],
], false, 2);
// Flips spin at a steady rate (lin) so the somersault doesn't stutter between keys.
export const FLIP = (dir: number) =>
  A([
    [P(LAUNCH, { t: 14 }), 4, 'in'],
    [P(TUCK, { rot: 30 * dir }), 6, 'lin'],
    [P(TUCK, { rot: 150 * dir }), 7, 'lin'],
    [P(TUCK, { rot: 270 * dir }), 7, 'out'],
    [P(TUCK, { rot: 360 * dir, lf: -55, kf: 75, lb: -35, kb: 85 }), 5],
    [P(STANCE, { lf: -26, kf: 34, lb: 12, kb: 18, ff: 20, fb: 25 }), 9],
  ], false, 2);
/** Squash on touch-down, then spring back up into the stance. */
export const LAND = A([[P(CROUCH, { t: 18, h: -6, lb: -48, kb: 100, lf: -66, kf: 112, af: -50, ab: -45 }), 2, 'lin'], [P(CROUCH, { t: 14, lb: -40, kb: 90, lf: -60, kf: 100 }), 3, 'out'], [P(STANCE, { t: 12, lf: -30, kf: 40, lb: 6, kb: 24 }), 2]], false, 1);
export const BLOCK_ANIM = A([[BLOCK, 1]], false, 2);
export const CBLOCK_ANIM = A([[CBLOCK, 1]], false, 2);
/** Blockstun: the guard gets shoved back, then settles. */
export const BLOCKSTUN = A([[P(BLOCK, { t: -10, h: 10, rx: -2 }), 4, 'out'], [BLOCK, 1]], false, 0);
export const CBLOCKSTUN = A([[P(CBLOCK, { t: 6, h: 6, rx: -2 }), 4, 'out'], [CBLOCK, 1]], false, 0);
// Hit reactions snap straight into the recoil (no blend) and ease back out of it.
export const HITSTUN_HIGH = A([[P(HIT_HIGH, { t: -30, h: -34, rx: -2 }), 2, 'out'], [HIT_HIGH, 5], [P(HIT_HIGH, { t: -14, h: -18 }), 7], [STANCE, 8]], false, 0);
export const HITSTUN_MID = A([[P(HIT_MID, { t: 40, h: 30, rx: -2 }), 2, 'out'], [HIT_MID, 5], [P(HIT_MID, { t: 24 }), 7], [STANCE, 8]], false, 0);
export const HITSTUN_CROUCH = A([[P(HIT_CROUCH, { t: 0, h: -30 }), 2, 'out'], [HIT_CROUCH, 5], [CROUCH, 10]], false, 0);
export const FALL = A([[P(LAUNCHED, { rot: -20 }), 8], [P(LAUNCHED, { rot: -70 }), 12, 'in'], [P(LIE, { rot: -85 }), 10]], false, 0);
export const TUMBLE = A([[P(LAUNCHED, { rot: 0 }), 6, 'lin'], [P(LAUNCHED, { rot: -120 }), 12, 'lin'], [P(LAUNCHED, { rot: -240 }), 12, 'out'], [P(LIE, { rot: -360 - 85 }), 14]], false, 0);
export const LIE_ANIM = A([[LIE, 1]]);
export const BOUNCE = A([[P(LIE, { rot: -80, t: 10, lf: -30, kf: 20 }), 3, 'out'], [P(LIE, { rot: -88, lf: -10, kf: 10 }), 3], [LIE, 6]], false, 1);
export const GETUP = A([
  [LIE, 2],
  [{ rot: -30, t: 10, h: 0, lf: -95, kf: 110, lb: -80, kb: 120, af: 10, ef: -20, ab: 20, eb: -10 }, 6, 'out'],
  [CROUCH, 5],
  [P(STANCE, { t: 14, lf: -30, kf: 42, lb: 8, kb: 26 }), 3],
  [STANCE, 2],
]);
export const DIZZY_ANIM = A([[DIZZY, 26], [P(DIZZY, { t: 12, h: 35, rx: 2, af: 18, ab: 10 }), 26]], true);
export const VICTORY_ANIM = A([[P(STANCE, { t: 0 }), 8], [VICTORY, 10], [P(VICTORY, { ef: -40, t: -8 }), 30], [VICTORY, 30]]);
export const THROWN = A([[P(LAUNCHED, { rot: 0 }), 1]], false, 0);
export const CROUCH_IDLE = A([[CROUCH, 1]], false, 3);
