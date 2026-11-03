// Ai generated rigging for the character skeleton, reviewed by me and playtested

import {
  BRASS,
  DARK_CRIMSON,
  DEEP_RED,
  GUNMETAL,
  NEAR_BLACK,
  PALE_GREEN,
  SIGNAL_GREEN,
  SLATE_DARK,
  STEEL_LIGHT,
  TOMB_TEAL,
  VOID_DARK,
} from './palette';
import type { Facing } from './units';

export const PART_SIZE = 32;

export const UNIT_SCALE = 2;

export type PartName = 'head' | 'torso' | 'robes' | 'legs' | 'dendriteL' | 'dendriteR' | 'weaponArm';

export interface PartDef {
  anchorX: number;
  anchorY: number;
  flipForLeft: boolean;
}

export const PARTS: Record<PartName, PartDef> = {
  head: { anchorX: 16, anchorY: 31, flipForLeft: true },
  torso: { anchorX: 16, anchorY: 31, flipForLeft: true },
  robes: { anchorX: 16, anchorY: 31, flipForLeft: false },
  legs: { anchorX: 16, anchorY: 31, flipForLeft: false },
  dendriteL: { anchorX: 16, anchorY: 31, flipForLeft: true },
  dendriteR: { anchorX: 16, anchorY: 31, flipForLeft: true },
  weaponArm: { anchorX: 16, anchorY: 31, flipForLeft: true },
};

export function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, w, h);
}

function outlinedRect(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  w: number,
  h: number,
  color: string,
): void {
  drawPixelRect(ctx, px - 1, py - 1, w + 2, h + 2, NEAR_BLACK);
  drawPixelRect(ctx, px, py, w, h, color);
}

function makeCanvas(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PART_SIZE;
  canvas.height = PART_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  return canvas;
}

type Pose = 'front' | 'back' | 'side';

const DENDRITE_L_ROOT = { x: 11, y: 10 };
const DENDRITE_R_ROOT = { x: 10, y: 13 };
const WRITHE_RADIANS = (10 * Math.PI) / 180;

interface RigCanvases {
  head: Record<Pose, HTMLCanvasElement>;
  torso: Record<Pose, HTMLCanvasElement>;
  robes: HTMLCanvasElement;
  legs: [HTMLCanvasElement, HTMLCanvasElement];
  dendriteL: HTMLCanvasElement;
  dendriteR: HTMLCanvasElement;
  weaponArm: HTMLCanvasElement;
}

let rig: RigCanvases | null = null;

function paintHeadSide(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 11, 3, 8, 7, DEEP_RED);
  drawPixelRect(ctx, 11, 3, 2, 7, DARK_CRIMSON);
  drawPixelRect(ctx, 15, 5, 4, 4, DARK_CRIMSON);
  drawPixelRect(ctx, 17, 6, 1, 1, SIGNAL_GREEN);
}

function paintHeadFront(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 10, 3, 11, 7, DEEP_RED);
  drawPixelRect(ctx, 10, 3, 11, 1, BRASS);
  drawPixelRect(ctx, 12, 5, 7, 4, DARK_CRIMSON);
  drawPixelRect(ctx, 13, 6, 1, 1, SIGNAL_GREEN);
  drawPixelRect(ctx, 17, 6, 1, 1, SIGNAL_GREEN);
}

function paintHeadBack(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 11, 3, 9, 7, DEEP_RED);
  drawPixelRect(ctx, 13, 3, 5, 7, DARK_CRIMSON);
  drawPixelRect(ctx, 11, 9, 9, 1, BRASS);
}

function paintTorsoSide(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 11, 10, 9, 6, GUNMETAL);
  drawPixelRect(ctx, 18, 10, 2, 6, STEEL_LIGHT);
  drawPixelRect(ctx, 12, 12, 2, 2, VOID_DARK);
  drawPixelRect(ctx, 11, 15, 9, 1, BRASS);
}

function paintTorsoFront(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 10, 10, 11, 6, GUNMETAL);
  drawPixelRect(ctx, 12, 12, 7, 2, VOID_DARK);
  drawPixelRect(ctx, 14, 12, 3, 2, SIGNAL_GREEN);
  drawPixelRect(ctx, 10, 15, 11, 1, BRASS);
}

function paintTorsoBack(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 10, 10, 11, 6, GUNMETAL);
  outlinedRect(ctx, 12, 7, 7, 4, VOID_DARK);
  drawPixelRect(ctx, 14, 8, 1, 1, SIGNAL_GREEN);
  drawPixelRect(ctx, 10, 15, 11, 1, BRASS);
}

