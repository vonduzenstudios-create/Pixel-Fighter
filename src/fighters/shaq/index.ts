import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { shaqDef } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 200,
  make() {
    const c = shaqDef();
    c.selectSet ??= SETS.court;
    return c;
  },
  moveSounds: {
    proj_bball: { frames: { 1: 'dribble', 7: 'dribble', 12: 'squeak' } },
    backboard: { frames: { 0: 'squeak', 2: 'heave', 18: 'bigStomp' }, impact: ['rimRattle', 'boneCrack'], blocked: 'clang' },
    postup: { frames: { 1: 'squeak', 12: 'squeak', 24: 'squeak' }, impact: 'bodyBump', blocked: 'bodyBump' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
