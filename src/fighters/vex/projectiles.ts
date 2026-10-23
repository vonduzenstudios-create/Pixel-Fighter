import type { ProjDef } from '../../game/projectile';
import { rand } from '../../core/rng';
import { playCue } from '../../audio/specials';
import { bits, drawFirewall, drawPacket } from './fighter';

export const PROJECTILES: Record<string, ProjDef> = {
  packet: {
    // a data packet fired at head height: duck it or block it
    stats: { dmg: 80, level: 'mid', effect: 'heavy', r: 7, speed: 4 },
    sounds: { travel: { every: 10, cue: 'dataStream' }, impact: ['packetPop', 'boneCrack'], blocked: 'packetPop', clash: 'packetPop' },
    update(pr, f) {
      // a slight wobble and a trail of stray bits
      pr.y = 52 + Math.sin(pr.t * 0.3) * 2;
      if (pr.t % 3 === 0) f.particles.add({ kind: 'spark', x: pr.x - Math.sign(pr.vx) * 9, y: pr.y + rand(-3, 3), vx: -pr.vx * 0.2, vy: 0, life: 14, max: 14, size: 1, color: ['#30ff70', '#a0ffb8', '#20c0ff'][(pr.t / 3) % 3], floor: false });
    },
    draw(ctx, pr) {
      drawPacket(ctx, pr.t);
    },
    onHit(pr, f) {
      bits(f, pr.x, pr.y, 12, 1.6);
    },
  },
  firewall: {
    // a wall of code flames that bursts out of the floor in front of him and launches
    stats: { dmg: 95, level: 'mid', effect: 'launch', r: 16, speed: 0 },
    selfMoving: true,
    keepAfterHit: true,
    init(pr) {
      pr.vx = 0;
      pr.spent = true;
    },
    update(pr, f) {
      if (pr.t === 1) {
        playCue('firewallRise');
        f.shake(3);
      }
      if (pr.t % 9 === 0 && pr.t < 36) playCue('firewallCrackle');
      // harmless while it is still rising out of the floor and once it starts dying down
      if (pr.t === 4) pr.spent = false;
      if (pr.t > 30) pr.spent = true;
      if (pr.t % 2 === 0) f.particles.add({ kind: 'spark', x: pr.x + rand(-12, 12), y: rand(10, 60), vx: rand(-0.3, 0.3), vy: rand(0.8, 2), life: 18, max: 18, size: 1, color: ['#80ffe0', '#30ff70', '#ffffff'][pr.t % 3], floor: false });
      if (pr.t > 42) pr.dead = true;
    },
    draw(ctx, pr) {
      const k = pr.t < 6 ? pr.t / 6 : pr.t > 32 ? Math.max(0, 1 - (pr.t - 32) / 10) : 1;
      ctx.translate(0, Math.round(pr.y));
      drawFirewall(ctx, pr.t, k);
    },
  },
};
