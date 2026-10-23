import { NAMES, type Note, type Song, line } from '../../audio/music';

// "The Decibel Dome": the Chrome Howlers' arena anthem. Chugging E minor power chords,
// a pounding rock beat and a soaring lead line. An original composition.
export function concertSong(): Song {
  const notes: Note[] = [];
  const prog = ['E', 'E', 'C', 'D', 'E', 'E', 'G', 'D', 'A', 'A', 'C', 'D', 'E', 'G', 'D', 'B'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const root = NAMES[ch];
    const low = (root - 4 + 12) % 12; // semitones above E
    if (b < 8) {
      // palm-muted chugs with an accent on the one
      [0, 2, 3, 6, 8, 10, 11, 14].forEach((st) => notes.push({ step: s + st, inst: 'guitar', n: 40 + low, len: 1, vol: st === 0 ? 1 : 0.6 }));
    } else {
      // the chorus opens up into ringing chords
      [[0, 6], [6, 2], [8, 6], [14, 2]].forEach(([st, len]) => notes.push({ step: s + st, inst: 'guitar', n: 40 + low, len, vol: 0.9 }));
    }
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: 28 + low, len: 1 });
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.8 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
  });
  const lead = [
    // verse (bars 1-8)
    'E5 - - - G5 - A5 - B5 - - - A5 - G5 -',
    'E5 - - - D5 - E5 - . . . . . . . .',
    'G5 - - - E5 - G5 - C6 - - - B5 - A5 -',
    'A5 - - - F#5 - - - D5 - - - . . . .',
    'E5 - - - G5 - A5 - B5 - - - D6 - B5 -',
    'E6 - - - D6 - B5 - A5 - G5 - E5 - - -',
    'D5 - G5 - B5 - D6 - B5 - G5 - D6 - - -',
    'F#5 - - - A5 - - - D6 - - - . . . .',
    // chorus (bars 9-16)
    'A5 - - - - - C6 - E6 - - - D6 - C6 -',
    'A5 - - - E5 - - - A5 - B5 - C6 - - -',
    'G5 - - - - - E5 - G5 - - - C6 - - -',
    'D6 - - - C6 - B5 - A5 - - - F#5 - - -',
    'E6 - D6 - B5 - D6 - E6 - - - G6 - - -',
    'F#6 - - - E6 - D6 - B5 - - - D6 - - -',
    'D6 - - - - - - - A5 - - - F#5 - - -',
    'B5 - - - - - - - D#6 - - - F#6 - - -',
  ];
  lead.forEach((l, i) => line(l, 'gtrlead', i * 16, 0.8).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 150, steps: prog.length * 16, notes };
}
