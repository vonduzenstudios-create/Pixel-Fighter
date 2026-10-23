import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { joan } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 30,
  make() {
    const c = joan();
    c.selectSet ??= SETS.castle;
    c.homeStage ??= 'courtyard';
    return c;
  },
  moveSounds: {
    proj_holy: { frames: { 1: 'choir' } },
    charge: { frames: { 1: 'shing', 4: 'warCry', 8: 'stomp', 13: 'stomp', 18: 'stomp' }, impact: 'clang', blocked: 'clang' },
    ascend: { frames: { 0: 'shing' }, impact: 'flameBurst', blocked: 'clang' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
