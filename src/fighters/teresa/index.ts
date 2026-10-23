import type { FighterModule } from '../kit';
import { teresa } from './fighter';
import { PROJECTILES } from './projectiles';
import { TERESA_FX } from './sounds';

export default {
  order: 215,
  make() {
    const c = teresa();
    c.homeStage ??= 'church';
    return c;
  },
  projectiles: PROJECTILES,
  fx: TERESA_FX,
} satisfies FighterModule;
