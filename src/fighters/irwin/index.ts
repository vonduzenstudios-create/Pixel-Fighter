import type { FighterModule } from '../kit';
import { irwin } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 210,
  make: irwin,
  moveSounds: {
    proj_croc: { frames: { 2: 'callWhistle', 10: 'rustle' } },
    proj_roo: { frames: { 2: 'callWhistle' } },
    proj_snake: { frames: { 1: 'rustle', 8: 'rustle' } },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
