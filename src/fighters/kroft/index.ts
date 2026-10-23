import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { kroft } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 220,
  make() {
    const c = kroft();
    c.selectSet ??= SETS.tomb;
    return c;
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
