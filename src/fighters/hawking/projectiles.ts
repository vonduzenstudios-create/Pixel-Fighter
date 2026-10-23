import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { drawMiniHole } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  hole: {
    stats: { dmg: 95, level: 'high', effect: 'knockdown', r: 7, speed: 2.4 },
    sounds: { travel: { every: 24, cue: 'drone' }, impact: 'gravityHit' },
    update(pr, f) {
      const p = f.particles;
      // a slow singularity that drags a grounded opponent toward it
      const o = pr.owner.opp;
      if (!o.airborne && !o.locked && Math.abs(o.x - pr.x) < 70) o.x += Math.sign(pr.x - o.x) * 0.45;
      if (pr.t % 3 === 0) {
        const a = rand(0, Math.PI * 2);
        p.add({ kind: 'spark', x: pr.x + Math.cos(a) * 14, y: pr.y + Math.sin(a) * 10, vx: -Math.cos(a) * 1.2, vy: -Math.sin(a) * 1.2, life: 10, max: 10, color: '#a070ff', floor: false });
      }
    },
    draw(ctx, pr, sx, sy) {
      drawMiniHole(ctx, pr.t);
    },
  },
};
