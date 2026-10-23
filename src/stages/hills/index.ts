import type { StageModule } from '../../game/stages';
import { HillsStage } from './stage';
import { hillsSong } from './song';

export default {
  order: 152,
  name: 'BUTTERCUP HILLS',
  make: () => new HillsStage(),
  songs: { hills: hillsSong },
} satisfies StageModule;
