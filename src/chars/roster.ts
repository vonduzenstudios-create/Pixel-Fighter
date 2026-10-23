import { buildParts, Look } from './build';
import { JACKSON_ALT, JACKSON_FINISHER, JACKSON_INTRO, JACKSON_LOOK, JACKSON_SPECIALS } from './jackson';
import { aliDef } from './ali';
import { bobRoss } from './bobross';
import { oprah } from './oprah';
import { buster } from './buster';
import { irwin } from './irwin';
import { axe, cutlass, nunchaku, sword } from '../gfx/props';
import { lumpsum } from './lumpsum';
import { colonelCrisp } from './colonel';
import { blaine } from './blaine';
import { kingTut } from './kingtut';
import { guyFieri } from './fieri';
import { shaqDef } from './shaq';
import { A, P, STANCE, CROUCH, TUCK } from '../game/anims';
import type { CharDef } from '../game/fighter';
import type { Move, Special } from '../game/types';
import type { Pose } from '../gfx/rig';
import { Projectile, ProjKind } from '../game/projectile';
import type { Fighter } from '../game/fighter';
import type { Fight } from '../game/fight';
import { HAWKING_ALT, HAWKING_FINISHER, HAWKING_INTRO, HAWKING_LOOK, HAWKING_PORTRAIT, HAWKING_QUOTES, HAWKING_QUOTES_VS, hawkingSpecials } from './hawking';
import { BLACKBEARD_INTRO, INTROS, JOAN_INTRO, LINCOLN_INTRO, TESLA_INTRO } from './intros';

// Original takes on historical figures. Commands are relative to facing:
// 6 = toward the opponent, 4 = away, 2 = down, 3 = down-toward, 1 = down-away.

function throwProj(kind: ProjKind, at: number, height = 52, sound: string = 'whoosh'): Move {
  return {
    id: 'proj_' + kind,
    anim: A([
      [P(STANCE, { af: 50, ef: -70, ab: -40, t: -6, h: -6 }), at],
      [P(STANCE, { af: -94, ef: -2, ab: 25, eb: -20, t: 22, lf: -40, kf: 40, lb: 30, kb: 8 }), 10],
      [P(STANCE, { af: -90, ef: -10, t: 16 }), 12],
      [STANCE, 6],
    ]),
    onFrame: (self: Fighter, f: Fight, fr: number) => {
      if (fr === at + 2) {
        f.projectiles.push(new Projectile(self, kind, self.x + self.facing * 24, height));
        self.projOut = true;
        f.sfx(sound);
      }
    },
  };
}

// ------------------------------------------------------------------ Abe Lincoln
const LINCOLN_LOOK: Look = {
  skin: '#dea676', hair: '#19141a', eye: '#3a2a20', shirt: '#e8e4dc', coat: '#1e1c26', tails: true,
  pants: '#2c2a34', boots: '#141016', hat: 'stovepipe', hairStyle: 'short', beard: 'chinstrap', bowtie: '#0a080c',
};
const lincolnSpecials: Special[] = [
  { name: 'Stovepipe Boomerang', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('hat', 8, 58, 'hatSpin') },
  {
    name: 'Rail Splitter', cmd: [4, 5, 4], btn: 'hp', text: 'B, B + HP',
    move: {
      id: 'railsplit', prop: 'axe',
      anim: A([
        [P(STANCE, { af: -205, ef: -10, ab: -195, eb: -10, t: -16, h: -8 }), 9],
        [P(STANCE, { af: -78, ef: -4, ab: -70, eb: -6, t: 32, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 }), 5],
        [P(STANCE, { af: -60, ef: -4, ab: -55, eb: -6, t: 36, lf: -45, kf: 45, lb: 30, kb: 6 }), 14],
        [STANCE, 8],
      ]),
      active: [9, 15],
      vx: (fr) => (fr < 12 ? 1.6 : 0),
      hit: { limb: 'prop', r: 9, dmg: 115, level: 'overhead', effect: 'knockdown', push: 2, stun: 22, special: true, sfx: 'slash' },
      whoosh: true,
    },
  },
  {
    name: 'Log Roll', cmd: [4, 6], btn: 'lk', text: 'B, F + LK',
    move: {
      id: 'logroll',
      anim: A([
        [P(TUCK, { rot: 0 }), 4],
        [P(TUCK, { rot: 180 }), 6], [P(TUCK, { rot: 360 }), 6], [P(TUCK, { rot: 540 }), 6], [P(TUCK, { rot: 720 }), 6],
        [P(CROUCH, {}), 6], [STANCE, 6],
      ]),
      active: [4, 28],
      vx: (fr) => (fr >= 4 && fr < 28 ? 4.3 : 0),
      hit: { limb: 'body', r: 13, dmg: 90, level: 'mid', effect: 'knockdown', push: 2, stun: 20, special: true },
      onFrame: (self, f, fr) => { if (fr === 4) f.sfx('roll'); },
    },
  },
];

