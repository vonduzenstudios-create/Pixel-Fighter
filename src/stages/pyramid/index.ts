import type { StageModule } from '../../game/stages';
import { PyramidStage } from './stage';
import { pyramidSong } from './song';

export default {
  order: 90,
  name: 'TOMB OF THE SUN KING',
  make: (bones) => new PyramidStage(bones),
  songs: { pyramid: pyramidSong },
} satisfies StageModule;
