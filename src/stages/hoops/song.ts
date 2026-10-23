import { type Note, type Song, chordTones, line, nn } from '../../audio/music';

// "The Hardwood": a game-night arena funk in G minor. Organ stabs, slap bass and handclaps,
// a punchy brass riff up front, then a soaring lead and an organ run that climbs into the loop.
export function hoopsSong(): Song {
  const notes: Note[] = [];
  const prog = ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Gm', 'Cm', 'D', 'Eb', 'F', 'Gm', 'Eb', 'Cm', 'D', 'Gm', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 6 ? 12 : 0);
    // slap bass: root thumb, octave pop, a fifth and a dead-note pickup into the next bar
    [[0, 0, 2], [3, 12, 1], [5, 0, 1], [7, 7, 1], [8, 0, 2], [11, 12, 1], [13, 10, 1], [14, 0, 1], [15, 12, 1]].forEach(([st, iv, len]) =>
      notes.push({ step: s + st, inst: 'bass', n: lo + iv, len }));
    // organ stabs on the off-beats, voiced in octave 4
    [2, 6, 10, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'reed', n: 62 + ((t + 10) % 12) - 10 + 12, len: 1, vol: 0.9 })));
    // kit: kick on 1, the and-of-2 and 3; claps (snare + clack) on 2 and 4
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => {
      notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.7 });
      notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.8 });
    });
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    notes.push({ step: s + 15, inst: 'hat', n: 0, len: 1 });
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.7 });
    if (b % 4 === 3 && b !== 15) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    // a low string pad holds it together in the second half
    if (b >= 8) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.03 }));
  });
  // A: the brass riff, a call and an answer (bars 1-8)
  const riff = [
    'G4 . . Bb4 . C5 . D5 - - . . F5 . D5 .',
    'C5 - . Bb4 . G4 . . . . . . . . . .',
    'G4 . . Bb4 . C5 . Eb5 - - . . D5 . C5 .',
    'C5 - . A4 . F4 . . . . . . . . . .',
    'G4 . . Bb4 . C5 . D5 - - . . F5 . G5 .',
    'F5 - . D5 . Bb4 . . C5 . D5 . . . . .',
    'Eb5 - - . C5 . G4 . Eb5 - - . D5 . C5 .',
    'D5 - - - - - F#4 . A4 . C5 . D5 - - -',
  ];
  riff.forEach((l, i) => notes.push(...line(l, 'synbrass', i * 16, 0.9)));
  // B: the lead takes off (bars 9-16)
  const lead = [
    'G5 - - - Bb5 - - - G5 - F5 - Eb5 - - -',
    'F5 - - - A5 - - - C6 - - - A5 - - -',
    'Bb5 - - - A5 - G5 - D5 - - - G5 - Bb5 -',
    'G5 - - - - - Eb5 - F5 - G5 - Bb5 - - -',
    'C6 - - - Bb5 - G5 - Eb5 - G5 - C6 - - -',
    'A5 - - - F#5 - - - D5 - - - - - - -',
    'G5 . G5 . Bb5 . G5 . D6 - - - C6 - Bb5 -',
    'A5 - - - - - - - . . . . . . . .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', (i + 8) * 16, 0.7)));
  // the organ run that climbs back into the top of the loop
  'D4 E4 F#4 G4 A4 Bb4 C5 D5'.split(' ').forEach((n, i) => notes.push({ step: 15 * 16 + 8 + i, inst: 'reed', n: nn(n) + 12, len: 1, vol: 1 }));
  return { bpm: 124, steps: prog.length * 16, notes };
}
