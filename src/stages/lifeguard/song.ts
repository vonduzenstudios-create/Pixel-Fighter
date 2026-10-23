import { type InstFn, type Note, type Song, chordTones, line } from '../../audio/music';
import { midi, tone } from '../../audio/audio';

/** Clean surf guitar: a bright twangy saw that dies fast, with a slap-back echo behind it. */
const twang: InstFn = (n, at, dur, vol, out) => {
  const f = midi(n);
  for (const [d, v] of [[0, 1], [0.11, 0.35]]) {
    tone({ type: 'sawtooth', freq: f, dur: 0.25 + dur * 0.6, vol: 0.05 * vol * v, at: at + d, out, filter: { type: 'lowpass', freq: 3600, to: 900, q: 3 } });
    tone({ type: 'triangle', freq: f * 2, dur: 0.12, vol: 0.03 * vol * v, at: at + d, out });
  }
};

/** Warm synth pad: two slow detuned saws through a soft lowpass. */
const pad: InstFn = (n, at, dur, vol, out) => {
  const f = midi(n);
  for (const d of [-10, 10])
    tone({ type: 'sawtooth', freq: f, dur: dur + 0.3, vol: 0.018 * vol, at, out, attack: 0.3, detune: d, filter: { type: 'lowpass', freq: 1200 } });
};

// "Rescue Point": an original sunny D-major beach-rock anthem. Surf guitar and a soaring synth
// lead over warm pads, driving eighth-note bass and a big backbeat, built for running along the
// shore in slow motion.
export function lifeguardSong(): Song {
  const notes: Note[] = [];
  const prog = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A', 'Em', 'G', 'D', 'A', 'Em', 'G', 'A', 'A'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const chorus = b >= 8;
    // driving eighth-note bass, an octave pop on the last eighth
    for (let e = 0; e < 8; e++) notes.push({ step: s + e * 2, inst: 'bass', n: 36 + root + (e === 7 ? 12 : 0), len: 2 });
    tones.forEach((t) => notes.push({ step: s, inst: 'pad', n: 60 + ((t + 10) % 12) - 10 + 12, len: 16, vol: chorus ? 1 : 0.7 }));
    // the surf guitar rakes a broken chord through each bar
    [0, 3, 6, 8, 11, 14].forEach((st, i) => notes.push({ step: s + st, inst: 'twang', n: 55 + ((tones[i % 3] + 5) % 12), len: 2, vol: 0.55 }));
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    if (chorus) notes.push({ step: s + 10, inst: 'kick', n: 0, len: 1 });
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 4 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.6 });
  });
  const lead = [
    // verse (bars 1-8): the surf guitar carries the tune
    'F#5 - - - A5 - D6 - - - C#6 - B5 - A5 -',
    'E5 - - - - - . . C#5 - E5 - A5 - - -',
    'B5 - - - A5 - F#5 - - - D5 - F#5 - A5 -',
    'G5 - - - - - B5 - A5 - G5 - F#5 - E5 -',
    'F#5 - - - A5 - D6 - - - E6 - F#6 - E6 -',
    'C#6 - - - A5 - - - E5 - F#5 - A5 - - -',
    'B5 - - - D6 - B5 - G5 - - - A5 - B5 -',
    'A5 - - - - - - - . . A5 - B5 - C#6 -',
    // chorus (bars 9-16): the synth lead soars over it
    'D6 - - - - - E6 - B5 - - - G5 - - -',
    'B5 - - - D6 - - - G6 - - - F#6 - E6 -',
    'F#6 - - - - - D6 - A5 - - - D6 - E6 -',
    'E6 - - - C#6 - - - A5 - - - - - . .',
    'G5 - - - B5 - E6 - - - D6 - B5 - G5 -',
    'B5 - - - - - D6 - G6 - - - F#6 - G6 -',
    'A6 - - - - - - - G6 - F#6 - E6 - C#6 -',
    'E6 - - - - - - - - - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`lifeguard bar ${i + 1} is not 16 steps`);
    if (i < 8) notes.push(...line(l, 'twang', i * 16, 0.9));
    else {
      notes.push(...line(l, 'lead', i * 16, 0.8));
      line(l, 'twang', i * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
    }
  });
  return { instruments: { twang, pad }, bpm: 116, steps: prog.length * 16, notes };
}
