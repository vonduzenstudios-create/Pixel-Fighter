import type { Pose } from '../gfx/rig';
import type { Fighter } from './fighter';
import type { Fight } from './fight';

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
  prop?: 'axe' | 'sword' | 'cutlass' | 'nunchaku' | null;
  propBehind?: boolean;
  onFrame?: (self: Fighter, fight: Fight, frame: number) => void;
  whoosh?: boolean;
  /** Frames during which the fighter is not drawn and cannot be hit. */
  invisible?: [number, number];
  /** Toggle facing every N frames (spinning attacks). */
  spin?: number;
}

export type Btn = 'lp' | 'hp' | 'lk' | 'hk';

export interface Special {
  name: string;
  /** Directions relative to facing, numpad notation (6 = toward the opponent). */
  cmd: number[];
  btn: Btn | 'p' | 'k';
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
