import { type Note, type Song, chordTones, line } from '../../audio/music';

export function hillsSong(): Song {
  const notes: Note[] = [];
  const prog = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // bouncing octave bass on the eighths
    for (let e = 0; e < 8; e++) notes.push({ step: s + e * 2, inst: 'bass', n: 36 + root + (e % 2 ? 12 : 0), len: 1 });
    // a sparkly rising arpeggio under everything
    for (let h = 0; h < 16; h++) notes.push({ step: s + h, inst: 'arp', n: 60 + ((tones[h % 3] + 5) % 12) - 5 + (h % 8 >= 4 ? 12 : 0), len: 1, vol: 0.22 });
    // peppy kit: kick on the beat with a skip, snare backbeat, hats on every eighth
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 64 - i * 4, len: 1, vol: 0.6 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
  });
  const lead = [
    // A: the skipping meadow tune (bars 1-8)
    'G5 - B5 - D6 - B5 . C6 - B5 - A5 - G5 -',
    'F#5 - A5 - D6 - - - C6 . B5 . A5 - - -',
    'E5 - G5 - B5 - E6 - D6 - B5 - G5 - B5 -',
    'C6 - - - E6 - D6 - C6 - B5 - A5 - - -',
    'G5 - B5 - D6 - B5 . C6 - B5 - A5 - G5 -',
    'A5 - D6 - F#6 - - - E6 . D6 . C6 - A5 -',
    'G5 . A5 . C6 - E6 - D6 - C6 - B5 - A5 -',
    'D6 - - - - - - - . . A5 B5 C6 B5 A5 F#5',
    // B: the climb to the top of the hill (bars 9-16)
    'E6 - - - D6 - C6 - G5 - - - C6 - - -',
    'F#6 - - - E6 - D6 - A5 - - - D6 - - -',
    'D6 - B5 - F#5 - B5 - D6 - F#6 - E6 - D6 -',
    'E6 - - - B5 - G5 - E5 - G5 - B5 - - -',
    'C6 . E6 . G6 - - - E6 . C6 . G5 - - -',
    'D6 . F#6 . A6 - - - F#6 . D6 . A5 - - -',
    'B5 - D6 - G6 - - - F#6 - E6 - D6 - B5 -',
    'A5 - - - B5 - C6 - D6 - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`hills bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'lead', i * 16, 0.8));
  });
  // bells chime the tune an octave down through the climb
  lead.slice(8).forEach((l, i) => line(l, 'bell', (i + 8) * 16, 0.45).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 150, steps: prog.length * 16, notes };
}
