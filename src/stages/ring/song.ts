import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Piledriver Palace": an original main-event entrance anthem in G minor. Pounding power chords and
// a synth-brass fanfare over the verse; the chorus hands the hook to a screaming guitar lead.
export function ringSong(): Song {
  const notes: Note[] = [];
  const prog = ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Gm', 'Bb', 'F', 'Cm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'F', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const low = (root - 7 + 12) % 12; // semitones above G
    const chorus = b >= 8;
    // power chords: hits on the one and the and-of-two, then a gallop into the next bar
    const hits: [number, number][] = chorus ? [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]] : [[0, 2], [3, 1], [6, 2], [10, 1], [12, 1], [13, 1], [14, 2]];
    hits.forEach(([st, len], i) => [0, 7].forEach((o) => notes.push({ step: s + st, inst: 'guitar', n: 43 + low + o, len, vol: i === 0 ? 1 : 0.7 })));
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: 31 + low + (st === 10 ? 12 : 0), len: 1 });
    // a heavy backbeat with the kick doubling the gallop
    [0, 6, 8, 13, 14].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: chorus ? 1 : 0.7 });
    if (b % 4 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.9 });
    if (b % 4 === 3) [8, 10, 12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 2, len: 1, vol: 0.8 }));
    // a pad underneath the chorus
    if (chorus) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t - 7 + 12) % 12), len: 16, vol: 0.03 }));
  });
  const lead = [
    // verse fanfare (bars 1-8)
    'G4 - - G4 Bb4 - D5 - - - C5 - Bb4 - A4 -',
    'G4 - - - - - - - D5 - - - G5 - - -',
    'Eb5 - - - D5 - C5 - Bb4 - - - G4 - - -',
    'F4 - - - A4 - C5 - F5 - - - - - - -',
    'G4 - - G4 Bb4 - D5 - - - F5 - Eb5 - D5 -',
    'G5 - - - F5 - D5 - Bb4 - C5 - D5 - - -',
    'F5 - - - D5 - Bb4 - D5 - F5 - Bb5 - - -',
    'A5 - - - - - G5 - F5 - - - C5 - - -',
    // chorus (bars 9-16)
    'C6 - - - Bb5 - G5 - Eb5 - G5 - C6 - - -',
    'Bb5 - - - G5 - Eb5 - Bb4 - Eb5 - G5 - - -',
    'D6 - - - C6 - Bb5 - F5 - Bb5 - D6 - - -',
    'C6 - - - A5 - F5 - A5 - C6 - F6 - - -',
    'G6 - - - F6 - D6 - Bb5 - D6 - G6 - - -',
    'Eb6 - - - D6 - C6 - Bb5 - G5 - Eb5 - - -',
    'F5 - G5 - A5 - C6 - F6 - - - Eb6 - D6 -',
    'D6 - - - - - - - F#5 - A5 - D6 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`ring bar ${i + 1} is not 16 steps`);
    if (i < 8) notes.push(...line(l, 'synbrass', i * 16, 0.8));
    else line(l, 'gtrlead', i * 16, 0.8).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
  });
  return { bpm: 144, steps: prog.length * 16, notes };
}
