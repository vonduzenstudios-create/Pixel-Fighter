import { H, W } from '../core/consts';
import { Edge, readPlayer } from '../core/input';
import { drawText, textWidth } from '../gfx/font';
import { sfx } from '../audio/sfx';
import { playSong } from '../audio/music';
import { changelog } from '../whatsnew/bundled';
import type { ChangeDay } from '../whatsnew/changelog';
import type { Scene } from './common';
import { selectBg, TitleScene, type App } from './menus';

// "What's new": the changelog as a scrolling column of day cards.

type Kind = 'date' | 'theme' | 'head' | 'body';
interface Run { x: number; y: number; s: string; kind: Kind }
interface Card { y: number; h: number; runs: Run[]; dots: number[] }

const TOP = 30, BOTTOM = H - 18; // visible strip for the cards
const CARD_X = 8, CARD_W = W - 24, PAD = 6;
const GAP = 8; // between cards
const WORD_GAP = 5;
const BACK_BTN = { x: 6, y: 8, w: 40, h: 13 };

const STYLE: Record<Kind, { color: string; bold?: boolean; italic?: boolean; line: number }> = {
  date: { color: '#ffe060', bold: true, line: 12 },
  theme: { color: '#c8a070', italic: true, line: 10 },
  head: { color: '#fff4b0', bold: true, line: 10 },
  body: { color: '#ddd', line: 10 },
};

/** Swap typographic characters for ones the pixel font has. */
const plain = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...');

const wordWidth = (w: string, k: Kind) => (STYLE[k].bold ? textWidth(w, 1, 2) + 1 : textWidth(w, 1, 1));

/** Lay out words left to right, wrapping at maxX. Returns the y below the last line. */
function flow(words: [string, Kind][], x0: number, maxX: number, y: number, out: Run[]) {
  let x = x0;
  let line = 0;
  for (const [w, k] of words) {
    const ww = wordWidth(w, k);
    if (x > x0 && x + ww > maxX) {
      x = x0;
      y += line;
    }
    line = Math.max(line, STYLE[k].line);
    out.push({ x, y, s: w, kind: k });
    x += ww + WORD_GAP;
  }
  return y + line;
}

const words = (s: string, k: Kind) => plain(s).split(/\s+/).filter(Boolean).map((w): [string, Kind] => [w, k]);

function layoutCard(day: ChangeDay, y: number): Card {
  const runs: Run[] = [];
  const dots: number[] = [];
  const x0 = CARD_X + PAD, maxX = CARD_X + CARD_W - PAD;
  let cy = flow(words(day.date, 'date'), x0, maxX, y + PAD, runs);
  if (day.theme) cy = flow(words(day.theme, 'theme'), x0, maxX, cy, runs);
  cy += 3;
  for (const it of day.items) {
    dots.push(cy);
    cy = flow([...words(it.headline, 'head'), ...words(it.text, 'body')], x0 + 8, maxX, cy, runs) + 3;
  }
  return { y, h: cy - y + PAD - 3, runs, dots };
}

function drawRun(ctx: CanvasRenderingContext2D, r: Run, dy: number) {
  const st = STYLE[r.kind];
  const y = r.y + dy;
  if (st.italic) {
    // lean the letters right by shearing around the bottom of the line
    const k = 0.25, base = y + 7;
    ctx.save();
    ctx.transform(1, 0, -k, 1, k * base, 0);
    drawText(ctx, r.s, r.x, y, st.color);
    ctx.restore();
  } else if (st.bold) {
    // faux bold: the same word twice, one pixel apart
    drawText(ctx, r.s, r.x, y, st.color, { spacing: 2 });
    drawText(ctx, r.s, r.x + 1, y, st.color, { spacing: 2 });
  } else drawText(ctx, r.s, r.x, y, st.color);
}

// Mouse wheel, click and touch drag, shared by every What's new screen.
const pointer = { wheel: 0, drag: 0, tap: null as null | { x: number; y: number }, down: false, lastY: 0, moved: 0 };
let hooked = false;
function hookPointer() {
  if (hooked) return;
  hooked = true;
  const toGame = (e: PointerEvent | WheelEvent) => {
    const cv = document.getElementById('screen');
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, scale: H / r.height };
  };
  window.addEventListener('wheel', (e) => (pointer.wheel += e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.25), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    pointer.down = true;
    pointer.lastY = e.clientY;
    pointer.moved = 0;
  });
  window.addEventListener('pointermove', (e) => {
    if (!pointer.down) return;
    const p = toGame(e);
    const d = (e.clientY - pointer.lastY) * (p?.scale ?? 1);
    pointer.lastY = e.clientY;
    pointer.drag -= d;
    pointer.moved += Math.abs(d);
  });
  window.addEventListener('pointerup', (e) => {
    pointer.down = false;
    if (pointer.moved < 4) pointer.tap = toGame(e);
  });
}

