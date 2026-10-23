import type { SongName } from '../audio/music';
import type { PartSet } from '../gfx/rig';
import type { Fight } from './fight';
import { MoonStage } from './moon';
import { Stage } from './stage';
import { TrainStage } from './train';
import { BoatStage } from './boat';
import { SkyscraperStage } from './skyscraper';
import { MushroomStage } from './mushroom';
import { BlizzardStage } from './blizzard';
import { UndergroundStage } from './underground';
import { BurgerStage } from './burger';
import { PyramidStage } from './pyramid';

/** Anything the fight can be staged in. */
export interface Arena {
  name: string;
  song: SongName;
  /** Backdrop for the uppercut stage finish; null if the stage has none. */
  pit: HTMLCanvasElement | null;
  /** Fighter gravity in px/frame^2; defaults to GRAV. */
  gravity?: number;
  /** Deep-space backdrop for the launch-them-off-the-moon uppercut finish (used when pit is null). */
  space?: HTMLCanvasElement;
  /** One line shown on stage select. */
  blurb?: string;
  draw(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
  /** Floor width in world px; defaults to STAGE_W. */
  width?: number;
  /** Called when a new match starts here, e.g. to tidy up stage props. */
  reset?(): void;
  /** Per-frame stage simulation with access to the fighters (props they can knock around). */
  update?(f: Fight): void;
  /** Drawn over the victim in the uppercut-finish close-up; replaces the spike-impale finish. */
  pitFront?: HTMLCanvasElement;
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
  { id: 'mushroom', name: 'THE SPOREWOOD', make: (b) => new MushroomStage(b) },
  { id: 'blizzard', name: 'THE HOWLING PASS', make: (b) => new BlizzardStage(b) },
  { id: 'underground', name: 'THE UNDERDROME', make: (b) => new UndergroundStage(b) },
  { id: 'burger', name: "PATTY PETE'S", make: (b) => new BurgerStage(b) },
  { id: 'pyramid', name: 'TOMB OF THE SUN KING', make: (b) => new PyramidStage(b) },
  { id: 'moon', name: 'SEA OF SILENCE', make: () => new MoonStage() },
];

// Stages paint themselves at construction, so build each one only when first needed.
const cache = new Map<string, Arena>();
export function arena(i: number, bones: PartSet): Arena {
  const s = STAGES[i];
  let a = cache.get(s.id);
  if (!a) cache.set(s.id, (a = s.make(bones)));
  return a;
}
