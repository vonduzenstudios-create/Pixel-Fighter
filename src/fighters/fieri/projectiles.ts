import type { ProjDef } from '../../game/projectile';
import { updateBurger, drawBurger, updateRagtop, drawRagtop } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  burger: {
    // lobbed flaming cheeseburger and a hot rod that drives across the deck (jump it)
    stats: { dmg: 85, level: 'high', effect: 'heavy', r: 7, speed: 3.9 },
    sounds: { travel: { every: 12, cue: 'fireCrackle' }, impact: ['splat', 'flameBurst'] },
    update(pr, f) {
      updateBurger(pr, f);
    },
    draw(ctx, pr, sx, sy) {
      drawBurger(ctx, pr);
    },
  },
  ragtop: {
    stats: { dmg: 100, level: 'mid', effect: 'knockdown', r: 12, speed: 5.6, sturdy: true },
    sounds: { launch: ['horn', 'screech'], travel: { every: 16, cue: 'engineRev' }, impact: 'carCrash', blocked: 'carCrash' },
    update(pr, f) {
      updateRagtop(pr, f);
    },
    draw(ctx, pr, sx, sy) {
      drawRagtop(ctx, pr);
    },
  },
};
