import { FLOOR } from '../core/consts';
import type { Fighter } from './fighter';
import type { Fight } from './fight';
import type { Effect, Level } from './types';
import { playCue, type ProjSounds } from '../audio/specials';

/** Projectile kinds are registered by the fighters that throw them (src/fighters/<id>/index.ts). */
export type ProjKind = string;

export interface ProjStats {
  dmg: number;
  level: Level;
  effect: Effect;
  r: number;
  /** Launch speed in px/frame along the thrower's facing. */
  speed: number;
  /** Survives clashes and hits (it stops hurting once spent). */
  sturdy?: boolean;
}

/** Everything about one kind of projectile. */
export interface ProjDef {
  stats: ProjStats;
  sounds?: ProjSounds;
  /** Called once when it is thrown. */
  init?(pr: Projectile): void;
  /** Per-frame behaviour, before it moves by (vx, vy). */
  update?(pr: Projectile, f: Fight): void;
  /** update moves it and decides when it is gone: no automatic motion, culling or travel sound. */
  selfMoving?: boolean;
  /** Drawn with the context translated to the projectile; (sx, sy) is that point on screen. */
  draw(ctx: CanvasRenderingContext2D, pr: Projectile, sx: number, sy: number): void;
  /** Stays on screen, harmless, after it hits (a sprouted tree) instead of breaking. */
  keepAfterHit?: boolean;
  /** Extra effects when it connects (blocked or not). */
  onHit?(pr: Projectile, f: Fight): void;
}

const KINDS = new Map<ProjKind, ProjDef>();

/** Register projectile kinds; src/fighters/registry.ts does this for every fighter folder. */
export function defineProjectiles(defs: Record<ProjKind, ProjDef>) {
  for (const [kind, def] of Object.entries(defs)) {
    if (KINDS.has(kind) && KINDS.get(kind) !== def) throw new Error(`projectile kind "${kind}" is defined twice`);
    KINDS.set(kind, def);
  }
}

export function projDef(kind: ProjKind): ProjDef {
  const d = KINDS.get(kind);
  if (!d) throw new Error(`unknown projectile kind: ${kind}`);
  return d;
}

export function projKinds(): ProjKind[] {
  return [...KINDS.keys()];
}

export class Projectile {
  vx: number;
  vy = 0;
  t = 0;
  dead = false;
  /** Already hit; still drawn but harmless. */
  spent = false;
  dmg: number; level: Level; effect: Effect; r: number;
  /** Frame a lobbed projectile hit the floor. */
  landed = 0;
  /** Survives clashes and hits (it stops hurting once spent). */
  sturdy: boolean;
  /** Free per-projectile state for its kind's update and draw. */
  data: any = {};
  readonly def: ProjDef;
  constructor(public owner: Fighter, public kind: ProjKind, public x: number, public y: number) {
    const d = (this.def = projDef(kind));
    const s = d.stats;
    this.vx = s.speed * owner.facing;
    this.dmg = s.dmg; this.level = s.level; this.effect = s.effect; this.r = s.r;
    this.sturdy = !!s.sturdy;
    d.init?.(this);
    playCue(d.sounds?.launch);
  }

  update(f: Fight) {
    this.t++;
    const d = this.def;
    if (d.selfMoving) return d.update?.(this, f);
    const travel = d.sounds?.travel;
    if (travel && this.t % travel.every === 0) playCue(travel.cue);
    d.update?.(this, f);
    this.x += this.vx;
    this.y += this.vy;
    if (this.t > 220 || this.x < -40 || this.x > 560) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number) {
    const sx = Math.round(this.x - camX), sy = Math.round(FLOOR - this.y);
    ctx.save();
    ctx.translate(sx, sy);
    this.def.draw(ctx, this, sx, sy);
    ctx.restore();
  }
}
