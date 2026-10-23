import type { FighterModule } from '../kit';
import { cleo } from './fighter';
import { PROJECTILES } from './projectiles';
import { CLEO_FX } from './sounds';

export default {
  order: 145,
  make() {
    const c = cleo();
    c.homeStage ??= 'graveyard';
    return c;
  },
  moveSounds: {
    proj_crystal: { frames: { 1: 'crystalHum', 10: 'crystalRoll' } },
    hotline: { frames: { 0: 'phoneRing', 5: 'cordWhir', 9: 'cordWhir', 13: 'cordWhir', 17: 'cordWhir' }, impact: ['receiverSmack', 'boneCrack'], blocked: 'receiverSmack' },
    tarot: { frames: { 1: 'mysticChime', 6: 'cardFan', 10: 'cardFan', 14: 'cardFan', 18: 'cardFan', 22: 'cardFan', 26: 'cardFan' }, impact: ['cardSlice', 'sparkle'], blocked: 'cardFlick' },
  },
  projectiles: PROJECTILES,
  fx: CLEO_FX,
} satisfies FighterModule;
