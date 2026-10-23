import { ac, midi, musicOut, noise, tone } from './audio';

// A tiny tracker. Songs are written in note strings (16th-note steps) plus chord
// progressions that drive generated bass, string pads and percussion.
// All compositions here are original.

export type Inst = 'fiddle' | 'reed' | 'lead' | 'strings' | 'choir' | 'bass' | 'brass' | 'bell' | 'timp' | 'kick' | 'snare' | 'hat' | 'clack' | 'whistle' | 'arp' | 'pluck' | 'flute' | 'synbrass' | 'tom' | 'crash' | 'guitar' | 'gtrlead' | 'steel';
/** Plays one note of a song's own instrument: midi note, start time, duration (s), volume, output node. */
export type InstFn = (n: number, at: number, dur: number, vol: number, out: AudioNode) => void;
export interface Note { step: number; inst: Inst | (string & {}); n: number; len: number; vol?: number }
export interface Song {
  bpm: number;
  steps: number;
  notes: Note[];
  /** Instruments only this song uses, by name; they take priority over the built-in ones. */
  instruments?: Record<string, InstFn>;
}

export const NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const nn = (s: string) => {
  const m = /^([A-G][#b]?)(\d)$/.exec(s)!;
  return NAMES[m[1]] + (parseInt(m[2]) + 1) * 12;
};

/** Parse "D5 - - - A4 . ." into notes: '-' holds the previous note, '.' is a rest. */
export function line(str: string, inst: Note['inst'], start: number, vol?: number): Note[] {
  const out: Note[] = [];
  const tok = str.trim().split(/\s+/);
  let cur: Note | null = null;
  tok.forEach((t, i) => {
    if (t === '-') {
      if (cur) cur.len++;
    } else if (t === '.') cur = null;
    else {
      cur = { step: start + i, inst, n: nn(t), len: 1, vol };
      out.push(cur);
    }
  });
  return out;
}

// chord = root note name + quality
export function chordTones(ch: string): number[] {
  const m = /^([A-G][#b]?)(m|dim|7|)$/.exec(ch)!;
  const r = NAMES[m[1]];
  const third = m[2] === 'm' || m[2] === 'dim' ? 3 : 4;
  const fifth = m[2] === 'dim' ? 6 : 7;
  return [r, r + third, r + fifth];
}

function fightSong(): Song {
  const notes: Note[] = [];
  const prog = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'C', 'Bb', 'A', 'Gm', 'Dm', 'Edim', 'A'];
  const bars = prog.length;
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // galloping bass ostinato
    [0, 2, 3, 6, 8, 10, 11, 14].forEach((st, i) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + (i === 4 ? 12 : 0), len: 1 }));
    // sustained string chord, voiced in octave 4
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 60 + ((t + 12 - 2) % 12) + 2 - (t > 9 ? 12 : 0), len: 16, vol: 0.05 }));
    // percussion
    notes.push({ step: s, inst: 'timp', n: 38 + root % 12 - (root % 12 > 5 ? 12 : 0), len: 4 });
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1 });
    notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.5 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    // brass stabs on the second half
    if (b >= 8) [0, 6, 12].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 55 + ((t + 5) % 12), len: 2 })));
    if (b >= 8) notes.push({ step: s, inst: 'choir', n: 62 + ((root + 10) % 12) - 10 + 12, len: 16 });
  });
  const lead = [
    // A section (bars 1-4)
    'D5 - - - A4 - - - F5 - E5 - D5 - - -',
    'F5 - - - G5 - F5 - E5 - D5 - C5 - - -',
    'D5 - - - Bb4 - - - G4 - A4 - Bb4 - D5 -',
    'C#5 - - - - - - - E5 - - - A4 - - -',
    // A' (bars 5-8)
    'D5 - - - A4 - - - F5 - G5 - A5 - - -',
    'Bb5 - - - A5 - G5 - F5 - G5 - A5 - - -',
    'G5 - F5 - E5 - D5 - Bb4 - D5 - G5 - - -',
    'E5 - - - C#5 - D5 - E5 - - - - - - -',
    // B section (bars 9-16)
    'A5 - - - - - G5 F5 E5 - F5 - G5 - A5 -',
    'G5 - - - E5 - - - C5 - D5 - E5 - G5 -',
    'F5 - - - D5 - - - Bb4 - C5 - D5 - F5 -',
    'E5 - - - C#5 - - - A4 - - - - - - -',
    'D5 - E5 - F5 - G5 - Bb5 - A5 - G5 - F5 -',
    'A5 - - - F5 - - - D5 - - - A4 - - -',
    'G4 - Bb4 - E5 - - - G5 - - - Bb5 - - -',
    'A5 - - - - - - - C#5 - - - E5 - - -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16)));
  return { bpm: 118, steps: bars * 16, notes };
}

