import { loadArtImage, type ArtImage } from './assets';

const ART_ROOT = '/art/processed/';

let floor: ArtImage | null = null;
let wallFace: ArtImage | null = null;
let wallTop: ArtImage | null = null;

export async function loadBoardTextures(): Promise<void> {
  const [floorImg, faceImg, topImg] = await Promise.all([
    loadArtImage(ART_ROOT + 'board-floor.png'),
    loadArtImage(ART_ROOT + 'wall-face.png'),
    loadArtImage(ART_ROOT + 'wall-top.png'),
  ]);
  floor = floorImg;
  wallFace = faceImg;
  wallTop = topImg;
}

export function floorTexture(): ArtImage | null {
  return floor;
}

export function wallFaceTexture(): ArtImage | null {
  return wallFace;
}

export function wallTopTexture(): ArtImage | null {
  return wallTop;
}