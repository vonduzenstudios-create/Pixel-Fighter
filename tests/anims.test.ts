import { describe, expect, it } from 'vitest';
import { animLength, blendPose, sample } from '../src/game/anims';
import * as MV from '../src/game/moves';

// The frame data of the shared normals. Animation polish must not change these by accident; when
// tuning on purpose, update the table here. Counted the way fighting games count, with the frame
// the button goes down as frame 1:
//   startup  = the first frame the attack can hit (active[0] + 2)
//   recovery = frames after the last active one before the fighter can act again
// The lights are 4-5 frames to hit and about 6 to recover, so they chain and are safe up close.
const DATA: Record<string, { len: number; startup: number; active: number; recovery: number }> = {
  jab: { len: 10, startup: 4, active: 3, recovery: 6 },
  cp: { len: 10, startup: 4, active: 3, recovery: 6 },
  lk: { len: 12, startup: 5, active: 4, recovery: 6 },
  ck: { len: 12, startup: 5, active: 4, recovery: 6 },
  hp: { len: 17, startup: 6, active: 4, recovery: 10 },
  hk: { len: 20, startup: 7, active: 6, recovery: 10 },
  chk: { len: 19, startup: 6, active: 6, recovery: 10 },
  roundhouse: { len: 26, startup: 7, active: 7, recovery: 15 },
  sweep: { len: 27, startup: 9, active: 8, recovery: 13 },
  uppercut: { len: 30, startup: 6, active: 9, recovery: 18 },
};

describe('shared animations', () => {
  it('keeps the frame data of the normal attacks', () => {
    for (const m of Object.values(MV)) {
      const d = DATA[m.id];
      if (!d || !m.active) continue;
      const len = animLength(m.anim);
      expect({ len, startup: m.active[0] + 2, active: m.active[1] - m.active[0], recovery: len + 1 - m.active[1] }, m.id).toEqual(d);
    }
  });
  it('keeps the jump attacks and throw', () => {
    expect(animLength(MV.JUMP_KICK.anim)).toBe(43);
    expect(animLength(MV.JUMP_PUNCH.anim)).toBe(43);
    expect(animLength(MV.THROW.anim)).toBe(36);
  });
  it('reaches the next key exactly at its frame', () => {
    const a = MV.JAB.anim;
    expect(sample(a, 2).af).toBeCloseTo(a.keys[2][0].af!);
  });
  it('blends spins the short way round', () => {
    expect(blendPose({ rot: 360 }, { rot: 0 }, 0.5).rot ?? 0).toBeCloseTo(0);
    expect(blendPose({ rot: -445 }, { rot: -80 }, 1).rot).toBeCloseTo(-80);
  });
});
