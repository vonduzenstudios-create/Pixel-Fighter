import type { FighterModule } from '../kit';
import { lumpsum } from './fighter';
import { LUMPSUM_INTRO } from './intro';
import { PROJECTILES } from './projectiles';

export default {
  order: 80,
  make() {
    const c = lumpsum();
    c.intro ??= LUMPSUM_INTRO;
    return c;
  },
  moveSounds: {
    proj_cash: { frames: { 1: 'coins' } },
    proj_aria: { frames: { 1: 'inhale' } },
    checkslam: { frames: { 1: 'paperFlap', 8: 'heave' }, impact: 'paperSlap' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
