import type { FighterModule } from '../kit';
import { kingTut } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 180,
  make: kingTut,
  moveSounds: {
    proj_scarab: { frames: { 1: 'linenSnap', 10: 'buzz' } },
    proj_sarc: { frames: { 2: 'curseChant', 12: 'stoneGrind' } },
    sandstorm: { frames: { 1: 'sandWind', 14: 'sandWind', 28: 'sandWind' }, impact: 'sandHit' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
