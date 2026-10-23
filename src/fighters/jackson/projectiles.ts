import type { ProjDef } from '../../game/projectile';
import { fedora } from '../../gfx/props';

const makeSprites = () => ({ fedora: fedora() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  fedora: {
    stats: { dmg: 75, level: 'high', effect: 'heavy', r: 7, speed: 5.2 },
    sounds: { impact: 'clack' },
    update(pr, f) {
      const p = f.particles;
      // flat spinning throw with a sparkle trail
      if (pr.t % 3 === 0) p.sparks(pr.x - Math.sign(pr.vx) * 6, pr.y, 1, '#ffffff');
      if (pr.t % 14 === 0) f.sfx('hatSpin');
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      // spins flat like a disc: squash horizontally instead of rotating
      ctx.scale(Math.max(0.25, Math.abs(Math.cos(pr.t * 0.45))), 1);
      ctx.drawImage(s.fedora, -11, -6);
    },
  },
};
