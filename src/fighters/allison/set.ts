import type { SetPainter } from '../../scenes/sets';

/** Select-screen set: a topiary garden at dusk, a tiny door in the hedge and a chessboard lawn. */
export const gardenSet: SetPainter = (g) => {
  const { u } = g;
  const sky = ['#3a2a5a', '#5a3a70', '#8a4a78'];
  for (let i = 0; i < sky.length; i++) g.r(0, (g.floor * i) / sky.length, g.w, g.floor / sky.length + 1, sky[i]);
  // hedge wall with clipped bumps along the top
  const top = g.floor - 14 * u;
  g.r(0, top, g.w, g.floor - top, '#1e4a2a');
  for (let x = 0, i = 0; x < g.w; x += 6 * u, i++) g.r(x, top - 2 * u, 5 * u, 2 * u, i % 2 ? '#2a5a34' : '#1e4a2a');
  for (let i = 0; i < 12; i++) g.r((i * 37.7) % g.w, top + ((i * 13) % 11) * u, u, u, '#3a7040');
  // the little door
  const dx = g.w * 0.74;
  g.r(dx, g.floor - 7 * u, 4 * u, 7 * u, '#6a3a1a');
  g.r(dx + u, g.floor - 6 * u, 2 * u, 5 * u, '#8a5028');
  g.r(dx + 3 * u, g.floor - 4 * u, u, u, '#e8c050');
  // a rose bush, half painted red
  const rx = g.w * 0.16;
  g.r(rx, g.floor - 6 * u, 6 * u, 6 * u, '#2a5a34');
  for (const [x, y, c] of [[1, 1, '#f4f0e4'], [4, 2, '#c81828'], [2, 4, '#c81828'], [4, 4, '#f4f0e4']] as [number, number, string][]) g.r(rx + x * u, g.floor - 6 * u + y * u, u, u, c);
  // chessboard lawn
  const s = 4 * u;
  for (let y = g.floor, row = 0; y < g.h; y += s, row++) for (let x = 0, col = 0; x < g.w; x += s, col++) g.r(x, y, s, s, (row + col) % 2 ? '#e8e0d0' : '#2a2030');
};
