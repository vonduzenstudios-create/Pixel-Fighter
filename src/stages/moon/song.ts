import { type Note, type Song, chordTones, line } from '../../audio/music';

// The moon stage: a slow, weightless E minor piece. Bell arpeggios and a choir float over a
// heartbeat bass, then the strings and a muted lead come in for a mournful melody.
export function moonSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'C', 'Am', 'B', 'Em', 'G', 'C', 'B', 'Am', 'Em', 'C', 'B', 'Am', 'C', 'F#dim', 'B'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // heartbeat bass: a low thump and its echo
    for (const st of [0, 3, 8, 11]) notes.push({ step: s + st, inst: 'bass', n: 36 + root - (root > 7 ? 12 : 0) + (st % 8 === 3 ? 12 : 0), len: 2, vol: st % 8 ? 0.06 : 0.11 });
    // drifting bell arpeggio up and back down the chord
    const arp = [0, 1, 2, 3, 2, 1, 0, 1];
    arp.forEach((k, i) => notes.push({ step: s + i * 2, inst: 'bell', n: 76 + ((tones[k % 3] + 8) % 12) + (k === 3 ? 12 : 0), len: 2 }));
    notes.push({ step: s, inst: 'choir', n: 64 + ((root + 8) % 12), len: 16 });
    if (b >= 4) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.035 }));
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    if (b >= 8) {
      notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1, vol: 0.35 });
      notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1, vol: 0.35 });
    }
    if (b % 4 === 0) notes.push({ step: s, inst: 'timp', n: 40, len: 6 });
  });
  const lead = [
    '. . . . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . .',
    '. . . . . . . . . . . . . . . .',
    'B4 - - - - - - - E5 - - - G5 - F#5 -',
    'D5 - - - - - - - B4 - - - D5 - - -',
    'E5 - - - - - - - G5 - - - C5 - D5 -',
    'D#5 - - - - - - - - - - - . . . .',
    'C5 - - - E5 - - - A5 - - - G5 - - -',
    'G5 - - - F#5 - E5 - - - - - B4 - - -',
    'E5 - - - G5 - - - C6 - - - B5 - A5 -',
    'B5 - - - - - - - F#5 - - - D#5 - - -',
    'E5 - - - - - D5 - C5 - - - - - A4 -',
    'G4 - - - C5 - - - E5 - - - G5 - - -',
    'F#5 - - - A5 - - - C6 - - - A5 - - -',
    'B5 - - - - - - - D#5 - - - F#5 - - -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16, 0.7)));
  return { bpm: 84, steps: prog.length * 16, notes };
}
