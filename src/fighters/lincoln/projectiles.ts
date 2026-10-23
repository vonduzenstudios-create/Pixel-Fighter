import type { Projectile, ProjDef } from '../../game/projectile';
import { stovepipeHat } from '../../gfx/props';

const makeSprites = () => ({ hat: stovepipeHat() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

/** The direction it was thrown in. */
const vx0 = (pr: Projectile) => (pr.data.dir0 ||= Math.sign(pr.vx) || 1);

export const PROJECTILES: Record<string, ProjDef> = {
  hat: {
    stats: { dmg: 70, level: 'high', effect: 'heavy', r: 7, speed: 4.4 },
    sounds: { impact: 'clack' },
    update(pr, f) {
      // boomerang: slows, turns around and flies back to its owner
      pr.vx -= 0.11 * Math.sign(vx0(pr));
      if (pr.t > 30 && Math.abs(pr.x - pr.owner.x) < 10) pr.dead = true;
      if (pr.t % 12 === 0) f.sfx('hatSpin');
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.rotate(pr.t * 0.5);
      ctx.drawImage(s.hat, -8, -12);
    },
  },
};
