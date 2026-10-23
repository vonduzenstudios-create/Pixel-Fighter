import { FLOOR } from '../core/consts';
import { pxCircle, pxLine } from '../gfx/painter';
import { ball, bill, cashBrick, keg, musicNote, pineTree, stovepipeHat } from '../gfx/props';
import type { Fighter } from './fighter';
import type { Fight } from './fight';
import type { Effect, Level } from './types';
import { rand } from '../core/rng';
import { drawMiniHole } from '../chars/hawking';

export type ProjKind = 'hat' | 'bolt' | 'holy' | 'cannon' | 'keg' | 'cash' | 'aria' | 'gust' | 'paint' | 'tree' | 'hole';

const PAINTS = ['#123c78', '#2e7a34', '#f0c020', '#a01828', '#f4f0e8'];

const makeSprites = () => ({
  hat: stovepipeHat(), keg: keg(), cannon: ball(5, '#2a2a32'), holy: ball(5, '#ffd040', true), bolt: ball(4, '#9ad8ff', true),
  cash: cashBrick(), bill: bill(), note: musicNote(), paint: PAINTS.map((c) => ball(5, c)), tree: pineTree(),
});
let SPR: ReturnType<typeof makeSprites> | null = null;
const spr = () => (SPR ??= makeSprites());

const STATS: Record<ProjKind, { dmg: number; level: Level; effect: Effect; r: number; speed: number }> = {
  hat: { dmg: 70, level: 'high', effect: 'heavy', r: 7, speed: 4.4 },
  bolt: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 6.2 },
  holy: { dmg: 90, level: 'high', effect: 'knockdown', r: 7, speed: 3.6 },
  cannon: { dmg: 110, level: 'high', effect: 'knockdown', r: 6, speed: 3.0 },
  keg: { dmg: 90, level: 'low', effect: 'sweep', r: 8, speed: 2.8 },
  gust: { dmg: 85, level: 'mid', effect: 'heavy', r: 8, speed: 5.0 },
  cash: { dmg: 85, level: 'high', effect: 'heavy', r: 7, speed: 4.6 },
  // short-range sonic blast that can't be ducked
  aria: { dmg: 70, level: 'mid', effect: 'knockdown', r: 11, speed: 5.2 },
  hole: { dmg: 95, level: 'high', effect: 'knockdown', r: 7, speed: 2.4 },
  paint: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 4.2 },
  tree: { dmg: 95, level: 'low', effect: 'launch', r: 9, speed: 0 },
};

/** Frames a sprouting tree rumbles underground before it bursts up. */
const TREE_WARN = 16;

export class Projectile {
  vx: number;
  vy = 0;
  t = 0;
  dead = false;
  /** Already hit; still drawn but harmless. */
  spent = false;
  dmg: number; level: Level; effect: Effect; r: number;
  /** Paint colour index for paint blobs. */
  hue = Math.floor(Math.random() * PAINTS.length);
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
      case 'cash':
        if (this.t % 5 === 0)
          p.add({ kind: 'img', img: spr().bill, ix: 3, iy: 2, x: this.x, y: this.y, vx: -this.vx * 0.15, vy: 0.6, grav: 0.04, rot: 0, vrot: 0.2, life: 50, max: 50 });
        break;
      case 'aria':
        this.vx *= 0.97;
        if (this.t > 26) this.dead = true;
        break;
      case 'hole': {
        // a slow singularity that drags a grounded opponent toward it
        const o = this.owner.opp;
        if (!o.airborne && !o.locked && Math.abs(o.x - this.x) < 70) o.x += Math.sign(this.x - o.x) * 0.45;
        if (this.t % 3 === 0) {
          const a = rand(0, Math.PI * 2);
          p.add({ kind: 'spark', x: this.x + Math.cos(a) * 14, y: this.y + Math.sin(a) * 10, vx: -Math.cos(a) * 1.2, vy: -Math.sin(a) * 1.2, life: 10, max: 10, color: '#a070ff', floor: false });
        }
        break;
      }
      case 'paint':
        if (this.t % 3 === 0) p.add({ kind: 'spark', x: this.x, y: this.y - 2, vx: -this.vx * 0.1, vy: 0.3, life: 18, max: 18, color: PAINTS[this.hue], grav: 0.15, floor: false });
        break;
      case 'tree': {
        // rumbles underground (out of reach), then shoots up from the deck
        if (this.t < TREE_WARN) {
          this.y = -40;
          if (this.t % 2 === 0) p.smoke(this.x + rand(-6, 6), 1, 1, '#6a5038');
          if (this.t === 2) f.sfx('roll');
        } else {
          if (this.t === TREE_WARN) {
            f.sfx('whoosh', 1);
            p.sparks(this.x, 4, 8, '#3a7a38');
          }
          this.y = Math.min(34, 6 + (this.t - TREE_WARN) * 3);
        }
        if (this.t > TREE_WARN + 30) {
          this.dead = true;
          p.sparks(this.x, 20, 10, '#2a6230');
        }
        break;
      }
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
      case 'cash':
        ctx.rotate(Math.sin(this.t * 0.3) * 0.15);
        ctx.drawImage(s.cash, -8, -5);
        break;
      case 'aria': {
        // expanding sound rings with a note riding the front
        const d = Math.sign(this.vx) || 1;
        for (let k = 0; k < 3; k++) {
          const r = 4 + ((this.t * 0.8 + k * 4) % 12);
          ctx.fillStyle = k === 0 ? '#fff4c0' : '#e8b040';
          for (let a = -50; a <= 50; a += 12) {
            const ra = (a * Math.PI) / 180;
            ctx.fillRect(Math.round(Math.cos(ra) * r * d) - 6 * d, Math.round(Math.sin(ra) * r * 1.4), 1, 2);
          }
        }
        ctx.drawImage(s.note, -3 + d * 4, -12 + Math.round(Math.sin(this.t * 0.5) * 2));
        break;
      }
      case 'hole':
        drawMiniHole(ctx, this.t);
        break;
      case 'paint':
        ctx.drawImage(s.paint[this.hue], -7, -7);
        ctx.fillStyle = PAINTS[this.hue];
        ctx.fillRect(-Math.sign(this.vx) * 7 - 1, -1, 3, 2);
        break;
      case 'tree': {
        // grows from the deck: stretch the sprite up from its base
        ctx.translate(0, this.y);
        const k = Math.max(0, Math.min(1, (this.t - TREE_WARN) / 8));
        const h = Math.round(40 * k);
        if (h > 0) ctx.drawImage(s.tree, 0, 0, 20, 40, -10, -h, 20, h);
        break;
      }
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
