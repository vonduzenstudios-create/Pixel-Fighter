import type { Look } from './build';
import { A, P, STANCE, CROUCH, BLOCK, HIT_HIGH, DIZZY, LAUNCHED } from '../game/anims';
import type { CharDef, Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import type { Move, Special } from '../game/types';
import { sfx } from '../audio/sfx';
import { rand } from '../core/rng';

// ------------------------------------------------------------------ Muhammad Ali
// A boxer: every special is a punch, and he fights with footwork instead of projectiles.

const ALI_LOOK: Look = {
  skin: '#8a5434', hair: '#141012', eye: '#1a1010', shirt: '#8a5434', pants: '#8a5434', boots: '#ece8e0',
  hairStyle: 'short', bareChest: true, trunks: { color: '#f0eee8', stripe: '#141218' }, boxingGloves: '#c01818',
};
const ALI_ALT: Look = { ...ALI_LOOK, trunks: { color: '#b01820', stripe: '#f0eee8' }, boxingGloves: '#f0eee8', boots: '#b01820' };

// punch poses (facing right)
const JAB_F = P(STANCE, { af: -88, ef: -4, ab: -40, eb: -115, t: 16, h: -6 });
const CROSS_B = P(STANCE, { af: -50, ef: -115, ab: -86, eb: -6, t: 22, h: -8, lf: -30, kf: 30 });
const HOOK_F = P(STANCE, { af: -100, ef: -70, ab: -45, eb: -115, t: 18, h: -4, rx: 2 });
const GUARD = P(STANCE, { af: -70, ef: -100, ab: -55, eb: -115, t: 12, h: -6 });
const UPPER = P(STANCE, { t: -10, h: -16, af: -176, ef: -16, ab: 10, eb: -60, lf: -14, kf: 14, lb: 18, kb: 8 });

const ROPE_COUNTER: Move = {
  id: 'ropecounter',
  anim: A([
    [P(STANCE, { t: -10, ab: -60, eb: -120, af: -40, ef: -120 }), 3],
    [P(STANCE, { t: 30, h: -10, af: -92, ef: -2, ab: 10, eb: -60, lf: -45, kf: 45, lb: 30, kb: 6 }), 8],
    [P(STANCE, { t: 28, h: -8, af: -90, ef: -6, ab: 10, eb: -60, lf: -45, kf: 45, lb: 30, kb: 6 }), 6],
    [STANCE, 8],
  ]),
  active: [3, 14],
  vx: (fr) => (fr < 10 ? 3.2 : 0),
  hit: { limb: 'handF', r: 7, dmg: 110, level: 'mid', effect: 'knockdown', push: 3, stun: 24, special: true, sfx: 'heavy' },
  whoosh: true,
  onFrame: (self, f, fr) => {
    if (fr === 0) f.particles.sparks(self.x, 60, 10, '#ffffff');
  },
};

const aliSpecials: Special[] = [
  {
    name: 'Shuffle Flurry', cmd: [2, 3, 6], btn: 'p', mash: 'lp', text: 'MASH LP',
    move: {
      id: 'flurry',
      anim: A([
        [P(STANCE, { af: -70, ef: -70, t: 6 }), 4],
        ...[0, 1, 2, 3].flatMap((i): [typeof STANCE, number][] => [
          [P(JAB_F, { lf: i % 2 ? -10 : -30, lb: i % 2 ? 30 : 10 }), 3],
          [P(CROSS_B, { lf: i % 2 ? -30 : -10, lb: i % 2 ? 10 : 30 }), 3],
        ]),
        [GUARD, 10],
      ]),
      active: [4, 28],
      vx: (fr) => (fr >= 4 && fr < 28 ? 1.8 : 0),
      hit: { limb: 'handF', r: 7, dmg: 24, level: 'high', effect: 'light', push: 1.2, stun: 14, rehit: 6, special: true },
      onFrame: (self, f, fr) => {
        if (fr >= 4 && fr < 28 && fr % 6 === 4) f.sfx('whoosh');
      },
    },
  },
  {
    name: 'Rope-a-Dope', cmd: [2, 1, 4], btn: 'p', text: 'D, DB, B + P (counter)',
    move: {
      id: 'ropeadope',
      anim: A([
        [P(BLOCK, { t: -18, h: 4 }), 4],
        [P(BLOCK, { t: -26, h: 8, lf: -10, kf: 20 }), 20],
        [P(BLOCK, { t: -22, h: 6 }), 20],
        [STANCE, 8],
      ]),
      counter: { from: 3, to: 44, move: ROPE_COUNTER },
    },
  },
  {
    name: 'Lightning Cross', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP',
    move: {
      id: 'lightningcross',
      anim: A([
        [P(STANCE, { af: -40, ef: -120, t: 0 }), 2],
        [P(STANCE, { af: -94, ef: -2, ab: 20, eb: -60, t: 28, h: -12, lf: -50, kf: 50, lb: 40, kb: 10 }), 10],
        [P(STANCE, { af: -90, ef: -6, ab: 20, eb: -60, t: 24, h: -10, lf: -50, kf: 50, lb: 40, kb: 10 }), 6],
        [STANCE, 10],
      ]),
      active: [2, 12],
      vx: (fr) => (fr >= 1 && fr < 10 ? 5.2 : 0),
      hit: { limb: 'handF', r: 7, dmg: 95, level: 'high', effect: 'knockdown', push: 3, stun: 22, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 1) f.sfx('whoosh', 1);
        if (fr >= 1 && fr < 10) f.particles.sparks(self.x - self.facing * 8, rand(30, 70), 2, '#ffffff');
      },
    },
  },
];

