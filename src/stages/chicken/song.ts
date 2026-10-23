import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Cluck Hut": a cheesy, bouncy 90s fast-food jingle with slap bass and brass stabs.
export function chickenSong(): Song {
  const notes: Note[] = [];
  const prog = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // slap bass: thumbed roots with octave pops and a ghosted pickup
    [[0, 0], [3, 12], [6, 0], [8, 0], [10, 12], [11, 7], [14, 0]].forEach(([st, o]) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + o, len: 1 }));
    // brass stabs on the and-of-two and the four
    [6, 12].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 60 + ((t + 5) % 12) - 5, len: 1, vol: 0.6 })));
    // bright chord plucks on the off-beats
    [2, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 72 + ((t + 5) % 12) - 5, len: 1, vol: 0.35 })));
    // four-on-the-floor kit with a clap-ish clack
    [0, 4, 8, 12].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.6 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.5 }));
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.6 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.6 });
  });
  const lead = [
    // A: the jingle (bars 1-8)
    'G5 . G5 . E5 . G5 - A5 . G5 . E5 - . .',
    'C6 - B5 . A5 . G5 . E5 - - - . . . .',
    'F5 . A5 . C6 . A5 . G5 . F5 . A5 - - .',
    'G5 - - . B5 . D6 . B5 - - - . . . .',
    'G5 . G5 . E5 . G5 - A5 . G5 . E5 - . .',
    'C6 - D6 . E6 . C6 . A5 - - - . . . .',
    'F5 . A5 . D6 . C6 . A5 . F5 . D5 . F5 .',
    'G5 - A5 - B5 - D6 - G5 - - - . . . .',
    // B: the "come on down" bridge (bars 9-16)
    'A5 - - - C6 - A5 - F5 - - - A5 . C6 .',
    'B5 - - - D6 - B5 - G5 - - - . . . .',
    'G5 - - - B5 - G5 - E5 - - - G5 . B5 .',
    'A5 - - - E5 - - - C6 - - - A5 - - -',
    'F5 . F5 . A5 . C6 - F6 - - - C6 . A5 .',
    'G5 . G5 . B5 . D6 - G6 - - - D6 . B5 .',
    'C6 . G5 . E5 . G5 . C6 - - - E6 - - -',
    'D6 - - - B5 - - - G5 - A5 - B5 - D6 -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16, 0.55)));
  // the bridge is doubled by a flute an octave down
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.6).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 118, steps: prog.length * 16, notes };
}
