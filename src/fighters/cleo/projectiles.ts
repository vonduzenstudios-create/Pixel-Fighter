import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { drawCrystal } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  crystal: {
    // a crystal ball bowled along the floor: block it low
    stats: { dmg: 85, level: 'low', effect: 'sweep', r: 8, speed: 3.3 },
    sounds: { travel: { every: 14, cue: 'crystalRoll' }, impact: ['glassThud', 'boneCrack'], blocked: 'glassThud', clash: 'glassCrack' },
    update(pr, f) {
      const p = f.particles;
      // rolls along the floor trailing glittering mist
      pr.y = 8;
      if (pr.t % 3 === 0) p.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 7, y: rand(4, 16), vx: -pr.vx * 0.15, vy: rand(0.2, 0.8), life: 22, max: 22, size: 1, color: ['#b070f0', '#e0b0ff', '#ffffff'][(pr.t / 3) % 3], floor: false });
    },
    draw(ctx, pr) {
      drawCrystal(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
  },
};
