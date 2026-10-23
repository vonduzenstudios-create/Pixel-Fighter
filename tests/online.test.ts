// Online fights only work if both computers' games stay identical frame by frame. These tests
// run the same fight twice from the same seed and inputs and check the two never differ, and
// check the input packets survive the trip through the wire format.
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
const { seededRandom, rng } = await import('../src/core/rng');
const { hashFight } = await import('../src/net/hash');
const P = await import('../src/net/packets');
const { Lockstep } = await import('../src/net/lockstep');

/** Plays `frames` frames of a fight with button mashing from `inputSeed`; returns its checksums. */
function play(a: number, b: number, stage: number, seed: number, inputSeed: number, frames: number, noise = false) {
  const ch = roster();
  const r = seededRandom(seed);
  const press = rng(inputSeed);
  const ctrl = [{ cur: P.unpackInput(0), read() { return this.cur; } }, { cur: P.unpackInput(0), read() { return this.cur; } }];
  let fight!: InstanceType<typeof Fight>;
  let done = false;
  const arena = seededRandom(seed ^ 1).run(() => STAGES[stage].make(bonesParts()));
  r.run(() => {
    const f1 = new Fighter(ch[a], partsFor(ch[a]), bonesParts(), ctrl[0], 0);
    const f2 = new Fighter(ch[b], partsFor(ch[b], a === b), bonesParts(), ctrl[1], 1);
    fight = new Fight([f1, f2], arena, [true, true], () => (done = true));
    fight.lockstep = true;
  });
  const out: number[] = [];
  const held = [0, 0];
  for (let i = 0; i < frames && !done; i++) {
    for (const k of [0, 1]) if (press.next() < 0.15) held[k] = Math.floor(press.next() * 2048) & ~(1 << 10);
    ctrl[0].cur = P.unpackInput(held[0]);
    ctrl[1].cur = P.unpackInput(held[1]);
    r.run(() => fight.update());
    // the other computer draws at its own frame rate: drawing's random rolls must not matter
    if (noise) for (let n = 0; n < (i % 3); n++) Math.random();
    out.push(hashFight(fight));
  }
  return out;
}

describe('online lockstep', () => {
  it('replays every fighter\'s fights identically from the same seed and inputs', { timeout: 120000 }, () => {
    const n = roster().length;
    for (let i = 0; i < n; i++) {
      const a = i, b = (i + 1) % n;
      const stage = i % STAGES.length;
      const first = play(a, b, stage, 1234 + i, 99 + i, 5000);
      // play something else in between, as one player's game might have done before the match
      play(b, a, (stage + 1) % STAGES.length, 77, 5, 400);
      const second = play(a, b, stage, 1234 + i, 99 + i, 5000, true);
      expect(second.length, roster()[a].id + ' vs ' + roster()[b].id).toBe(first.length);
      const bad = first.findIndex((h, k) => h !== second[k]);
      expect(bad, `${roster()[a].id} vs ${roster()[b].id} on ${STAGES[stage].id}`).toBe(-1);
    }
  });

  it('packs inputs into a few bytes and back', () => {
    const inputs = [0, 0, 0, 5, 5, 1024, 3, 3, 3, 3];
    const buf = P.encodeInputs({ match: 7, ack: 70000, start: 65534, inputs });
    expect(buf.length).toBe(7 + 4 * 3);
    const back = P.decodeInputs(buf)!;
    expect(back.inputs).toEqual(inputs);
    expect(back.match).toBe(7);
    expect(P.unwrap16(back.start, 65530)).toBe(65534);
    expect(P.unwrap16(back.ack, 69990)).toBe(70000);
    const raw = P.unpackInput(0b10100100001);
    expect(P.packInput(raw)).toBe(0b10100100001);
  });

  it('keeps two games in step over a lossy, shuffled connection', () => {
    const r = rng(3);
    const wire: [number, Uint8Array, number][] = [];
    let now = 0;
    const sides: InstanceType<typeof Lockstep>[] = [];
    for (const me of [0, 1] as const)
      sides.push(new Lockstep((b) => r.next() > 0.2 && wire.push([1 - me, b, now + 2 + Math.floor(r.next() * 6)]), me, 4, 1));
    const ran: [number, number][][] = [[], []];
    for (now = 0; now < 4000; now++) {
      for (let i = wire.length - 1; i >= 0; i--) if (wire[i][2] <= now) sides[wire[i][0]].receive(wire[i][1]), wire.splice(i, 1);
      for (const k of [0, 1]) {
        const got = sides[k].step(Math.floor(r.next() * 2048));
        if (got) ran[k].push(got);
      }
    }
    const len = Math.min(ran[0].length, ran[1].length);
    expect(len).toBeGreaterThan(2500);
    expect(ran[0].slice(0, len)).toEqual(ran[1].slice(0, len));
  });
});
