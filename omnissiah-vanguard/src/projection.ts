export interface GridPos {
  x: number;
  y: number;
}

export interface ScreenPos {
  x: number;
  y: number;
}

export const TILE_W = 96;
export const TILE_H = 52;

export function toScreen(g: GridPos): ScreenPos {
  return {
    x: (g.x - g.y) * (TILE_W / 2),
    y: (g.x + g.y) * (TILE_H / 2),
  };
}

export function toGrid(s: ScreenPos): GridPos {
  return {
    x: Math.round(s.x / TILE_W + s.y / TILE_H),
    y: Math.round(s.y / TILE_H - s.x / TILE_W),
  };
}
