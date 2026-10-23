import { A, P, STANCE } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import { Projectile, type ProjDef, type ProjKind } from '../game/projectile';
import type { Move, MoveSounds } from '../game/types';

/**
 * What a fighter folder's index.ts default-exports (src/fighters/<id>/index.ts). The folder name
 * must equal the CharDef id. src/fighters/registry.ts finds every folder on its own, so adding a
 * fighter never touches a shared file. See README "Adding a fighter".
 */
export interface FighterModule {
  /** Position on the select screen; lower comes first. Ties go alphabetically by id. */
  order: number;
  /** Builds the fighter (sprites, moves, intro, portrait, taunts). Called once. */
  make(): CharDef;
  /** Sound design for this fighter's moves, by move id (a Move's own `sounds` wins). */
  moveSounds?: Record<string, MoveSounds>;
  /** Projectile kinds this fighter throws, by kind name (must be unique across fighters). */
  projectiles?: Record<ProjKind, ProjDef>;
  /** Extra named sound cues, usable anywhere a Cue is (merged into the shared FX table). */
  fx?: Record<string, () => void>;
}

/** The standard throw: wind up, release `kind` at frame `at` from `height`, follow through. */
export function throwProj(kind: ProjKind, at: number, height = 52, sound: string = 'whoosh'): Move {
  return {
    id: 'proj_' + kind,
    anim: A([
      [P(STANCE, { af: 50, ef: -70, ab: -40, t: -6, h: -6 }), at],
      [P(STANCE, { af: -94, ef: -2, ab: 25, eb: -20, t: 22, lf: -40, kf: 40, lb: 30, kb: 8 }), 10],
      [P(STANCE, { af: -90, ef: -10, t: 16 }), 12],
      [STANCE, 6],
    ]),
    onFrame: (self: Fighter, f: Fight, fr: number) => {
      if (fr === at + 2) {
        f.projectiles.push(new Projectile(self, kind, self.x + self.facing * 24, height));
        self.projOut = true;
        f.sfx(sound);
      }
    },
  };
}
