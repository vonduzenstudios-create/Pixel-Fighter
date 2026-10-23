import { FLOOR } from '../core/consts';
import { rand } from '../core/rng';

// World-space particles: x in stage pixels, y = height above the bridge deck.
export type PKind = 'blood' | 'spark' | 'smoke' | 'fire' | 'ash' | 'img' | 'ember' | 'zap';
export interface Particle {
  kind: PKind;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  color: string;
  size: number;
  grav: number;
  rot?: number; vrot?: number;
  img?: HTMLCanvasElement; ix?: number; iy?: number;
  floor?: boolean;
  bounce?: number;
}

export interface Decal { x: number; w: number; c: string }

export class Particles {
  list: Particle[] = [];
  decals: Decal[] = [];
  floorY = 0; // height of the deck (0 for the bridge)

  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length > 900) this.list.shift();
    this.list.push({ kind: 'spark', vx: 0, vy: 0, life: 30, max: 30, color: '#fff', size: 1, grav: 0, floor: true, ...p } as Particle);
  }

  blood(x: number, y: number, dir: number, n: number, force = 1) {
    for (let i = 0; i < n; i++) {
      const life = rand(25, 60);
      this.add({
        kind: 'blood', x, y, vx: dir * rand(0.3, 2.8) * force + rand(-0.6, 0.6), vy: rand(0.5, 3.8) * force,
        life, max: life, color: Math.random() < 0.3 ? '#ff2a2a' : Math.random() < 0.5 ? '#c00010' : '#8a0008',
        size: Math.random() < 0.25 ? 2 : 1, grav: 0.2,
      });
    }
  }
  sparks(x: number, y: number, n: number, color = '#fff6a0') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.8, 3);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 10, max: 10, color, grav: 0, floor: false });
    }
  }
  smoke(x: number, y: number, n = 1, color = '#3a3438') {
    for (let i = 0; i < n; i++) {
      const life = rand(30, 60);
      this.add({ kind: 'smoke', x: x + rand(-3, 3), y: y + rand(-3, 3), vx: rand(-0.3, 0.3), vy: rand(0.2, 0.7), life, max: life, color, size: rand(2, 4), grav: -0.005, floor: false });
    }
  }
  fire(x: number, y: number, n = 1, spread = 4) {
    for (let i = 0; i < n; i++) {
      const life = rand(14, 30);
      this.add({ kind: 'fire', x: x + rand(-spread, spread), y: y + rand(-2, 2), vx: rand(-0.3, 0.3), vy: rand(0.6, 1.6), life, max: life, color: '#ffb030', size: rand(1, 3), grav: -0.02, floor: false });
    }
  }
  zap(x: number, y: number, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(1, 2.5);
      this.add({ kind: 'zap', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 8, max: 8, color: Math.random() < 0.5 ? '#bfe8ff' : '#6ab4ff', grav: 0, floor: false });
    }
  }
  chunk(img: HTMLCanvasElement, ix: number, iy: number, x: number, y: number, vx: number, vy: number, vrot: number, life = 400) {
    this.add({ kind: 'img', img, ix, iy, x, y, vx, vy, rot: 0, vrot, life, max: life, grav: 0.25, bounce: 0.35, color: '#fff' });
  }

  update() {
    for (const p of this.list) {
      p.life--;
      p.vy -= p.grav;
      p.x += p.vx;
      p.y += p.vy;
      if (p.rot !== undefined) p.rot += p.vrot ?? 0;
      if (p.kind === 'smoke' || p.kind === 'fire') p.vx *= 0.97;
      if (p.floor && p.y <= this.floorY) {
        if (p.kind === 'blood') {
          if (this.decals.length > 400) this.decals.shift();
          this.decals.push({ x: Math.round(p.x), w: p.size + (Math.random() < 0.3 ? 1 : 0), c: Math.random() < 0.5 ? '#7a0008' : '#a00010' });
          p.life = 0;
        } else if (p.kind === 'img') {
          p.y = this.floorY;
          if (Math.abs(p.vy) > 1.2) {
            p.vy = -p.vy * (p.bounce ?? 0.3);
            p.vrot = (p.vrot ?? 0) * 0.5;
            p.vx *= 0.6;
          } else {
            p.vy = 0;
            p.vx *= 0.8;
            p.vrot = 0;
            p.grav = 0;
          }
        } else p.life = 0;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, groundY = FLOOR) {
    for (const d of this.decals) {
      ctx.fillStyle = d.c;
      ctx.fillRect(d.x - camX, groundY, d.w, 1);
    }
    for (const p of this.list) {
      const sx = Math.round(p.x - camX), sy = Math.round(groundY - p.y);
      const k = p.life / p.max;
      switch (p.kind) {
        case 'img':
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot ?? 0);
          ctx.drawImage(p.img!, -(p.ix ?? 0), -(p.iy ?? 0));
          ctx.restore();
          break;
        case 'smoke':
          ctx.globalAlpha = Math.min(1, k * 1.5) * 0.6;
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size + (1 - k) * 4, p.size + (1 - k) * 4);
          ctx.globalAlpha = 1;
          break;
        case 'fire':
          ctx.fillStyle = k > 0.7 ? '#fff4c0' : k > 0.45 ? '#ffc040' : k > 0.25 ? '#ff6a10' : '#a02008';
          ctx.fillRect(sx, sy, Math.ceil(p.size * (0.5 + k)), Math.ceil(p.size * (0.5 + k)));
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, p.size, p.size);
      }
    }
  }
}