// ------------------------------------------------------------------ Nikola Tesla
const TESLA_LOOK: Look = {
  skin: '#e8b890', hair: '#141018', eye: '#2a2a3a', shirt: '#ecebf2', coat: '#28304a', pants: '#232838', boots: '#121218',
  hairStyle: 'slick', mustache: true, necktie: '#7a1a2a', coil: true, glove: '#d8d4cc',
};
const teslaSpecials: Special[] = [
  { name: 'Coil Bolt', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('bolt', 7, 54, 'zap') },
  {
    name: 'Wireless Step', cmd: [2, 1, 4], btn: 'k', text: 'D, DB, B + K',
    move: {
      id: 'teleport',
      anim: A([
        [P(CROUCH, { af: -150, ef: -20, ab: -140 }), 8],
        [P(CROUCH, {}), 14],
        [P(STANCE, { lf: -85, kf: 100, t: -10 }), 3],
        [P(STANCE, { lf: -132, kf: -4, ff: -40, t: -30, h: 12, af: -20, ef: -60, ab: 30 }), 9],
        [STANCE, 10],
      ]),
      invisible: [8, 22],
      active: [25, 33],
      hit: { limb: 'toeF', r: 7, dmg: 85, level: 'high', effect: 'knockdown', push: 2, stun: 20, special: true },
      onFrame: (self, f, fr) => {
        if (fr === 2) f.sfx('teleport');
        if (fr < 8) f.particles.zap(self.x, 30, 2);
        if (fr === 15) {
          const o = self.opp;
          const side = o.x >= self.x ? 1 : -1;
          self.x = Math.max(20, Math.min(492, o.x + side * 30));
          self.facing = o.x > self.x ? 1 : -1;
          f.sfx('teleport');
        }
        if (fr >= 18 && fr < 22) f.particles.zap(self.x, 30, 3);
      },
    },
  },
  {
    name: 'Alternating Field', cmd: [4, 5, 4], btn: 'lp', mash: 'lp', text: 'MASH LP',
    move: {
      id: 'acfield',
      anim: A([
        [P(STANCE, { af: -100, ef: -60, ab: -100, eb: -60, t: 4 }), 6],
        [P(STANCE, { af: -60, ef: -30, ab: -125, eb: -30, t: -10, h: -10 }), 15],
        [P(STANCE, { af: -55, ef: -35, ab: -120, eb: -35, t: -12, h: -6 }), 15],
        [STANCE, 10],
      ]),
      active: [6, 36],
      hit: { limb: 'body', r: 24, dmg: 32, level: 'mid', effect: 'light', push: 1.2, stun: 16, rehit: 9, special: true, sfx: 'zap' },
      onFrame: (self, f, fr) => {
        if (fr === 6) f.sfx('zap');
        if (fr >= 6 && fr < 36) f.particles.zap(self.x + self.facing * 4, 44, 4);
      },
    },
  },
];

