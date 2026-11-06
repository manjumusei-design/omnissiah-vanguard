import {
  BOARD_COLS,
  BOARD_ROWS,
  type TileKind,
} from './board';
import {
  ASH_GRAY,
  BONE,
  BRASS,
  DARK_CRIMSON,
  DEEP_RED,
  GUNMETAL,
  NEAR_BLACK,
  SIGNAL_GREEN,
  SLATE_DARK,
  VOID_DARK,
} from './palette';
import { TILE_H, TILE_W, toScreen, type GridPos, type ScreenPos } from './projection';
import { drawEnemy, drawPixelRect, drawRig, drawShadow, PRIEST_SCALE } from './rig';
import { ENEMY_TYPES } from './enemies';
import {
  floorTexture,
  wallFaceTexture,
  wallTopTexture,
} from './textures';
import type { ArtImage } from './assets';
import type { Facing, Unit } from './units';

const WALL_HEIGHT = 24;
const RAISED_HEIGHT = 10;

export const PRIEST_FOOT_OFFSET = 8;

export interface Camera {
  x: number;
  y: number;
}

export interface Scene {
  board: TileKind[][];
  units: Unit[];
  threat: Set<string>;
  showThreat: boolean;
  reachable: Set<string>;
  playerScreen: ScreenPos;
  playerFacing: Facing;
  playerPhase: number;
  playerMoving: boolean;
  flashTile: string | null;
  flashAge: number;
  time: number;
}

export function tileRaise(board: TileKind[][], x: number, y: number): number {
  const tile = board[y]?.[x];
  if (tile === 'wall') return WALL_HEIGHT;
  if (tile === 'raised') return RAISED_HEIGHT;
  return 0;
}

export function tileFoot(board: TileKind[][], g: GridPos, footOffset: number): ScreenPos {
  const s = toScreen(g);
  return { x: s.x, y: s.y - tileRaise(board, g.x, g.y) + footOffset };
}

export function createBackground(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.imageSmoothingEnabled = false;
  drawPixelRect(ctx, 0, 0, canvas.width, canvas.height, NEAR_BLACK);

  ctx.globalAlpha = 0.07;
  ctx.fillStyle = ASH_GRAY;
  for (let y = 0; y < canvas.height; y += 96) {
    for (let x = 0; x < canvas.width; x += 160) {
      const ox = (y / 96) % 2 === 0 ? 0 : 80;
      ctx.fillRect(x + ox, y, 158, 1);
      ctx.fillRect(x + ox, y, 1, 94);
    }
  }

  ctx.globalAlpha = 0.1;
  for (let y = 40; y < canvas.height; y += 96) {
    for (let x = 0; x < canvas.width; x += 24) {
      ctx.fillRect(x, y, 12, 1);
      ctx.fillRect(x, y + 3, 12, 1);
    }
  }

  ctx.globalAlpha = 0.13;
  for (let y = 0; y < canvas.height; y += 96) {
    for (let x = 0; x < canvas.width; x += 160) {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 159, y, 1, 1);
      ctx.fillRect(x, y + 95, 1, 1);
    }
  }

  ctx.globalAlpha = 1;
  return canvas;
}

function diamondPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w = TILE_W, h = TILE_H): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

const TEXTURE_SIZE = 32;
const FLOOR_SAMPLE = 64;
const FLOOR_SAMPLE_MAX = 512 - FLOOR_SAMPLE;

function floorSample(x: number, y: number): { sx: number; sy: number } {
  return {
    sx: (x * 53 + y * 97) % FLOOR_SAMPLE_MAX,
    sy: (x * 31 + y * 71) % FLOOR_SAMPLE_MAX,
  };
}

function diamondTransform(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.transform(TILE_W / 2, TILE_H / 2, -TILE_W / 2, TILE_H / 2, cx, cy - TILE_H / 2);
}

function faceTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  height: number,
  side: 'left' | 'right',
): void {
  if (side === 'left') {
    ctx.transform(TILE_W / 2, TILE_H / 2, 0, height, cx - TILE_W / 2, topY);
  } else {
    ctx.transform(TILE_W / 2, -TILE_H / 2, 0, height, cx, topY + TILE_H / 2);
  }
}