function paintRobes(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 10, 16, 11, 8, DEEP_RED);
  drawPixelRect(ctx, 10, 16, 2, 8, DARK_CRIMSON);
  drawPixelRect(ctx, 13, 22, 1, 2, DARK_CRIMSON);
  drawPixelRect(ctx, 17, 21, 1, 3, DARK_CRIMSON);
}

function paintLegsStride(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 11, 24, 3, 5, GUNMETAL);
  drawPixelRect(ctx, 11, 28, 4, 2, VOID_DARK);
  outlinedRect(ctx, 18, 24, 3, 5, GUNMETAL);
  drawPixelRect(ctx, 18, 28, 4, 2, VOID_DARK);
}

function paintLegsStand(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 13, 24, 3, 5, GUNMETAL);
  drawPixelRect(ctx, 12, 28, 4, 2, VOID_DARK);
  outlinedRect(ctx, 17, 24, 3, 5, GUNMETAL);
  drawPixelRect(ctx, 17, 28, 4, 2, VOID_DARK);
}

function paintDendriteL(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 10, 10, 3, 2, GUNMETAL);
  outlinedRect(ctx, 8, 7, 2, 4, GUNMETAL);
  outlinedRect(ctx, 6, 4, 2, 4, GUNMETAL);
  drawPixelRect(ctx, 6, 3, 2, 1, SIGNAL_GREEN);
}

function paintDendriteR(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 9, 12, 3, 2, GUNMETAL);
  outlinedRect(ctx, 6, 13, 3, 2, GUNMETAL);
  outlinedRect(ctx, 3, 12, 3, 2, GUNMETAL);
  drawPixelRect(ctx, 2, 12, 1, 2, SIGNAL_GREEN);
}

function paintWeaponArm(ctx: CanvasRenderingContext2D): void {
  outlinedRect(ctx, 17, 11, 3, 5, GUNMETAL);
  outlinedRect(ctx, 19, 14, 3, 3, GUNMETAL);
  drawPixelRect(ctx, 21, 14, 5, 2, STEEL_LIGHT);
  drawPixelRect(ctx, 21, 16, 2, 2, VOID_DARK);
  drawPixelRect(ctx, 26, 14, 1, 1, SIGNAL_GREEN);
}

export function loadRig(): void {
  if (rig) return;
  rig = {
    head: {
      front: makeCanvas(paintHeadFront),
      back: makeCanvas(paintHeadBack),
      side: makeCanvas(paintHeadSide),
    },
    torso: {
      front: makeCanvas(paintTorsoFront),
      back: makeCanvas(paintTorsoBack),
      side: makeCanvas(paintTorsoSide),
    },
    robes: makeCanvas(paintRobes),
    legs: [makeCanvas(paintLegsStride), makeCanvas(paintLegsStand)],
    dendriteL: makeCanvas(paintDendriteL),
    dendriteR: makeCanvas(paintDendriteR),
    weaponArm: makeCanvas(paintWeaponArm),
  };
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  anchor: PartDef,
  dx: number,
  dy: number,
): void {
  ctx.drawImage(
    canvas,
    (-anchor.anchorX + dx) * UNIT_SCALE,
    (-anchor.anchorY + dy) * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
  );
}

function drawDendrite(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  root: { x: number; y: number },
  angle: number,
): void {
  ctx.save();
  ctx.translate(
    (root.x - PARTS.dendriteL.anchorX) * UNIT_SCALE,
    (root.y - PARTS.dendriteL.anchorY) * UNIT_SCALE,
  );
  ctx.rotate(angle);
  ctx.drawImage(canvas, -root.x * UNIT_SCALE, -root.y * UNIT_SCALE, PART_SIZE * UNIT_SCALE, PART_SIZE * UNIT_SCALE);
  ctx.restore();
}

