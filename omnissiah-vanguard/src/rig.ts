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
  WHITE,
} from './palette';
import { loadArtImage, type ArtImage } from './assets';
import { ENEMY_TYPES, spriteFile, type EnemyIdle, type EnemyTypeId } from './enemies';
import type { Facing, Unit } from './units';

export const PRIEST_SCALE = 1.3;

const ART_ROOT = '/art/processed/';

export type PartName = 'head' | 'torso' | 'robes' | 'legs' | 'dendriteL' | 'dendriteR' | 'weaponArm';

export interface PartDef {
  anchorX: number;
  anchorY: number;
  flipForLeft: boolean;
  image: ArtImage | null;
}

export const PARTS: Record<PartName, PartDef> = {
  head: { anchorX: 16, anchorY: 31, flipForLeft: true, image: null },
  torso: { anchorX: 16, anchorY: 31, flipForLeft: true, image: null },
  robes: { anchorX: 16, anchorY: 31, flipForLeft: false, image: null },
  legs: { anchorX: 16, anchorY: 31, flipForLeft: false, image: null },
  dendriteL: { anchorX: 16, anchorY: 31, flipForLeft: true, image: null },
  dendriteR: { anchorX: 16, anchorY: 31, flipForLeft: false, image: null },
  weaponArm: { anchorX: 16, anchorY: 31, flipForLeft: true, image: null },
};

const TORSO_LIFT = 28;
const HEAD_LIFT = 56;
const DENDRITE_ROOT_IMG = { x: 17, y: 2 };
const DENDRITE_ATTACH_L = { x: 12, y: -54 };
const DENDRITE_ATTACH_R = { x: 11, y: -54 };
const WEAPON_ROOT_IMG = {x: 4, y: 2 };
const WEAPON_ATTACH = { x: 9, y: -54};

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

function buildPaintedRig(): void {
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

export async function loadRig(): Promise<void> {
  buildPaintedRig();
  const [head, torso, legs, dendrite, weapon] = await Promise.all([
    loadArtImage(ART_ROOT + 'priest-head.png'),
    loadArtImage(ART_ROOT + 'priest-torso.png'),
    loadArtImage(ART_ROOT + 'priest-legs.png'),
    loadArtImage(ART_ROOT + 'priest-dendrite.png'),
    loadArtImage(ART_ROOT + 'priest-weapon.png'),
  ])
  PARTS.head.image = head;
  PARTS.torso.image = torso;
  PARTS.legs.image = legs;
  PARTS.dendriteL.image = dendrite;
  PARTS.dendriteR.image = dendrite;
  PARTS.weaponArm.image = weapon;
  if (!head) console.log('rig: fallback to painted part head');
  if (!torso) console.log('rig: fallback to painted part torso');
  if (!legs) console.log('rig: fallback to painted part legs');
  if (!dendrite) console.log('rig: fallback to painted part dendrite');
  if (!weapon) console.log('rig: fallback to painted part weaponArm');
}

const SHADOW_RX = 11;
const SHADOW_RY = 5;
const SHADOW_DROP = 1.5;
const SHADOW_ALPHA = 0.4;


export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number = SHADOW_ALPHA,
): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = NEAR_BLACK;
  ctx.beginPath();
  ctx.ellipse(x, y + SHADOW_DROP * scale, SHADOW_RX * scale, SHADOW_RY * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

const enemyArt: Record<EnemyTypeId, ArtImage | null> = {
  scarab: null,
  warrior: null,
  immortal: null,
  wraith: null,
  sentinel: null,
};

export async function loadEnemyArt(): Promise<void> {
  const ids = Object.keys(ENEMY_TYPES) as EnemyTypeId[];
  const images = await Promise.all(ids.map((id) => loadArtImage(spriteFile(id))));
  for (const [index, id] of ids.entries()) {
    enemyArt[id] = images[index] ?? null;
    if (!images[index]) console.log(`enemy art: fallback to painted sprite ${id}`);
  }
}

function drawArt (
  ctx: CanvasRenderingContext2D,
  image: ArtImage,
  anchorX: number,
  anchorY: number,
  dx: number,
  dy: number,
  scale: number,
  flip = false,
): void {
  if (!flip) {
    ctx.drawImage(
      image,
      (dx - anchorX) * scale,
      (dy - anchorY) * scale,
      PART_SIZE * scale,
      PART_SIZE * scale,
    );
    return;
  }
  ctx.save();
  ctx.translate(dx * scale, dy * scale);
  ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    anchorX * scale,
    anchorY * scale,
    PART_SIZE * scale,
    PART_SIZE * scale,
  );
  ctx.restore();
}

function drawPart(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  anchor: PartDef,
  dx: number,
  dy: number,
): void {
  drawArt(ctx, canvas, anchor.anchorX, anchor.anchorY, dx, dy, PRIEST_SCALE);
}

function drawDendrite(
  ctx: CanvasRenderingContext2D,
  image: ArtImage,
  pivotImg: { x: number; y: number },
  pivotRig: { x: number; y: number },
  angle: number,
  scale: number,
  flip: boolean,
): void {
  ctx.save();
  ctx.translate(pivotRig.x * scale, pivotRig.y * scale);
  ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    -pivotImg.x * scale,
    -pivotImg.y * scale,
    PART_SIZE * scale,
    PART_SIZE * scale,
  );
  ctx.restore();
}

