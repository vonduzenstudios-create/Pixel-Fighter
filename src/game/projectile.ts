import { FLOOR } from '../core/consts';
import { pxCircle, pxLine } from '../gfx/painter';
import { ball, bill, cashBrick, fedora, keg, musicNote, pineTree, sarcophagus, scarab, stovepipeHat } from '../gfx/props';
import type { Fighter } from './fighter';
import type { Fight } from './fight';
import type { Effect, Level } from './types';
import { rand } from '../core/rng';
import { playCue, PROJ_SOUNDS } from '../audio/specials';
import { drawMiniHole } from '../chars/hawking';
import { drawGift } from '../chars/oprah';
import { drawDrumstick, drawGrease } from '../chars/colonel';

export type ProjKind = 'hat' | 'bolt' | 'holy' | 'cannon' | 'keg' | 'cash' | 'aria' | 'gust' | 'paint' | 'tree' | 'fedora' | 'hole' | 'gift' | 'drumstick' | 'grease' | 'scarab' | 'sarcophagus';

const PAINTS = ['#123c78', '#2e7a34', '#f0c020', '#a01828', '#f4f0e8'];

const makeSprites = () => ({
  hat: stovepipeHat(), fedora: fedora(), keg: keg(), cannon: ball(5, '#2a2a32'), holy: ball(5, '#ffd040', true), bolt: ball(4, '#9ad8ff', true),
  cash: cashBrick(), bill: bill(), note: musicNote(), paint: PAINTS.map((c) => ball(5, c)), tree: pineTree(),
  scarab: scarab(), scarabGlow: scarab(true), sarcophagus: sarcophagus(),
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
  fedora: { dmg: 75, level: 'high', effect: 'heavy', r: 7, speed: 5.2 },
  paint: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 4.2 },
  tree: { dmg: 95, level: 'low', effect: 'launch', r: 9, speed: 0 },
  gift: { dmg: 80, level: 'high', effect: 'heavy', r: 7, speed: 4.2 },
  drumstick: { dmg: 80, level: 'high', effect: 'heavy', r: 6, speed: 4.4 },
  // lobbed in an arc (vy set by the thrower), then burns on the floor where it lands
  grease: { dmg: 75, level: 'mid', effect: 'heavy', r: 7, speed: 2.6 },
  // a buzzing swarm that weaves as it flies
  scarab: { dmg: 80, level: 'high', effect: 'heavy', r: 9, speed: 3.4 },
  // drops out of the sky onto the opponent: block it standing
  sarcophagus: { dmg: 105, level: 'overhead', effect: 'knockdown', r: 12, speed: 0 },
};

/** Frames a grease puddle keeps burning after it lands. */
const GREASE_BURN = 70;

