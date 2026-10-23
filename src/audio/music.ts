import { ac, midi, musicOut, noise, tone } from './audio';

// A tiny tracker. Songs are written in note strings (16th-note steps) plus chord
// progressions that drive generated bass, string pads and percussion.
// All compositions here are original.

type Inst = 'fiddle' | 'reed' | 'lead' | 'strings' | 'choir' | 'bass' | 'brass' | 'bell' | 'timp' | 'kick' | 'snare' | 'hat' | 'clack' | 'whistle' | 'arp' | 'pluck' | 'flute' | 'synbrass' | 'tom' | 'crash';
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
function mushroomSong(): Song {
  const notes: Note[] = [];
  const prog = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C'];
  // voice pitch class pc at or just above MIDI note lo, so every part stays in the chord
  const at = (pc: number, lo: number) => lo + ((((pc - lo) % 12) + 12) % 12);
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // oom-pah bass: root and fifth, with a little walk-up into the next bar
    [0, 4, 8, 12].forEach((st, i) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + (i % 2 ? 7 : 0), len: 2 }));
    if (b % 2 === 1) notes.push({ step: s + 14, inst: 'bass', n: at(tones[1], 36 + root), len: 1 });
    // soft pad
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: at(t, 57), len: 16, vol: 0.022 }));
    // off-beat chord plucks
    [2, 6, 10, 14].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: at(t, 60), len: 1, vol: 0.45 })));
    // twinkle arpeggio up high
    [0, 3, 6, 9].forEach((st, i) => notes.push({ step: s + st, inst: 'bell', n: at(tones[i % 3], 72) + (i === 3 ? 12 : 0), len: 2 }));
    // light kit
    notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 8, inst: 'kick', n: 0, len: 1 });
    notes.push({ step: s + 4, inst: 'snare', n: 0, len: 1, vol: 0.35 });
    notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1, vol: 0.35 });
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
  });
  const lead = [
    // A: hopping plucked tune (bars 1-8)
    'F5 . A5 . C6 - A5 . G5 . F5 . A5 - - .',
    'D5 . F5 . A5 - F5 . E5 . D5 . F5 - - .',
    'D5 - C5 . Bb4 . D5 . F5 - - . D5 . F5 .',
    'E5 - - . G5 . E5 . C5 - - - . . . .',
    'F5 . A5 . C6 - D6 . C6 . A5 . F5 - - .',
    'E5 . A5 . C6 - G5 . A5 . E5 . C5 - - .',
    'D5 . F5 . Bb5 - A5 . G5 . F5 . D5 . F5 .',
    'G5 - - - E5 - - - C5 - - - . . . .',
    // B: a sung flute line over it (bars 9-16)
    'F5 - - - D5 - - - Bb4 - - - D5 - F5 -',
    'E5 - - - G5 - - - C6 - - - Bb5 - A5 -',
    'A5 - - - E5 - - - C5 - - - E5 - A5 -',
    'F5 - - - A5 - - - D6 - - - C6 - A5 -',
    'Bb5 - A5 - G5 - F5 - D5 - F5 - G5 - Bb5 -',
    'C6 - - - Bb5 - - - G5 - - - E5 - - -',
    'F5 . A5 . C6 . F6 - - - C6 . A5 . F5 .',
    'E5 - - - G5 - - - C5 - . . E5 . G5 .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, i < 8 ? 'pluck' : 'flute', i * 16)));
  // the plucked A tune doubles an octave down so it carries
  lead.slice(0, 8).forEach((l, i) => line(l, 'pluck', i * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 128, steps: prog.length * 16, notes };
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

function boatSong(): Song {
  // "Brine and Bones": a minor-key shanty in 6/8. A bar is 12 steps, so an eighth note is 2 steps.
  const notes: Note[] = [];
  const BAR = 12;
  const prog = ['Am', 'G', 'Am', 'E', 'Am', 'G', 'F', 'E', 'F', 'G', 'C', 'Am', 'F', 'G', 'E', 'E'];
  const eighths = (s: string) => s.trim().split(/\s+/).flatMap((t) => (t === '-' ? ['-', '-'] : t === '.' ? ['.', '.'] : [t, '-'])).join(' ');
  const tune = [
    'E5 - A4 A4 B4 C5', 'D5 - B4 G4 - -', 'C5 - A4 E5 - D5', 'B4 - G#4 E4 - -',
    'E5 - A4 A4 B4 C5', 'D5 - G5 F5 E5 D5', 'C5 - A4 F5 E5 D5', 'E5 - - - - -',
    'A5 - - G5 F5 E5', 'D5 - B4 G4 - D5', 'E5 - D5 C5 - E5', 'A4 - - - C5 E5',
    'F5 - - E5 D5 C5', 'D5 - - B4 C5 D5', 'E5 - D5 C5 B4 G#4', 'E4 - - - . .',
  ];
  // played twice: a lone fiddle first, then the full crew with brass and choir
  for (let pass = 0; pass < 2; pass++)
    prog.forEach((ch, i) => {
      const b = pass * prog.length + i, s = b * BAR;
      const tones = chordTones(ch);
      const root = tones[0];
      // oom-pah: bass on beats 1 and 4, squeezebox chords on the off-eighths
      notes.push({ step: s, inst: 'bass', n: 36 + root, len: 3 });
      notes.push({ step: s + 6, inst: 'bass', n: 36 + root + 7 - (root > 4 ? 12 : 0), len: 3 });
      for (const st of [2, 4, 8, 10]) tones.forEach((t) => notes.push({ step: s + st, inst: 'reed', n: 57 + ((t + 3) % 12), len: 1 }));
      notes.push({ step: s, inst: 'kick', n: 0, len: 1 });
      notes.push({ step: s + 6, inst: 'snare', n: 0, len: 1, vol: 0.6 });
      for (let h = 0; h < BAR; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
      if (i % 4 === 0) notes.push({ step: s, inst: 'timp', n: 24 + root + (root < 4 ? 12 : 0), len: 6 });
      if (i % 8 === 0) [0, 3].forEach((st) => notes.push({ step: s + st, inst: 'bell', n: 81, len: 4 }));
      notes.push(...line(eighths(tune[i]), 'fiddle', s));
      if (pass === 1) {
        notes.push(...line(eighths(tune[i]), 'lead', s, 0.7));
        tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 57 + ((t + 3) % 12), len: BAR, vol: 0.03 }));
        if (i >= 8) notes.push({ step: s, inst: 'choir', n: 57 + ((root + 3) % 12), len: BAR });
        if (i % 2 === 1) [0, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 52 + ((t + 8) % 12), len: 2, vol: 0.8 })));
        if (i === 15) [7, 8, 9, 10, 11].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.5 }));
      }
    });
  return { bpm: 120, steps: prog.length * 2 * BAR, notes };
}

