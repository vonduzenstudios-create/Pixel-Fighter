import type { FighterModule } from '../kit';
import { bobRoss } from './fighter';
import { BOB_ROSS_INTRO } from './intro';
import { PROJECTILES } from './projectiles';

export default {
  order: 110,
  make() {
    const c = bobRoss();
    c.intro ??= BOB_ROSS_INTRO;
    return c;
  },
  moveSounds: {
    proj_paint: { frames: { 1: 'brushTap' } },
    proj_tree: { frames: { 1: 'brushTap', 6: 'brushTap' } },
    flurry: { frames: { 1: 'brushTap' }, impact: 'splat' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
