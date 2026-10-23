import type { ProjDef } from '../../game/projectile';
import { steak } from '../../gfx/props';

const makeSprites = () => ({ steak: steak() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  steak: {
    stats: { dmg: 85, level: 'high', effect: 'heavy', r: 7, speed: 4.4 },
    sounds: { travel: { every: 12, cue: 'sizzle' }, impact: ['meatSlap', 'sizzle'], blocked: 'meatSlap' },
    update(pr, f) {
      const p = f.particles;
      // a seared steak flipping end over end, spitting grease and flame
      pr.y += Math.sin(pr.t * 0.25) * 0.4;
      if (pr.t % 2 === 0) p.fire(pr.x - Math.sign(pr.vx) * 5, pr.y + 2, 1, 2);
      if (pr.t % 5 === 0) p.smoke(pr.x - Math.sign(pr.vx) * 8, pr.y + 4, 1, '#d8d0c8');
      if (pr.t % 7 === 0) p.add({ kind: 'spark', x: pr.x, y: pr.y, vx: -pr.vx * 0.2, vy: 0.8, life: 14, max: 14, color: '#ffe8a0', grav: 0.15 });
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.rotate(pr.t * 0.35 * Math.sign(pr.vx));
      ctx.drawImage(s.steak, -7, -5);
    },
  },
};