// The moon stage: a slow, weightless E minor piece. Bell arpeggios and a choir float over a
// heartbeat bass, then the strings and a muted lead come in for a mournful melody.
function moonSong(): Song {
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

// "The Howling Pass": a frantic C-minor storm piece. Tremolo strings and a pounding bass
// drive under icy bell runs, a choir howls on top and a fiddle tears through the melody.
function blizzardSong(): Song {
  const notes: Note[] = [];
  const prog = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G', 'Fm', 'Cm', 'Ab', 'G', 'Fm', 'Ab', 'Ddim', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // pounding eighth-note bass with an octave kick on the off beats
    for (let st = 0; st < 16; st += 2) notes.push({ step: s + st, inst: 'bass', n: 36 + root - (root > 7 ? 12 : 0) + (st % 4 === 2 ? 12 : 0), len: 1 });
    // tremolo strings: every 16th re-bows the chord
    for (let st = 0; st < 16; st++) tones.forEach((t) => notes.push({ step: s + st, inst: 'strings', n: 55 + ((t + 5) % 12), len: 1, vol: 0.022 }));
    // the choir howls on the downbeat, a falling icy bell run fills the gap
    notes.push({ step: s, inst: 'choir', n: 60 + root % 12, len: 16 });
    [0, 1, 2, 3, 4, 5].forEach((k) => notes.push({ step: s + 10 + k, inst: 'bell', n: 84 + tones[2 - (k % 3)] - (k >= 3 ? 12 : 0), len: 1, vol: 0.7 }));
    // kit: kick on 1 and the "and" of 2, snare backbeat, driving hats
    [0, 6, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h + 1, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 45 - (st - 13) * 3, len: 1 }));
    if (b % 4 === 0) {
      notes.push({ step: s, inst: 'crash', n: 0, len: 4 });
      notes.push({ step: s, inst: 'timp', n: 36, len: 6 });
    }
    // brass stabs from the second half on
    if (b >= 8) [0, 3, 6].forEach((st) => notes.push({ step: s + st, inst: 'brass', n: 48 + root, len: 2 }));
  });
  const lead = [
    'C5 - - Eb5 G5 - - - C6 - Bb5 - G5 - Eb5 -',
    'Ab5 - - - G5 - Eb5 - C5 - - - Eb5 - F5 -',
    'F5 - - Ab5 C6 - - - F5 - G5 - Ab5 - C6 -',
    'B5 - - - - - - - D5 - F5 - G5 - - -',
    'C6 - - - Bb5 - G5 - Eb5 - G5 - C6 - D6 -',
    'Eb6 - - - D6 - C6 - Ab5 - - - C6 - Eb6 -',
    'D6 - - - Bb5 - F5 - D5 - F5 - Bb5 - D6 -',
    'B5 - - - - - - - G5 - - - . . . .',
    'Ab5 - - - G5 - F5 - C5 - - - F5 - Ab5 -',
    'G5 - - - - - Eb5 - C5 - - - Eb5 - G5 -',
    'C6 - - - Bb5 - Ab5 - Eb5 - - - Ab5 - C6 -',
    'B5 - - - D6 - - - G5 - - - F5 - D5 -',
    'F5 - Ab5 - C6 - F6 - - - Eb6 - C6 - Ab5 -',
    'Eb6 - - - C6 - Ab5 - Eb5 - - - C6 - Eb6 -',
    'D6 - - - F6 - - - Ab5 - - - F5 - D5 -',
    'G5 - - - B5 - - - D6 - - - F6 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`blizzard bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'fiddle', i * 16, 1.1));
  });
  return { bpm: 152, steps: prog.length * 16, notes };
}

