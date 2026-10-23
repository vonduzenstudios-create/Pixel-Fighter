import { EMPTY, RawInput, readPlayer } from '../core/input';
import { chance, rand } from '../core/rng';
import type { Controller, Fighter } from './fighter';
import type { Fight } from './fight';
import type { Btn } from './types';

export class HumanCtrl implements Controller {
  constructor(public slot: 0 | 1, public shared: boolean) {}
  read(): RawInput {
    return readPlayer(this.slot, this.shared);
  }
}

export type Difficulty = 0 | 1 | 2;
export const DIFF_NAMES = ['EASY', 'NORMAL', 'HARD'];

const PARAMS = [
  { think: 30, block: 0.15, anti: 0.1, special: 0.12, punish: 0.1, finisher: 0.25, jumpIn: 0.15 },
  { think: 15, block: 0.45, anti: 0.35, special: 0.25, punish: 0.4, finisher: 0.6, jumpIn: 0.2 },
  { think: 6, block: 0.75, anti: 0.7, special: 0.32, punish: 0.8, finisher: 0.95, jumpIn: 0.25 },
];

type Step = { d: number; b?: Btn | 'bl'; n?: number };

/** CPU opponent. It produces the same raw inputs a player would, including motion commands. */
export class AICtrl implements Controller {
  queue: RawInput[] = [];
  cool = 0;
  hold: RawInput = { ...EMPTY };
  holdT = 0;
  decided = false;
  constructor(public diff: Difficulty) {}

  private raw(self: Fighter, d: number, b?: Btn | 'bl'): RawInput {
    const r: RawInput = { ...EMPTY };
    const h = ((d - 1) % 3) - 1; // -1 back, 0, 1 forward
    const v = Math.floor((d - 1) / 3) - 1; // -1 down, 0, 1 up
    if (h === 1) self.facing === 1 ? (r.r = true) : (r.l = true);
    if (h === -1) self.facing === 1 ? (r.l = true) : (r.r = true);
    if (v === 1) r.u = true;
    if (v === -1) r.d = true;
    if (b) (r as any)[b] = true;
    return r;
  }
  /** Queue a sequence of (direction, button, frames) steps, with neutral frames between taps. */
  private macro(self: Fighter, steps: Step[]) {
    for (const s of steps) for (let i = 0; i < (s.n ?? 2); i++) this.queue.push(this.raw(self, s.d, i === 0 || s.b === 'bl' ? s.b : undefined));
  }
  private holdFor(self: Fighter, d: number, n: number, b?: 'bl') {
    this.hold = this.raw(self, d, b);
    this.holdT = n;
  }

  read(self: Fighter, f: Fight): RawInput {
    if (this.queue.length) return this.queue.shift()!;
    if (this.holdT > 0) {
      this.holdT--;
      return this.hold;
    }
    const P = PARAMS[this.diff];
    const o = self.opp;
    const dist = Math.abs(o.x - self.x);

    if (f.phase === 'finish' && f.winner === self) return this.finish(self, f, dist, P);
    if (f.phase !== 'fight') return EMPTY;

    // ---- reactions (checked every frame, gated by chance so lower levels react less)
    const busy = !['idle', 'walkF', 'walkB', 'crouch', 'block', 'cblock'].includes(self.state);
    if (!busy) {
      const threat = o.state === 'attack' && o.move?.hit && o.mf < (o.move.active?.[1] ?? 0) && dist < 80;
      const incoming = f.projectiles.find((p) => p.owner === o && Math.abs(p.x - self.x) < 90 && Math.sign(self.x - p.x) === Math.sign(p.vx));
      if (incoming && !this.decided) {
        this.decided = true;
        if (chance(P.block)) {
          if (incoming.level !== 'low' && this.diff === 2 && chance(0.5) && Math.abs(incoming.x - self.x) > 40) this.macro(self, [{ d: 9, n: 3 }]);
          else this.holdFor(self, incoming.level === 'low' ? 2 : 5, 24, 'bl');
          return this.read(self, f);
        }
      }
      if (!incoming) this.decided = false;
      if (threat && chance(P.block / 6)) {
        const low = o.move!.hit!.level === 'low';
        this.holdFor(self, low ? 2 : 5, 16, 'bl');
        return this.hold;
      }
      if (o.state === 'jump' && o.vy < 2 && dist < 60 && Math.sign(o.vx) === Math.sign(self.x - o.x) && chance(P.anti / 4)) {
        this.macro(self, [{ d: 2, n: 3 }, { d: 2, b: 'hp', n: 2 }]);
        return this.read(self, f);
      }
      // punish whiffed moves
      if (o.state === 'attack' && o.move && o.mf > (o.move.active?.[1] ?? 99) && dist < 45 && chance(P.punish / 4)) {
        this.macro(self, [{ d: 2, n: 2 }, { d: 2, b: 'hp', n: 2 }]);
        return this.read(self, f);
      }
    }

    if (this.cool > 0) {
      this.cool--;
      return this.hold;
    }
    this.cool = P.think + Math.floor(rand(0, P.think));
    this.hold = { ...EMPTY };
    if (busy) return EMPTY;
    this.choose(self, f, dist, P);
    return this.queue.shift() ?? this.hold;
  }

