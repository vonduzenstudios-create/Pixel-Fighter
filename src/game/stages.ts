import type { SongName } from '../audio/music';
import type { PartSet } from '../gfx/rig';
import { MoonStage } from './moon';
import { Stage } from './stage';

/** What a fight needs from a stage: its look, its music and its stage finish. */
export interface Arena {
  name: string;
  song: SongName;
  /** Spike-pit backdrop; the uppercut pit finish only exists when this is set. */
  pit: HTMLCanvasElement | null;
  /** Fighter gravity in px/frame^2; defaults to GRAV. */
  gravity?: number;
  /** Deep-space backdrop for the launch-them-off-the-moon uppercut finish. */
  space?: HTMLCanvasElement;
  /** One line shown on stage select. */
  blurb?: string;
  draw(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
  drawFront(ctx: CanvasRenderingContext2D, camX: number, t: number): void;
}

interface StageEntry {
  id: string;
  name: string;
  make: (bones: PartSet) => Arena;
}

const cache = new Map<string, Arena>();
const lazy = (id: string, f: (bones: PartSet) => Arena) => (bones: PartSet) => {
  let a = cache.get(id);
  if (!a) cache.set(id, (a = f(bones)));
  return a;
};

export const STAGES: StageEntry[] = [
  { id: 'gorge', name: 'THE THORN GORGE', make: lazy('gorge', (b) => new Stage(b)) },
  { id: 'moon', name: 'SEA OF SILENCE', make: lazy('moon', () => new MoonStage()) },
];
