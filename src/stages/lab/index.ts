import type { StageModule } from '../../game/stages';
import { LabStage } from './stage';
import { labSong } from './song';

export default {
  order: 150,
  name: 'THE COIL WORKS',
  make: (bones) => new LabStage(bones),
  songs: { lab: labSong },
} satisfies StageModule;
