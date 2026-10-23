import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { ball, pineTree } from '../../gfx/props';

export const PAINTS = ['#123c78', '#2e7a34', '#f0c020', '#a01828', '#f4f0e8'];

/** Frames a sprouting tree rumbles underground before it bursts up. */
const TREE_WARN = 16;

const makeSprites = () => ({ paint: PAINTS.map((c) => ball(5, c)), tree: pineTree() });
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

export const PROJECTILES: Record<string, ProjDef> = {
  paint: {
    stats: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 4.2 },
    sounds: { impact: 'splat' },
    init(pr) {
      pr.data.hue = Math.floor(Math.random() * PAINTS.length);
    },
    update(pr, f) {
      const p = f.particles;
      if (pr.t % 3 === 0) p.add({ kind: 'spark', x: pr.x, y: pr.y - 2, vx: -pr.vx * 0.1, vy: 0.3, life: 18, max: 18, color: PAINTS[pr.data.hue], grav: 0.15, floor: false });
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      ctx.drawImage(s.paint[pr.data.hue], -7, -7);
      ctx.fillStyle = PAINTS[pr.data.hue];
      ctx.fillRect(-Math.sign(pr.vx) * 7 - 1, -1, 3, 2);
    },
  },
  tree: {
    stats: { dmg: 95, level: 'low', effect: 'launch', r: 9, speed: 0 },
    sounds: { travel: { every: 8, cue: 'rumble' }, impact: 'woodBurst' },
    update(pr, f) {
      const p = f.particles;
      // rumbles underground (out of reach), then shoots up from the deck
      if (pr.t < TREE_WARN) {
        pr.y = -40;
        if (pr.t % 2 === 0) p.smoke(pr.x + rand(-6, 6), 1, 1, '#6a5038');
        if (pr.t === 2) f.sfx('roll');
      } else {
        if (pr.t === TREE_WARN) {
          f.sfx('whoosh', 1);
          p.sparks(pr.x, 4, 8, '#3a7a38');
        }
        pr.y = Math.min(34, 6 + (pr.t - TREE_WARN) * 3);
      }
      if (pr.t > TREE_WARN + 30) {
        pr.dead = true;
        p.sparks(pr.x, 20, 10, '#2a6230');
      }
    },
    draw(ctx, pr, sx, sy) {
      const s = spr();
      // grows from the deck: stretch the sprite up from its base
      ctx.translate(0, pr.y);
      const k = Math.max(0, Math.min(1, (pr.t - TREE_WARN) / 8));
      const h = Math.round(40 * k);
      if (h > 0) ctx.drawImage(s.tree, 0, 0, 20, 40, -10, -h, 20, h);
    },
    keepAfterHit: true,
  },
};
