// Every spoken line in the game: src/audio/voicelines.json (announcer, default intro) plus each
// fighter's own src/fighters/<id>/voice.json. scripts/gen_voices.py merges the same files.

export interface Speaker {
  voice: string;
  speed?: number;
  pitch?: number;
  gain?: number;
  robot?: boolean;
}

export interface VoiceLine {
  /** Clip name: public/voices/<file>.mp3. */
  file: string;
  /** Speaker id. */
  who: string;
  /** Exact text the game shows and looks the clip up by. */
  text: string;
  /** What the TTS reads, when the subtitle text would read badly. */
  spoken?: string;
}

interface VoiceFile {
  speakers: Record<string, Speaker>;
  lines: VoiceLine[];
}

const files = import.meta.glob<VoiceFile>(['./voicelines.json', '../fighters/*/voice.json'], { eager: true, import: 'default' });

export const manifest: VoiceFile = { speakers: {}, lines: [] };
for (const f of Object.values(files)) {
  Object.assign(manifest.speakers, f.speakers);
  manifest.lines.push(...f.lines);
}
