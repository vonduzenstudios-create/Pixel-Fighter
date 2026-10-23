import type { StageModule } from '../../game/stages';
import { UndergroundStage } from './stage';
import { undergroundSong } from './song';

export default {
  order: 70,
  name: 'THE UNDERDROME',
  make: (bones) => new UndergroundStage(bones),
  songs: { underground: undergroundSong },
} satisfies StageModule;
