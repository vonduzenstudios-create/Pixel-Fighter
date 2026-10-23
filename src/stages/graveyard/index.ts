import type { StageModule } from '../../game/stages';
import { GraveyardStage } from './stage';
import { graveyardSong } from './song';

export default {
  order: 157,
  name: 'HOLLOWMERE CEMETERY',
  make: (bones) => new GraveyardStage(bones),
  songs: { graveyard: graveyardSong },
} satisfies StageModule;
