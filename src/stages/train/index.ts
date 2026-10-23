import type { StageModule } from '../../game/stages';
import { TrainStage } from './stage';
import { trainSong } from './song';

export default {
  order: 20,
  name: 'THE MIDNIGHT EXPRESS',
  make: (bones) => new TrainStage(bones),
  songs: { train: trainSong },
} satisfies StageModule;
