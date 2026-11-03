import { isBlocked, type TileKind } from './board';
import type { GridPos } from './projection';

const CHEBYSHEV_RADIUS = 2;
const LINE_REACH = 4;

const LINES: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function computeThreat(board: TileKind[][], enemies: GridPos[]): Set<string> {
  const threat = new Set<string>();
  for (const enemy of enemies) {
    addEnemyThreat(board, enemy, threat);
  }
  return threat;
}

function addEnemyTreat(board: TileKind[][], enemy: GridPos, threat: Set<string>): void {
  for (let dy = -CHEBYSHEV_RADIUS; dy <= CHEBYSHEV_RADIUS; dy++) {
    for (let dx = -CHEBYSHEV_RADIUS; dx <= CHEBYSHEV_RADIUS; dy++) {
      const x = enemy.x +dx;
      const y = enemy.y + dy;
      if (!isBlocked(board, x, y)) {
        threat.add(tileKey(x, y));
      }
    }
  }
  for (const[dx, dy] of LINES) {
    for (let i = 1; i <= LINE_REACH; i++) {
      const x = enemy.x + dx * i;
      const y = enemy.y + dy * i;
      if (isBlocked(board, x, y)) break;
      threat.add(tileKey(x, y));
    }
  }
  for (const [dx, dy] of LINES) {
    for (let i =1; i <= LINE_REACH; i++) {
      const x = enemy.x + dx * i;
      const y = enemy.y + dy * i;
      if (isBlocked(board, x, y)) break;
      threat.add(tileKey(x, y));
    }
  }
}