  private special(self: Fighter, idx: number) {
    const sp = self.ch.specials[idx];
    const steps: Step[] = [];
    const cmd = sp.cmd;
    cmd.forEach((d, i) => steps.push({ d, n: 2, b: i === cmd.length - 1 ? (sp.btn === 'p' ? 'hp' : sp.btn === 'k' ? 'hk' : sp.btn) : undefined }));
    // the button goes on the last direction
    this.macro(self, steps);
  }

  private choose(self: Fighter, f: Fight, dist: number, P: (typeof PARAMS)[number]) {
    const projIdx = self.ch.specials.findIndex((s) => s.move.id.startsWith('proj'));
    if (dist > 110) {
      if (projIdx >= 0 && !self.projOut && chance(P.special * 1.6)) return this.special(self, projIdx);
      if (chance(P.jumpIn)) return this.macro(self, [{ d: 9, n: 2 }, { d: 5, n: 18 }, { d: 5, b: 'hk', n: 2 }]);
      return this.holdFor(self, 6, 20 + Math.floor(rand(0, 20)));
    }
    if (dist > 45) {
      const r = Math.random();
      if (r < P.special) return this.special(self, Math.floor(rand(0, self.ch.specials.length)));
      if (r < P.special + P.jumpIn) return this.macro(self, [{ d: 9, n: 2 }, { d: 5, n: 14 }, { d: 5, b: chance(0.5) ? 'hk' : 'hp', n: 2 }]);
      if (r < 0.7) return this.holdFor(self, 6, 10 + Math.floor(rand(0, 15)));
      if (r < 0.8) return this.holdFor(self, 4, 12);
      return this.holdFor(self, 5, 10);
    }
    // close range
    const opts: Step[][] = [
      [{ d: 5, b: 'lp' }, { d: 5, n: 6 }, { d: 5, b: 'lp' }],
      [{ d: 5, b: 'hp' }],
      [{ d: 5, b: 'hk' }],
      [{ d: 5, b: 'lk' }],
      [{ d: 2, n: 2 }, { d: 2, b: 'hp' }],
      [{ d: 4, b: 'lk' }],
      [{ d: 4, b: 'hk' }],
      [{ d: 6, b: 'lp' }],
      [{ d: 2, n: 2 }, { d: 2, b: 'lk' }],
    ];
    if (chance(P.special * 0.6)) return this.special(self, Math.floor(rand(0, self.ch.specials.length)));
    if (chance(0.15 + P.block * 0.2)) return this.holdFor(self, chance(0.5) ? 5 : 2, 18, 'bl');
    if (chance(0.12)) return this.holdFor(self, 4, 14);
    this.macro(self, opts[Math.floor(rand(0, opts.length))]);
  }

  private finish(self: Fighter, f: Fight, dist: number, P: (typeof PARAMS)[number]): RawInput {
    if (!['idle', 'walkF', 'walkB', 'crouch', 'land'].includes(self.state)) return EMPTY;
    if (f.pt < 40) return EMPTY;
    const fin = self.ch.finisher;
    if (!this.decided) {
      this.decided = true;
      (this as any).plan = chance(P.finisher) ? (chance(0.3) ? 'pit' : 'fatal') : 'hit';
    }
    const plan = (this as any).plan as string;
    const want = plan === 'pit' ? 28 : plan === 'fatal' ? Math.max(fin.range[0] + 10, Math.min(fin.range[1] - 10, 40)) : 30;
    if (Math.abs(dist - want) > 10 && f.pt < 280) {
      this.holdFor(self, dist > want ? 6 : 4, 4);
      return this.hold;
    }
    this.decided = false;
    if (plan === 'fatal') this.macro(self, fin.cmd.map((d, i) => ({ d, n: 3, b: i === fin.cmd.length - 1 ? fin.btn : undefined })).flatMap((s) => [s, { d: 5, n: 1 }]).slice(0, -1));
    else if (plan === 'pit') this.macro(self, [{ d: 2, n: 3 }, { d: 2, b: 'hp', n: 2 }]);
    else this.macro(self, [{ d: 5, b: 'hk' }]);
    return this.queue.shift() ?? EMPTY;
  }
}
