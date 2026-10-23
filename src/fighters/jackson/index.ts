import type { FighterModule } from '../kit';
import { jackson } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 120,
  make: jackson,
  moveSounds: {
    proj_fedora: { frames: { 2: 'shing' } },
    moonwalk: { frames: { 6: 'shuffle', 16: 'shuffle' }, impact: 'boneCrack' },
    toespin: { impact: ['sparkle', 'boneCrack'] },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
