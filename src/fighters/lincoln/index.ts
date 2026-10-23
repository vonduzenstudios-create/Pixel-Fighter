import type { FighterModule } from '../kit';
import { lincoln } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 10,
  make: lincoln,
  moveSounds: {
    proj_hat: { frames: { 1: 'inhale' } },
    railsplit: { frames: { 1: 'heave', 6: 'creak' }, impact: 'chop', blocked: 'clack' },
    logroll: { frames: { 1: 'heave', 6: 'rumble', 14: 'rumble', 22: 'rumble' }, impact: ['clack', 'thud'] },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
