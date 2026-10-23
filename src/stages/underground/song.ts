import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Underdrome": a grimy C-minor boom-bap stomp. Clacking breakbeat and a prowling bass,
// brass stabs join in, then a sneering lead takes over the second half.
export function undergroundSong(): Song {
  const notes: Note[] = [];
  const prog = ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Cm', 'Fm', 'G', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'Ab', 'G', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 6 ? 12 : 0);
    // prowling bass: root, root, octave jab, minor third slide, root
    [[0, 0, 2], [3, 0, 1], [6, 12, 1], [8, 0, 2], [10, tones[1] - root, 1], [12, 0, 1], [14, 7, 1]].forEach(([st, iv, len]) =>
      notes.push({ step: s + st, inst: 'bass', n: lo + iv, len }));
    // boom-bap kit with a hand clack on the back of every bar
    [0, 7, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    notes.push({ step: s + 15, inst: 'clack', n: 0, len: 1, vol: 0.7 });
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.8 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1 });
    // dark pad underneath
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.025 }));
    // brass stabs from bar 5
    if (b >= 4) [0, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 55 + ((t + 5) % 12), len: 2, vol: 0.8 })));
    if (b % 8 === 0) notes.push({ step: s, inst: 'timp', n: 36, len: 6 });
  });
  // a creeping arpeggio hook for the first half
  for (let b = 0; b < 8; b++) {
    const tones = chordTones(prog[b]);
    [0, 3, 6, 9, 11].forEach((st, i) => notes.push({ step: b * 16 + st, inst: 'arp', n: 72 + ((tones[i % 3] + 12) % 12), len: 1 }));
  }
  const lead = [
    'C5 - - Eb5 - - G5 - F5 - Eb5 - D5 - C5 -',
    'Eb5 - - - D5 - C5 - Bb4 - - - C5 - - -',
    'C5 - - - Eb5 - - - Ab5 - G5 - F5 - Eb5 -',
    'D5 - - - Bb4 - - - C5 - D5 - F5 - - -',
    'G5 - - - - - Ab5 - G5 - F5 - Eb5 - - -',
    'C5 - Eb5 - G5 - C6 - - - Bb5 - G5 - - -',
    'Ab5 - - - G5 - F5 - C5 - - - Eb5 - F5 -',
    'G5 - - - B4 - - - D5 - - - G5 - - -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', (i + 8) * 16, 0.75)));
  return { bpm: 96, steps: prog.length * 16, notes };
}
