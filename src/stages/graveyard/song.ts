import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Hollowmere Cemetery": a creaking E minor danse for the graveyard, in 3/4. Harpsichord oom-pah-pah,
// a fiddle that sways like it's had a few, bones rattling on the off-beats and a far bell tolling.
export function graveyardSong(): Song {
  const notes: Note[] = [];
  const BAR = 12; // three beats of four steps
  const prog = ['Em', 'Em', 'B7', 'B7', 'Em', 'C', 'Am', 'B', 'C', 'Am', 'B7', 'Em', 'C', 'Am', 'B7', 'Em'];
  prog.forEach((ch, b) => {
    const s = b * BAR;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 7 ? 12 : 0);
    const late = b >= 8;
    // the waltz: low root on one, chord plucks on two and three
    notes.push({ step: s, inst: 'bass', n: lo, len: 3 });
    if (late) notes.push({ step: s + 8, inst: 'bass', n: lo + 7, len: 2, vol: 0.7 });
    [4, 8].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 64 + ((t + 8) % 12), len: 2, vol: 0.55 })));
    tones.forEach((t) => notes.push({ step: s, inst: 'choir', n: 52 + ((t + 8) % 12), len: BAR, vol: 0.02 }));
    // bones: a dry rattle on the off-beats, kick on the one
    notes.push({ step: s, inst: 'kick', n: 0, len: 1, vol: 0.8 });
    [6, 10].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.45 }));
    if (late) [2, 6, 10].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1, vol: 0.5 }));
    if (b % 4 === 3) [8, 9, 10, 11].forEach((st, i) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.4 + i * 0.12 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'timp', n: 40, len: 6 });
  });
  // the midnight bell, once per half
  notes.push({ step: 0, inst: 'bell', n: 52, len: 24 });
  notes.push({ step: 8 * 12, inst: 'bell', n: 52, len: 24 });
  const lead = [
    // A: the slow sway (bars 1-8)
    'E5 - - - B4 - - - E5 - G5 -',
    'F#5 - - - E5 - - - B4 - - -',
    'D#5 - - - F#5 - - - A5 - - -',
    'B5 - - - A5 - G5 - F#5 - - -',
    'G5 - - - E5 - - - G5 - B5 -',
    'C6 - - - B5 - - - G5 - - -',
    'A5 - - - C6 - - - E5 - A5 -',
    'F#5 - - - D#5 - - - B4 - - -',
    // B: the dance picks up (bars 9-16)
    'C6 - - - - - B5 - C6 - E6 -',
    'A5 - - - - - G5 - A5 - C6 -',
    'B5 - A5 - G5 - F#5 - D#5 - F#5 -',
    'E5 - - - - - - - . . . .',
    'E6 - - - D6 - C6 - B5 - C6 -',
    'A5 - - - G5 - E5 - C5 - E5 -',
    'F#5 - G5 - A5 - B5 - D#6 - F#5 -',
    'E5 - - - B4 - - - E4 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== BAR) throw new Error(`graveyard bar ${i + 1} is not ${BAR} steps`);
    notes.push(...line(l, 'fiddle', i * BAR, i < 8 ? 0.9 : 1));
    if (i >= 8) notes.push(...line(l, 'reed', i * BAR, 0.5));
  });
  return { bpm: 156, steps: prog.length * BAR, notes };
}
