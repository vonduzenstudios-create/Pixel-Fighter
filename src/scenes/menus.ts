import { FLOOR, H, STAGE_W, W } from '../core/consts';
import { Edge, readPlayer, RawInput } from '../core/input';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { roster, partsFor } from '../chars/roster';
import { buildBones } from '../gfx/bones';
import { sample, IDLE, VICTORY_ANIM, STANCE } from '../game/anims';
import { Stage } from '../game/stage';
import { arena, Arena, STAGES } from '../game/stages';
import { Fighter, CharDef } from '../game/fighter';
import { Fight } from '../game/fight';
import { AICtrl, DIFF_NAMES, Difficulty, HumanCtrl } from '../game/ai';
import { sfx } from '../audio/sfx';
import { playSong } from '../audio/music';
import { audioReady } from '../audio/audio';
import { drawFigure, Scene } from './common';
import { BAR, CongaLine, drawParty } from './conga';
import { PostMatchScene } from './postmatch';
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
const gridCols = (n: number) => (n <= 5 ? n : Math.ceil(n / 2));

export class SelectScene implements Scene {
  t = 0;
  cur = [0, 3];
  picked: [number | null, number | null] = [null, null];
  roulette = 0;
  /** Both fighters are chosen and the screen waits for P1 to confirm. */
  ready = false;
  e = [new Edge(), new Edge()];
  constructor(private app: App) {}

  update() {
    this.t++;
    playSong('title');
    const two = this.app.settings.players === 2;
    const n = roster().length;
    const back = this.app.back;
    this.app.back = false;
    if (this.ready) {
      // both fighters chosen: P1 confirms the matchup or backs out to change it
      const p = this.e[0].update(readPlayer(0, !two));
      if (two) this.e[1].update(readPlayer(1, false));
      if (confirm(p)) {
        sfx.menuPick();
        const ch = roster();
        this.app.go(new StageSelectScene(this.app, ch[this.picked[0]!], ch[this.picked[1]!]));
      } else if (p.back || back) {
        this.ready = false;
        this.picked[0] = null;
        if (!two) this.picked[1] = null;
        sfx.menuMove();
      }
      return;
    }
    for (let i = 0; i < (two ? 2 : 1); i++) {
      const p = this.e[i].update(readPlayer(i as 0 | 1, !two));
      if (this.picked[i] !== null) {
        if ((p.back || (i === 0 && back)) && this.roulette === 0) {
          this.picked[i] = null;
          if (!two) this.picked[1] = null;
        }
        continue;
      }
      if (p.l) (this.cur[i] = (this.cur[i] + n - 1) % n), sfx.menuMove();
      if (p.r) (this.cur[i] = (this.cur[i] + 1) % n), sfx.menuMove();
      const cols = gridCols(n);
      if ((p.u || p.d) && n > cols) {
        const c = this.cur[i] + (p.d ? cols : -cols);
        if (c >= 0 && c < n) (this.cur[i] = c), sfx.menuMove();
      }
      if (confirm(p)) {
        this.picked[i] = this.cur[i];
        sfx.menuPick();
        if (!two) this.roulette = 50;
        continue;
      }
      if (i === 0 && (p.back || back)) {
        this.app.go(new TitleScene(this.app));
        return;
      }
    }
    if (!two && this.roulette > 0) {
      this.roulette--;
      if (this.roulette % 4 === 0) {
        this.cur[1] = (this.cur[1] + 1) % n;
        sfx.menuMove();
      }
      if (this.roulette === 0) {
        this.cur[1] = Math.floor(Math.random() * n);
        this.picked[1] = this.cur[1];
        sfx.menuPick();
      }
    }
    if (this.picked[0] !== null && this.picked[1] !== null && this.roulette === 0) this.ready = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    drawText(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 10, '#fff', { scale: 2, align: 'center', grad: ['#fff4b0', '#c03010'], outline: '#000' });
    const ch = roster();
    // one row of portraits while the roster is small, two rows once it grows
    const cols = gridCols(ch.length), rows = Math.ceil(ch.length / cols), gap = rows > 1 ? 5 : 8;
    const cw = Math.min(46, Math.floor((W - 16 - gap * (cols - 1)) / cols), rows > 1 ? 30 : 46);
    const x0 = (W - (cw * cols + gap * (cols - 1))) / 2;
    ch.forEach((c, i) => {
      const x = x0 + (i % cols) * (cw + gap);
      const y0 = 34 + Math.floor(i / cols) * (cw + gap + 4);
      const hs = cw / 23;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 2, y0 - 2, cw + 4, cw + 4);
      ctx.fillStyle = '#2a1018';
      ctx.fillRect(x, y0, cw, cw);
      ctx.fillStyle = '#3a1420';
      ctx.fillRect(x, y0 + cw / 2, cw, cw / 2);
      const head = partsFor(c).head;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y0, cw, cw);
      ctx.clip();
      ctx.drawImage(head.img, 0, 0, head.img.width, head.img.height, x + cw / 2 - 11 * hs, y0 + cw - 41 * hs, head.img.width * hs, head.img.height * hs);
      ctx.restore();
      for (let pl = 0; pl < 2; pl++) {
        const show = pl === 0 || this.app.settings.players === 2 || this.roulette > 0 || this.picked[1] !== null;
        if (!show || this.cur[pl] !== i) continue;
        const both = this.cur[0] === this.cur[1];
        if (both && (this.t >> 3) % 2 !== pl) continue;
        ctx.fillStyle = pl === 0 ? '#ff3020' : '#3080ff';
        const blink = this.picked[pl] === null && this.t % 20 < 4;
        if (!blink) {
          ctx.fillRect(x - 3, y0 - 3, cw + 6, 2);
          ctx.fillRect(x - 3, y0 + cw + 1, cw + 6, 2);
          ctx.fillRect(x - 3, y0 - 3, 2, cw + 6);
          ctx.fillRect(x + cw + 1, y0 - 3, 2, cw + 6);
        }
        drawText(ctx, pl === 0 ? '1P' : this.app.settings.players === 2 ? '2P' : 'CPU', x + cw / 2, y0 + cw + 5, pl === 0 ? '#ff6040' : '#60a0ff', { align: 'center', outline: '#000' });
      }
    });
    // big previews
    for (let pl = 0; pl < 2; pl++) {
      const show = pl === 0 || this.app.settings.players === 2 || this.roulette > 0 || this.picked[1] !== null;
      if (!show) continue;
      const c = ch[this.cur[pl]];
      const x = pl === 0 ? 56 : W - 56;
      const anim = this.picked[pl] !== null ? VICTORY_ANIM : IDLE;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x - 30, 205, 60, 3);
      drawFigure(ctx, partsFor(c, pl === 1 && this.cur[0] === this.cur[1]), sample(anim, this.t), x, 205, pl === 0 ? 1 : -1);
      drawText(ctx, c.name, x, 104, '#fff', { align: 'center', outline: '#000' });
      drawText(ctx, c.title, x, 114, '#c8a070', { align: 'center' });
    }
    drawText(ctx, 'VS', W / 2, 150, '#fff', { scale: 3, align: 'center', grad: ['#ffe0a0', '#c02010'], outline: '#000' });
    if (this.ready) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W / 2 - 50, 172, 100, 26);
      if (this.t % 40 < 28) drawText(ctx, 'START: FIGHT!', W / 2, 176, '#ffe060', { align: 'center', outline: '#000' });
      drawText(ctx, 'BACK: CHANGE', W / 2, 188, '#a09080', { align: 'center' });
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
