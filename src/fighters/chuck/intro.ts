import { P, STANCE, CROUCH } from '../../game/anims';
import { type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const ARMS_CROSSED = P(STANCE, { t: -2, h: -4, af: -30, ef: -110, ab: -35, eb: -105, lf: -16, kf: 6, lb: 16, kb: 4 });

export const CHUCK_NORRIS_INTRO: Intro = {
  line: 'I came here to finish. Fighting is optional.',
  speech: { pitch: 0.4, rate: 0.8 },
  speakAt: 66,
  dur: 140,
  update(self, f, t, home) {
    self.x = home;
    if (t < 24) {
      // drops straight out of the sky
      self.y = Math.max(0, 260 * (1 - (t / 24) ** 2));
      self.poseOverride = P(STANCE, { lf: -30, kf: 40, lb: 10, kb: 30, af: -60, ef: -80, ab: -50, eb: -80 });
      if (t === 0) f.sfx('whoosh', 1);
    } else if (t < 44) {
      self.y = 0;
      self.poseOverride = P(CROUCH, { t: 30, af: -20, ef: -20, ab: 10 });
      if (t === 24) {
        f.sfx('thud');
        f.sfx('boom');
        f.shake(12);
        for (const s of [-1, 1]) f.particles.smoke(home + s * 12, 1, 8, '#8a8078');
        f.particles.sparks(home, 1, 14);
      }
    } else self.poseOverride = ARMS_CROSSED;
  },
};
