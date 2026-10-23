import type { FighterModule } from '../kit';
import { blaine } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 160,
  make: blaine,
  projectiles: PROJECTILES,
} satisfies FighterModule;
