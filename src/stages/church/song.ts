import { type Note, type Song, chordTones, line, type InstFn } from '../../audio/music';
import { midi, tone } from '../../audio/audio';

/** Pipe organ: stacked flue ranks (8', 4', 2') with a soft attack and a breath of wind. */
const organ: InstFn = (n, at, dur, vol, out) => {
  const f = midi(n);
  tone({ type: 'sine', freq: f, dur: dur + 0.06, vol: 0.06 * vol, at, out, attack: 0.025 });
  tone({ type: 'square', freq: f * 2, dur: dur + 0.06, vol: 0.012 * vol, at, out, attack: 0.03, filter: { type: 'lowpass', freq: 1800 } });
  tone({ type: 'triangle', freq: f * 4, dur: dur + 0.04, vol: 0.01 * vol, at, out, attack: 0.03, detune: 4 });
  tone({ type: 'sine', freq: f / 2, dur: dur + 0.08, vol: 0.025 * vol, at, out, attack: 0.04 });
};

// "The Echo Cathedral": an original E minor organ piece. A rolling sixteenth-note figure in the
// manuals over long pedal notes, a choir swelling under the second half and a bell on each phrase.
export function churchSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'C', 'Am', 'B', 'Em', 'D', 'C', 'B', 'G', 'D', 'Em', 'B', 'C', 'Am', 'B', 'Em'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch).map((t) => 64 + ((t - 4 + 12) % 12)); // voiced from E4 up
    const v = [...tones, ...tones.map((t) => t + 12)];
    const root = tones[0] - 24;
    const drive = b >= 8;
    // the rolling manual figure, up and back down the chord
    [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2].forEach((k, i) => notes.push({ step: s + i, inst: 'organ', n: v[k] - 12, len: 1, vol: 0.45 }));
    // pedal: a long low root, with a fifth walking in at the half bar
    notes.push({ step: s, inst: 'organ', n: root - 12, len: 8, vol: 0.9 });
    notes.push({ step: s + 8, inst: 'organ', n: root - 12 + (drive ? 7 : 0), len: 8, vol: 0.8 });
    notes.push({ step: s, inst: 'bass', n: root, len: 8 });
    notes.push({ step: s + 8, inst: 'bass', n: root + (drive ? 7 : 0), len: 8 });
    if (drive) {
      tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: t - 12, len: 16, vol: 0.03 }));
      notes.push({ step: s, inst: 'choir', n: tones[0], len: 16 });
      [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'timp', n: 40, len: 4 }));
      [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.35 }));
    } else if (b % 2 === 0) notes.push({ step: s, inst: 'timp', n: 40, len: 6 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'timp', n: 40 + (st - 12) * 2, len: 1 }));
    if (b % 4 === 0) notes.push({ step: s, inst: 'bell', n: b >= 8 ? 71 : 64, len: 16 });
  });
  const lead = [
    // A: the theme, stately (bars 1-8)
    'E5 - - - - - B4 - E5 - G5 - B5 - - -',
    'C6 - B5 - A5 - G5 - E5 - - - G5 - - -',
    'A5 - - - E5 - A5 - C6 - B5 - A5 - - -',
    'F#5 - - - - - - - D#5 - F#5 - B5 - - -',
    'G5 - - - F#5 - E5 - B4 - E5 - G5 - - -',
    'A5 - - - F#5 - D5 - A4 - D5 - F#5 - - -',
    'E5 - G5 - C6 - B5 - A5 - G5 - E5 - - -',
    'D#5 - - - - - - - B4 - - - . . . .',
    // B: full organ (bars 9-16)
    'D6 - - - B5 - G5 - D5 - G5 - B5 - D6 -',
    'F#6 - - - E6 - D6 - A5 - - - D6 - - -',
    'E6 - D6 - B5 - G5 - E5 - G5 - B5 - - -',
    'D#6 - - - C6 - B5 - F#5 - - - A5 - B5 -',
    'G5 - - - E5 - C6 - B5 - A5 - G5 - E5 -',
    'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -',
    'B5 - - - A5 - G5 - F#5 - D#5 - F#5 - - -',
    'E5 - - - - - - - - - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`church bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'organ', i * 16, i < 8 ? 0.9 : 1.1));
    if (i >= 8) line(l, 'organ', i * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
  });
  return { instruments: { organ }, bpm: 112, steps: prog.length * 16, notes };
}
