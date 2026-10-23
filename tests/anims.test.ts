import { describe, expect, it } from 'vitest';
import { animLength, blendPose, sample } from '../src/game/anims';
import * as MV from '../src/game/moves';

// Animation polish must not change gameplay: these are the frame counts the normals shipped with.
const LENGTHS: Record<string, number> = {
  jab: 14, hp: 19, lk: 18, hk: 24, roundhouse: 26, sweep: 27, cp: 14, ck: 18, chk: 22, uppercut: 30, jk: 43, jp: 43, throw: 36,
};

describe('shared animations', () => {
  it('keeps the frame data of the normal attacks', () => {
    for (const m of Object.values(MV)) if (LENGTHS[m.id]) expect(animLength(m.anim), m.id).toBe(LENGTHS[m.id]);
  });
  it('reaches the next key exactly at its frame', () => {
    const a = MV.JAB.anim;
    expect(sample(a, 3).af).toBeCloseTo(a.keys[2][0].af!);
  });
  it('blends spins the short way round', () => {
    expect(blendPose({ rot: 360 }, { rot: 0 }, 0.5).rot ?? 0).toBeCloseTo(0);
    expect(blendPose({ rot: -445 }, { rot: -80 }, 1).rot).toBeCloseTo(-80);
  });
});
