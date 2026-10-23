import { H, W } from '../core/consts';
import { drawText } from '../gfx/font';
import { Painter } from '../gfx/painter';
import { sfx } from '../audio/sfx';

// Easter egg: a rare uppercut makes a tiny short-order cook pop up in the
// bottom-right corner, waving a slice of burnt toast and yelling "TOASTY!!".
const CHANCE = 0.05;
const DUR = 70;

let sprite: HTMLCanvasElement | null = null;
function cook(): HTMLCanvasElement {
  if (sprite) return sprite;
  const p = new Painter(40, 44);
  // tall paper hat with pleats
  p.rect(9, 0, 14, 10, '#f4f4f0');
  p.ellipse(16, 10, 9, 3, '#e8e8e0');
  for (const x of [12, 16, 20]) p.line(x, 1, x, 9, '#c8c8c0');
  // round face, stubble and a huge open-mouth grin
  p.ellipse(16, 20, 9, 8, '#f0b888');
  p.ellipse(16, 25, 7, 3, '#c8946c', true);
  p.rect(10, 16, 4, 1, '#3a2010');
  p.rect(18, 16, 4, 1, '#3a2010');
  p.rect(11, 18, 2, 2, '#ffffff');
  p.rect(19, 18, 2, 2, '#ffffff');
  p.set(12, 19, '#102040');
  p.set(19, 19, '#102040');
  p.ellipse(16, 24, 4, 2.5, '#5a1010');
  p.rect(13, 22, 7, 1, '#ffffff');
  p.ellipse(16, 25.5, 2, 1, '#e05050');
  p.ellipse(16, 21, 1.5, 1.5, '#e09878');
  // neckerchief and white jacket
  p.poly([[10, 28], [22, 28], [16, 32]], '#d02828');
  p.rect(6, 30, 20, 14, '#f0f0ea');
  p.line(16, 32, 16, 43, '#c8c8c0');
  p.set(14, 34, '#404040');
  p.set(14, 38, '#404040');
  p.set(18, 34, '#404040');
  p.set(18, 38, '#404040');
  // raised arm waving burnt toast
  p.capsule(26, 33, 3, 30, 22, 2.5, '#f0f0ea');
  p.ellipse(30, 20, 2.5, 2.5, '#f0b888');
  p.rect(28, 8, 11, 10, '#c08040');
  p.ellipse(33.5, 8, 5.5, 2.5, '#c08040');
  p.rect(30, 9, 7, 7, '#5a3418');
  p.set(32, 11, '#2a1408');
  p.set(35, 13, '#2a1408');
  p.shade(0.15);
  p.outline('#100810');
  return (sprite = p.canvas());
}

export class Toasty {
  t = -1;

  /** Roll the dice after a clean uppercut hit. */
  roll() {
    if (this.t >= 0 || Math.random() >= CHANCE) return;
    this.t = 0;
    sfx.toasty();
  }

  update() {
    if (this.t >= 0 && ++this.t >= DUR) this.t = -1;
  }

  reset() {
    this.t = -1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.t < 0) return;
    const t = this.t;
    // pop up fast, hold, then duck back down
    const k = t < 6 ? t / 6 : t > DUR - 8 ? (DUR - t) / 8 : 1;
    const img = cook();
    const x = W - img.width - 2, y = Math.round(H - img.height * k);
    ctx.drawImage(img, x, y);
    if (k === 1) drawText(ctx, 'TOASTY!!', W - 4, y - 9, '#fff', { align: 'right', grad: ['#fff4a0', '#e06010'], outline: '#000' });
  }
}
