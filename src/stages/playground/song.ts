import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Recess Rumble": a bouncy G-major schoolyard romp. A plinky toy-piano hook over a two-step
// bass, handclaps on the backbeat and a whistle-bright flute answering through the second half.
export function playgroundSong(): Song {
  const notes: Note[] = [];
  const prog = ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'Am', 'D', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // two-step bass: root and fifth, with a skipping pickup
    [[0, 0, 3], [4, 7, 2], [8, 0, 3], [11, 12, 1], [12, 7, 2], [14, 4, 1]].forEach(([st, iv, len]) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + iv, len }));
    // bouncy chord plinks on the off-beats
    [2, 6, 10, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 60 + ((t + 5) % 12) - 5, len: 1, vol: 0.3 })));
    // kick, handclaps on two and four, a hopping hat
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.7 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.5 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h + 1, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 64 - i * 3, len: 1, vol: 0.5 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.4 });
  });
  const lead = [
    // A: the hopscotch hook (bars 1-8)
    'D5 . G5 . B5 . G5 . A5 - B5 - D6 - - -',
    'B5 . G5 . E5 - - - G5 . B5 . E6 - - -',
    'E6 . D6 . C6 . E6 . G5 - - - A5 - B5 -',
    'A5 - - - F#5 . A5 . D6 - C6 - B5 - A5 -',
    'D5 . G5 . B5 . G5 . A5 - B5 - D6 - E6 -',
    'D6 - B5 - G5 - B5 - E6 - - - D6 . B5 .',
    'C6 . A5 . E5 . A5 . C6 - E6 - D6 - C6 -',
    'B5 - A5 - F#5 - A5 - D5 - - - . . . .',
    // B: tag, you're it (bars 9-16)
    'E5 . G5 . C6 - - - E6 . D6 . C6 - G5 -',
    'F#5 . A5 . D6 - - - F#6 . E6 . D6 - A5 -',
    'B5 . D6 . F#6 - - - D6 . B5 . F#5 - D6 -',
    'E6 - - - B5 - - - G5 - B5 - E6 - - -',
    'G6 . E6 . C6 - - - E6 . C6 . G5 - C6 -',
    'A5 . C6 . E6 - - - C6 . A5 . E5 - A5 -',
    'D6 - - - F#6 - - - A6 - - - F#6 - D6 -',
    'A5 - B5 - C6 - C#6 - D6 - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`playground bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'arp', i * 16, 1.3));
    line(l, 'pluck', i * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n + 12 })); // toy-piano sparkle
  });
  // a flute answers an octave down through the second half
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.45).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 140, steps: prog.length * 16, notes };
}
