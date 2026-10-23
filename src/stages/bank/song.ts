import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Fort Fortune": a sly after-hours heist theme. A walking bass and brushed swing hats under a
// tiptoeing pluck melody, with a cash-register bell on the downbeat; the second half brings
// in the brass section with fat stabs and a bigger, bolder tune for the getaway.
export function bankSong(): Song {
  const notes: Note[] = [];
  const prog = ['Cm', 'Cm', 'Fm', 'G', 'Cm', 'Ab', 'Fm', 'G', 'Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'Ab', 'G', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 6 ? 12 : 0);
    // walking bass: root, third, fifth, then a chromatic step toward the next chord
    const next = chordTones(prog[(b + 1) % prog.length])[0];
    const lead = 36 + next - (next > 6 ? 12 : 0);
    [[0, lo], [4, lo + ((tones[1] - root + 12) % 12)], [8, lo + 7], [12, lead + (lead > lo ? -1 : 1)]].forEach(([st, n]) => notes.push({ step: s + st, inst: 'bass', n, len: 3 }));
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.03 }));
    // swung ride: long-short pairs
    [0, 3, 4, 7, 8, 11, 12, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1, vol: i % 2 ? 0.45 : 0.85 }));
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 10, inst: 'kick', n: 0, len: 1, vol: 0.7 });
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: b >= 8 ? 'snare' : 'clack', n: 0, len: 1, vol: b >= 8 ? 0.7 : 0.5 }));
    if (b >= 8) {
      // brass stabs on the and-of-two and the four
      [6, 12].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 55 + ((t + 5) % 12), len: st === 12 ? 3 : 1, vol: 0.55 })));
    }
    if (b % 4 === 3) [13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.5 }));
    if (b === 0 || b === 8) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
  });
  // the cash-register bell that opens each half
  [0, 128].forEach((st) => {
    notes.push({ step: st, inst: 'bell', n: 91, len: 2 });
    notes.push({ step: st + 2, inst: 'bell', n: 96, len: 6 });
  });
  const tune = [
    // A: tiptoeing through the lobby (bars 1-8)
    '. . C5 - Eb5 - . G5 - . F5 Eb5 D5 - C5 -',
    '. . C5 - Eb5 - . G5 - . Bb5 - Ab5 G5 - .',
    'F5 - . Ab5 - . C6 - Bb5 - Ab5 - F5 - . .',
    'G5 - - - . B4 - D5 - F5 - Ab5 - G5 - .',
    '. . C5 - Eb5 - . G5 - . C6 - Bb5 G5 - .',
    'Ab5 - - - G5 - Eb5 - C5 - . Eb5 - Ab5 - .',
    'F5 - Ab5 - C6 - Bb5 - Ab5 - G5 - F5 - Eb5 D5',
    'D5 - - - - - - - . . G4 - B4 - D5 -',
    // B: the getaway (bars 9-16)
    'Eb5 - - C6 - - Ab5 - - Eb5 - - C5 - Eb5 -',
    'F5 - - D6 - - Bb5 - - F5 - - D5 - F5 -',
    'G5 - Bb5 - D6 - - - C6 - Bb5 - G5 - . .',
    'C6 - - - Eb6 - D6 C6 - - G5 - - - . .',
    'Ab5 - C6 - F6 - - - Eb6 - C6 - Ab5 - F5 -',
    'Eb5 - Ab5 - C6 - - - Bb5 - Ab5 - Eb5 - C5 -',
    'D5 - G5 - B5 - D6 - - - F6 - Eb6 - D6 -',
    'B5 - - - - - - - G5 - . G4 - - . .',
  ];
  tune.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`bank bar ${i + 1} is not 16 steps`);
    if (i < 8) notes.push(...line(l, 'pluck', i * 16, 0.7));
    else {
      notes.push(...line(l, 'synbrass', i * 16, 0.45));
      line(l, 'flute', i * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
    }
  });
  return { bpm: 124, steps: prog.length * 16, notes };
}
