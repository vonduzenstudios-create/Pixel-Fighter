import type { FighterModule } from '../kit';
import { allison } from './fighter';
import { PROJECTILES } from './projectiles';
import { ALLISON_FX } from './sounds';
import { gardenSet } from './set';

export default {
  order: 230,
  make() {
    const c = allison();
    c.selectSet ??= gardenSet;
    return c;
  },
  moveSounds: {
    proj_cardguard: { frames: { 1: 'cardShuffle', 11: 'cardMarch' } },
    drinkme: { frames: { 1: 'popOut', 7: 'potionGulp', 14: 'growSwell', 30: 'heave', 38: 'giantStomp', 56: 'shrinkZip' }, impact: 'boneCrack', blocked: 'clack' },
    rabbithole: { frames: { 1: 'inhale', 5: 'burrow', 12: 'burrow', 20: 'burrow', 26: 'popOut' }, impact: ['glovePop', 'boneCrack'], blocked: 'clack' },
  },
  projectiles: PROJECTILES,
  fx: ALLISON_FX,
} satisfies FighterModule;
