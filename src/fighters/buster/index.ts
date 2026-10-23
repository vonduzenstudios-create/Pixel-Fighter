import type { FighterModule } from '../kit';
import { buster } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 170,
  make: buster,
  moveSounds: {
    proj_robot: { frames: { 2: 'windUp', 9: 'windUp' } },
    bikedash: { frames: { 2: 'bikeBell', 10: 'pedal', 18: 'pedal', 26: 'pedal' }, impact: 'bikeCrash', blocked: 'clang' },
    tantrum: { frames: { 1: 'wail', 10: 'tantrumStomp', 22: 'tantrumStomp', 34: 'tantrumStomp' }, impact: 'glovePop' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
