import type { StageModule } from '../../game/stages';
import { BeachStage } from './stage';
import { beachSong } from './song';

export default {
  order: 140,
  name: 'CORAL COVE',
  make: () => new BeachStage(),
  songs: { beach: beachSong },
} satisfies StageModule;
