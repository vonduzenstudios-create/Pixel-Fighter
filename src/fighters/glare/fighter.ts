import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, HIT_HIGH, LAUNCHED } from '../../game/anims';
import type { CharDef, Fighter } from '../../game/fighter';
import type { Fight } from '../../game/fight';
import type { Move, Special } from '../../game/types';
import { Projectile } from '../../game/projectile';
import type { PortraitStyle } from '../../gfx/portrait';
import { lighten } from '../../gfx/palette';
import { ac, noise, tone, voice } from '../../audio/audio';
import { say, sfx } from '../../audio/sfx';
import { rand } from '../../core/rng';
import { lerp, offscreenX, type Intro } from '../../game/intro';

// Hugh Steel: an original parody of the vain male supermodel. Frosted swoop of hair, cheekbones
// you could slice bread on, a lilac velvet blazer. He fights with poses, the runway and the cameras
// that follow him everywhere. Name, look, moves and lines are all original.

export const GLARE_LOOK: Look = {
  skin: '#e8b890', hair: '#f0dc90', eye: '#3a8ac8', shirt: '#1c1a24', coat: '#9a64c0', coatTrim: '#f0e0ff',
  pants: '#f2eef4', boots: '#3a2a44', hairStyle: 'swoop', belt: '#e8e4ec', buckle: '#d8c060',
};
/** Palette swap for mirror matches: dark-haired, black leather and a hot pink shirt. */
export const GLARE_ALT: Look = {
  ...GLARE_LOOK, hair: '#3a2418', coat: '#1c1a20', coatTrim: '#c8c8d0', shirt: '#d02870', pants: '#24222a', boots: '#e8e4ec',
  belt: '#1c1a20',
};

export const GLARE_LINES = {
  intro: 'Try not to stare. Actually, go ahead.',
  finisher: 'Hold still. Perfect. You are done.',
};
const VOICE = { pitch: 1.0, rate: 0.95 };

const FLASH = '#ffffff';
const GLOW = '#ff8ad8';

// ------------------------------------------------------------------ sounds
const now = () => ac()?.currentTime ?? 0;
export const gsfx = {
  /** Camera shutter: two dry clicks and the whine of a flash recharging. */
  shutter() {
    const t = now();
    noise({ dur: 0.015, vol: 0.28, type: 'highpass', freq: 3500 });
    noise({ dur: 0.02, vol: 0.2, type: 'bandpass', freq: 2200, q: 3, at: t + 0.05 });
    tone({ type: 'sine', freq: 1800, to: 7000, dur: 0.25, vol: 0.025, at: t + 0.06 });
  },
  /** Flashbulb going off: a bright pop over a quick downward zap. */
  flashPop() {
    noise({ dur: 0.07, vol: 0.3, type: 'bandpass', freq: 5000, q: 1.2 });
    tone({ type: 'square', freq: 1400, to: 200, dur: 0.07, vol: 0.06 });
  },
  /** Runway four-on-the-floor: kick drum with a closed hi-hat. */
  strutBeat() {
    tone({ type: 'sine', freq: 120, to: 42, dur: 0.14, vol: 0.32 });
    noise({ dur: 0.03, vol: 0.1, type: 'highpass', freq: 8000, at: now() + 0.1 });
  },
  /** A low, pleased "mmm". */
  mmm() {
    voice(150, 135, 0.35, 0.18, [450, 900, 2400]);
  },
  /** Smoulder charging up: a breathy rise with a glassy shimmer. */
  smolder() {
    noise({ dur: 0.25, vol: 0.06, type: 'bandpass', freq: 700, to: 1800, q: 2, attack: 0.15 });
    tone({ type: 'sine', freq: 520, to: 1560, dur: 0.28, vol: 0.06, attack: 0.18 });
    tone({ type: 'triangle', freq: 1040, to: 3120, dur: 0.28, vol: 0.03, attack: 0.18, detune: 9 });
  },
  /** The beam leaving his eyes. */
  beam() {
    tone({ type: 'sawtooth', freq: 1900, to: 900, dur: 0.18, vol: 0.06, filter: { type: 'lowpass', freq: 4000 } });
    sfx.sparkle();
  },
  /** Hair flip: a silky swish and a glint. */
  hairFlip() {
    noise({ dur: 0.18, vol: 0.14, type: 'bandpass', freq: 1200, to: 3800, q: 1.5 });
    sfx.twinkle();
  },
  /** Leather heel turning on the catwalk. */
  heelSqueak() {
    tone({ type: 'sine', freq: 1700, to: 2500, dur: 0.06, vol: 0.05 });
  },
};

