import type { StageModule } from '../../game/stages';
import { CourtyardStage } from './stage';
import { courtyardSong } from './song';

export default {
  order: 158,
  name: 'COURT OF CINDERS',
  make: (bones) => new CourtyardStage(bones),
  songs: { courtyard: courtyardSong },
} satisfies StageModule;
