import type { StageModule } from '../../game/stages';
import { StreetMagicStage } from './stage';
import { streetMagicSong } from './song';

export default {
  order: 158,
  name: 'STREET MAGIC CITY',
  make: () => new StreetMagicStage(),
  songs: { streetmagic: streetMagicSong },
} satisfies StageModule;