// ------------------------------------------------------------------ poses (facing right)
/** One hand on the hip, the other raking through the hair. */
const HIP_POSE = P(STANCE, { t: -6, h: -10, af: -170, ef: -70, ab: 25, eb: -125, lf: -16, kf: 4, ff: 10, lb: 14, kb: 10 });
/** Chin down, eyes up, knuckle under the jaw: the smoulder. */
const SMOLDER = P(STANCE, { t: 4, h: 16, af: -55, ef: -115, ab: 25, eb: -125, lf: -12, kf: 6, lb: 14, kb: 8 });
/** Hands framing the face like a camera. */
const FRAME = P(STANCE, { t: -2, h: -6, af: -125, ef: -85, ab: -115, eb: -95, lf: -14, kf: 4, lb: 16, kb: 8 });
/** Looking back over the shoulder, one arm thrown up. */
const OVER_SHOULDER = P(STANCE, { t: -10, h: -24, af: 20, ef: -30, ab: -165, eb: -35, lf: 6, kf: 10, lb: -10, kb: 14 });
/** Lunge and point straight down the lens. */
const POINT = P(STANCE, { t: 12, h: -6, af: -95, ef: -4, ab: 30, eb: -120, lf: -42, kf: 42, lb: 30, kb: 8 });

// Runway strut: crossover steps, chest up, hips swinging, back hand parked on the hip.
const STRUT = [
  P(STANCE, { t: -4, h: -8, rx: 1, lf: -26, kf: 6, ff: 0, lb: 22, kb: 30, fb: 32, af: 14, ef: -20, ab: 25, eb: -125 }),
  P(STANCE, { t: -2, h: -8, rx: 0, lf: 2, kf: 32, ff: 28, lb: -4, kb: 4, fb: 0, af: 0, ef: -18, ab: 25, eb: -125 }),
  P(STANCE, { t: -4, h: -8, rx: -1, lb: -26, kb: 6, fb: 0, lf: 22, kf: 30, ff: 32, af: -14, ef: -16, ab: 25, eb: -125 }),
  P(STANCE, { t: -2, h: -8, rx: 0, lb: 2, kb: 32, fb: 28, lf: -4, kf: 4, ff: 0, af: 0, ef: -18, ab: 25, eb: -125 }),
];
const strutPose = (t: number, step = 7) => STRUT[Math.floor(t / step) % 4];
/** Mid-pivot at the end of the runway, then the spinning heel. */
const PIVOT = P(STANCE, { t: -4, h: -10, af: -95, ef: -10, ab: -80, eb: -10, lf: -2, kf: 2, ff: 40, lb: -60, kb: 110 });
const HEEL = P(STANCE, { lf: -145, kf: -4, ff: -40, t: -34, h: 12, af: -10, ef: -50, ab: 40, eb: -40, lb: 6, kb: 0 });

