import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { oprah } from './fighter';
import { PROJECTILES } from './projectiles';

export default {
  order: 140,
  make() {
    const c = oprah();
    c.selectSet ??= SETS.talkshow;
    return c;
  },
  moveSounds: {
    proj_gift: { frames: { 1: 'giftRustle', 9: 'giftRustle' } },
    bookslam: { frames: { 1: 'pageFlutter', 7: 'heave' }, impact: ['bookThump', 'pageFlutter'], blocked: 'bookThump' },
    ovation: { frames: { 1: 'applause', 13: 'clap', 21: 'clap', 30: ['applause', 'confettiPop'] }, impact: 'clap', blocked: 'clap' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
