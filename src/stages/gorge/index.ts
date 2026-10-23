import type { StageModule } from '../../game/stages';
import { Stage } from './stage';

export default {
  order: 10,
  name: 'THE THORN GORGE',
  make: (bones) => new Stage(bones),
} satisfies StageModule;
