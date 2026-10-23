import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Coil Works": a driving E-minor machine stomp. Pumping octave bass and a buzzing arpeggio
// like a coil spinning up, bell sparks for the intro, then a soaring lead over brass hits.
export function labSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B', 'C', 'D', 'Em', 'Em', 'Am', 'C', 'B', 'B'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 6 ? 12 : 0);
    // pumping octave bass in eighths, with a fifth on the and-of-three
    [[0, 0], [2, 12], [4, 0], [6, 12], [8, 0], [10, 12], [12, 7], [14, 12]].forEach(([st, iv]) => notes.push({ step: s + st, inst: 'bass', n: lo + iv, len: 1 }));
    // the coil spinning up: a sixteenth-note arpeggio that climbs and falls
    for (let st = 0; st < 16; st++) {
      const oct = [0, 0, 1, 1][(st >> 2) % 4] * 12;
      notes.push({ step: s + st, inst: 'arp', n: 64 + ((tones[st % 3] + 8) % 12) + oct, len: 1, vol: 0.45 });
    }
    // kit: kick with a pushed third hit, backbeat snare, eighth hats and ticking clacks
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    [3, 7, 11, 15].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.3 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 8 === 0) {
      notes.push({ step: s, inst: 'crash', n: 0, len: 1 });
      notes.push({ step: s, inst: 'timp', n: 40, len: 6 });
    }
    // brass power hits opening each phrase, and a pad under the second half
    if (b >= 4 && b % 2 === 0) tones.forEach((t) => notes.push({ step: s, inst: 'synbrass', n: 55 + ((t + 5) % 12), len: 3, vol: 0.8 }));
    if (b >= 8) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.03 }));
  });
  // bell sparks over the first four bars
  const bells = [
    'E6 . B5 . G5 . B5 . E6 . . . D6 . B5 .',
    'E6 . B5 . G5 . B5 . F#6 . . . G6 . . .',
    'E6 . C6 . G5 . C6 . E6 . . . G6 . E6 .',
    'F#6 . D6 . A5 . D6 . F#6 . . . A6 . . .',
  ];
  const lead = [
    'E5 - - - G5 - B5 - E6 - - - D6 - B5 -',
    'G5 - - - F#5 - E5 - B4 - - - . . . .',
    'A5 - - - C6 - E6 - A5 - - - G5 - E5 -',
    'D#5 - - - F#5 - B5 - D#6 - - - . . . .',
    'E6 - - - D6 - C6 - G5 - - - C6 - E6 -',
    'F#6 - - - E6 - D6 - A5 - - - D6 - F#6 -',
    'G6 - - - - - F#6 - E6 - - - B5 - - -',
    'E6 - D6 - B5 - G5 - E5 - - - . . . .',
    'C6 - - - B5 - A5 - E5 - - - A5 - C6 -',
    'E6 - - - D6 - C6 - G5 - - - E5 - G5 -',
    'F#5 - - - B5 - D#6 - F#6 - - - D#6 - B5 -',
    'B5 - - - - - - - D#6 - - - F#6 - - -',
  ];
  [...bells, ...lead].forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`lab bar ${i + 1} is not 16 steps`);
  });
  bells.forEach((l, i) => notes.push(...line(l, 'bell', i * 16, 0.6)));
  lead.forEach((l, i) => notes.push(...line(l, 'lead', (i + 4) * 16, 0.7)));
  return { bpm: 138, steps: prog.length * 16, notes };
}
