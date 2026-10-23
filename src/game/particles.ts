import { FLOOR } from '../core/consts';
import { rand } from '../core/rng';

// World-space particles: x in stage pixels, y = height above the bridge deck.
export type PKind = 'blood' | 'mist' | 'flash' | 'spark' | 'smoke' | 'fire' | 'ash' | 'img' | 'ember' | 'zap';
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

// Floor stains: droplets that land close together merge into a wider, taller pool.
export interface Decal { x: number; w: number; h: number; c: string }

const BLOOD = ['#ff3030', '#d80818', '#b00010', '#8a0008'];
const STAIN = ['#6a0006', '#7a0008', '#900010'];

export class Particles {
  list: Particle[] = [];
  decals: Decal[] = [];
  floorY = 0; // height of the deck (0 for the bridge)
  gravScale = 1; // stage gravity relative to normal

  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length > 900) this.list.shift();
    this.list.push({ kind: 'spark', vx: 0, vy: 0, life: 30, max: 30, color: '#fff', size: 1, grav: 0, floor: true, ...p } as Particle);
  }

  // Arcing droplets that streak through the air and stain the floor where they land.
  blood(x: number, y: number, dir: number, n: number, force = 1) {
    for (let i = 0; i < n; i++) {
      const life = rand(30, 70);
      const big = Math.random() < 0.2;
      this.add({
        kind: 'blood', x: x + rand(-2, 2), y: y + rand(-2, 2),
        vx: dir * rand(0.3, 3.2) * force + rand(-0.7, 0.7), vy: rand(0.4, 4) * force,
        life, max: life, color: BLOOD[Math.floor(Math.random() * BLOOD.length)],
        size: big ? 2 : 1, grav: big ? 0.24 : 0.2,
      });
    }
  }
  // Fine spray that hangs in the air for a moment at the point of impact.
  mist(x: number, y: number, dir: number, n: number) {
    for (let i = 0; i < n; i++) {
      const life = rand(10, 22);
      this.add({
        kind: 'mist', x: x + rand(-2, 2), y: y + rand(-3, 3), vx: dir * rand(0.2, 1.4) + rand(-0.3, 0.3), vy: rand(-0.3, 0.8),
        life, max: life, color: Math.random() < 0.5 ? '#c00010' : '#ff4040', size: rand(1, 3), grav: 0.02, floor: false,
      });
    }
  }
  // Starburst on the hit point, sized by how hard the blow landed.
  flash(x: number, y: number, size: number, color = '#fff6a0') {
    this.add({ kind: 'flash', x, y, life: 7, max: 7, size, color, floor: false, rot: rand(0, Math.PI / 4) });
  }
  // A full hit: flash + sparks + spray + droplets in the direction of the blow.
  impact(x: number, y: number, dir: number, dmg: number, heavy: boolean) {
    this.sparks(x, y, heavy ? 7 : 4, '#ffffff');
    this.mist(x, y, dir, heavy ? 10 : 5);
    this.blood(x, y, dir, Math.round(dmg / 5), heavy ? 1.35 : 1);
    if (heavy) this.blood(x, y + 4, dir, 4, 2); // a few long-range gushers
    // added last so it draws on top of the spray
    this.flash(x, y, heavy ? 10 : 6, heavy ? '#ffe060' : '#ffffff');
  }
  splat(x: number, size: number) {
    const rx = Math.round(x);
    for (const d of this.decals) {
      if (rx >= d.x - 1 && rx <= d.x + d.w) {
        if (d.w < 14) {
          if (rx < d.x) d.x = rx;
          d.w++;
        }
        if (d.w > 5 && d.h < 2) d.h = 2;
        if (Math.random() < 0.3) d.c = STAIN[0];
        return;
      }
    }
    if (this.decals.length > 400) this.decals.shift();
    this.decals.push({ x: rx, w: size + (Math.random() < 0.3 ? 1 : 0), h: 1, c: STAIN[Math.floor(Math.random() * STAIN.length)] });
  }
  sparks(x: number, y: number, n: number, color = '#fff6a0') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.8, 3);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 10, max: 10, color, grav: 0, floor: false });
    }
  }
  /** Puffs of dust kicked along the floor by a landing or a body hitting the ground. */
  dust(x: number, n = 4, color = '#b8a890') {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const life = rand(14, 26);
      this.add({ kind: 'smoke', x: x + dir * rand(2, 8), y: this.floorY + rand(0, 2), vx: dir * rand(0.4, 1.1), vy: rand(0.05, 0.3), life, max: life, color, size: rand(1, 3), grav: 0, floor: false });
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
      p.vy -= p.grav * this.gravScale;
      p.x += p.vx;
      p.y += p.vy;
      if (p.rot !== undefined) p.rot += p.vrot ?? 0;
      if (p.kind === 'smoke' || p.kind === 'fire') p.vx *= 0.97;
      if (p.kind === 'mist') { p.vx *= 0.9; p.vy *= 0.9; }
      if (p.floor && p.y <= this.floorY) {
        if (p.kind === 'blood') {
          this.splat(p.x, p.size);
          // big drops kick up a tiny splash
          if (p.size > 1 && Math.random() < 0.5)
            for (let i = 0; i < 2; i++) this.add({ kind: 'blood', x: p.x, y: this.floorY + 1, vx: rand(-0.8, 0.8), vy: rand(0.6, 1.2), life: 12, max: 12, color: p.color, size: 1, grav: 0.2 });
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
      if (d.h > 1) ctx.fillRect(d.x - camX + 1, groundY + 1, d.w - 2, 1);
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
        case 'blood': {
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, p.size, p.size);
          // motion streak trailing behind fast drops
          if (Math.abs(p.vx) + Math.abs(p.vy) > 2) {
            ctx.fillStyle = '#8a0008';
            ctx.fillRect(Math.round(sx - p.vx * 0.7), Math.round(sy + p.vy * 0.7), 1, 1);
          }
          break;
        }
        case 'mist':
          ctx.globalAlpha = k * 0.7;
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, Math.ceil(p.size), Math.ceil(p.size));
          ctx.globalAlpha = 1;
          break;
        case 'flash': {
          // 8-point starburst that blooms then shrinks: white core, colored rays
          const t = 1 - k;
          const r = Math.max(1, Math.round(p.size * (t < 0.3 ? t / 0.3 : 1 - (t - 0.3) * 0.9)));
          ctx.fillStyle = p.color;
          for (let i = 0; i < 8; i++) {
            const a = (p.rot ?? 0) + (i * Math.PI) / 4, len = i % 2 ? r * 0.6 : r;
            for (let j = 2; j <= len; j++) ctx.fillRect(Math.round(sx + Math.cos(a) * j), Math.round(sy + Math.sin(a) * j), 1, 1);
          }
          ctx.fillStyle = '#ffffff';
          const c = Math.max(1, Math.round(r / 3));
          ctx.fillRect(sx - c, sy - c, c * 2 + 1, c * 2 + 1);
          break;
        }
        default:
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, p.size, p.size);
      }
    }
  }
}
