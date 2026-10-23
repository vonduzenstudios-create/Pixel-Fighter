import { rand } from '../../core/rng';
import { P, STANCE, TUCK, VICTORY, LAND } from '../../game/anims';
import { ease, lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const SWORD_HIGH = P(VICTORY, { af: -178, ef: -4, pa: 0 });

export const JOAN_INTRO: Intro = {
  line: 'Heaven sent me. You will not like the message.',
  speech: { pitch: 1.35, rate: 1.0, female: true },
  speakAt: 66,
  dur: 140,
  update(self, f, t, home) {
    self.propOverride = null;
    if (t <= 32) {
      // leap in from off screen with a forward somersault
      const k = t / 32;
      self.x = lerp(offscreenX(self, f), home, k);
      self.y = Math.sin(k * Math.PI) * 70;
      self.poseOverride = k < 0.85 ? P(TUCK, { rot: 360 * ease(k / 0.85) }) : P(STANCE, { lf: -25, kf: 30 });
      if (t === 0) f.sfx('jump');
    } else if (t < 42) {
      self.y = 0;
      self.poseOverride = null;
      if (t === 33) {
        self.setAnim(LAND);
        f.sfx('land');
        f.particles.smoke(home - 6, 1, 3, '#8a8078');
        f.particles.smoke(home + 6, 1, 3, '#8a8078');
      }
    } else {
      self.propOverride = self.ch.props.sword ?? null;
      self.poseOverride = SWORD_HIGH;
      if (t === 44) f.sfx('fire');
      if (t > 44 && t < 120) {
        const tip = self.skel.handF;
        f.particles.fire(self.wx(tip[0]), self.wy(tip[1]) + 30, 1, 2);
        if (t % 3 === 0) f.particles.fire(home + rand(-14, 14), 0, 1, 2);
      }
    }
  },
};