// "Rise of Legends": the title theme. A B minor fanfare intro, a driving verse with a synth-brass
// lead over a pumping octave bass, then a soaring chorus that lifts to D major before turning back.
function titleSong(): Song {
  const notes: Note[] = [];
  const voice = (t: number, lo: number) => lo + ((t - lo % 12 + 24) % 12); // pitch class t placed in [lo, lo+12)
  const stab = (s: number, ch: string, len: number, vol = 1) => chordTones(ch).forEach((t) => notes.push({ step: s, inst: 'synbrass', n: voice(t, 59), len, vol: 0.55 * vol }));
  const drums = (s: number, fill: boolean) => {
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1 });
    if (!fill) notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1 });
    for (let h = 0; h < (fill ? 12 : 16); h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 ? 0.6 : 1 });
    if (fill) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1 }));
  };

  // Intro (bars 1-2): dotted fanfare hits, then a held dominant over a rising tom roll.
  [0, 3, 6].forEach((st) => stab(st, 'Bm', 2));
  stab(10, 'G', 2);
  stab(12, 'A', 4);
  stab(16, 'F#', 16, 0.9);
  [0, 3, 6, 10, 12].forEach((st) => notes.push({ step: st, inst: 'bass', n: 35 + (st === 10 ? 8 : st === 12 ? 10 : 0), len: 2 }));
  notes.push({ step: 16, inst: 'bass', n: 42, len: 16, vol: 0.1 });
  notes.push({ step: 0, inst: 'crash', n: 0, len: 1 });
  notes.push({ step: 0, inst: 'timp', n: 35, len: 4 });
  notes.push({ step: 12, inst: 'timp', n: 33, len: 4 });
  for (let st = 16; st < 32; st += st < 24 ? 2 : 1) notes.push({ step: st, inst: st < 24 ? 'timp' : 'tom', n: st < 24 ? 42 : 40 + (st - 24) * 2, len: 1, vol: 0.5 + (st - 16) / 32 });
  notes.push(...line('. . . . . . . . . . . . . . . . F#4 - - - - - - - A#4 - - - C#5 - - -', 'lead', 0, 0.6));

  const verse = ['Bm', 'G', 'A', 'Bm', 'Bm', 'G', 'Em', 'F#'];
  const chorus = ['D', 'A', 'Bm', 'G', 'Em', 'A', 'F#', 'F#'];
  [...verse, ...chorus].forEach((ch, i) => {
    const b = i + 2, s = b * 16;
    const tones = chordTones(ch);
    const low = voice(tones[0], 33); // bass root between A1 and G#2
    const inChorus = i >= 8;
    // pumping, syncopated octave bass
    [0, 2, 3, 5, 6, 8, 10, 11, 13, 14].forEach((st, k) => notes.push({ step: s + st, inst: 'bass', n: low + (k % 3 === 1 ? 12 : 0), len: 1 }));
    drums(s, i === 7 || i === 15);
    if (i === 0 || i === 4 || inChorus && i % 4 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1 });
    if (!inChorus) {
      // off-beat brass punches answer the melody in the second half of the verse
      if (i >= 4) [6, 14].forEach((st) => stab(s + st, ch, 1, 0.7));
      tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: voice(t, 54), len: 16, vol: 0.03 }));
    } else {
      tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: voice(t, 57), len: 16, vol: 0.045 }));
      notes.push({ step: s, inst: 'choir', n: voice(tones[0], 57), len: 16 });
      // a bright 16th arpeggio sparkles under the chorus
      [0, 1, 2, 1].forEach((k, j) => [0, 4, 8, 12].forEach((q) => notes.push({ step: s + q + j, inst: 'arp', n: voice(tones[k], 69) + (j === 2 ? 12 : 0), len: 1, vol: 0.8 })));
      if (i % 2 === 0) notes.push({ step: s, inst: 'timp', n: voice(tones[0], 33), len: 4 });
    }
  });

  const melody = [
    // verse (bars 3-10)
    'B4 - - - - - F#5 - - - - - E5 - F#5 -',
    'G5 - - - F#5 - E5 - D5 - - - B4 - D5 -',
    'E5 - - - - - A5 - - - - - G5 - F#5 -',
    'F#5 - - - - - - - . . B4 C#5 D5 - E5 -',
    'F#5 - - - - - B5 - - - - - A5 - F#5 -',
    'G5 - - - - - D5 - - - - - G5 - A5 -',
    'B5 - - - A5 - G5 - E5 - - - G5 - B5 -',
    'A#5 - - - - - - - C#6 - - - A#5 - F#5 -',
    // chorus (bars 11-18)
    'A5 - - - - - - - F#5 - - - A5 - D6 -',
    'C#6 - - - - - - - E5 - - - A5 - C#6 -',
    'D6 - - - C#6 - B5 - F#5 - - - B5 - D6 -',
    'E6 - - - D6 - B5 - G5 - - - - - - -',
    'G5 - - - B5 - - - E6 - - - D6 - B5 -',
    'C#6 - - - - - A5 - E5 - - - A5 - C#6 -',
    'A#5 - - - - - - - - - - - F#5 - A#5 -',
    'C#6 - - - - - - - . . . . . . . .',
  ];
  melody.forEach((l, i) => {
    const s = (i + 2) * 16;
    notes.push(...line(l, 'synbrass', s));
    // a square lead doubles an octave down for that 16-bit bite
    line(l, 'lead', s, 0.45).forEach((n) => notes.push({ ...n, n: n.n - 12 }));
  });
  return { bpm: 150, steps: 18 * 16, notes };
}

