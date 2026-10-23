import type { StageModule } from '../../game/stages';
import { BurgerStage } from './stage';
import { burgerSong } from './song';

export default {
  order: 80,
  name: "PATTY PETE'S",
  make: (bones) => new BurgerStage(bones),
  songs: { burger: burgerSong },
} satisfies StageModule;
