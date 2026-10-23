import { H, W } from '../core/consts';
import { Edge, EMPTY, RawInput, readPlayer } from '../core/input';
import { seededRandom } from '../core/rng';
import { initAudio } from '../audio/audio';
import { sfx } from '../audio/sfx';
import { playSong } from '../audio/music';
import { drawText } from '../gfx/font';
import { roster, partsFor } from '../chars/roster';
import { STAGES, Arena } from '../game/stages';
import { Fight } from '../game/fight';
import { Controller, Fighter } from '../game/fighter';
import { NetLink } from '../net/link';
import { Lockstep } from '../net/lockstep';
import { packInput, unpackInput } from '../net/packets';
import { hashFight } from '../net/hash';
import { App, bonesParts, SelectScene, TitleScene } from './menus';
import { CongaLine, drawParty } from './conga';
import { PostMatchScene } from './postmatch';
import type { Scene } from './common';

/** Bump when the online rules change, so old and new copies of the game never get paired. */
const PROTOCOL = 1;

/**
 * Two games only pair if they would run the same fight: same netcode, same fighters, same stages.
 * Someone on a stale cached copy of the site just waits for a matching player instead.
 */
export function gameVersion() {
  const s = `${PROTOCOL}|${roster().map((c) => c.id).join(',')}|${STAGES.map((s) => s.id).join(',')}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${PROTOCOL}-${(h >>> 0).toString(36)}`;
}

/** What the host sends to begin a fight: everything both games need to build the same one. */
export interface MatchStart {
  t: 'start';
  /** Roster indices for 1P and 2P. */
  a: number;
  b: number;
  stage: number;
  seed: number;
  delay: number;
  /** Counts up each rematch, so stray packets from the last fight are ignored. */
  id: number;
}

// ------------------------------------------------------------------ Lobby
/** Online quick match: join an open game if there is one, otherwise host one and wait. */
export class LobbyScene implements Scene {
  t = 0;
  e = new Edge();
  conga = new CongaLine();
  link: NetLink;
  /** Frames to show the "opponent found" flash before moving on. */
  found = 0;
  constructor(private app: App) {
    // sound must exist on both computers in an online fight (see core/rng.ts), even if muted
    initAudio();
    this.link = new NetLink(gameVersion());
  }

  update() {
    this.t++;
    this.conga.update();
    playSong('title');
    const p = this.e.update(readPlayer(0, true));
    const back = this.app.back;
    this.app.back = false;
    const L = this.link;
    if (L.status === 'ready') {
      if (++this.found === 1) sfx.gong();
      if (this.found > 70) this.app.go(new SelectScene(this.app, L));
      return;
    }
    if (p.back || back) {
      L.close();
      sfx.menuMove();
      return this.app.go(TitleScene.at(this.app, 'versus', 0));
    }
    // a closed link here means the server couldn't be reached: say so, then wait for BACK
  }

  draw(ctx: CanvasRenderingContext2D) {
    drawParty(ctx, this.t);
    this.conga.draw(ctx, this.t);
    ctx.fillStyle = 'rgba(20,0,40,0.7)';
    ctx.fillRect(0, 70, W, 50);
    const L = this.link;
    const dots = '.'.repeat(1 + ((this.t >> 4) % 3));
    const big = (s: string, c: [string, string]) => drawText(ctx, s, W / 2, 78, '#fff', { scale: 2, align: 'center', grad: c, outline: '#2a0030' });
    const small = (s: string, y: number, c = '#fff') => drawText(ctx, s, W / 2, y, c, { align: 'center', outline: '#2a0030' });
    if (L.status === 'ready') {
      if (this.found % 16 < 12) big('OPPONENT FOUND!', ['#ffffff', '#ffe060']);
      small(`YOU ARE ${L.side === 0 ? '1P' : '2P'}  -  ${L.transport === 'p2p' ? 'DIRECT LINK' : 'SERVER RELAY'}`, 102, '#5ce0ff');
    } else if (L.status === 'closed') {
      big(L.reason, ['#ffd0d0', '#e02a10']);
      small('PRESS BACK TO RETURN', 102, '#ffc0c0');
    } else if (L.status === 'connecting') {
      big(`CONNECTING${dots}`, ['#ffffff', '#5ce0ff']);
      // a free Render server sleeps when nobody has played for a while and takes a minute to wake
      if (performance.now() - L.startedAt > 4000) small('WAKING UP THE SERVER, THIS CAN TAKE A MINUTE', 102, '#ffe060');
    } else if (L.status === 'pairing') {
      big(`CONNECTING TO OPPONENT${dots}`, ['#ffffff', '#5ce0ff']);
    } else {
      big(`SEARCHING FOR GAME${dots}`, ['#ffffff', '#ff5cc8']);
      small('WAITING FOR ANOTHER PLAYER TO JOIN', 102, '#e0c0ff');
    }
    drawText(ctx, 'ONLINE VERSUS', W / 2, 20, '#fff', { scale: 3, align: 'center', grad: ['#fff4b0', '#e02a10'], outline: '#2a0030', shadow: '#2a0030' });
    if (L.status !== 'ready') small('BACK: CANCEL', H - 12, '#ffffff');
  }
}

