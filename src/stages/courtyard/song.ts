import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Court of Cinders": an original D Dorian estampie for a medieval square. A drone and a tabor
// keep a stamping dance beat, the fiddle leads and a flute answers; the second half adds
// strings, a bell on every phrase and timpani like a herald's drum.
export function courtyardSong(): Song {
  const notes: Note[] = [];
  const prog = ['Dm', 'Dm', 'C', 'Dm', 'Dm', 'F', 'C', 'Dm', 'F', 'C', 'Dm', 'Am', 'F', 'G', 'C', 'Dm'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 7 ? 12 : 0);
    // a bagpipe-style drone on D and A, with the chord root stamping underneath
    notes.push({ step: s, inst: 'bass', n: 38, len: 8, vol: 0.7 });
    [[8, 0], [11, 0], [12, 7], [14, 0]].forEach(([st, iv]) => notes.push({ step: s + st, inst: 'bass', n: lo + iv, len: 1 }));
    notes.push({ step: s, inst: 'strings', n: 50, len: 16, vol: 0.016 });
    notes.push({ step: s, inst: 'strings', n: 57, len: 16, vol: 0.014 });
    // tabor: a long-short-short stamp and wooden clacks
    [0, 6, 8, 14].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 45, len: 1, vol: st % 8 ? 0.55 : 0.9 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.6 }));
    [2, 10].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1 }));
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 2, len: 1, vol: 0.7 }));
    if (b >= 8) {
      tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t + 3) % 12), len: 16, vol: 0.02 }));
      notes.push({ step: s + 8, inst: 'snare', n: 0, len: 1, vol: 0.5 });
      if (b % 4 === 0) notes.push({ step: s, inst: 'timp', n: 38, len: 6 });
    }
    if (b % 4 === 0) notes.push({ step: s, inst: 'bell', n: 74, len: 4, vol: 0.5 });
  });
  const lead = [
    // A: the dance (bars 1-8)
    'D5 - A4 - D5 E5 F5 - E5 - D5 - C5 - A4 -',
    'D5 - - - F5 - E5 D5 E5 - A5 - - - . .',
    'G5 - E5 - C5 - E5 G5 F5 - E5 - D5 - C5 -',
    'D5 - E5 F5 E5 D5 C5 - D5 - - - - - . .',
    'A5 - - - G5 F5 G5 - A5 - D5 - F5 - A5 -',
    'C6 - A5 - F5 - A5 C6 B5 - A5 - G5 - F5 -',
    'E5 - G5 - C6 - B5 A5 G5 - E5 - C5 - E5 -',
    'D5 - F5 E5 D5 - C5 - D5 - - - - - - -',
    // B: the procession (bars 9-16)
    'F5 - A5 - C6 - - - A5 - F5 - A5 - C6 -',
    'G5 - - - E5 - C5 - E5 - G5 - B5 - C6 -',
    'D6 - - - C6 - A5 - B5 - G5 - A5 - F5 -',
    'E5 - - - A5 - - - C6 - B5 - A5 - - -',
    'A5 - G5 - F5 - G5 A5 C6 - A5 - F5 - A5 -',
    'G5 - - - B5 - D6 - B5 - G5 - E5 - D5 -',
    'E5 - G5 - C6 - - - E6 - D6 - C6 - G5 -',
    'A5 - F5 - E5 - C5 - D5 - - - - - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`courtyard bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'fiddle', i * 16, 1.2));
  });
  // a low flute shadows every other bar of the dance, then doubles the procession an octave up
  lead.slice(0, 8).forEach((l, i) => {
    if (i % 2) line(l, 'flute', i * 16, 0.4).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
  });
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n + 12 })));
  return { bpm: 128, steps: prog.length * 16, notes };
}
