import { type Note, type Song, chordTones, line } from '../../audio/music';

// "The Howling Pass": a frantic C-minor storm piece. Tremolo strings and a pounding bass
// drive under icy bell runs, a choir howls on top and a fiddle tears through the melody.
export function blizzardSong(): Song {
  const notes: Note[] = [];
  const prog = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G', 'Fm', 'Cm', 'Ab', 'G', 'Fm', 'Ab', 'Ddim', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // pounding eighth-note bass with an octave kick on the off beats
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: 36 + root - (root > 7 ? 12 : 0) + (st % 4 === 2 ? 12 : 0), len: 1 });
    // tremolo strings: every 16th re-bows the chord
    for (let st = 0; st < 16; st++) tones.forEach((t) => notes.push({ step: s + st, inst: 'strings', n: 55 + ((t + 5) % 12), len: 1, vol: 0.022 }));
    // the choir howls on the downbeat, a falling icy bell run fills the gap
    notes.push({ step: s, inst: 'choir', n: 60 + root % 12, len: 16 });
    [0, 1, 2, 3, 4, 5].forEach((k) => notes.push({ step: s + 10 + k, inst: 'bell', n: 84 + tones[2 - (k % 3)] - (k >= 3 ? 12 : 0), len: 1, vol: 0.7 }));
    // kit: kick on 1 and the "and" of 2, snare backbeat, driving hats
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h + 1, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 45 - (st - 13) * 3, len: 1 }));
    if (b % 4 === 0) {
      notes.push({ step: s, inst: 'crash', n: 0, len: 4 });
      notes.push({ step: s, inst: 'timp', n: 36, len: 6 });
    }
    // brass stabs from the second half on
    if (b >= 8) [0, 3, 6].forEach((st) => notes.push({ step: s + st, inst: 'brass', n: 48 + root, len: 2 }));
  });
  const lead = [
    'C5 - - Eb5 G5 - - - C6 - Bb5 - G5 - Eb5 -',
    'Ab5 - - - G5 - Eb5 - C5 - - - Eb5 - F5 -',
    'F5 - - Ab5 C6 - - - F5 - G5 - Ab5 - C6 -',
    'B5 - - - - - - - D5 - F5 - G5 - - -',
    'C6 - - - Bb5 - G5 - Eb5 - G5 - C6 - D6 -',
    'Eb6 - - - D6 - C6 - Ab5 - - - C6 - Eb6 -',
    'D6 - - - Bb5 - F5 - D5 - F5 - Bb5 - D6 -',
    'B5 - - - - - - - G5 - - - . . . .',
    'Ab5 - - - G5 - F5 - C5 - - - F5 - Ab5 -',
    'G5 - - - - - Eb5 - C5 - - - Eb5 - G5 -',
    'C6 - - - Bb5 - Ab5 - Eb5 - - - Ab5 - C6 -',
    'B5 - - - D6 - - - G5 - - - F5 - D5 -',
    'F5 - Ab5 - C6 - F6 - - - Eb6 - C6 - Ab5 -',
    'Eb6 - - - C6 - Ab5 - Eb5 - - - C6 - Eb6 -',
    'D6 - - - F6 - - - Ab5 - - - F5 - D5 -',
    'G5 - - - B5 - - - D6 - - - F6 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`blizzard bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'fiddle', i * 16, 1.1));
  });
  return { bpm: 152, steps: prog.length * 16, notes };
}
