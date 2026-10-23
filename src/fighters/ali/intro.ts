import { P, STANCE } from '../../game/anims';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const GUARD_UP = P(STANCE, { t: 4, h: -6, af: -70, ef: -120, ab: -60, eb: -125 });

export const ALI_INTRO: Intro = {
  line: 'Step into my ring!',
  speech: { pitch: 1.0, rate: 1.15 },
  speakAt: 70,
  dur: 130,
  update(self, f, t, home) {
    if (t <= 44) {
      // dances in on his toes
      self.x = lerp(offscreenX(self, f), home, t / 44);
      self.y = Math.abs(Math.sin(t * 0.35)) * 5;
      self.poseOverride = P(GUARD_UP, t % 12 < 6 ? { lf: -30, kf: 30, lb: 10, kb: 20 } : { lf: -10, kf: 20, lb: 25, kb: 30 });
    } else if (t < 70) {
      // shadow-boxing: quick jab, jab, cross
      self.y = Math.abs(Math.sin(t * 0.35)) * 3;
      const k = (t - 44) % 8;
      const cross = Math.floor((t - 44) / 8) % 3 === 2;
      self.poseOverride = k < 4 ? (cross ? P(GUARD_UP, { ab: -92, eb: -4, t: 14 }) : P(GUARD_UP, { af: -92, ef: -4, t: 8 })) : GUARD_UP;
      if (k === 0) f.sfx('whoosh');
    } else {
      self.y = Math.abs(Math.sin(t * 0.35)) * 3;
      self.poseOverride = P(GUARD_UP, { af: -150, ef: -40, h: -14 });
      if (t === 70) f.sfx('bell');
    }
  },
};
