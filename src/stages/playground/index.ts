import type { StageModule } from '../../game/stages';
import { PlaygroundStage } from './stage';
import { playgroundSong } from './song';

export default {
  order: 156,
  name: 'RECESS YARD',
  make: () => new PlaygroundStage(),
  songs: { playground: playgroundSong },
} satisfies StageModule;
