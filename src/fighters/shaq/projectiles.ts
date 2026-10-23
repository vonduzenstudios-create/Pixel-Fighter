import type { ProjDef } from '../../game/projectile';
import { playCue } from '../../audio/specials';
import { drawBasketball } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  bball: {
    // bounce pass: hops along the floor, so jumping it is a matter of timing
    stats: { dmg: 80, level: 'mid', effect: 'heavy', r: 7, speed: 3.9 },
    sounds: { impact: ['dribble', 'bodyBump'], blocked: 'dribble', clash: 'dribble' },
    update(pr, f) {
      const p = f.particles;
      pr.vy -= 0.34;
      if (pr.y + pr.vy <= 7) {
        pr.y = 7;
        pr.vy = 4.6;
        if (pr.t > 1) {
          playCue('dribble');
          p.smoke(pr.x, 2, 1, '#8a7a6a');
        }
      }
    },
    draw(ctx, pr, sx, sy) {
      drawBasketball(ctx, pr.t * 0.35 * Math.sign(pr.vx), pr.y <= 8 ? 0.8 : 1);
    },
  },
};