// ------------------------------------------------------------------ Joan of Arc
const JOAN_LOOK: Look = {
  skin: '#f0c098', hair: '#5c3418', eye: '#2a4a8a', shirt: '#c0c4cc', pants: '#a8b0bc', boots: '#68707e',
  hairStyle: 'bob', glove: '#9aa2ae', armor: { metal: '#a8b0bc', tabard: '#2a3a8c', trim: '#e8c848' },
};
const joanSpecials: Special[] = [
  { name: 'Holy Flame', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('holy', 8, 52, 'fire') },
  {
    name: 'Banner Charge', cmd: [4, 6], btn: 'hk', text: 'B, F + HK',
    move: {
      id: 'charge', prop: 'sword',
      anim: A([
        [P(STANCE, { af: 30, ef: -100, t: -4 }), 6],
        [P(STANCE, { af: -88, ef: -2, ab: 20, t: 30, h: -10, lf: -50, kf: 50, lb: 40, kb: 10 }), 18],
        [P(STANCE, { af: -80, ef: -10, t: 16 }), 12],
      ]),
      active: [6, 24],
      vx: (fr) => (fr >= 6 && fr < 24 ? 4.8 : 0),
      hit: { limb: 'prop', r: 8, dmg: 100, level: 'mid', effect: 'knockdown', push: 2, stun: 20, special: true, sfx: 'slash' },
      whoosh: true,
    },
  },
  {
    name: 'Ascension Blade', cmd: [6, 2, 3], btn: 'hp', text: 'F, D, DF + HP',
    move: {
      id: 'ascend', prop: 'sword', air: true,
      anim: A([
        [P(CROUCH, { af: 30, ef: -60 }), 2],
        [P(STANCE, { af: -178, ef: -6, ab: 10, t: -8, h: -18, lf: -60, kf: 70, lb: 20, kb: 30 }), 16],
        [P(TUCK, { af: -150, ef: -30 }), 30],
      ]),
      active: [2, 16],
      hit: { limb: 'prop', r: 9, dmg: 110, level: 'mid', effect: 'launch', push: 1, stun: 26, special: true, sfx: 'slash' },
      onFrame: (self, f, fr) => {
        if (fr === 1) {
          self.vy = 7.6;
          self.y = 1;
          self.vx = 1.1 * self.facing;
          f.sfx('fire');
        }
        if (fr > 1 && fr < 16) f.particles.fire(self.x + self.facing * 8, self.y + 70, 2, 3);
      },
    },
  },
];

