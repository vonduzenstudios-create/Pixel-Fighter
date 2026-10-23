import type { StageModule } from '../../game/stages';
import { BlizzardStage } from './stage';
import { blizzardSong } from './song';

export default {
  order: 60,
  name: 'THE HOWLING PASS',
  make: (bones) => new BlizzardStage(bones),
  songs: { blizzard: blizzardSong },
} satisfies StageModule;
