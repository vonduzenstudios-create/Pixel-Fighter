import type { FighterModule } from '../kit';
import { bruceLee } from './fighter';

export default {
  order: 50,
  make: bruceLee,
  moveSounds: {
    inchpunch: { frames: { 1: 'chi' }, impact: 'boneCrack' },
    dragonkick: { frames: { 0: 'chi' }, impact: 'boneCrack' },
    nunchaku: { frames: { 1: 'chainRattle', 13: 'chainRattle', 25: 'chainRattle' }, impact: 'clack', blocked: 'clack' },
  },
} satisfies FighterModule;
