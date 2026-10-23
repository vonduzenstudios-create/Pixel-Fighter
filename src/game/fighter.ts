import { FLOOR, GRAV, MAX_HP, STAGE_W } from '../core/consts';
import { EMPTY, RawInput } from '../core/input';
import { makeCanvas } from '../gfx/painter';
import { css } from '../gfx/palette';
import { drawRig, fk, groundOffset, Part, PartName, PartSet, Pose, propTip, Skeleton } from '../gfx/rig';
import * as AN from './anims';
import * as MV from './moves';
import type { Fight } from './fight';
import type { Anim, Btn, Finisher, HitDef, Move, PropName, Special } from './types';
import type { Look } from '../chars/build';
import { chance } from '../core/rng';
import { strengthOf } from '../audio/sfx';

export interface CharDef {
  id: string;
  name: string;
  /** Short name for the health bar. */
  short: string;
  title: string;
  look: Look;
  alt: Look;
  specials: Special[];
  finisher: Finisher;
  /** Pitch of grunts. */
  voice: number;
  props: Partial<Record<PropName, Part>>;
  /** Finishing move driven by the character itself, run once per frame. Returns true when it is over. */
  fatality?: (fight: Fight, winner: Fighter, loser: Fighter, t: number, data: any) => boolean;
}

export interface Controller {
  read(self: Fighter, fight: Fight): RawInput;
}

const NEUTRAL = new Set(['idle', 'walkF', 'walkB', 'crouch', 'block', 'cblock', 'land']);
const BLOCKABLE = new Set(['idle', 'walkF', 'walkB', 'crouch', 'block', 'cblock', 'blockstun', 'land', 'prejump']);
const AIR_HIP = 40;

const [BUF, BCTX] = makeCanvas(200, 200);
const BO = 100; // buffer origin

export class Fighter {
  x = 0; y = 0; vx = 0; vy = 0;
  facing: 1 | -1 = 1;
  hp = MAX_HP;
  state = 'idle';
  t = 0;
  anim: Anim = AN.IDLE;
  animT = 0;
  move: Move | null = null;
  mf = 0;
  lastHit = -99;
  hits = 0;
  stun = 0;
  juggle = 0;
  airAttacked = false;
  jumpDir = 0;
  frame = 0;
  input: RawInput = { ...EMPTY };
  prev: RawInput = { ...EMPTY };
  pressed: RawInput = { ...EMPTY };
  hist: { d: number; f: number }[] = [{ d: 5, f: 0 }];
  skel: Skeleton;
  G = 0;
  pose: Pose = AN.STANCE;
  poseOverride: Pose | null = null;
  hidden = new Set<PartName>();
  showBones = false;
  tint: [string, number] | null = null;
  alpha = 1;
  locked = false;
  projOut = false;
  thrower: Fighter | null = null;
  wins = 0;
  opp!: Fighter;
  shake = 0;

  constructor(public ch: CharDef, public parts: PartSet, public bones: PartSet, public ctrl: Controller, public side: 0 | 1) {
    this.skel = fk(AN.STANCE);
  }

  resetRound(x: number) {
    this.x = x;
    this.y = this.vx = this.vy = 0;
    this.hp = MAX_HP;
    this.state = 'idle';
    this.setAnim(AN.IDLE);
    this.move = null;
    this.stun = 0;
    this.juggle = 0;
    this.hidden.clear();
    this.showBones = false;
    this.tint = null;
    this.alpha = 1;
    this.poseOverride = null;
    this.projOut = false;
    this.locked = false;
    this.thrower = null;
  }

  setAnim(a: Anim, restart = true) {
    if (this.anim === a && !restart) return;
    this.anim = a;
    this.animT = 0;
  }
  setState(s: string, a?: Anim) {
    this.state = s;
    this.t = 0;
    if (a) this.setAnim(a);
  }

  get airborne() {
    return this.y > 0 || this.vy > 0;
  }
  /** Relative direction in numpad notation: 6 = toward the opponent. */
  dirOf(i: RawInput) {
    const fwd = this.facing === 1 ? i.r : i.l, back = this.facing === 1 ? i.l : i.r;
    const h = fwd && !back ? 1 : back && !fwd ? -1 : 0;
    const v = i.u ? 1 : i.d ? -1 : 0;
    return 5 + h + v * 3;
  }
  get dir() {
    return this.dirOf(this.input);
  }
  get holdingBack() {
    const d = this.dir;
    return d === 4 || d === 1;
  }
  get crouching() {
    const d = this.dir;
    return d === 1 || d === 2 || d === 3;
  }

