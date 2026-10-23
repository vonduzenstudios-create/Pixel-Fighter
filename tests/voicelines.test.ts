// Every line the game speaks should have a rendered Kokoro clip (scripts/gen_voices.py).
import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../src/audio/voicelines.json';
import { roster } from '../src/chars/roster';
import { HAWKING_LINES } from '../src/chars/hawking';
import { DEFAULT_INTRO } from '../src/game/intro';

// roster() paints its prop sprites, so give it a canvas that accepts and ignores every call
const inert: any = new Proxy(() => inert, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : inert), apply: () => inert });
vi.stubGlobal('document', { createElement: () => ({ getContext: () => inert }) });
vi.stubGlobal('ImageData', class {});

const texts = new Set(manifest.lines.map((l) => l.text));
const clip = (file: string) => new URL(`../public/voices/${file}.mp3`, import.meta.url);

describe('voice lines', () => {
  it('has a clip file for every manifest line, from a known speaker', () => {
    for (const l of manifest.lines) {
      expect(existsSync(clip(l.file)), l.file).toBe(true);
      expect(Object.keys(manifest.speakers), l.file).toContain(l.who);
    }
  });

  it('covers every intro, finisher line and announcer call', () => {
    const want = [DEFAULT_INTRO.line, HAWKING_LINES.finisher, 'Fight!', 'End them!', 'Obliteration!', 'Round 1', 'Round 2', 'Round 3'];
    for (const c of roster()) {
      if (c.intro) want.push(c.intro.line);
      want.push(`${c.name} wins`);
    }
    for (const t of want) expect(texts.has(t), t).toBe(true);
  });
});
