import { FLOOR, H, MAX_HP, STAGE_W, W } from '../core/consts';
import { Edge, readPlayer } from '../core/input';
import { rand } from '../core/rng';
import { drawText } from '../gfx/font';
import { pxLine } from '../gfx/painter';
import { keg as kegSprite, skull } from '../gfx/props';
import { PartSet, Part } from '../gfx/rig';
import { announce, sfx } from '../audio/sfx';
import { playSong, stopSong } from '../audio/music';
import * as AN from './anims';
import { Fighter } from './fighter';
import { Particles } from './particles';
import { Projectile } from './projectile';
import { Stage } from './stage';
import { THROW } from './moves';
import type { HitDef, Special } from './types';

type Phase = 'intro' | 'fight' | 'ko' | 'finish' | 'fatal' | 'roundEnd' | 'matchEnd';

interface Banner { text: string; t: number; dur: number; scale: number; grad: [string, string] }

const SKULL = (() => { let s: HTMLCanvasElement | null = null; return () => (s ??= skull()); })();
const KEG = (() => { let s: HTMLCanvasElement | null = null; return () => (s ??= kegSprite()); })();

export class Fight {
  projectiles: Projectile[] = [];
  particles = new Particles();
  pitParticles = new Particles();
  camX = (STAGE_W - W) / 2;
  shakeT = 0;
  hitstop = 0;
  round = 1;
  timer = 99;
  timerT = 0;
  phase: Phase = 'intro';
  pt = 0;
  t = 0;
  winner: Fighter | null = null;
  loser: Fighter | null = null;
  matchOver = false;
  banners: Banner[] = [];
  paused = false;
  shownHp = [MAX_HP, MAX_HP];
  fatal: { kind: string; t: number; data: any } | null = null;
  pitView = false;
  hadFatality = false;
  startEdges = [new Edge(), new Edge()];

  constructor(public f: [Fighter, Fighter], public stage: Stage, public humans: [boolean, boolean], public onDone: (winner: Fighter) => void) {
    f[0].opp = f[1];
    f[1].opp = f[0];
    this.particles.floorY = 0;
    this.pitParticles.floorY = -200;
    this.resetRound();
  }

  // ------------------------------------------------------------- helpers used by fighters
  sfx(name: string, arg?: number) {
    switch (name) {
      case 'hitHeavy': sfx.hit(true); break;
      case 'hitLight': sfx.hit(false); break;
      case 'grunt': sfx.grunt(); break;
      default: (sfx as any)[name]?.(arg);
    }
  }
  shake(n: number) {
    this.shakeT = Math.max(this.shakeT, n);
  }
  canFinish(f: Fighter) {
    return this.phase === 'finish' && f === this.winner && this.loser!.state === 'dizzy';
  }
  onSpecial(_f: Fighter, _sp: Special) {}

  tryThrow(a: Fighter): boolean {
    const d = a.opp;
    if (this.phase !== 'fight' || d.airborne) return false;
    if (!['idle', 'walkF', 'walkB', 'crouch', 'block', 'cblock', 'land', 'hitstun'].includes(d.state)) return false;
    if (Math.abs(d.x - a.x) > 34) return false;
    a.startMove(THROW, this);
    d.move = null;
    d.thrower = a;
    d.setState('thrown', AN.THROWN);
    sfx.grunt();
    return true;
  }

  applyDamage(d: Fighter, dmg: number, _from: Fighter) {
    d.hp = Math.max(0, d.hp - dmg);
    if (d.hp === 0 && this.phase === 'fight') this.onKO(d);
  }

  // ------------------------------------------------------------- round flow
  resetRound() {
    this.f[0].resetRound(STAGE_W / 2 - 50);
    this.f[1].resetRound(STAGE_W / 2 + 50);
    this.f[0].facing = 1;
    this.f[1].facing = -1;
    for (const f of this.f) f.locked = true;
    this.projectiles = [];
    this.particles.list = [];
    this.timer = 99;
    this.timerT = 0;
    this.camX = (STAGE_W - W) / 2;
    this.phase = 'intro';
    this.pt = 0;
    this.winner = this.loser = null;
    this.shownHp = [MAX_HP, MAX_HP];
    this.pitView = false;
    this.fatal = null;
  }

  banner(text: string, dur = 90, scale = 3, grad: [string, string] = ['#ffe890', '#d04010']) {
    this.banners = [{ text, t: 0, dur, scale, grad }];
  }

