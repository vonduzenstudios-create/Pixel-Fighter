import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Coral Cove": a sunny F-major calypso with a steel pan lead, a skanking guitar on the
// off-beats, bongos and shaker over a bouncing root-fifth bass.
export function beachSong(): Song {
  const notes: Note[] = [];
  const prog = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'F', 'C'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // calypso bass: root, fifth on the and-of-two, root, a walking pickup into the next bar
    [[0, 0, 3], [6, 7, 2], [8, 0, 3], [12, 12, 1], [14, 7, 2]].forEach(([st, iv, len]) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + iv, len }));
    // guitar skanks on every off-beat, a lighter strum after each
    [2, 6, 10, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 60 + ((t + 5) % 12) - 5, len: 1, vol: 0.4 })));
    [3, 11].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 60 + ((t + 5) % 12) - 5, len: 1, vol: 0.18 })));
    // light kit: kick on one and three, a rimshot clack, a busy shaker and bongos
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.6 }));
    for (let h = 0; h < 16; h++) if (h % 4 !== 0) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    [[3, 64], [7, 64], [10, 59], [11, 64], [15, 59]].forEach(([st, n]) => notes.push({ step: s + st, inst: 'tom', n, len: 1, vol: 0.45 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 60 - i * 3, len: 1, vol: 0.6 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
  });
  const lead = [
    // A: the sunny hook (bars 1-8)
    'A5 - C6 - A5 . F5 . G5 - A5 - C6 - - -',
    'Bb5 - A5 - G5 - E5 . C5 - - - . . E5 G5',
    'F5 - A5 - D6 - C6 - A5 - F5 . D5 - - -',
    'D5 . F5 . Bb5 - - - A5 . G5 . F5 - G5 -',
    'A5 - C6 - A5 . F5 . G5 - A5 - C6 - D6 -',
    'E6 - - - D6 - C6 - G5 - - - E5 - G5 -',
    'F6 - D6 - Bb5 - D6 - C6 - Bb5 - A5 - G5 -',
    'E5 - G5 - C6 - - - E6 - - - . . . .',
    // B: the bridge (bars 9-16)
    'D6 . D6 . C6 . A5 - F5 - A5 - D6 - - -',
    'D6 . C6 . Bb5 . F5 - D5 - F5 - Bb5 - - -',
    'C6 . C6 . A5 . F5 - C5 - F5 - A5 - C6 -',
    'Bb5 - A5 - G5 - E5 - C5 - - - . . . .',
    'F5 . Bb5 . D6 - - - F6 - - - D6 . Bb5 .',
    'G5 . C6 . E6 - - - G6 - - - E6 . C6 .',
    'A5 - C6 - F6 - - - E6 - D6 - C6 - A5 -',
    'G5 - - - E5 - - - C5 - D5 - E5 - G5 -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`beach bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'steel', i * 16, 0.9));
  });
  // a flute floats an octave below the steel pan through the bridge
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 124, steps: prog.length * 16, notes };
}
