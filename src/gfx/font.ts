import { Color, css, mix } from './palette';
import { makeCanvas } from './painter';

// Hand-made 5x7 bitmap font. Each glyph is 7 rows of 5 pixels.
const G: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...# #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '.###. #.... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ....# .###.',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
  '"': '.#.#. .#.#. #.#.. ..... ..... ..... .....',
  ';': '..... .##.. .##.. ..... .##.. ..#.. .#...',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};
const GLYPHS: Record<string, boolean[][]> = {};
for (const k in G) GLYPHS[k] = G[k].split(' ').map((r) => [...r].map((ch) => ch === '#'));

export interface TextOpts {
  scale?: number;
  align?: 'left' | 'center' | 'right';
  /** Vertical gradient: [top, bottom] colors. Overrides the base color. */
  grad?: [Color, Color];
  outline?: Color | null;
  shadow?: Color | null;
  spacing?: number;
}

const cache = new Map<string, HTMLCanvasElement>();

export function textWidth(s: string, scale = 1, spacing = 1) {
  return s.length ? s.length * (5 + spacing) * scale - spacing * scale : 0;
}

function renderText(s: string, color: Color, o: TextOpts): HTMLCanvasElement {
  const scale = o.scale ?? 1, sp = o.spacing ?? 1;
  const pad = (o.outline ? 1 : 0) * scale + (o.shadow ? scale : 0);
  const w = textWidth(s, scale, sp) + pad * 2 + 2, h = 7 * scale + pad * 2 + 2;
  const [cv, ctx] = makeCanvas(w, h);
  const draw = (ox: number, oy: number, col: (row: number) => string) => {
    let x = ox;
    for (const ch of s) {
      const g = GLYPHS[ch] ?? GLYPHS['?'];
      for (let r = 0; r < 7; r++) {
        ctx.fillStyle = col(r);
        for (let c = 0; c < 5; c++) if (g[r][c]) ctx.fillRect(x + c * scale, oy + r * scale, scale, scale);
      }
      x += (5 + sp) * scale;
    }
  };
  const ox = pad + 1, oy = pad + 1;
  if (o.shadow) draw(ox + scale, oy + scale, () => css(o.shadow!));
  if (o.outline) {
    const oc = css(o.outline);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
      draw(ox + dx * scale, oy + dy * scale, () => oc);
  }
  draw(ox, oy, (r) => (o.grad ? css(mix(o.grad[0], o.grad[1], r / 6)) : css(color)));
  return cv;
}

/** Draw text with its top-left (or centre/right anchor) at x,y. Rendered strings are cached. */
export function drawText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: Color = '#fff', o: TextOpts = {}) {
  const s = str.toUpperCase();
  const key = `${s}|${String(color)}|${o.scale}|${o.grad}|${o.outline}|${o.shadow}|${o.spacing}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = renderText(s, color, o);
    if (cache.size > 600) cache.clear();
    cache.set(key, cv);
  }
  const pad = ((o.outline ? 1 : 0) + (o.shadow ? 1 : 0)) * (o.scale ?? 1) + 1;
  const w = textWidth(s, o.scale ?? 1, o.spacing ?? 1);
  const ax = o.align === 'center' ? x - Math.floor(w / 2) : o.align === 'right' ? x - w : x;
  ctx.drawImage(cv, Math.round(ax - pad), Math.round(y - pad));
}
