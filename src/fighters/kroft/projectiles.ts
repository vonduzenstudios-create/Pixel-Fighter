import type { ProjDef } from '../../game/projectile';
import { drawKroft, updateKroft } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  // grappling hook on a rope: a clean hit reels the opponent in (./fighter.ts); sounds play from update
  hook: {
    stats: { dmg: 35, level: 'mid', effect: 'light', r: 6, speed: 7, sturdy: true },
    selfMoving: true,
    update: updateKroft,
    draw: (ctx, pr) => drawKroft(ctx, pr),
  },
  // cursed idol: harmless in flight, then a spike trap where it lands (block low)
  idol: {
    stats: { dmg: 70, level: 'high', effect: 'heavy', r: 6, speed: 0 },
    selfMoving: true,
    update: updateKroft,
    draw: (ctx, pr) => drawKroft(ctx, pr),
  },
};
