import type { FighterModule } from '../kit';
import { blackbeard } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 40,
  make: blackbeard,
  moveSounds: {
    proj_cannon: { frames: { 1: 'fuse' } },
    proj_keg: { frames: { 1: 'fuse' } },
    cyclone: { frames: { 1: 'shing' }, impact: 'chop', blocked: 'clang' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
