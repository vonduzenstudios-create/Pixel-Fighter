import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { Edge, readPlayer, RawInput } from '../core/input';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { roster, partsFor } from '../chars/roster';
import { buildBones } from '../gfx/bones';
import { sample, IDLE, VICTORY_ANIM, STANCE } from '../game/anims';
import { Stage } from '../stages/gorge/stage';
import { arena, Arena, STAGES } from '../game/stages';
import { Fighter, CharDef } from '../game/fighter';
import { Fight } from '../game/fight';
import { AICtrl, DIFF_NAMES, Difficulty, HumanCtrl } from '../game/ai';
import { sfx } from '../audio/sfx';
import { playSong } from '../audio/music';
import { audioReady } from '../audio/audio';
import { drawFigure, Scene, tallness } from './common';
import { BAR, CongaLine, drawParty } from './conga';
import { PostMatchScene } from './postmatch';
import { paintSet } from './sets';
import { WhatsNewScene } from './whatsnew';

export interface Settings {
  players: 1 | 2;
  diff: Difficulty;
  stage: number; // index into STAGES, remembered between matches
}

export interface App {
  settings: Settings;
  go(s: Scene): void;
  stage: Stage;
  back: boolean; // set by Escape key
}

const confirm = (p: RawInput) => p.lp || p.hp || p.start;
const cancel = (p: RawInput, app: App) => p.back || app.back;

let bg: HTMLCanvasElement | null = null;
export function selectBg() {
  if (bg) return bg;
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, H, '#1a0610', '#3a0a10', 10);
  for (let y = 0; y < H; y += 2) for (let x = (y / 2) % 2; x < W; x += 4) p.set(x, y, '#2a0812');
  bg = p.canvas();
  return bg;
}

// ------------------------------------------------------------------ Title
export class TitleScene implements Scene {
  t = 0;
  menu = false;
  sel = 0;
  e = new Edge();
  constructor(private app: App) {}

  conga = new CongaLine();

  update() {
    this.t++;
    this.conga.update();
    if (audioReady()) playSong('title');
    const p = this.e.update(readPlayer(0, true));
    const back = this.app.back;
    this.app.back = false;
    if (!this.menu) {
      if (confirm(p) || p.back) {
        this.menu = true;
        sfx.menuPick();
      }
      return;
    }
    if (back) {
      this.menu = false;
      return;
    }
    if (p.u) (this.sel = (this.sel + 4) % 5), sfx.menuMove();
    if (p.d) (this.sel = (this.sel + 1) % 5), sfx.menuMove();
    const s = this.app.settings;
    if (this.sel === 2 && (p.l || p.r)) {
      s.diff = ((s.diff + (p.r ? 1 : 2)) % 3) as Difficulty;
      sfx.menuMove();
    }
    if (confirm(p)) {
      sfx.menuPick();
      if (this.sel === 0 || this.sel === 1) {
        s.players = this.sel === 0 ? 1 : 2;
        this.app.go(new SelectScene(this.app));
      } else if (this.sel === 2) s.diff = ((s.diff + 1) % 3) as Difficulty;
      else if (this.sel === 3) this.app.go(new MoveListScene(this.app));
      else this.app.go(new WhatsNewScene(this.app));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // bright party backdrop, no darkening: the conga line is the show
    drawParty(ctx, this.t);
    this.conga.draw(ctx, this.t);
    const bob = Math.round(Math.abs(Math.sin((this.t / BAR) * Math.PI * 4)) * 2);
    drawText(ctx, 'PIXEL', W / 2, 14 - bob, '#fff', { scale: 4, align: 'center', grad: ['#fff4b0', '#e02a10'], outline: '#2a0030', shadow: '#2a0030' });
    drawText(ctx, 'FIGHTER', W / 2, 46 - bob, '#fff', { scale: 4, align: 'center', grad: ['#ffffff', '#9a10c0'], outline: '#2a0030', shadow: '#2a0030' });
    drawText(ctx, 'A 16-BIT STYLE TECH DEMO', W / 2, 80, '#fff', { align: 'center', outline: '#5a1070' });
    if (!this.menu) {
      if (this.t % 50 < 34) drawText(ctx, 'PRESS START', W / 2, 98, '#fff', { scale: 2, align: 'center', grad: ['#ffffff', '#ffe060'], outline: '#2a0030' });
    } else {
      const s = this.app.settings;
      const items = ['1 PLAYER VS CPU', '2 PLAYERS', `CPU: < ${DIFF_NAMES[s.diff]} >`, 'MOVE LIST', "WHAT'S NEW"];
      // a framed card for the menu so it reads over the dancers without dimming the scene
      const bx = W / 2 - 74, by = 92, bw = 148, bh = items.length * 12 + 10;
      ctx.fillStyle = '#2a0030';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#ff5cc8';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#3a0a50';
      ctx.fillRect(bx, by, bw, bh);
      items.forEach((it, i) => {
        const y = by + 6 + i * 12;
        const on = i === this.sel;
        drawText(ctx, it, W / 2, y, on ? '#ffe060' : '#d8b8e8', { align: 'center', outline: '#000' });
        if (on) drawText(ctx, '>', bx + 6, y, '#5ce0ff', { outline: '#000' });
      });
    }
    const foot = audioReady() ? 'ALL ART AND AUDIO GENERATED IN CODE' : 'CLICK OR PRESS ANY KEY FOR SOUND';
    drawText(ctx, foot, W / 2, H - 10, '#fff', { align: 'center', outline: '#5a1070' });
  }
}

// ------------------------------------------------------------------ Character select
/** Roster tiles sit in two rows and scroll sideways, so the roster can grow without limit. */
const ROWS = 2;
const TILE_W = 32, TILE_H = 40, TILE_GAP = 3, GRID_Y = 129;
const GRID_COLS = Math.floor((W - 10 + TILE_GAP) / (TILE_W + TILE_GAP));
const GRID_X = Math.round((W - (GRID_COLS * (TILE_W + TILE_GAP) - TILE_GAP)) / 2);
const PANEL_W = 118, PANEL_H = 86, PANEL_Y = 14;
const P_COL = ['#ff3a28', '#3a8cff'];
const P_LIGHT = ['#ff8a70', '#8ac0ff'];
/** Cursor positions are remembered between visits to the screen. */
const lastCur = [0, 3];

let selBg: HTMLCanvasElement | null = null;
function selectSceneBg() {
  if (selBg) return selBg;
  const p = new Painter(W, H);
  p.gradRect(0, 0, W, H, '#0c0a1c', '#1c0c24', 12);
  // faint diagonal speed stripes
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y * 2) % 24 < 2) p.set(x, y, '#1a1430');
  selBg = p.canvas();
  return selBg;
}

