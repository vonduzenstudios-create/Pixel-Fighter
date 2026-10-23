import { ac, voiceOut } from './audio';
import manifest from './voicelines.json';

// Pre-rendered voice lines (Kokoro TTS, see scripts/gen_voices.py). A line plays from its clip
// when one exists for that exact text; otherwise callers fall back to the browser speech synth.
const files = new Map<string, string>(manifest.lines.map((l) => [l.text, l.file]));
const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<ArrayBuffer>>();
const decoding = new Set<string>();
let current: AudioBufferSourceNode | null = null;

export function hasClip(text: string) {
  return files.has(text);
}

function fetchClip(text: string) {
  let p = pending.get(text);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}voices/${files.get(text)}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
    // a failed download is forgotten so the next call tries again
    p.catch(() => pending.delete(text));
    pending.set(text, p);
  }
  return p;
}

// Download the clips straight away (no gesture needed), so they are ready by the first fight.
for (const text of files.keys()) fetchClip(text).catch(() => {});

/**
 * Decode every clip once audio is unlocked; safe to call on every input, it only retries
 * the clips that are still missing. They total a few hundred KB.
 */
export function loadVoiceLines() {
  const c = ac();
  if (!c) return;
  for (const text of files.keys()) {
    if (buffers.has(text) || decoding.has(text)) continue;
    decoding.add(text);
    fetchClip(text)
      // callback form: older Safari's decodeAudioData returns no promise
      .then((b) => new Promise<AudioBuffer>((ok, fail) => c.decodeAudioData(b.slice(0), ok, fail)))
      .then((buf) => buffers.set(text, buf))
      .catch(() => {
        /* missing clip: that line stays on the speech synth until a later retry */
      })
      .finally(() => decoding.delete(text));
  }
}

/** Play a line's clip, stopping any line already playing. Returns false when it isn't loaded. */
export function playLine(text: string): boolean {
  const c = ac(), buf = buffers.get(text);
  if (!c || !buf) {
    loadVoiceLines();
    return false;
  }
  stopLine();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(voiceOut());
  src.onended = () => {
    if (current === src) current = null;
  };
  src.start();
  current = src;
  return true;
}

export function linePlaying() {
  return current !== null;
}

export function stopLine() {
  const s = current;
  current = null;
  try {
    s?.stop();
  } catch {
    /* already stopped */
  }
}
