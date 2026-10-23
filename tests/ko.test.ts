// The round-ending knockout and the finisher lead-in: nobody is left standing when a round is called,
// and the finisher's scene waits for its sting and camera swing.
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

function fightNow() {
  const ch = roster();
  const idle = { read: () => ({}) } as any;
  const f1 = new Fighter(ch[0], partsFor(ch[0]), bonesParts(), idle, 0);
  const f2 = new Fighter(ch[1], partsFor(ch[1]), bonesParts(), idle, 1);
  const fight = new Fight([f1, f2], STAGES[0].make(bonesParts()), [false, false], () => {});
  fight.endEntrances();
  for (let i = 0; i < 200 && fight.phase !== 'fight'; i++) fight.update();
  expect(fight.phase).toBe('fight');
  return fight;
}

describe('knockouts', () => {
  it('a knockout that leaves them on their feet drops them, in slow motion, before the round is called', () => {
    const fight = fightNow();
    const [a, b] = fight.f;
    b.hp = 1;
    b.x = a.x + 30;
    a.startMove(a.normalFor('lp'), fight);
    let frames = 0;
    while (fight.phase !== 'ko' && frames++ < 60) fight.update();
    expect(fight.phase).toBe('ko');
    expect(fight.slowmo).toBeGreaterThan(0);
    let ko = 0;
    while (fight.phase === 'ko' && ko++ < 1000) fight.update();
    expect(fight.phase).toBe('roundEnd');
    expect(b.state).toBe('dead');
    expect(b.y).toBe(0);
    // slow motion: the knockout took well over the 60 frames it would at full speed
    expect(ko).toBeGreaterThan(90);
  });

  it('a finisher runs its lead-in before its scene starts', () => {
    const fight = fightNow();
    const [a, b] = fight.f;
    fight.round = 3;
    a.wins = 1;
    fight.applyDamage(b, 9999, a);
    for (let i = 0; i < 400 && fight.phase !== 'finish'; i++) fight.update();
    expect(fight.phase).toBe('finish');
    fight.startFatality(a);
    expect(fight.fatalPre).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) fight.update();
    expect(fight.fatal!.t).toBe(0);
    expect(fight.vignette).toBe(1);
    while (fight.fatalPre > 0) fight.update();
    // the camera has swung round to centre the pair
    const mid = (a.x + b.x) / 2;
    expect(Math.abs(mid - fight.camX - 128)).toBeLessThan(2);
    fight.update();
    expect(fight.fatal!.t).toBe(1);
  });
});
