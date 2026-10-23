import type { StageModule } from '../../game/stages';
import { ChurchStage } from './stage';
import { churchSong } from './song';

export default {
  order: 154,
  name: 'THE ECHO CATHEDRAL',
  make: (bones) => new ChurchStage(bones),
  songs: { church: churchSong },
} satisfies StageModule;
