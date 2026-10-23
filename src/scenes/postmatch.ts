import { H, W } from '../core/consts';
import { Edge, readPlayer } from '../core/input';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { mix } from '../gfx/palette';
import { PH, PW, portraitFor } from '../gfx/portrait';
import type { CharDef } from '../game/fighter';
import { hush, say, sfx } from '../audio/sfx';
import { manifest } from '../audio/voicemanifest';
import { tone } from '../audio/audio';
import { playSong } from '../audio/music';
import type { Scene } from './common';

// SF2-style win screen: the winner's portrait, the loser's battered one, and a voiced taunt.
// Each fighter's taunts are the "win" lines in its own voice.json, so every one has a Kokoro clip.

// Only shown for a fighter whose voice.json has no win lines yet (tests require them).
const FALLBACK = 'Is that all you had?';

export interface MatchResult {
  winner: CharDef;
  loser: CharDef;
  /** Which of them wore the alternate colours (mirror match). */
  winnerAlt: boolean;
  loserAlt: boolean;
  fatality: boolean;
}

/** The winner's own lines, plus the one written for this opponent if there is one. */
export function winLines(w: CharDef, l: CharDef) {
  const own = manifest.lines.filter((v) => v.who === w.id && v.win);
  return { any: own.filter((v) => v.win === true).map((v) => v.text), vs: own.find((v) => v.win === l.id)?.text };
}

export function pickQuote(w: CharDef, l: CharDef, rnd = Math.random) {
  const { any, vs } = winLines(w, l);
  if (vs && (rnd() < 0.5 || !any.length)) return vs;
  return any.length ? any[Math.floor(rnd() * any.length)] : FALLBACK;
}

/** Greedy word wrap to a character budget per line. */
export function wrap(s: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > max) out.push(line), (line = word);
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

let bg: HTMLCanvasElement | null = null;
function background() {
  if (bg) return bg;
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, H, '#0c0410', '#3a0810', 12);
  // light rays burst from behind the winner
  const cx = 62, cy = 70;
  for (let y = 0; y < 150; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.atan2(y - cy, x - cx);
      if (Math.floor(((a + Math.PI) / (Math.PI * 2)) * 28) % 2 === 0 && (x + y) % 2 === 0) p.set(x, y, mix(p.get(x, y), '#a02818', 0.35));
    }
  bg = p.canvas();
  return bg;
}

const FX = 14, FY = 14; // portrait frame position (winner); loser mirrors on the right

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, hi: string, lo: string) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 4, y - 4, PW + 8, PH + 8);
  ctx.fillStyle = lo;
  ctx.fillRect(x - 3, y - 3, PW + 6, PH + 6);
  ctx.fillStyle = hi;
  ctx.fillRect(x - 3, y - 3, PW + 6, 1);
  ctx.fillRect(x - 3, y - 3, 1, PH + 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, PW + 2, PH + 2);
}

export class PostMatchScene implements Scene {
  t = 0;
  e = [new Edge(), new Edge()];
  lines: string[];
  chars: number;
  winImg: HTMLCanvasElement;
  loseImg: HTMLCanvasElement;
  typed = 0;
  quote: string;

  constructor(private r: MatchResult, private next: () => void, quote?: string) {
    const { winner: w, loser: l } = r;
    this.quote = quote ?? pickQuote(w, l);
    this.lines = wrap(this.quote.toUpperCase(), 38);
    this.chars = this.lines.reduce((n, s) => n + s.length, 0);
    this.winImg = portraitFor(w.id + (r.winnerAlt ? '_alt' : ''), r.winnerAlt ? w.alt : w.look, false, w.portrait);
    this.loseImg = portraitFor(l.id + (r.loserAlt ? '_alt' : ''), r.loserAlt ? l.alt : l.look, true, l.portrait);
  }

  update() {
    this.t++;
    if (this.t === 1) playSong('victory', false);
    if (this.t === 34) sfx.hit(true);
    if (this.t === 50) say(this.quote, { pitch: 1, rate: 1 }); // the winner speaks as the text types out
    const typing = this.t > 50 && this.typed < this.chars;
    if (typing && this.t % 2 === 0) {
      this.typed++;
      if (this.typed % 2) tone({ type: 'square', freq: 520 + (this.typed % 5) * 40, dur: 0.03, vol: 0.05 });
    }
    let go = false;
    for (let i = 0; i < 2; i++) {
      const p = this.e[i].update(readPlayer(i as 0 | 1, i === 0));
      if (p.lp || p.hp || p.lk || p.hk || p.start) go = true;
    }
    if (go && this.t > 30) {
      if (this.typed < this.chars) this.typed = this.chars; // first press finishes the line
      else return this.done();
    }
    if (this.t > 600) this.done();
  }

  private done() {
    hush();
    sfx.menuPick();
    this.next();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(background(), 0, 0);
    const { winner: w, loser: l } = this.r;
    // winner slides in from the left, loser drops in from the right with a shake
    const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
    const wx = FX - (1 - ease(this.t / 24)) * 140;
    const lx = W - FX - PW + (1 - ease((this.t - 16) / 18)) * 140;
    const shake = this.t > 34 && this.t < 50 ? ((this.t & 2) - 1) * (50 - this.t) * 0.25 : 0;

    frame(ctx, wx, FY, '#ffe080', '#a06018');
    ctx.drawImage(this.winImg, Math.round(wx), FY);

    frame(ctx, lx + shake, FY, '#9090a0', '#3a3a48');
    ctx.save();
    ctx.translate(Math.round(lx + shake) + PW, FY);
    ctx.scale(-1, 1);
    ctx.drawImage(this.loseImg, 0, 0);
    ctx.restore();
    if (this.t > 34 && this.t < 40) {
      ctx.fillStyle = 'rgba(255,40,20,0.5)';
      ctx.fillRect(lx + shake, FY, PW, PH);
    }

    drawText(ctx, `${w.short} WINS`, wx + PW / 2, FY + PH + 7, '#fff', { align: 'center', outline: '#000', grad: ['#fff8c0', '#e0a020'] });
    drawText(ctx, l.short, lx + PW / 2, FY + PH + 7, '#a0a0b0', { align: 'center', outline: '#000' });
    if (this.r.fatality && this.t > 24) drawText(ctx, 'FATALITY', lx + PW / 2, FY + PH - 14, '#fff', { align: 'center', grad: ['#ff8060', '#a00000'], outline: '#000' });

    // taunt box
    const by = 158, bh = H - by - 6;
    ctx.fillStyle = '#000';
    ctx.fillRect(6, by, W - 12, bh);
    ctx.fillStyle = '#2030a0';
    ctx.fillRect(7, by + 1, W - 14, bh - 2);
    ctx.fillStyle = '#101860';
    ctx.fillRect(9, by + 3, W - 18, bh - 6);
    let left = this.typed;
    this.lines.forEach((s, i) => {
      const shown = s.slice(0, Math.max(0, left));
      left -= s.length;
      if (shown) drawText(ctx, shown, 14, by + 8 + i * 11, '#fff', { shadow: '#000' });
    });
    if (this.typed >= this.chars && this.t % 40 < 26) drawText(ctx, '>', W - 18, by + bh - 12, '#ffe060', { outline: '#000' });
  }
}
