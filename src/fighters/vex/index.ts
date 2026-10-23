import type { FighterModule } from '../kit';
import { vex } from './fighter';
import { PROJECTILES } from './projectiles';
import { VEX_FX } from './sounds';

export default {
  order: 262,
  make: vex,
  moveSounds: {
    glitchstep: { impact: ['glitchIn', 'boneCrack'], blocked: 'packetPop' },
  },
  projectiles: PROJECTILES,
  fx: VEX_FX,
} satisfies FighterModule;
