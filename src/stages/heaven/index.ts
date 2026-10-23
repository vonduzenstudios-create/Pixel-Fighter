import type { StageModule } from '../../game/stages';
import { HeavenStage } from './stage';
import { heavenSong } from './song';

export default {
  order: 170,
  name: 'THE PEARLY GATES',
  make: () => new HeavenStage(),
  songs: { heaven: heavenSong },
} satisfies StageModule;