function drawDendrites(ctx: CanvasRenderingContext2D, phase: number): void {
  if (!rig) throw new Error('rig not loaded');
  const angleL = Math.sin(phase * Math.PI * 2) *WRITHE_RADIANS;
  const angleR = Math.sin(phase * Math.PI * 2 + Math.PI / 3) * WRITHE_RADIANS;
  const dendriteImage = PARTS.dendriteL.image;
  if (dendriteImage) {
    drawDendrite(ctx, dendriteImage, DENDRITE_ROOT_IMG, DENDRITE_ATTACH_L, angleL, PRIEST_SCALE, PARTS.dendriteL.flipForLeft);
    drawDendrite(ctx, dendriteImage, DENDRITE_ROOT_IMG, DENDRITE_ATTACH_R, angleR, PRIEST_SCALE, PARTS.dendriteR.flipForLeft);
    return;
  }
  drawDendrite(
    ctx,
    rig.dendriteL,
    DENDRITE_L_ROOT,
    { x: DENDRITE_L_ROOT.x - PARTS.dendriteL.anchorX, y: DENDRITE_L_ROOT.y - PARTS.dendriteL.anchorY },
    angleL,
    PRIEST_SCALE,
    false,
  );
  drawDendrite(
    ctx,
    rig.dendriteR,
    DENDRITE_R_ROOT,
    { x: DENDRITE_R_ROOT.x - PARTS.dendriteR.anchorX, y: DENDRITE_R_ROOT.y - PARTS.dendriteR.anchorY },
    angleR,
    PRIEST_SCALE,
    false,
  );
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
  if (!dendritesAfterBody) drawDendrites(ctx, phase);

  const legsImage = PARTS.legs.image;
  if (legsImage) {
    drawArt(ctx, legsImage, PARTS.legs.anchorX, PARTS.legs.anchorY, 0, 0, PRIEST_SCALE, legFrame === 0);
  } else {
    drawPart(ctx, rig.legs[legFrame]!, PARTS.legs, 0, 0);
  }

  const torsoImage = PARTS.torso.image;
  if (torsoImage) {
    drawArt(ctx, torsoImage, PARTS.torso.anchorX, PARTS.torso.anchorY, sway, bob - TORSO_LIFT, PRIEST_SCALE);
  } else {
    drawPart(ctx, rig.robes, PARTS.robes, sway, bob);
    drawPart(ctx, rig.torso[pose], PARTS.torso, 0, bob);
  }

  const headImage = PARTS.head.image;
  if (headImage) {
    drawArt(ctx, headImage, PARTS.head.anchorX, PARTS.head.anchorY, 0, bob - HEAD_LIFT, PRIEST_SCALE);
  } else {
    drawPart(ctx, rig.head[pose], anchor, 0, bob);
  }

  const weaponImage = PARTS.weaponArm.image;
  if (weaponImage) {
    drawArt(
      ctx,
      weaponImage,
      WEAPON_ROOT_IMG.x,
      WEAPON_ROOT_IMG.y,
      WEAPON_ATTACH.x,
      WEAPON_ATTACH.y + bob,
      PRIEST_SCALE,
    );
  } else {
    drawPart(ctx, rig.weaponArm, PARTS.weaponArm, 0, bob);
  }

  if (dendritesAfterBody) drawDendrites(ctx, phase);
  ctx.restore();
}

const enemyFallbackPainters: Record<EnemyTypeId, (ctx: CanvasRenderingContext2D) => void> = {
  warrior: (ctx) => {
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
  },
  scarab: (ctx) => {
    for (const lx of [11, 15, 19]) {
      drawPixelRect(ctx, lx, 29, 1, 2, GUNMETAL);
    }
    outlinedRect(ctx, 11, 22, 10, 7, TOMB_TEAL);
    drawPixelRect(ctx, 13, 23, 2, 5, SLATE_DARK);
    drawPixelRect(ctx, 17, 23, 2, 5, SLATE_DARK);
    drawPixelRect(ctx, 21, 23, 2, 4, GUNMETAL);
    drawPixelRect(ctx, 22, 24, 1, 1, PALE_GREEN);
  },
  immortal: (ctx) => {
    outlinedRect(ctx, 11, 24, 3, 5, GUNMETAL);
    outlinedRect(ctx, 18, 24, 3, 5, GUNMETAL);
    outlinedRect(ctx, 10, 13, 12, 11, GUNMETAL);
    for (let ry = 15; ry <= 21; ry += 2) {
      drawPixelRect(ctx, 11, ry, 10, 1, SLATE_DARK);
    }
    outlinedRect(ctx, 7, 13, 4, 4, GUNMETAL);
    outlinedRect(ctx, 21, 13, 4, 4, GUNMETAL);
    outlinedRect(ctx, 13, 6, 6, 7, GUNMETAL);
    drawPixelRect(ctx, 13, 8, 6, 2, SIGNAL_GREEN);
    outlinedRect(ctx, 22, 17, 4, 3, TOMB_TEAL);
    drawPixelRect(ctx, 25, 18, 2, 1, PALE_GREEN);
  },
  wraith: (ctx) => {
    outlinedRect(ctx, 6, 20, 6, 5, TOMB_TEAL);
    outlinedRect(ctx, 9, 24, 6, 5, TOMB_TEAL);
    outlinedRect(ctx, 13, 11, 10, 10, TOMB_TEAL);
    drawPixelRect(ctx, 15, 14, 3, 2, PALE_GREEN);
    outlinedRect(ctx, 21, 17, 5, 3, GUNMETAL);
    drawPixelRect(ctx, 25, 18, 2, 1, SLATE_DARK);
  },
  sentinel: (ctx) => {
    for (const [lx, ly] of [[3, 18], [7, 24], [22, 24], [26, 18]] as const) {
      outlinedRect(ctx, lx, ly, 3, 6, GUNMETAL);
    }
    outlinedRect(ctx, 9, 11, 14, 13, TOMB_TEAL);
    for (let ry = 13; ry <= 21; ry += 2) {
      drawPixelRect(ctx, 10, ry, 12, 1, SLATE_DARK);
    }
    drawPixelRect(ctx, 13, 14, 2, 2, PALE_GREEN);
    drawPixelRect(ctx, 17, 14, 2, 2, PALE_GREEN);
  },
};

