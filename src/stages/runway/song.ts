import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Runway": a pumping 90s catwalk house track with piano stabs, offbeat bass and a cool minor hook.
export function runwaySong(): Song {
  const notes: Note[] = [];
  const prog = ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'Dm', 'Am', 'F', 'G', 'Dm', 'Am', 'E', 'E'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // offbeat house bass with an octave pop pushing into each beat
    [2, 6, 10, 14].forEach((st) => notes.push({ step: s + st, inst: 'bass', n: 36 + root, len: 1 }));
    [7, 15].forEach((st) => notes.push({ step: s + st, inst: 'bass', n: 48 + root, len: 1, vol: 0.12 }));
    // syncopated piano-house stabs
    [0, 3, 6, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 60 + ((t + 3) % 12) - 3, len: 1, vol: 0.5 })));
    // the B half swells under a string pad
    if (b >= 8) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 60 + ((t + 3) % 12) - 3, len: 16, vol: 0.035 }));
    // four on the floor, clap on two and four, open hats on the offbeats and ticking 16ths
    [0, 4, 8, 12].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.55 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.45 }));
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 2) [5, 13].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1 }));
    if (b % 8 === 7) [12, 13, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.35 + (st - 12) * 0.1 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
    // a glassy arpeggio twinkling over the A half
    if (b < 8) for (let k = 0; k < 16; k += 2) notes.push({ step: s + k, inst: 'arp', n: 72 + tones[(k >> 1) % 3] % 12 + ((k >> 1) % 4 === 3 ? 12 : 0), len: 1, vol: 0.7 });
  });
  const lead = [
    // A: the strut (bars 1-8)
    'A5 . . C6 . . E6 . D6 . C6 . A5 - . .',
    'G5 . A5 . . . . . E5 . G5 . A5 - - .',
    'A5 . . C6 . . F6 . E6 . C6 . A5 - . .',
    'B5 - - - D6 - - - G5 - - - . . . .',
    'A5 . . C6 . . E6 . D6 . C6 . A5 - . .',
    'G5 . A5 . C6 . E6 . G6 - - - E6 . . .',
    'F6 - E6 - C6 - A5 - F5 - - - A5 . C6 .',
    'B5 - - - G#5 - - - E5 - - - . . . .',
    // B: the turn at the end of the catwalk (bars 9-16)
    'D6 - - - . . F6 . E6 . D6 . A5 - - -',
    'C6 - - - . . E6 . D6 . C6 . A5 - - -',
    'A5 - C6 - F6 - - - E6 - C6 - A5 - - -',
    'B5 - D6 - G6 - - - F6 - D6 - B5 - - -',
    'A6 - - - F6 - - - D6 - - - F6 . A6 .',
    'G6 - - - E6 - - - C6 - - - E6 . G6 .',
    'G#6 - - - E6 - - - B5 - - - G#5 - - -',
    'B5 . . . G#5 . . . E5 . F#5 . G#5 . B5 .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, i < 8 ? 'lead' : 'synbrass', i * 16, i < 8 ? 0.5 : 0.7)));
  return { bpm: 124, steps: prog.length * 16, notes };
}
