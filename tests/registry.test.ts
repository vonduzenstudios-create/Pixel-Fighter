// Fighters and stages are found by folder (src/fighters/<id>/, src/stages/<id>/). Check every one
// registers, builds and has what the game will ask it for.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// fighters and stages paint sprites when built: give them a canvas that accepts and ignores every call
const inert: any = new Proxy(() => inert, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : inert), apply: () => inert, construct: () => inert });
vi.stubGlobal('document', { createElement: () => ({ getContext: () => inert }) });
vi.stubGlobal('ImageData', class {});

const { FIGHTERS } = await import('../src/fighters/registry');
const { roster, partsFor } = await import('../src/chars/roster');
const { STAGES, arena } = await import('../src/game/stages');
const { getSong, songNames } = await import('../src/audio/music');
const { projDef, projKinds } = await import('../src/game/projectile');
const { FX } = await import('../src/audio/specials');
const { sfx } = await import('../src/audio/sfx');
const { manifest } = await import('../src/audio/voicemanifest');

const folders = (dir: string) =>
  readdirSync(new URL(dir, import.meta.url)).filter((d) => statSync(new URL(`${dir}/${d}`, import.meta.url)).isDirectory());

/** Every cue name a Cue value mentions (functions are always fine). */
function cueNames(c: unknown): string[] {
  if (typeof c === 'string') return [c];
  if (Array.isArray(c)) return c.flatMap(cueNames);
  return [];
}
const known = (name: string) => name in FX || name in sfx;

describe('fighter registry', () => {
  it('registers every folder in src/fighters', () => {
    expect(FIGHTERS.map((f) => f.id).sort()).toEqual(folders('../src/fighters').sort());
  });

  it('builds every fighter, with its id matching its folder', () => {
    const chars = roster();
    expect(chars.map((c) => c.id)).toEqual(FIGHTERS.map((f) => f.id));
    for (const c of chars) {
      expect(c.name, c.id).toBeTruthy();
      expect(c.specials.length, c.id).toBeGreaterThan(0);
      expect(c.finisher, c.id).toBeTruthy();
      expect(() => partsFor(c), c.id).not.toThrow();
      expect(() => partsFor(c, true), c.id).not.toThrow();
    }
  });

  it('gives fighters unique names', () => {
    const names = roster().map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses sound cues that exist', () => {
    for (const f of FIGHTERS) {
      for (const [move, s] of Object.entries(f.moveSounds ?? {})) {
        const cues = [...Object.values(s.frames ?? {}), s.impact, s.blocked].flatMap(cueNames);
        for (const c of cues) expect(known(c), `${f.id}.${move}: ${c}`).toBe(true);
      }
    }
    for (const k of projKinds()) {
      const s = projDef(k).sounds ?? {};
      const cues = [s.launch, s.travel?.cue, s.impact, s.blocked, s.clash].flatMap(cueNames);
      for (const c of cues) expect(known(c), `projectile ${k}: ${c}`).toBe(true);
    }
  });

  it('only calls FX sounds that exist (a missing one freezes the game mid-fight)', () => {
    const files = (dir: URL): URL[] =>
      readdirSync(dir).flatMap((n) => {
        const u = new URL(n, dir);
        return statSync(u).isDirectory() ? files(new URL(`${n}/`, dir)) : n.endsWith('.ts') ? [u] : [];
      });
    for (const file of files(new URL('../src/', import.meta.url))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bFX\.(\w+)\(|\bFX\[['"](\w+)['"]\]/g)) {
        const name = m[1] ?? m[2];
        expect(name in FX, `${file.pathname.split('/src/')[1]}: FX.${name}`).toBe(true);
      }
    }
  });

  it('keeps each fighter voice file to its own speaker and the announcer', () => {
    for (const id of folders('../src/fighters')) {
      const v = JSON.parse(readFileSync(new URL(`../src/fighters/${id}/voice.json`, import.meta.url), 'utf8'));
      expect(Object.keys(v.speakers), id).toEqual([id]);
      for (const l of v.lines) expect([id, 'announcer'], `${id}: ${l.file}`).toContain(l.who);
    }
    const files = manifest.lines.map((l) => l.file);
    expect(new Set(files).size, 'clip names are unique').toBe(files.length);
  });
});

describe('stage registry', () => {
  it('registers every folder in src/stages', () => {
    expect(STAGES.map((s) => s.id).sort()).toEqual(folders('../src/stages').sort());
  });

  it('builds every stage, and its song exists and composes', () => {
    const bones = partsFor(roster()[0]);
    STAGES.forEach((s, i) => {
      const a = arena(i, bones);
      expect(a, s.id).toBeTruthy();
      expect(songNames(), s.id).toContain(a.song);
      expect(getSong(a.song).notes.length, s.id).toBeGreaterThan(0);
    });
  });

  it('composes every song', () => {
    for (const n of songNames()) expect(getSong(n).steps, n).toBeGreaterThan(0);
  });
});
