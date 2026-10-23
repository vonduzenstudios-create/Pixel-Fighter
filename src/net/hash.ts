import type { Fight } from '../game/fight';

/** A checksum of what matters in the fight, so the two games can tell if they ever drift apart. */
export function hashFight(f: Fight) {
  let h = 2166136261;
  const mix = (n: number) => (h = Math.imul(h ^ (n | 0), 16777619));
  mix(f.t), mix(f.round), mix(f.timer), mix(f.projectiles.length);
  for (const g of f.f) {
    mix(Math.round(g.x * 64)), mix(Math.round(g.y * 64)), mix(g.hp), mix(g.facing);
    for (let i = 0; i < g.state.length; i++) mix(g.state.charCodeAt(i));
  }
  return h >>> 0;
}
