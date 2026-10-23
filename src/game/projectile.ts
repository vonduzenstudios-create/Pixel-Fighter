import { FLOOR } from '../core/consts';
import { pxCircle, pxLine } from '../gfx/painter';
import { ball, keg, stovepipeHat } from '../gfx/props';
import type { Fighter } from './fighter';
import type { Fight } from './fight';
import type { Effect, Level } from './types';
import { rand } from '../core/rng';

export type ProjKind = 'hat' | 'bolt' | 'holy' | 'cannon' | 'keg' | 'gust';

let SPR: { hat: HTMLCanvasElement; keg: HTMLCanvasElement; cannon: HTMLCanvasElement; holy: HTMLCanvasElement; bolt: HTMLCanvasElement } | null = null;
const spr = () =>
  (SPR ??= { hat: stovepipeHat(), keg: keg(), cannon: ball(5, '#2a2a32'), holy: ball(5, '#ffd040', true), bolt: ball(4, '#9ad8ff', true) });

const STATS: Record<ProjKind, { dmg: number; level: Level; effect: Effect; r: number; speed: number }> = {
  hat: { dmg: 70, level: 'high', effect: 'heavy', r: 7, speed: 4.4 },
  bolt: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 6.2 },
  holy: { dmg: 90, level: 'high', effect: 'knockdown', r: 7, speed: 3.6 },
  cannon: { dmg: 110, level: 'high', effect: 'knockdown', r: 6, speed: 3.0 },
  keg: { dmg: 90, level: 'low', effect: 'sweep', r: 8, speed: 2.8 },
  gust: { dmg: 85, level: 'mid', effect: 'heavy', r: 8, speed: 5.0 },
};

export class Projectile {
  vx: number;
  vy = 0;
  t = 0;
  dead = false;
  dmg: number; level: Level; effect: Effect; r: number;
  constructor(public owner: Fighter, public kind: ProjKind, public x: number, public y: number) {
    const s = STATS[kind];
    this.vx = s.speed * owner.facing;
    this.dmg = s.dmg; this.level = s.level; this.effect = s.effect; this.r = s.r;
  }

  update(f: Fight) {
    this.t++;
    const p = f.particles;
    switch (this.kind) {
      case 'hat': {
        // boomerang: slows, turns around and flies back to its owner
        this.vx -= 0.11 * Math.sign(this.vx0());
        if (this.t > 30 && Math.abs(this.x - this.owner.x) < 10) this.dead = true;
        if (this.t % 12 === 0) f.sfx('hatSpin');
        break;
      }
      case 'bolt':
        if (this.t % 2 === 0) p.zap(this.x, this.y, 2);
        break;
      case 'holy':
        p.fire(this.x - Math.sign(this.vx) * 4, this.y, 2, 3);
        break;
      case 'cannon':
        if (this.t % 3 === 0) p.smoke(this.x - Math.sign(this.vx) * 5, this.y, 1);
        break;
      case 'keg':
        this.y = 8;
        if (this.t % 4 === 0) p.smoke(this.x - Math.sign(this.vx) * 6, 2, 1, '#5a4a3a');
        break;
      case 'gust':
        if (this.t % 3 === 0) p.smoke(this.x - Math.sign(this.vx) * 8, this.y + rand(-6, 6), 1, '#c8d4e0');
        break;
    }
    this.x += this.vx;
    this.y += this.vy;
    if (this.t > 220 || this.x < -40 || this.x > 560) this.dead = true;
  }
  private dir0 = 0;
  private vx0() {
    if (!this.dir0) this.dir0 = Math.sign(this.vx) || 1;
    return this.dir0;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number) {
    const sx = Math.round(this.x - camX), sy = Math.round(FLOOR - this.y);
    const s = spr();
    ctx.save();
    ctx.translate(sx, sy);
    switch (this.kind) {
      case 'hat':
        ctx.rotate(this.t * 0.5);
        ctx.drawImage(s.hat, -8, -12);
        break;
      case 'keg':
        ctx.rotate(this.t * 0.25 * Math.sign(this.vx));
        ctx.drawImage(s.keg, -9, -9);
        break;
      case 'cannon':
        ctx.drawImage(s.cannon, -7, -7);
        break;
      case 'holy': {
        const fl = Math.sin(this.t * 0.8) > 0;
        ctx.fillStyle = fl ? '#ff7010' : '#ff4008';
        pxCircle(ctx, 0, 0, 7);
        ctx.drawImage(s.holy, -7, -7);
        ctx.fillStyle = '#fffbe0';
        pxCircle(ctx, -1, -1, 2);
        break;
      }
      case 'gust': {
        // crescent of kicked-up air: three nested arcs bowing toward the target
        const d = Math.sign(this.vx), wob = Math.sin(this.t * 0.9);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k === 0 ? '#ffffff' : k === 1 ? '#c8e0f8' : '#7aa0c8';
          const r = 10 - k * 2;
          for (let a = -70; a <= 70; a += 10) {
            const rad = (a * Math.PI) / 180;
            ctx.fillRect(Math.round(d * (Math.cos(rad) * r - 6 - k * 3)), Math.round(Math.sin(rad) * (r + 2 + wob)), 2, 2);
          }
        }
        break;
      }
      case 'bolt': {
        ctx.drawImage(s.bolt, -6, -6);
        ctx.fillStyle = '#e8f8ff';
        for (let i = 0; i < 3; i++) {
          let px = 0, py = 0;
          const a = rand(0, Math.PI * 2);
          for (let k = 0; k < 4; k++) {
            const nx = px + Math.cos(a) * 3 + rand(-2, 2), ny = py + Math.sin(a) * 3 + rand(-2, 2);
            pxLine(ctx, px, py, nx, ny);
            px = nx; py = ny;
          }
        }
        // trailing tail
        ctx.fillStyle = '#6ab4ff';
        pxLine(ctx, 0, 0, -Math.sign(this.vx) * 14, rand(-3, 3));
        break;
      }
    }
    ctx.restore();
  }
}
