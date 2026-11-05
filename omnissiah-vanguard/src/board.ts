export type TileKind = 'floor' | 'wall' | 'hazard' | 'raised' | 'console' | 'shrine';

export const BOARD_COLS = 13;
export const BOARD_ROWS = 9;

const INTERIOR_WALLS: ReadonlyArray<readonly [number, number]> = [
  [4, 2], [5, 2], [4, 3],
  [8, 1], [8, 2], [9, 2],
  [10, 5], [10, 6], [11, 6],
  [2, 4], [2, 5],
];

const SPECIALS: ReadonlyArray<readonly [TileKind, number, number]> = [
  ['raised', 6, 1],
  ['raised', 1, 7],
  ['hazard', 7, 5],
  ['console', 11, 3],
  ['shrine', 6, 7],
];

export function makeDemoBoard(): TitleKind[][]{
  const board: TileKind[][] = [];
  for (let y = 0; y < BOARD_ROWS; y++) {
    const row: TileKind[] = [];
    for (let x = 0; x < BOARD_COLS; x++) {
      const border = x === 0 || y === 0 || x === BOARD_COLS - 1 || y === BOARD_ROWS - 1;
      row.push(border ? 'wall' : 'floor');
    }
    board.push(row);
  }
  for (const [x, y] of INTERIOR_WALLS) {
    board[y]![x] = 'wall';
  }
  for (const [kind, x, y] of SPECIALS) {
    board[y] ! [x] = kind;
  }
  return board;
}

export function isBlocked(board: TileKind[][], x: number, y: number): boolean {
  const row = board[y];
  if (!row) return true;
  return row[x] === undefined || row[x] === 'wall';
}