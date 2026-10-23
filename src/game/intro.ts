import { W } from '../core/consts';
import type { SpeechOpts } from '../audio/sfx';
import * as AN from './anims';
import type { Fight } from './fight';
import type { Fighter } from './fighter';

// Round 1 entrances. Each character can supply an Intro on its CharDef; fighters without
// one use DEFAULT_INTRO. The fight runs player 1's entrance, then player 2's, then ROUND 1.
export interface Intro {
  /**
   * Voice line, shown as a subtitle and played from its Kokoro clip (src/audio/voicelines.json,
   * scripts/gen_voices.py) or the speech synth when it has none. Write original lines.
   */
  line: string;
  speech: SpeechOpts;
  /** Frame on which the line is spoken. */
  speakAt: number;
  /** Length in frames. The fight also waits for the line to finish (up to 4 s extra). */
  dur: number;
  /**
   * Called every frame from t = 0. Move the fighter (x, y), pose it (setAnim, poseOverride,
   * propOverride, alpha) and spawn effects. `home` is the x the fighter must end the intro at;
   * the fighter is snapped to home in its idle stance afterwards.
   */
  update(self: Fighter, fight: Fight, t: number, home: number): void;
  /** Optional extra drawing in screen space (ropes, portals...), behind the fighters. */
  draw?(ctx: CanvasRenderingContext2D, self: Fighter, fight: Fight, t: number, cam: number): void;
}

/** World x just past the fighter's own screen edge (the side away from the opponent). */
export function offscreenX(self: Fighter, fight: Fight) {
  return self.facing === 1 ? fight.camX - 24 : fight.camX + W + 24;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));
export const ease = (k: number) => {
  k = Math.max(0, Math.min(1, k));
  return k * k * (3 - 2 * k);
};

/** Walk from the screen edge to `home` over frames [0, frames). */
export function walkIn(self: Fighter, fight: Fight, t: number, home: number, frames: number) {
  if (t === 0) self.setAnim(AN.WALK);
  self.x = lerp(offscreenX(self, fight), home, t / frames);
  if (t === frames) self.setAnim(AN.IDLE);
}

export const DEFAULT_INTRO: Intro = {
  line: "Let's settle this.",
  speech: { pitch: 0.8, rate: 0.9 },
  speakAt: 60,
  dur: 120,
  update(self, fight, t, home) {
    if (t <= 50) walkIn(self, fight, t, home, 50);
    if (t === 54) self.setAnim(AN.VICTORY_ANIM);
  },
};
