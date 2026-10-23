import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Flavortown": a hot-rod rockabilly boogie in A, two loud choruses round a 12-bar blues.
export function flavortownSong(): Song {
  const notes: Note[] = [];
  const blues = ['A', 'A', 'A', 'A', 'D', 'D', 'A', 'A', 'E', 'D', 'A', 'E'];
  const prog = [...blues, ...blues];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const root = chordTones(ch)[0];
    const low = 36 + root - (root > 7 ? 12 : 0);
    // boogie-woogie walking bass: root, third, fifth, sixth, flat seven and back down
    [0, 4, 7, 9, 10, 9, 7, 4].forEach((o, i) => notes.push({ step: s + i * 2, inst: 'bass', n: low + o, len: 2 }));
    // chunky power-fifth guitar stabs on the off-beats
    [2, 6, 10, 14].forEach((st) => [0, 7].forEach((o) => notes.push({ step: s + st, inst: 'pluck', n: 57 + ((root + 3) % 12) - 3 + o, len: 1, vol: 0.4 })));
    // horn section punches at the turnaround of each line
    if (b % 4 === 3) [12, 14].forEach((st) => chordTones(ch).forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 60 + ((t + 3) % 12) - 3, len: 2, vol: 0.6 })));
    // a driving backbeat with a slapback snare
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    [5, 13].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.3 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 ? 0.6 : 1 });
    if (b % 12 === 11) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 12 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.7 });
  });
  const lead = [
    // chorus one: the swaggering riff
    'A4 . C5 . A4 . E5 - - . D5 . C5 . A4 .',
    'C5 - D5 . E5 . G5 - - . E5 . D5 . C5 .',
    'A4 . C5 . A4 . E5 - - . D5 . C5 . A4 .',
    'E5 . G5 . A5 - - - G5 . E5 . D5 . C5 .',
    'D5 . F#5 . A5 - - . F#5 . D5 . C5 . A4 .',
    'D5 . F#5 . A5 . C6 - - . A5 . F#5 . D5 .',
    'E5 - - - C5 . A4 . C5 . E5 . A5 - - -',
    'G5 . E5 . D5 . C5 . A4 - - - . . . .',
    'B4 . E5 . G#5 - - . B5 - - . G#5 . E5 .',
    'A5 - - . F#5 . D5 . A4 - - . D5 . F#5 .',
    'E5 . C#5 . A4 . C#5 . E5 . A5 - - . E5 .',
    'G#5 - - - B5 - - - E6 - - - . . . .',
    // chorus two: up an octave and twice as greasy
    'A5 . A5 . C6 . A5 . E6 - - - D6 C6 A5 .',
    'G5 . A5 . C6 . D6 . Eb6 E6 - - D6 . C6 .',
    'A5 . A5 . C6 . A5 . E6 - - - D6 C6 A5 .',
    'C6 D6 C6 A5 G5 A5 G5 E5 D5 E5 D5 C5 A4 - - -',
    'D6 - - . A5 . F#5 . A5 . D6 . F#6 - - .',
    'E6 - D6 . C6 . A5 . F#5 . A5 . D6 - - -',
    'A5 - - . E5 . A5 . C#6 - - . E6 - - .',
    'D6 . C#6 . A5 . E5 . A5 - - - . . . .',
    'B5 - G#5 . E5 . G#5 . B5 . E6 - - . D6 .',
    'C6 - A5 . F#5 . A5 . D6 - - . C6 . A5 .',
    'A5 C6 A5 E5 A5 C6 E6 - - - D6 - C6 - A5 -',
    'E5 - G#5 - B5 - E6 - - - - - . . . .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16, 0.55)));
  // the second chorus is doubled an octave down on brass for extra heat
  lead.slice(12).forEach((l, i) => line(l, 'synbrass', (i + 12) * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 160, steps: prog.length * 16, notes };
}
