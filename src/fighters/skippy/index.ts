import type { FighterModule } from '../kit';
import { SETS } from '../../scenes/sets';
import { skippy } from './fighter';
import { PROJECTILES } from './projectiles';
import { ac, noise, tone, voice } from '../../audio/audio';

/** A goose honk out of his nose: a nasal, bent-down buzz with a reedy edge. */
function honk(delay: number) {
  const t = (ac()?.currentTime ?? 0) + delay;
  tone({ type: 'sawtooth', freq: 520, to: 430, dur: 0.22, vol: 0.16, at: t, filter: { type: 'bandpass', freq: 1100, q: 4 } });
  tone({ type: 'square', freq: 262, to: 215, dur: 0.22, vol: 0.06, at: t, filter: { type: 'lowpass', freq: 1400 } });
  noise({ dur: 0.08, vol: 0.12, type: 'bandpass', freq: 700, q: 3, at: t });
}

export default {
  order: 170,
  make() {
    const c = skippy();
    c.selectSet ??= SETS.toyroom;
    return c;
  },
  fx: {
    /** Signature laugh: two quick rising "hee"s, then the honk. */
    heeHonk() {
      voice(760, 980, 0.08, 0.2, [400, 2300, 3100]);
      voice(820, 1060, 0.08, 0.2, [400, 2300, 3100], 0.11);
      honk(0.24);
    },
    honk() {
      honk(0);
    },
  },
  moveSounds: {
    proj_robot: { frames: { 2: 'windUp', 9: 'windUp' } },
    bikedash: { frames: { 2: 'bikeBell', 10: 'pedal', 18: 'pedal', 26: 'pedal' }, impact: 'bikeCrash', blocked: 'clang' },
    tantrum: { frames: { 1: 'wail', 10: 'tantrumStomp', 22: 'tantrumStomp', 34: 'tantrumStomp' }, impact: 'glovePop' },
  },
  projectiles: PROJECTILES,
} satisfies FighterModule;