export class SelectScene implements Scene {
  t = 0;
  cur = [...lastCur];
  picked: [number | null, number | null] = [null, null];
  /** Both fighters are chosen and the screen waits for P1 to confirm. */
  ready = false;
  /** Leftmost visible roster column, eased toward the cursor. */
  scroll = 0;
  e = [new Edge(), new Edge()];
  constructor(private app: App) {
    const n = roster().length;
    this.cur = this.cur.map((c) => Math.min(c, n - 1));
    this.scroll = this.targetScroll();
  }

  get two() {
    return this.app.settings.players === 2;
  }
  /** In 1 player mode P1 picks their fighter first, then the CPU's opponent. */
  get choosingCpu() {
    return !this.two && this.picked[0] !== null && this.picked[1] === null;
  }

  private move(i: number, p: RawInput, n: number) {
    const cols = Math.ceil(n / ROWS);
    let col = Math.floor(this.cur[i] / ROWS), row = this.cur[i] % ROWS;
    const was = this.cur[i];
    if (p.l) col = (col + cols - 1) % cols;
    if (p.r) col = (col + 1) % cols;
    if (p.u || p.d) row = (row + (p.d ? 1 : ROWS - 1)) % ROWS;
    this.cur[i] = Math.min(n - 1, col * ROWS + row);
    if (this.cur[i] !== was) sfx.menuMove();
  }

  private targetScroll() {
    const cols = Math.ceil(roster().length / ROWS);
    const max = Math.max(0, cols - GRID_COLS);
    // keep whichever cursors are active in view, favouring the one that is moving
    const active = this.two ? [0, 1] : [this.choosingCpu || this.picked[1] !== null ? 1 : 0];
    let lo = this.scroll;
    for (const i of active) {
      const c = Math.floor(this.cur[i] / ROWS);
      if (c < lo) lo = c;
      if (c > lo + GRID_COLS - 1) lo = c - GRID_COLS + 1;
    }
    return Math.max(0, Math.min(max, Math.round(lo)));
  }