  onKO(loser: Fighter) {
    const w = loser.opp;
    this.winner = w;
    this.loser = loser;
    w.wins++;
    loser.locked = true;
    this.matchOver = w.wins >= 2;
    this.phase = 'ko';
    this.pt = 0;
    this.hitstop = 14;
    this.shake(8);
  }

  timeOver() {
    const [a, b] = this.f;
    if (a.hp === b.hp) {
      this.banner('DRAW', 120);
      this.winner = this.loser = null;
      this.phase = 'roundEnd';
      this.pt = 0;
      for (const f of this.f) f.locked = true;
      return;
    }
    const loser = a.hp < b.hp ? a : b;
    loser.hp = 0;
    this.banner('TIME', 60);
    this.onKO(loser);
    loser.setState('dead', AN.FALL);
    loser.vy = 2;
    loser.y = 1;
  }

  startFatality(w: Fighter) {
    const l = this.loser!;
    this.phase = 'fatal';
    this.pt = 0;
    this.fatal = { kind: w.ch.id, t: 0, data: {} };
    this.hadFatality = true;
    w.locked = true;
    w.move = null;
    w.setState('fatal');
    l.setState('fatal');
    l.poseOverride = AN.DIZZY;
    this.banners = [];
    stopSong();
  }

  startPitFatality(w: Fighter) {
    const l = this.loser!;
    this.phase = 'fatal';
    this.pt = 0;
    this.fatal = { kind: 'pit', t: 0, data: { y: -40, vy: 1, impaled: false, it: 0 } };
    this.hadFatality = true;
    w.locked = true;
    l.setState('fatal', AN.TUMBLE);
    l.vy = 9.5;
    l.y = Math.max(l.y, 4);
    l.vx = 0;
    this.particles.blood(l.x, 70, w.facing, 30, 1.4);
    sfx.hit(true);
    sfx.scream();
    this.banners = [];
    stopSong();
  }

  // ------------------------------------------------------------- main update
  update() {
    this.t++;
    for (let i = 0; i < 2; i++) {
      if (!this.humans[i]) continue;
      const e = this.startEdges[i].update(readPlayer(i as 0 | 1, !this.humans[1]));
      if (e.start && (this.phase === 'fight' || this.paused)) this.paused = !this.paused;
    }
    if (this.paused) return;
    this.pt++;
    for (const b of this.banners) b.t++;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    this.particles.update();
    this.pitParticles.update();
    if (this.shakeT > 0) this.shakeT--;
    for (let i = 0; i < 2; i++) this.shownHp[i] += (this.f[i].hp - this.shownHp[i]) * (this.shownHp[i] > this.f[i].hp ? 0.04 : 1);

    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }

