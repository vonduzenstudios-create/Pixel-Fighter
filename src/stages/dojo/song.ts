import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Ironwood Dojo": an original piece in a Japanese-flavoured D minor pentatonic (D Eb G A Bb).
// Koto-like plucks and taiko drums under a breathy flute; a reedier lead takes the second half.
export function dojoSong(): Song {
  const notes: Note[] = [];
  const prog = ['Dm', 'Dm', 'Eb', 'Dm', 'Gm', 'Gm', 'Eb', 'Dm', 'Bb', 'Cm', 'Eb', 'Dm', 'Gm', 'Bb', 'Eb', 'Dm'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch).map((t) => 62 + ((t - 2 + 12) % 12)); // voiced from D4 up
    const v = [...tones, ...tones.map((t) => t + 12)];
    const root = tones[0] - 24;
    const drive = b >= 8;
    // koto: rolling arpeggio, eighths in the first half and sixteenths in the second
    [0, 2, 3, 4, 5, 4, 3, 2].forEach((k, i) => {
      notes.push({ step: s + i * 2, inst: 'pluck', n: v[k], len: 1, vol: 0.7 });
      if (drive) notes.push({ step: s + i * 2 + 1, inst: 'pluck', n: v[(k + 2) % 6], len: 1, vol: 0.4 });
    });
    // bass and pad
    [0, 6, 8, 14].forEach((st, i) => notes.push({ step: s + st, inst: 'bass', n: root + (i === 2 ? 12 : 0), len: i === 0 ? 4 : 2 }));
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: t - 12, len: 16, vol: 0.022 }));
    // taiko: big low hits, rim chatter on the off-beats, a roll into every fourth bar
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 38, len: 1, vol: 1.1 }));
    [3, 11].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 45, len: 1, vol: 0.6 }));
    if (drive) [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.5 }));
    if (drive) for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: 0.6 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 47 - i * 3, len: 1, vol: 0.9 }));
    if (b % 4 === 0) notes.push({ step: s, inst: 'timp', n: 38, len: 6 });
    // wooden clappers mark each phrase
    if (b % 8 === 0) [0, 2].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 1 }));
  });
  notes.push({ step: 0, inst: 'bell', n: 62, len: 16 });
  notes.push({ step: 128, inst: 'bell', n: 69, len: 16 });
  const lead = [
    // A: the flute, unhurried (bars 1-8)
    'D5 - - - - - Eb5 - D5 - A4 - - - - -',
    'Bb4 - A4 - G4 - - - A4 - - - - - - -',
    'Eb5 - - - G5 - - - Eb5 - D5 - Bb4 - - -',
    'A4 - - - - - - - . . . . D5 - Eb5 -',
    'G5 - - - - - A5 - G5 - Eb5 - D5 - - -',
    'Bb4 - D5 - Eb5 - G5 - A5 - - - G5 - - -',
    'Eb5 - - - D5 - Bb4 - A4 - G4 - Eb4 - - -',
    'D4 - - - - - - - - - - - . . . .',
    // B: the drive (bars 9-16)
    'D5 - D5 Eb5 G5 - A5 - Bb5 - A5 - G5 - Eb5 -',
    'G5 - - - Eb5 - - - C5 - Eb5 - G5 - - -',
    'Bb5 - A5 - G5 - Eb5 - G5 - - - Bb4 - Eb5 -',
    'D5 - - - - - - - A4 - D5 - Eb5 - D5 -',
    'G5 - - - A5 - Bb5 - D6 - - - Bb5 - A5 -',
    'Bb5 - - - A5 - G5 - D5 - - - G5 - A5 -',
    'Eb6 - - - D6 - Bb5 - A5 - G5 - Eb5 - - -',
    'D5 - - - - - - - - - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`dojo bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'flute', i * 16, i < 8 ? 1.1 : 0.8));
    if (i >= 8) notes.push(...line(l, 'reed', i * 16, 0.9));
  });
  return { bpm: 126, steps: prog.length * 16, notes };
}