function victorySong(): Song {
  const notes: Note[] = [
    ...line('D5 - D5 F5 A5 - - - G5 - F5 - E5 - - - D5 - - - - - - - . . . . . . . .', 'brass', 0),
    ...line('D4 - - - - - - - C4 - - - - - - - D4 - - - - - - - . . . . . . . .', 'strings', 0, 0.06),
    { step: 0, inst: 'timp', n: 38, len: 2 },
    { step: 16, inst: 'timp', n: 33, len: 2 },
    { step: 24, inst: 'timp', n: 38, len: 6 },
  ];
  return { bpm: 110, steps: 32, notes };
}

/** The Sporewood: a bouncy, twinkly forest waltz-in-four in F major. */

// Songs that are not tied to a stage. Each stage brings its own (src/stages/<id>/), registered by
// src/stages/registry.ts through addSongs. Songs are composed the first time they are played.
const BUILDERS: Record<string, () => Song> = { fight: fightSong, title: titleSong, victory: victorySong };
const built = new Map<string, Song>();

export type SongName = string;

/** Make songs playable by name. */
export function addSongs(songs: Record<string, () => Song>) {
  Object.assign(BUILDERS, songs);
}

export function songNames(): string[] {
  return Object.keys(BUILDERS);
}

/** A song by name, composing it on first use. */
export function getSong(name: SongName): Song {
  let s = built.get(name);
  if (!s) {
    const make = BUILDERS[name];
    if (!make) throw new Error(`unknown song: ${name}`);
    built.set(name, (s = make()));
  }
  return s;
}

