import { Painter } from './painter';
import { Part } from './rig';
import { darken, lighten } from './palette';

// Held weapons and thrown objects. Held props hang "down" from the grip like a limb,
// so with pa=0 they extend straight out past the fist.
const OUT = '#100810';

function done(p: Painter, px: number, py: number): Part {
  p.outline(OUT);
  return { img: p.canvas(), px, py };
}

export function axe(): Part {
  const p = new Painter(16, 34);
  p.rect(7, 0, 3, 30, '#7a4a24');
  p.line(7, 0, 7, 29, '#9a6a3a');
  p.poly([[9, 21], [15, 18], [15, 32], [9, 29]], '#8c96a0');
  p.line(15, 18, 15, 32, '#e8f0f8');
  p.shade(0.15);
  return done(p, 8, 2);
}

export function sword(): Part {
  const p = new Painter(10, 40);
  p.rect(4, 0, 2, 5, '#5a3418');
  p.rect(1, 5, 8, 2, '#d8b040');
  p.poly([[3.5, 7], [6.5, 7], [6.5, 34], [5, 38], [3.5, 34]], '#c8d0dc');
  p.line(5, 8, 5, 34, '#f4f8ff');
  return done(p, 5, 2);
}

export function cutlass(): Part {
  const p = new Painter(14, 32);
  p.rect(5, 0, 2, 5, '#3a2010');
  p.ellipse(6, 5, 4, 2, '#d0a838');
  p.poly([[5, 6], [8, 6], [10, 20], [9, 28], [6, 30], [6, 20]], '#c0c8d0');
  p.line(8, 7, 9.5, 24, '#f0f4ff');
  return done(p, 6, 2);
}

export function stovepipeHat(): HTMLCanvasElement {
  const p = new Painter(17, 24);
  p.rect(2, 1, 13, 19, '#141218');
  p.rect(0, 19, 17, 3, '#141218');
  p.rect(2, 15, 13, 3, '#34303a');
  p.line(3, 2, 3, 15, '#2c2834');
  p.outline(OUT);
  return p.canvas();
}

export function fedora(): HTMLCanvasElement {
  const p = new Painter(22, 12);
  p.poly([[4, 9], [5, 3], [8, 1], [13, 1.5], [16, 3], [17, 9]], '#141218');
  p.poly([[0, 9], [21, 9], [20, 11], [1, 11]], '#141218');
  p.rect(5, 6, 12, 2, '#e8e4dc');
  p.line(9, 2, 12, 2, '#000000');
  p.outline(OUT);
  return p.canvas();
}

export function keg(): HTMLCanvasElement {
  const p = new Painter(18, 18);
  p.ellipse(9, 9, 8, 8, '#6a4222');
  for (const r of [7, 4]) p.ellipse(9, 9, r, r, r === 7 ? '#5a3618' : '#7a4c28');
  p.line(1, 9, 17, 9, '#2a2a30');
  p.line(9, 1, 9, 17, '#2a2a30');
  p.shade(0.2);
  p.outline(OUT);
  return p.canvas();
}

export function ball(r: number, base: string, glow = false): HTMLCanvasElement {
  const s = Math.ceil(r * 2 + 4);
  const p = new Painter(s, s);
  const c = s / 2;
  if (glow) p.ellipse(c, c, r + 1.5, r + 1.5, darken(base, 0.2));
  p.ellipse(c, c, r, r, base);
  p.ellipse(c - r * 0.3, c - r * 0.3, r * 0.45, r * 0.45, lighten(base, glow ? 0.7 : 0.35));
  if (!glow) p.outline(OUT);
  return p.canvas();
}

export function skull(): HTMLCanvasElement {
  const p = new Painter(9, 9);
  p.ellipse(4.5, 3.5, 3.6, 3.4, '#e8dcc0');
  p.rect(2, 5, 5, 2, '#e8dcc0');
  p.set(3, 4, '#200'); p.set(5, 4, '#200'); p.set(4, 6, '#200');
  p.outline(OUT);
  return p.canvas();
}
