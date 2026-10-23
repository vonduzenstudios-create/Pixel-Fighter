export type RGB = [number, number, number];
export type Color = RGB | string;

export function hex(h: string): RGB {
  let s = h.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: Color): RGB => (typeof c === 'string' ? hex(c) : c);
export function mix(a: Color, b: Color, t: number): RGB {
  const x = rgb(a), y = rgb(b);
  return [
    Math.round(x[0] + (y[0] - x[0]) * t),
    Math.round(x[1] + (y[1] - x[1]) * t),
    Math.round(x[2] + (y[2] - x[2]) * t),
  ];
}
export const lighten = (c: Color, t: number) => mix(c, [255, 255, 255], t);
export const darken = (c: Color, t: number) => mix(c, [0, 0, 0], t);
export function css(c: Color, a = 1): string {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

// 4x4 ordered-dither matrix, normalised to 0..1.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
