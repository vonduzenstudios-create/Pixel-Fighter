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

export function nunchaku(): Part {
  // two lacquered sticks joined by a short chain; the swinging stick hangs past the fist
  const p = new Painter(8, 31);
  p.rect(3, 0, 3, 11, '#2a1a10');
  p.line(3, 1, 3, 10, '#5a3a20');
  for (const y of [12, 14, 16]) p.set(4, y, '#a8acb4');
  for (const y of [13, 15]) p.set(5, y, '#70747c');
  p.rect(3, 17, 3, 12, '#2a1a10');
  p.line(3, 18, 3, 28, '#5a3a20');
  p.rect(3, 22, 3, 1, '#c8a040');
  return done(p, 4, 2);
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

/** Oversized novelty cheque, held by its top edge. */
export function bigCheck(): Part {
  const p = new Painter(16, 36);
  p.rect(1, 2, 14, 32, '#e8f0d8');
  p.rect(1, 2, 14, 3, '#3a8a4a');
  p.line(3, 9, 12, 9, '#9ab08a');
  p.line(3, 14, 12, 14, '#9ab08a');
  p.line(3, 27, 9, 27, '#2a3a60');
  p.line(4, 26, 8, 28, '#2a3a60');
  // "$" box
  p.rect(9, 18, 5, 6, '#d8e8c0');
  p.line(11, 18, 11, 23, '#2a7a3a');
  p.line(10, 19, 12, 19, '#2a7a3a');
  p.line(10, 21, 12, 21, '#2a7a3a');
  p.line(10, 23, 12, 23, '#2a7a3a');
  p.rect(6, 0, 4, 3, '#5a3418');
  return done(p, 8, 1);
}

/** A banded brick of bank notes. */
export function cashBrick(): HTMLCanvasElement {
  const p = new Painter(16, 10);
  p.rect(1, 2, 14, 7, '#3e8a4a');
  p.line(1, 2, 14, 2, '#8ad08a');
  p.line(1, 5, 14, 5, '#2a6a36');
  p.rect(6, 1, 4, 9, '#f0e8c8');
  p.set(7, 4, '#c09030'); p.set(8, 5, '#c09030');
  p.outline(OUT);
  return p.canvas();
}

export function bill(): HTMLCanvasElement {
  const p = new Painter(7, 4);
  p.rect(0, 0, 7, 4, '#5aa060');
  p.rect(1, 1, 5, 2, '#8ad08a');
  p.set(3, 1, '#2a6a36'); p.set(3, 2, '#2a6a36');
  return p.canvas();
}

export function musicNote(color = '#ffe8a0'): HTMLCanvasElement {
  const p = new Painter(7, 9);
  p.ellipse(2, 7, 2, 1.5, color);
  p.line(4, 1, 4, 7, color);
  p.line(4, 1, 6, 3, color);
  p.outline(OUT);
  return p.canvas();
}

export function brush(): Part {
  // long-handled fan brush with a green-loaded tip
  const p = new Painter(10, 31);
  p.rect(4, 0, 2, 18, '#c08a48');
  p.line(4, 0, 4, 17, '#e0b070');
  p.rect(3, 18, 4, 3, '#b8bcc8');
  p.poly([[3, 21], [7, 21], [9.5, 29], [0.5, 29]], '#ece4d0');
  p.poly([[1.5, 26], [8.5, 26], [9.5, 29], [0.5, 29]], '#2e6a34');
  return done(p, 5, 2);
}

export function paletteKnife(): Part {
  const p = new Painter(10, 32);
  p.rect(4, 0, 2, 10, '#6a3a1a');
  p.line(5, 10, 5, 14, '#8a8e98');
  p.poly([[5, 14], [8, 20], [6.5, 31], [5, 31], [3.5, 20]], '#c8d0dc');
  p.line(5, 15, 5, 30, '#f4f8ff');
  return done(p, 5, 2);
}

/** A tidy little evergreen, 20x40, base at the bottom centre. */
export function pineTree(): HTMLCanvasElement {
  const p = new Painter(20, 40);
  p.rect(8, 31, 4, 9, '#5a3a1e');
  const greens = ['#1e4a24', '#2a6230', '#3a7a38'];
  for (let i = 0; i < 4; i++) {
    const top = 2 + i * 7, w = 3.5 + i * 2.2;
    p.poly([[10, top], [10 + w, top + 11], [10 - w, top + 11]], greens[i % 3]);
  }
  p.shade(0.2);
  for (const [x, y] of [[9, 8], [12, 15], [7, 22], [13, 28], [10, 34 - 10]]) p.set(x, y, '#e8f4e0');
  p.outline(OUT);
  return p.canvas();
}

/** Pharaoh's crook: a gold-and-blue banded staff with a hooked head. */
export function crook(): Part {
  const p = new Painter(10, 30);
  p.rect(4, 0, 2, 25, '#d8b040');
  for (let y = 2; y < 24; y += 4) p.rect(4, y, 2, 2, '#1c3a9a');
  p.rect(4, 24, 2, 2, '#d8b040');
  p.line(5, 26, 7, 28, '#d8b040');
  p.line(7, 28, 9, 26, '#d8b040');
  p.line(9, 26, 9, 23, '#d8b040');
  return done(p, 5, 2);
}

/** A sacred scarab beetle seen from above, head toward +x. */
export function scarab(glow = false): HTMLCanvasElement {
  const p = new Painter(10, 9);
  const shell = glow ? '#40d0a0' : '#1a6a5a';
  for (const y of [1, 4, 7]) p.line(2, y, 7, y + (y === 4 ? 0 : y < 4 ? -1 : 1), '#2a1a10'); // legs
  p.ellipse(4.5, 4.5, 3.6, 3.2, shell);
  p.line(1.5, 4.5, 7, 4.5, darken(shell, 0.4));
  p.ellipse(8, 4.5, 1.6, 1.5, '#2a3a30');
  p.set(3, 3, lighten(shell, 0.6));
  p.outline(OUT);
  return p.canvas();
}

/** Gilded upright coffin lid with a royal face, 22x44. */
export function sarcophagus(): HTMLCanvasElement {
  const p = new Painter(22, 44);
  const g = '#d8b040', b = '#1c3a9a';
  p.poly([[5, 3], [17, 3], [20, 12], [19, 32], [16, 43], [6, 43], [3, 32], [2, 12]], g);
  // headcloth stripes and face
  for (const y of [5, 8, 11, 14]) p.line(3, y, 19, y, b);
  p.ellipse(11, 11, 4.5, 5.5, '#c08a52');
  p.set(9, 10, '#0a0608'), p.set(13, 10, '#0a0608');
  p.line(8, 9, 10, 9, '#0a0608'), p.line(12, 9, 14, 9, '#0a0608');
  p.rect(10, 16, 2, 4, b); // false beard
  // crossed arms with crook and flail, then the feathered wings of the lower case
  p.poly([[4, 21], [18, 21], [18, 24], [4, 24]], '#c08a52');
  p.line(5, 19, 16, 25, '#e8c860');
  p.line(16, 19, 6, 25, b);
  for (let y = 27; y < 42; y += 3) p.line(5, y, 17, y, y % 2 ? b : '#a02020');
  p.line(11, 26, 11, 42, darken(g, 0.35));
  p.shade(0.2);
  p.outline(OUT);
  return p.canvas();
}

/** The open coffin case behind the lid: a dark, dusty interior. */
export function sarcophagusCase(): HTMLCanvasElement {
  const p = new Painter(22, 44);
  p.poly([[5, 3], [17, 3], [20, 12], [19, 32], [16, 43], [6, 43], [3, 32], [2, 12]], '#a07a28');
  p.poly([[6.5, 5], [15.5, 5], [18, 12], [17, 32], [14.5, 41], [7.5, 41], [5, 32], [4, 12]], '#1a1008');
  for (const [x, y] of [[8, 14], [13, 22], [9, 33], [14, 37]]) p.set(x, y, '#3a2a18');
  p.outline(OUT);
  return p.canvas();
}

/** Cast-iron skillet, held by the handle, the pan tilted toward the viewer with a steak in it. */
export function skillet(): Part {
  const p = new Painter(18, 32);
  p.rect(8, 0, 2, 13, '#1c1a20');
  p.line(8, 1, 8, 12, '#3a3842');
  p.set(9, 11, '#8a8a94'); // rivet
  p.ellipse(9, 22, 8.5, 9, '#3a3842');
  p.ellipse(9, 22, 6.5, 7, '#1e1c22');
  p.ellipse(9.5, 22.5, 4, 3.6, '#8a3a1e');
  p.ellipse(9, 22, 2.6, 2.2, '#a8502a');
  p.line(7, 21, 10, 24, '#3a160c');
  p.line(9, 20, 12, 23, '#3a160c');
  p.shade(0.2);
  p.line(3, 18, 5, 15, '#6a6a76');
  return done(p, 9, 1);
}

/** Heavy square cleaver: wooden grip, the edge on the image's left (leading when chopping). */
export function cleaver(): Part {
  const p = new Painter(14, 28);
  p.rect(7, 0, 3, 10, '#5a3418');
  p.line(7, 1, 7, 9, '#8a5a30');
  p.set(8, 3, '#d8d0c0'); p.set(8, 7, '#d8d0c0');
  p.rect(1, 10, 10, 16, '#b8c0cc');
  p.line(1, 10, 1, 25, '#f4f8ff');
  p.line(10, 10, 10, 25, '#6a7280');
  p.ellipse(8, 13, 1.2, 1.2, '#3a3e48'); // hanging hole
  p.rect(2, 22, 7, 1, '#a8b0bc');
  return done(p, 8, 1);
}

/** A thick, flipping steak with grill marks and a rim of fat. */
export function steak(): HTMLCanvasElement {
  const p = new Painter(14, 10);
  p.ellipse(7, 5, 6, 3.6, '#8a3a1e');
  p.ellipse(6, 4.5, 4.6, 2.6, '#a8502a');
  p.line(2, 7, 11, 8, '#f0d8b0');
  for (const x of [4, 7, 10]) p.line(x - 1, 2, x + 1, 7, '#3a160c');
  p.shade(0.2);
  p.outline(OUT);
  return p.canvas();
}

/** Oversized silver serving dome, 40x40, rim along the bottom. */
export function cloche(): HTMLCanvasElement {
  const p = new Painter(40, 40);
  p.ellipse(20, 38, 19, 34, '#c8ccd8');
  p.rect(1, 36, 38, 3, '#9aa0ae');
  p.ellipse(20, 3, 3, 2, '#e8ecf4');
  p.rect(19, 4, 3, 1, '#8a90a0');
  p.shade(0.25);
  p.line(9, 18, 14, 10, '#ffffff');
  p.line(7, 24, 8, 21, '#ffffff');
  p.line(2, 36, 38, 36, '#e8ecf4');
  p.outline(OUT);
  return p.canvas();
}

/** Wide white dinner plate seen nearly edge-on, 42x6. */
export function plate(): HTMLCanvasElement {
  const p = new Painter(42, 6);
  p.ellipse(21, 2.5, 20, 2.5, '#f4f2ee');
  p.ellipse(21, 2.2, 15, 1.4, '#dcdad6');
  p.rect(13, 4, 16, 1, '#b8b4b0');
  p.outline(OUT);
  return p.canvas();
}

/** A sprig of herbs for the garnish. */
export function sprig(): HTMLCanvasElement {
  const p = new Painter(7, 6);
  p.line(1, 5, 5, 1, '#3a7a2a');
  for (const [x, y] of [[2, 3], [4, 2], [5, 0], [3, 1], [6, 2]]) p.set(x, y, '#6ac04a');
  return p.canvas();
}
