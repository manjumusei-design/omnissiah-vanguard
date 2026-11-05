export type ArtImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

async function bitmapFrom(url: string): Promise<ArtImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function imageFrom(url: string): Promise<ArtImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed for ${url}`));
    img.src = url;
  });
}

export async function loadArtImage(url: string): Promise<ArtImage | null> {
  try {
    return await bitmapFrom(url);
  } catch {
    try {
      return await imageFrom(url);
    } catch {
      return null;
    }
  }
}