import type { StageModule } from '../../game/stages';
import { ConcertStage } from './stage';
import { concertSong } from './song';

export default {
  order: 100,
  name: 'THE DECIBEL DOME',
  make: (bones) => new ConcertStage(bones),
  songs: { concert: concertSong },
} satisfies StageModule;
