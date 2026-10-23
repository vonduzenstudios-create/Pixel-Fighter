import type { ProjDef } from '../../game/projectile';
import { Projectile } from '../../game/projectile';
import { playCue } from '../../audio/specials';
import { crumbs, drawBread, drawFish, miracle } from './fighter';

const SCALES = ['#e0ecf4', '#9ab8d0', '#ffffff'];
const CRUMBS = ['#c88a44', '#f4d8a0', '#e0a860'];

export const PROJECTILES: Record<string, ProjDef> = {
  // a fish that multiplies in mid-air: a loaf splits off it and dips low while the fish flies on high
  jesusFish: {
    stats: { dmg: 60, level: 'high', effect: 'heavy', r: 7, speed: 3.6 },
    sounds: { travel: { every: 16, cue: 'whoosh' }, impact: 'fishSlap', blocked: 'fishSlap', clash: 'fishSlap' },
    update(pr, f) {
      if (pr.t === 18 && !pr.spent) {
        miracle(f, pr.x, pr.y, 10, 1.4);
        playCue('multiply');
        const loaf = new Projectile(pr.owner, 'jesusLoaf', pr.x, pr.y);
        loaf.vx = Math.sign(pr.vx) * Math.abs(loaf.vx);
        f.projectiles.push(loaf);
      }
    },
    draw(ctx, pr) {
      drawFish(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
    onHit: (pr, f) => crumbs(f, pr.x, pr.y, 10, SCALES),
  },
  jesusLoaf: {
    stats: { dmg: 50, level: 'mid', effect: 'light', r: 6, speed: 3.4 },
    sounds: { impact: 'breadBop', blocked: 'breadBop', clash: 'breadBop' },
    update(pr) {
      // drops from the fish's height to waist level, then flies on flat
      pr.vy = pr.y > 30 ? -0.9 : 0;
    },
    draw(ctx, pr) {
      drawBread(ctx, pr.t, Math.sign(pr.vx) || 1);
    },
    onHit: (pr, f) => crumbs(f, pr.x, pr.y, 10, CRUMBS),
  },
};
