// How the controls feel: button presses are buffered (and never lost to hitstop), light attacks
// chain, and normals that connect cancel into specials. Fights run headless with scripted inputs.
import { describe, expect, it, vi } from 'vitest';

const inert: any = new Proxy(() => inert, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : inert), apply: () => inert, construct: () => inert });
vi.stubGlobal('document', { createElement: () => ({ getContext: () => inert }) });
vi.stubGlobal('ImageData', class {});
vi.stubGlobal('window', { addEventListener() {}, speechSynthesis: undefined });
vi.stubGlobal('navigator', {});

const { roster, partsFor } = await import('../src/chars/roster');
const { STAGES } = await import('../src/game/stages');
const { Fight } = await import('../src/game/fight');
const { Fighter } = await import('../src/game/fighter');
const { bonesParts } = await import('../src/scenes/menus');
const { EMPTY } = await import('../src/core/input');
const { seededRandom } = await import('../src/core/rng');

type In = Partial<typeof EMPTY>;

/** Tesla (left, facing right) against a fighter who stands still, a jab's reach apart. */
function setup(gap = 30) {
  const ch = roster();
  const tesla = ch.find((c) => c.id === 'tesla')!;
  const dummy = ch.find((c) => c.id === 'lincoln')!;
  // the stick and buttons as held this frame, like a real pad (not a queue that waits for a reader)
  let held: In = {};
  const ctrl = [{ read: () => ({ ...EMPTY, ...held }) }, { read: () => ({ ...EMPTY }) }];
  let fight!: InstanceType<typeof Fight>;
  seededRandom(1).run(() => {
    const arena = STAGES[0].make(bonesParts());
    const a = new Fighter(tesla, partsFor(tesla), bonesParts(), ctrl[0], 0);
    const b = new Fighter(dummy, partsFor(dummy), bonesParts(), ctrl[1], 1);
    fight = new Fight([a, b], arena, [true, true], () => {});
  });
  fight.phase = 'fight';
  fight.pt = 0;
  for (const f of fight.f) (f.locked = false), (f.alpha = 1), f.setState('idle');
  fight.f[0].x = 200;
  fight.f[1].x = 200 + gap;
  fight.f[0].facing = 1;
  fight.f[1].facing = -1;
  const step = (i: In = {}) => {
    held = i;
    seededRandom(2).run(() => fight.update());
  };
  /** Step with no input until `cond` holds; returns the frames taken. */
  const until = (cond: () => boolean, max = 90) => {
    let n = 0;
    while (!cond()) {
      if (++n > max) throw new Error('timed out');
      step();
    }
    return n;
  };
  return { fight, a: fight.f[0], b: fight.f[1], step, until };
}

describe('game feel', () => {
  it('a jab hits on frame 4 and the fighter can act again 6 frames after it stops hitting', () => {
    const { a, b, step, fight, until } = setup(80); // out of reach: a whiff
    step({ lp: true });
    expect(a.move?.id).toBe('jab');
    const n = 1 + until(() => a.strikePoint() !== null);
    expect(n).toBe(4);
    // 3 active frames (4-6), 6 of recovery (7-12), free to act again on frame 13
    expect(n + until(() => a.state !== 'attack')).toBe(12);
    expect(b.state).toBe('idle');
    expect(fight.hitstop).toBe(0);
  });

  it('remembers a button pressed just before the fighter can act', () => {
    const { a, step, until } = setup(80);
    step({ lp: true });
    for (let i = 0; i < 6; i++) step(); // mid-recovery
    step({ lk: true }); // pressed too early on its own...
    until(() => !(a.state === 'attack'));
    step();
    expect(a.move?.id).toBe('lk'); // ...but it still comes out on the first free frame
  });

  it('forgets a press after a few frames', () => {
    const { a, step, until } = setup(80);
    step({ hp: true });
    step({ lk: true }); // far too early: 15 frames before the heavy punch is over
    until(() => !(a.state === 'attack'));
    step();
    expect(a.state).not.toBe('attack');
  });

  it('chains a light attack into another light on hit', () => {
    const { a, b, step, until } = setup();
    step({ lp: true });
    until(() => !(b.state !== 'hitstun'));
    step({ lp: true }); // pressed during the hit freeze
    until(() => !(a.move?.id === 'jab' && a.mf > 0 && a.hits));
    expect(a.move?.id).toBe('jab');
    expect(a.hits).toBe(0); // a fresh jab, started well before the first one recovered
    until(() => !(!a.hits));
    expect(b.state).toBe('hitstun'); // and it combos
  });

  it('cancels a normal that connects into a special typed over the hit', () => {
    const { a, b, step, fight, until } = setup();
    step({ d: true, lk: true }); // low kick
    until(() => !(b.state !== 'hitstun'));
    expect(fight.hitstop).toBeGreaterThan(0);
    step({ d: true });
    step({ d: true, r: true });
    step({ r: true });
    step({ r: true, lp: true }); // quarter circle + punch, all during the freeze
    for (let i = 0; i < 6 && a.move?.id === 'ck'; i++) step();
    expect(a.move?.id).not.toBe('ck');
    expect(a.move?.id).toMatch(/proj/);
  });

  it('does not cancel a normal that whiffs', () => {
    const { a, step, until } = setup(80);
    step({ d: true, lk: true });
    step({ d: true });
    step({ d: true, r: true });
    step({ r: true });
    step({ r: true, lp: true });
    for (let i = 0; i < 6; i++) step();
    expect(a.move?.id).toBe('ck');
  });
});
