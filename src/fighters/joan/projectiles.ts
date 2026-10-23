import type { ProjDef } from '../../game/projectile';
import { pxCircle } from '../../gfx/painter';
import { ball } from '../../gfx/props';

const makeSprites = () => ({ holy: ball(5, '#ffd040', true) });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  holy: {
    stats: { dmg: 90, level: 'high', effect: 'knockdown', r: 7, speed: 3.6 },
    sounds: { travel: { every: 10, cue: 'fireCrackle' }, impact: 'flameBurst' },
    update(pr, f) {
      const p = f.particles;
      p.fire(pr.x - Math.sign(pr.vx) * 4, pr.y, 2, 3);
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      const fl = Math.sin(pr.t * 0.8) > 0;
      ctx.fillStyle = fl ? '#ff7010' : '#ff4008';
      pxCircle(ctx, 0, 0, 7);
      ctx.drawImage(s.holy, -7, -7);
      ctx.fillStyle = '#fffbe0';
      pxCircle(ctx, -1, -1, 2);
    },
  },
};
