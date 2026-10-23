import { type Note, type Song, chordTones, line, type InstFn } from '../../audio/music';
import { midi, tone } from '../../audio/audio';

/** Concert harp: a bright plucked triangle with a soft sine body and a quick decay. */
const harp: InstFn = (n, at, dur, vol, out) => {
  const f = midi(n);
  const d = Math.max(0.6, dur * 2);
  tone({ type: 'triangle', freq: f, dur: d, vol: 0.05 * vol, at, out, attack: 0.003 });
  tone({ type: 'sine', freq: f * 2, dur: d * 0.5, vol: 0.02 * vol, at, out, attack: 0.002 });
  tone({ type: 'sine', freq: f / 2, dur: d * 0.7, vol: 0.015 * vol, at, out, attack: 0.004 });
};

// "Cloud Nine": an original D major theme for the Pearly Gates. Rippling harp arpeggios over a
// choir pad, a soaring flute and bell melody, and a light, bright beat so it still feels like a
// fight. The second half lifts into a fuller choir and strings with timpani on the downbeats.
export function heavenSong(): Song {
  const notes: Note[] = [];
  const prog = ['D', 'A', 'Bm', 'G', 'D', 'G', 'Em', 'A', 'G', 'D', 'Em', 'Bm', 'G', 'A', 'F#m', 'A'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lift = b >= 8;
    const v = tones.map((t) => 62 + ((t - 2 + 12) % 12)); // voiced from D4 up
    const arp = [...v, ...v.map((t) => t + 12), v[0] + 24];
    // the harp ripples up and back down the chord in sixteenths
    [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5].forEach((k, i) => notes.push({ step: s + i, inst: 'harp', n: arp[k], len: 1, vol: 0.55 }));
    // bass: root on the downbeat, fifth on the half bar
    notes.push({ step: s, inst: 'bass', n: 38 + ((root - 2 + 12) % 12), len: 6 });
    notes.push({ step: s + 8, inst: 'bass', n: 38 + ((root - 2 + 12) % 12) + 7, len: 4 });
    notes.push({ step: s + 12, inst: 'bass', n: 38 + ((root - 2 + 12) % 12) + 12, len: 2 });
    // choir pad; strings join in the second half
    notes.push({ step: s, inst: 'choir', n: v[0], len: 16 });
    if (lift) {
      notes.push({ step: s, inst: 'choir', n: v[2], len: 16 });
      v.forEach((t) => notes.push({ step: s, inst: 'strings', n: t - 12, len: 16, vol: 0.03 }));
      [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'timp', n: 38, len: 4 }));
    }
    // a light beat: soft kick, a shaker-like hat and a gentle backbeat
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1, vol: 0.6 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.35 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h + 1, inst: 'hat', n: 0, len: 1, vol: 0.5 });
    if (b % 4 === 0) notes.push({ step: s, inst: 'bell', n: lift ? 74 : 69, len: 16 });
    if (b % 8 === 7) notes.push({ step: s + 12, inst: 'crash', n: 0, len: 1, vol: 0.3 });
  });
  const lead = [
    // A: the gates open (bars 1-8)
    'F#5 - - - A5 - D6 - - - C#6 - B5 - A5 -',
    'E5 - - - - - A5 - C#6 - E6 - - - C#6 -',
    'D6 - - - B5 - F#5 - - - B5 - D6 - F#6 -',
    'E6 - - - D6 - B5 - G5 - - - - - - -',
    'A5 - - - F#5 - D5 - A5 - D6 - F#6 - - -',
    'G6 - - - F#6 - E6 - D6 - B5 - G5 - - -',
    'E6 - D6 - B5 - G5 - E5 - G5 - B5 - - -',
    'C#6 - - - - - - - E5 - A5 - C#6 - E6 -',
    // B: above the clouds (bars 9-16)
    'D6 - - - B5 - D6 - G6 - - - F#6 - E6 -',
    'F#6 - - - - - D6 - A5 - D6 - F#6 - A6 -',
    'G6 - - - E6 - B5 - G5 - B5 - E6 - G6 -',
    'F#6 - - - D6 - B5 - F#5 - - - - - - -',
    'B5 - - - D6 - G6 - B6 - - - A6 - G6 -',
    'A6 - - - E6 - C#6 - A5 - C#6 - E6 - - -',
    'F#6 - - - C#6 - A5 - F#5 - A5 - C#6 - - -',
    'E6 - - - - - - - . . . . . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`heaven bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'flute', i * 16, i < 8 ? 0.7 : 0.9));
    if (i >= 8) line(l, 'bell', i * 16, 0.25).forEach((n) => notes.push(n));
  });
  return { instruments: { harp }, bpm: 100, steps: prog.length * 16, notes };
}
