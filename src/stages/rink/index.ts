import type { StageModule } from '../../game/stages';
import { RinkStage } from './stage';
import { rinkSong } from './song';

export default {
  order: 158,
  name: 'ROLL-O-RAMA',
  make: () => new RinkStage(),
  songs: { rink: rinkSong },
} satisfies StageModule;
