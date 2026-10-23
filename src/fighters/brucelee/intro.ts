import { P, STANCE, LAND } from '../../game/anims';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const FLY_KICK = P(STANCE, { t: -14, h: -6, lf: -95, kf: 0, ff: -10, lb: 30, kb: 100, af: -40, ef: -100, ab: 20, eb: -60 });
const NUNCHAKU_GUARD = P(STANCE, { t: 4, h: -6, af: -80, ef: -40, ab: -40, eb: -110, lf: -30, kf: 20 });

export const BRUCE_LEE_INTRO: Intro = {
  line: 'Your guard is a door. I brought the key.',
  speech: { pitch: 1.1, rate: 1.1 },
  speakAt: 72,
  dur: 140,
  update(self, f, t, home) {
    if (t <= 26) {
      // flying side kick in from off screen
      const k = t / 26;
      self.x = lerp(offscreenX(self, f), home, k);
      self.y = Math.sin(k * Math.PI) * 46;
      self.poseOverride = FLY_KICK;
      if (t === 0) f.sfx('kiai', 360);
    } else if (t < 34) {
      self.y = 0;
      self.poseOverride = null;
      if (t === 27) {
        self.setAnim(LAND);
        f.sfx('land');
      }
    } else if (t < 66) {
      // nunchaku twirl
      self.propOverride = self.ch.props.nunchaku ?? null;
      const a = (t - 34) * 0.7;
      self.poseOverride = P(NUNCHAKU_GUARD, { af: -110 + Math.sin(a) * 60, ef: -30 + Math.cos(a) * 30, pa: (t * 47) % 360 });
      if (t % 6 === 0) f.sfx('whoosh');
    } else {
      self.propOverride = self.ch.props.nunchaku ?? null;
      // nunchaku tucked under the arm, the back hand beckons
      self.poseOverride = P(NUNCHAKU_GUARD, { ab: -80, eb: t % 30 < 15 ? -150 : -110 });
    }
  },
};
