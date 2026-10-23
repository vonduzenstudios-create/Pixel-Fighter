import type { FighterModule } from '../kit';
import { aliDef } from './fighter';
import { ALI_INTRO } from './intro';

export default {
  order: 70,
  make() {
    const c = aliDef();
    c.intro ??= ALI_INTRO;
    return c;
  },
  moveSounds: {
    flurry: { frames: { 1: 'shuffle', 14: 'shuffle' }, impact: 'glovePop' },
    ropeadope: { frames: { 3: 'ropeCreak' } },
    ropecounter: { frames: { 0: 'heave' }, impact: ['glovePop', 'boneCrack'] },
    lightningcross: { frames: { 0: 'crackle' }, impact: ['glovePop', 'boneCrack'] },
  },
} satisfies FighterModule;
