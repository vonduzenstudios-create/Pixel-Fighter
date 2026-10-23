import type { ProjDef } from '../../game/projectile';
import { drawFingerBang, hsfx } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  // finger-pistol shot fired from hip height, too low to duck under
  fingerbang: {
    stats: { dmg: 80, level: 'mid', effect: 'heavy', r: 6, speed: 5.6 },
    sounds: { impact: hsfx.ricochet, blocked: hsfx.ricochet },
    update(pr, f) {
      if (pr.t % 3 === 0) f.particles.sparks(pr.x - Math.sign(pr.vx) * 12, pr.y, 1, pr.t % 6 ? '#ff9ac8' : '#ffffff');
    },
    draw(ctx, pr) {
      drawFingerBang(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
  },
};
