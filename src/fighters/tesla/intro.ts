import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { pxLine } from '../../gfx/painter';
import { P, STANCE, CROUCH } from '../../game/anims';
import { type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const ARMS_UP = P(STANCE, { t: -10, h: -14, af: -160, ef: -30, ab: -150, eb: -30, lf: -26, kf: 10, lb: 24, kb: 4 });

export const TESLA_INTRO: Intro = {
  line: 'Stand back. Science is about to happen.',
  speech: { pitch: 1.0, rate: 1.05 },
  speakAt: 66,
  dur: 140,
  update(self, f, t, home) {
    self.x = home;
    if (t < 34) {
      // a charge builds where he will appear
      self.alpha = 0;
      if (t % 2 === 0) f.particles.zap(home + rand(-10, 10), rand(0, 80), 2);
      if (t % 8 === 0) f.sfx('zap', 0.12);
    } else if (t === 34) {
      self.alpha = 1;
      f.sfx('teleport');
      f.sfx('zap', 0.4);
      f.particles.zap(home, 40, 30);
      f.particles.sparks(home, 40, 20, '#c0e0ff');
      f.shake(4);
      self.poseOverride = CROUCH;
    } else if (t < 50) {
      self.poseOverride = P(CROUCH, { af: -150, ef: -20, ab: -140 });
    } else {
      self.poseOverride = t % 6 < 3 ? ARMS_UP : P(ARMS_UP, { af: -150, ab: -158, h: -18 });
      if (t % 3 === 0) {
        const hx = self.wx(self.skel.handF[0]), hy = self.wy(self.skel.handF[1]);
        f.particles.zap(hx + rand(-4, 4), hy + rand(0, 6), 2);
      }
      if (t % 16 === 0) f.sfx('zap', 0.1);
    }
  },
  draw(ctx, self, f, t, cam) {
    // the arrival bolt from the sky
    if (t < 30 || t > 40) return;
    ctx.fillStyle = t % 2 ? '#ffffff' : '#a0d0ff';
    let x = self.x - cam, y = 0;
    while (y < FLOOR - 4) {
      const nx = self.x - cam + rand(-8, 8), ny = y + rand(10, 22);
      pxLine(ctx, x, y, nx, Math.min(ny, FLOOR - 4), 2);
      x = nx;
      y = ny;
    }
  },
};
