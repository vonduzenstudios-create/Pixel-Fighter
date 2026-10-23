import { P, STANCE } from '../../game/anims';
import { cashRain, floatNote } from './fighter';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const CHECK_HIGH = P(STANCE, { t: -6, h: -10, af: -165, ef: -10, ab: -150, eb: -30 });

export const LUMPSUM_INTRO: Intro = {
  line: 'Your payments are about to END!',
  speech: { pitch: 1.25, rate: 0.9 },
  speakAt: 68,
  dur: 140,
  update(self, f, t, home) {
    self.propOverride = self.ch.props.check ?? null;
    if (t <= 48) {
      // marches in holding the big check over his head
      self.x = lerp(offscreenX(self, f), home, t / 48);
      const w = t % 24 < 12;
      self.poseOverride = P(CHECK_HIGH, w ? { lf: -25, kf: 15, lb: 20, kb: 25 } : { lf: 15, kf: 25, lb: -20, kb: 15 });
    } else {
      self.poseOverride = P(CHECK_HIGH, { af: -175, h: -16 });
      if (t === 49) {
        f.sfx('kaching');
        f.sfx('sing');
      }
      if (t < 120 && t % 4 === 0) cashRain(f, home, 1);
      if (t % 10 === 0) floatNote(f, self.x + self.facing * 6, 74, t % 20 === 0);
    }
  },
};
