import type { StageModule } from '../../game/stages';
import { InfernoStage } from './stage';
import { infernoSong } from './song';

export default {
  order: 115,
  name: 'THE INFERNO',
  make: (bones) => new InfernoStage(bones),
  songs: { inferno: infernoSong },
} satisfies StageModule;