// "The Underdrome": a grimy C-minor boom-bap stomp. Clacking breakbeat and a prowling bass,
// brass stabs join in, then a sneering lead takes over the second half.
function undergroundSong(): Song {
  const notes: Note[] = [];
  const prog = ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Cm', 'Fm', 'G', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'Ab', 'G', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 6 ? 12 : 0);
    // prowling bass: root, root, octave jab, minor third slide, root
    [[0, 0, 2], [3, 0, 1], [6, 12, 1], [8, 0, 2], [10, tones[1] - root, 1], [12, 0, 1], [14, 7, 1]].forEach(([st, iv, len]) =>
      notes.push({ step: s + st, inst: 'bass', n: lo + iv, len }));
    // boom-bap kit with a hand clack on the back of every bar
    [0, 7, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    notes.push({ step: s + 15, inst: 'clack', n: 0, len: 1, vol: 0.7 });
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.8 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1 });
    // dark pad underneath
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.025 }));
    // brass stabs from bar 5
    if (b >= 4) [0, 6].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 55 + ((t + 5) % 12), len: 2, vol: 0.8 })));
    if (b % 8 === 0) notes.push({ step: s, inst: 'timp', n: 36, len: 6 });
  });
  // a creeping arpeggio hook for the first half
  for (let b = 0; b < 8; b++) {
    const tones = chordTones(prog[b]);
    [0, 3, 6, 9, 11].forEach((st, i) => notes.push({ step: b * 16 + st, inst: 'arp', n: 72 + ((tones[i % 3] + 12) % 12), len: 1 }));
  }
  const lead = [
    'C5 - - Eb5 - - G5 - F5 - Eb5 - D5 - C5 -',
    'Eb5 - - - D5 - C5 - Bb4 - - - C5 - - -',
    'C5 - - - Eb5 - - - Ab5 - G5 - F5 - Eb5 -',
    'D5 - - - Bb4 - - - C5 - D5 - F5 - - -',
    'G5 - - - - - Ab5 - G5 - F5 - Eb5 - - -',
    'C5 - Eb5 - G5 - C6 - - - Bb5 - G5 - - -',
    'Ab5 - - - G5 - F5 - C5 - - - Eb5 - F5 -',
    'G5 - - - B4 - - - D5 - - - G5 - - -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', (i + 8) * 16, 0.75)));
  return { bpm: 96, steps: prog.length * 16, notes };
}

