import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { handerson } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 225,
  make() {
    const c = handerson();
    c.selectSet ??= SETS.disco;
    return c;
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