export function drawRig(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  facing: Facing,
  phase: number,
  moving: boolean,
): void {
  if (!rig) throw new Error('rig not loaded');
  const anchor = PARTS.head;
  const legFrame = moving ? Math.floor(phase * 2) % 2 : 1;
  const bob = moving && legFrame === 0 ? -1 : 0;
  const sway = Math.round(Math.sin(phase * Math.PI * 2));
  const pose: Pose = facing === 0 ? 'front' : facing === 2 ? 'back' : 'side';

  ctx.save();
  ctx.translate(Math.round(footX), Math.round(footY));
  if (facing === 3) ctx.scale(-1, 1);

  const dendritesAfterBody = pose === 'back';
  if (!dendritesAfterBody) {
    drawDendrite(ctx, rig.dendriteL, DENDRITE_L_ROOT, Math.sin(phase * Math.PI * 2) * WRITHE_RADIANS);
    drawDendrite(
      ctx,
      rig.dendriteR,
      DENDRITE_R_ROOT,
      Math.sin(phase * Math.PI * 2 + Math.PI / 3) * WRITHE_RADIANS,
    );
  }
  drawPart(ctx, rig.legs[legFrame]!, anchor, 0, 0);
  drawPart(ctx, rig.robes, PARTS.robes, sway, bob);
  drawPart(ctx, rig.torso[pose], anchor, 0, bob);
  drawPart(ctx, rig.weaponArm, anchor, 0, bob);
  drawPart(ctx, rig.head[pose], anchor, 0, bob);
  if (dendritesAfterBody) {
    drawDendrite(ctx, rig.dendriteL, DENDRITE_L_ROOT, Math.sin(phase * Math.PI * 2) * WRITHE_RADIANS);
    drawDendrite(
      ctx,
      rig.dendriteR,
      DENDRITE_R_ROOT,
      Math.sin(phase * Math.PI * 2 + Math.PI / 3) * WRITHE_RADIANS,
    );
  }
  ctx.restore();
}

const warriorCanvas = makeCanvas((ctx) => {
  outlinedRect(ctx, 12, 24, 3, 5, GUNMETAL);
  outlinedRect(ctx, 17, 24, 3, 5, GUNMETAL);
  outlinedRect(ctx, 10, 13, 12, 11, GUNMETAL);
  for (let ry = 15; ry <= 21; ry += 2) {
    drawPixelRect(ctx, 11, ry, 10, 1, SLATE_DARK);
  }
  outlinedRect(ctx, 7, 13, 4, 4, GUNMETAL);
  outlinedRect(ctx, 21, 13, 4, 4, GUNMETAL);
  outlinedRect(ctx, 13, 6, 6, 7, GUNMETAL);
  drawPixelRect(ctx, 13, 8, 6, 2, SIGNAL_GREEN);
  drawPixelRect(ctx, 15, 8, 2, 2, PALE_GREEN);
});

const scarabCanvas = makeCanvas((ctx) => {
  for (const lx of [11, 15, 19]) {
    drawPixelRect(ctx, lx, 29, 1, 2, GUNMETAL);
  }
  outlinedRect(ctx, 11, 22, 10, 7, TOMB_TEAL);
  drawPixelRect(ctx, 13, 23, 2, 5, SLATE_DARK);
  drawPixelRect(ctx, 17, 23, 2, 5, SLATE_DARK);
  drawPixelRect(ctx, 21, 23, 2, 4, GUNMETAL);
  drawPixelRect(ctx, 22, 24, 1, 1, PALE_GREEN);
});

export function drawWarrior(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  phase: number,
): void {
  const sway = Math.round(Math.sin(phase * Math.PI * 2));
  const fx = Math.round(footX);
  const fy = Math.round(footY);
  ctx.drawImage(
    warriorCanvas,
    fx + (sway - 16) * UNIT_SCALE,
    fy - 31 * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
  );
  ctx.globalAlpha = 0.4 + 0.4 * Math.sin(phase * Math.PI * 2);
  drawPixelRect(ctx, fx + (sway - 3) * UNIT_SCALE, fy - 23 * UNIT_SCALE, 4 * UNIT_SCALE, 2 * UNIT_SCALE, PALE_GREEN);
  ctx.globalAlpha = 1;
}

export function drawScarab(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  phase: number,
): void {
  const hover = Math.round(Math.sin(phase * Math.PI * 2)) - 1;
  const fx = Math.round(footX);
  const fy = Math.round(footY);
  ctx.drawImage(
    scarabCanvas,
    fx - 16 * UNIT_SCALE,
    fy + (hover - 31) * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
    PART_SIZE * UNIT_SCALE,
  );
  ctx.globalAlpha = 0.4 + 0.4 * Math.sin(phase * Math.PI * 2);
  drawPixelRect(ctx, fx + 6 * UNIT_SCALE, fy + (hover - 7) * UNIT_SCALE, UNIT_SCALE, UNIT_SCALE, PALE_GREEN);
  ctx.globalAlpha = 1;
}
