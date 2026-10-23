import type { StageModule } from '../../game/stages';
import { DojoStage } from './stage';
import { dojoSong } from './song';

export default {
  order: 120,
  name: 'IRONWOOD DOJO',
  make: (bones) => new DojoStage(bones),
  songs: { dojo: dojoSong },
} satisfies StageModule;
