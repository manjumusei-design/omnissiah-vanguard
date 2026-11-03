// Ai generated rigging for the character skeleton, reviewed by me and playtested


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
import { drawPixelRect, drawRig, drawScarab, drawWarrior } from './rig';
import type { Facing, Unit } from './units';

const WALL_HEIGHT = 24;
const RAISED_HEIGHT = 10;
const UNIT_FOOT_OFFSET = 6;

export interface Camera {
  x: number;
  y: number;
}

export interface Scene {
  board: TileKind[][];
  units: Unit[];
  thread: Set<string>;
  showThreat: boolean;
  reachable: Set<string>;
  playerScreen: ScreenPos;
  playerFacing: Facing;
  playerPhase: number;
  playerMoving: boolean;
  flashTIle: string | null;
  flashAge: number;
  time: number;
}

export function tileRaise(board: TileKind[][], x: number, y: number): number {
  const tile = board[y]?.[x];
  if (tile === 'wall') return WALL_HEIGHT;
  if (tile === 'raised') return RAISED_HEIGHT;
  return 0;
}

export function tileFoot(board: TileKind[][], g: GridPos): ScreenPos {
  const s = toScreen(g);
  return { x: s.x, y: s.y - tileRaise(board, g.x, g.y) + UNIT_FOOT_OFFSET };
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

function drawFloorDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, light: boolean): void {
  diamondPath(ctx, cx, cy);
  ctx.fillStyle = light ? ASH_GRAY : SLATE_DARK;
  ctx.fill();
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
    case 'wall':
      drawBlockSides(ctx, cx, cy, WALL_HEIGHT);
      diamondPath(ctx, cx, topCy);
      ctx.fillStyle = GUNMETAL;
      ctx.fill();
      ctx.strokeStyle = NEAR_BLACK;
      ctx.lineWidth = 1;
      ctx.stroke();
      diamondPath(ctx, cx, topCy, TILE_W * 0.66, TILE_H * 0.66);
      ctx.strokeStyle = SLATE_DARK;
      ctx.stroke();
      break;
    case 'raised':
      drawBlockSides(ctx, cx, cy, RAISED_HEIGHT);
      drawFloorDiamond(ctx, cx, topCy, light);
      diamondPath(ctx, cx, topCy);
      ctx.strokeStyle = BRASS;
      ctx.stroke();
      break;
    case 'hazard':
      drawFloorDiamond(ctx, cx, topCy, light);
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
      drawFloorDiamond(ctx, cx, topCy, light);
      drawPixelRect(ctx, cx - 9, topCy - 15, 18, 11, NEAR_BLACK);
      drawPixelRect(ctx, cx - 8, topCy - 14, 16, 9, GUNMETAL);
      drawPixelRect(ctx, cx - 5, topCy - 12, 8, 4, SIGNAL_GREEN);
      break;
    case 'shrine':
      drawFloorDiamond(ctx, cx, topCy, light);
      drawPixelRect(ctx, cx - 4, topCy - 19, 8, 27, NEAR_BLACK);
      drawPixelRect(ctx, cx - 3, topCy - 18, 6, 25, DEEP_RED);
      drawPixelRect(ctx, cx - 1, topCy - 18, 2, 25, DARK_CRIMSON);
      drawPixelRect(ctx, cx - 3, topCy + 4, 6, 2, NEAR_BLACK);
      break;
    case 'floor':
      drawFloorDiamond(ctx, cx, topCy, light);
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

const SHADOW_RX = 22;
const SHADOW_RY = 10;

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = NEAR_BLACK;
  ctx.beginPath();
  ctx.ellipse(x, y + 3, SHADOW_RX, SHADOW_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawUnits(ctx: CanvasRenderingContext2D, scene: Scene, camera: Camera): void {
  const sorted = [...scene.units].sort(
    (a, b) => a.pos.x + a.pos.y - (b.pos.x + b.pos.y),
  );
  for (const unit of sorted) {
    if (unit.kind === 'techpriest') {
      const px = scene.playerScreen.x + camera.x;
      const py = scene.playerScreen.y + camera.y;
      drawShadow(ctx, px, py);
      drawRig(ctx, px, py, scene.playerFacing, scene.playerPhase, scene.playerMoving);
      continue;
    }
    const foot = tileFoot(scene.board, unit.pos);
    const phase = (scene.time * 0.5 + unit.pos.x * 0.37 + unit.pos.y * 0.53) % 1;
    drawShadow(ctx, foot.x + camera.x, foot.y + camera.y);
    if (unit.kind === 'warrior') {
      drawWarrior(ctx, foot.x + camera.x, foot.y + camera.y, phase);
    } else {
      drawScarab(ctx, foot.x + camera.x, foot.y + camera.y, phase);
    }
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