  /** Did the player input this direction sequence recently (button pressed now)? */
  matchCmd(cmd: number[], window = 20) {
    let j = cmd.length - 1;
    for (let i = this.hist.length - 1; i >= 0; i--) {
      const h = this.hist[i];
      const end = i === this.hist.length - 1 ? this.frame : this.hist[i + 1].f;
      if (end < this.frame - window) break;
      if (h.d === cmd[j]) {
        if (j === cmd.length - 1 && end < this.frame - 8) return false;
        j--;
        if (j < 0) return true;
      }
    }
    return false;
  }

  btnPressed(b: Btn | 'p' | 'k') {
    const p = this.pressed;
    if (b === 'p') return p.lp || p.hp;
    if (b === 'k') return p.lk || p.hk;
    return p[b];
  }

  // ---------------------------------------------------------------- update
  readInput(f: Fight) {
    this.frame++;
    const raw = this.locked ? { ...EMPTY } : this.ctrl.read(this, f);
    this.prev = this.input;
    this.input = raw;
    const p: any = {};
    for (const k in raw) p[k] = (raw as any)[k] && !(this.prev as any)[k];
    this.pressed = p;
    const d = this.dir;
    if (this.hist[this.hist.length - 1].d !== d) {
      this.hist.push({ d, f: this.frame });
      if (this.hist.length > 32) this.hist.shift();
    }
  }

  faceOpp() {
    if (Math.abs(this.opp.x - this.x) > 2) this.facing = this.opp.x > this.x ? 1 : -1;
  }

