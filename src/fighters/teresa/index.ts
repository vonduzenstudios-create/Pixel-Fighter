import type { FighterModule } from '../kit';
import { teresa } from './fighter';
import { PROJECTILES } from './projectiles';
import { TERESA_FX } from './sounds';

export default {
  order: 215,
  make: teresa,
  projectiles: PROJECTILES,
  fx: TERESA_FX,
} satisfies FighterModule;
