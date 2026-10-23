import type { ProjDef } from '../../game/projectile';
import { drawCardGuard, updateCardGuard } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  cardguard: {
    // a playing-card guard marching with a levelled halberd; after its blow it marches home (sturdy)
    stats: { dmg: 85, level: 'mid', effect: 'knockdown', r: 10, speed: 2.4, sturdy: true },
    sounds: { launch: 'cardShuffle', travel: { every: 8, cue: 'cardMarch' }, impact: ['cardSpear', 'boneCrack'], blocked: 'clack', clash: 'cardShuffle' },
    update: updateCardGuard,
    draw: (ctx, pr) => drawCardGuard(ctx, pr),
  },
};
