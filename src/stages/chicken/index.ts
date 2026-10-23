import type { StageModule } from '../../game/stages';
import { ChickenStage } from './stage';
import { chickenSong } from './song';

export default {
  order: 80,
  name: 'THE CLUCK HUT',
  make: (bones) => new ChickenStage(bones),
  songs: { chicken: chickenSong },
} satisfies StageModule;
