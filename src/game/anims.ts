import type { Pose } from '../gfx/rig';
import { lerpPose } from '../gfx/rig';
import type { Anim } from './types';

export const P = (base: Pose, o: Pose = {}): Pose => ({ ...base, ...o });
export const A = (keys: [Pose, number][], loop = false): Anim => ({ keys, loop });

const ease = (t: number) => t * t * (3 - 2 * t);

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
    const [pose, d] = a.keys[i];
    if (f < acc + d) {
      const next = a.keys[i + 1] ?? (a.loop ? a.keys[0] : null);
      if (!next) return pose;
      return lerpPose(pose, next[0], ease((f - acc) / d));
    }
    acc += d;
  }
  return a.keys[a.keys.length - 1][0];
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

export const IDLE = A([[STANCE, 22], [STANCE2, 22]], true);
export const WALK = A(
  [
    [P(STANCE, { lf: -30, kf: 20, lb: 22, kb: 10 }), 6],
    [P(STANCE, { lf: -5, kf: 25, lb: 5, kb: 30, t: 10 }), 6],
    [P(STANCE, { lf: 20, kf: 10, lb: -25, kb: 25 }), 6],
    [P(STANCE, { lf: 5, kf: 35, lb: -5, kb: 15, t: 10 }), 6],
  ],
  true,
);
export const CROUCH_ANIM = A([[P(STANCE, { t: 16, lf: -50, kf: 80, lb: -25, kb: 70 }), 3], [CROUCH, 1]]);
export const PREJUMP = A([[P(CROUCH, { t: 10 }), 4]]);
export const JUMP_UP = A([[P(STANCE, { lf: -10, kf: 10, lb: 5, kb: 10, af: -100, ab: -90 }), 6], [TUCK, 10], [TUCK, 12], [P(STANCE, { lf: -20, kf: 25 }), 10]]);
export const FLIP = (dir: number) =>
  A([
    [P(TUCK, { rot: 0 }), 4],
    [P(TUCK, { rot: 120 * dir }), 8],
    [P(TUCK, { rot: 240 * dir }), 8],
    [P(TUCK, { rot: 360 * dir }), 8],
    [P(STANCE, { lf: -25, kf: 30 }), 10],
  ]);
export const LAND = A([[P(CROUCH, { t: 14, lb: -40, kb: 90, lf: -60, kf: 100 }), 5]]);
export const BLOCK_ANIM = A([[BLOCK, 1]]);
export const CBLOCK_ANIM = A([[CBLOCK, 1]]);
export const HITSTUN_HIGH = A([[HIT_HIGH, 6], [P(HIT_HIGH, { t: -16 }), 8], [STANCE, 8]]);
export const HITSTUN_MID = A([[HIT_MID, 6], [P(HIT_MID, { t: 26 }), 8], [STANCE, 8]]);
export const HITSTUN_CROUCH = A([[HIT_CROUCH, 6], [CROUCH, 10]]);
export const FALL = A([[P(LAUNCHED, { rot: -20 }), 8], [P(LAUNCHED, { rot: -70 }), 12], [P(LIE, { rot: -85 }), 10]]);
export const TUMBLE = A([[P(LAUNCHED, { rot: 0 }), 6], [P(LAUNCHED, { rot: -120 }), 12], [P(LAUNCHED, { rot: -240 }), 12], [P(LIE, { rot: -360 - 85 }), 14]]);
export const LIE_ANIM = A([[LIE, 1]]);
export const BOUNCE = A([[P(LIE, { rot: -80, t: 10, lf: -30, kf: 20 }), 5], [LIE, 6]]);
export const GETUP = A([
  [LIE, 4],
  [{ rot: -30, t: 10, h: 0, lf: -95, kf: 110, lb: -80, kb: 120, af: 10, ef: -20, ab: 20, eb: -10 }, 8],
  [CROUCH, 8],
  [STANCE, 6],
]);
export const DIZZY_ANIM = A([[DIZZY, 26], [P(DIZZY, { t: 12, h: 35, rx: 2, af: 18, ab: 10 }), 26]], true);
export const VICTORY_ANIM = A([[P(STANCE, { t: 0 }), 8], [VICTORY, 10], [P(VICTORY, { ef: -40, t: -8 }), 30], [VICTORY, 30]]);
export const THROWN = A([[P(LAUNCHED, { rot: 0 }), 1]]);
export const CROUCH_IDLE = A([[CROUCH, 1]]);
