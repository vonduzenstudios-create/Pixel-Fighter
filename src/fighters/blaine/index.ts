import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { blaine } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 160,
  make() {
    const c = blaine();
    c.selectSet ??= SETS.street;
    return c;
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
