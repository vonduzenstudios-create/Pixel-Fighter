import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Inferno": a galloping kitchen-rush rocker in E Phrygian dominant, all burners lit. The
// first pass is a low, snarling guitar; the second goes up an octave with brass on top.
export function infernoSong(): Song {
  const notes: Note[] = [];
  const verse = ['E', 'F', 'E', 'F', 'Am', 'G', 'F', 'E', 'Dm', 'E', 'Am', 'E', 'F', 'G', 'F', 'E'];
  const prog = [...verse, ...verse];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const root = chordTones(ch)[0];
    const low = 36 + root - (root > 7 ? 12 : 0);
    const second = b >= 16;
    // the gallop: eighth then two sixteenths, all the way through
    [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'bass', n: low + (st === 14 ? 12 : 0), len: 1 }));
    // power-fifth chugs on the guitar, opening up on the downbeats
    [0, 8].forEach((st) => [0, 7, 12].forEach((o) => notes.push({ step: s + st, inst: 'guitar', n: low + 12 + o, len: st ? 6 : 4, vol: 0.5 })));
    [4, 6, 12, 14].forEach((st) => [0, 7].forEach((o) => notes.push({ step: s + st, inst: 'guitar', n: low + 12 + o, len: 1, vol: 0.3 })));
    // brass hits at the end of every eight bars, and riding the whole second pass
    if (b % 8 === 7 || (second && b % 2 === 0))
      chordTones(ch).forEach((t) => notes.push({ step: s + (b % 8 === 7 ? 12 : 0), inst: 'synbrass', n: 60 + ((t + 4) % 12) - 4, len: b % 8 === 7 ? 4 : 2, vol: 0.5 }));
    // pounding drums with a double kick under the gallop
    [0, 3, 8, 11].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 ? 0.5 : 0.9 });
    // castanet clacks on the off-sixteenths, like knives on a board
    if (second || b % 4 >= 2) [1, 5, 9, 13].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.45 }));
    if (b % 8 === 7) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.8 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.7 });
  });
  const lead = [
    'E5 . F5 . G#5 . E5 . B5 - - . A5 G#5 F5 .',
    'E5 - - . F5 . A5 . C6 - B5 . A5 . G#5 .',
    'E5 . F5 . G#5 . B5 . E6 - - . D6 C6 B5 .',
    'C6 - B5 . A5 - G#5 . F5 - - . E5 - - -',
    'A5 . C6 . E6 - - . C6 . A5 . E5 . A5 .',
    'B5 - - . D6 . B5 . G5 - - . D5 . G5 .',
    'A5 . C6 . F6 - - . E6 . D6 . C6 . A5 .',
    'G#5 - - - B5 - - - E6 - - - . . . .',
    'D6 . F6 . D6 . A5 . F5 . A5 . D6 - - .',
    'E6 . D6 . C6 . B5 . G#5 - - . E5 - - .',
    'C6 . B5 . A5 . E5 . A5 . C6 . E6 - - .',
    'F6 - E6 . D6 . C6 . B5 . G#5 . F5 . E5 .',
    'F5 G#5 B5 D6 F6 - - . E6 . D6 . C6 . B5 .',
    'D6 - - . B5 . G5 . D6 - - . G6 - - .',
    'F6 E6 D6 C6 B5 A5 G#5 F5 E5 F5 G#5 A5 B5 C6 D6 .',
    'E6 - - - - - - - . . B5 . E6 . . .',
  ];
  // first pass: the riff growled an octave down on lead guitar
  lead.forEach((l, i) => line(l, 'gtrlead', i * 16, 0.6).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  // second pass: screaming up top, doubled on brass an octave below
  lead.forEach((l, i) => {
    notes.push(...line(l, 'lead', (i + 16) * 16, 0.5));
    line(l, 'synbrass', (i + 16) * 16, 0.3).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
  });
  return { bpm: 168, steps: prog.length * 16, notes };
}