const enemyFallbackCache: Partial<Record<EnemyTypeId, HTMLCanvasElement>> = {};

function enemySprite(id: EnemyTypeId): ArtImage {
  const art = enemyArt[id];
  if (art) return art;
  const cached = enemyFallbackCache[id];
  if (cached) return cached;
  const painted = makeCanvas(enemyFallbackPainters[id]);
  enemyFallbackCache[id] = painted;
  return painted;
}

function idleOffset(idle: EnemyIdle, phase: number): { x: number; y: number } {
  if (idle.axis === 'none') return { x: 0, y: 0 };
  const wave = Math.sin(phase * Math.PI * 2 * idle.cycles) * idle.amplitude;
  return idle.axis === 'x'
    ? { x: wave, y: 0 }
    : { x: 0, y: -(idle.lift + wave) };
}

export interface EnemyDrawOptions {
  flip?: boolean;
  alpha?: number;
  flash?: number;
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  typeId: EnemyTypeId,
  footX: number,
  footY: number,
  phase: number,
  opts: EnemyDrawOptions = {}
): void {
  const type = ENEMY_TYPES[typeId];
  const alpha = opts.alpha ?? 1;
  const fx = Math.round(footX);
  const fy = Math.round(footY);
  drawShadow(ctx, fx, fy, type.scale * type.shadowScale, type.shadowAlpha * alpha);
  const offset = idleOffset(type.idle, phase);
  const left = fx + (offset.x - 16) * type.scale;
  const top = fy + (offset.y - 31) * type.scale;
  const width = PART_SIZE * type.scale;
  const height = PART_SIZE * type.scale;
  const sprite = enemySprite(typeId);
  ctx.globalAlpha = alpha;
  if (opts.flip) {
    ctx.drawImage(sprite, left + width, top, -width, height);
  } else {
    ctx.drawImage(sprite, left, top, width, height);
  }
  if (typeId === 'warrior') drawEyeGlow(ctx, fx, fy, offset, type.scale, phase, opts.flip ?? false, alpha);
  if (opts.flash && opts.flash > 0) {
    drawFlashOverlay(ctx, sprite, left, top, width, height, opts.flip ?? false, alpha * Math.min(1, opts.flash));
  }
  ctx.globalAlpha = 1;
}

let flashScratch: HTMLCanvasElement | null = null;

function drawFlashOverlay(
  ctx: CanvasRenderingContext2D,
  sprite: ArtImage,
  left: number,
  top: number,
  width: number,
  height: number,
  flip: number,
  alpha: number,
): void {
  if (!flashScratch) {
    flashScratch = makeCanvas(() => {});
  }
  const sctx = flashScratch.getContext('2d');
  if (!sctx) return;
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, PART_SIZE, PART_SIZE);
  sctx.drawImage(sprite, 0, 0, PART_SIZE, PART_SIZE);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = WHITE;
  sctx.fillRect(0, 0, PART_SIZE, PART_SIZE);
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.drawImage(flashScratch, left + width, top, -width, height);
  } else {
    ctx.drawImage(flashScratch, left, top, width, height);
  }
  ctx.globalAlpha = 1;
}

function drawEyeGlow(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  offset: { x: number; y: number },
  scale: number,
  phase: number,
  flip: boolean,
  alpha: number,
): void {
  ctx.globalAlpha = (0.4 + 0.4 * Math.sin(phase * Math.PI * 2)) * alpha;
  const bandX = flip ? fx - (offset.x - 3) * scale - 4 * scale : fx + (offset.x - 3) * scale;
  drawPixelRect(ctx, bandX, fy + (offset.y - 23) * scale, 4 * scale, 2 * scale, PALE_GREEN);
  ctx.globalAlpha = 1;
}