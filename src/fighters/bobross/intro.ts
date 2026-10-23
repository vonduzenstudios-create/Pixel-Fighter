import { P, STANCE, WALK } from '../../game/anims';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const PAINT_COLORS = ['#2a6ae0', '#f0d020', '#e03020', '#30a040', '#ffffff'];

export const BOB_ROSS_INTRO: Intro = {
  line: 'Easy now. Nice, soft strokes.',
  speech: { pitch: 0.75, rate: 0.75 },
  speakAt: 86,
  dur: 160,
  update(self, f, t, home) {
    self.propOverride = self.ch.props.brush ?? null;
    if (t <= 60) {
      // an unhurried stroll
      if (t === 0) self.setAnim(WALK);
      self.x = lerp(offscreenX(self, f), home, t / 60);
      self.poseOverride = null;
    } else {
      // dabs a happy little cloud in the air
      const a = (t - 60) * 0.12;
      self.poseOverride = P(STANCE, { t: -4, h: -6, af: -115 + Math.sin(a) * 18, ef: -35 + Math.cos(a * 2) * 15, ab: -50, eb: -90 });
      if (t % 3 === 0) {
        const hx = self.wx(self.skel.handF[0]), hy = self.wy(self.skel.handF[1]);
        f.particles.sparks(hx + self.facing * 10, hy + 6, 1, PAINT_COLORS[Math.floor(t / 12) % PAINT_COLORS.length]);
      }
      if (t === 64 || t === 130) f.sfx('twinkle');
    }
  },
};
