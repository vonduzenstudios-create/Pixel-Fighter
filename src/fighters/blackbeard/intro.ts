import { FLOOR } from '../../core/consts';
import { pxLine } from '../../gfx/painter';
import { P, STANCE, CROUCH, TUCK } from '../../game/anims';
import type { Fighter } from '../../game/fighter';
import { ease, offscreenX, type Intro } from '../../game/intro';

// Round 1 entrance. Poses follow the conventions in gfx/rig.ts.
const ROPE_TOP = 250;
const rope = new WeakMap<Fighter, { a0: number; a: number; home: number; landed: boolean }>();
const ROPE_LEN = 236;
const HANG = P(STANCE, { t: -6, h: -10, af: -172, ef: -6, ab: -40, eb: -60, lf: -50, kf: 60, lb: 10, kb: 50 });
const DRAW_CUTLASS = P(STANCE, { t: 4, af: -95, ef: -4, ab: 30, eb: -80, lf: -30, kf: 20, lb: 20, kb: 6 });

export const BLACKBEARD_INTRO: Intro = {
  line: 'Har har! Yer gold and yer teeth be mine!',
  speech: { pitch: 0.25, rate: 0.8 },
  speakAt: 70,
  dur: 150,
  update(self, f, t, home) {
    if (t === 0) {
      const dx = offscreenX(self, f) - home;
      rope.set(self, { a0: Math.asin(Math.max(-0.9, Math.min(0.9, dx / ROPE_LEN))), a: 0, home, landed: false });
      self.propOverride = null;
    }
    const D = rope.get(self)!;
    if (t <= 30) {
      // swing down on a rope from the rigging above, letting go over his mark
      const a = D.a0 * Math.cos((t / 30) * (Math.PI / 2));
      D.a = a;
      self.x = home + Math.sin(a) * ROPE_LEN;
      self.y = Math.max(0, ROPE_TOP - Math.cos(a) * ROPE_LEN - 40) + 14;
      self.poseOverride = HANG;
      if (t === 0) f.sfx('whoosh', 1);
    } else if (t < 38) {
      self.y = Math.max(0, self.y - 4);
      self.poseOverride = TUCK;
      if (self.y === 0 && !D.landed) {
        D.landed = true;
        f.sfx('land');
        f.particles.smoke(home, 1, 4, '#6a5a50');
      }
    } else if (t < 54) {
      self.y = 0;
      self.poseOverride = P(CROUCH, { t: 20 });
    } else {
      self.propOverride = self.ch.props.cutlass ?? null;
      self.poseOverride = DRAW_CUTLASS;
      if (t === 54) f.sfx('slash');
      if (t > 54 && t < 66) self.poseOverride = P(DRAW_CUTLASS, { af: -95 - (66 - t) * 6 });
    }
  },
  draw(ctx, self, f, t, cam) {
    // the rope, attached high above the screen; it swings away once he lets go
    const D = rope.get(self);
    if (!D || t > 46) return;
    let hx: number, hy: number;
    if (t <= 30) {
      hx = self.wx(self.skel.handF[0]);
      hy = self.wy(self.skel.handF[1]);
    } else {
      const a = -D.a0 * ease((t - 30) / 16);
      hx = D.home + Math.sin(a) * ROPE_LEN;
      hy = ROPE_TOP - Math.cos(a) * ROPE_LEN + 40;
    }
    ctx.fillStyle = '#8a6a40';
    pxLine(ctx, D.home - cam, FLOOR - ROPE_TOP, hx - cam, FLOOR - hy);
  },
};
