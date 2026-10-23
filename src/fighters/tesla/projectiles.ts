import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { pxLine } from '../../gfx/painter';
import { ball } from '../../gfx/props';

const makeSprites = () => ({ bolt: ball(4, '#9ad8ff', true) });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  bolt: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 6.2 },
    sounds: { travel: { every: 8, cue: 'crackle' }, impact: 'elecHit', blocked: 'crackle' },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 2 === 0) p.zap(pr.x, pr.y, 2);
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.drawImage(s.bolt, -6, -6);
      ctx.fillStyle = '#e8f8ff';
      for (let i = 0; i < 3; i++) {
        let px = 0, py = 0;
        const a = rand(0, Math.PI * 2);
        for (let k = 0; k < 4; k++) {
          const nx = px + Math.cos(a) * 3 + rand(-2, 2), ny = py + Math.sin(a) * 3 + rand(-2, 2);
          pxLine(ctx, px, py, nx, ny);
          px = nx; py = ny;
        }
      }
      // trailing tail
      ctx.fillStyle = '#6ab4ff';
      pxLine(ctx, 0, 0, -Math.sign(pr.vx) * 14, rand(-3, 3));
    },
  },
};
