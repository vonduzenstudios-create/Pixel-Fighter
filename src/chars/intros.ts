import { FLOOR } from '../core/consts';
import { rand } from '../core/rng';
import { pxLine } from '../gfx/painter';
import { A, P, STANCE, CROUCH, TUCK, VICTORY, LAND, WALK } from '../game/anims';
import type { Fighter } from '../game/fighter';
import { cashRain, floatNote } from '../fighters/lumpsum/fighter';
import { ease, lerp, offscreenX, type Intro } from '../game/intro';

// Round 1 entrances for the original four. Poses follow the conventions in gfx/rig.ts.

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

// ------------------------------------------------------------------ fighters added after the intro hook

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

/** Entrances by character id, for fighters whose CharDef lives in its own file. */
export const INTROS: Record<string, Intro> = {
  brucelee: BRUCE_LEE_INTRO,
  chuck: CHUCK_NORRIS_INTRO,
  ali: ALI_INTRO,
  lumpsum: LUMPSUM_INTRO,
  bobross: BOB_ROSS_INTRO,
};
