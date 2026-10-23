import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { hawking } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 100,
  make() {
    const c = hawking();
    c.selectSet ??= SETS.cosmos;
    return c;
  },
  moveSounds: {
    proj_hole: { frames: { 1: 'servo' } },
    rocketchair: { frames: { 1: 'servo' }, impact: 'metalCrash', blocked: 'clang' },
    radiation: { frames: { 1: 'geiger' }, impact: 'crackle' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
