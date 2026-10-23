import type { ProjDef } from '../../game/projectile';
import { FLOOR } from '../../core/consts';
import { rand } from '../../core/rng';
import { sarcophagus, scarab } from '../../gfx/props';

/** Frames a sarcophagus hangs over its target, shadow on the floor, before it drops. */
const SARC_WARN = 18;

const makeSprites = () => ({ sarcophagus: sarcophagus(), scarab: scarab(), scarabGlow: scarab(true) });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  scarab: {
    // a buzzing swarm that weaves as it flies
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 9, speed: 3.4 },
    sounds: { travel: { every: 12, cue: 'buzz' }, impact: ['buzz', 'crunch'], blocked: 'buzz' },
    update(pr, f) {
      const p = f.particles;
      pr.vy = Math.cos(pr.t * 0.25) * 0.9;
      if (pr.t % 4 === 0) p.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 8, y: pr.y + rand(-4, 4), vx: -pr.vx * 0.2, vy: 0, life: 10, max: 10, color: '#e8c860', floor: false });
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      // a cluster of beetles: each one bobs on its own little orbit
      const d = Math.sign(pr.vx) || 1;
      if (d < 0) ctx.scale(-1, 1);
      for (let k = 0; k < 5; k++) {
        const a = pr.t * 0.4 + k * 1.3;
        ctx.drawImage(k === 0 ? s.scarabGlow : s.scarab, Math.round(Math.cos(a) * 5 - k * 3) - 5, Math.round(Math.sin(a * 1.3) * 5) - 4);
      }
    },
  },
  sarcophagus: {
    // drops out of the sky onto the opponent: block it standing
    stats: { dmg: 105, level: 'overhead', effect: 'knockdown', r: 12, speed: 0 },
    sounds: { impact: ['stoneGrind', 'crunch'], blocked: 'stoneGrind' },
    update(pr, f) {
      const p = f.particles;
      const o = pr.owner.opp;
      if (pr.t === 1) pr.y = 230;
      if (pr.t < SARC_WARN) {
        // homes in from above while the shadow grows
        pr.x += (o.x - pr.x) * 0.12;
        pr.vy = 0;
      } else if (!pr.spent) {
        pr.vy -= 0.55;
        if (pr.y <= 22) {
          pr.y = 22;
          pr.vy = 0;
          pr.spent = true;
          pr.data.landT = pr.t;
          f.shake(6);
          f.sfx('thud');
          for (const s of [-1, 1]) p.smoke(pr.x + s * 10, 2, 5, '#c8a870');
        }
      } else {
        pr.vy = 0;
        if (pr.t > pr.data.landT + 26) {
          pr.y -= 2; // sinks into the sand
          if (pr.t % 4 === 0) p.smoke(pr.x + rand(-10, 10), 2, 1, '#c8a870');
        }
        if (pr.t > pr.data.landT + 46) pr.dead = true;
      }
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.restore();
      ctx.save();
      // floor shadow, growing as it falls
      const k = Math.max(0.2, 1 - (pr.y - 22) / 220);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(Math.round(sx - 12 * k), FLOOR - 1, Math.round(24 * k), 2);
      // clipped at the floor so it can sink out of sight
      ctx.beginPath();
      ctx.rect(sx - 12, 0, 24, FLOOR);
      ctx.clip();
      ctx.drawImage(s.sarcophagus, sx - 11, sy - 22);
    },
  },
};
