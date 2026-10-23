import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Tomb of the Sun King": a D Phrygian-dominant desert march. A darbuka groove and a droning
// bass carry a snake-charmer reed melody; brass and a low flute join for the second half.
export function pyramidSong(): Song {
  const notes: Note[] = [];
  const prog = ['D', 'D', 'Eb', 'D', 'D', 'Cm', 'Eb', 'D', 'Gm', 'Gm', 'D', 'D', 'Eb', 'Cm', 'Eb', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 7 ? 12 : 0);
    // the drone: a low D under everything, with the chord root bouncing on top
    notes.push({ step: s, inst: 'bass', n: 38, len: 6 });
    [[6, 0], [8, 12], [10, 0], [12, 7], [14, 0]].forEach(([st, iv]) => notes.push({ step: s + st, inst: 'bass', n: lo + iv, len: 1 }));
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.022 }));
    // darbuka groove: doum on 1 and 3, teks between, finger cymbals on the off-beats
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 43, len: 1, vol: 0.9 }));
    [2, 6, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.55 }));
    [3, 7, 11, 15].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1 }));
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 8 === 0) {
      notes.push({ step: s, inst: 'timp', n: 38, len: 6 });
      notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
    }
    // second half: snare backbeat and brass swells
    if (b >= 8) {
      notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1, vol: 0.7 });
      [0, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 55 + ((t + 5) % 12), len: st ? 2 : 4, vol: 0.8 })));
    }
  });
  const lead = [
    // A: the charmer's call (bars 1-8)
    'D5 - - - Eb5 - F#5 - G5 - F#5 - Eb5 - D5 -',
    'A5 - - - G5 F#5 G5 - F#5 - Eb5 - D5 - - -',
    'Eb5 - G5 - Bb5 - - - A5 G5 A5 - G5 - Eb5 -',
    'F#5 - - - Eb5 - - - D5 - - - . . . .',
    'D6 - - - C6 - Bb5 - A5 - - - Bb5 A5 G5 F#5',
    'G5 - - - Eb5 - C5 - Eb5 - G5 - C6 - - -',
    'Bb5 - - - G5 - Eb5 - G5 - Bb5 - A5 - G5 -',
    'F#5 - G5 - F#5 - Eb5 - D5 - - - - - - -',
    // B: the procession (bars 9-16)
    'G5 - - - Bb5 - - - D6 - - - C6 Bb5 A5 G5',
    'A5 - Bb5 - A5 - G5 - F#5 - - - G5 - - -',
    'A5 - - - F#5 - - - D5 - Eb5 - F#5 - A5 -',
    'D6 - - - - - - - Eb6 - D6 - C6 - Bb5 -',
    'Bb5 - - - G5 - - - Eb5 - G5 - Bb5 - Eb6 -',
    'C6 - Bb5 - A5 - G5 - Eb5 - - - G5 - C6 -',
    'Bb5 - A5 - G5 - F#5 - Eb5 - F#5 - G5 - A5 -',
    'D6 - - - A5 - - - F#5 - Eb5 - D5 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`pyramid bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'reed', i * 16, 1.3));
  });
  // a low flute shadows the procession an octave down
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 104, steps: prog.length * 16, notes };
}
