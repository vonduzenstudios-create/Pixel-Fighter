import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Thriftopia Mart": store-speaker muzak with a fighting pulse. A bossa rimshot and walking
// bass under a breezy flute tune, opened by the two-note "attention shoppers" chime; the
// second half kicks into a brighter square lead with brass stabs.
export function marketSong(): Song {
  const notes: Note[] = [];
  const prog = ['F', 'Dm', 'Gm', 'C', 'F', 'Dm', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'Bb', 'C', 'F', 'C'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 7 ? 12 : 0);
    // bossa bass: root, fifth, root, fifth with a passing approach note
    [[0, 0, 5], [6, 7, 2], [8, 0, 5], [14, 7, 1], [15, 11, 1]].forEach(([st, iv, len]) => notes.push({ step: s + st, inst: 'bass', n: lo + iv, len }));
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t + 3) % 12), len: 16, vol: 0.025 }));
    // electric-piano comping, pushed off the beat
    [2, 7, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 64 + ((t + 8) % 12) - 4, len: 1, vol: 0.3 })));
    // rimshot clave, two bars long
    (b % 2 ? [2, 6, 10] : [0, 6, 12]).forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.55 }));
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 ? 0.6 : 1 });
    if (b >= 8) {
      [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.65 }));
      [0, 11].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 60 + ((t + 5) % 12) - 5, len: st ? 1 : 2, vol: 0.5 })));
    }
    if (b % 4 === 3) [13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.5 }));
    if (b === 8) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
  });
  // attention, shoppers
  notes.push({ step: 0, inst: 'bell', n: 88, len: 4 });
  notes.push({ step: 4, inst: 'bell', n: 84, len: 8 });
  const lead = [
    // A: the muzak tune (bars 1-8)
    'A5 - - C6 - - A5 - G5 - F5 - G5 - A5 -',
    'F5 - - - D5 - - - . . E5 - F5 - A5 -',
    'Bb5 - - D6 - - Bb5 - A5 - G5 - A5 - Bb5 -',
    'G5 - - - E5 - - - C5 - - - . . . .',
    'A5 - - C6 - - F6 - E6 - D6 - C6 - A5 -',
    'D6 - - - A5 - - - F5 - - - D5 - F5 -',
    'D6 - C6 - Bb5 - A5 - G5 - - - Bb5 - D6 -',
    'C6 - - - - - - - . . G5 - A5 - Bb5 -',
    // B: the clean-up-on-aisle-five bridge (bars 9-16)
    'C6 - - E6 - - C6 - A5 - - - E5 - A5 -',
    'D6 - - F6 - - D6 - A5 - - - F5 - A5 -',
    'Bb5 - - D6 - - G6 - F6 - D6 - Bb5 - G5 -',
    'C6 - - - E6 - - - G6 - - - E6 - C6 -',
    'D6 - - F6 - - D6 - Bb5 - - - F5 - Bb5 -',
    'C6 - - E6 - - G6 - E6 - C6 - G5 - E5 -',
    'F5 - A5 - C6 - F6 - - - E6 - C6 - A5 -',
    'G5 - - - - - - - E5 - G5 - Bb5 - C6 -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`market bar ${i + 1} is not 16 steps`);
    if (i < 8) notes.push(...line(l, 'flute', i * 16, 0.8));
    else {
      notes.push(...line(l, 'lead', i * 16, 0.5));
      line(l, 'flute', i * 16, 0.4).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
    }
  });
  return { bpm: 116, steps: prog.length * 16, notes };
}
