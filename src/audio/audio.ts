// Everything audible is synthesised with the Web Audio API: no samples.
let ctx: AudioContext | null = null;
let master: GainNode, sfxBus: GainNode, musicBus: GainNode;
let noiseBuf: AudioBuffer;
let comp: DynamicsCompressorNode;

export function audioReady() {
  return !!ctx && ctx.state === 'running';
}

/** Must be called from a user gesture (key press or click). */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = 0.8;
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.55;
  sfxBus.connect(comp);
  musicBus.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function ac() {
  return ctx;
}
export function musicOut() {
  return musicBus;
}
export function setMusicVolume(v: number) {
  if (musicBus) musicBus.gain.value = v;
}

export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  to?: number;
  dur: number;
  vol?: number;
  attack?: number;
  at?: number;
  out?: AudioNode;
  filter?: { type: BiquadFilterType; freq: number; to?: number; q?: number };
  detune?: number;
}

export function tone(o: ToneOpts) {
  if (!ctx) return;
  const t = o.at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  const vol = o.vol ?? 0.2, att = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, t);
    if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t + o.dur);
    f.Q.value = o.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(o.out ?? sfxBus);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  type?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
  at?: number;
  attack?: number;
  out?: AudioNode;
}
export function noise(o: NoiseOpts) {
  if (!ctx) return;
  const t = o.at ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 2000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol ?? 0.3, t + (o.attack ?? 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(o.out ?? sfxBus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.dur + 0.05);
}

/** A sliding vowel through formant filters: grunts, screams and a crude announcer growl. */
export function voice(f0: number, f1: number, dur: number, vol = 0.25, formants = [700, 1150, 2500]) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const vib = ctx.createOscillator();
  vib.frequency.value = 7;
  const vg = ctx.createGain();
  vg.gain.value = f0 * 0.04;
  vib.connect(vg);
  vg.connect(osc.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.03);
  g.gain.setValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [i, fr] of formants.entries()) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fr;
    bp.Q.value = 6;
    const fg = ctx.createGain();
    fg.gain.value = [1, 0.6, 0.25][i] ?? 0.2;
    osc.connect(bp);
    bp.connect(fg);
    fg.connect(g);
  }
  g.connect(sfxBus);
  osc.start(t);
  vib.start(t);
  osc.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}
