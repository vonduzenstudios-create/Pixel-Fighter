import type { StageModule } from '../../game/stages';
import { LifeguardStage } from './stage';
import { lifeguardSong } from './song';

export default {
  order: 142,
  name: 'RESCUE POINT',
  make: () => new LifeguardStage(),
  songs: { lifeguard: lifeguardSong },
} satisfies StageModule;
