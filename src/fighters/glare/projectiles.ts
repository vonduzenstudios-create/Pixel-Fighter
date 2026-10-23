import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { drawSmolder } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  smolder: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 7, speed: 6.4 },
    sounds: { travel: { every: 10, cue: 'twinkle' }, impact: ['sparkle', 'glovePop'], blocked: 'sparkle' },
    update(pr, f) {
      const p = f.particles;
      // leaves a trail of pink glints
      if (pr.t % 2 === 0) p.sparks(pr.x - Math.sign(pr.vx) * 14, pr.y + rand(-2, 2), 1, pr.t % 4 ? '#ff8ad8' : '#ffffff');
    },
    draw(ctx, pr, sx, sy) {
      drawSmolder(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
  },
};
