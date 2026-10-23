import type { Pose } from '../gfx/rig';
import type { Fighter } from './fighter';
import type { Fight } from './fight';

export type PropName = 'axe' | 'sword' | 'cutlass' | 'nunchaku' | 'check' | 'brush' | 'knife' | 'book' | 'cane' | 'skillet' | 'drumstick' | 'spatula';
export type Level = 'high' | 'mid' | 'low' | 'overhead';
export type Effect = 'light' | 'heavy' | 'knockdown' | 'launch' | 'sweep';
export type Limb = 'handF' | 'handB' | 'toeF' | 'toeB' | 'kneeF' | 'prop' | 'body';

export interface HitDef {
  limb: Limb;
  r: number;
  dmg: number;
  level: Level;
  effect: Effect;
  push?: number;
  stun?: number;
  /** Frames between repeat hits for multi-hit moves. */
  rehit?: number;
  special?: boolean;
  /** Launch arc for effect 'launch': [upward speed, speed away]. */
  lift?: [number, number];
  sfx?: 'light' | 'heavy' | 'slash' | 'zap' | 'burn';
}

/** A sound to play: a name from the special FX or shared sfx, a list of names to layer, or a function. */
export type Cue = string | Cue[] | (() => void);

/** Layered sounds for a special move. See src/audio/specials.ts. */
export interface MoveSounds {
  /** Cues keyed by move frame: windup, cast, release, footsteps... */
  frames?: Record<number, Cue>;
  /** Layered on top of the generic hit sound when the move connects. */
  impact?: Cue;
  /** Layered on top of the block sound when the move is guarded. */
  blocked?: Cue;
}

export interface Anim {
  keys: [Pose, number][];
  loop?: boolean;
}

export interface Move {
  id: string;
  anim: Anim;
  active?: [number, number];
  hit?: HitDef;
  air?: boolean;
  crouch?: boolean;
  /** Forward speed per frame (or a function of the move frame). */
  vx?: number | ((frame: number) => number);
  prop?: PropName | null;
  propBehind?: boolean;
  onFrame?: (self: Fighter, fight: Fight, frame: number) => void;
  whoosh?: boolean;
  /** Per-move sound design; falls back to MOVE_SOUNDS[id] in src/audio/specials.ts. */
  sounds?: MoveSounds;
  /** Frames during which the fighter is not drawn and cannot be hit. */
  invisible?: [number, number];
  /** Toggle facing every N frames (spinning attacks). */
  spin?: number;
  /** Counter stance: a hit landing during frames [from, to) is absorbed and `move` fires instead. */
  counter?: { from: number; to: number; move: Move };
}

export type Btn = 'lp' | 'hp' | 'lk' | 'hk';

export interface Special {
  name: string;
  /** Directions relative to facing, numpad notation (6 = toward the opponent). */
  cmd: number[];
  btn: Btn | 'p' | 'k';
  /** Button-mash alternative: tapping this button rapidly fires the move too, even out of a normal attack. */
  mash?: Btn | 'p' | 'k';
  text: string;
  move: Move;
}

export interface Finisher {
  name: string;
  cmd: number[];
  btn: Btn;
  text: string;
  range: [number, number];
}