function play(inst: Note['inst'], n: number, at: number, dur: number, vol = 1) {
  const out = musicOut();
  const own = current?.instruments?.[inst];
  if (own) return own(n, at, dur, vol, out);
  const f = midi(n);
  switch (inst) {
    case 'fiddle':
      tone({ type: 'sawtooth', freq: f, dur: dur + 0.06, vol: 0.05 * vol, at, out, attack: 0.03, filter: { type: 'lowpass', freq: 2800, to: 1600 } });
      tone({ type: 'sawtooth', freq: f, dur: dur + 0.06, vol: 0.025 * vol, at, out, attack: 0.05, detune: 14, filter: { type: 'lowpass', freq: 2000 } });
      break;
    case 'reed':
      for (const d of [-7, 7])
        tone({ type: 'square', freq: f, dur: dur * 0.9 + 0.04, vol: 0.022 * vol, at, out, attack: 0.012, detune: d, filter: { type: 'bandpass', freq: 1300, q: 0.9 } });
      break;
    case 'lead':
      tone({ type: 'square', freq: f, dur: dur * 0.95 + 0.05, vol: 0.06 * vol, at, out, filter: { type: 'lowpass', freq: 3200 } });
      tone({ type: 'sawtooth', freq: f, dur: dur * 0.95 + 0.05, vol: 0.03 * vol, at, out, detune: 8 });
      break;
    case 'strings':
      for (const d of [-9, 9])
        tone({ type: 'sawtooth', freq: f, dur: dur + 0.2, vol: (vol || 0.05), at, out, attack: 0.18, detune: d, filter: { type: 'lowpass', freq: 1500 } });
      break;
    case 'choir':
      for (const fr of [730, 1090])
        tone({ type: 'sawtooth', freq: f, dur: dur + 0.3, vol: 0.05, at, out, attack: 0.35, filter: { type: 'bandpass', freq: fr, q: 5 } });
      break;
    case 'bass':
      tone({ type: 'triangle', freq: f, dur: Math.max(0.12, dur * 0.9), vol: (vol === 1 ? 0.22 : vol * 2), at, out });
      tone({ type: 'square', freq: f, dur: Math.max(0.1, dur * 0.6), vol: 0.035, at, out, filter: { type: 'lowpass', freq: 600 } });
      break;
    case 'brass':
      tone({ type: 'sawtooth', freq: f, dur: dur + 0.05, vol: 0.06 * vol, at, out, attack: 0.02, filter: { type: 'lowpass', freq: 2200, to: 700 } });
      break;
    case 'synbrass':
      // fat detuned saws with a bright attack that mellows, plus a soft octave-down body
      for (const d of [-11, 11])
        tone({ type: 'sawtooth', freq: f, dur: dur * 0.95 + 0.08, vol: 0.045 * vol, at, out, attack: 0.025, detune: d, filter: { type: 'lowpass', freq: 3400, to: 1300, q: 2 } });
      tone({ type: 'square', freq: f / 2, dur: dur * 0.9 + 0.05, vol: 0.015 * vol, at, out, attack: 0.02, filter: { type: 'lowpass', freq: 1200 } });
      break;
    case 'tom':
      tone({ type: 'sine', freq: midi(n) * 1.5, to: midi(n), dur: 0.22, vol: 0.3 * vol, at, out });
      noise({ dur: 0.05, vol: 0.06 * vol, freq: 900, at, out });
      break;
    case 'crash':
      noise({ dur: 1.4, vol: 0.09 * vol, type: 'highpass', freq: 5000, to: 3000, at, out });
      break;
    case 'guitar':
      // overdriven power chord: root, fifth and octave as gritty detuned saws, plus a buzzy square
      for (const [k, d] of [[1, -7], [1.5, 7], [2, 0]])
        tone({ type: 'sawtooth', freq: f * k, dur: dur * 0.9 + 0.04, vol: 0.032 * vol, at, out, detune: d, filter: { type: 'lowpass', freq: 2600, to: 900, q: 4 } });
      tone({ type: 'square', freq: f, dur: dur * 0.9 + 0.03, vol: 0.025 * vol, at, out, filter: { type: 'lowpass', freq: 1400 } });
      break;
    case 'gtrlead':
      // screaming lead: two detuned saws through a resonant peak, with a slow attack for sustain
      for (const d of [-12, 12])
        tone({ type: 'sawtooth', freq: f, dur: dur * 0.95 + 0.08, vol: 0.04 * vol, at, out, attack: 0.02, detune: d, filter: { type: 'bandpass', freq: f * 3, q: 1.5 } });
      tone({ type: 'square', freq: f, dur: dur * 0.95 + 0.06, vol: 0.02 * vol, at, out, filter: { type: 'lowpass', freq: 2400 } });
      break;
    case 'bell':
      tone({ type: 'sine', freq: f, dur: 1.6, vol: 0.08, at, out });
      tone({ type: 'sine', freq: f * 2.76, dur: 0.6, vol: 0.025, at, out });
      break;
    case 'pluck':
      tone({ type: 'triangle', freq: f, dur: 0.22, vol: 0.12 * vol, at, out });
      tone({ type: 'square', freq: f * 2, dur: 0.06, vol: 0.02 * vol, at, out, filter: { type: 'lowpass', freq: 2500 } });
      break;
    case 'flute':
      tone({ type: 'sine', freq: f, dur: dur + 0.08, vol: 0.09 * vol, at, out, attack: 0.05 });
      tone({ type: 'triangle', freq: f, dur: dur + 0.08, vol: 0.03 * vol, at, out, attack: 0.07, detune: 6 });
      noise({ dur: 0.08, vol: 0.02 * vol, type: 'bandpass', freq: f * 2, q: 3, at, out });
      break;
    case 'timp':
      tone({ type: 'sine', freq: f * 1.4, to: f, dur: Math.max(0.5, dur), vol: 0.35, at, out });
      noise({ dur: 0.12, vol: 0.12, freq: 500, at, out });
      break;
    case 'kick':
      tone({ type: 'sine', freq: 140, to: 40, dur: 0.18, vol: 0.4, at, out });
      break;
    case 'snare':
      noise({ dur: 0.14, vol: 0.18 * vol, type: 'bandpass', freq: 1800, q: 0.7, at, out });
      tone({ type: 'triangle', freq: 220, to: 120, dur: 0.08, vol: 0.08 * vol, at, out });
      break;
    case 'arp':
      tone({ type: 'square', freq: f, dur: 0.11, vol: 0.035 * vol, at, out, filter: { type: 'lowpass', freq: 2600, to: 500 } });
      break;
    case 'hat':
      noise({ dur: 0.04, vol: 0.05, type: 'highpass', freq: 7000, at, out });
      break;
    case 'clack':
      noise({ dur: 0.03, vol: 0.16 * vol, type: 'bandpass', freq: 2600, q: 3, at, out });
      tone({ type: 'square', freq: 420, to: 300, dur: 0.03, vol: 0.05 * vol, at, out, filter: { type: 'lowpass', freq: 1800 } });
      break;
    case 'steel':
      // steel pan: a sweet fundamental with a ringing octave and a metallic overtone that dies fast
      tone({ type: 'sine', freq: f, dur: 0.45 + dur * 0.4, vol: 0.1 * vol, at, out, attack: 0.004 });
      tone({ type: 'sine', freq: f * 2, dur: 0.3, vol: 0.045 * vol, at, out, attack: 0.004 });
      tone({ type: 'triangle', freq: f * 3.02, dur: 0.07, vol: 0.02 * vol, at, out });
      break;
    case 'whistle':
      // steam whistle: a sour chord of breathy pipes that sag in pitch as the steam runs out
      for (const k of [1, 1.19, 1.5])
        tone({ type: 'triangle', freq: f * k, to: f * k * 0.97, dur, vol: 0.05, at, out, attack: 0.06 });
      noise({ dur, vol: 0.05, type: 'bandpass', freq: f * 1.2, q: 6, at, out, attack: 0.06 });
      break;
  }
}

// Look-ahead scheduler (keeps timing tight regardless of frame rate).
let current: Song | null = null;
let curName: SongName | null = null;
let step = 0;
let nextTime = 0;
let timer: number | undefined;
let loop = true;
let byStep: Note[][] = [];

export function playSong(name: SongName, repeat = true) {
  const c = ac();
  if (!c) return;
  if (curName === name && current) return;
  stopSong();
  current = getSong(name);
  curName = name;
  loop = repeat;
  byStep = Array.from({ length: current.steps }, () => []);
  for (const n of current.notes) byStep[n.step % current.steps].push(n);
  step = 0;
  nextTime = c.currentTime + 0.08;
  timer = window.setInterval(tick, 25);
}

export function stopSong() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  current = null;
  curName = null;
}

function tick() {
  const c = ac();
  if (!c || !current) return;
  const stepDur = 60 / current.bpm / 4;
  while (nextTime < c.currentTime + 0.12) {
    for (const n of byStep[step]) play(n.inst, n.n, nextTime, n.len * stepDur, n.vol ?? 1);
    nextTime += stepDur;
    step++;
    if (step >= current.steps) {
      if (!loop) {
        stopSong();
        return;
      }
      step = 0;
    }
  }
}
