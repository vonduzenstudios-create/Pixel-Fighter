import { DEG } from '../core/consts';

// Cut-out skeletal rig: each body part is its own pixel sprite, rotated around a pivot.
// Angles are in degrees using canvas rotation (clockwise on screen) for a fighter facing right:
//   limbs: 0 = hanging straight down, -90 = pointing forward, -180 = straight up
//   elbow (local): negative bends the forearm forward/up; knee (local): positive bends the shin back
//   torso: 0 = upright, positive leans forward; head is relative to the torso
//   feet (ff/fb): absolute, 0 = flat, positive points the toes down
//   rot spins the whole body around the hips (negative falls backwards)
export interface Pose {
  t?: number; h?: number;
  ab?: number; eb?: number; af?: number; ef?: number;
  lb?: number; kb?: number; lf?: number; kf?: number;
  fb?: number; ff?: number;
  rot?: number; rx?: number; ry?: number;
  /** Angle of a held prop relative to the front forearm. */
  pa?: number;
}
export const POSE_KEYS: (keyof Pose)[] = ['t', 'h', 'ab', 'eb', 'af', 'ef', 'lb', 'kb', 'lf', 'kf', 'fb', 'ff', 'rot', 'rx', 'ry', 'pa'];

export interface Part { img: HTMLCanvasElement; px: number; py: number; }
export interface PartSet {
  torso: Part; head: Part;
  uarm: Part; farm: Part; thigh: Part; shin: Part; foot: Part;
  uarmB: Part; farmB: Part; thighB: Part; shinB: Part; footB: Part;
}
export type PartName = 'torso' | 'head' | 'armF' | 'armB' | 'legF' | 'legB';

export const L = { torso: 24, uarm: 13, farm: 13, thigh: 18, shin: 18 };

type V = [number, number];
const down = (a: number, len: number): V => [-Math.sin(a) * len, Math.cos(a) * len];
const up = (a: number, len: number): V => [Math.sin(a) * len, -Math.cos(a) * len];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];

export interface Skeleton {
  hip: V; hipB: V; hipF: V; sh: V; shB: V; shF: V; neck: V; headTop: V;
  elbowB: V; handB: V; elbowF: V; handF: V;
  kneeB: V; ankleB: V; kneeF: V; ankleF: V;
  heelB: V; toeB: V; heelF: V; toeF: V;
  a: { torso: number; head: number; uarmB: number; farmB: number; uarmF: number; farmF: number;
       thighB: number; shinB: number; thighF: number; shinF: number; footB: number; footF: number; prop: number };
}

/** Forward kinematics in local space (hip at origin, y down, facing right). */
export function fk(p: Pose): Skeleton {
  const g = (k: keyof Pose) => (p[k] ?? 0) * DEG;
  const t = g('t'), rot = g('rot');
  const hip: V = [p.rx ?? 0, p.ry ?? 0];
  const hipB = add(hip, [-2, 0]), hipF = add(hip, [2, 0]);
  const sh = add(hip, up(t, L.torso));
  const shB = add(sh, [-1, 0]), shF = add(sh, [1, 0]);
  const neck = add(hip, up(t, L.torso + 1));
  const headA = t + g('h');
  const headTop = add(neck, up(headA, 15));
  const uB = g('ab'), fB = uB + g('eb'), uF = g('af'), fF = uF + g('ef');
  const elbowB = add(shB, down(uB, L.uarm)), handB = add(elbowB, down(fB, L.farm));
  const elbowF = add(shF, down(uF, L.uarm)), handF = add(elbowF, down(fF, L.farm));
  const tB = g('lb'), sB = tB + g('kb'), tF = g('lf'), sF = tF + g('kf');
  const kneeB = add(hipB, down(tB, L.thigh)), ankleB = add(kneeB, down(sB, L.shin));
  const kneeF = add(hipF, down(tF, L.thigh)), ankleF = add(kneeF, down(sF, L.shin));
  const footB = g('fb'), footF = g('ff');
  const fpt = (ankle: V, a: number, x: number): V => add(ankle, [x * Math.cos(a) - 4 * Math.sin(a), x * Math.sin(a) + 4 * Math.cos(a)]);
  const s: Skeleton = {
    hip, hipB, hipF, sh, shB, shF, neck, headTop, elbowB, handB, elbowF, handF, kneeB, ankleB, kneeF, ankleF,
    heelB: fpt(ankleB, footB, -2), toeB: fpt(ankleB, footB, 9), heelF: fpt(ankleF, footF, -2), toeF: fpt(ankleF, footF, 9),
    a: { torso: t, head: headA, uarmB: uB, farmB: fB, uarmF: uF, farmF: fF, thighB: tB, shinB: sB, thighF: tF, shinF: sF,
         footB, footF, prop: fF + g('pa') },
  };
  if (rot) {
    const c = Math.cos(rot), sn = Math.sin(rot);
    for (const k in s) {
      if (k === 'a') continue;
      const v = (s as any)[k] as V;
      const dx = v[0] - hip[0], dy = v[1] - hip[1];
      (s as any)[k] = [hip[0] + dx * c - dy * sn, hip[1] + dx * sn + dy * c];
    }
    for (const k in s.a) (s.a as any)[k] += rot;
  }
  return s;
}