  update() {
    this.t++;
    playSong('title');
    const two = this.two;
    const n = roster().length;
    const back = this.app.back;
    this.app.back = false;
    this.scroll += (this.targetScroll() - this.scroll) * 0.25;
    if (Math.abs(this.targetScroll() - this.scroll) < 0.01) this.scroll = this.targetScroll();
    if (this.ready) {
      // both fighters chosen: P1 confirms the matchup or backs out to change it
      const p = this.e[0].update(readPlayer(0, !two));
      if (two) this.e[1].update(readPlayer(1, false));
      if (confirm(p)) {
        sfx.menuPick();
        const ch = roster();
        lastCur[0] = this.cur[0], lastCur[1] = this.cur[1];
        this.app.go(new StageSelectScene(this.app, ch[this.picked[0]!], ch[this.picked[1]!]));
      } else if (p.back || back) {
        this.ready = false;
        // 1P backs up one step (to the opponent pick); in 2P both players pick again
        if (two) this.picked[0] = null;
        else this.picked[1] = null;
        sfx.menuMove();
      }
      return;
    }
    if (!two) {
      // one pad drives both cursors: first your fighter, then the CPU's
      const p = this.e[0].update(readPlayer(0, true));
      const i = this.choosingCpu ? 1 : 0;
      if (confirm(p)) {
        this.picked[i] = this.cur[i];
        sfx.menuPick();
      } else if (p.back || back) {
        if (i === 1) (this.picked[0] = null), sfx.menuMove();
        else return this.app.go(new TitleScene(this.app));
      } else this.move(i, p, n);
    } else {
      for (let i = 0; i < 2; i++) {
        const p = this.e[i].update(readPlayer(i as 0 | 1, false));
        if (this.picked[i] !== null) {
          if (p.back || (i === 0 && back)) this.picked[i] = null;
          continue;
        }
        if (confirm(p)) {
          this.picked[i] = this.cur[i];
          sfx.menuPick();
          continue;
        }
        if (i === 0 && (p.back || back)) return this.app.go(new TitleScene(this.app));
        this.move(i, p, n);
      }
    }
    if (this.picked[0] !== null && this.picked[1] !== null) this.ready = true;
  }

  /** Is player pl's cursor shown (the CPU cursor appears once P1 has picked)? */
  private shows(pl: number) {
    return pl === 0 || this.two || this.picked[0] !== null;
  }

