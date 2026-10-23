import { Color, RGB, rgb, lighten, darken, bayer, mix } from './palette';

// A tiny RGBA pixel buffer with shape primitives, auto shading and outlines.
// Every sprite in the game is painted through this, then turned into a canvas.
export class Painter {
  data: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, c: Color, a = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgb(c);
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }
  alpha(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }
  get(x: number, y: number): RGB {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  /** Only paint where something is already painted (like a clipping mask). */
  over(x: number, y: number, c: Color) {
    if (this.alpha(Math.floor(x), Math.floor(y))) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color, clip = false) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) clip ? this.over(x, y, c) : this.set(x, y, c);
      }
  }
  /** Tapered capsule between two points (radius r0 at the start, r1 at the end). */
  capsule(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, c: Color) {
    const minX = Math.floor(Math.min(x0 - r0, x1 - r1)), maxX = Math.ceil(Math.max(x0 + r0, x1 + r1));
    const minY = Math.floor(Math.min(y0 - r0, y1 - r1)), maxY = Math.ceil(Math.max(y0 + r0, y1 + r1));
    const vx = x1 - x0, vy = y1 - y0, len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - x0) * vx + (py - y0) * vy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - (x0 + vx * t), dy = py - (y0 + vy * t);
        const r = r0 + (r1 - r0) * t;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
  }
  poly(pts: number[][], c: Color, clip = false) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= maxY; y++)
      for (let x = Math.floor(minX); x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) clip ? this.over(x, y, c) : this.set(x, y, c);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Color, clip = false) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps), y = Math.round(y0 + ((y1 - y0) * i) / steps);
      clip ? this.over(x, y, c) : this.set(x, y, c);
    }
  }
  /** Vertical dithered gradient across a rect. */
  gradRect(x: number, y: number, w: number, h: number, top: Color, bot: Color, steps = 6) {
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h - 1);
      const band = t * steps;
      const lo = Math.floor(band) / steps, hi = Math.min(1, (Math.floor(band) + 1) / steps);
      for (let i = 0; i < w; i++) {
        const tt = band - Math.floor(band) > bayer(x + i, y + j) ? hi : lo;
        this.set(x + i, y + j, mix(top, bot, tt));
      }
    }
  }

  /** Rim light toward the light (top-left by default) and a two-step shadow on the far side. */
  shade(amt = 0.22, lx = -1, ly = -1) {
    const src = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) src[y * this.w + x] = this.alpha(x, y) ? 1 : 0;
    const a = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!a(x, y)) continue;
        const c = this.get(x, y);
        if (!a(x + lx, y) || !a(x, y + ly)) this.set(x, y, lighten(c, amt));
        else if (!a(x - lx, y) || !a(x, y - ly)) this.set(x, y, darken(c, amt * 1.4));
        else if (!a(x - 2 * lx, y)) this.set(x, y, darken(c, amt * 0.6));
      }
  }
  outline(c: Color = '#120a10') {
    const pts: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y)) continue;
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) pts.push(x, y);
      }
    for (let i = 0; i < pts.length; i += 2) this.set(pts[i], pts[i + 1], c);
  }
  clone(): Painter {
    const p = new Painter(this.w, this.h);
    p.data.set(this.data);
    return p;
  }
  /** Darken every opaque pixel (used for limbs on the far side of the body). */
  dim(t: number): Painter {
    for (let i = 0; i < this.data.length; i += 4) {
      if (!this.data[i + 3]) continue;
      this.data[i] *= 1 - t;
      this.data[i + 1] *= 1 - t;
      this.data[i + 2] *= 1 - t * 0.7;
    }
    return this;
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    cv.getContext('2d')!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return cv;
  }
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
}

/** Draw a hard-edged pixel line straight onto a canvas. */
export function pxLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++)
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), w, w);
}
export function pxCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let y = -Math.ceil(r); y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}
