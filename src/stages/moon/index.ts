import type { StageModule } from '../../game/stages';
import { MoonStage } from './stage';
import { moonSong } from './song';

export default {
  order: 160,
  name: 'SEA OF SILENCE',
  make: () => new MoonStage(),
  songs: { moon: moonSong },
} satisfies StageModule;
