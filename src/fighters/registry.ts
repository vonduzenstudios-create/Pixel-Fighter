import { FX, MOVE_SOUNDS } from '../audio/specials';
import { defineProjectiles } from '../game/projectile';
import type { FighterModule } from './kit';

// Every fighter lives in its own folder, src/fighters/<id>/, and is found here automatically:
// adding a fighter never touches a shared file. See README "Adding a fighter".
const found = import.meta.glob<FighterModule>('./*/index.ts', { eager: true, import: 'default' });

export interface FighterEntry extends FighterModule {
  /** The folder name, which is also the fighter's CharDef id. */
  id: string;
}

export const FIGHTERS: FighterEntry[] = Object.entries(found)
  .map(([path, m]) => ({ ...m, id: path.split('/')[1] }))
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

for (const m of FIGHTERS) {
  if (m.fx) Object.assign(FX, m.fx);
  if (m.moveSounds) MOVE_SOUNDS[m.id] = m.moveSounds;
  if (m.projectiles) defineProjectiles(m.projectiles);
}
