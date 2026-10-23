// Every line the game speaks should have a rendered Kokoro clip (scripts/gen_voices.py).
import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { manifest } from '../src/audio/voicemanifest';
import { roster } from '../src/chars/roster';
import { DEFAULT_INTRO } from '../src/game/intro';

// roster() paints its prop sprites, so give it a canvas that accepts and ignores every call
const inert: any = new Proxy(() => inert, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : inert), apply: () => inert });
vi.stubGlobal('document', { createElement: () => ({ getContext: () => inert }) });
vi.stubGlobal('ImageData', class {});

// A fighter's spoken finisher line: an exported `<NAME>_LINES` with a `finisher` string in its fighter.ts.
const fighterFiles = import.meta.glob<Record<string, unknown>>('../src/fighters/*/fighter.ts', { eager: true });
const finisherLines = Object.values(fighterFiles).flatMap((m) =>
  Object.entries(m)
    .filter(([k, v]) => k.endsWith('_LINES') && typeof (v as { finisher?: unknown })?.finisher === 'string')
    .map(([, v]) => (v as { finisher: string }).finisher),
);

const texts = new Set(manifest.lines.map((l) => l.text));
const clip = (file: string) => new URL(`../public/voices/${file}.mp3`, import.meta.url);

describe('voice lines', () => {
  it('has a clip file for every manifest line, from a known speaker', () => {
    for (const l of manifest.lines) {
      expect(existsSync(clip(l.file)), l.file).toBe(true);
      expect(Object.keys(manifest.speakers), l.file).toContain(l.who);
    }
  });

  it('keeps every speaker distinct: its own voice, or one shifted 10%+ in pitch from any sharer', () => {
    const list = Object.entries(manifest.speakers) as [string, { voice: string; pitch?: number; robot?: boolean }][];
    list.forEach(([a, x], i) => {
      for (const [b, y] of list.slice(i + 1)) {
        if (x.voice !== y.voice || !!x.robot !== !!y.robot) continue;
        expect(Math.abs((x.pitch ?? 1) - (y.pitch ?? 1)), `${a} and ${b} both use ${x.voice}`).toBeGreaterThanOrEqual(0.1);
      }
    });
  });

  it('covers every intro, finisher line and announcer call', () => {
    const want = [DEFAULT_INTRO.line, ...finisherLines, 'Fight!', 'End them!', 'Obliteration!', 'Round 1', 'Round 2', 'Round 3'];
    for (const c of roster()) {
      if (c.intro) want.push(c.intro.line);
      want.push(`${c.name} wins`);
    }
    for (const t of want) expect(texts.has(t), t).toBe(true);
  });
});

describe('win-screen taunts', () => {
  const ids = new Set(roster().map((c) => c.id));
  const wins = manifest.lines.filter((l) => l.win);

  it('gives every fighter at least three of its own voiced taunts', () => {
    for (const c of roster()) {
      const own = wins.filter((l) => l.who === c.id && l.win === true);
      expect(own.length, `${c.id} win lines`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every taunt unique across the roster, aimed only at real opponents', () => {
    const seen = new Set<string>();
    for (const l of wins) {
      expect(seen.has(l.text), l.text).toBe(false);
      seen.add(l.text);
      expect(l.text, l.file).not.toMatch(/\{L\}/);
      if (l.win !== true) expect(ids.has(l.win as string), `${l.file} targets ${l.win}`).toBe(true);
    }
  });

  it('picks the winner\'s own line, or the one written for this opponent', async () => {
    vi.stubGlobal('window', { addEventListener: () => {} }); // the input module listens for keys on import
    const { pickQuote, winLines } = await import('../src/scenes/postmatch');
    const r = roster(), by = (id: string) => r.find((c) => c.id === id)!;
    const [hawking, tesla, lincoln] = ['hawking', 'tesla', 'lincoln'].map(by);
    expect(pickQuote(hawking, tesla, () => 0)).toBe(winLines(hawking, tesla).vs);
    expect(winLines(hawking, lincoln).any).toContain(pickQuote(hawking, lincoln, () => 0.9));
  });
});
