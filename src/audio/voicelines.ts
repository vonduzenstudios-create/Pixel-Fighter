import { ac, voiceOut } from './audio';
import manifest from './voicelines.json';

// Pre-rendered voice lines (Kokoro TTS, see scripts/gen_voices.py). A line plays from its clip
// when one exists for that exact text; otherwise callers fall back to the browser speech synth.
const files = new Map<string, string>(manifest.lines.map((l) => [l.text, l.file]));
const buffers = new Map<string, AudioBuffer>();
let loading = false;
let current: AudioBufferSourceNode | null = null;

export function hasClip(text: string) {
  return files.has(text);
}

/** Fetch and decode every clip once audio is unlocked. They total a few hundred KB. */
export function loadVoiceLines() {
  const c = ac();
  if (!c || loading) return;
  loading = true;
  for (const [text, file] of files) {
    fetch(`${import.meta.env.BASE_URL}voices/${file}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((b) => c.decodeAudioData(b))
      .then((buf) => buffers.set(text, buf))
      .catch(() => {
        /* missing clip: that line stays on the speech synth */
      });
  }
}

/** Play a line's clip, stopping any line already playing. Returns false when it isn't loaded. */
export function playLine(text: string): boolean {
  const c = ac(), buf = buffers.get(text);
  if (!c || !buf) return false;
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
