import { drawRig, fk, groundOffset, PartSet, Pose } from '../gfx/rig';
import { css } from '../gfx/palette';
import { makeCanvas } from '../gfx/painter';

export interface Scene {
  update(): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

const [BUF, B] = makeCanvas(200, 200);

/** Draw a posed figure standing on groundY, optionally scaled and tinted (for silhouettes). */
export function drawFigure(
  ctx: CanvasRenderingContext2D, parts: PartSet, pose: Pose, x: number, groundY: number,
  facing = 1, scale = 1, tint: [string, number] | null = null,
) {
  const s = fk(pose);
  const G = groundOffset(s);
  B.setTransform(1, 0, 0, 1, 0, 0);
  B.clearRect(0, 0, 200, 200);
  B.translate(100, 100);
  B.scale(facing, 1);
  drawRig(B, parts, s);
  if (tint) {
    B.setTransform(1, 0, 0, 1, 0, 0);
    B.globalCompositeOperation = 'source-atop';
    B.fillStyle = css(tint[0], tint[1]);
    B.fillRect(0, 0, 200, 200);
    B.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.translate(Math.round(x), Math.round(groundY - G * scale));
  ctx.scale(scale, scale);
  ctx.drawImage(BUF, -100, -100);
  ctx.restore();
}
