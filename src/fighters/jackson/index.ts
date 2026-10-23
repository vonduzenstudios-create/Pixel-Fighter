import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { jackson } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 120,
  make() {
    const c = jackson();
    c.selectSet ??= SETS.disco;
    c.homeStage ??= 'concert';
    return c;
  },
  moveSounds: {
    proj_fedora: { frames: { 2: 'shing' } },
    moonwalk: { frames: { 6: 'shuffle', 16: 'shuffle' }, impact: 'boneCrack' },
    toespin: { impact: ['sparkle', 'boneCrack'] },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