// ------------------------------------------------------------------ specials
const smolderBeam: Move = {
  id: 'proj_smolder',
  anim: A([
    [P(SMOLDER, { h: 4 }), 6],
    [SMOLDER, 12],
    [P(SMOLDER, { h: 22, t: 8 }), 10],
    [STANCE, 6],
  ]),
  sounds: { frames: { 1: gsfx.smolder } },
  onFrame: (self, f, fr) => {
    if (fr > 4 && fr < 18 && fr % 3 === 0) {
      const ex = self.wx(self.skel.neck[0] + 6), ey = self.wy(self.skel.neck[1] - 10);
      f.particles.sparks(ex, ey, 1, fr % 2 ? GLOW : FLASH);
    }
    if (fr === 18) {
      f.projectiles.push(new Projectile(self, 'smolder', self.x + self.facing * 18, 66));
      self.projOut = true;
      gsfx.beam();
    }
  },
};

const runwayStrut: Move = {
  id: 'runway',
  anim: A([
    [P(STANCE, { t: -2, h: -6 }), 3],
    [STRUT[0], 6], [STRUT[1], 6], [STRUT[2], 6], [STRUT[3], 6],
    // end of the runway: pivot, then the spinning heel
    [PIVOT, 4],
    [HEEL, 9],
    [STANCE, 10],
  ]),
  active: [31, 39],
  vx: (fr) => (fr >= 3 && fr < 27 ? 2.9 : 0),
  hit: { limb: 'toeF', r: 8, dmg: 95, level: 'high', effect: 'knockdown', push: 2.6, stun: 22, special: true },
  whoosh: true,
  sounds: { frames: { 3: gsfx.strutBeat, 9: gsfx.strutBeat, 15: gsfx.strutBeat, 21: gsfx.strutBeat, 27: gsfx.heelSqueak }, impact: ['glovePop', 'boneCrack'] },
  onFrame: (self, f, fr) => {
    if (fr === 27) self.facing = -self.facing as 1 | -1;
    if (fr === 31) self.facing = self.moveDir as 1 | -1;
    // a camera flash greets every step
    if (fr >= 3 && fr < 27 && fr % 6 === 3) {
      f.particles.flash(self.x + rand(-30, 30), rand(80, 110), 3, FLASH);
      gsfx.shutter();
    }
  },
};

/** A rapid string of poses; every pose sets off a wall of camera flashes that blind and burn at close range. */
const flashbulbFrenzy: Move = {
  id: 'frenzy',
  anim: A([
    [P(STANCE, { t: -2 }), 3],
    [HIP_POSE, 6], [FRAME, 6], [POINT, 6], [OVER_SHOULDER, 6], [SMOLDER, 6], [POINT, 6],
    [STANCE, 10],
  ]),
  active: [4, 39],
  vx: (fr) => (fr >= 3 && fr < 39 ? 0.9 : 0),
  hit: { limb: 'body', r: 22, dmg: 22, level: 'mid', effect: 'light', push: 1.3, stun: 14, rehit: 6, special: true },
  sounds: { frames: { 1: gsfx.mmm }, impact: 'sparkle' },
  onFrame: (self, f, fr) => {
    if (fr >= 3 && fr < 39 && fr % 6 === 3) {
      gsfx.flashPop();
      gsfx.shutter();
      const x = self.x + self.facing * rand(14, 34);
      f.particles.flash(x, rand(30, 80), 6, FLASH);
      f.particles.sparks(x, rand(30, 80), 4, fr % 12 === 3 ? GLOW : FLASH);
    }
  },
};

const specials: Special[] = [
  { name: 'Smoulder Beam', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: smolderBeam },
  { name: 'Runway Strut', cmd: [4, 6], btn: 'k', text: 'B, F + K', move: runwayStrut },
  { name: 'Flashbulb Frenzy', cmd: [6, 4], btn: 'lp', mash: 'lp', text: 'MASH LP', move: flashbulbFrenzy },
];

