import type { StageModule } from '../../game/stages';
import { FlavortownStage } from './stage';
import { flavortownSong } from './song';

export default {
  order: 110,
  name: 'FLAVORTOWN',
  make: (bones) => new FlavortownStage(bones),
  songs: { flavortown: flavortownSong },
} satisfies StageModule;
