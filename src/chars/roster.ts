import { buildParts } from './build';
import type { CharDef } from '../game/fighter';
import { FIGHTERS } from '../fighters/registry';

// The fighters, in select-screen order. Each one lives in its own folder under src/fighters/.
let cache: CharDef[] | null = null;
export function roster(): CharDef[] {
  return (cache ??= FIGHTERS.map((m) => m.make()));
}

const partCache = new Map<string, ReturnType<typeof buildParts>>();
export function partsFor(c: CharDef, alt = false) {
  const k = c.id + (alt ? '_alt' : '');
  let p = partCache.get(k);
  if (!p) {
    const L = alt ? c.alt : c.look;
    p = c.sprites ? c.sprites(L) : buildParts(L);
    partCache.set(k, p);
  }
  return p;
}
