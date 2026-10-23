import type { StageModule } from '../../game/stages';
import { BankStage } from './stage';
import { bankSong } from './song';

export default {
  order: 158,
  name: 'FORT FORTUNE TRUST',
  make: (bones) => new BankStage(bones),
  songs: { bank: bankSong },
} satisfies StageModule;