  private drawPanel(ctx: CanvasRenderingContext2D, pl: number) {
    const ch = roster();
    const x = pl === 0 ? 6 : W - 6 - PANEL_W, y = PANEL_Y;
    const col = P_COL[pl];
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, PANEL_W + 4, PANEL_H + 4);
    ctx.fillStyle = col;
    ctx.fillRect(x - 1, y - 1, PANEL_W + 2, PANEL_H + 2);
    const tag = pl === 0 ? '1P' : this.two ? '2P' : 'CPU';
    if (!this.shows(pl)) {
      // empty slot waiting for P1 to pick
      ctx.fillStyle = '#100c1c';
      ctx.fillRect(x, y, PANEL_W, PANEL_H);
      drawText(ctx, '?', x + PANEL_W / 2, y + 30, '#3a3050', { scale: 4, align: 'center' });
      drawText(ctx, tag, x + 4, y + 3, P_LIGHT[pl], { outline: '#000' });
      return;
    }
    const c = ch[this.cur[pl]];
    const feet = paintSet(ctx, c, x, y, PANEL_W, PANEL_H, this.t);
    const picked = this.picked[pl] !== null;
    const anim = picked ? VICTORY_ANIM : IDLE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, PANEL_W, PANEL_H);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + PANEL_W / 2 - 18, feet - 1, 36, 3);
    const parts = partsFor(c, pl === 1 && this.cur[0] === this.cur[1]);
    const sc = Math.min(1, (c.scale ?? 1) * 0.88) / tallness(parts);
    drawFigure(ctx, parts, sample(anim, this.t), x + PANEL_W / 2, feet, pl === 0 ? 1 : -1, sc);
    ctx.restore();
    // name plate
    const py = y + PANEL_H + 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, py, PANEL_W + 4, 20);
    ctx.fillStyle = picked ? col : '#1e1830';
    ctx.fillRect(x - 1, py + 1, PANEL_W + 2, 18);
    drawText(ctx, c.name.toUpperCase(), x + PANEL_W / 2, py + 2, '#fff', { align: 'center', outline: '#000' });
    const title = c.title.toUpperCase();
    drawText(ctx, title, x + PANEL_W / 2, py + 11, picked ? '#ffffff' : '#c8b088', { align: 'center', spacing: title.length > 19 ? 0 : 1 });
    // player tag chip
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, tag.length * 6 + 5, 11);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, tag.length * 6 + 4, 10);
    drawText(ctx, tag, x + 2, y + 1, '#fff');
    if (picked) drawText(ctx, 'READY', x + PANEL_W - 3, y + 3, '#fff', { align: 'right', outline: '#000' });
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectSceneBg(), 0, 0);
    const ch = roster();
    const n = ch.length;
    // header
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 11);
    const head = this.choosingCpu ? 'CHOOSE YOUR OPPONENT' : this.ready ? 'READY TO FIGHT' : 'CHOOSE YOUR FIGHTER';
    drawText(ctx, head, 6, 2, '#fff', { grad: ['#fff4b0', '#ff7030'] });
    drawText(ctx, this.two ? '1P VS 2P' : '1P VS CPU', W - 6, 2, '#9a90b8', { align: 'right' });

    for (let pl = 0; pl < 2; pl++) this.drawPanel(ctx, pl);
    // VS badge between the panels
    const vy = PANEL_Y + PANEL_H / 2 - 10;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(W / 2, vy + 10, 13, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, 'VS', W / 2, vy + 3, '#fff', { scale: 2, align: 'center', grad: ['#ffe0a0', '#e02010'], outline: '#000' });

    // roster strip
    const step = TILE_W + TILE_GAP;
    const cols = Math.ceil(n / ROWS);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, GRID_Y - 4, W, ROWS * (TILE_H + TILE_GAP) + 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID_X - 3, GRID_Y - 4, GRID_COLS * step + 3, ROWS * (TILE_H + TILE_GAP) + 5);
    ctx.clip();
    ch.forEach((c, i) => {
      const col = Math.floor(i / ROWS), row = i % ROWS;
      const x = Math.round(GRID_X + (col - this.scroll) * step), y = GRID_Y + row * (TILE_H + TILE_GAP);
      if (x < -TILE_W || x > W) return;
      const on = [0, 1].filter((pl) => this.shows(pl) && this.cur[pl] === i);
      const lift = on.length ? 1 : 0;
      const ty = y - lift;
      const feet = paintSet(ctx, c, x, ty, TILE_W, TILE_H, this.t + i * 17);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, ty, TILE_W, TILE_H);
      ctx.clip();
      const sc = (0.4 * Math.min(1.15, c.scale ?? 1)) / tallness(partsFor(c));
      drawFigure(ctx, partsFor(c), on.length ? sample(IDLE, this.t + i * 9) : STANCE, x + TILE_W / 2, feet, row === 0 ? 1 : -1, sc);
      if (!on.length) {
        ctx.fillStyle = 'rgba(8,6,20,0.38)';
        ctx.fillRect(x, ty, TILE_W, TILE_H);
      }
      ctx.restore();
      // frame: player colours on hovered tiles, flicking between the two when both are on it
      let frame = '#2a2440';
      if (on.length) {
        const pl = on.length === 2 ? (this.t >> 3) % 2 : on[0];
        const blink = this.picked[pl] === null && this.t % 24 < 4;
        frame = blink ? '#ffffff' : P_COL[pl];
      }
      ctx.fillStyle = frame;
      ctx.fillRect(x - 1, ty - 1, TILE_W + 2, 1);
      ctx.fillRect(x - 1, ty + TILE_H, TILE_W + 2, 1);
      ctx.fillRect(x - 1, ty - 1, 1, TILE_H + 2);
      ctx.fillRect(x + TILE_W, ty - 1, 1, TILE_H + 2);
      on.forEach((pl, k) => {
        const tag = pl === 0 ? '1P' : this.two ? '2P' : 'CPU';
        const tw = tag.length * 6 + 1;
        const tx = k === 0 ? x : x + TILE_W - tw;
        ctx.fillStyle = P_COL[pl];
        ctx.fillRect(tx, ty + TILE_H - 8, tw, 8);
        drawText(ctx, tag, tx + 1, ty + TILE_H - 8, '#fff');
      });
    });
    ctx.restore();
    // scroll arrows and position dots once the roster is wider than the screen
    if (cols > GRID_COLS) {
      const ay = GRID_Y + TILE_H - 3, pulse = this.t % 30 < 15 ? '#ffa060' : '#ff5030';
      if (this.scroll > 0.05) drawText(ctx, '<', 0, ay, pulse, { outline: '#000' });
      if (this.scroll < cols - GRID_COLS - 0.05) drawText(ctx, '>', W - 6, ay, pulse, { outline: '#000' });
      const pages = cols - GRID_COLS + 1, dy = H - 4;
      const dw = Math.min(6, Math.floor(120 / pages));
      const dx = W / 2 - (pages * dw) / 2;
      for (let k = 0; k < pages; k++) {
        ctx.fillStyle = Math.round(this.scroll) === k ? '#ffe060' : '#3a3450';
        ctx.fillRect(Math.round(dx + k * dw), dy, dw - 2, 2);
      }
    }
    if (this.ready) {
      // banner across the roster strip
      const by = GRID_Y + TILE_H - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(0, by, W, 20);
      ctx.fillStyle = '#ffe060';
      ctx.fillRect(0, by, W, 1);
      ctx.fillRect(0, by + 19, W, 1);
      if (this.t % 40 < 28) drawText(ctx, 'START: FIGHT!', W / 2 - 8, by + 7, '#ffe060', { align: 'right', outline: '#000' });
      drawText(ctx, 'BACK: CHANGE', W / 2 + 8, by + 7, '#a09080');
    }
  }
}

