import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { playCue } from '../../audio/specials';
import { drawDrumstick, drawGrease } from './fighter';

/** Frames a grease puddle keeps burning after it lands. */
const GREASE_BURN = 70;

export const PROJECTILES: Record<string, ProjDef> = {
  drumstick: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 4.4 },
    sounds: { launch: 'cluck', travel: { every: 12, cue: 'flutter' }, impact: ['crunch', 'splat'], blocked: 'crunch' },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 4 === 0)
        p.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 6, y: pr.y, vx: -pr.vx * 0.1, vy: 0.4, grav: 0.1, life: 20, max: 20, color: pr.t % 8 ? '#c47422' : '#eaa848' });
    },
    draw(ctx, pr, sx, sy) {
      drawDrumstick(ctx, pr.t, pr.vx);
    },
  },
  grease: {
    // lobbed in an arc (vy set by the thrower), then burns on the floor where it lands
    stats: { dmg: 75, level: 'mid', effect: 'heavy', r: 7, speed: 2.6 },
    sounds: { launch: 'sizzle', impact: ['sizzle', 'flameBurst'], blocked: 'sizzle' },
    update(pr, f) {
      const p = f.particles;
      if (!pr.landed) {
        pr.vy -= 0.2;
        if (pr.t % 2 === 0) p.add({ kind: 'spark', x: pr.x, y: pr.y, vx: 0, vy: 0, grav: 0.1, life: 12, max: 12, color: '#e8a830' });
        if (pr.y + pr.vy <= 3) {
          // splat: a burning puddle that has to be blocked low
          pr.landed = pr.t;
          pr.y = 3;
          pr.vx = pr.vy = 0;
          pr.level = 'low';
          pr.r = 12;
          p.sparks(pr.x, 4, 10, '#ffd040');
          playCue(pr.def.sounds?.blocked);
        }
      } else {
        if (pr.t % 3 === 0) p.fire(pr.x + rand(-10, 10), 4, 1, 3);
        if (pr.t - pr.landed > GREASE_BURN) pr.dead = true;
      }
    },
    draw(ctx, pr, sx, sy) {
      drawGrease(ctx, pr.t, pr.landed > 0);
    },
  },
};
