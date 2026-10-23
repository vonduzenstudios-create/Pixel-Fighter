import type { StageModule } from '../../game/stages';
import { RingStage } from './stage';
import { ringSong } from './song';

export default {
  order: 156,
  name: 'PILEDRIVER PALACE',
  make: (bones) => new RingStage(bones),
  songs: { ring: ringSong },
} satisfies StageModule;
