import type { FighterModule } from '../kit';
import { ramsay } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 150,
  make: ramsay,
  moveSounds: {
    proj_steak: { frames: { 1: 'sizzle', 7: 'panClang' } },
    flambe: { frames: { 0: 'chefBark', 5: 'flambe', 16: 'fireCrackle' }, impact: 'flameBurst', blocked: 'fireCrackle' },
    mince: { frames: { 0: 'chefBark', 6: 'boardKnock', 14: 'boardKnock', 22: 'boardKnock', 30: 'boardKnock' }, impact: 'cleaverChop', blocked: 'clang' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
