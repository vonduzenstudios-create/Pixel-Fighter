import type { SongName } from '../audio/music';
import type { PartSet, Pose } from '../gfx/rig';
import type { Fight } from './fight';
import type { Fighter } from './fighter';
import { MoonStage } from './moon';
import { Stage } from './stage';
import { TrainStage } from './train';
import { BoatStage } from './boat';
import { SkyscraperStage } from './skyscraper';
import { MushroomStage } from './mushroom';
import { BlizzardStage } from './blizzard';
import { UndergroundStage } from './underground';
import { BurgerStage } from './burger';
import { ConcertStage } from './concert';
import type { Particles } from './particles';
import { FlavortownStage } from './flavortown';
import { DojoStage } from './dojo';
import { RunwayStage } from './runway';
import { LabStage } from './lab';

/** A custom bottom-of-the-pit landing for the uppercut stage finish, in place of the spikes. */
export interface PitLanding {
  /** How the victim lies once they hit the bottom. */
  pose: Pose;
  /** The moment they hit. */
  land(f: Fight): void;
  /** Every frame after landing; it counts up from 1. */
  tick(f: Fight, it: number): void;
  /** Drawn over the victim in the close-up. */
  draw(ctx: CanvasRenderingContext2D, it: number): void;
  /** Per-frame changes to the landed victim before they are drawn (pose, x-ray, tint); returns a y offset. */
  victim?(l: Fighter, it: number): number;
}

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
  /** Extra effects each frame after the victim lands in a pitFront finish (it = frames since landing). */
  pitTick?(p: Particles, it: number): void;
  /** Colour of the stake tip drawn through the victim in the pit finish; defaults to steel. */
  stakeColor?: string;
  /** Optional vertical offset (screen px) for the floor, fighters and effects, e.g. a rocking deck. */
  bob?(t: number): number;
  /** Replaces the spike impale at the bottom of the uppercut-finish drop. */
  pitLanding?: PitLanding;
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
  { id: 'concert', name: 'THE DECIBEL DOME', make: (b) => new ConcertStage(b) },
  { id: 'flavortown', name: 'FLAVORTOWN', make: (b) => new FlavortownStage(b) },
  { id: 'dojo', name: 'IRONWOOD DOJO', make: (b) => new DojoStage(b) },
  { id: 'runway', name: 'THE RUNWAY', make: (b) => new RunwayStage(b) },
  { id: 'lab', name: 'THE COIL WORKS', make: (b) => new LabStage(b) },
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