function drawDiamondTexture(
  ctx: CanvasRenderingContext2D,
  image: ArtImage,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  sample: number,
): void {
  ctx.save();
  diamondTransform(ctx, cx, cy);
  ctx.drawImage(image, sx, sy, sample, sample, 0, 0, 1, 1);
  ctx.restore();
}

function drawFaceTexture(
  ctx: CanvasRenderingContext2D,
  image: ArtImage,
  cx: number,
  topY: number,
  height: number,
  side: 'left' | 'right',
): void {
  ctx.save();
  faceTransform(ctx, cx, topY, height, side);
  ctx.drawImage(image, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE, 0, 0, 1, 1);
  ctx.restore();
}

function drawFloorDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  light: boolean,
  gx: number,
  gy: number,
): void {
  const tex = floorTexture();
  if (tex) {
    const s = floorSample(gx, gy);
    drawDiamondTexture(ctx, tex, cx, cy, s.sx, s.sy, FLOOR_SAMPLE);
    diamondPath(ctx, cx, cy);
    ctx.globalAlpha = light ? 0.25 : 0.45;
    ctx.fillStyle = light ? ASH_GRAY : VOID_DARK;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    diamondPath(ctx, cx, cy);
    ctx.fillStyle = light ? ASH_GRAY : SLATE_DARK;
    ctx.fill();
  }
  ctx.strokeStyle = NEAR_BLACK;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBlockSides(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
): void {
  const topY = cy - height;
  ctx.fillStyle = VOID_DARK;
  ctx.beginPath();
  ctx.moveTo(cx - TILE_W / 2, topY);
  ctx.lineTo(cx, topY + TILE_H / 2);
  ctx.lineTo(cx, topY + TILE_H / 2 + height);
  ctx.lineTo(cx - TILE_W / 2, topY + height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = SLATE_DARK;
  ctx.beginPath();
  ctx.moveTo(cx + TILE_W / 2, topY);
  ctx.lineTo(cx, topY + TILE_H / 2);
  ctx.lineTo(cx, topY + TILE_H / 2 + height);
  ctx.lineTo(cx + TILE_W / 2, topY + height);
  ctx.closePath();
  ctx.fill();

  const face = wallFaceTexture();
  if (face) {
    drawFaceTexture(ctx, face, cx, topY, height, 'left');
    drawFaceTexture(ctx, face, cx, topY, height, 'right');
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  board: TileKind[][],
  x: number,
  y: number,
  camera: Camera,
): void {
  const kind = board[y]?.[x];
  if (!kind) return;
  const s = toScreen({ x, y });
  const cx = s.x + camera.x;
  const cy = s.y + camera.y;
  const topCy = cy - tileRaise(board, x, y);
  const light = (x + y) % 2 === 0;

  switch (kind) {
    case 'wall': {
      drawBlockSides(ctx, cx, cy, WALL_HEIGHT);
      const top = wallTopTexture();
      if (top) drawDiamondTexture(ctx, top, cx, topCy, 0, 0, TEXTURE_SIZE);
      diamondPath(ctx, cx, topCy);
      if (!top) {
        ctx.fillStyle = GUNMETAL;
        ctx.fill();
      }
      ctx.strokeStyle = NEAR_BLACK;
      ctx.lineWidth = 1;
      ctx.stroke();
      diamondPath(ctx, cx, topCy, TILE_W * 0.66, TILE_H * 0.66);
      ctx.strokeStyle = SLATE_DARK;
      ctx.stroke();
      break;
    }
    case 'raised':
      drawBlockSides(ctx, cx, cy, RAISED_HEIGHT);
      drawFloorDiamond(ctx, cx, topCy, light, x, y);
      diamondPath(ctx, cx, topCy);
      ctx.strokeStyle = BRASS;
      ctx.stroke();
      break;
    case 'hazard':
      drawFloorDiamond(ctx, cx, topCy, light, x, y);
      ctx.save();
      diamondPath(ctx, cx, topCy);
      ctx.clip();
      ctx.fillStyle = SIGNAL_GREEN;
      for (let sy = -TILE_H / 2 + 4; sy < TILE_H / 2; sy += 6) {
        ctx.fillRect(cx - TILE_W / 2, topCy + sy, TILE_W, 2);
      }
      ctx.restore();
      break;
    case 'console':
      drawFloorDiamond(ctx, cx, topCy, light, x, y);
      drawPixelRect(ctx, cx - 9, topCy - 15, 18, 11, NEAR_BLACK);
      drawPixelRect(ctx, cx - 8, topCy - 14, 16, 9, GUNMETAL);
      drawPixelRect(ctx, cx - 5, topCy - 12, 8, 4, SIGNAL_GREEN);
      break;
    case 'shrine':
      drawFloorDiamond(ctx, cx, topCy, light, x, y);
      drawPixelRect(ctx, cx - 4, topCy - 19, 8, 27, NEAR_BLACK);
      drawPixelRect(ctx, cx - 3, topCy - 18, 6, 25, DEEP_RED);
      drawPixelRect(ctx, cx - 1, topCy - 18, 2, 25, DARK_CRIMSON);
      drawPixelRect(ctx, cx - 3, topCy + 4, 6, 2, NEAR_BLACK);
      break;
    case 'floor':
      drawFloorDiamond(ctx, cx, topCy, light, x, y);
      break;
  }
}

function drawThreat(ctx: CanvasRenderingContext2D, g: GridPos, camera: Camera): void {
  const s = toScreen(g);
  diamondPath(ctx, s.x + camera.x, s.y + camera.y);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = SIGNAL_GREEN;
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = SIGNAL_GREEN;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawReachable(ctx: CanvasRenderingContext2D, g: GridPos, camera: Camera): void {
  const s = toScreen(g);
  diamondPath(ctx, s.x + camera.x, s.y + camera.y);
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawFlash(ctx: CanvasRenderingContext2D, g: GridPos, camera: Camera, age: number): void {
  const s = toScreen(g);
  diamondPath(ctx, s.x + camera.x, s.y + camera.y);
  ctx.globalAlpha = age * 0.6;
  ctx.fillStyle = BONE;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function parseKey(key: string): GridPos {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}


function drawUnits(ctx: CanvasRenderingContext2D, scene: Scene, camera: Camera): void {
  const sorted = [...scene.units].sort(
    (a, b) => a.pos.x + a.pos.y - (b.pos.x + b.pos.y),
  );
  for (const unit of sorted) {
    if (unit.typeId === 'techpriest') {
      const px = scene.playerScreen.x + camera.x;
      const py = scene.playerScreen.y + camera.y;
      drawShadow(ctx, px, py, PRIEST_SCALE);
      drawRig(ctx, px, py, scene.playerFacing, scene.playerPhase, scene.playerMoving);
      continue;
    }
    const type = ENEMY_TYPES[unit.typeId];
    const foot = tileFoot(scene.board, unit.pos, type.footOffset);
    const phase = (scene.time * 0.5 + unit.pos.x * 0.37 + unit.pos.y * 0.53) % 1;
    drawEnemy(ctx, unit.typeId, foot.x + camera.x, foot.y + camera.y, phase);
  }
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  camera: Camera,
  background: HTMLCanvasElement,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(background, 0, 0);

  for (let sum = 0; sum <= BOARD_COLS + BOARD_ROWS - 2; sum++) {
    for (let x = Math.max(0, sum - (BOARD_ROWS - 1)); x <= Math.min(BOARD_COLS - 1, sum); x++) {
      const y = sum - x;
      if (scene.board[y]?.[x]) {
        drawTile(ctx, scene.board, x, y, camera);
      }
    }
  }

  if (scene.showThreat) {
    for (const key of scene.threat) {
      drawThreat(ctx, parseKey(key), camera);
    }
  }
  for (const key of scene.reachable) {
    drawReachable(ctx, parseKey(key), camera);
  }
  if (scene.flashTile && scene.flashAge > 0) {
    drawFlash(ctx, parseKey(scene.flashTile), camera, scene.flashAge);
  }

  drawUnits(ctx, scene, camera);
}
