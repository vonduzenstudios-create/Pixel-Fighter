import { addSongs } from '../audio/music';
import type { StageModule } from '../game/stages';

// Every stage lives in its own folder, src/stages/<id>/, and is found here automatically:
// adding a stage never touches a shared file. See README "Adding a stage".
const found = import.meta.glob<StageModule>('./*/index.ts', { eager: true, import: 'default' });

export interface StageEntry extends StageModule {
  /** The folder name. */
  id: string;
}

export const STAGES: StageEntry[] = Object.entries(found)
  .map(([path, m]) => ({ ...m, id: path.split('/')[1] }))
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

for (const s of STAGES) if (s.songs) addSongs(s.songs);
