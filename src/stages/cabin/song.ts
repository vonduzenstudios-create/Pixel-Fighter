import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Rail-Splitter Woods": an original frontier fiddle tune with a driving plucked banjo roll,
// a stomping kick and a woodblock clack. A minor-key A part for the fight, a brighter
// major B part that climbs like the sun going down over the ridge.
export function cabinSong(): Song {
  const notes: Note[] = [];
  const prog = ['Dm', 'Dm', 'C', 'C', 'Bb', 'C', 'Dm', 'A', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'A', 'Dm'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // boom-chuck bass: root on the beat, fifth on the third beat
    [0, 8].forEach((st, i) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + (i ? 7 : 0) - (root > 7 ? 12 : 0), len: 3 }));
    [6, 14].forEach((st) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + 12 - (root > 7 ? 12 : 0), len: 1, vol: 0.6 }));
    // a forward banjo roll: thumb, index, middle over the chord
    const roll = [0, 1, 2, 0, 1, 2, 0, 2];
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'pluck', n: 57 + ((tones[roll[h / 2]] + 3) % 12) + (h % 8 === 6 ? 12 : 0), len: 1, vol: 0.45 });
    // stomp on the beats, clack on the offbeats, a tom roll into every fourth bar
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1 }));
    [2, 6, 10, 14].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1, vol: 0.5 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.55 }));
    // low strings sustain the chord under the B part
    if (b >= 8) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 50 + ((t + 10) % 12), len: 16, vol: 0.05 }));
  });
  const fiddle = [
    // A: the dark woods (bars 1-8)
    'D5 - A4 - D5 E5 F5 - E5 D5 C5 - A4 - - -',
    'D5 - F5 - A5 - G5 F5 E5 - D5 - E5 - F5 -',
    'G5 - E5 - C5 - E5 G5 C6 - Bb5 A5 G5 - E5 -',
    'F5 E5 D5 C5 E5 - G5 - E5 - C5 - . . C5 D5',
    'D5 - Bb4 - D5 - F5 - Bb5 - A5 G5 F5 - D5 -',
    'E5 - C5 - E5 G5 C6 - Bb5 A5 G5 F5 E5 - C5 -',
    'D5 - F5 A5 D6 - C6 A5 F5 - D5 - F5 E5 D5 -',
    'C#5 - E5 - A5 - G5 - E5 - C#5 - A4 - - -',
    // B: the sun going down over the ridge (bars 9-16)
    'F5 - A5 - C6 - - - A5 - F5 - C6 A5 F5 -',
    'E5 - G5 - C6 - - - G5 - E5 - G5 F5 E5 -',
    'D5 - F5 - A5 - D6 - C6 - A5 - F5 - A5 -',
    'Bb5 - - - A5 - G5 - F5 - G5 - Bb5 - D6 -',
    'C6 - A5 - F5 - A5 - C6 - F6 - E6 D6 C6 -',
    'G5 - C6 - E6 - - - D6 C6 Bb5 - G5 - E5 -',
    'A5 - C#6 - E6 - - - C#6 - A5 - E5 - C#5 -',
    'D5 - - - F5 - E5 - D5 - - - . . . .',
  ];
  fiddle.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`cabin bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'fiddle', i * 16, 0.8));
  });
  // a flute doubles the tune an octave down through the B part
  fiddle.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 138, steps: prog.length * 16, notes };
}
