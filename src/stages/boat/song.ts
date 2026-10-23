import { type Note, type Song, chordTones, line } from '../../audio/music';

export function boatSong(): Song {
  // "Brine and Bones": a minor-key shanty in 6/8. A bar is 12 steps, so an eighth note is 2 steps.
  const notes: Note[] = [];
  const BAR = 12;
  const prog = ['Am', 'G', 'Am', 'E', 'Am', 'G', 'F', 'E', 'F', 'G', 'C', 'Am', 'F', 'G', 'E', 'E'];
  const eighths = (s: string) => s.trim().split(/\s+/).flatMap((t) => (t === '-' ? ['-', '-'] : t === '.' ? ['.', '.'] : [t, '-'])).join(' ');
  const tune = [
    'E5 - A4 A4 B4 C5', 'D5 - B4 G4 - -', 'C5 - A4 E5 - D5', 'B4 - G#4 E4 - -',
    'E5 - A4 A4 B4 C5', 'D5 - G5 F5 E5 D5', 'C5 - A4 F5 E5 D5', 'E5 - - - - -',
    'A5 - - G5 F5 E5', 'D5 - B4 G4 - D5', 'E5 - D5 C5 - E5', 'A4 - - - C5 E5',
    'F5 - - E5 D5 C5', 'D5 - - B4 C5 D5', 'E5 - D5 C5 B4 G#4', 'E4 - - - . .',
  ];
  // played twice: a lone fiddle first, then the full crew with brass and choir
  for (let pass = 0; pass < 2; pass++)
    prog.forEach((ch, i) => {
      const b = pass * prog.length + i, s = b * BAR;
      const tones = chordTones(ch);
      const root = tones[0];
      // oom-pah: bass on beats 1 and 4, squeezebox chords on the off-eighths
      notes.push({ step: s, inst: 'bass', n: 36 + root, len: 3 });
      notes.push({ step: s + 6, inst: 'bass', n: 36 + root + 7 - (root > 4 ? 12 : 0), len: 3 });
      for (const st of [2, 4, 8, 10]) tones.forEach((t) => notes.push({ step: s + st, inst: 'reed', n: 57 + ((t + 3) % 12), len: 1 }));
      notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
      notes.push({ step: s + 6, inst: 'snare', n: 0, len: 1, vol: 0.6 });
      for (let h = 0; h < BAR; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
      if (i % 4 === 0) notes.push({ step: s, inst: 'timp', n: 24 + root + (root < 4 ? 12 : 0), len: 6 });
      if (i % 8 === 0) [0, 3].forEach((st) => notes.push({ step: s + st, inst: 'bell', n: 81, len: 4 }));
      notes.push(...line(eighths(tune[i]), 'fiddle', s));
      if (pass === 1) {
        notes.push(...line(eighths(tune[i]), 'lead', s, 0.7));
        tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t + 3) % 12), len: BAR, vol: 0.03 }));
        if (i >= 8) notes.push({ step: s, inst: 'choir', n: 57 + ((root + 3) % 12), len: BAR });
        if (i % 2 === 1) [0, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 52 + ((t + 8) % 12), len: 2, vol: 0.8 })));
        if (i === 15) [7, 8, 9, 10, 11].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.5 }));
      }
    });
  return { bpm: 120, steps: prog.length * 2 * BAR, notes };
}
