// Keyboard + gamepad input. Each player gets a RawInput snapshot every frame.
export interface RawInput {
  l: boolean; r: boolean; u: boolean; d: boolean;
  lp: boolean; hp: boolean; lk: boolean; hk: boolean;
  bl: boolean; start: boolean;
  /** Menu back: gamepad B, or P1's high kick key. */
  back: boolean;
}
export const EMPTY: RawInput = { l: false, r: false, u: false, d: false, lp: false, hp: false, lk: false, hk: false, bl: false, start: false, back: false };

const keys = new Set<string>();
const listeners: ((code: string) => void)[] = [];
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  for (const l of listeners) l(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
export const onKey = (f: (code: string) => void) => listeners.push(f);

const K = (c: string) => keys.has(c);
const KEYMAP = [
  {
    l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], d: ['KeyS'],
    lp: ['KeyU'], hp: ['KeyI'], lk: ['KeyJ'], hk: ['KeyK'], bl: ['KeyL', 'Space', 'KeyO'], start: ['Enter'], back: ['KeyK'],
  },
  {
    l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'],
    lp: ['Numpad4', 'BracketLeft'], hp: ['Numpad5', 'BracketRight'], lk: ['Numpad1', 'Semicolon'], hk: ['Numpad2', 'Quote'],
    bl: ['Numpad0', 'Numpad6', 'Slash'], start: ['NumpadEnter', 'Backslash'], back: [],
  },
];

function kb(i: number): RawInput {
  const m = KEYMAP[i] as Record<string, string[]>;
  const o: any = {};
  for (const k in m) o[k] = m[k].some(K);
  return o;
}

function pad(i: number): RawInput | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const list = [...pads].filter((p): p is Gamepad => !!p && p.connected);
  const p = list[i];
  if (!p) return null;
  const b = (n: number) => !!p.buttons[n]?.pressed;
  const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
  // Standard mapping: A=LP, X=HP, B=LK, Y=HK, shoulders/triggers=block.
  return {
    l: b(14) || ax < -0.45, r: b(15) || ax > 0.45, u: b(12) || ay < -0.5, d: b(13) || ay > 0.5,
    lp: b(0), hp: b(2), lk: b(1), hk: b(3), bl: b(4) || b(5) || b(6) || b(7), start: b(9), back: b(1),
  };
}

export function padCount() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return [...pads].filter((p) => p && p.connected).length;
}

const or = (a: RawInput, b: RawInput | null): RawInput => {
  if (!b) return a;
  const o: any = {};
  for (const k in a) o[k] = (a as any)[k] || (b as any)[k];
  return o;
};

/**
 * Input for player slot 0 or 1. With `shared` (single-player menus and 1P fights)
 * player 0 also listens to the second keyboard layout and every gamepad.
 */
export function readPlayer(slot: 0 | 1, shared: boolean): RawInput {
  if (shared && slot === 0) {
    let r = or(kb(0), kb(1));
    for (let i = 0; i < 4; i++) r = or(r, pad(i));
    return r;
  }
  return or(kb(slot), pad(slot));
}

/**
 * Edge detector for menus. The first update only records a baseline, so a button
 * still held from the previous screen doesn't count as a fresh press.
 */
export class Edge {
  prev: RawInput = { ...EMPTY };
  pressed: RawInput = { ...EMPTY };
  private primed = false;
  update(cur: RawInput) {
    if (!this.primed) {
      this.primed = true;
      this.prev = { ...cur };
      this.pressed = { ...EMPTY };
      return this.pressed;
    }
    const p: any = {};
    for (const k in cur) p[k] = (cur as any)[k] && !(this.prev as any)[k];
    this.pressed = p;
    this.prev = { ...cur };
    return this.pressed;
  }
}
