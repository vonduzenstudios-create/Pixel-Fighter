import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { guyFieri } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 190,
  make() {
    const c = guyFieri();
    c.selectSet ??= SETS.flames;
    c.homeStage ??= 'flavortown';
    return c;
  },
  moveSounds: {
    proj_burger: { frames: { 1: 'inhale', 9: 'sizzle' } },
    proj_ragtop: { frames: { 12: 'engineRev' } },
    smash: { frames: { 1: 'heave', 8: 'smashPress', 14: 'smashPress', 20: 'smashPress', 26: 'smashPress', 32: 'smashPress' }, impact: ['smashPress', 'sizzle'], blocked: 'clang' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
