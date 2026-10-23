import type { StageModule } from '../../game/stages';
import { HoopsStage } from './stage';
import { hoopsSong } from './song';

export default {
  order: 145,
  name: 'THE HARDWOOD',
  make: (b) => new HoopsStage(b),
  songs: { hoops: hoopsSong },
} satisfies StageModule;