/** Frames a sarcophagus hangs over its target, shadow on the floor, before it drops. */
const SARC_WARN = 18;

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
  /** Frame a lobbed grease blob hit the floor. */
  landed = 0;
  /** Paint colour index for paint blobs. */
  hue = Math.floor(Math.random() * PAINTS.length);
  constructor(public owner: Fighter, public kind: ProjKind, public x: number, public y: number) {
    const s = STATS[kind];
    this.vx = s.speed * owner.facing;
    this.dmg = s.dmg; this.level = s.level; this.effect = s.effect; this.r = s.r;
    playCue(PROJ_SOUNDS[kind]?.launch);
  }

  update(f: Fight) {
    this.t++;
    const p = f.particles;
    const travel = PROJ_SOUNDS[this.kind]?.travel;
    if (travel && this.t % travel.every === 0) playCue(travel.cue);
    switch (this.kind) {
      case 'hat': {
        // boomerang: slows, turns around and flies back to its owner
        this.vx -= 0.11 * Math.sign(this.vx0());
        if (this.t > 30 && Math.abs(this.x - this.owner.x) < 10) this.dead = true;
        if (this.t % 12 === 0) f.sfx('hatSpin');
        break;
      }
      case 'fedora':
        // flat spinning throw with a sparkle trail
        if (this.t % 3 === 0) p.sparks(this.x - Math.sign(this.vx) * 6, this.y, 1, '#ffffff');
        if (this.t % 14 === 0) f.sfx('hatSpin');
        break;
      case 'bolt':
        if (this.t % 2 === 0) p.zap(this.x, this.y, 2);
        break;
      case 'gift':
        // a little trail of confetti behind the present
        if (this.t % 3 === 0) p.add({ kind: 'spark', x: this.x - Math.sign(this.vx) * 6, y: this.y + rand(-4, 4), vx: -this.vx * 0.1, vy: 0.4, grav: 0.05, life: 24, max: 24, size: 2, color: ['#f04878', '#f0c020', '#40b8f0', '#60d070'][(this.t / 3) % 4] });
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
      case 'drumstick':
        if (this.t % 4 === 0)
          p.add({ kind: 'spark', x: this.x - Math.sign(this.vx) * 6, y: this.y, vx: -this.vx * 0.1, vy: 0.4, grav: 0.1, life: 20, max: 20, color: this.t % 8 ? '#c47422' : '#eaa848' });
        break;
      case 'grease':
        if (!this.landed) {
          this.vy -= 0.2;
          if (this.t % 2 === 0) p.add({ kind: 'spark', x: this.x, y: this.y, vx: 0, vy: 0, grav: 0.1, life: 12, max: 12, color: '#e8a830' });
          if (this.y + this.vy <= 3) {
            // splat: a burning puddle that has to be blocked low
            this.landed = this.t;
            this.y = 3;
            this.vx = this.vy = 0;
            this.level = 'low';
            this.r = 12;
            p.sparks(this.x, 4, 10, '#ffd040');
            playCue(PROJ_SOUNDS.grease?.blocked);
          }
        } else {
          if (this.t % 3 === 0) p.fire(this.x + rand(-10, 10), 4, 1, 3);
          if (this.t - this.landed > GREASE_BURN) this.dead = true;
        }
        break;
      case 'scarab':
        this.vy = Math.cos(this.t * 0.25) * 0.9;
        if (this.t % 4 === 0) p.add({ kind: 'spark', x: this.x - Math.sign(this.vx) * 8, y: this.y + rand(-4, 4), vx: -this.vx * 0.2, vy: 0, life: 10, max: 10, color: '#e8c860', floor: false });
        break;
      case 'sarcophagus': {
        const o = this.owner.opp;
        if (this.t === 1) this.y = 230;
        if (this.t < SARC_WARN) {
          // homes in from above while the shadow grows
          this.x += (o.x - this.x) * 0.12;
          this.vy = 0;
        } else if (!this.spent) {
          this.vy -= 0.55;
          if (this.y <= 22) {
            this.y = 22;
            this.vy = 0;
            this.spent = true;
            this.landT = this.t;
            f.shake(6);
            f.sfx('thud');
            for (const s of [-1, 1]) p.smoke(this.x + s * 10, 2, 5, '#c8a870');
          }
        } else {
          this.vy = 0;
          if (this.t > this.landT + 26) {
            this.y -= 2; // sinks into the sand
            if (this.t % 4 === 0) p.smoke(this.x + rand(-10, 10), 2, 1, '#c8a870');
          }
          if (this.t > this.landT + 46) this.dead = true;
        }
        break;
      }
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
  private landT = 0;
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
      case 'fedora':
        // spins flat like a disc: squash horizontally instead of rotating
        ctx.scale(Math.max(0.25, Math.abs(Math.cos(this.t * 0.45))), 1);
        ctx.drawImage(s.fedora, -11, -6);
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
      case 'gift':
        drawGift(ctx, this.t, Math.sign(this.vx) || 1);
        break;
      case 'drumstick':
        drawDrumstick(ctx, this.t, this.vx);
        break;
      case 'grease':
        drawGrease(ctx, this.t, this.landed > 0);
        break;
      case 'scarab': {
        // a cluster of beetles: each one bobs on its own little orbit
        const d = Math.sign(this.vx) || 1;
        if (d < 0) ctx.scale(-1, 1);
        for (let k = 0; k < 5; k++) {
          const a = this.t * 0.4 + k * 1.3;
          ctx.drawImage(k === 0 ? s.scarabGlow : s.scarab, Math.round(Math.cos(a) * 5 - k * 3) - 5, Math.round(Math.sin(a * 1.3) * 5) - 4);
        }
        break;
      }
      case 'sarcophagus': {
        ctx.restore();
        ctx.save();
        // floor shadow, growing as it falls
        const k = Math.max(0.2, 1 - (this.y - 22) / 220);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(Math.round(sx - 12 * k), FLOOR - 1, Math.round(24 * k), 2);
        // clipped at the floor so it can sink out of sight
        ctx.beginPath();
        ctx.rect(sx - 12, 0, 24, FLOOR);
        ctx.clip();
        ctx.drawImage(s.sarcophagus, sx - 11, sy - 22);
        break;
      }
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