export class WhatsNewScene implements Scene {
  t = 0;
  scroll = 0;
  cards: Card[] = [];
  contentH = 0;
  e = new Edge();

  constructor(private app: App) {
    hookPointer();
    this.e.update(readPlayer(0, true)); // the button that opened this screen is not a "back" press
    pointer.wheel = pointer.drag = 0;
    pointer.tap = null;
    let y = 0;
    for (const day of changelog.days) {
      const c = layoutCard(day, y);
      this.cards.push(c);
      y += c.h + GAP;
    }
    this.contentH = Math.max(0, y - GAP);
  }

  get maxScroll() {
    return Math.max(0, this.contentH - (BOTTOM - TOP));
  }

  leave() {
    sfx.menuPick();
    this.app.go(TitleScene.at(this.app, 'options', 2));
  }

  update() {
    this.t++;
    playSong('title');
    const held = readPlayer(0, true);
    const p = this.e.update(held);
    if (p.back || p.start || this.app.back) {
      this.app.back = false;
      this.leave();
      return;
    }
    if (held.u) this.scroll -= 3;
    if (held.d) this.scroll += 3;
    // left/right jump a whole card
    if (p.l) this.scroll = [...this.cards].reverse().find((c) => c.y < this.scroll - 1)?.y ?? 0;
    if (p.r) this.scroll = this.cards.find((c) => c.y > this.scroll + 1)?.y ?? this.maxScroll;
    this.scroll += pointer.wheel + pointer.drag;
    pointer.wheel = pointer.drag = 0;
    const tap = pointer.tap;
    pointer.tap = null;
    if (tap) {
      const b = BACK_BTN;
      if (tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h) {
        this.leave();
        return;
      }
    }
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    drawText(ctx, "WHAT'S NEW", W / 2 + 10, 8, '#fff', { scale: 2, align: 'center', grad: ['#fff4b0', '#c03010'], outline: '#000' });

    const b = BACK_BTN;
    ctx.fillStyle = '#000';
    ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
    ctx.fillStyle = '#5a1420';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    drawText(ctx, '< BACK', b.x + b.w / 2, b.y + 3, '#ffe060', { align: 'center' });

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP - 2, W, BOTTOM - TOP + 4);
    ctx.clip();
    const dy = TOP - Math.round(this.scroll);
    if (!this.cards.length) drawText(ctx, 'NOTHING NEW YET', W / 2, TOP + 20, '#a09080', { align: 'center' });
    for (const c of this.cards) {
      const y = c.y + dy;
      if (y > BOTTOM || y + c.h < TOP) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(CARD_X - 2, y - 2, CARD_W + 4, c.h + 4);
      ctx.fillStyle = '#2a1018';
      ctx.fillRect(CARD_X, y, CARD_W, c.h);
      ctx.fillStyle = '#c03010';
      ctx.fillRect(CARD_X, y, 2, c.h);
      for (const d of c.dots) {
        ctx.fillStyle = '#ff4020';
        ctx.fillRect(CARD_X + PAD + 1, d + dy + 2, 3, 3);
      }
      for (const r of c.runs) if (r.y + dy < BOTTOM + 2 && r.y + dy > TOP - 12) drawRun(ctx, r, dy);
    }
    ctx.restore();

    // scroll bar
    const track = BOTTOM - TOP;
    if (this.maxScroll > 0) {
      const th = Math.max(12, (track * track) / (this.contentH || 1));
      const ty = TOP + ((track - th) * this.scroll) / this.maxScroll;
      ctx.fillStyle = '#000';
      ctx.fillRect(W - 10, TOP, 5, track);
      ctx.fillStyle = '#ffe060';
      ctx.fillRect(W - 9, Math.round(ty), 3, Math.round(th));
    }
    drawText(ctx, 'UP/DOWN SCROLL   PAD B / K / ESC BACK', W / 2, H - 11, '#806060', { align: 'center' });
  }
}