  update(f: Fight) {
    this.t++;
    this.animT++;
    if (this.shake > 0) this.shake--;
    const s = this.state;

    if (NEUTRAL.has(s) && !this.airborne) {
      if (s !== 'land' || this.t >= 5) {
        this.faceOpp();
        if (!this.tryAttack(f)) this.neutral(f);
      }
    } else if (s === 'prejump') {
      if (this.t >= 4) {
        this.vy = 6.4;
        this.y = 0.1;
        this.vx = this.jumpDir * 2.3 * this.facing;
        this.airAttacked = false;
        this.setState('jump', this.jumpDir ? AN.FLIP(this.jumpDir) : AN.JUMP_UP);
        f.sfx('jump');
      }
    } else if (s === 'jump') {
      if (!this.airAttacked) this.tryAirAttack(f);
    } else if (s === 'attack') {
      this.updateMove(f);
    } else if (s === 'hitstun' || s === 'blockstun') {
      this.vx *= 0.8;
      if (--this.stun <= 0) {
        this.setState(this.crouching ? 'crouch' : 'idle', this.crouching ? AN.CROUCH_IDLE : AN.IDLE);
      }
    } else if (s === 'lying') {
      this.vx *= 0.7;
      if (this.t > 26 && this.hp > 0 && !this.locked) this.setState('getup', AN.GETUP);
    } else if (s === 'getup') {
      if (this.t >= 26) {
        this.juggle = 0;
        this.faceOpp();
        this.setState('idle', AN.IDLE);
      }
    } else if (s === 'thrown') {
      this.updateThrown(f);
      return;
    } else if (s === 'dizzy') {
      this.vx *= 0.8;
      // reel from a hit, then go back to swaying
      if (this.stun > 0 && --this.stun === 0) this.setAnim(AN.DIZZY_ANIM);
    } else if (s === 'victory' || s === 'fatal' || s === 'dead') {
      this.vx *= 0.8;
    }

    // physics
    this.x += this.vx;
    if (this.airborne) {
      this.y += this.vy;
      this.vy -= GRAV;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.land(f);
      }
    } else if (s !== 'attack') {
      this.vx *= 0.82;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }
    this.x = Math.max(14, Math.min(STAGE_W - 14, this.x));
  }

  neutral(f: Fight) {
    const d = this.dir;
    const i = this.input;
    if (d >= 7) {
      this.jumpDir = d === 9 ? 1 : d === 7 ? -1 : 0;
      this.setState('prejump', AN.PREJUMP);
      return;
    }
    if (i.bl) {
      const st = d <= 3 ? 'cblock' : 'block';
      if (this.state !== st) this.setState(st, st === 'cblock' ? AN.CBLOCK_ANIM : AN.BLOCK_ANIM);
      return;
    }
    if (d <= 3) {
      if (this.state !== 'crouch') this.setState('crouch', AN.CROUCH_ANIM);
      return;
    }
    if (d === 6) {
      if (this.state !== 'walkF') this.setState('walkF', AN.WALK);
      this.x += 1.7 * this.facing;
    } else if (d === 4) {
      if (this.state !== 'walkB') this.setState('walkB', AN.WALK);
      this.x -= 1.35 * this.facing;
      this.animT -= 2; // play the walk cycle backwards
    } else if (this.state !== 'idle') this.setState('idle', AN.IDLE);
  }

  pressedButton(): Btn | null {
    const p = this.pressed;
    return p.hp ? 'hp' : p.hk ? 'hk' : p.lp ? 'lp' : p.lk ? 'lk' : null;
  }

  tryAttack(f: Fight): boolean {
    const b = this.pressedButton();
    if (!b) return false;
    // finishing move during the "end them" window
    if (f.canFinish(this)) {
      const fin = this.ch.finisher;
      const dist = Math.abs(this.opp.x - this.x);
      if (b === fin.btn && this.matchCmd(fin.cmd, 40) && dist >= fin.range[0] && dist <= fin.range[1]) {
        f.startFatality(this);
        return true;
      }
    }
    const specials = [...this.ch.specials].sort((a, z) => z.cmd.length - a.cmd.length);
    for (const sp of specials) {
      const btnOk = sp.btn === 'p' ? b === 'lp' || b === 'hp' : sp.btn === 'k' ? b === 'lk' || b === 'hk' : sp.btn === b;
      if (btnOk && this.matchCmd(sp.cmd)) {
        if (sp.move.id.startsWith('proj') && this.projOut) continue;
        this.startMove(sp.move, f);
        f.onSpecial(this, sp);
        return true;
      }
    }
    const d = this.dir;
    const dist = Math.abs(this.opp.x - this.x);
    let m: Move;
    if (d <= 3) m = b === 'lp' ? MV.CROUCH_PUNCH : b === 'hp' ? MV.UPPERCUT : b === 'lk' ? MV.CROUCH_KICK : MV.CROUCH_HIGH_KICK;
    else if (d === 4) m = b === 'lk' ? MV.SWEEP : b === 'hk' ? MV.ROUNDHOUSE : b === 'lp' ? MV.JAB : MV.HIGH_PUNCH;
    else if (d === 6 && b === 'lp' && dist < 34) {
      if (f.tryThrow(this)) return true;
      m = MV.JAB;
    } else m = b === 'lp' ? MV.JAB : b === 'hp' ? MV.HIGH_PUNCH : b === 'lk' ? MV.LOW_KICK : MV.HIGH_KICK;
    this.startMove(m, f);
    return true;
  }

  tryAirAttack(f: Fight) {
    const b = this.pressedButton();
    if (!b || this.t < 3) return;
    this.airAttacked = true;
    this.startMove(b === 'lp' || b === 'hp' ? MV.JUMP_PUNCH : MV.JUMP_KICK, f);
  }

  startMove(m: Move, f: Fight) {
    this.move = m;
    this.mf = 0;
    this.hits = 0;
    this.lastHit = -99;
    this.state = 'attack';
    this.t = 0;
    this.moveDir = this.facing;
    this.setAnim(m.anim);
    if (!m.air && !this.airborne) this.vx = 0;
  }

  updateMove(f: Fight) {
    const m = this.move!;
    const fr = this.mf++;
    if (m.active && fr === m.active[0] && (m.whoosh || (m.hit && !m.hit.special)))
      f.sfx('whoosh', m.hit ? strengthOf(m.hit.dmg) : 1, m.hit?.limb.startsWith('toe'));
    if (m.vx !== undefined) {
      const v = typeof m.vx === 'function' ? m.vx(fr) : m.vx;
      this.x += v * this.moveDir;
    }
    if (m.spin && fr % m.spin === 0 && fr > 0) this.facing = (this.facing * -1) as 1 | -1;
    m.onFrame?.(this, f, fr);
    if (m.invisible) this.alpha = fr >= m.invisible[0] && fr < m.invisible[1] ? 0 : 1;
    const len = AN.animLength(m.anim);
    if (m.air) {
      if (!this.airborne && fr > 2) this.endMove();
    } else if (fr >= len) this.endMove();
  }

  endMove() {
    const wasCrouch = this.move?.crouch;
    this.move = null;
    this.alpha = 1;
    if (this.airborne) {
      this.setState('jump', AN.A([[AN.TUCK, 1]]));
      this.airAttacked = true;
      return;
    }
    this.faceOpp();
    if (wasCrouch && this.crouching) this.setState('crouch', AN.CROUCH_IDLE);
    else this.setState('idle', AN.IDLE);
  }

  land(f: Fight) {
    const s = this.state;
    if (s === 'jump' || (s === 'attack' && this.move?.air)) {
      this.move = null;
      this.vx = 0;
      this.alpha = 1;
      this.faceOpp();
      this.setState('land', AN.LAND);
      f.sfx('land');
    } else if (s === 'launched' || s === 'fall') {
      this.vx *= 0.4;
      f.sfx('thud');
      f.shake(3);
      this.setState('lying', AN.BOUNCE);
      if (this.hp <= 0) this.state = 'dead';
    } else if (s === 'attack') {
      // a grounded special that hopped (e.g. a rising uppercut) finishing in the air
      if (this.mf >= AN.animLength(this.move!.anim)) this.endMove();
    }
  }

  updateThrown(f: Fight) {
    const a = this.thrower!;
    const T = 24;
    const k = Math.min(1, this.t / T);
    const th = k * Math.PI;
    this.x = a.x + a.facing * 22 * Math.cos(th);
    this.y = Math.sin(th) * 38;
    this.poseOverride = AN.P(AN.LAUNCHED, { rot: -k * 200 });
    if (this.t >= T) {
      this.poseOverride = null;
      this.thrower = null;
      this.vy = 1.5;
      this.y = Math.max(this.y, 4);
      this.vx = -a.facing * 1.6;
      this.facing = a.facing;
      this.setState('fall', AN.FALL);
      f.applyDamage(this, 110, a);
      f.sfx('hitHeavy');
      f.particles.blood(this.x, 20, -a.facing, 10);
    }
  }

  // ---------------------------------------------------------------- combat queries
  get invulnerable() {
    const s = this.state;
    return s === 'lying' || s === 'getup' || s === 'thrown' || s === 'dead' || s === 'fatal' || this.alpha === 0 || ((s === 'launched' || s === 'fall') && this.juggle >= 3);
  }

  /** Active hitbox centre in world space (x, height), or null. */
  hitPoint(): { x: number; y: number; hit: HitDef } | null {
    const m = this.move;
    if (this.state !== 'attack' || !m?.hit || !m.active) return null;
    const fr = this.mf - 1;
    if (fr < m.active[0] || fr >= m.active[1]) return null;
    if (this.hits > 0 && !(m.hit.rehit && fr - this.lastHit >= m.hit.rehit)) return null;
    const s = this.skel;
    let v: [number, number];
    switch (m.hit.limb) {
      case 'handF': v = s.handF; break;
      case 'handB': v = s.handB; break;
      case 'toeF': v = s.toeF; break;
      case 'toeB': v = s.toeB; break;
      case 'kneeF': v = s.kneeF; break;
      case 'prop': v = propTip(s, 26); break;
      default: v = [s.hip[0] + 6, s.hip[1] - 14];
    }
    return { x: this.wx(v[0]), y: this.wy(v[1]), hit: m.hit };
  }
  wx(lx: number) {
    return this.x + this.facing * lx;
  }
  wy(ly: number) {
    return this.y + this.G - ly;
  }
  /** Hurtbox [x0, y0, x1, y1] in world space (y = height above floor). */
  hurtbox(): [number, number, number, number] {
    const s = this.skel;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const v of [s.headTop, s.neck, s.sh, s.hip, s.kneeB, s.kneeF, s.ankleB, s.ankleF]) {
      const X = this.wx(v[0]), Y = this.wy(v[1]);
      x0 = Math.min(x0, X); x1 = Math.max(x1, X);
      y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
    }
    const cx = this.wx(s.hip[0]);
    x0 = Math.min(x0 - 2, cx - 9);
    x1 = Math.max(x1 + 2, cx + 9);
    return [x0, Math.max(0, y0 - 2), x1, y1 + 2];
  }

  canBlockNow(level: string) {
    if (this.airborne || !BLOCKABLE.has(this.state)) return false;
    if (!(this.input.bl || this.holdingBack)) return false;
    const low = this.crouching || this.state === 'cblock' || this.state === 'crouch';
    return low ? level !== 'overhead' : level !== 'low';
  }

  /** Take a hit while dazed during the finisher window: reel, but stay on your feet. */
  reel(from: Fighter, at: { x: number; y: number }) {
    const away = this.x >= from.x ? 1 : -1;
    this.setAnim(at.y > this.y + 52 ? AN.HITSTUN_HIGH : AN.HITSTUN_MID);
    this.stun = 16;
    this.shake = 6;
    this.vx = away * 2.2;
  }

  /** Apply a hit that connected. Returns 'block' or 'hit'. */
  receive(hit: HitDef, from: Fighter, f: Fight, at: { x: number; y: number }, projectile = false): 'block' | 'hit' {
    const away = this.x >= from.x ? 1 : -1;
    const ctr = this.state === 'attack' ? this.move?.counter : undefined;
    if (ctr && this.mf >= ctr.from && this.mf < ctr.to) {
      this.faceOpp();
      this.startMove(ctr.move, f);
      return 'block';
    }
    if (this.canBlockNow(hit.level)) {
      const low = this.crouching;
      this.setState('blockstun', low ? AN.CBLOCK_ANIM : AN.BLOCK_ANIM);
      this.stun = Math.round((hit.stun ?? 14) * 0.6);
      this.vx = away * (hit.push ?? 3) * 0.8;
      if (hit.special || projectile) f.applyDamage(this, Math.round(hit.dmg * 0.18), from);
      return 'block';
    }
    const scale = this.state === 'launched' || this.state === 'fall' ? 0.7 : 1;
    f.applyDamage(this, Math.round(hit.dmg * scale), from);
    if (chance(0.45)) f.sfx('grunt', this.ch.voice);
    this.move = null;
    this.alpha = 1;
    this.shake = 6;
    const eff = hit.effect;
    if (this.airborne || this.state === 'launched' || this.state === 'fall') {
      this.juggle++;
      this.vy = eff === 'launch' ? Math.max(3, 6.5 - this.juggle * 1.2) : 3.2;
      this.vx = away * 1.8;
      this.y = Math.max(this.y, 1);
      this.setState(eff === 'launch' ? 'launched' : 'fall', eff === 'launch' ? AN.TUMBLE : AN.FALL);
    } else if (eff === 'launch') {
      const [up, out] = hit.lift ?? [7.4, 1.7];
      this.vy = up;
      this.y = 1;
      this.vx = away * out;
      this.juggle = 1;
      this.setState('launched', AN.TUMBLE);
    } else if (eff === 'knockdown' || eff === 'sweep') {
      this.vy = eff === 'sweep' ? 2.6 : 3.6;
      this.y = 1;
      this.vx = away * (eff === 'sweep' ? 0.8 : 2.6);
      this.juggle = 1;
      this.setState('fall', AN.FALL);
    } else {
      const crouch = this.state === 'crouch' || this.state === 'cblock' || (this.move as any)?.crouch;
      const high = at.y > this.y + 52;
      this.setState('hitstun', crouch ? AN.HITSTUN_CROUCH : high ? AN.HITSTUN_HIGH : AN.HITSTUN_MID);
      this.stun = hit.stun ?? 14;
      this.vx = away * (hit.push ?? 3);
    }
    return 'hit';
  }

  // ---------------------------------------------------------------- pose + render
  computePose() {
    const pose = this.poseOverride ?? AN.sample(this.anim, this.animT);
    this.pose = pose;
    this.skel = fk(pose);
    const grounded = !this.airborne && this.state !== 'thrown';
    this.G = grounded ? groundOffset(this.skel) : AIR_HIP;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, groundY = FLOOR) {
    if (this.alpha <= 0) return;
    const sx = Math.round(this.x - camX) + (this.shake > 0 ? (this.shake % 2 ? 1 : -1) : 0);
    const sy = Math.round(groundY - this.y - this.G);
    const b = BCTX;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, 200, 200);
    b.translate(BO, BO);
    b.scale(this.facing, 1);
    const m = this.move;
    const prop = m?.prop ? this.ch.props[m.prop] ?? null : this.propOverride;
    drawRig(b, this.showBones ? this.bones : this.parts, this.skel, { hidden: this.hidden, prop, propBehind: m?.propBehind });
    if (this.tint) {
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalCompositeOperation = 'source-atop';
      b.fillStyle = css(this.tint[0], this.tint[1]);
      b.fillRect(0, 0, 200, 200);
      b.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = this.alpha;
    ctx.drawImage(BUF, sx - BO, sy - BO);
    ctx.globalAlpha = 1;
  }
  propOverride: Part | null = null;
  moveDir: 1 | -1 = 1;

  drawShadow(ctx: CanvasRenderingContext2D, camX: number, groundY = FLOOR) {
    if (this.alpha <= 0) return;
    const w = Math.max(8, 26 - this.y * 0.15);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const cx = Math.round(this.x - camX);
    ctx.fillRect(cx - w / 2, groundY, w, 2);
    ctx.fillRect(cx - w / 2 + 3, groundY + 2, w - 6, 1);
  }
}
