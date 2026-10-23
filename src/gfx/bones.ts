import { Painter } from './painter';
import { Part, PartSet } from './rig';

// A skeleton part set with the same pivots as the fighter parts, for electrocution and burning.
const BONE = '#e6dcc0', BONE_D = '#a89c7c', OUT = '#1a1210';

function bone(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Painter {
  const p = new Painter(w, h);
  p.capsule(x0, y0, 1.6, x1, y1, 1.4, BONE);
  p.ellipse(x0, y0, 2.4, 2, BONE);
  p.ellipse(x1, y1, 2.2, 2, BONE);
  p.shade(0.2);
  p.outline(OUT);
  return p;
}

export function buildBones(): PartSet {
  const torso = new Painter(28, 42);
  torso.ellipse(13, 29, 6.5, 3.5, BONE); // pelvis
  torso.line(13, 29, 14, 8, BONE);
  torso.line(12, 29, 13, 8, BONE_D);
  for (let i = 0; i < 6; i++) {
    const y = 10 + i * 2.4, w = 7 - Math.abs(i - 2) * 0.7;
    torso.line(14 - w, y + 1, 14 + w, y, BONE);
  }
  torso.ellipse(13.5, 8, 6, 2, BONE);
  torso.set(12, 29, OUT); torso.set(14, 29, OUT);
  torso.outline(OUT);

  const head = new Painter(24, 44);
  head.rect(9, 35, 2, 6, BONE_D);
  head.ellipse(10.5, 28.5, 6, 6.5, BONE);
  head.rect(12, 33, 5, 4, BONE);
  head.shade(0.18);
  head.ellipse(13.5, 28, 1.6, 1.8, OUT); // eye socket
  head.set(16, 31, OUT); // nasal cavity
  for (let x = 12; x <= 16; x += 2) head.set(x, 35, OUT); // teeth gaps
  head.outline(OUT);

  const ua = bone(12, 21, 6, 3, 6, 15);
  const fa = new Painter(12, 23);
  fa.capsule(5, 3, 1.3, 5, 13, 1.2, BONE);
  fa.capsule(7, 3, 1.1, 7, 13, 1.1, BONE_D);
  fa.ellipse(6, 16, 2.6, 2.6, BONE);
  fa.outline(OUT);
  const th = bone(14, 25, 7, 3, 7, 20);
  const sh = bone(12, 25, 6, 2, 6, 19);
  const ft = new Painter(16, 10);
  ft.capsule(2, 4, 2, 12, 6, 1.4, BONE);
  ft.outline(OUT);

  const P = (p: Painter, px: number, py: number, dim = false): Part => {
    const c = p.clone();
    if (dim) c.dim(0.3);
    return { img: c.canvas(), px, py };
  };
  return {
    torso: P(torso, 13, 31), head: P(head, 10, 40),
    uarm: P(ua, 6, 3), farm: P(fa, 6, 3), thigh: P(th, 7, 3), shin: P(sh, 6, 2), foot: P(ft, 4, 2),
    uarmB: P(ua, 6, 3, true), farmB: P(fa, 6, 3, true), thighB: P(th, 7, 3, true), shinB: P(sh, 6, 2, true), footB: P(ft, 4, 2, true),
  };
}
