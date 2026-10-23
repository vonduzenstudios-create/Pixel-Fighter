import type { ProjDef } from '../../game/projectile';
import { drawTinRobot } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  robot: {
    // wind-up toy that waddles along the floor: block low
    stats: { dmg: 80, level: 'low', effect: 'sweep', r: 8, speed: 1.9 },
    sounds: { travel: { every: 12, cue: 'tinTick' }, impact: 'tinClank', blocked: 'tinClank', clash: 'tinClank' },
    update(pr, f) {
      const p = f.particles;
      pr.y = 9;
      if (pr.t % 9 === 0) p.smoke(pr.x - Math.sign(pr.vx) * 6, 1, 1, '#8a8478');
      if (pr.t > 150) {
        pr.dead = true;
        p.smoke(pr.x, 8, 6, '#c8c0b0');
        p.sparks(pr.x, 10, 6, '#f0c828');
      }
    },
    draw(ctx, pr, sx, sy) {
      drawTinRobot(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
  },
};
