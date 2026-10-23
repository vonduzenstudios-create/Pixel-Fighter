import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Data Spire": cold E-minor synth arpeggios over a driving bass, strings and brass join later.
export function spireSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B', 'C', 'D', 'Em', 'Em', 'Am', 'C', 'B', 'B'];
  const arp = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 4, 3, 2, 1];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch).map((t) => (t + 8) % 12); // semitones above E
    const up = [...tones, tones[0] + 12, tones[1] + 12];
    arp.forEach((a, st) => notes.push({ step: s + st, inst: 'arp', n: 64 + up[a], len: 1 }));
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: 40 + tones[0] + (st % 4 === 2 ? 12 : 0), len: 1 });
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    if (b % 4 === 3) [14, 15].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.6 }));
    for (let h = 0; h < 16; h++) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b >= 8) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 52 + t, len: 16, vol: 0.04 }));
    if (b >= 12) [0, 3, 6, 10].forEach((st) => notes.push({ step: s + st, inst: 'brass', n: 52 + tones[0], len: 2 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'timp', n: 40, len: 6 });
  });
  const lead = [
    'E5 - - - B4 - - - E5 - F#5 - G5 - - -',
    'E5 - - - G5 - - - C6 - B5 - G5 - - -',
    'A5 - - - G5 - F#5 - E5 - D5 - E5 - - -',
    'D#5 - - - - - - - F#5 - - - B4 - - -',
    'G5 - - - E5 - G5 - C6 - - - B5 - G5 -',
    'A5 - - - F#5 - - - D5 - E5 - F#5 - A5 -',
    'B5 - - - - - G5 - E5 - - - B4 - - -',
    'E5 - G5 - B5 - - - E6 - - - - - - -',
    'C6 - - - B5 - A5 - E5 - - - A5 - C6 -',
    'G5 - - - E5 - - - C5 - E5 - G5 - - -',
    'F#5 - - - D#5 - - - B4 - - - F#5 - - -',
    'D#5 - - - E5 - F#5 - A5 - - - B5 - - -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', (i + 4) * 16)));
  return { bpm: 132, steps: prog.length * 16, notes };
}