/** Lowest local y of anything that can touch the floor; used to plant the fighter on the ground. */
export function groundOffset(s: Skeleton): number {
  let m = -1e9;
  for (const v of [s.heelB, s.toeB, s.heelF, s.toeF, s.kneeB, s.kneeF, s.headTop, s.sh, s.hip, s.handB, s.handF])
    if (v[1] > m) m = v[1];
  return m;
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const k of POSE_KEYS) {
    const va = a[k] ?? 0, vb = b[k] ?? 0;
    if (va || vb) out[k] = va + (vb - va) * t;
  }
  return out;
}

export interface RigOpts {
  hidden?: Set<PartName>;
  prop?: Part | null;
  /** Prop drawn behind the front arm instead of in front. */
  propBehind?: boolean;
}

function drawPart(ctx: CanvasRenderingContext2D, p: Part, at: V, ang: number) {
  ctx.save();
  ctx.translate(Math.round(at[0]), Math.round(at[1]));
  ctx.rotate(ang);
  ctx.drawImage(p.img, -p.px, -p.py);
  ctx.restore();
}

/** Draw the rig with its local origin at the current transform origin. */
export function drawRig(ctx: CanvasRenderingContext2D, parts: PartSet, s: Skeleton, o: RigOpts = {}) {
  const hid = o.hidden;
  const a = s.a;
  if (!hid?.has('armB')) {
    drawPart(ctx, parts.uarmB, s.shB, a.uarmB);
    drawPart(ctx, parts.farmB, s.elbowB, a.farmB);
  }
  if (!hid?.has('legB')) {
    drawPart(ctx, parts.thighB, s.hipB, a.thighB);
    drawPart(ctx, parts.shinB, s.kneeB, a.shinB);
    drawPart(ctx, parts.footB, s.ankleB, a.footB);
  }
  if (!hid?.has('legF')) {
    drawPart(ctx, parts.thigh, s.hipF, a.thighF);
    drawPart(ctx, parts.shin, s.kneeF, a.shinF);
    drawPart(ctx, parts.foot, s.ankleF, a.footF);
  }
  if (!hid?.has('torso')) drawPart(ctx, parts.torso, s.hip, a.torso);
  if (!hid?.has('head')) drawPart(ctx, parts.head, s.neck, a.head);
  if (o.prop && o.propBehind) drawPart(ctx, o.prop, s.handF, a.prop);
  if (!hid?.has('armF')) {
    drawPart(ctx, parts.uarm, s.shF, a.uarmF);
    drawPart(ctx, parts.farm, s.elbowF, a.farmF);
  }
  if (o.prop && !o.propBehind) drawPart(ctx, o.prop, s.handF, a.prop);
}

/** World-space tip of a held prop of the given length. */
export function propTip(s: Skeleton, len: number): V {
  return add(s.handF, down(s.a.prop, len));
}
