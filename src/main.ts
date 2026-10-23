import { H, W } from './core/consts';
import { endInputFrame, onKey } from './core/input';
import { initAudio } from './audio/audio';
import { loadVoiceLines } from './audio/voicelines';
import { Stage } from './stages/gorge/stage';
import { App, Settings, TitleScene, FightScene, bonesParts } from './scenes/menus';
import { AICtrl } from './game/ai';
import { roster } from './chars/roster';
import type { Scene } from './scenes/common';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const wrap = document.getElementById('wrap') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

function resize() {
  // SNES pixels were slightly wide; stretch 8:7 to roughly 4:3 like a CRT would.
  const aspect = 4 / 3;
  let h = window.innerHeight, w = h * aspect;
  if (w > window.innerWidth) (w = window.innerWidth), (h = w / aspect);
  canvas.style.width = `${Math.floor(w)}px`;
  canvas.style.height = `${Math.floor(h)}px`;
  wrap.style.width = canvas.style.width;
  wrap.style.height = canvas.style.height;
}
window.addEventListener('resize', resize);
resize();

const settings: Settings = { players: 1, diff: 1, stage: 0 };
let scene: Scene;
const app: App = {
  settings,
  stage: new Stage(bonesParts()),
  back: false,
  go(s: Scene) {
    scene = s;
  },
};
scene = new TitleScene(app);

const unlock = () => {
  initAudio();
  loadVoiceLines();
};
window.addEventListener('pointerdown', unlock);
onKey((code) => {
  unlock();
  if (code === 'Escape' || code === 'Backspace') app.back = true;
});

// Fixed 60 Hz simulation with an accumulator so speed is the same on any display.
const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;
function frame(now: number) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP) {
    scene.update();
    endInputFrame();
    acc -= STEP;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  scene.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Hooks for automated testing.
(window as any).__pf = { app, AICtrl, roster, FightScene, get scene() { return scene; } };
