import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { chuckNorris } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 60,
  make() {
    const c = chuckNorris();
    c.selectSet ??= SETS.western;
    return c;
  },
  moveSounds: {
    proj_gust: { frames: { 1: 'inhale' } },
    tornado: { frames: { 0: 'heave' }, impact: 'boneCrack' },
    flurry: { frames: { 1: 'heave' }, impact: 'bootThud' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
