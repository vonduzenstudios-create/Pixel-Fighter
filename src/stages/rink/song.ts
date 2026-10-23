import { type InstFn, type Note, type Song, chordTones, line } from '../../audio/music';
import { midi, noise, tone } from '../../audio/audio';

/** House-piano stab: two detuned squares and a triangle an octave up, closing quickly. */
const house: InstFn = (n, at, _dur, vol, out) => {
  const f = midi(n);
  tone({ type: 'square', freq: f, dur: 0.22, vol: 0.03 * vol, at, out, filter: { type: 'lowpass', freq: 2600, to: 800 } });
  tone({ type: 'square', freq: f, dur: 0.2, vol: 0.02 * vol, at, out, detune: 10, filter: { type: 'lowpass', freq: 2200, to: 700 } });
  tone({ type: 'triangle', freq: f * 2, dur: 0.16, vol: 0.025 * vol, at, out });
};

/** Squelchy synth bass: a resonant sawtooth sweeping shut, with a sine underneath for weight. */
const synbass: InstFn = (n, at, dur, vol, out) => {
  const f = midi(n);
  const d = Math.max(0.12, dur * 0.9);
  tone({ type: 'sawtooth', freq: f, dur: d, vol: 0.07 * vol, at, out, filter: { type: 'lowpass', freq: 1100, to: 220, q: 7 } });
  tone({ type: 'sine', freq: f, dur: d, vol: 0.06 * vol, at, out });
};

/** The big orchestra hit every freestyle record needs: a stacked chord of saws and a burst of noise. */
const orch: InstFn = (n, at, _dur, vol, out) => {
  const f = midi(n);
  [0, 7, 12, 16, 19].forEach((iv) => tone({ type: 'sawtooth', freq: f * 2 ** (iv / 12), dur: 0.5, vol: 0.022 * vol, at, out, filter: { type: 'lowpass', freq: 3400, to: 500 } }));
  noise({ dur: 0.22, vol: 0.05 * vol, type: 'bandpass', freq: 1400, at, out });
};

// "Couples Skate (Extended Mix)": an original A-minor freestyle jam for the roller rink. A
// syncopated squelch bass, house-piano stabs, four-on-the-floor drums and an orchestra hit on
// every phrase, with a bright synth hook skating over the top.
export function rinkSong(): Song {
  const notes: Note[] = [];
  const prog = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'G', 'Dm', 'Am', 'F', 'G', 'Dm', 'Am', 'E', 'E'];
  const voice = (t: number, lo: number) => lo + ((t - lo + 120) % 12);
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = voice(tones[0], 33);
    const drive = b >= 8;
    // freestyle bass: syncopated roots with an octave pop
    [[0, 0, 2], [3, 12, 1], [6, 0, 2], [8, 0, 2], [11, 12, 1], [14, 7, 2]].forEach(([st, iv, len]) => notes.push({ step: s + st, inst: 'synbass', n: root + iv, len }));
    // piano stabs on the push beats
    [0, 3, 6, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'house', n: voice(t, 64), len: 1, vol: st === 0 ? 1 : 0.75 })));
    // four on the floor, claps on two and four, open hats on the off-beats
    [0, 4, 8, 12].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.7 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.45 }));
    for (let h = 0; h < 16; h += drive ? 1 : 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 === 2 ? 1 : 0.45 });
    if (drive) tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: voice(t, 57), len: 16, vol: 0.035 }));
    if (b % 4 === 0) notes.push({ step: s, inst: 'orch', n: voice(tones[0], 57), len: 2 });
    if (b === 7 || b === 15) [8, 11, 14].forEach((st) => notes.push({ step: s + st, inst: 'orch', n: voice(tones[0], 57), len: 2, vol: 0.8 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.5 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.4 });
  });
  const lead = [
    // A: the hook (bars 1-8)
    'A4 . C5 . E5 - D5 . C5 . D5 . E5 - - -',
    'F5 . E5 . C5 - - - A4 . C5 . F5 - E5 -',
    'D5 . B4 . G4 - - - B4 . D5 . G5 - F5 -',
    'E5 - - - B4 - - - E5 . G5 . B5 - - -',
    'A5 . G5 . E5 - G5 . A5 . C6 . A5 - G5 -',
    'F5 - - - A5 - C6 - A5 . F5 . C5 - - -',
    'D5 . G5 . B5 - - - D6 - B5 - G5 - - -',
    'B5 - - - A5 - G5 - D5 - - - . . . .',
    // B: lights down, everybody skate (bars 9-16)
    'D6 - - - A5 - F5 - D5 . F5 . A5 - - -',
    'C6 - - - A5 - E5 - C5 . E5 . A5 - - -',
    'A5 . C6 . F6 - - - E6 . C6 . A5 - C6 -',
    'B5 . D6 . G6 - - - F6 - E6 - D6 - - -',
    'F6 - - - E6 - D6 - A5 - D6 - F6 - - -',
    'E6 - - - C6 - A5 - E5 - A5 - C6 - - -',
    'B5 - G#5 - E5 - G#5 - B5 - D6 - E6 - - -',
    'G#5 - - - - - - - B4 - - - . . . .',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`rink bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'lead', i * 16, 0.9));
    line(l, 'arp', i * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n + 12 })); // a sparkle an octave up
  });
  return { bpm: 122, steps: prog.length * 16, notes, instruments: { house, synbass, orch } };
}
