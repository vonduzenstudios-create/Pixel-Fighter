import { EMPTY, RawInput } from '../core/input';

// The online wire format. A fight sends only button states, never positions or health: both
// games run the same simulation from the same inputs, so a few bytes a frame keep them in step.

/** Button order inside a packed input: one bit each, 11 bits in all. */
const KEYS: (keyof RawInput)[] = ['l', 'r', 'u', 'd', 'lp', 'hp', 'lk', 'hk', 'bl', 'start', 'back'];

export function packInput(r: RawInput): number {
  let b = 0;
  KEYS.forEach((k, i) => r[k] && (b |= 1 << i));
  return b;
}

export function unpackInput(b: number): RawInput {
  const r: RawInput = { ...EMPTY };
  KEYS.forEach((k, i) => (r[k] = !!(b & (1 << i))));
  return r;
}

export const Pkt = {
  /** A run of one player's inputs: [type][match][ack u16][first frame u16][runs u8]{[count u8][bits u16]}... */
  Inputs: 1,
  /** A checksum of the fight so far: [type][match][frame u16][hash u32]. */
  Hash: 2,
  /** Round trip timing: [type][match][stamp u32], answered with the same bytes as Pong. */
  Ping: 3,
  Pong: 4,
} as const;
export type Pkt = (typeof Pkt)[keyof typeof Pkt];

export interface InputsPacket {
  match: number;
  /** How many of the receiver's frames the sender already has. */
  ack: number;
  /** Frame number of the first input (16 bits, wraps). */
  start: number;
  inputs: number[];
}

/** Packs inputs as runs: a held button over many frames costs 3 bytes however long it is held. */
export function encodeInputs(p: InputsPacket): Uint8Array {
  const runs: [number, number][] = [];
  for (const b of p.inputs) {
    const last = runs[runs.length - 1];
    if (last && last[1] === b && last[0] < 255) last[0]++;
    else if (runs.length < 255) runs.push([1, b]);
    else break;
  }
  const buf = new Uint8Array(7 + runs.length * 3);
  const v = new DataView(buf.buffer);
  v.setUint8(0, Pkt.Inputs);
  v.setUint8(1, p.match & 255);
  v.setUint16(2, p.ack & 0xffff);
  v.setUint16(4, p.start & 0xffff);
  v.setUint8(6, runs.length);
  runs.forEach(([n, b], i) => {
    v.setUint8(7 + i * 3, n);
    v.setUint16(8 + i * 3, b);
  });
  return buf;
}

export function decodeInputs(buf: Uint8Array): InputsPacket | null {
  if (buf.length < 7 || buf[0] !== Pkt.Inputs) return null;
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = v.getUint8(6);
  if (buf.length < 7 + n * 3) return null;
  const inputs: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = v.getUint8(7 + i * 3), b = v.getUint16(8 + i * 3);
    for (let k = 0; k < c; k++) inputs.push(b);
  }
  return { match: v.getUint8(1), ack: v.getUint16(2), start: v.getUint16(4), inputs };
}

/** Turns a wrapped 16-bit frame number back into a full one, taking the one nearest `near`. */
export function unwrap16(v: number, near: number) {
  const d = (((v - near) & 0xffff) << 16) >> 16;
  return near + d;
}

export function encodeSmall(type: Pkt, match: number, a: number, b = 0): Uint8Array {
  const buf = new Uint8Array(type === Pkt.Hash ? 8 : 6);
  const v = new DataView(buf.buffer);
  v.setUint8(0, type);
  v.setUint8(1, match & 255);
  if (type === Pkt.Hash) {
    v.setUint16(2, a & 0xffff);
    v.setUint32(4, b >>> 0);
  } else v.setUint32(2, a >>> 0);
  return buf;
}