/** Final Bell: a rapid combination, then an uppercut that sends the loser off the top of the screen. */
function finalBell(fight: Fight, w: Fighter, l: Fighter, tt: number, D: any): boolean {
  const face = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) + 10 });
  if (tt === 0) sfx.bell();
  if (tt < 20) {
    w.x += (l.x - w.facing * 28 - w.x) * 0.2;
    w.poseOverride = GUARD;
  } else if (tt < 116) {
    const k = Math.floor((tt - 20) / 6), ph = (tt - 20) % 6;
    w.poseOverride = ph < 3 ? [JAB_F, CROSS_B, HOOK_F, CROSS_B][k % 4] : GUARD;
    if (ph === 1) {
      const p = face();
      l.poseOverride = k % 2 ? HIT_HIGH : P(HIT_HIGH, { t: -32, h: 20, rx: -1 });
      l.shake = 4;
      l.x += w.facing * 0.6;
      fight.particles.blood(p.x, p.y, w.facing, 10 + k, 1.2);
      fight.particles.sparks(p.x, p.y, 3, '#ffffff');
      sfx.hit(k % 4 === 2);
      if (k % 4 === 2) fight.shake(3);
      if (k === 6) sfx.scream();
    }
  } else if (tt < 126) {
    w.poseOverride = P(CROUCH, { af: 40, ef: -110, t: 30 });
    l.poseOverride = DIZZY;
  } else if (tt === 126) {
    w.poseOverride = UPPER;
    const p = face();
    D.vy = 11;
    l.y = 1;
    fight.particles.blood(p.x, p.y, w.facing, 60, 1.8);
    fight.shake(12);
    sfx.hit(true);
    sfx.scream();
  }
  if (tt >= 126 && D.boom == null) {
    l.y += D.vy;
    l.vy = 0; // the flight is scripted here, not by the fighter's own physics
    D.vy -= 0.22;
    l.poseOverride = P(LAUNCHED, { rot: -(tt - 126) * 14 });
    if (l.y <= 0) {
      l.y = 0;
      D.boom = tt;
      fight.explode(l);
      fight.shake(20);
      sfx.thud();
      sfx.blood();
    }
  }
  if (D.boom != null && tt === D.boom + 30) sfx.bell();
  return D.boom != null && tt >= D.boom + 100;
}

// TODO: hook these into the round intro and post-match screens once those land.
export const ALI_INTRO_LINES = ['Step into my ring!', "You can't hit what you can't catch!"];
export const ALI_TAUNTS = ['Too quick, too pretty. Next!', 'I danced. You fell down. Simple.'];

export function aliDef(): CharDef {
  return {
    id: 'ali', name: 'Muhammad Ali', short: 'ALI', title: 'The Dancing Champ', look: ALI_LOOK, alt: ALI_ALT,
    specials: aliSpecials, voice: 120, props: {},
    finisher: { name: 'Final Bell', cmd: [2, 4, 6], btn: 'hp', text: 'D, B, F + HP (close)', range: [0, 90] },
    fatality: finalBell,
    quotes: [...ALI_TAUNTS.map((t) => t.toUpperCase()), 'FLOAT LIKE A FEATHER, HIT LIKE A FREIGHT TRAIN. STAY DOWN, {L}.', 'I AM THE GREATEST. YOU ARE THE FLOOR.'],
    quotesVs: { chuck: 'NO BEARD IS FASTER THAN THESE HANDS.' },
  };
}
