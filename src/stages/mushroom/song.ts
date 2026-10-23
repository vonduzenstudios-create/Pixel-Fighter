import { type Note, type Song, chordTones, line } from '../../audio/music';

export function mushroomSong(): Song {
  const notes: Note[] = [];
  const prog = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C'];
  // voice pitch class pc at or just above MIDI note lo, so every part stays in the chord
  const at = (pc: number, lo: number) => lo + ((((pc - lo) % 12) + 12) % 12);
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // oom-pah bass: root and fifth, with a little walk-up into the next bar
    [0, 4, 8, 12].forEach((st, i) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + (i % 2 ? 7 : 0), len: 2 }));
    if (b % 2 === 1) notes.push({ step: s + 14, inst: 'bass', n: at(tones[1], 36 + root), len: 1 });
    // soft pad
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: at(t, 57), len: 16, vol: 0.022 }));
    // off-beat chord plucks
    [2, 6, 10, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: at(t, 60), len: 1, vol: 0.45 })));
    // twinkle arpeggio up high
    [0, 3, 6, 9].forEach((st, i) => notes.push({ step: s + st, inst: 'bell', n: at(tones[i % 3], 72) + (i === 3 ? 12 : 0), len: 2 }));
    // light kit
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1, vol: 0.35 });
    notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1, vol: 0.35 });
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
  });
  const lead = [
    // A: hopping plucked tune (bars 1-8)
    'F5 . A5 . C6 - A5 . G5 . F5 . A5 - - .',
    'D5 . F5 . A5 - F5 . E5 . D5 . F5 - - .',
    'D5 - C5 . Bb4 . D5 . F5 - - . D5 . F5 .',
    'E5 - - . G5 . E5 . C5 - - - . . . .',
    'F5 . A5 . C6 - D6 . C6 . A5 . F5 - - .',
    'E5 . A5 . C6 - G5 . A5 . E5 . C5 - - .',
    'D5 . F5 . Bb5 - A5 . G5 . F5 . D5 . F5 .',
    'G5 - - - E5 - - - C5 - - - . . . .',
    // B: a sung flute line over it (bars 9-16)
    'F5 - - - D5 - - - Bb4 - - - D5 - F5 -',
    'E5 - - - G5 - - - C6 - - - Bb5 - A5 -',
    'A5 - - - E5 - - - C5 - - - E5 - A5 -',
    'F5 - - - A5 - - - D6 - - - C6 - A5 -',
    'Bb5 - A5 - G5 - F5 - D5 - F5 - G5 - Bb5 -',
    'C6 - - - Bb5 - - - G5 - - - E5 - - -',
    'F5 . A5 . C6 . F6 - - - C6 . A5 . F5 .',
    'E5 - - - G5 - - - C5 - . . E5 . G5 .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, i < 8 ? 'pluck' : 'flute', i * 16)));
  // the plucked A tune doubles an octave down so it carries
  lead.slice(0, 8).forEach((l, i) => line(l, 'pluck', i * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 128, steps: prog.length * 16, notes };
}
