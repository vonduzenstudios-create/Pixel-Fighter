import type { FighterModule } from '../kit';
import { legsMcGee } from './fighter';

// Her moves carry their own skate sounds inline (Move.sounds), so there is no moveSounds table here.
export default {
  order: 235,
  make() {
    const c = legsMcGee();
    c.homeStage ??= 'rink';
    return c;
  },
} satisfies FighterModule;
