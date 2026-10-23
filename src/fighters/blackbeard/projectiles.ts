import type { ProjDef } from '../../game/projectile';
import { ball, keg } from '../../gfx/props';

const makeSprites = () => ({ cannon: ball(5, '#2a2a32'), keg: keg() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  cannon: {
    stats: { dmg: 110, level: 'high', effect: 'knockdown', r: 6, speed: 3.0 },
    sounds: { travel: { every: 30, cue: 'whistle' }, impact: 'cannon', blocked: 'cannon' },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 3 === 0) p.smoke(pr.x - Math.sign(pr.vx) * 5, pr.y, 1);
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.drawImage(s.cannon, -7, -7);
    },
    onHit(pr, f) {
      f.particles.smoke(pr.x, pr.y, 10);
      f.particles.fire(pr.x, pr.y, 10, 6);
    },
  },
  keg: {
    stats: { dmg: 90, level: 'low', effect: 'sweep', r: 8, speed: 2.8 },
    sounds: { travel: { every: 14, cue: 'rumble' }, impact: 'cannon', blocked: 'cannon' },
    update(pr, f) {
      const p = f.particles;
      pr.y = 8;
      if (pr.t % 4 === 0) p.smoke(pr.x - Math.sign(pr.vx) * 6, 2, 1, '#5a4a3a');
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.rotate(pr.t * 0.25 * Math.sign(pr.vx));
      ctx.drawImage(s.keg, -9, -9);
    },
    onHit(pr, f) {
      f.particles.smoke(pr.x, pr.y, 10);
      f.particles.fire(pr.x, pr.y, 10, 6);
    },
  },
};
