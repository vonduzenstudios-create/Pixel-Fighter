import { SERVER_URL } from './config';
import { encodeSmall, Pkt } from './packets';

// The connection to the other player. The matchmaking server on Render pairs two players and
// passes their messages along. Once paired the two games try to open a direct peer-to-peer
// channel (WebRTC) for fight inputs, which is quicker and skips the server; if a home router
// blocks that, inputs keep flowing through the server instead ("relay"). Either way only a few
// bytes of button presses travel per packet.

export type LinkStatus =
  | 'connecting' // opening the WebSocket to the server (a sleeping free Render server takes ~50s to wake)
  | 'searching' // hosting a game and waiting for someone to join
  | 'pairing' // matched: setting up the direct channel and timing the connection
  | 'ready' // both games connected and the round trip measured
  | 'closed'; // the server, or the other player, went away

export interface Msg {
  t: string;
  [k: string]: any;
}

const STUN: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
/** How long to wait for the direct channel before settling for the relay. */
const P2P_WAIT = 5000;
/** Silence from the other side for this long means they are gone. */
const TIMEOUT = 10000;

export class NetLink {
  status: LinkStatus = 'connecting';
  /** 0 = host (left side, 1P), 1 = guest (right side, 2P). */
  side: 0 | 1 = 0;
  transport: 'p2p' | 'relay' = 'relay';
  /** Round trip time to the other player in ms, measured while pairing. */
  rtt = 0;
  /** Why the link closed, for the screen to show. */
  reason = '';
  /** Lobby messages from the other player (cursor moves, picks, match start), oldest first. */
  inbox: Msg[] = [];
  /** Receives fight packets (inputs and checksums). */
  onBin: ((b: Uint8Array) => void) | null = null;
  lastHeard = performance.now();
  startedAt = performance.now();

  private ws: WebSocket;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private pings: number[] = [];
  private settled = false;
  private lastSent = 0;
  private hb: ReturnType<typeof setInterval> | undefined;

  constructor(version: string) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(SERVER_URL);
    } catch {
      this.ws = null as any;
      this.close('BAD SERVER ADDRESS');
      return;
    }
    this.ws = ws;
    this.hb = setInterval(() => this.heartbeat(), 1000);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      this.status = 'searching';
      this.sendMsg({ t: 'quick', v: version });
    };
    ws.onclose = () => this.close(this.status === 'connecting' ? 'COULD NOT REACH SERVER' : 'CONNECTION LOST');
    ws.onerror = () => {};
    ws.onmessage = (e) => {
      this.lastHeard = performance.now();
      if (typeof e.data === 'string') this.onMsg(JSON.parse(e.data));
      else this.onBinary(new Uint8Array(e.data));
    };
  }

  get open() {
    return this.status !== 'closed';
  }

  /** Has the other player gone quiet for too long (closed tab, lost Wi-Fi)? */
  get silent() {
    return this.status === 'ready' && performance.now() - this.lastHeard > TIMEOUT;
  }

  sendMsg(m: Msg) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(m));
    this.lastSent = performance.now();
  }

  /** Fight packets go over the direct channel when there is one, otherwise through the server. */
  sendBin(b: Uint8Array) {
    if (this.dc?.readyState === 'open') this.dc.send(b as Uint8Array<ArrayBuffer>);
    else if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(b);
    else return;
    this.lastSent = performance.now();
  }

  /** A tiny "still here" every two seconds while nothing else is being sent (menus, win screen). */
  private heartbeat() {
    if (this.status === 'ready' && performance.now() - this.lastSent > 2000) this.sendMsg({ t: 'hb' });
  }

  close(reason = 'LEFT') {
    if (this.status === 'closed') return;
    this.status = 'closed';
    this.reason = reason;
    console.info(`[online] disconnected: ${reason.toLowerCase()}`);
    clearInterval(this.hb);
    try {
      this.dc?.close();
      this.pc?.close();
      this.ws?.close();
    } catch {
      /* already gone */
    }
  }

  private onMsg(m: Msg) {
    switch (m.t) {
      case 'waiting':
        this.status = 'searching';
        return;
      case 'match':
        this.side = m.role === 'host' ? 0 : 1;
        this.status = 'pairing';
        this.startP2P();
        return;
      case 'left':
        return this.close('OPPONENT LEFT');
      case 'hb':
        return;
      case 'rtc':
        return void this.onSignal(m);
      case 'ice':
        if (m.c) this.pc?.addIceCandidate(m.c).catch(() => {});
        return;
      default:
        this.inbox.push(m);
    }
  }

  private onBinary(b: Uint8Array) {
    this.lastHeard = performance.now();
    if (b[0] === Pkt.Ping) {
      const out = b.slice();
      out[0] = Pkt.Pong;
      return this.sendBin(out);
    }
    if (b[0] === Pkt.Pong) {
      const sent = new DataView(b.buffer, b.byteOffset).getUint32(2);
      this.pings.push(((performance.now() >>> 0) - sent) >>> 0);
      if (this.pings.length < 5) return this.ping();
      // the median of five, so one slow packet doesn't set the input delay for the whole match
      this.rtt = [...this.pings].sort((a, b) => a - b)[2];
      if (this.status === 'pairing') this.status = 'ready';
      return;
    }
    this.onBin?.(b);
  }

  private ping() {
    this.sendBin(encodeSmall(Pkt.Ping, 0, performance.now() >>> 0));
  }

  /** Measure the round trip on whichever transport ended up carrying the fight. */
  private settle(transport: 'p2p' | 'relay') {
    if (this.settled || this.status !== 'pairing') return;
    this.settled = true;
    this.transport = transport;
    // only the host times the link; the guest learns the input delay from the match start
    if (this.side === 0) this.ping();
    else this.status = 'ready';
  }

  private startP2P() {
    if (typeof RTCPeerConnection === 'undefined') return this.settle('relay');
    const pc = (this.pc = new RTCPeerConnection({ iceServers: STUN }));
    pc.onicecandidate = (e) => e.candidate && this.sendMsg({ t: 'ice', c: e.candidate.toJSON() });
    const useChannel = (dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      dc.onopen = () => {
        this.dc = dc;
        this.settle('p2p');
      };
      dc.onmessage = (e) => this.onBinary(new Uint8Array(e.data as ArrayBuffer));
    };
    if (this.side === 0) {
      // unordered and never resent: a late input is useless, and every packet repeats the
      // inputs the other side hasn't confirmed yet, so a lost one is covered by the next
      useChannel(pc.createDataChannel('inputs', { ordered: false, maxRetransmits: 0 }));
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => this.sendMsg({ t: 'rtc', sdp: pc.localDescription }))
        .catch(() => this.settle('relay'));
    } else pc.ondatachannel = (e) => useChannel(e.channel);
    setTimeout(() => this.settle('relay'), P2P_WAIT);
  }

  private async onSignal(m: Msg) {
    const pc = this.pc;
    if (!pc || !m.sdp) return;
    try {
      await pc.setRemoteDescription(m.sdp);
      if (m.sdp.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this.sendMsg({ t: 'rtc', sdp: pc.localDescription });
      }
    } catch {
      this.settle('relay');
    }
  }
}
