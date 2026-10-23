import type { StageModule } from '../../game/stages';
import { MushroomStage } from './stage';
import { mushroomSong } from './song';

export default {
  order: 50,
  name: 'THE SPOREWOOD',
  make: (bones) => new MushroomStage(bones),
  songs: { mushroom: mushroomSong },
} satisfies StageModule;
