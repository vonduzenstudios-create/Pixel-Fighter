import { decodeInputs, encodeInputs, encodeSmall, Pkt, unwrap16 } from './packets';

// Delay-based lockstep, the netcode classic fighting games used before rollback.
//
// Both games run the whole fight themselves. Each frame, your button press is scheduled `delay`
// frames into the future and sent to the other player. A frame only runs once both players'
// inputs for it are in, so both games always run exactly the same frames with exactly the same
// inputs and stay identical. The delay (a few frames, sized to the connection) hides the trip
// across the internet; if a packet is late the game briefly waits for it instead of guessing.
//
// To save bandwidth a packet goes out when your buttons change, or every third frame otherwise
// as a heartbeat. Each packet repeats every input the other side hasn't confirmed yet, so a lost
// packet needs no resend of its own.

/** Longest gap between packets while nothing changes, in frames. */
const HEARTBEAT = 3;
/** How often the two games compare checksums of the fight, in frames. */
const HASH_EVERY = 120;

export class Lockstep {
  /** The next frame to simulate. */
  frame = 0;
  /** Packed inputs by frame: mine and the other player's. */
  private mine: number[] = [];
  private theirs: number[] = [];
  /** How many of my frames the other player has confirmed. */
  private acked = 0;
  private sinceSend = HEARTBEAT;
  private lastBits = -1;
  private hashes = new Map<number, [number?, number?]>();
  /** Set when the two games' checksums disagree (they have drifted apart). */
  desynced = false;
  /** Frames spent waiting on the other player's inputs, in a row. */
  waiting = 0;

  constructor(private send: (b: Uint8Array) => void, public me: 0 | 1, public delay: number, public match: number) {
    // nobody has pressed anything during the first `delay` frames
    for (let i = 0; i < delay; i++) this.mine.push(0), this.theirs.push(0);
  }

  /**
   * Feed this frame's local buttons. Returns both players' inputs for the next frame, as
   * [1P, 2P], or null while still waiting on the other player.
   */
  step(local: number): [number, number] | null {
    // sample a new local input only while we're not already a full delay ahead
    if (this.mine.length <= this.frame + this.delay) {
      this.mine.push(local);
      if (local !== this.lastBits) this.sinceSend = HEARTBEAT;
      this.lastBits = local;
    }
    if (++this.sinceSend >= HEARTBEAT) this.flush();
    const f = this.frame;
    if (f >= this.theirs.length || f >= this.mine.length) {
      this.waiting++;
      return null;
    }
    this.waiting = 0;
    this.frame++;
    const a = this.mine[f], b = this.theirs[f];
    return this.me === 0 ? [a, b] : [b, a];
  }

  /** Send every input the other side hasn't confirmed, plus how far we've got with theirs. */
  private flush() {
    this.sinceSend = 0;
    const from = this.acked;
    this.send(encodeInputs({ match: this.match, ack: this.theirs.length, start: from, inputs: this.mine.slice(from, from + 600) }));
  }

  receive(buf: Uint8Array) {
    if (buf[1] !== (this.match & 255)) return; // left over from the previous match
    if (buf[0] === Pkt.Hash) return this.onHash(buf);
    const p = decodeInputs(buf);
    if (!p) return;
    this.acked = Math.max(this.acked, Math.min(this.mine.length, unwrap16(p.ack, this.acked)));
    const start = unwrap16(p.start, this.theirs.length);
    // packets can arrive out of order: keep only inputs that extend what we have, in sequence
    for (let i = 0; i < p.inputs.length; i++) {
      const f = start + i;
      if (f === this.theirs.length) this.theirs.push(p.inputs[i]);
      else if (f > this.theirs.length) break;
    }
  }

  /** After each simulated frame: every so often, swap a checksum of the fight to catch drift. */
  check(frame: number, hash: number) {
    if (frame % HASH_EVERY) return;
    this.storeHash(frame, this.me, hash);
    this.send(encodeSmall(Pkt.Hash, this.match, frame, hash));
  }

  private onHash(buf: Uint8Array) {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.storeHash(unwrap16(v.getUint16(2), this.frame), (1 - this.me) as 0 | 1, v.getUint32(4));
  }

  private storeHash(frame: number, who: 0 | 1, h: number) {
    const e = this.hashes.get(frame) ?? [];
    e[who] = h;
    this.hashes.set(frame, e);
    if (e[0] !== undefined && e[1] !== undefined) {
      if (e[0] !== e[1] && !this.desynced) {
        this.desynced = true;
        console.warn(`[online] games drifted apart at frame ${frame}`);
      }
      this.hashes.delete(frame);
    }
  }
}

/** Input delay in frames for a measured round trip: half the trip, plus room for the heartbeat. */
export function delayFor(rttMs: number) {
  return Math.max(3, Math.min(10, Math.ceil(rttMs / 2 / (1000 / 60)) + HEARTBEAT - 1));
}
