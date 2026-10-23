import type { StageModule } from '../../game/stages';
import { RunwayStage } from './stage';
import { runwaySong } from './song';

export default {
  order: 130,
  name: 'THE RUNWAY',
  make: (bones) => new RunwayStage(bones),
  songs: { runway: runwaySong },
} satisfies StageModule;
