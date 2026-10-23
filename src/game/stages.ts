import type { Song, SongName } from '../audio/music';
import type { PartSet, Pose } from '../gfx/rig';
import type { Fight } from './fight';
import type { Fighter } from './fighter';
import type { Particles } from './particles';
import { STAGES } from '../stages/registry';

export { STAGES };

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
  /** Screen y the falling victim comes to rest at; defaults to 150. */
  rest?: number;
  /** Frames to hold after landing before the round ends; defaults to 150. */
  length?: number;
  /** Every frame of the fall, with the victim's screen y. */
  fall?(f: Fight, y: number): void;
  /** Drawn over the victim while they are still falling. */
  drawFall?(ctx: CanvasRenderingContext2D): void;
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

/** What a stage folder's index.ts default-exports (src/stages/<id>/index.ts; the folder name is its id). */
export interface StageModule {
  /** Position in stage select; lower comes first. Ties go alphabetically by id. */
  order: number;
  /** Shown on stage select. */
  name: string;
  /** Builds the stage; called once, the first time it is picked. */
  make: (bones: PartSet) => Arena;
  /** Songs this stage brings, by name; the stage's `song` picks one of these (or a shared one such as 'fight'). */
  songs?: Record<string, () => Song>;
}

// Stages paint themselves at construction, so build each one only when first needed.
const cache = new Map<string, Arena>();
export function arena(i: number, bones: PartSet): Arena {
  const s = STAGES[i];
  let a = cache.get(s.id);
  if (!a) cache.set(s.id, (a = s.make(bones)));
  return a;
}
