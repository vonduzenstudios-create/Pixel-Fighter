import { Projectile } from '../../game/projectile';
import type { Look } from '../../chars/build';
import { A, P, STANCE, CROUCH, TUCK } from '../../game/anims';
import type { CharDef } from '../../game/fighter';
import type { Special } from '../../game/types';
import type { Pose } from '../../gfx/rig';
import { CHUCK_NORRIS_INTRO } from './intro';

// Original take on a historical figure. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

// ------------------------------------------------------------------ Chuck Norris (parody)
const CHUCK_LOOK: Look = {
  skin: '#e0a878', hair: '#8a4a24', eye: '#2a4a6a', shirt: '#e0a878', coat: '#4c6c9c', pants: '#34507e',
  boots: '#6a3c1c', tallBoots: true, hairStyle: 'feathered', beard: 'full', chestHair: '#6a3418',
  rolledSleeves: true, belt: '#141018', buckle: '#d8b040',
};
const chuckSpecials: Special[] = [
  {
    name: 'Roundhouse Gust', cmd: [2, 3, 6], btn: 'k', text: 'D, DF, F + K',
    move: {
      id: 'proj_gust',
      anim: A([
        [P(STANCE, { t: 25, lb: -30, kb: 90, af: -20, ab: -60 }), 7],
        [P(STANCE, { lb: -122, kb: -4, fb: -40, t: -36, h: 10, af: -10, ef: -40, ab: 10, lf: 6, kf: 4 }), 10],
        [P(STANCE, { lb: -60, kb: 40, t: -10 }), 8],
        [STANCE, 8],
      ]),
      onFrame: (self, f, fr) => {
        if (fr === 5) f.sfx('whoosh', 1);
        if (fr === 9) {
          f.projectiles.push(new Projectile(self, 'gust', self.x + self.facing * 26, 50));
          self.projOut = true;
        }
      },
    },
  },
  {
    name: 'Tornado Heel', cmd: [6, 2, 3], btn: 'hk', text: 'F, D, DF + HK',
    move: {
      id: 'tornado', air: true,
      anim: A([
        [P(CROUCH, { af: -40, ab: -60 }), 3],
        [P(STANCE, { lf: -140, kf: -6, ff: -30, t: -26, h: 10, lb: 20, kb: 40, af: -30, ef: -70, ab: 40 }), 18],
        [P(TUCK, {}), 30],
      ]),
      spin: 5,
      active: [3, 20],
      hit: { limb: 'toeF', r: 8, dmg: 105, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 2) {
          self.vy = 7.2;
          self.y = 1;
          self.vx = 1.4 * self.facing;
          f.sfx('whoosh', 1);
        }
        if (fr > 3 && fr < 20 && fr % 5 === 0) f.sfx('whoosh');
      },
    },
  },
  {
    name: 'Hundred Boot Flurry', cmd: [4, 5, 4], btn: 'lk', mash: 'lk', text: 'MASH LK',
    move: {
      id: 'flurry',
      anim: A([
        [P(STANCE, { lf: -60, kf: 75, t: -2 }), 4],
        ...[0, 1, 2, 3, 4, 5].map((i): [Pose, number] => [
          P(STANCE, { lf: i % 2 ? -110 : -80, kf: i % 2 ? 10 : 0, ff: -10, t: -16 - (i % 2) * 8, h: 6, af: -40, ef: -80, ab: 20, eb: -40 }), 5,
        ]),
        [P(STANCE, { lf: -40, kf: 60, t: -4 }), 6],
        [STANCE, 8],
      ]),
      active: [4, 34],
      vx: (fr) => (fr >= 4 && fr < 34 ? 0.9 : 0),
      hit: { limb: 'toeF', r: 7, dmg: 22, level: 'mid', effect: 'light', push: 0.8, stun: 14, rehit: 5, special: true },
      onFrame: (self, f, fr) => { if (fr >= 4 && fr < 34 && fr % 5 === 4) f.sfx('whoosh'); },
    },
  },
];
// TODO(intro + post-match hooks): wire these once the intro animation and post-match screen
// APIs land. Original lines written for this parody, not quotes from any film or show.
export const CHUCK_LINES = {
  intro: ['I came here to finish. Fighting is optional.', 'My feet will be doing the talking.'],
  win: ['Count to ten? I only needed one.', 'Next time, bring a bigger stunt double.', 'You blinked. That was your mistake.'],
};

export function chuckNorris(): CharDef {
  return {
    intro: CHUCK_NORRIS_INTRO,
    id: 'chuck', name: 'Chuck Norris', short: 'NORRIS', title: 'The Unblinking Beard', look: CHUCK_LOOK,
    alt: { ...CHUCK_LOOK, coat: '#2a2a2e', pants: '#1c1c22', boots: '#2a1a10', hair: '#c8b8a8', chestHair: '#a89888' },
    specials: chuckSpecials, voice: 100, props: {},
    quotes: [
      'I DID NOT WIN. YOU JUST RAN OUT OF FIGHT.',
      'MY BEARD HAS MORE WINS THAN YOUR WHOLE FAMILY.',
      'I COUNTED TO INFINITY TWICE. YOU DID NOT LAST THAT LONG, {L}.',
      'WHEN I KICK, THE GROUND FLINCHES.',
    ],
    quotesVs: { brucelee: 'GOOD FIGHT, OLD FRIEND. SAME RESULT AS LAST TIME.' },
    finisher: { name: 'Three-Count Heel Drop', cmd: [4, 6, 4], btn: 'hk', text: 'B, F, B + HK (close)', range: [0, 90] },
  };
}