// "Patty Pete's": a cheesy, bouncy 90s burger-joint jingle with slap bass and brass stabs.
function burgerSong(): Song {
  const notes: Note[] = [];
  const prog = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'G'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    // slap bass: thumbed roots with octave pops and a ghosted pickup
    [[0, 0], [3, 12], [6, 0], [8, 0], [10, 12], [11, 7], [14, 0]].forEach(([st, o]) => notes.push({ step: s + st, inst: 'bass', n: 36 + root + o, len: 1 }));
    // brass stabs on the and-of-two and the four
    [6, 12].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 60 + ((t + 5) % 12) - 5, len: 1, vol: 0.6 })));
    // bright chord plucks on the off-beats
    [2, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'pluck', n: 72 + ((t + 5) % 12) - 5, len: 1, vol: 0.35 })));
    // four-on-the-floor kit with a clap-ish clack
    [0, 4, 8, 12].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.6 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.5 }));
    for (let h = 2; h < 16; h += 4) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1 });
    if (b % 4 === 3) [13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 50 - i * 3, len: 1, vol: 0.6 }));
    if (b % 8 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.6 });
  });
  const lead = [
    // A: the jingle (bars 1-8)
    'G5 . G5 . E5 . G5 - A5 . G5 . E5 - . .',
    'C6 - B5 . A5 . G5 . E5 - - - . . . .',
    'F5 . A5 . C6 . A5 . G5 . F5 . A5 - - .',
    'G5 - - . B5 . D6 . B5 - - - . . . .',
    'G5 . G5 . E5 . G5 - A5 . G5 . E5 - . .',
    'C6 - D6 . E6 . C6 . A5 - - - . . . .',
    'F5 . A5 . D6 . C6 . A5 . F5 . D5 . F5 .',
    'G5 - A5 - B5 - D6 - G5 - - - . . . .',
    // B: the "come on down" bridge (bars 9-16)
    'A5 - - - C6 - A5 - F5 - - - A5 . C6 .',
    'B5 - - - D6 - B5 - G5 - - - . . . .',
    'G5 - - - B5 - G5 - E5 - - - G5 . B5 .',
    'A5 - - - E5 - - - C6 - - - A5 - - -',
    'F5 . F5 . A5 . C6 - F6 - - - C6 . A5 .',
    'G5 . G5 . B5 . D6 - G6 - - - D6 . B5 .',
    'C6 . G5 . E5 . G5 . C6 - - - E6 - - -',
    'D6 - - - B5 - - - G5 - A5 - B5 - D6 -',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16, 0.55)));
  // the bridge is doubled by a flute an octave down
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.6).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 118, steps: prog.length * 16, notes };
}