    switch (this.phase) {
      case 'intro':
        if (this.pt === 1) {
          sfx.gong();
          this.banner(`ROUND ${this.round}`, 70, 3, ['#ffffff', '#c0a060']);
          announce(`Round ${this.round}`);
          playSong('fight');
        }
        if (this.pt === 72) {
          this.banner('FIGHT!', 40, 4, ['#fff080', '#e01010']);
          announce('Fight!');
        }
        if (this.pt >= 90) {
          this.phase = 'fight';
          for (const f of this.f) f.locked = false;
        }
        this.step();
        break;
      case 'fight':
        this.step();
        if (++this.timerT >= 60) {
          this.timerT = 0;
          if (--this.timer <= 0) this.timeOver();
        }
        break;
      case 'ko':
        this.step();
        if (this.pt === 60) {
          const l = this.loser!;
          if (this.matchOver && l.hp <= 0) {
            l.y = 0;
            l.vy = 0;
            l.vx = 0;
            l.setState('dizzy', AN.DIZZY_ANIM);
            this.phase = 'finish';
            this.pt = 0;
            this.banner('END THEM!', 120, 3, ['#ffe0e0', '#c00000']);
            announce('End them!');
          } else {
            this.phase = 'roundEnd';
            this.pt = 0;
          }
        }
        break;
      case 'finish':
        this.step();
        if (this.pt > 330 && this.loser!.state === 'dizzy') {
          this.loser!.setState('fall', AN.FALL);
          this.loser!.vy = 2;
          this.loser!.y = 1;
          this.endFinish();
        }
        break;
      case 'fatal':
        this.runFatality();
        break;
      case 'roundEnd':
        this.step();
        if (this.pt === 50 && this.winner) {
          const w = this.winner;
          w.locked = true;
          if (!w.airborne) w.setState('victory', AN.VICTORY_ANIM);
          this.banner(`${w.ch.short} WINS`, 140, 2, ['#ffffff', '#e0c050']);
          announce(`${w.ch.name} wins`);
          if (w.hp === MAX_HP) this.banners.push({ text: 'PERFECT', t: -40, dur: 140, scale: 2, grad: ['#c0ffff', '#2080ff'] });
        }
        if (this.pt >= 210) {
          if (this.matchOver) this.toMatchEnd();
          else {
            this.round++;
            this.resetRound();
          }
        }
        break;
      case 'matchEnd':
        if (!this.pitView) this.step();
        if (this.pt === 1 && this.hadFatality) {
          this.banner('OBLITERATION!', 110, 2, ['#ffe0e0', '#c00000']);
          announce('Obliteration!');
        }
        const at = this.hadFatality ? 110 : 1;
        if (this.pt === at) {
          const w = this.winner!;
          if (!this.pitView && w.state !== 'victory') {
            w.poseOverride = null;
            w.propOverride = null;
            w.setState('victory', AN.VICTORY_ANIM);
          }
          this.banner(`${w.ch.short} WINS`, 200, 2, ['#ffffff', '#e0c050']);
          if (this.hadFatality) announce(`${w.ch.name} wins`);
          playSong('victory', false);
        }
        if (this.pt >= at + 200) this.onDone(this.winner!);
        break;
    }
    if (this.phase !== 'fatal' || !this.pitView) for (const f of this.f) f.computePose();
  }

  endFinish() {
    this.phase = 'roundEnd';
    this.pt = 0;
    this.winner!.locked = true;
  }
  toMatchEnd() {
    this.phase = 'matchEnd';
    this.pt = 0;
  }

  /** One frame of normal fighting simulation. */
  step() {
    const [a, b] = this.f;
    a.readInput(this);
    b.readInput(this);
    a.update(this);
    b.update(this);
    this.separate();
    for (const p of this.projectiles) p.update(this);
    a.computePose();
    b.computePose();
    this.collide();
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const f of this.f) f.projOut = this.projectiles.some((p) => p.owner === f);
    this.updateCamera();
  }

  separate() {
    const [a, b] = this.f;
    const dx = b.x - a.x;
    const ok = (f: Fighter) => f.state !== 'thrown' && f.state !== 'lying' && f.state !== 'dead' && f.alpha > 0;
    if (Math.abs(dx) < 26 && ok(a) && ok(b) && Math.abs(a.y - b.y) < 50) {
      const push = (26 - Math.abs(dx)) / 2;
      const s = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
      a.x -= push * s;
      b.x += push * s;
    }
    // keep both fighters on screen together
    const lo = this.camX + 12, hi = this.camX + W - 12;
    for (const f of this.f) if (f.state !== 'thrown') f.x = Math.max(Math.max(14, lo - 30), Math.min(Math.min(STAGE_W - 14, hi + 30), f.x));
    const span = Math.abs(b.x - a.x);
    if (span > W - 28) {
      const mid = (a.x + b.x) / 2, half = (W - 28) / 2;
      for (const f of this.f) f.x = f.x < mid ? mid - half : mid + half;
    }
  }

  updateCamera() {
    const mid = (this.f[0].x + this.f[1].x) / 2;
    const target = Math.max(0, Math.min(STAGE_W - W, mid - W / 2));
    this.camX += (target - this.camX) * 0.18;
  }

  collide() {
    for (const a of this.f) {
      const hp = a.hitPoint();
      if (!hp) continue;
      const d = a.opp;
      if (d.invulnerable) continue;
      if (circleRect(hp.x, hp.y, hp.hit.r, d.hurtbox())) {
        a.hits++;
        a.lastHit = a.mf - 1;
        this.resolveHit(a, d, hp.hit, hp);
      }
    }
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const d = p.owner.opp;
      for (const q of this.projectiles)
        if (q !== p && !q.dead && q.owner !== p.owner && Math.abs(q.x - p.x) < 12 && Math.abs(q.y - p.y) < 14) {
          p.dead = q.dead = true;
          this.particles.sparks((p.x + q.x) / 2, p.y, 16, '#ffffff');
          sfx.block();
        }
      if (p.dead || d.invulnerable) continue;
      if (circleRect(p.x, p.y, p.r, d.hurtbox())) {
        p.dead = true;
        const hit: HitDef = { limb: 'body', r: p.r, dmg: p.dmg, level: p.level, effect: p.effect, push: 3, stun: 20, special: true };
        this.resolveHit(p.owner, d, hit, { x: p.x, y: p.y }, true);
        if (p.kind === 'cannon' || p.kind === 'keg') {
          sfx.cannon();
          this.particles.smoke(p.x, p.y, 10);
          this.particles.fire(p.x, p.y, 10, 6);
        }
      }
    }
  }

  resolveHit(a: Fighter, d: Fighter, hit: HitDef, at: { x: number; y: number }, projectile = false) {
    if (this.phase === 'finish' && d === this.loser) {
      if (a.move?.id === 'uppercut') {
        this.startPitFatality(a);
        return;
      }
      d.receive({ ...hit, effect: 'knockdown' }, a, this, at, projectile);
      this.particles.blood(at.x, at.y, a.facing, 20);
      sfx.hit(true);
      this.endFinish();
      return;
    }
    const res = d.receive(hit, a, this, at, projectile);
    if (res === 'block') {
      sfx.block();
      this.particles.sparks(at.x, at.y, 6);
      this.hitstop = 3;
      return;
    }
    const heavy = hit.dmg >= 60;
    if (hit.sfx === 'slash') sfx.slash();
    else if (hit.sfx === 'zap') sfx.zap(0.15);
    else sfx.hit(heavy);
    if (hit.sfx === 'zap') this.particles.zap(at.x, at.y, 8);
    if (projectile && (hit.dmg >= 80)) this.particles.fire(at.x, at.y, 6, 4);
    this.particles.blood(at.x, at.y, a.facing, Math.round(hit.dmg / 6), heavy ? 1.3 : 1);
    this.particles.sparks(at.x, at.y, 4, '#ffffff');
    if (Math.random() < 0.5) sfx.blood();
    this.hitstop = heavy ? 7 : 4;
    if (heavy) this.shake(4);
  }

  // ------------------------------------------------------------- finishing moves
  runFatality() {
    const F = this.fatal!;
    const tt = F.t++;
    const w = this.winner!, l = this.loser!;
    const D = F.data;
    const tick = () => {
      w.update(this);
      l.update(this);
      w.computePose();
      l.computePose();
    };
    const done = () => {
      this.toMatchEnd();
    };
    const neck = () => ({ x: l.wx(l.skel.neck[0]), y: l.wy(l.skel.neck[1]) });

    switch (F.kind) {
      case 'lincoln': {
        if (tt < 18) {
          w.x += ((l.x - l.facing * -1 * 0 - w.facing * 30) - w.x) * 0.2;
          w.propOverride = w.ch.props.axe ?? null;
          w.poseOverride = AN.P(AN.STANCE, { af: -205, ef: -10, ab: -195, eb: -10, t: -16, h: -8 });
        }
        if (tt === 22) {
          w.poseOverride = AN.P(AN.STANCE, { af: -70, ef: -4, ab: -64, eb: -6, t: 34, h: 6, lf: -45, kf: 45, lb: 30, kb: 6 });
          sfx.slash();
          const n = neck();
          l.hidden.add('head');
          this.particles.chunk(l.parts.head.img, l.parts.head.px, l.parts.head.py, n.x, n.y, w.facing * 1.6, 5, 0.25 * w.facing);
          this.particles.blood(n.x, n.y, w.facing, 60, 1.6);
          this.shake(10);
          sfx.blood();
        }
        if (tt > 22 && tt < 120) {
          const n = neck();
          this.particles.blood(n.x, n.y + 2, rand(-1, 1), 3, 1.5);
          if (tt % 20 === 0) sfx.blood();
        }
        if (tt === 100) {
          l.poseOverride = null;
          l.setState('fall', AN.FALL);
          l.vy = 1.5;
          l.y = 1;
          l.vx = -w.facing * 0.5;
        }
        tick();
        if (tt >= 210) done();
        break;
      }
      case 'tesla': {
        w.poseOverride = AN.P(AN.STANCE, { af: -92, ef: -2, ab: 30, t: 14, h: -6 });
        if (tt >= 20 && tt < 160) {
          l.shake = 4;
          l.showBones = tt % 6 < 3;
          l.poseOverride = AN.P(AN.HIT_HIGH, { af: -150 + rand(-30, 30), ab: -130 + rand(-30, 30), t: rand(-25, 5), h: rand(-30, 10), rx: rand(-1, 1) });
          if (tt % 10 === 0) sfx.zap(0.2);
          this.particles.zap(l.x + rand(-8, 8), rand(10, 70), 3);
          if (tt === 30) sfx.scream();
        }
        if (tt === 160) {
          l.showBones = true;
          l.poseOverride = AN.P(AN.HIT_HIGH, { af: -150, ab: -120 });
        }
        if (tt === 185) this.collapse(l, true, '#4a4448');
        tick();
        if (tt >= 300) done();
        break;
      }
      case 'joan': {
        w.propOverride = w.ch.props.sword ?? null;
        w.poseOverride = AN.P(AN.VICTORY, { af: -178, ef: -4 });
        if (tt >= 20 && tt < 175) {
          const k = Math.min(1, (tt - 20) / 110);
          l.tint = ['#1a0804', k * 0.85];
          l.poseOverride = tt % 16 < 8 ? AN.HIT_HIGH : AN.P(AN.HIT_MID, { af: -160, ab: -150 });
          for (let i = 0; i < 4; i++) this.particles.fire(l.x + rand(-12, 12), rand(0, 20 + k * 70), 1, 2);
          if (tt % 24 === 0) sfx.fire();
          if (tt === 32) sfx.scream();
          if (tt % 4 === 0) this.particles.smoke(l.x + rand(-8, 8), 70, 1, '#2a2224');
        }
        if (tt === 130) l.showBones = true;
        if (tt === 175) this.collapse(l, true, '#2a2224');
        tick();
        if (tt >= 300) done();
        break;
      }
      case 'blackbeard': {
        const kx0 = w.x + w.facing * 14, kx1 = l.x - w.facing * 6;
        if (tt < 12) w.poseOverride = AN.P(AN.STANCE, { af: 40, ef: -40, t: 10 });
        else if (tt < 24) w.poseOverride = AN.P(AN.CROUCH, { af: -60, ef: -5, t: 40 });
        else w.poseOverride = AN.P(AN.STANCE, { t: -6, af: -60, ef: -110, ab: 20 });
        if (tt >= 12 && tt <= 32) {
          const k = (tt - 12) / 20;
          D.kx = kx0 + (kx1 - kx0) * k;
          D.ky = 8 + Math.sin(k * Math.PI) * 30;
        }
        if (tt > 32 && tt < 95) {
          if (tt % 2 === 0) this.particles.sparks(D.kx, D.ky + 9, 2, '#ffd060');
          if (tt > 40) w.x -= w.facing * 1.2;
        }
        if (tt === 95) {
          D.kx = null;
          sfx.explode();
          this.shake(24);
          this.explode(l);
        }
        tick();
        if (tt >= 300) done();
        break;
      }
      case 'chuck': {
        // close in, a blur of boots, then one roundhouse that sends them into orbit
        const kick = (k: number) =>
          k % 2
            ? AN.P(AN.STANCE, { lb: -128, kb: -4, fb: -40, t: -36, h: 10, af: -10, ef: -40, ab: 10, lf: 6, kf: 4 })
            : AN.P(AN.STANCE, { lf: -120, kf: -4, ff: -30, t: -26, h: 10, af: -30, ef: -70, ab: 30 });
        if (tt < 16) {
          w.x += (l.x - w.facing * 30 - w.x) * 0.2;
          w.poseOverride = AN.P(AN.STANCE, { af: -80, ef: -120, ab: -70, eb: -125, t: -4, h: -6 });
        } else if (tt < 88) {
          const k = Math.floor((tt - 16) / 4);
          w.poseOverride = kick(k);
          if ((tt - 16) % 4 === 1) {
            const hy = rand(30, 70);
            l.poseOverride = k % 2 ? AN.HIT_HIGH : AN.HIT_MID;
            l.shake = 3;
            this.particles.blood(l.x - w.facing * 4, hy, w.facing, 6, 1.1);
            this.particles.sparks(l.x - w.facing * 6, hy, 2, '#ffffff');
            sfx.hit(k % 3 === 0);
            if (k % 4 === 0) sfx.whoosh();
          }
          if (tt === 40) sfx.scream();
        } else if (tt < 100) {
          w.poseOverride = AN.P(AN.STANCE, { t: 25, lb: -30, kb: 90, af: -20, ab: -60 });
          l.poseOverride = AN.DIZZY;
        } else if (tt === 100) {
          w.poseOverride = kick(1);
          sfx.whoosh(true);
          sfx.hit(true);
          sfx.cannon();
          this.shake(16);
          this.particles.blood(l.x, 50, w.facing, 50, 1.8);
          D.fly = true;
          l.vy = 7;
          l.vx = w.facing * 2.2;
          l.y = Math.max(l.y, 4);
        }
        if (D.fly) {
          l.x += l.vx;
          l.y += l.vy;
          l.vy *= 1.02;
          l.poseOverride = AN.P(AN.LAUNCHED, { rot: -(tt - 100) * 24 });
          l.animT++;
          if (tt % 2 === 0) this.particles.blood(l.x, l.y + 40, rand(-1, 1), 2);
          if (l.y > 260) {
            D.fly = false;
            l.alpha = 0;
            D.star = tt;
            D.sx = Math.max(20, Math.min(W - 20, l.x - this.camX));
            sfx.twinkle();
          }
        }
        if (tt === 116) w.poseOverride = AN.P(AN.STANCE, { af: -70, ef: -125, ab: -60, eb: -125, t: 0, h: -10 });
        if (D.star != null && tt === D.star + 80) {
          // what goes up comes back down, in pieces
          const hx = this.camX + D.sx;
          this.particles.chunk(l.parts.head.img, l.parts.head.px, l.parts.head.py, hx, 230, 0, -2, 0.3);
          for (let i = 0; i < 12; i++) this.particles.blood(hx + rand(-30, 30), 230, rand(-1, 1), 3, 0.3);
        }
        if (D.star != null && tt === D.star + 113) {
          sfx.thud();
          this.shake(4);
        }
        w.update(this);
        w.computePose();
        l.computePose();
        if (tt >= 330) done();
        break;
      }
      case 'pit': {
        if (!this.pitView) {
          l.y += l.vy;
          l.vy -= 0.1;
          l.animT++;
          w.update(this);
          w.computePose();
          l.computePose();
          this.particles.blood(l.x, l.y + 40, rand(-1, 1), 1);
          if (l.y > 240) {
            this.pitView = true;
            D.fade = 20;
          }
          this.updateCamera();
        } else {
          if (D.fade > 0) D.fade--;
          if (!D.impaled) {
            D.vy += 0.22;
            D.y += D.vy;
            D.rot = (D.rot ?? 0) - 6;
            if (D.y >= 150) {
              D.impaled = true;
              D.y = 150;
              sfx.impale();
              sfx.scream();
              this.shake(10);
              this.pitParticles.blood(128, H - 150, 1, 60, 1.6);
            }
          } else {
            D.it++;
            if (D.it % 6 === 0) this.pitParticles.blood(128 + rand(-8, 8), H - 152, rand(-1, 1), 2, 0.6);
            if (D.it > 150) done();
          }
        }
        break;
      }
    }
  }

  /** Turn a fighter into a pile of falling bones (and ash). */
  collapse(l: Fighter, bones: boolean, ash: string) {
    const P = bones ? l.bones : l.parts;
    this.spawnParts(l, P, 0.6, 2);
    l.alpha = 0;
    for (let i = 0; i < 30; i++) this.particles.smoke(l.x + rand(-10, 10), rand(0, 70), 1, ash);
    sfx.thud();
  }

  explode(l: Fighter) {
    this.spawnParts(l, l.parts, 4.5, 7);
    l.alpha = 0;
    this.particles.blood(l.x, 40, 1, 80, 2.2);
    this.particles.blood(l.x, 40, -1, 80, 2.2);
    for (let i = 0; i < 40; i++) this.particles.fire(l.x + rand(-20, 20), rand(0, 60), 1, 4);
    for (let i = 0; i < 25; i++) this.particles.smoke(l.x + rand(-24, 24), rand(0, 80), 1);
    this.spawnParts(l, l.bones, 3.5, 6, true);
  }

  spawnParts(l: Fighter, P: PartSet, force: number, up: number, bitsOnly = false) {
    const s = l.skel;
    const list: [Part, [number, number]][] = bitsOnly
      ? [[P.farm, s.elbowB], [P.shin, s.kneeB], [P.foot, s.ankleF]]
      : [
          [P.head, s.neck], [P.torso, s.hip], [P.uarm, s.shF], [P.farm, s.elbowF], [P.uarmB, s.shB], [P.farmB, s.elbowB],
          [P.thigh, s.hipF], [P.shin, s.kneeF], [P.foot, s.ankleF], [P.thighB, s.hipB], [P.shinB, s.kneeB], [P.footB, s.ankleB],
        ];
    for (const [part, at] of list)
      this.particles.chunk(part.img, part.px, part.py, l.wx(at[0]), l.wy(at[1]), rand(-1, 1) * force, rand(0.5, 1) * up, rand(-0.3, 0.3));
  }

  // ------------------------------------------------------------- drawing
  draw(ctx: CanvasRenderingContext2D) {
    const sh = this.shakeT > 0 ? Math.round(rand(-2, 2)) : 0;
    const shy = this.shakeT > 0 ? Math.round(rand(-2, 2)) : 0;
    ctx.save();
    ctx.translate(sh, shy);
    if (this.pitView) this.drawPit(ctx);
    else this.drawArena(ctx);
    ctx.restore();
    this.drawHUD(ctx);
    for (const b of this.banners) {
      if (b.t < 0) continue;
      const y = b.text === 'PERFECT' ? 108 : 80;
      const pop = b.t < 6 ? 1 + (6 - b.t) * 0.0 : 1;
      if (b.t % 30 < 26 || b.t < 30) drawText(ctx, b.text, W / 2, y, '#fff', { scale: Math.round(b.scale * pop), align: 'center', grad: b.grad, outline: '#000', shadow: '#300' });
    }
    if (this.paused) this.drawPause(ctx);
  }

  drawArena(ctx: CanvasRenderingContext2D) {
    const cam = Math.round(this.camX);
    this.stage.draw(ctx, cam, this.t);
    for (const f of this.f) f.drawShadow(ctx, cam);
    // draw the fighter being attacked behind the attacker
    const order = [...this.f].sort((x, y) => (x.state === 'attack' ? 1 : 0) - (y.state === 'attack' ? 1 : 0));
    for (const f of order) f.draw(ctx, cam);
    for (const p of this.projectiles) p.draw(ctx, cam);
    if (this.fatal?.kind === 'blackbeard' && this.fatal.data.kx != null) {
      ctx.save();
      ctx.translate(Math.round(this.fatal.data.kx - cam), Math.round(FLOOR - this.fatal.data.ky));
      ctx.drawImage(KEG(), -9, -9);
      ctx.restore();
    }
    if (this.fatal?.kind === 'tesla' && this.fatal.t > 20 && this.fatal.t < 165) {
      const w = this.winner!, l = this.loser!;
      const hx = w.wx(w.skel.handF[0]) - cam, hy = FLOOR - w.wy(w.skel.handF[1]);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k === 0 ? '#ffffff' : '#7ac0ff';
        let px = hx, py = hy;
        const tx = l.x - cam, ty = FLOOR - rand(20, 70);
        for (let i = 1; i <= 8; i++) {
          const nx = hx + ((tx - hx) * i) / 8 + rand(-5, 5), ny = hy + ((ty - hy) * i) / 8 + rand(-6, 6);
          pxLine(ctx, px, py, nx, ny);
          px = nx; py = ny;
        }
      }
      ctx.fillStyle = 'rgba(160,200,255,0.12)';
      ctx.fillRect(0, 0, W, H);
    }
    this.particles.draw(ctx, cam);
    this.stage.drawFront(ctx, cam, this.t);
    if (this.fatal?.kind === 'chuck' && this.fatal.data.star != null) {
      const k = this.fatal.t - this.fatal.data.star;
      if (k < 60) {
        // twinkle where they left the atmosphere
        const r = k < 10 ? k * 0.7 : Math.max(0, 7 - (k - 10) / 7);
        const x = Math.round(this.fatal.data.sx), y = 44;
        ctx.fillStyle = k % 6 < 3 ? '#ffffff' : '#fff0a0';
        ctx.fillRect(x - Math.round(r * 2), y, Math.round(r * 4) + 1, 1);
        ctx.fillRect(x, y - Math.round(r * 2), 1, Math.round(r * 4) + 1);
        ctx.fillRect(x - Math.round(r / 2), y - Math.round(r / 2), Math.round(r) + 1, Math.round(r) + 1);
      }
    }
  }

  drawPit(ctx: CanvasRenderingContext2D) {
    const D = this.fatal?.data ?? { y: 150, rot: -90, impaled: true };
    ctx.drawImage(this.stage.pit, 0, 0);
    const l = this.loser!;
    const pose = D.impaled ? AN.P(AN.LIE, { rot: -100, h: 40, af: -60, ef: -20, ab: 60, lf: 30, kf: 40, lb: 40, kb: 50 }) : AN.P(AN.LAUNCHED, { rot: D.rot });
    l.hidden.clear();
    l.alpha = 1;
    l.tint = null;
    l.showBones = false;
    l.poseOverride = pose;
    l.y = 0;
    l.vy = 0;
    l.computePose();
    // draw the victim with the normal renderer, then a spike tip poking through the body
    const savedX = l.x;
    l.x = 128;
    l.G = 0;
    l.draw(ctx, 0, Math.round(D.y));
    l.x = savedX;
    if (D.impaled) {
      ctx.fillStyle = '#8a8290';
      ctx.fillRect(127, D.y - 22, 2, 14);
      ctx.fillRect(128, D.y - 26, 1, 4);
      ctx.fillStyle = '#c01010';
      ctx.fillRect(127, D.y - 14, 2, 6);
    }
    this.pitParticles.draw(ctx, 0, H);
    if (D.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${D.fade / 20})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawHUD(ctx: CanvasRenderingContext2D) {
    const bw = 100;
    for (let i = 0; i < 2; i++) {
      const f = this.f[i];
      const x = i === 0 ? 10 : W - 10 - bw, y = 12;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 2, y - 2, bw + 4, 13);
      ctx.fillStyle = '#e8d8a0';
      ctx.fillRect(x - 1, y - 1, bw + 2, 11);
      ctx.fillStyle = '#300';
      ctx.fillRect(x, y, bw, 9);
      const shown = Math.round((this.shownHp[i] / MAX_HP) * bw), cur = Math.round((f.hp / MAX_HP) * bw);
      ctx.fillStyle = '#c01818';
      if (i === 0) ctx.fillRect(x, y, shown, 9);
      else ctx.fillRect(x + bw - shown, y, shown, 9);
      const g = f.hp < MAX_HP * 0.25 ? ['#e8c020', '#a07010'] : ['#40d040', '#108018'];
      ctx.fillStyle = g[1];
      if (i === 0) ctx.fillRect(x, y, cur, 9);
      else ctx.fillRect(x + bw - cur, y, cur, 9);
      ctx.fillStyle = g[0];
      if (i === 0) ctx.fillRect(x, y, cur, 3);
      else ctx.fillRect(x + bw - cur, y, cur, 3);
      drawText(ctx, f.ch.short, i === 0 ? x + 2 : x + bw - 2, y + 1, '#fff', { align: i === 0 ? 'left' : 'right', outline: '#000' });
      for (let k = 0; k < f.wins; k++) ctx.drawImage(SKULL(), i === 0 ? x + k * 11 : x + bw - 9 - k * 11, y + 13);
    }
    drawText(ctx, String(Math.max(0, this.timer)).padStart(2, '0'), W / 2, 9, '#fff', { scale: 2, align: 'center', grad: ['#fff8c0', '#e0a030'], outline: '#000' });
  }

  drawPause(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'PAUSED', W / 2, 30, '#fff', { scale: 2, align: 'center', grad: ['#ffe890', '#d04010'], outline: '#000' });
    const list = this.humans[1] ? [this.f[0], this.f[1]] : [this.f[0]];
    let y = 56;
    for (const f of list) {
      drawText(ctx, f.ch.name, 16, y, '#e0c050');
      y += 11;
      for (const sp of f.ch.specials) {
        drawText(ctx, sp.name, 20, y, '#ddd');
        drawText(ctx, sp.text, W - 16, y, '#8cf', { align: 'right' });
        y += 9;
      }
      drawText(ctx, f.ch.finisher.name, 20, y, '#f66');
      y += 9;
      drawText(ctx, f.ch.finisher.text, W - 16, y, '#f99', { align: 'right' });
      y += 14;
    }
    drawText(ctx, 'STAGE FINISH: UPPERCUT (D+HP) WHEN THEY ARE DAZED', W / 2, y, '#fa8', { align: 'center' });
    drawText(ctx, 'PRESS START TO RESUME', W / 2, H - 16, '#fff', { align: 'center' });
  }
}


function circleRect(cx: number, cy: number, r: number, b: [number, number, number, number]) {
  const nx = Math.max(b[0], Math.min(cx, b[2])), ny = Math.max(b[1], Math.min(cy, b[3]));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}
