import { type Note, type Song, chordTones, line } from '../../audio/music';

// "Pick a Card": an original sneaky after-dark piece in A minor. A walking bass, brushed snare and
// finger snaps under a smoky reed lead; muted brass joins for the second half while vibes ring out
// the turnarounds.
export function streetMagicSong(): Song {
  const notes: Note[] = [];
  const prog = ['Am', 'Am', 'Dm', 'Dm', 'Am', 'Am', 'E7', 'E7', 'F', 'F', 'Am', 'Am', 'Dm', 'E7', 'Am', 'E7'];
  /** Bass register: E2 up to D#3. */
  const low = (pc: number) => 40 + ((pc - 4 + 24) % 12);
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const next = chordTones(prog[(b + 1) % prog.length])[0];
    const late = b >= 8;
    // walking bass: root, third, fifth, then a chromatic step into the next bar's root
    const walk = [tones[0], tones[1], tones[2], next + (low(next) > low(tones[2]) ? -1 : 1)];
    walk.forEach((pc, i) => notes.push({ step: s + i * 4, inst: 'bass', n: low(pc), len: 3, vol: i === 0 ? 1 : 0.8 }));
    // a soft pad, voiced around A3
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t - 9 + 24) % 12), len: 16, vol: late ? 0.03 : 0.02 }));
    // swung ride, brushed snare on the backbeat, snaps doubling it
    [0, 3, 4, 7, 8, 11, 12, 15].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1, vol: st % 4 === 0 ? 0.7 : 0.35 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.35 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.5 }));
    notes.push({ step: s, inst: 'kick', n: 0, len: 1, vol: 0.6 });
    if (late) notes.push({ step: s + 10, inst: 'kick', n: 0, len: 1, vol: 0.4 });
    // pizzicato sneak on the off-beats
    [2, 6, 10, 14].forEach((st, i) => notes.push({ step: s + st, inst: 'pluck', n: 69 + ((tones[i % 3] - 9 + 24) % 12), len: 1, vol: 0.4 }));
    // muted brass stabs in the second half
    if (late) [7, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 60 + ((t + 24) % 12), len: 1, vol: 0.5 })));
    // vibes on every turnaround
    if (b % 4 === 3) tones.forEach((t, i) => notes.push({ step: s + 8 + i * 2, inst: 'bell', n: 72 + ((t + 24) % 12), len: 4, vol: 0.5 }));
  });
  const lead = [
    // A: the reed alone (bars 1-8)
    'A4 - . C5 E5 - . . Eb5 E5 - - . . . .',
    '. . G5 - E5 - C5 - D5 - Eb5 - E5 - - -',
    'F5 - . D5 A4 - . . D5 - F5 - A5 - G5 -',
    'F5 - - - E5 - D5 - C5 - D5 - . . . .',
    'A4 - . C5 E5 - . . A5 - G5 - E5 - . .',
    'Eb5 - E5 - C5 - A4 - . . . . G4 - A4 -',
    'B4 - - - G#4 - - - E4 - G#4 - B4 - D5 -',
    'E5 - - - - - - - . . . . E4 F4 G#4 B4',
    // B: brass doubles it (bars 9-16)
    'C5 - . A4 C5 - F5 - . . E5 - F5 - A5 -',
    'G5 - F5 - E5 - C5 - A4 - - - . . C5 -',
    'E5 - . E5 . E5 Eb5 - E5 - A5 - - - G5 -',
    'E5 - C5 - A4 - - - . . . . A4 C5 E5 G5',
    'A5 - - - F5 - D5 - A5 - G5 - F5 - D5 -',
    'E5 - - - B4 - G#4 - D5 - - - B4 - G#4 -',
    'A4 - - - C5 - E5 - A5 - - - G5 - E5 -',
    'Eb5 - - - D5 - - - B4 - - - G#4 - E4 -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`streetmagic bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'reed', i * 16, 1));
    if (i >= 8) notes.push(...line(l, 'brass', i * 16, 0.45));
  });
  return { bpm: 108, steps: prog.length * 16, notes };
}
