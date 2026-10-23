import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { bruceLee } from './fighter';

export default {
  order: 50,
  make() {
    const c = bruceLee();
    c.selectSet ??= SETS.dojo;
    return c;
  },
  moveSounds: {
    inchpunch: { frames: { 1: 'chi' }, impact: 'boneCrack' },
    dragonkick: { frames: { 0: 'chi' }, impact: 'boneCrack' },
    nunchaku: { frames: { 1: 'chainRattle', 13: 'chainRattle', 25: 'chainRattle' }, impact: 'clack', blocked: 'clack' },
  },
} satisfies FighterModule;
