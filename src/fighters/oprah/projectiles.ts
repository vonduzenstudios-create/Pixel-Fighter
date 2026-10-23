import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { drawGift, confetti } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  gift: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 7, speed: 4.2 },
    sounds: { travel: { every: 12, cue: 'giftRustle' }, impact: ['confettiPop', 'paperSlap'], blocked: 'giftRustle', clash: 'confettiPop' },
    update(pr, f) {
      const p = f.particles;
      // a little trail of confetti behind the present
      if (pr.t % 3 === 0) p.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 6, y: pr.y + rand(-4, 4), vx: -pr.vx * 0.1, vy: 0.4, grav: 0.05, life: 24, max: 24, size: 2, color: ['#f04878', '#f0c020', '#40b8f0', '#60d070'][(pr.t / 3) % 4] });
    },
    draw(ctx, pr, sx, sy) {
      drawGift(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
    onHit: (pr, f) => confetti(f.particles, pr.x, pr.y, 16),
  },
};
