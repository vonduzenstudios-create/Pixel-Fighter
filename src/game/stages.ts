import type { SongName } from '../audio/music';
import type { PartSet } from '../gfx/rig';
import { Stage } from './stage';
import { TrainStage } from './train';
import { BoatStage } from './boat';
import { SkyscraperStage } from './skyscraper';

/** Anything the fight can be staged in. */
export interface Arena {
  name: string;
  song: SongName;
  /** Backdrop for the uppercut stage finish; null if the stage has none. */
  pit: HTMLCanvasElement | null;
  draw(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
  /** Optional vertical offset (screen px) for the floor, fighters and effects, e.g. a rocking deck. */
  bob?(t: number): number;
}

interface StageEntry {
  id: string;
  name: string;
  make: (bones: PartSet) => Arena;
}

export const STAGES: StageEntry[] = [
  { id: 'gorge', name: 'THE THORN GORGE', make: (b) => new Stage(b) },
  { id: 'train', name: 'THE MIDNIGHT EXPRESS', make: (b) => new TrainStage(b) },
  { id: 'boat', name: 'THE DROWNED GALLEON', make: (b) => new BoatStage(b) },
  { id: 'spire', name: 'THE DATA SPIRE', make: (b) => new SkyscraperStage(b) },
];

// Stages paint themselves at construction, so build each one only when first needed.
const cache = new Map<string, Arena>();
export function arena(i: number, bones: PartSet): Arena {
  const s = STAGES[i];
  let a = cache.get(s.id);
  if (!a) cache.set(s.id, (a = s.make(bones)));
  return a;
}
