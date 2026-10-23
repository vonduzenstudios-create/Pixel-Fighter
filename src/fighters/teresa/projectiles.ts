import type { ProjDef } from '../../game/projectile';
import { crumbs, drawLoaf } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  loaf: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 7, speed: 4.0 },
    sounds: { travel: { every: 14, cue: 'whoosh' }, impact: 'breadThump', blocked: 'breadThump', clash: 'breadThump' },
    update(pr, f) {
      if (pr.t % 4 === 0) crumbs(f, pr.x - Math.sign(pr.vx) * 6, pr.y, 1, 0.2);
    },
    draw(ctx, pr) {
      drawLoaf(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
    onHit: (pr, f) => crumbs(f, pr.x, pr.y, 14, 1),
  },
};