/** Smoulder beam sprite: a pink streak with a four-point star glint riding the front. */
export function drawSmolder(ctx: CanvasRenderingContext2D, t: number, dir: number) {
  const len = 18;
  ctx.fillStyle = '#a03888';
  ctx.fillRect(dir > 0 ? -len : 0, -2, len, 4);
  ctx.fillStyle = GLOW;
  ctx.fillRect(dir > 0 ? -len + 3 : 0, -1, len - 3, 2);
  ctx.fillStyle = FLASH;
  ctx.fillRect(dir > 0 ? -8 : 0, 0, 8, 1);
  const s = 3 + (t % 6 < 3 ? 1 : 0);
  ctx.fillRect(-s, 0, s * 2 + 1, 1);
  ctx.fillRect(0, -s, 1, s * 2 + 1);
  ctx.fillRect(-1, -1, 3, 3);
}

// ------------------------------------------------------------------ finisher
/**
 * Overexposed: he strikes pose after pose while the paparazzi close in. The flashes come faster and
 * brighter until one last bulb burns the victim down to an X-ray, and the skeleton crumbles to white ash.
 */
function overexposed(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const ps = fight.particles;
  if (tt === 0) D.dir = w.facing;
  if (tt < 20) {
    w.x += (l.x - D.dir * 56 - w.x) * 0.15;
    w.poseOverride = strutPose(tt, 5);
    if (tt % 10 === 0) gsfx.strutBeat();
  } else if (tt < 160) {
    const poses = [HIP_POSE, FRAME, OVER_SHOULDER, SMOLDER, POINT];
    w.poseOverride = poses[Math.floor((tt - 20) / 16) % poses.length];
  }
  if (tt === 20) gsfx.mmm();
  if (tt >= 30 && tt < 150) {
    // the flashes speed up as he gets into it
    const every = tt < 70 ? 12 : tt < 110 ? 7 : 4;
    const k = (tt - 30) / 120;
    if (tt % every === 0) {
      gsfx.flashPop();
      if (tt % (every * 2) === 0) gsfx.shutter();
      const x = l.x + rand(-28, 28), y = rand(20, 100);
      ps.flash(x, y, 4 + k * 6, FLASH);
      ps.sparks(l.x + rand(-10, 10), rand(30, 80), 2, FLASH);
    }
    l.tint = ['#ffffff', k * 0.75];
    l.shake = 1 + Math.round(k * 3);
    // shielding the eyes, flinching from each pop
    l.poseOverride = tt % 8 < 4 ? P(HIT_HIGH, { af: -150, ef: -100, ab: -140, eb: -90 }) : P(HIT_HIGH, { t: -30, af: -160, ef: -80, ab: -150, eb: -80 });
    if (tt === 80) sfx.scream();
    if (tt > 100 && tt % 3 === 0) ps.smoke(l.x + rand(-8, 8), rand(20, 80), 1, '#f0e8f0');
  }
  if (tt === 150) {
    // one last, impossible flash
    w.poseOverride = P(SMOLDER, { h: 24 });
    gsfx.flashPop();
    gsfx.beam();
    sfx.explode();
    fight.shake(14);
    for (let i = 0; i < 6; i++) ps.flash(l.x + rand(-20, 20), rand(20, 90), 12, FLASH);
    ps.sparks(l.x, 60, 30, GLOW);
    l.showBones = true;
    l.tint = null;
    l.shake = 0;
    l.poseOverride = P(LAUNCHED, { t: -6, h: -10, rot: 0, af: -170, ab: -150, lf: -10, kf: 15, lb: 10, kb: 10 });
  }
  if (tt > 150 && tt < 180 && tt % 4 === 0) ps.smoke(l.x + rand(-10, 10), rand(10, 90), 2, '#e8e4f0');
  if (tt === 180) {
    fight.collapse(l, true, '#ece8f2');
    l.showBones = false;
  }
  if (tt >= 190) {
    // the hair flip, then the money pose
    w.poseOverride = tt < 206 ? P(STANCE, { t: -8, h: tt < 198 ? 26 : -30, af: -170, ef: -40, ab: 25, eb: -125 }) : HIP_POSE;
    if (tt === 192) gsfx.hairFlip();
    if (tt === 198) ps.sparks(w.wx(w.skel.headTop[0]), w.wy(w.skel.headTop[1]), 10, '#fff2a0');
    if (tt === 210) say(GLARE_LINES.finisher, VOICE);
  }
  return tt >= 300;
}

