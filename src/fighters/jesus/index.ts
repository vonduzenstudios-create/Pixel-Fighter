import type { FighterModule } from '../kit';
import { jesus } from './fighter';
import { PROJECTILES } from './projectiles';
import { JESUS_FX } from './sounds';

export default {
  order: 245,
  make: jesus,
  projectiles: PROJECTILES,
  fx: JESUS_FX,
} satisfies FighterModule;