// ------------------------------------------------------------------ Stage select
export class StageSelectScene implements Scene {
  t = 0;
  e = new Edge();
  constructor(private app: App, private a: CharDef, private b: CharDef) {}

  get cur() {
    return arena(this.app.settings.stage, bonesParts());
  }

  update() {
    this.t++;
    playSong('title');
    const s = this.app.settings;
    const n = STAGES.length;
    const p = this.e.update(readPlayer(0, this.app.settings.players === 1));
    if (p.l) (s.stage = (s.stage + n - 1) % n), sfx.menuMove();
    if (p.r) (s.stage = (s.stage + 1) % n), sfx.menuMove();
    if (confirm(p)) {
      sfx.menuPick();
      this.app.go(new VersusScene(this.app, this.a, this.b, this.cur));
    } else if (cancel(p, this.app)) {
      this.app.back = false;
      this.app.go(new SelectScene(this.app));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const st = this.cur;
    // pan across the whole floor, however wide the stage is
    const half = ((st.width ?? STAGE_W) - W) / 2;
    const cam = half + Math.sin(this.t * 0.01) * (half - 18);
    st.draw(ctx, cam, this.t);
    st.drawFront(ctx, cam, this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, 34);
    ctx.fillRect(0, H - 44, W, 44);
    drawText(ctx, 'SELECT STAGE', W / 2, 10, '#fff', { scale: 2, align: 'center', grad: ['#fff4b0', '#c03010'], outline: '#000' });
    const pulse = this.t % 30 < 15 ? '#ff4020' : '#ffa060';
    drawText(ctx, '<', 10, H - 30, pulse, { scale: 2, outline: '#000' });
    drawText(ctx, '>', W - 20, H - 30, pulse, { scale: 2, outline: '#000' });
    drawText(ctx, st.name, W / 2, H - 32, '#ffe060', { align: 'center', outline: '#000' });
    drawText(ctx, `${this.app.settings.stage + 1} / ${STAGES.length}`, W / 2, H - 20, '#a09080', { align: 'center' });
    if (st.blurb) drawText(ctx, st.blurb, W / 2, H - 10, '#c8a070', { align: 'center' });
  }
}

// ------------------------------------------------------------------ Versus splash, then the fight
export class VersusScene implements Scene {
  t = 0;
  constructor(private app: App, private a: CharDef, private b: CharDef, private stage: Arena) {}
  update() {
    this.t++;
    if (this.t === 1) sfx.gong();
    if (this.t >= 130) this.app.go(new FightScene(this.app, this.a, this.b, this.stage));
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    const slide = Math.max(0, 30 - this.t) * 6;
    drawFigure(ctx, partsFor(this.a), STANCE, 64 - slide, 196, 1, 2);
    drawFigure(ctx, partsFor(this.b, this.a === this.b), STANCE, W - 64 + slide, 196, -1, 2);
    drawText(ctx, this.a.name, 64, 14, '#fff', { align: 'center', scale: 1, outline: '#000' });
    drawText(ctx, this.b.name, W - 64, 14, '#fff', { align: 'center', scale: 1, outline: '#000' });
    if (this.t > 25) drawText(ctx, 'VS', W / 2, 90, '#fff', { scale: 4, align: 'center', grad: ['#fff0a0', '#d01010'], outline: '#000', shadow: '#000' });
    drawText(ctx, this.stage.name, W / 2, H - 14, '#c8a070', { align: 'center' });
  }
}

let bonesCache: ReturnType<typeof buildBones> | null = null;
export const bonesParts = () => (bonesCache ??= buildBones());

export class FightScene implements Scene {
  fight: Fight;
  constructor(private app: App, a: CharDef, b: CharDef, stage: Arena = app.stage) {
    const two = app.settings.players === 2;
    const bones = bonesParts();
    const f1 = new Fighter(a, partsFor(a), bones, new HumanCtrl(0, !two), 0);
    const f2 = new Fighter(b, partsFor(b, a === b), bones, two ? new HumanCtrl(1, false) : new AICtrl(app.settings.diff), 1);
    this.fight = new Fight([f1, f2], stage, [true, two], (w) => {
      const l = w === f1 ? f2 : f1;
      const alt = (f: Fighter) => f === f2 && a === b;
      const result = { winner: w.ch, loser: l.ch, winnerAlt: alt(w), loserAlt: alt(l), fatality: this.fight.hadFatality };
      app.go(new PostMatchScene(result, () => app.go(new SelectScene(app))));
    });
  }
  update() {
    this.fight.update();
  }
  draw(ctx: CanvasRenderingContext2D) {
    this.fight.draw(ctx);
  }
}

// ------------------------------------------------------------------ Move list
export class MoveListScene implements Scene {
  i = 0;
  t = 0;
  e = new Edge();
  constructor(private app: App) {}
  update() {
    this.t++;
    const p = this.e.update(readPlayer(0, true));
    const n = roster().length;
    if (p.l) (this.i = (this.i + n - 1) % n), sfx.menuMove();
    if (p.r) (this.i = (this.i + 1) % n), sfx.menuMove();
    if (p.back || p.start || this.app.back) {
      this.app.back = false;
      this.app.go(new TitleScene(this.app));
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    const c = roster()[this.i];
    drawText(ctx, `< ${c.name} >`, W / 2, 8, '#fff', { scale: 2, align: 'center', grad: ['#fff4b0', '#c03010'], outline: '#000' });
    drawFigure(ctx, partsFor(c), sample(IDLE, this.t), 30, 120, 1);
    let y = 34;
    const row = (a: string, b: string, ca = '#ddd', cb = '#8cf') => {
      drawText(ctx, a, 60, y, ca);
      drawText(ctx, b, W - 8, y, cb, { align: 'right' });
      y += 10;
    };
    drawText(ctx, 'SPECIAL MOVES', 60, y, '#e0c050');
    y += 11;
    for (const sp of c.specials) row(sp.name, sp.text);
    y += 4;
    drawText(ctx, 'FINISHING MOVE (WHEN THEY ARE DAZED)', 60, y, '#f66');
    y += 11;
    row(c.finisher.name, '', '#f99');
    row('', c.finisher.text, '#f99', '#f99');
    row('PIT DROP (STAGE)', 'D + HP NEAR THEM', '#f99', '#f99');
    y += 4;
    drawText(ctx, 'BASIC MOVES', 60, y, '#e0c050');
    y += 11;
    row('UPPERCUT (LAUNCH)', 'D + HP');
    row('ROUNDHOUSE (LAUNCH)', 'B + HK');
    row('SWEEP / JUDO THROW', 'B + LK / F + LP');
    row('CROUCH ATTACKS', 'D + LP / LK / HK');
    drawText(ctx, 'KEYS: WASD MOVE  U I = LP HP  J K = LK HK  L = BLOCK', W / 2, H - 30, '#a09080', { align: 'center' });
    drawText(ctx, 'PAD: A X = LP HP  B Y = LK HK  L R = BLOCK', W / 2, H - 20, '#a09080', { align: 'center' });
    drawText(ctx, 'PAD B / K / ESC TO GO BACK', W / 2, H - 10, '#806060', { align: 'center' });
  }
}
