import type { StageModule } from '../../game/stages';
import { BoatStage } from './stage';
import { boatSong } from './song';

export default {
  order: 30,
  name: 'THE DROWNED GALLEON',
  make: (bones) => new BoatStage(bones),
  songs: { boat: boatSong },
} satisfies StageModule;