// ------------------------------------------------------------------ Blackbeard
const BEARD_LOOK: Look = {
  skin: '#c88858', hair: '#0e0c10', eye: '#1a1010', shirt: '#e0d8c8', coat: '#8c1a1c', coatTrim: '#d8b040',
  pants: '#3a2a20', boots: '#1a1210', tallBoots: true, hat: 'tricorn', hairStyle: 'long', beard: 'braided',
  beardRibbon: '#e02828', belt: '#3a2010', buckle: '#d8b040', bandolier: '#4a2a14',
};
const beardSpecials: Special[] = [
  { name: 'Cannon Volley', cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P', move: throwProj('cannon', 9, 50, 'cannon') },
  {
    name: 'Powder Keg', cmd: [2, 1, 4], btn: 'lk', text: 'D, DB, B + LK',
    move: {
      ...throwProj('keg', 9, 8, 'roll'),
      anim: A([
        [P(STANCE, { af: 40, ef: -40, t: 10 }), 9],
        [P(CROUCH, { af: -60, ef: -5, t: 40 }), 10],
        [P(CROUCH, {}), 10],
        [STANCE, 6],
      ]),
    },
  },
  {
    name: 'Cutlass Cyclone', cmd: [2, 5, 2], btn: 'hk', mash: 'hk', text: 'MASH HK',
    move: {
      id: 'cyclone', prop: 'cutlass',
      anim: A([
        [P(STANCE, { af: -90, ef: -10, ab: -90, eb: -10, t: 0 }), 4],
        [P(STANCE, { af: -88, ef: 0, ab: -92, eb: 0, t: -4, h: -10, lf: -10, kf: 15, lb: 10, kb: 10 }), 36],
        [STANCE, 10],
      ]),
      spin: 4,
      active: [4, 40],
      vx: (fr) => (fr >= 4 && fr < 40 ? 2.2 : 0),
      hit: { limb: 'prop', r: 10, dmg: 26, level: 'mid', effect: 'light', push: 1.5, stun: 14, rehit: 8, special: true, sfx: 'slash' },
      onFrame: (self, f, fr) => { if (fr % 8 === 4 && fr < 40) f.sfx('whoosh'); },
    },
  },
];

// ------------------------------------------------------------------ Bruce Lee
const LEE_LOOK: Look = {
  skin: '#e0b088', hair: '#100c10', eye: '#1a1010', shirt: '#e0b088', pants: '#16141c', boots: '#0c0a0e',
  hairStyle: 'mop', bareChest: true, sash: '#c8a030', wraps: '#e8e0d0',
};
// Nunchaku spin: the arm circles overhead while the free stick whips round the fist.
const spinKeys: [ReturnType<typeof P>, number][] = [];
for (let i = 0; i < 8; i++) spinKeys.push([P(STANCE, { af: i % 2 ? -150 : -110, ef: -30, ab: -20, eb: -90, t: 2, pa: 150 * (i + 1) }), 4]);
const leeSpecials: Special[] = [
  {
    name: "Dragon's Inch", cmd: [2, 3, 6], btn: 'p', text: 'D, DF, F + P',
    move: {
      id: 'inchpunch',
      anim: A([
        [P(STANCE, { af: -70, ef: -80, ab: -30, eb: -110, t: 4, h: -4 }), 8],
        [P(STANCE, { af: -92, ef: -2, ab: -20, eb: -120, t: 24, h: -8, lf: -42, kf: 40, lb: 26, kb: 6 }), 6],
        [P(STANCE, { af: -90, ef: -4, ab: -20, eb: -120, t: 22, h: -6, lf: -42, kf: 40, lb: 26, kb: 6 }), 10],
        [STANCE, 8],
      ]),
      active: [8, 13],
      vx: (fr) => (fr >= 6 && fr < 10 ? 3 : 0),
      hit: { limb: 'handF', r: 7, dmg: 95, level: 'mid', effect: 'knockdown', push: 4, stun: 22, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 7) f.sfx('kiai', 340);
        if (fr === 9) f.particles.sparks(self.x + self.facing * 30, 52, 5, '#fff2c0');
      },
    },
  },
  {
    name: 'Soaring Dragon Kick', cmd: [6, 2, 3], btn: 'k', text: 'F, D, DF + K',
    move: {
      id: 'dragonkick', air: true,
      anim: A([
        [P(CROUCH, { t: 20 }), 3],
        [P(TUCK, { t: -28, h: 16, lf: -96, kf: -2, ff: -20, lb: -40, kb: 120, af: -40, ef: -80, ab: 30, eb: -40 }), 30],
        [TUCK, 20],
      ]),
      active: [4, 26],
      hit: { limb: 'toeF', r: 7, dmg: 105, level: 'high', effect: 'knockdown', push: 3, stun: 22, special: true, sfx: 'heavy' },
      onFrame: (self, f, fr) => {
        if (fr === 2) {
          self.vy = 5.4;
          self.y = 1;
          self.vx = 3.6 * self.facing;
          f.sfx('kiai', 380);
        }
      },
    },
  },
  {
    name: 'Nunchaku Storm', cmd: [4, 6], btn: 'hp', mash: 'hp', text: 'MASH HP',
    move: {
      id: 'nunchaku', prop: 'nunchaku',
      anim: A([
        [P(STANCE, { af: -120, ef: -40, ab: -20, eb: -90, pa: 0 }), 4],
        ...spinKeys,
        [P(STANCE, { af: -84, ef: -6, ab: -20, eb: -90, t: 18, pa: 1260 }), 6],
        [STANCE, 8],
      ]),
      active: [4, 40],
      vx: (fr) => (fr >= 4 && fr < 36 ? 0.9 : 0),
      hit: { limb: 'prop', r: 9, dmg: 28, level: 'mid', effect: 'light', push: 1.4, stun: 15, rehit: 7, special: true },
      onFrame: (_self, f, fr) => { if (fr % 6 === 4 && fr < 36) f.sfx('whoosh'); },
    },
  },
];

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

