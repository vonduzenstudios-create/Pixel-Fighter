import { type Note, type Song, chordTones, line } from '../../audio/music';

// The Midnight Express: a driving E minor gallop over a clickety-clack rail rhythm.
export function trainSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B', 'C', 'D', 'Em', 'Em', 'Am', 'C', 'B', 'B'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const low = 36 + root - (root > 7 ? 12 : 0); // bass root around E2
    // pumping octave bass, like pistons
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: low + (st % 4 === 2 ? 12 : 0), len: 1 });
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 59 + ((t + 1) % 12), len: 16, vol: 0.04 }));
    // the rails: a double clack on every beat, accented on the one
    for (let st = 0; st < 16; st += 4) {
      notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: st === 0 ? 1 : 0.6 });
      notes.push({ step: s + st + 1, inst: 'clack', n: 0, len: 1, vol: 0.45 });
    }
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1 });
    notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1 });
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [14, 15].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.6 }));
    if (b >= 8) [0, 3, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 52 + ((t + 8) % 12), len: 2 })));
    if (b === 8 || b === 12) notes.push({ step: s, inst: 'timp', n: 40, len: 4 });
  });
  // the whistle blows as the loop comes around
  notes.push({ step: 0, inst: 'whistle', n: 76, len: 10 });
  notes.push({ step: 128, inst: 'whistle', n: 76, len: 6 });
  const lead = [
    'E5 - - - B4 - E5 - G5 - - - F#5 - E5 -',
    'G5 - - - E5 - - - C5 - D5 - E5 - - -',
    'F#5 - - - D5 - - - A4 - D5 - F#5 - A5 -',
    'G5 - F#5 - D#5 - - - B4 - - - - - - -',
    'E5 - - - B4 - E5 - G5 - - - A5 - B5 -',
    'C6 - - - B5 - A5 - G5 - - - E5 - - -',
    'A5 - - - G5 - E5 - C5 - E5 - A5 - - -',
    'F#5 - - - D#5 - - - B4 - - - . . . .',
    'G5 - - - - - E5 - G5 - - - C6 - - -',
    'A5 - - - - - F#5 - D5 - - - A5 - - -',
    'B5 - - - G5 - - - E5 - G5 - B5 - - -',
    'E6 - - - - - - - D6 - C6 - B5 - - -',
    'C6 - B5 - A5 - - - E5 - - - A5 - - -',
    'G5 - A5 - G5 - E5 - C5 - - - E5 - G5 -',
    'F#5 - - - - - - - D#5 - - - F#5 - - -',
    'B5 - - - - - - - A5 - G5 - F#5 - D#5 -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16)));
  return { bpm: 152, steps: prog.length * 16, notes };
}
