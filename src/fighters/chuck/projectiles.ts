import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';



export const PROJECTILES: Record<string, ProjDef> = {
  gust: {
    stats: { dmg: 85, level: 'mid', effect: 'heavy', r: 8, speed: 5.0 },
    sounds: { travel: { every: 9, cue: 'wind' }, impact: 'windHit' },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 3 === 0) p.smoke(pr.x - Math.sign(pr.vx) * 8, pr.y + rand(-6, 6), 1, '#c8d4e0');
    },
    draw(ctx, pr, sx, sy) {
      // crescent of kicked-up air: three nested arcs bowing toward the target
      const d = Math.sign(pr.vx), wob = Math.sin(pr.t * 0.9);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k === 0 ? '#ffffff' : k === 1 ? '#c8e0f8' : '#7aa0c8';
        const r = 10 - k * 2;
        for (let a = -70; a <= 70; a += 10) {
          const rad = (a * Math.PI) / 180;
          ctx.fillRect(Math.round(d * (Math.cos(rad) * r - 6 - k * 3)), Math.round(Math.sin(rad) * (r + 2 + wob)), 2, 2);
        }
      }
    },
  },
};