// ------------------------------------------------------------------ round-one entrance
const entry = new WeakMap<Fighter, number>();

/** Struts in down an imaginary runway to a beat and camera flashes, flips the hair and hits the pose. */
export const GLARE_INTRO: Intro = {
  line: GLARE_LINES.intro,
  speech: VOICE,
  speakAt: 86,
  dur: 150,
  update(self, f, t, home) {
    if (t === 0 || !entry.has(self)) entry.set(self, offscreenX(self, f));
    const x0 = entry.get(self)!;
    if (t <= 56) {
      self.x = lerp(x0, home, t / 56);
      self.poseOverride = strutPose(t);
      if (t % 14 === 0) gsfx.strutBeat();
      if (t % 10 === 5) {
        f.particles.flash(self.x + rand(-40, 40), rand(90, 120), 3, FLASH);
        gsfx.shutter();
      }
    } else if (t < 64) {
      self.poseOverride = P(STANCE, { t: -6, h: 26, af: -170, ef: -40, ab: 25, eb: -125 });
    } else if (t < 72) {
      self.poseOverride = P(STANCE, { t: -10, h: -30, af: -175, ef: -30, ab: 25, eb: -125 });
      if (t === 64) {
        gsfx.hairFlip();
        f.particles.sparks(self.wx(self.skel.headTop[0]), self.wy(self.skel.headTop[1]), 8, '#fff2a0');
      }
    } else {
      self.poseOverride = t < 100 ? HIP_POSE : t < 132 ? SMOLDER : null;
      if (t === 100) gsfx.mmm();
      if (t === 104) {
        // the glint off the cheekbone
        f.particles.sparks(self.wx(self.skel.neck[0] + 6), self.wy(self.skel.neck[1] - 8), 6, FLASH);
        sfx.sparkle();
      }
    }
  },
};

// ------------------------------------------------------------------ post-match portrait
/** The tall frosted swoop, razor cheekbones and a pout (the loser gets a split lip instead). */
export const GLARE_PORTRAIT: PortraitStyle = {
  front(p, c) {
    const L = c.look;
    c.sculpt((m) => {
      m.poly([[26, 30], [34, 10], [50, 0], [70, 2], [82, 14], [78, 26], [66, 22], [52, 26], [40, 34], [30, 40]], '#fff');
    }, L.hair, { soft: 3 });
    const hi = lighten(L.hair, 0.4);
    for (let i = 0; i < 4; i++) p.line(36 + i * 8, 20 - i * 3, 52 + i * 7, 6 + i * 2, hi);
    // cheekbone highlight and hollow
    p.line(58, 56, 66, 54, lighten(L.skin, 0.3));
    p.line(56, 62, 64, 66, '#b07858');
    // pout
    p.line(62, 72, 68, 72, c.beaten ? '#7a2020' : '#c06070');
    p.line(63, 73, 67, 73, c.beaten ? '#c02020' : '#e08a90');
    if (!c.beaten) p.set(70, 52, '#ffffff');
  },
};

export function glare(): CharDef {
  return {
    id: 'glare', name: 'Hugh Steel', short: 'STEEL', title: 'The Face', look: GLARE_LOOK, alt: GLARE_ALT,
    specials, voice: 150, props: {},
    finisher: { name: 'Overexposed', cmd: [6, 4, 6], btn: 'hk', text: 'F, B, F + HK (close)', range: [0, 90] },
    fatality: overexposed, intro: GLARE_INTRO, portrait: GLARE_PORTRAIT,
  };
}