// ------------------------------------------------------------------ The online fight
/** A controller fed from the shared input stream instead of the keyboard. */
class NetCtrl implements Controller {
  cur: RawInput = { ...EMPTY };
  read() {
    return this.cur;
  }
}

/** Build a fresh copy of stage i from the match seed, so both games start it in the same state. */
export function onlineStage(start: MatchStart): Arena {
  return seededRandom(start.seed ^ 0x5bd1e995).run(() => STAGES[start.stage].make(bonesParts()));
}

export class OnlineFightScene implements Scene {
  fight!: Fight;
  ls: Lockstep;
  ctrl = [new NetCtrl(), new NetCtrl()];
  rnd: ReturnType<typeof seededRandom>;
  /** Frames since the other player vanished (shown, then back to the title). */
  gone = 0;

  /** The lockstep session is made by the select screen so it catches packets that arrive early. */
  constructor(private app: App, private link: NetLink, start: MatchStart, stage: Arena, ls: Lockstep) {
    this.ls = ls;
    this.rnd = seededRandom(start.seed);
    const ch = roster();
    const a = ch[start.a], b = ch[start.b];
    const bones = bonesParts();
    this.rnd.run(() => {
      const f1 = new Fighter(a, partsFor(a), bones, this.ctrl[0], 0);
      const f2 = new Fighter(b, partsFor(b, a === b), bones, this.ctrl[1], 1);
      this.fight = new Fight([f1, f2], stage, [true, true], (w) => {
        const l = w === f1 ? f2 : f1;
        const alt = (f: Fighter) => f === f2 && a === b;
        const result = { winner: w.ch, loser: l.ch, winnerAlt: alt(w), loserAlt: alt(l), fatality: this.fight.hadFatality };
        link.onBin = null;
        app.go(new PostMatchScene(result, () => app.go(link.open ? new SelectScene(app, link) : TitleScene.at(app, 'versus', 0))));
      });
      this.fight.lockstep = true;
    });
  }

  update() {
    // a player whose game stops sending inputs (a hidden tab) for 20 seconds has left
    if (!this.link.open || this.link.silent || this.ls.waiting > 60 * 20) {
      if (this.gone++ === 0) this.link.close('OPPONENT LEFT');
      if (this.gone > 150) this.app.go(TitleScene.at(this.app, 'versus', 0));
      return;
    }
    const ins = this.ls.step(packInput(readPlayer(0, true)));
    if (!ins) return; // waiting for the other player's inputs for this frame
    this.ctrl[0].cur = unpackInput(ins[0]);
    this.ctrl[1].cur = unpackInput(ins[1]);
    const frame = this.ls.frame;
    this.rnd.run(() => this.fight.update());
    this.ls.check(frame, hashFight(this.fight));
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.fight.draw(ctx);
    const side = this.ls.me === 0 ? 'left' : 'right';
    drawText(ctx, 'YOU', this.ls.me === 0 ? 4 : W - 4, H - 9, '#5ce0ff', { align: side, outline: '#000' });
    if (this.ls.desynced) drawText(ctx, 'OUT OF SYNC', W / 2, H - 9, '#ff8060', { align: 'center', outline: '#000' });
    const msg = this.gone ? this.link.reason : this.ls.waiting > 20 ? 'WAITING FOR OPPONENT...' : '';
    if (msg) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, H / 2 - 12, W, 22);
      drawText(ctx, msg, W / 2, H / 2 - 4, '#fff', { align: 'center', outline: '#000' });
    }
  }
}
