import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { tesla } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 20,
  make() {
    const c = tesla();
    c.selectSet ??= SETS.lab;
    return c;
  },
  moveSounds: {
    proj_bolt: { frames: { 1: 'charge' } },
    teleport: { frames: { 15: 'popIn', 24: 'crackle' }, impact: 'elecHit' },
    acfield: { frames: { 1: 'charge', 14: 'crackle', 22: 'crackle', 30: 'crackle' }, impact: 'elecHit' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
