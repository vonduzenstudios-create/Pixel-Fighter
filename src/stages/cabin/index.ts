import type { StageModule } from '../../game/stages';
import { CabinStage } from './stage';
import { cabinSong } from './song';

export default {
  order: 158,
  name: 'RAIL-SPLITTER WOODS',
  make: () => new CabinStage(),
  songs: { cabin: cabinSong },
} satisfies StageModule;
