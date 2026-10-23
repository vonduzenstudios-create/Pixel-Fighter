import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { glare } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 130,
  make() {
    const c = glare();
    c.selectSet ??= SETS.runway;
    return c;
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
