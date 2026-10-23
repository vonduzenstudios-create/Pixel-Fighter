import { ac, midi, musicOut, noise, tone } from './audio';

// A tiny tracker. Songs are written in note strings (16th-note steps) plus chord
// progressions that drive generated bass, string pads and percussion.
// All compositions here are original.

type Inst = 'lead' | 'strings' | 'choir' | 'bass' | 'brass' | 'bell' | 'timp' | 'kick' | 'snare' | 'hat' | 'clack' | 'whistle' | 'arp';
interface Note { step: number; inst: Inst; n: number; len: number; vol?: number }
interface Song { bpm: number; steps: number; notes: Note[] }

const NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const nn = (s: string) => {
  const m = /^([A-G][#b]?)(\d)$/.exec(s)!;
  return NAMES[m[1]] + (parseInt(m[2]) + 1) * 12;
};

/** Parse "D5 - - - A4 . ." into notes: '-' holds the previous note, '.' is a rest. */
function line(str: string, inst: Inst, start: number, vol?: number): Note[] {
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
function chordTones(ch: string): number[] {
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

// The Midnight Express: a driving E minor gallop over a clickety-clack rail rhythm.
function trainSong(): Song {
  const notes: Note[] = [];
  const prog = ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B', 'C', 'D', 'Em', 'Em', 'Am', 'C', 'B', 'B'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const low = 36 + root - (root > 7 ? 12 : 0); // bass root around E2
    // pumping octave bass, like pistons
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: low + (st % 4 === 2 ? 12 : 0), len: 1 });
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 59 + ((t + 1) % 12), len: 16, vol: 0.04 }));
    // the rails: a double clack on every beat, accented on the one
    for (let st = 0; st < 16; st += 4) {
      notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: st === 0 ? 1 : 0.6 });
      notes.push({ step: s + st + 1, inst: 'clack', n: 0, len: 1, vol: 0.45 });
    }
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1 });
    notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1 });
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [14, 15].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.6 }));
    if (b >= 8) [0, 3, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 52 + ((t + 8) % 12), len: 2 })));
    if (b === 8 || b === 12) notes.push({ step: s, inst: 'timp', n: 40, len: 4 });
  });
  // the whistle blows as the loop comes around
  notes.push({ step: 0, inst: 'whistle', n: 76, len: 10 });
  notes.push({ step: 128, inst: 'whistle', n: 76, len: 6 });
  const lead = [
    'E5 - - - B4 - E5 - G5 - - - F#5 - E5 -',
    'G5 - - - E5 - - - C5 - D5 - E5 - - -',
    'F#5 - - - D5 - - - A4 - D5 - F#5 - A5 -',
    'G5 - F#5 - D#5 - - - B4 - - - - - - -',
    'E5 - - - B4 - E5 - G5 - - - A5 - B5 -',
    'C6 - - - B5 - A5 - G5 - - - E5 - - -',
    'A5 - - - G5 - E5 - C5 - E5 - A5 - - -',
    'F#5 - - - D#5 - - - B4 - - - . . . .',
    'G5 - - - - - E5 - G5 - - - C6 - - -',
    'A5 - - - - - F#5 - D5 - - - A5 - - -',
    'B5 - - - G5 - - - E5 - G5 - B5 - - -',
    'E6 - - - - - - - D6 - C6 - B5 - - -',
    'C6 - B5 - A5 - - - E5 - - - A5 - - -',
    'G5 - A5 - G5 - E5 - C5 - - - E5 - G5 -',
    'F#5 - - - - - - - D#5 - - - F#5 - - -',
    'B5 - - - - - - - A5 - G5 - F#5 - D#5 -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16)));
  return { bpm: 152, steps: prog.length * 16, notes };
}

function titleSong(): Song {
  const notes: Note[] = [];
  const prog = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'C', 'A'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    notes.push({ step: s, inst: 'bass', n: 26 + tones[0], len: 16, vol: 0.12 });
    notes.push({ step: s, inst: 'choir', n: 50 + tones[0] + (tones[0] > 7 ? -12 : 0) + 12, len: 16 });
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t + 3) % 12), len: 16, vol: 0.035 }));
    notes.push({ step: s, inst: 'timp', n: 38, len: 6 });
    if (b % 2 === 1) notes.push({ step: s + 12, inst: 'timp', n: 38, len: 2 });
    // bell arpeggio
    [0, 4, 8, 12].forEach((st, i) => notes.push({ step: s + st, inst: 'bell', n: 74 + ((tones[i % 3] + 10) % 12) - 10 + (i === 3 ? 12 : 0), len: 4 }));
  });
  return { bpm: 76, steps: prog.length * 16, notes };
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

// "Data Spire": cold E-minor synth arpeggios over a driving bass, strings and brass join later.
function spireSong(): Song {
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

export const SONGS = { fight: fightSong(), train: trainSong(), title: titleSong(), victory: victorySong(), spire: spireSong() };
export type SongName = keyof typeof SONGS;

function play(inst: Inst, n: number, at: number, dur: number, vol = 1) {
  const out = musicOut();
  const f = midi(n);
  switch (inst) {
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
    case 'bell':
      tone({ type: 'sine', freq: f, dur: 1.6, vol: 0.08, at, out });
      tone({ type: 'sine', freq: f * 2.76, dur: 0.6, vol: 0.025, at, out });
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
  current = SONGS[name];
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
