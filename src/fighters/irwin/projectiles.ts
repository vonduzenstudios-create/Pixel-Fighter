import type { ProjDef } from '../../game/projectile';
import { updateAnimal, drawAnimal } from './fighter';



export const PROJECTILES: Record<string, ProjDef> = {
  croc: {
    // summoned wildlife (chars/irwin.ts): they hit once, then head home instead of breaking (sturdy)
    stats: { dmg: 85, level: 'low', effect: 'sweep', r: 10, speed: 2.9, sturdy: true },
    sounds: { launch: 'crocHiss', travel: { every: 10, cue: 'scuttle' }, impact: ['jawSnap', 'boneCrack'], blocked: 'jawSnap' },
    selfMoving: true,
    update: updateAnimal,
    draw: (ctx, pr) => drawAnimal(ctx, pr),
  },
  roo: {
    stats: { dmg: 90, level: 'mid', effect: 'knockdown', r: 12, speed: 3.3, sturdy: true },
    sounds: { launch: 'rooSpring', impact: ['rooKick', 'boneCrack'], blocked: 'hopThump' },
    selfMoving: true,
    update: updateAnimal,
    draw: (ctx, pr) => drawAnimal(ctx, pr),
  },
  snake: {
    stats: { dmg: 90, level: 'low', effect: 'launch', r: 10, speed: 0, sturdy: true },
    sounds: { launch: 'snakeHiss', travel: { every: 9, cue: 'rustle' }, impact: ['snakeStrike', 'snakeHiss'], blocked: 'snakeStrike' },
    selfMoving: true,
    update: updateAnimal,
    draw: (ctx, pr) => drawAnimal(ctx, pr),
  },
};
