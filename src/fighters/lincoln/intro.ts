import { A, P, STANCE, WALK } from '../../game/anims';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const AXE_SHOULDER = { af: -165, ef: -95, ab: -30, eb: -100 };
const AXE_UP = P(STANCE, { af: -205, ef: -10, ab: -195, eb: -10, t: -16, h: -8 });
const AXE_DOWN = P(STANCE, { af: -70, ef: -4, ab: -64, eb: -6, t: 34, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 });
const AXE_REST = P(STANCE, { t: 2, h: -8, af: -45, ef: -10, ab: -40, eb: -20 });

export const LINCOLN_INTRO: Intro = {
  line: 'Honest Abe never pulls a punch.',
  speech: { pitch: 0.55, rate: 0.85 },
  speakAt: 76,
  dur: 140,
  update(self, f, t, home) {
    self.propOverride = self.ch.props.axe ?? null;
    if (t <= 48) {
      // stride in with the axe on his shoulder
      self.x = lerp(offscreenX(self, f), home, t / 48);
      self.poseOverride = null;
      if (t === 0) self.setAnim(A(WALK.keys.map(([p, d]) => [P(p, AXE_SHOULDER), d]), true));
    } else if (t < 62) {
      self.poseOverride = P(AXE_UP);
    } else if (t < 100) {
      self.poseOverride = AXE_DOWN;
      if (t === 62) {
        f.sfx('slash');
        f.sfx('thud');
        f.shake(5);
        f.particles.sparks(self.x + self.facing * 30, 2, 12);
        f.particles.smoke(self.x + self.facing * 30, 2, 4, '#6a5a50');
      }
    } else self.poseOverride = AXE_REST;
  },
};
