import type { FighterModule } from '../kit';
import { glare } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 130,
  make: glare,
  projectiles: PROJECTILES,
} satisfies FighterModule;