let cache: CharDef[] | null = null;
export function roster(): CharDef[] {
  if (cache) return cache;
  const props = { axe: axe(), sword: sword(), cutlass: cutlass(), nunchaku: nunchaku() };
  cache = [
    {
      id: 'lincoln', name: 'Abe Lincoln', short: 'LINCOLN', title: 'The Rail Splitter', look: LINCOLN_LOOK,
      alt: { ...LINCOLN_LOOK, coat: '#4a2c1a', pants: '#3a2a1e', hatColor: '#4a2c1a', bowtie: '#7a1010' },
      specials: lincolnSpecials, voice: 110, props: { axe: props.axe }, intro: LINCOLN_INTRO,
      quotes: [
        'FOUR SCORE AND SEVEN SECONDS AGO, YOU STILL HAD TEETH.',
        'A HOUSE DIVIDED CANNOT STAND. NEITHER, IT SEEMS, CAN YOU.',
        'I SPLIT RAILS TALLER THAN YOU BEFORE BREAKFAST.',
        'GO HOME, {L}. THE NATION NEEDS ITS FLOORS SWEPT.',
      ],
      quotesVs: { blackbeard: 'I HAVE FREED YOU OF YOUR FINAL TOOTH, PIRATE.' },
      portrait: { front: (p, c) => { if (!c.beaten) p.set(c.geom.mouth[0] - 6, c.geom.mouth[1] - 6, '#7a4a30'); } },
      finisher: { name: 'Emancipation Cleave', cmd: [6, 4, 6], btn: 'hp', text: 'F, B, F + HP (close)', range: [0, 90] },
    },
    {
      id: 'tesla', name: 'Nikola Tesla', short: 'TESLA', title: 'Wizard of Current', look: TESLA_LOOK,
      alt: { ...TESLA_LOOK, coat: '#3e2a46', pants: '#2c2232', necktie: '#d0a020', glove: '#2a2a2a' },
      specials: teslaSpecials, voice: 140, props: {}, intro: TESLA_INTRO,
      quotes: [
        'YOUR RESISTANCE WAS LOW. MY CURRENT WAS NOT.',
        'I SAW THIS DEFEAT IN A VISION. IT WAS FUNNIER IN PERSON.',
        'ALTERNATING BLOWS, {L}. YOU ONLY BLOCKED THE FIRST ONE.',
        'EVEN A PIGEON PUTS UP A BETTER FIGHT.',
      ],
      quotesVs: { lincoln: 'A FINE HAT, MR PRESIDENT. A SHAME IT CONDUCTS SO WELL.' },
      portrait: {
        front: (p, c) => {
          // static crackling off the hair
          if (c.beaten) for (const [x, y] of [[30, 18], [44, 12], [62, 13]]) p.line(x, y, x + 3, y - 4, '#a0e0ff'), p.line(x + 3, y - 4, x + 1, y - 7, '#e0f8ff');
        },
      },
      finisher: { name: 'Grand Discharge', cmd: [2, 6, 2], btn: 'lp', text: 'D, F, D + LP (any range)', range: [0, 400] },
    },
    {
      id: 'joan', name: 'Joan of Arc', short: 'JOAN', title: 'Maid of the Flame', look: JOAN_LOOK,
      alt: { ...JOAN_LOOK, hair: '#c8a040', armor: { metal: '#8a8a96', tabard: '#8a1a1a', trim: '#e8e8e8' }, pants: '#8a8a96' },
      specials: joanSpecials, voice: 260, props: { sword: props.sword }, intro: JOAN_INTRO,
      quotes: [
        'THE VOICES TOLD ME YOU WOULD FALL. THEY WERE RIGHT.',
        'KNEEL, {L}. IT SUITS YOU.',
        'I HAVE FACED ARMIES. YOU WERE A LIGHT WARM-UP.',
        'GO WITH GOD. GO QUICKLY.',
      ],
      quotesVs: { tesla: 'I AM NOT AFRAID OF FIRE, AND I AM NOT AFRAID OF SPARKS.' },
      finisher: { name: 'Purifying Pyre', cmd: [6, 2, 6], btn: 'hk', text: 'F, D, F + HK (mid range)', range: [20, 180] },
    },
    {
      id: 'blackbeard', name: 'Blackbeard', short: 'BLACKBEARD', title: 'Terror of the Seas', look: BEARD_LOOK,
      alt: { ...BEARD_LOOK, coat: '#1c3c2a', coatTrim: '#c0c0c8', pants: '#2a2a30', beardRibbon: '#20a0e0' },
      specials: beardSpecials, voice: 95, props: { cutlass: props.cutlass }, intro: BLACKBEARD_INTRO,
      quotes: [
        'DEAD MEN TELL NO TALES, AND YOU WILL NOT BE TELLING THIS ONE.',
        'I HAVE SCRAPED TOUGHER THINGS OFF MY HULL.',
        'YOUR SHARE OF THE LOOT IS ONE BLACK EYE, {L}.',
        'WALK THE PLANK, OR CRAWL IT. YOUR CHOICE.',
      ],
      quotesVs: { joan: 'EVEN SAINTS SINK, LASS.' },
      portrait: {
        front: (p, c) => {
          // the lit fuses tucked under his hat brim
          const pts = c.beaten ? [[22, 26], [82, 20]] : [[20, 34], [86, 30]];
          for (const [x, y] of pts) {
            p.line(x, y, x, y + 8, '#d0b890');
            p.set(x, y - 1, '#ffd040'), p.set(x, y - 2, '#ff6020'), p.set(x + 1, y - 3, '#a0a0a0');
          }
        },
      },
      finisher: { name: 'Powder Keg Surprise', cmd: [4, 4, 6], btn: 'lp', text: 'B, B, F + LP (close)', range: [0, 90] },
    },
    {
      // TODO: a detailed winner/loser portrait once the portrait API lands on main. Entrance: chars/intros.ts.
      id: 'brucelee', name: 'Bruce Lee', short: 'BRUCE LEE', title: 'The Little Dragon', look: LEE_LOOK,
      alt: { ...LEE_LOOK, pants: '#e4e0d4', boots: '#d8d4c8', sash: '#b01818', wraps: '#2a2a30' },
      specials: leeSpecials, voice: 180, props: { nunchaku: props.nunchaku },
      quotes: [
        'BE LIKE WATER. YOU WERE MORE LIKE A PUDDLE.',
        'BOARDS DO NOT HIT BACK. NEITHER, IT TURNS OUT, DO YOU.',
        'I FEAR THE MAN WHO PRACTISED ONE KICK TEN THOUSAND TIMES. NOT YOU, {L}.',
      ],
      finisher: { name: 'Hundred-Fist Finale', cmd: [4, 6, 4], btn: 'lp', text: 'B, F, B + LP (close)', range: [0, 90] },
    },
    {
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
    },
    aliDef(),
    lumpsum(),
    colonelCrisp(),
    {
      id: 'hawking', name: 'Stephen Hawking', short: 'HAWKING', title: 'Spacetime Bender', look: HAWKING_LOOK, alt: HAWKING_ALT,
      specials: hawkingSpecials, voice: 120, props: {}, finisher: HAWKING_FINISHER, intro: HAWKING_INTRO, portrait: HAWKING_PORTRAIT,
      quotes: HAWKING_QUOTES, quotesVs: HAWKING_QUOTES_VS,
    },
    bobRoss(),
    {
      id: 'jackson', name: 'Michael Jackson', short: 'JACKSON', title: 'The Gloved One', look: JACKSON_LOOK, alt: JACKSON_ALT,
      specials: JACKSON_SPECIALS, voice: 230, props: {}, finisher: JACKSON_FINISHER, intro: JACKSON_INTRO,
      quotes: [
        'HEE HEE! YOU NEVER EVEN SAW MY FEET MOVE.',
        'I WALKED BACKWARDS THE WHOLE TIME, {L}. STILL TOO FAST FOR YOU.',
        'ONE GLOVE. THAT IS ALL IT TOOK.',
        'DANCE LESSONS ARE CHEAPER THAN HOSPITAL BILLS.',
      ],
      quotesVs: { lincoln: 'NICE HAT, MR PRESIDENT. MINE SPINS BETTER.' },
    },
    oprah(),
    blaine(),
    buster(),
    kingTut(),
    guyFieri(),
    shaqDef(),
    irwin(),
  ];
  for (const c of cache) c.intro ??= INTROS[c.id];
  return cache;
}

const partCache = new Map<string, ReturnType<typeof buildParts>>();
export function partsFor(c: CharDef, alt = false) {
  const k = c.id + (alt ? '_alt' : '');
  let p = partCache.get(k);
  if (!p) {
    p = buildParts(alt ? c.alt : c.look);
    partCache.set(k, p);
  }
  return p;
}
