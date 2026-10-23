import type { ProjDef } from '../../game/projectile';
import { drawCard } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  card: {
    // a playing card flicked edge-first: quick and flat
    stats: { dmg: 70, level: 'high', effect: 'heavy', r: 6, speed: 6.6 },
    sounds: { travel: { every: 6, cue: 'cardWhir' }, impact: 'cardSlice', blocked: 'cardFlick' },
    update(pr, f) {
      const p = f.particles;
      pr.y += Math.sin(pr.t * 0.4) * 0.4;
      if (pr.t % 4 === 0) p.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 5, y: pr.y, life: 8, max: 8, color: '#ffffff', floor: false });
    },
    draw(ctx, pr, sx, sy) {
      drawCard(ctx, pr.t);
    },
  },
};