// "Tomb of the Sun King": a D Phrygian-dominant desert march. A darbuka groove and a droning
// bass carry a snake-charmer reed melody; brass and a low flute join for the second half.
function pyramidSong(): Song {
  const notes: Note[] = [];
  const prog = ['D', 'D', 'Eb', 'D', 'D', 'Cm', 'Eb', 'D', 'Gm', 'Gm', 'D', 'D', 'Eb', 'Cm', 'Eb', 'D'];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const tones = chordTones(ch);
    const root = tones[0];
    const lo = 36 + root - (root > 7 ? 12 : 0);
    // the drone: a low D under everything, with the chord root bouncing on top
    notes.push({ step: s, inst: 'bass', n: 38, len: 6 });
    [[6, 0], [8, 12], [10, 0], [12, 7], [14, 0]].forEach(([st, iv]) => notes.push({ step: s + st, inst: 'bass', n: lo + iv, len: 1 }));
    tones.forEach((t) => notes.push({ step: s, inst: 'strings', n: 55 + ((t + 5) % 12), len: 16, vol: 0.022 }));
    // darbuka groove: doum on 1 and 3, teks between, finger cymbals on the off-beats
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'tom', n: 43, len: 1, vol: 0.9 }));
    [2, 6, 12].forEach((st) => notes.push({ step: s + st, inst: 'clack', n: 0, len: 1, vol: 0.55 }));
    [3, 7, 11, 15].forEach((st) => notes.push({ step: s + st, inst: 'hat', n: 0, len: 1 }));
    [0, 8].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    if (b % 4 === 3) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 8 === 0) {
      notes.push({ step: s, inst: 'timp', n: 38, len: 6 });
      notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.5 });
    }
    // second half: snare backbeat and brass swells
    if (b >= 8) {
      notes.push({ step: s + 12, inst: 'snare', n: 0, len: 1, vol: 0.7 });
      [0, 10].forEach((st) => tones.forEach((t) => notes.push({ step: s + st, inst: 'brass', n: 55 + ((t + 5) % 12), len: st ? 2 : 4, vol: 0.8 })));
    }
  });
  const lead = [
    // A: the charmer's call (bars 1-8)
    'D5 - - - Eb5 - F#5 - G5 - F#5 - Eb5 - D5 -',
    'A5 - - - G5 F#5 G5 - F#5 - Eb5 - D5 - - -',
    'Eb5 - G5 - Bb5 - - - A5 G5 A5 - G5 - Eb5 -',
    'F#5 - - - Eb5 - - - D5 - - - . . . .',
    'D6 - - - C6 - Bb5 - A5 - - - Bb5 A5 G5 F#5',
    'G5 - - - Eb5 - C5 - Eb5 - G5 - C6 - - -',
    'Bb5 - - - G5 - Eb5 - G5 - Bb5 - A5 - G5 -',
    'F#5 - G5 - F#5 - Eb5 - D5 - - - - - - -',
    // B: the procession (bars 9-16)
    'G5 - - - Bb5 - - - D6 - - - C6 Bb5 A5 G5',
    'A5 - Bb5 - A5 - G5 - F#5 - - - G5 - - -',
    'A5 - - - F#5 - - - D5 - Eb5 - F#5 - A5 -',
    'D6 - - - - - - - Eb6 - D6 - C6 - Bb5 -',
    'Bb5 - - - G5 - - - Eb5 - G5 - Bb5 - Eb6 -',
    'C6 - Bb5 - A5 - G5 - Eb5 - - - G5 - C6 -',
    'Bb5 - A5 - G5 - F#5 - Eb5 - F#5 - G5 - A5 -',
    'D6 - - - A5 - - - F#5 - Eb5 - D5 - - -',
  ];
  lead.forEach((l, i) => {
    if (l.trim().split(/\s+/).length !== 16) throw new Error(`pyramid bar ${i + 1} is not 16 steps`);
    notes.push(...line(l, 'reed', i * 16, 1.3));
  });
  // a low flute shadows the procession an octave down
  lead.slice(8).forEach((l, i) => line(l, 'flute', (i + 8) * 16, 0.5).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 104, steps: prog.length * 16, notes };
}

