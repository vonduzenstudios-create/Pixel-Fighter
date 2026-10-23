import type { FighterModule } from '../kit';
import { colonelCrisp } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 90,
  make: colonelCrisp,
  moveSounds: {
    proj_drumstick: { frames: { 1: 'paperFlap', 12: 'heave' } },
    proj_grease: { frames: { 1: 'clang', 9: 'heave' } },
    canethrash: { frames: { 0: 'caneTap', 1: 'warCry' }, impact: ['clack', 'caneTap'], blocked: 'clack' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
