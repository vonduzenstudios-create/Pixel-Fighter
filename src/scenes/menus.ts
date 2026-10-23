import { FLOOR, H, W } from '../core/consts';
import { Edge, readPlayer, RawInput } from '../core/input';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { roster, partsFor } from '../chars/roster';
import { buildBones } from '../gfx/bones';
import { sample, IDLE, VICTORY_ANIM, STANCE } from '../game/anims';
import { Stage } from '../game/stage';
import { Fighter, CharDef } from '../game/fighter';
import { Fight } from '../game/fight';
import { AICtrl, DIFF_NAMES, Difficulty, HumanCtrl } from '../game/ai';
import { sfx } from '../audio/sfx';
import { playSong } from '../audio/music';
import { audioReady } from '../audio/audio';
import { drawFigure, Scene } from './common';

export interface Settings {
  players: 1 | 2;
  diff: Difficulty;
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
function selectBg() {
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

  update() {
    this.t++;
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
    if (p.u) (this.sel = (this.sel + 3) % 4), sfx.menuMove();
    if (p.d) (this.sel = (this.sel + 1) % 4), sfx.menuMove();
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
      else this.app.go(new MoveListScene(this.app));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const st = this.app.stage;
    const cam = 128 + Math.sin(this.t * 0.004) * 100;
    st.draw(ctx, cam, this.t);
    const chars = roster();
    chars.forEach((c, i) => {
      const x = 52 + i * 50;
      drawFigure(ctx, partsFor(c), sample(IDLE, this.t + i * 9), x, FLOOR, i < 2 ? 1 : -1, 1, ['#0a0208', 0.82]);
    });
    st.drawFront(ctx, cam, this.t);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'PIXEL', W / 2, 22, '#fff', { scale: 4, align: 'center', grad: ['#fff4b0', '#b02010'], outline: '#100', shadow: '#000' });
    drawText(ctx, 'FIGHTER', W / 2, 56, '#fff', { scale: 4, align: 'center', grad: ['#f0f0ff', '#8a0010'], outline: '#100', shadow: '#000' });
    drawText(ctx, 'A 16-BIT STYLE TECH DEMO', W / 2, 92, '#c8a070', { align: 'center' });
    if (!this.menu) {
      if (this.t % 50 < 34) drawText(ctx, 'PRESS START', W / 2, 140, '#fff', { scale: 2, align: 'center', outline: '#000' });
    } else {
      const s = this.app.settings;
      const items = ['1 PLAYER VS CPU', '2 PLAYERS', `CPU: < ${DIFF_NAMES[s.diff]} >`, 'MOVE LIST'];
      items.forEach((it, i) => {
        const y = 120 + i * 14;
        const on = i === this.sel;
        drawText(ctx, it, W / 2, y, on ? '#ffe060' : '#a09080', { align: 'center', outline: '#000' });
        if (on) drawText(ctx, '>', W / 2 - 64, y, '#ff4020', { outline: '#000' });
      });
    }
    if (!audioReady()) drawText(ctx, 'CLICK OR PRESS ANY KEY FOR SOUND', W / 2, H - 12, '#806060', { align: 'center' });
    else drawText(ctx, 'ALL ART AND AUDIO GENERATED IN CODE', W / 2, H - 12, '#806060', { align: 'center' });
  }
}

// ------------------------------------------------------------------ Character select
export class SelectScene implements Scene {
  t = 0;
  cur = [0, 3];
  picked: [number | null, number | null] = [null, null];
  roulette = 0;
  e = [new Edge(), new Edge()];
  constructor(private app: App) {}

  update() {
    this.t++;
    playSong('title');
    const two = this.app.settings.players === 2;
    const n = roster().length;
    const back = this.app.back;
    this.app.back = false;
    for (let i = 0; i < (two ? 2 : 1); i++) {
      const p = this.e[i].update(readPlayer(i as 0 | 1, !two));
      if (this.picked[i] !== null) {
        if (cancel(p, this.app) && this.roulette === 0) this.picked[i] = null;
        continue;
      }
      if (p.l) (this.cur[i] = (this.cur[i] + n - 1) % n), sfx.menuMove();
      if (p.r) (this.cur[i] = (this.cur[i] + 1) % n), sfx.menuMove();
      if (confirm(p)) {
        this.picked[i] = this.cur[i];
        sfx.menuPick();
        if (!two) this.roulette = 50;
      }
      if (i === 0 && (p.back || back) && this.picked[0] === null) {
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
    if (this.picked[0] !== null && this.picked[1] !== null && this.roulette === 0) {
      const ch = roster();
      this.app.go(new VersusScene(this.app, ch[this.picked[0]], ch[this.picked[1]]));
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    drawText(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 10, '#fff', { scale: 2, align: 'center', grad: ['#fff4b0', '#c03010'], outline: '#000' });
    const ch = roster();
    const cw = 46, gap = 8, x0 = (W - (cw * 4 + gap * 3)) / 2, y0 = 34;
    ch.forEach((c, i) => {
      const x = x0 + i * (cw + gap);
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
      ctx.drawImage(head.img, 0, 0, head.img.width, head.img.height, x + cw / 2 - 22, y0 + cw - 82, head.img.width * 2, head.img.height * 2);
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
  }
}

// ------------------------------------------------------------------ Versus splash, then the fight
export class VersusScene implements Scene {
  t = 0;
  constructor(private app: App, private a: CharDef, private b: CharDef) {}
  update() {
    this.t++;
    if (this.t === 1) sfx.gong();
    if (this.t >= 130) this.app.go(new FightScene(this.app, this.a, this.b));
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(selectBg(), 0, 0);
    const slide = Math.max(0, 30 - this.t) * 6;
    drawFigure(ctx, partsFor(this.a), STANCE, 64 - slide, 196, 1, 2);
    drawFigure(ctx, partsFor(this.b, this.a === this.b), STANCE, W - 64 + slide, 196, -1, 2);
    drawText(ctx, this.a.name, 64, 14, '#fff', { align: 'center', scale: 1, outline: '#000' });
    drawText(ctx, this.b.name, W - 64, 14, '#fff', { align: 'center', scale: 1, outline: '#000' });
    if (this.t > 25) drawText(ctx, 'VS', W / 2, 90, '#fff', { scale: 4, align: 'center', grad: ['#fff0a0', '#d01010'], outline: '#000', shadow: '#000' });
    drawText(ctx, 'THE THORN GORGE', W / 2, H - 14, '#c8a070', { align: 'center' });
  }
}

let bonesCache: ReturnType<typeof buildBones> | null = null;
export const bonesParts = () => (bonesCache ??= buildBones());

export class FightScene implements Scene {
  fight: Fight;
  constructor(private app: App, a: CharDef, b: CharDef) {
    const two = app.settings.players === 2;
    const bones = bonesParts();
    const f1 = new Fighter(a, partsFor(a), bones, new HumanCtrl(0, !two), 0);
    const f2 = new Fighter(b, partsFor(b, a === b), bones, two ? new HumanCtrl(1, false) : new AICtrl(app.settings.diff), 1);
    this.fight = new Fight([f1, f2], app.stage, [true, two], () => app.go(new SelectScene(app)));
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