// "Flavortown": a hot-rod rockabilly boogie in A, two loud choruses round a 12-bar blues.
function flavortownSong(): Song {
  const notes: Note[] = [];
  const blues = ['A', 'A', 'A', 'A', 'D', 'D', 'A', 'A', 'E', 'D', 'A', 'E'];
  const prog = [...blues, ...blues];
  prog.forEach((ch, b) => {
    const s = b * 16;
    const root = chordTones(ch)[0];
    const low = 36 + root - (root > 7 ? 12 : 0);
    // boogie-woogie walking bass: root, third, fifth, sixth, flat seven and back down
    [0, 4, 7, 9, 10, 9, 7, 4].forEach((o, i) => notes.push({ step: s + i * 2, inst: 'bass', n: low + o, len: 2 }));
    // chunky power-fifth guitar stabs on the off-beats
    [2, 6, 10, 14].forEach((st) => [0, 7].forEach((o) => notes.push({ step: s + st, inst: 'pluck', n: 57 + ((root + 3) % 12) - 3 + o, len: 1, vol: 0.4 })));
    // horn section punches at the turnaround of each line
    if (b % 4 === 3) [12, 14].forEach((st) => chordTones(ch).forEach((t) => notes.push({ step: s + st, inst: 'synbrass', n: 60 + ((t + 3) % 12) - 3, len: 2, vol: 0.6 })));
    // a driving backbeat with a slapback snare
    [0, 8, 10].forEach((st) => notes.push({ step: s + st, inst: 'kick', n: 0, len: 1 }));
    [4, 12].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1 }));
    [5, 13].forEach((st) => notes.push({ step: s + st, inst: 'snare', n: 0, len: 1, vol: 0.3 }));
    for (let h = 0; h < 16; h += 2) notes.push({ step: s + h, inst: 'hat', n: 0, len: 1, vol: h % 4 ? 0.6 : 1 });
    if (b % 12 === 11) [12, 13, 14, 15].forEach((st, i) => notes.push({ step: s + st, inst: 'tom', n: 52 - i * 3, len: 1, vol: 0.7 }));
    if (b % 12 === 0) notes.push({ step: s, inst: 'crash', n: 0, len: 1, vol: 0.7 });
  });
  const lead = [
    // chorus one: the swaggering riff
    'A4 . C5 . A4 . E5 - - . D5 . C5 . A4 .',
    'C5 - D5 . E5 . G5 - - . E5 . D5 . C5 .',
    'A4 . C5 . A4 . E5 - - . D5 . C5 . A4 .',
    'E5 . G5 . A5 - - - G5 . E5 . D5 . C5 .',
    'D5 . F#5 . A5 - - . F#5 . D5 . C5 . A4 .',
    'D5 . F#5 . A5 . C6 - - . A5 . F#5 . D5 .',
    'E5 - - - C5 . A4 . C5 . E5 . A5 - - -',
    'G5 . E5 . D5 . C5 . A4 - - - . . . .',
    'B4 . E5 . G#5 - - . B5 - - . G#5 . E5 .',
    'A5 - - . F#5 . D5 . A4 - - . D5 . F#5 .',
    'E5 . C#5 . A4 . C#5 . E5 . A5 - - . E5 .',
    'G#5 - - - B5 - - - E6 - - - . . . .',
    // chorus two: up an octave and twice as greasy
    'A5 . A5 . C6 . A5 . E6 - - - D6 C6 A5 .',
    'G5 . A5 . C6 . D6 . Eb6 E6 - - D6 . C6 .',
    'A5 . A5 . C6 . A5 . E6 - - - D6 C6 A5 .',
    'C6 D6 C6 A5 G5 A5 G5 E5 D5 E5 D5 C5 A4 - - -',
    'D6 - - . A5 . F#5 . A5 . D6 . F#6 - - .',
    'E6 - D6 . C6 . A5 . F#5 . A5 . D6 - - -',
    'A5 - - . E5 . A5 . C#6 - - . E6 - - .',
    'D6 . C#6 . A5 . E5 . A5 - - - . . . .',
    'B5 - G#5 . E5 . G#5 . B5 . E6 - - . D6 .',
    'C6 - A5 . F#5 . A5 . D6 - - . C6 . A5 .',
    'A5 C6 A5 E5 A5 C6 E6 - - - D6 - C6 - A5 -',
    'E5 - G#5 - B5 - E6 - - - - - . . . .',
  ];
  lead.forEach((l, i) => notes.push(...line(l, 'lead', i * 16, 0.55)));
  // the second chorus is doubled an octave down on brass for extra heat
  lead.slice(12).forEach((l, i) => line(l, 'synbrass', (i + 12) * 16, 0.35).forEach((n) => notes.push({ ...n, n: n.n - 12 })));
  return { bpm: 160, steps: prog.length * 16, notes };
}

export const SONGS = { fight: fightSong(), train: trainSong(), title: titleSong(), victory: victorySong(), spire: spireSong(), mushroom: mushroomSong(), boat: boatSong(), moon: moonSong(), blizzard: blizzardSong(), underground: undergroundSong(), burger: burgerSong(), pyramid: pyramidSong(), flavortown: flavortownSong() };
export type SongName = keyof typeof SONGS;

function play(inst: Inst, n: number, at: number, dur: number, vol = 1) {
  const out = musicOut();
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
