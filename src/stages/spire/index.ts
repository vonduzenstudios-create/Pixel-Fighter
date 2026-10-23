import type { StageModule } from '../../game/stages';
import { SkyscraperStage } from './stage';
import { spireSong } from './song';

export default {
  order: 40,
  name: 'THE DATA SPIRE',
  make: (bones) => new SkyscraperStage(bones),
  songs: { spire: spireSong },
} satisfies StageModule;
