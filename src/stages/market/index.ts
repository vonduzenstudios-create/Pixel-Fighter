import type { StageModule } from '../../game/stages';
import { SupermarketStage } from './stage';
import { marketSong } from './song';

export default {
  order: 156,
  name: 'THRIFTOPIA MART',
  make: () => new SupermarketStage(),
  songs: { market: marketSong },
} satisfies StageModule;
