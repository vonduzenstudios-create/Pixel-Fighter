import type { ProjDef } from '../../game/projectile';
import { bill, cashBrick, musicNote } from '../../gfx/props';

const makeSprites = () => ({ bill: bill(), cash: cashBrick(), note: musicNote() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  cash: {
    stats: { dmg: 85, level: 'high', effect: 'heavy', r: 7, speed: 4.6 },
    sounds: { travel: { every: 14, cue: 'coins' }, impact: ['kaching', 'paperSlap'], blocked: 'kaching' },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 5 === 0)
        p.add({ kind: 'img', img: spr().bill, ix: 3, iy: 2, x: pr.x, y: pr.y, vx: -pr.vx * 0.15, vy: 0.6, grav: 0.04, rot: 0, vrot: 0.2, life: 50, max: 50 });
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.rotate(Math.sin(pr.t * 0.3) * 0.15);
      ctx.drawImage(s.cash, -8, -5);
    },
  },
  aria: {
    // short-range sonic blast that can't be ducked
    stats: { dmg: 70, level: 'mid', effect: 'knockdown', r: 11, speed: 5.2 },
    sounds: { impact: 'shatter' },
    update(pr, f) {
      pr.vx *= 0.97;
      if (pr.t > 26) pr.dead = true;
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      // expanding sound rings with a note riding the front
      const d = Math.sign(pr.vx) || 1;
      for (let k = 0; k < 3; k++) {
        const r = 4 + ((pr.t * 0.8 + k * 4) % 12);
        ctx.fillStyle = k === 0 ? '#fff4c0' : '#e8b040';
        for (let a = -50; a <= 50; a += 12) {
          const ra = (a * Math.PI) / 180;
          ctx.fillRect(Math.round(Math.cos(ra) * r * d) - 6 * d, Math.round(Math.sin(ra) * r * 1.4), 1, 2);
        }
      }
      ctx.drawImage(s.note, -3 + d * 4, -12 + Math.round(Math.sin(pr.t * 0.5) * 2));
    },
  },
};
